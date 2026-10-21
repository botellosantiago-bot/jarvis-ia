import { MapPin } from "lucide-react";
import type { CalendarEvent, Task } from "@/lib/types";
import { rutinasDeHoy, type Rutina, type TipoRutina } from "@/lib/rutinas";
import { RutinaIcono, colorRutina } from "@/components/rutina-icono";
import { isOverdue, minutesInDay } from "@/lib/format";
import { Ahora, type BloqueAhora } from "@/components/ahora";
import { DiaMovil, type ItemDia } from "@/components/dia-movil";
import { NowLine } from "@/components/now-line";
import { Empty } from "@/components/ui";
import { cn } from "@/lib/utils";

const PX_PER_HOUR = 56;
/** Horario visible por defecto si el dia esta vacio o muy concentrado. */
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;
const MIN_BLOCK_MINUTES = 30;

interface Block {
  id: string;
  title: string;
  detail: string | null;
  start: number;
  end: number;
  kind: "event" | "task" | "rutina";
  /** Solo en las rutinas: decide icono y color. */
  routineKind?: TipoRutina;
  overdue: boolean;
  lane: number;
  lanes: number;
}

function buildBlocks(
  events: CalendarEvent[],
  tasks: Task[],
  rutinas: Rutina[],
  timezone: string,
  now: Date,
): Block[] {
  const raw: Omit<Block, "lane" | "lanes">[] = [];

  // Las rutinas van primero: son el fondo fijo del dia, y al ordenar por hora
  // quedan igualmente en su sitio.
  for (const r of rutinasDeHoy(rutinas, timezone, now)) {
    raw.push({
      id: `rutina-${r.id}`,
      title: r.title,
      detail: r.location,
      start: r.startMinute,
      end: r.endMinute,
      kind: "rutina",
      routineKind: r.kind,
      overdue: false,
    });
  }

  for (const event of events) {
    if (event.all_day) continue;
    const start = minutesInDay(event.starts_at, timezone);
    const end = Math.max(start + MIN_BLOCK_MINUTES, minutesInDay(event.ends_at, timezone));
    raw.push({
      id: event.id,
      title: event.title,
      detail: event.location,
      start,
      end,
      kind: "event",
      overdue: false,
    });
  }

  for (const task of tasks) {
    if (!task.due_at) continue;
    const start = minutesInDay(task.due_at, timezone);
    // Una tarea no dura: le damos un bloque minimo para que se pueda leer.
    raw.push({
      id: task.id,
      title: task.title,
      detail: task.area,
      start,
      end: start + MIN_BLOCK_MINUTES,
      kind: "task",
      overdue: isOverdue(task.due_at, now),
    });
  }

  raw.sort((a, b) => a.start - b.start || a.end - b.end);

  // Reparto en carriles: lo que se solapa se pone lado a lado, como en un
  // horario real donde dos clases a la misma hora no se tapan.
  const lanes: number[] = [];
  const placed: Block[] = raw.map((item) => {
    let lane = lanes.findIndex((freeAt) => freeAt <= item.start);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(item.end);
    } else {
      lanes[lane] = item.end;
    }
    return { ...item, lane, lanes: 1 };
  });

  // Cada bloque comparte ancho con los que se solapan con el.
  for (const block of placed) {
    const overlapping = placed.filter((o) => o.start < block.end && o.end > block.start);
    const width = Math.max(...overlapping.map((o) => o.lane)) + 1;
    block.lanes = width;
  }

  return placed;
}

