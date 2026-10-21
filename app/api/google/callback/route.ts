import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { exchangeCode, fetchGoogleEmail, saveGoogleAccount } from "@/lib/google/oauth";
import { appUrl } from "@/lib/env";

function backToHub(message: string, ok: boolean) {
  const url = new URL("/", appUrl());
  url.searchParams.set(ok ? "conectado" : "error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl()));

  const params = request.nextUrl.searchParams;

  const denied = params.get("error");
  if (denied) return backToHub("Cancelaste la conexion con Google.", false);

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("google_oauth_state")?.value;

  if (!code) return backToHub("Google no devolvio el codigo de autorizacion.", false);
  if (!state || !expectedState || state !== expectedState) {
    return backToHub("La verificacion de seguridad fallo. Vuelve a intentarlo.", false);
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchGoogleEmail(tokens.access_token);
    const supabase = await createClient();
    await saveGoogleAccount(supabase, user.id, tokens, email);

    const response = backToHub(email, true);
    response.cookies.delete("google_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    return backToHub(message, false);
  }
}
