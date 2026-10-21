import { fromZonedTime } from "date-fns-tz";

/** Clave YYYY-MM-DD del instante, ya en la zona horaria del usuario. */
export function dayKey(iso: string | Date, timezone: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  // en-CA formatea como YYYY-MM-DD, que es justo lo que necesitamos para agrupar.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatDayLong(iso: string | Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatDayShort(iso: string | Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** "Hoy", "Manana", o el dia corto. */
export function relativeDay(iso: string | Date, timezone: string, now = new Date()): string {
  const target = dayKey(iso, timezone);
  const today = dayKey(now, timezone);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000), timezone);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000), timezone);

  if (target === today) return "Hoy";
  if (target === tomorrow) return "Manana";
  if (target === yesterday) return "Ayer";
  return formatDayShort(iso, timezone);
}

/** Etiqueta compacta de vencimiento para una tarea. */
export function dueLabel(iso: string, timezone: string, now = new Date()): string {
  const day = relativeDay(iso, timezone, now);
  const time = formatTime(iso, timezone);
  // Medianoche = fecha sin hora concreta: no la mostramos.
  return time === "00:00" ? day : `${day} ${time}`;
}

export function isOverdue(iso: string, now = new Date()): boolean {
  return Date.parse(iso) < now.getTime();
}

/** Inicio del dia local del usuario, como instante UTC. */
export function startOfLocalDay(now: Date, timezone: string): Date {
  return fromZonedTime(`${dayKey(now, timezone)}T00:00:00`, timezone);
}

/** Fin del dia local (exclusivo): el arranque del dia siguiente. */
export function endOfLocalDay(now: Date, timezone: string): Date {
  return new Date(startOfLocalDay(now, timezone).getTime() + 86_400_000);
}

/**
 * Clave de dia de un evento. Los eventos de dia completo llegan de Google como
 * fecha suelta (medianoche UTC), asi que agruparlos por zona local los correria
 * de dia; para esos usamos UTC y para el resto la zona del usuario.
 */
export function eventDayKey(
  event: { starts_at: string; all_day: boolean },
  timezone: string,
): string {
  return dayKey(event.starts_at, event.all_day ? "UTC" : timezone);
}

/** Minutos transcurridos desde medianoche, en la zona del usuario. */
export function minutesInDay(iso: string | Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(typeof iso === "string" ? new Date(iso) : iso);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  // Intl puede devolver "24" para medianoche en algunas configuraciones.
  return (hour % 24) * 60 + minute;
}
