import { MapPin } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { eventDayKey, formatDayShort, formatTime, relativeDay } from "@/lib/format";
import { Empty } from "@/components/ui";

/** Zona con la que se debe leer la fecha de un evento al etiquetar el grupo. */
function groupZone(event: CalendarEvent, timezone: string): string {
  return event.all_day ? "UTC" : timezone;
}

function EventRow({ event, timezone }: { event: CalendarEvent; timezone: string }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span className="tnum mt-px w-11 shrink-0 text-sm text-text-muted">
        {event.all_day ? "todo" : formatTime(event.starts_at, timezone)}
      </span>
      <span
        className="mt-1.5 h-6 w-px shrink-0 bg-accent/50"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{event.title}</p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-faint">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {event.location}
          </p>
        )}
      </div>
      {!event.all_day && (
        <span className="tnum shrink-0 text-xs text-text-faint">
          {formatTime(event.ends_at, timezone)}
        </span>
      )}
    </li>
  );
}

/** Agenda de varios dias, agrupada por fecha. */
export function UpcomingAgenda({
  events,
  timezone,
}: {
  events: CalendarEvent[];
  timezone: string;
}) {
  if (events.length === 0) {
    return <Empty>Nada en los proximos dias.</Empty>;
  }

  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDayKey(event, timezone);
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }

  return (
    <div className="divide-y divide-border">
      {[...groups.entries()].map(([key, dayEvents]) => (
        <div key={key}>
          <p className="bg-surface-muted px-4 py-1.5 text-xs font-medium text-text-muted">
            {(() => {
              const zone = groupZone(dayEvents[0], timezone);
              const relative = relativeDay(dayEvents[0].starts_at, zone);
              const short = formatDayShort(dayEvents[0].starts_at, zone);
              // Fuera de Hoy/Manana/Ayer, relativeDay YA devuelve el dia corto:
              // mostrar los dos daba "vie 4 de sep vie 4 de sep".
              return (
                <>
                  {relative}
                  {relative !== short && <span className="ml-2 text-text-faint">{short}</span>}
                </>
              );
            })()}
          </p>
          <ul className="divide-y divide-border">
            {dayEvents.map((event) => (
              <EventRow key={event.id} event={event} timezone={timezone} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
