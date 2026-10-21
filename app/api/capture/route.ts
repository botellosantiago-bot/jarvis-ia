import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent/run";
import { cargarPerfil } from "@/lib/agent/perfil";
import { claudeConfigured } from "@/lib/env";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  if (!claudeConfigured()) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY: el asistente esta desactivado." },
      { status: 501 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Escribe algo." }, { status: 400 });

  const supabase = await createClient();

  try {
    const perfil = await cargarPerfil(supabase, user.id);
    const { reply, toolsUsed } = await runAgent(supabase, perfil, text, { channel: "web" });
    return NextResponse.json({ reply, toolsUsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
