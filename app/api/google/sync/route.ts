import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  GoogleReauthRequired,
  getActiveGoogleAccount,
  markNeedsReconnect,
  type ActiveGoogleAccount,
} from "@/lib/google/oauth";
import { listEvents, toEventRow } from "@/lib/google/calendar";

/** Ventana de sincronizacion: una semana atras, 60 dias adelante. */
const DAYS_BACK = 7;
const DAYS_AHEAD = 60;

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = await createClient();
  // Declarada fuera del try para poder marcarla si falla a media sincronizacion.
  let account: ActiveGoogleAccount | null = null;

  try {
    account = await getActiveGoogleAccount(supabase, user.id);
    if (!account) {
      return NextResponse.json({ error: "No hay ninguna cuenta de Google conectada." }, { status: 400 });
    }
    // `account` es un let (lo necesita el catch), asi que dentro de un closure
    // TypeScript pierde el estrechamiento. Lo fijamos en una constante.
    const active = account;

    const timeMin = new Date(Date.now() - DAYS_BACK * 86_400_000);
    const timeMax = new Date(Date.now() + DAYS_AHEAD * 86_400_000);

    const googleEvents = await listEvents(active.accessToken, {
      calendarId: active.calendarId,
      timeMin,
      timeMax,
    });

    const rows = googleEvents
      .map((event) => toEventRow(event, user.id, active.calendarId))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("events")
        .upsert(rows, { onConflict: "user_id,google_event_id" });
      if (error) throw new Error(error.message);
    }

    // Limpia los eventos de Google que ya no existen en la ventana sincronizada.
    const liveIds = rows.map((row) => row.google_event_id);
    let stale = supabase
      .from("events")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "google")
      .gte("starts_at", timeMin.toISOString())
      .lte("starts_at", timeMax.toISOString());

    if (liveIds.length > 0) {
      stale = stale.not("google_event_id", "in", `(${liveIds.map((id) => `"${id}"`).join(",")})`);
    }
    await stale;

    await supabase
      .from("google_accounts")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", active.accountId);

    return NextResponse.json({ synced: rows.length, email: active.googleEmail });
  } catch (error) {
    if (error instanceof GoogleReauthRequired) {
      // Si el fallo vino de getActiveGoogleAccount ya quedo marcada alli; este
      // caso cubre el 401 que salta a mitad de la sincronizacion.
      if (account) await markNeedsReconnect(supabase, account.accountId);
      return NextResponse.json({ error: error.message, reauth: true }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Error desconocido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