export function DaySchedule({
  events,
  tasks,
  rutinas = [],
  timezone,
  now,
}: {
  events: CalendarEvent[];
  tasks: Task[];
  rutinas?: Rutina[];
  timezone: string;
  now: Date;
}) {
  const allDay = events.filter((e) => e.all_day);
  const blocks = buildBlocks(events, tasks, rutinas, timezone, now);
  const untimed = tasks.filter((t) => !t.due_at);

  if (blocks.length === 0 && allDay.length === 0 && untimed.length === 0) {
    return <Empty>El día está libre. Nada agendado ni pendiente con hora.</Empty>;
  }

  // La rejilla se ajusta a lo que hay, pero nunca menos que el horario base.
  const earliest = blocks.length > 0 ? Math.min(...blocks.map((b) => b.start)) : 24 * 60;
  const latest = blocks.length > 0 ? Math.max(...blocks.map((b) => b.end)) : 0;
  const startHour = Math.min(DEFAULT_START_HOUR, Math.floor(earliest / 60));
  const endHour = Math.max(DEFAULT_END_HOUR, Math.ceil(latest / 60));

  const startMinute = startHour * 60;
  const endMinute = endHour * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // Minuto actual en el servidor. La rejilla de escritorio lo usa para atenuar
  // lo que ya paso; se queda fijo hasta la siguiente carga, pero la linea de
  // "ahora" y la cabecera si son vivas, que es donde se nota.
  const minutoAhora = minutesInDay(now, timezone);

  const itemsMovil: ItemDia[] = [
    ...allDay.map((e) => ({
      id: e.id, title: e.title, detail: null,
      start: null, end: null, kind: "allday" as const, overdue: false, urgente: false,
    })),
    ...blocks.map((b) => ({
      id: b.id, title: b.title, detail: b.detail,
      start: b.start, end: b.end,
      kind: b.kind, routineKind: b.routineKind, overdue: b.overdue, urgente: false,
    })),
    ...untimed.slice(0, 8).map((t) => ({
      id: t.id, title: t.title, detail: t.area,
      start: null, end: null, kind: "untimed" as const,
      overdue: false, urgente: t.priority === 1,
    })),
  ];

  const bloquesAhora: BloqueAhora[] = blocks.map((b) => ({
    id: b.id, title: b.title, start: b.start, end: b.end,
    // Para la cabecera una rutina se comporta como un evento: tiene duracion y
    // puede estar "en curso", a diferencia de una tarea, que es un instante.
    kind: b.kind === "task" ? "task" : "event",
  }));

  return (
    <div>
      <Ahora bloques={bloquesAhora} timezone={timezone} />

      {/* En telefono, carril vertical: conserva el orden y el "donde voy" sin
          pintar quince horas de cuadricula vacia. La rejilla completa entra
          desde tablet. */}
      <div className="md:hidden">
        <DiaMovil items={itemsMovil} timezone={timezone} />
        {untimed.length > 8 && (
          <p className="px-4 pb-3 text-xs text-text-faint">
            +{untimed.length - 8} mas sin hora
          </p>
        )}
      </div>

      <div className="hidden md:block">
        {allDay.length > 0 && (
          <ul className="divide-y divide-border border-b border-border">
          {allDay.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-10 shrink-0 text-xs text-text-faint">todo</span>
              <span className="truncate text-sm">{e.title}</span>
            </li>
          ))}
          </ul>
        )}

        <div className="relative px-4 py-3">
          <div className="relative" style={{ height: (endHour - startHour) * PX_PER_HOUR }}>
          {/* Rejilla de horas */}
          {hours.map((hour, index) => (
            <div
              key={hour}
              className="absolute inset-x-0 flex"
              style={{ top: index * PX_PER_HOUR, height: PX_PER_HOUR }}
            >
              <span className="tnum w-10 shrink-0 -translate-y-1.5 text-xs text-text-faint">
                {String(hour).padStart(2, "0")}:00
              </span>
              <span className="mt-0 h-px flex-1 bg-border" />
            </div>
          ))}

          {/* Bloques */}
          <div className="absolute inset-y-0 left-12 right-0">
            {blocks.map((block) => {
              const top = ((block.start - startMinute) / 60) * PX_PER_HOUR;
              const height = Math.max(
                (MIN_BLOCK_MINUTES / 60) * PX_PER_HOUR - 4,
                ((block.end - block.start) / 60) * PX_PER_HOUR - 4,
              );
              const width = 100 / block.lanes;

              return (
                <div
                  key={block.id}
                  className={cn(
                    "absolute overflow-hidden rounded-md border-l-2 px-2 py-1 transition-opacity",
                    block.kind === "event"
                      ? "border-accent bg-accent-soft"
                      : block.kind === "rutina"
                        ? ""
                        : block.overdue
                          ? "border-danger bg-danger-soft"
                          : "border-warn bg-warn-soft",
                    // Lo terminado se apaga; lo que esta ocurriendo se refuerza.
                    block.end <= minutoAhora && "opacity-50",
                    block.start <= minutoAhora &&
                      minutoAhora < block.end &&
                      "ring-2 ring-accent/40",
                  )}
                  style={{
                    top,
                    height,
                    left: `${block.lane * width}%`,
                    width: `calc(${width}% - 4px)`,
                    // Las rutinas toman el color de su tipo, no uno unico: asi
                    // el gimnasio y una clase no se confunden de un vistazo.
                    ...(block.routineKind
                      ? {
                          borderColor: colorRutina(block.routineKind),
                          backgroundColor: `${colorRutina(block.routineKind)}14`,
                        }
                      : {}),
                  }}
                >
                  <p
                    className={cn(
                      "flex items-center gap-1.5 truncate text-xs font-medium leading-tight",
                      block.kind === "event"
                        ? "text-accent"
                        : block.kind === "rutina"
                          ? ""
                          : block.overdue
                            ? "text-danger"
                            : "text-warn",
                    )}
                    style={
                      block.routineKind ? { color: colorRutina(block.routineKind) } : undefined
                    }
                  >
                    {block.routineKind && <RutinaIcono kind={block.routineKind} size="sm" />}
                    <span className="truncate">{block.title}</span>
                  </p>
                  {height > 30 && block.detail && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-text-muted">
                      {block.kind !== "task" && <MapPin className="size-2.5 shrink-0" aria-hidden />}
                      {block.detail}
                    </p>
                  )}
                </div>
              );
            })}

            <NowLine
              timezone={timezone}
              startMinute={startMinute}
              endMinute={endMinute}
              pxPerHour={PX_PER_HOUR}
            />
          </div>
          </div>
        </div>

        {untimed.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-xs font-medium text-text-muted">Sin hora</p>
            <ul className="space-y-1.5">
              {untimed.slice(0, 8).map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      task.priority === 1 ? "bg-danger" : "bg-text-faint",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{task.title}</span>
                </li>
              ))}
              {untimed.length > 8 && (
                <li className="text-xs text-text-faint">+{untimed.length - 8} más</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
