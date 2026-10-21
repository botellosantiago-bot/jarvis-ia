import { Bell, CalendarDays, Link2, ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { exigirSesion } from "@/lib/perfil";
import { claudeConfigured, googleConfigured } from "@/lib/env";
import {
  dayKey,
  endOfLocalDay,
  eventDayKey,
  formatDayLong,
  formatTime,
  relativeDay,
  startOfLocalDay,
} from "@/lib/format";
import { OPEN_TASK_STATUSES, type CalendarEvent, type GoogleAccount, type Reminder, type Task } from "@/lib/types";
import { AppHero } from "@/components/app-hero";
import { CaptureBar } from "@/components/capture-bar";
import { UpcomingAgenda } from "@/components/agenda";
import { DaySchedule } from "@/components/day-schedule";
import { getRutinas } from "@/lib/rutinas";
import { GoogleCard } from "@/components/google-card";
import { TelegramCard } from "@/components/telegram-card";
import { PasswordCard } from "@/components/password-card";
import { TaskList } from "@/components/task-list";
import { Card, Empty, Pill } from "@/components/ui";

const UPCOMING_DAYS = 7;

export const metadata = { title: "Hub · Jarvis" };

function greeting(now: Date, timezone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function daySummary(events: number, tasks: number, overdue: number): string {
  const agenda = `${events} ${events === 1 ? "compromiso" : "compromisos"} hoy`;
  const pending = `${tasks} ${tasks === 1 ? "pendiente" : "pendientes"}`;
  const late = overdue > 0 ? ` · ${overdue} ${overdue === 1 ? "vencida" : "vencidas"}` : "";
  return `${agenda} · ${pending}${late}`;
}

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; error?: string }>;
}) {
  const { user, nombre: displayName, timezone } = await exigirSesion();
  const supabase = await createClient();

  const params = await searchParams;
  const now = new Date();
  const todayStart = startOfLocalDay(now, timezone);
  const windowEnd = new Date(endOfLocalDay(now, timezone).getTime() + UPCOMING_DAYS * 86_400_000);

  // Pedimos desde un dia antes para no perder eventos de dia completo, que se
  // guardan a medianoche UTC y pueden caer fuera del arranque del dia local.
  const [
    { data: eventRows },
    { data: taskRows },
    { data: reminderRows },
    { data: googleRow },
    { data: telegramRow },
  ] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .gte("starts_at", new Date(todayStart.getTime() - 86_400_000).toISOString())
        .lt("starts_at", windowEnd.toISOString())
        .order("starts_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("*")
        .in("status", OPEN_TASK_STATUSES)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("reminders")
        .select("*")
        .is("sent_at", null)
        .gte("remind_at", now.toISOString())
        .order("remind_at", { ascending: true })
        .limit(6),
      supabase
        .from("google_accounts")
        .select(
          "id, user_id, google_email, token_expires_at, calendar_id, last_synced_at, needs_reconnect",
        )
        .limit(1)
        .maybeSingle(),
      supabase
        .from("telegram_accounts")
        .select("username, first_name, briefing_hour, briefing_enabled")
        .limit(1)
        .maybeSingle(),
    ]);

  const rutinas = await getRutinas(supabase, user.id);

  const events = (eventRows ?? []) as CalendarEvent[];
  const tasks = (taskRows ?? []) as Task[];
  const reminders = (reminderRows ?? []) as Reminder[];
  const googleAccount = (googleRow ?? null) as GoogleAccount | null;
  const telegramAccount = telegramRow ?? null;
  const todayKey = dayKey(now, timezone);
  const todayEvents = events.filter((event) => eventDayKey(event, timezone) === todayKey);
  const upcomingEvents = events.filter((event) => eventDayKey(event, timezone) > todayKey);

  const overdueCount = tasks.filter(
    (task) => task.due_at && Date.parse(task.due_at) < now.getTime(),
  ).length;

  // En la rejilla solo va lo que ocupa un hueco de HOY: lo que vence hoy, lo
  // ya vencido (que sigue urgiendo) y las P1 sin fecha, que deberian caer hoy.
  const scheduleTasks = tasks.filter((task) => {
    if (!task.due_at) return task.priority === 1;
    return dayKey(task.due_at, timezone) === todayKey || Date.parse(task.due_at) < now.getTime();
  });

  return (
    <main className="flex-1">
      <AppHero
        current="/"
        eyebrow={formatDayLong(now, timezone)}
        title={`${greeting(now, timezone)}${
          displayName ? `, ${displayName.split(" ")[0]}` : ""
        }`}
        description={daySummary(todayEvents.length, tasks.length, overdueCount)}
      />

      {/* El contenido sube sobre el degradado: asi la cabecera no es una franja
          pegada encima, sino la luz que hay detras de las tarjetas. */}
      <div className="relative z-10 mx-auto -mt-16 w-full max-w-6xl px-4 pb-16 sm:px-6">
        {params.conectado && (
          <p className="mb-4 rounded-xl border border-border bg-ok-soft px-4 py-2.5 text-sm text-ok">
            Google Calendar conectado como {params.conectado}. Pulsa Sincronizar para traer tu
            agenda.
          </p>
        )}
        {params.error && (
          <p className="mb-4 rounded-xl border border-border bg-danger-soft px-4 py-2.5 text-sm text-danger">
            {params.error}
          </p>
        )}

        <CaptureBar enabled={claudeConfigured()} />

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="order-2 space-y-5 lg:order-none">
            <Card
              material="glass"
              title={
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-accent" aria-hidden />
                  Hoy
                </span>
              }
              action={
                todayEvents.length > 0 ? (
                  <Pill tone="accent">{todayEvents.length}</Pill>
                ) : undefined
              }
            >
              <DaySchedule
                events={todayEvents}
                tasks={scheduleTasks}
                rutinas={rutinas}
                timezone={timezone}
                now={now}
              />
            </Card>

            <Card
              material="glass"
              title={
                <span className="flex items-center gap-2">
                  <ListTodo className="size-4 text-accent" aria-hidden />
                  Pendientes
                </span>
              }
              action={
                <span className="flex items-center gap-2">
                  {overdueCount > 0 && <Pill tone="danger">{overdueCount} vencidas</Pill>}
                  {tasks.length > 0 && <Pill>{tasks.length}</Pill>}
                </span>
              }
            >
              <TaskList tasks={tasks} timezone={timezone} />
            </Card>
          </div>

          <aside className="contents lg:block lg:space-y-5" aria-label="Resumen lateral">
            <div className="order-3 lg:order-none">
              <Card material="glass" title={`Próximos ${UPCOMING_DAYS} días`}>
                <UpcomingAgenda events={upcomingEvents} timezone={timezone} />
              </Card>
            </div>

            <div className="order-4 lg:order-none">
              <Card
                material="glass"
                title={
                  <span className="flex items-center gap-2">
                    <Bell className="size-4 text-accent" aria-hidden />
                    Recordatorios
                  </span>
                }
              >
                {reminders.length === 0 ? (
                  <Empty>Sin recordatorios activos.</Empty>
                ) : (
                  <ul className="divide-y divide-border">
                    {reminders.map((reminder) => (
                      <li key={reminder.id} className="flex items-start gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-pretty text-sm leading-snug">{reminder.title}</p>
                        </div>
                        <span className="tnum shrink-0 text-xs text-text-faint">
                          {relativeDay(reminder.remind_at, timezone)}{" "}
                          {formatTime(reminder.remind_at, timezone)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </aside>
        </div>

        <section className="mt-8" aria-labelledby="connections-title">
          <div className="mb-3 flex items-start gap-2">
            <Link2 className="mt-0.5 size-4 text-accent" aria-hidden />
            <div>
              <h2 id="connections-title" className="title text-sm font-semibold">
                Conexiones y acceso
              </h2>
              <p className="mt-0.5 text-pretty text-xs text-text-faint">
                Servicios que alimentan Jarvis; fuera del flujo principal de tu día.
              </p>
            </div>
          </div>
          <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            <GoogleCard
              account={googleAccount}
              configured={googleConfigured()}
              timezone={timezone}
            />
            <TelegramCard
              account={telegramAccount}
              botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null}
            />
            <PasswordCard email={user.email ?? ""} />
          </div>
        </section>
      </div>
    </main>
  );
}
