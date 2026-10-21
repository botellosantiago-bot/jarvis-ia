import type { SupabaseClient } from "@supabase/supabase-js";
import { plusOneHour, type CapturedItem } from "@/lib/capture";
import { GoogleReauthRequired, getActiveGoogleAccount, markNeedsReconnect } from "@/lib/google/oauth";
import { insertEvent } from "@/lib/google/calendar";

export interface PersistResult {
  id: string;
  kind: CapturedItem["kind"];
  title: string;
  when: string | null;
  /** Se creo, pero algo no salio redondo (p.ej. no llego a Google Calendar). */
  warning?: string;
}

/**
 * Guarda una entrada ya interpretada. Compartido por la barra de captura del
 * hub y por el bot de Telegram, para que ambos se comporten igual.
 */
export async function persistCapture(
  supabase: SupabaseClient,
  userId: string,
  item: CapturedItem,
  timezone: string,
): Promise<PersistResult> {
  if (item.kind === "event") return persistEvent(supabase, userId, item, timezone);
  if (item.kind === "reminder") return persistReminder(supabase, userId, item);
  return persistTask(supabase, userId, item);
}

async function persistTask(
  supabase: SupabaseClient,
  userId: string,
  item: CapturedItem,
): Promise<PersistResult> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: item.title,
      notes: item.notes ?? null,
      area: item.area ?? null,
      priority: item.priority ?? 2,
      due_at: item.due_at ?? null,
    })
    .select("id, title, due_at")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, kind: "task", title: data.title, when: data.due_at };
}

async function persistReminder(
  supabase: SupabaseClient,
  userId: string,
  item: CapturedItem,
): Promise<PersistResult> {
  const remindAt = item.remind_at ?? item.due_at;
  if (!remindAt) throw new Error("El recordatorio necesita un momento concreto.");

  const { data, error } = await supabase
    .from("reminders")
    .insert({ user_id: userId, title: item.title, remind_at: remindAt, channel: "telegram" })
    .select("id, title, remind_at")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, kind: "reminder", title: data.title, when: data.remind_at };
}

async function persistEvent(
  supabase: SupabaseClient,
  userId: string,
  item: CapturedItem,
  timezone: string,
): Promise<PersistResult> {
  if (!item.starts_at) throw new Error("El evento necesita una fecha y hora de inicio.");

  const startsAt = item.starts_at;
  const endsAt = item.ends_at ?? plusOneHour(startsAt);

  let warning: string | undefined;
  let account: Awaited<ReturnType<typeof getActiveGoogleAccount>> = null;

  try {
    account = await getActiveGoogleAccount(supabase, userId);
  } catch (error) {
    // Que Google falle no debe perder lo que el usuario acaba de escribir:
    // guardamos local y avisamos de que no subio.
    // Nada sube estos eventos despues: decirle al usuario que "se subira al
    // reconectar" seria mentira. Le pedimos que la vuelva a crear.
    warning =
      error instanceof GoogleReauthRequired
        ? "Guardado en el hub, pero NO en Google: la conexion caduco. Reconectala y vuelve a crear esta cita."
        : "Guardado en el hub, pero NO en Google Calendar.";
  }

  let googleEventId: string | null = null;
  let htmlLink: string | null = null;
  let calendarId: string | null = null;

  if (account) {
    try {
      const googleEvent = await insertEvent(account.accessToken, account.calendarId, {
        summary: item.title,
        description: item.notes ?? undefined,
        location: item.location ?? undefined,
        start: { dateTime: startsAt, timeZone: timezone },
        end: { dateTime: endsAt, timeZone: timezone },
      });
      googleEventId = googleEvent.id;
      htmlLink = googleEvent.htmlLink ?? null;
      calendarId = account.calendarId;
    } catch (error) {
      if (error instanceof GoogleReauthRequired) {
        await markNeedsReconnect(supabase, account.accountId);
        warning =
          "Guardado en el hub, pero NO en Google: la conexion caduco. Reconectala y vuelve a crear esta cita.";
      } else {
        warning = "Guardado en el hub, pero NO en Google: Calendar rechazo el evento.";
      }
    }
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      source: googleEventId ? "google" : "local",
      google_event_id: googleEventId,
      calendar_id: calendarId,
      title: item.title,
      description: item.notes ?? null,
      location: item.location ?? null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: item.all_day ?? false,
      html_link: htmlLink,
    })
    .select("id, title, starts_at")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, kind: "event", title: data.title, when: data.starts_at, warning };
}
