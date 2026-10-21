import { GoogleReauthRequired } from "@/lib/google/errors";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Un 401 significa token muerto. Un 403 solo si la razon es de credenciales:
 * los 403 de cuota o de permisos sobre un calendario ajeno no son reauth.
 */
function isCredentialFailure(status: number, detail: string): boolean {
  if (status === 401) return true;
  return status === 403 && /invalidCredentials|authError/.test(detail);
}

export interface GoogleEventTime {
  date?: string;      // evento de dia completo: YYYY-MM-DD
  dateTime?: string;  // evento con hora: ISO 8601
  timeZone?: string;
}

export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
}

async function calendarFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    if (isCredentialFailure(response.status, detail)) throw new GoogleReauthRequired();
    throw new Error(`Google Calendar respondio ${response.status}: ${detail}`);
  }
  return response.json();
}

/** Trae los eventos de un rango, resolviendo eventos recurrentes en instancias. */
export async function listEvents(
  accessToken: string,
  options: { calendarId?: string; timeMin: Date; timeMax: Date },
): Promise<GoogleEvent[]> {
  const calendarId = encodeURIComponent(options.calendarId ?? "primary");
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: options.timeMin.toISOString(),
      timeMax: options.timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      showDeleted: "false",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const page = (await calendarFetch(
      accessToken,
      `/calendars/${calendarId}/events?${params.toString()}`,
    )) as { items?: GoogleEvent[]; nextPageToken?: string };

    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return events;
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: GoogleEventTime;
    end: GoogleEventTime;
  },
): Promise<GoogleEvent> {
  return (await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(event) },
  )) as GoogleEvent;
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  // 410 = ya estaba borrado; lo tratamos como exito.
  if (!response.ok && response.status !== 410) {
    const detail = await response.text().catch(() => "");
    if (isCredentialFailure(response.status, detail)) throw new GoogleReauthRequired();
    throw new Error(`No se pudo borrar el evento en Google (${response.status}).`);
  }
}

/** Convierte un evento de Google a una fila de nuestra tabla `events`. */
export function toEventRow(event: GoogleEvent, userId: string, calendarId: string) {
  const allDay = Boolean(event.start?.date);
  const startsAt = event.start?.dateTime ?? event.start?.date;
  const endsAt = event.end?.dateTime ?? event.end?.date;

  if (!startsAt || !endsAt) return null;

  return {
    user_id: userId,
    source: "google" as const,
    google_event_id: event.id,
    calendar_id: calendarId,
    title: event.summary?.trim() || "(sin titulo)",
    description: event.description ?? null,
    location: event.location ?? null,
    // Un `date` suelto lo interpreta Postgres como medianoche UTC, que es lo
    // que queremos para un evento de dia completo.
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    all_day: allDay,
    status: event.status ?? "confirmed",
    html_link: event.htmlLink ?? null,
  };
}
