import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/crypto";
import { appUrl, required } from "@/lib/env";
import { GoogleReauthRequired } from "@/lib/google/errors";

export { GoogleReauthRequired };

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Permisos minimos: leer y escribir eventos, y saber que cuenta se conecto. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function redirectUri(): string {
  return `${appUrl()}/api/google/callback`;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // offline + consent son necesarios para recibir refresh_token.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const detail = await response.text();
    // invalid_grant es el codigo con el que Google dice "este refresh token ya no vale".
    if (detail.includes("invalid_grant")) throw new GoogleReauthRequired();
    throw new Error(`Google rechazo la peticion de token (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest({
    code,
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("No se pudo leer el correo de la cuenta de Google.");
  const data = (await response.json()) as { email?: string };
  return data.email ?? "desconocido";
}

/** Guarda (o actualiza) la cuenta de Google del usuario con los tokens cifrados. */
export async function saveGoogleAccount(
  supabase: SupabaseClient,
  userId: string,
  tokens: TokenResponse,
  email: string,
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const row: Record<string, unknown> = {
    user_id: userId,
    google_email: email,
    access_token: encrypt(tokens.access_token),
    token_expires_at: expiresAt,
    scope: tokens.scope,
    needs_reconnect: false,
  };
  // Google solo devuelve refresh_token en la primera autorizacion: no lo pises con null.
  if (tokens.refresh_token) row.refresh_token = encrypt(tokens.refresh_token);

  const { error } = await supabase
    .from("google_accounts")
    // Una cuenta por usuario: reconectar con OTRA cuenta sobrescribe la fila
    // en vez de crear una segunda que nadie leeria.
    .upsert(row, { onConflict: "user_id" });

  if (error) throw new Error(`No se pudo guardar la cuenta de Google: ${error.message}`);
}

export async function markNeedsReconnect(supabase: SupabaseClient, accountId: string) {
  await supabase.from("google_accounts").update({ needs_reconnect: true }).eq("id", accountId);
}

export interface ActiveGoogleAccount {
  accessToken: string;
  calendarId: string;
  googleEmail: string;
  accountId: string;
}

/**
 * Devuelve un access token valido para el usuario, refrescandolo si hace falta.
 * Devuelve null si el usuario no ha conectado Google.
 */
export async function getActiveGoogleAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveGoogleAccount | null> {
  const { data: account, error: queryError } = await supabase
    .from("google_accounts")
    .select(
      "id, google_email, access_token, refresh_token, token_expires_at, calendar_id, needs_reconnect",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Un fallo de base de datos no es "no hay cuenta conectada": si lo tratamos
  // igual, la captura se guardaria en local sin avisar de nada.
  if (queryError) throw new Error(`No se pudo leer la cuenta de Google: ${queryError.message}`);
  if (!account) return null;

  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : 0;
  const stillValid = expiresAt - Date.now() > 60_000; // margen de 1 minuto

  if (stillValid) {
    return {
      accessToken: decrypt(account.access_token),
      calendarId: account.calendar_id,
      googleEmail: account.google_email,
      accountId: account.id,
    };
  }

  if (!account.refresh_token) {
    await markNeedsReconnect(supabase, account.id);
    throw new GoogleReauthRequired();
  }

  let refreshed: TokenResponse;
  try {
    refreshed = await refreshAccessToken(decrypt(account.refresh_token));
  } catch (error) {
    if (error instanceof GoogleReauthRequired) {
      await markNeedsReconnect(supabase, account.id);
    }
    throw error;
  }

  await supabase
    .from("google_accounts")
    .update({
      access_token: encrypt(refreshed.access_token),
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("id", account.id);

  return {
    accessToken: refreshed.access_token,
    calendarId: account.calendar_id,
    googleEmail: account.google_email,
    accountId: account.id,
  };
}
