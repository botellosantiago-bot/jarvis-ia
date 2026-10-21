import type { SupabaseClient } from "@supabase/supabase-js";
import { OPEN_TASK_STATUSES, type CalendarEvent, type Reminder, type Task } from "@/lib/types";
import { tecladoBriefing } from "@/lib/telegram/botones";
import { AYUDA, type Perfil } from "@/lib/agent/perfil";
import type { Teclado } from "@/lib/telegram/api";
import { etiquetaHora, getRutinas, rutinasDeHoy } from "@/lib/rutinas";
import {
  dayKey,
  dueLabel,
  eventDayKey,
  formatDayLong,
  formatTime,
  isOverdue,
  startOfLocalDay,
} from "@/lib/format";

// Texto plano a proposito: MarkdownV2 obliga a escapar una docena de simbolos
// y un titulo con un guion basta para que Telegram rechace el mensaje entero.

function eventLine(event: CalendarEvent, timezone: string): string {
  const time = event.all_day ? "todo el dia" : formatTime(event.starts_at, timezone);
  const place = event.location ? `  (${event.location})` : "";
  return `  ${time}  ${event.title}${place}`;
}

function taskLine(task: Task, timezone: string): string {
  const overdue = task.due_at && isOverdue(task.due_at);
  const due = task.due_at ? `  [${overdue ? "vencida, " : ""}${dueLabel(task.due_at, timezone)}]` : "";
  return `  - ${task.title}${due}`;
}

/** Eventos de un dia concreto, ya filtrados por zona horaria del usuario. */
export async function eventsForDay(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  target: Date,
): Promise<CalendarEvent[]> {
  const start = startOfLocalDay(target, timezone);
  // Pedimos con un dia de margen a cada lado: los eventos de dia completo se
  // guardan a medianoche UTC y pueden caer fuera de la ventana local.
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("starts_at", new Date(start.getTime() - 86_400_000).toISOString())
    .lt("starts_at", new Date(start.getTime() + 2 * 86_400_000).toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw new Error(`No se pudo leer la agenda: ${error.message}`);

  const wanted = dayKey(target, timezone);
  return ((data ?? []) as CalendarEvent[]).filter(
    (event) => eventDayKey(event, timezone) === wanted,
  );
}

export async function pendingTasks(
  supabase: SupabaseClient,
  userId: string,
  limit = 15,
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .in("status", OPEN_TASK_STATUSES)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`No se pudieron leer las tareas: ${error.message}`);

  return (data ?? []) as Task[];
}

export interface Briefing {
  texto: string;
  /** Botones para cerrar pendientes sin salir del chat. */
  teclado: Teclado;
}

/** Resumen matutino: agenda del dia mas lo que urge. */
export async function briefingMessage(
  supabase: SupabaseClient,
  perfil: Perfil,
  now: Date,
): Promise<Briefing> {
  const { userId, timezone } = perfil;

  const [events, tasks, rutinas] = await Promise.all([
    eventsForDay(supabase, userId, timezone, now),
    pendingTasks(supabase, userId, 10),
    getRutinas(supabase, userId),
  ]);

  const parts: string[] = [`Buenos dias, ${perfil.nombre}. ${formatDayLong(now, timezone)}.`];

  // El horario fijo va primero: es el esqueleto del dia, y las citas se leen
  // mejor sabiendo que huecos quedan.
  const horarioHoy = rutinasDeHoy(rutinas, timezone, now);
  if (horarioHoy.length > 0) {
    parts.push(
      `\nTu horario de hoy:\n${horarioHoy
        .map(
          (r) =>
            `  ${etiquetaHora(r.startMinute)}-${etiquetaHora(r.endMinute)}  ${r.title}` +
            (r.location ? `  (${r.location})` : ""),
        )
        .join("\n")}`,
    );
  }

  parts.push(
    events.length === 0
      ? horarioHoy.length > 0
        ? "\nNada mas agendado aparte del horario."
        : "\nHoy no tienes citas."
      : `\nCitas de hoy (${events.length}):\n${events.map((e) => eventLine(e, timezone)).join("\n")}`,
  );

  const overdue = tasks.filter((t) => t.due_at && isOverdue(t.due_at, now));
  const dueToday = tasks.filter(
    (t) => t.due_at && !overdue.includes(t) && dayKey(t.due_at, timezone) === dayKey(now, timezone),
  );

  if (overdue.length > 0) {
    parts.push(`\nVencidas (${overdue.length}):\n${overdue.map((t) => taskLine(t, timezone)).join("\n")}`);
  }
  if (dueToday.length > 0) {
    parts.push(`\nPara hoy:\n${dueToday.map((t) => taskLine(t, timezone)).join("\n")}`);
  }
  if (overdue.length === 0 && dueToday.length === 0 && tasks.length > 0) {
    parts.push(`\nNada vence hoy. Tienes ${tasks.length} pendientes sin fecha apremiante.`);
  }

  // Aqui puedes sumar tus propios bloques (clima, finanzas, noticias...):
  // cada uno es un texto mas en `parts`. Que falle uno no debe tumbar el resto.

  // Un resumen que solo dice "hoy no tienes citas" y nada mas es peor que no
  // mandarlo: parece que la herramienta no sirve. El primer briefing de una
  // cuenta nueva seria exactamente eso.
  if (parts.length === 2 && tasks.length === 0 && horarioHoy.length === 0) {
    return {
      texto:
        `${parts[0]}\n\nHoy lo tienes libre, al menos por lo que se. ` +
        "Escribeme lo que traigas y te lo acomodo.",
      teclado: [],
    };
  }

  // Los botones son para lo que urge hoy: poner uno por cada pendiente sin
  // fecha convertiria el resumen en una lista de tareas con formulario.
  return {
    texto: parts.join("\n"),
    teclado: tecladoBriefing([...overdue, ...dueToday]),
  };
}

export function reminderMessage(reminder: Reminder, timezone: string): string {
  return `Recordatorio: ${reminder.title}\n(${formatTime(reminder.remind_at, timezone)})`;
}

export function textoAyuda(perfil: Pick<Perfil, "asistente">): string {
  return [
    `Soy ${perfil.asistente}. Escribeme normal, no hay comandos que aprender.`,
    ...AYUDA,
  ].join("\n");
}
