import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/api";
import { briefingMessage, reminderMessage } from "@/lib/telegram/messages";
import { tecladoRecordatorio } from "@/lib/telegram/botones";
import { dayKey } from "@/lib/format";
import type { Perfil } from "@/lib/agent/perfil";
import { DEFAULT_TZ, nombreAsistente, nombreUsuario } from "@/lib/config";
import type { Reminder } from "@/lib/types";

export const maxDuration = 60;

/** Cuanto atras miramos: evita reenviar avisos muy viejos tras una caida larga. */
const REMINDER_GRACE_HOURS = 6;
interface TelegramAccountRow {
  user_id: string;
  chat_id: number;
  briefing_enabled: boolean;
  briefing_hour: number;
  last_briefing_on: string | null;
}

/**
 * Barrido periodico: manda los recordatorios vencidos y el briefing matutino.
 * Pensado para ejecutarse cada pocos minutos.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const [reminders, briefings] = await Promise.all([
    dispatchReminders(supabase, now),
    dispatchBriefings(supabase, now),
  ]);

  return NextResponse.json({ reminders, briefings, at: now.toISOString() });
}

// Vercel Cron llama con GET; lo aceptamos como alias.
export async function GET(request: NextRequest) {
  return POST(request);
}

type Admin = ReturnType<typeof createAdminClient>;

async function chatsByUser(supabase: Admin): Promise<Map<string, TelegramAccountRow>> {
  const { data } = await supabase
    .from("telegram_accounts")
    .select("user_id, chat_id, briefing_enabled, briefing_hour, last_briefing_on");

  const map = new Map<string, TelegramAccountRow>();
  for (const row of (data ?? []) as TelegramAccountRow[]) map.set(row.user_id, row);
  return map;
}

async function timezonesByUser(supabase: Admin, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, timezone").in("id", userIds);
  return new Map(
    ((data ?? []) as { id: string; timezone: string | null }[]).map((p) => [
      p.id,
      p.timezone ?? DEFAULT_TZ,
    ]),
  );
}

/** Perfiles de golpe, en una sola consulta. */
async function perfilesPorUsuario(supabase: Admin, userIds: string[]): Promise<Map<string, Perfil>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, timezone, display_name")
    .in("id", userIds);

  return new Map(
    ((data ?? []) as { id: string; timezone: string | null; display_name: string | null }[]).map(
      (p) => [
        p.id,
        {
          userId: p.id,
          timezone: p.timezone ?? DEFAULT_TZ,
          nombre: nombreUsuario(p.display_name),
          asistente: nombreAsistente(),
        },
      ],
    ),
  );
}

async function dispatchReminders(supabase: Admin, now: Date): Promise<number> {
  const { data } = await supabase
    .from("reminders")
    .select("*")
    .is("sent_at", null)
    .lte("remind_at", now.toISOString())
    .gte("remind_at", new Date(now.getTime() - REMINDER_GRACE_HOURS * 3_600_000).toISOString())
    .order("remind_at", { ascending: true })
    .limit(100);

  const due = (data ?? []) as Reminder[];
  if (due.length === 0) return 0;

  const chats = await chatsByUser(supabase);
  const zones = await timezonesByUser(supabase, [...new Set(due.map((r) => r.user_id))]);

  let sent = 0;

  for (const reminder of due) {
    const chat = chats.get(reminder.user_id);

    // Sin Telegram vinculado no hay por donde avisar. Lo marcamos igualmente
    // para que no se quede dando vueltas en cada barrido.
    if (!chat) {
      await supabase
        .from("reminders")
        .update({ sent_at: now.toISOString(), delivered_via: "ninguno" })
        .eq("id", reminder.id);
      continue;
    }

    try {
      await sendMessage(
        chat.chat_id,
        reminderMessage(reminder, zones.get(reminder.user_id) ?? DEFAULT_TZ),
        { teclado: tecladoRecordatorio(reminder) },
      );
      await supabase
        .from("reminders")
        .update({ sent_at: new Date().toISOString(), delivered_via: "telegram" })
        .eq("id", reminder.id);
      sent += 1;
    } catch {
      // Lo dejamos sin marcar: el siguiente barrido lo reintenta.
    }
  }

  return sent;
}

async function dispatchBriefings(supabase: Admin, now: Date): Promise<number> {
  const chats = await chatsByUser(supabase);
  const candidates = [...chats.values()].filter((c) => c.briefing_enabled);
  if (candidates.length === 0) return 0;

  const perfiles = await perfilesPorUsuario(supabase, candidates.map((c) => c.user_id));
  let sent = 0;

  for (const chat of candidates) {
    const perfil = perfiles.get(chat.user_id);
    // Sin perfil no hay zona horaria: mejor saltarselo hoy que mandarlo a
    // la hora equivocada.
    if (!perfil) continue;
    const timezone = perfil.timezone;
    const today = dayKey(now, timezone);

    if (chat.last_briefing_on === today) continue;

    const localHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false })
        .format(now),
    );
    if (localHour < chat.briefing_hour) continue;

    try {
      const briefing = await briefingMessage(supabase, perfil, now);
      await sendMessage(chat.chat_id, briefing.texto, { teclado: briefing.teclado });
      await supabase
        .from("telegram_accounts")
        .update({ last_briefing_on: today })
        .eq("user_id", chat.user_id);
      sent += 1;
    } catch {
      // Reintento en el siguiente barrido.
    }
  }

  return sent;
}
