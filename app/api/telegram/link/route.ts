import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Sin caracteres que se confundan al leerlos de una pantalla: 0/O, 1/I/L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const TTL_MINUTES = 15;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Genera un codigo de un solo uso para vincular un chat de Telegram. */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  // Cliente admin a proposito: la RLS de telegram_link_codes no permite INSERT
  // a nadie, para que un codigo de vinculacion solo pueda nacer en el servidor.
  // El user.id viene de la sesion ya verificada, no de la peticion.
  const supabase = createAdminClient();

  // Un codigo vivo a la vez: los anteriores dejan de valer.
  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

  const { error } = await supabase
    .from("telegram_link_codes")
    .insert({ code, user_id: user.id, expires_at: expiresAt });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    code,
    command: `/start ${code}`,
    bot: process.env.TELEGRAM_BOT_USERNAME ?? null,
    expires_at: expiresAt,
    expires_in_minutes: TTL_MINUTES,
  });
}

/** Desvincula el chat actual. */
export async function DELETE() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = createAdminClient();
  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);
  const { error } = await supabase.from("telegram_accounts").delete().eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
