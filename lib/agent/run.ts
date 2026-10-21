import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { required } from "@/lib/env";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { toolsFor, executeTool, type ToolContext } from "@/lib/agent/tools";
import type { Perfil } from "@/lib/agent/perfil";

/** Cambialo con JARVIS_MODELO si quieres otro modelo de Claude. */
const MODEL = process.env.JARVIS_MODELO || "claude-sonnet-5-5";
/** Tope de vueltas de herramientas antes de rendirse. Evita bucles infinitos. */
const MAX_TURNS = 8;
/** Mensajes de historial que se le pasan al modelo. */
const HISTORY_LIMIT = 20;

export interface AgentResult {
  reply: string;
  toolsUsed: string[];
}

export async function runAgent(
  supabase: SupabaseClient,
  perfil: Perfil,
  userMessage: string,
  options: { channel?: string } = {},
): Promise<AgentResult> {
  const channel = options.channel ?? "telegram";
  const { userId, timezone } = perfil;
  const client = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });

  const [
    { data: memoryRows, error: memoryError },
    { data: historyRows, error: historyError },
    { data: googleRow, error: googleError },
  ] = await Promise.all([
      supabase
        .from("memories")
        // Sin orden, pasando de 60 memorias el subconjunto era arbitrario y el
        // agente reescribia cosas que ya sabia.
        .select("key, value")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(60),
      supabase
        .from("messages")
        .select("role, content, seq")
        .eq("user_id", userId)
        // web y telegram comparten hilo a proposito: puedes empezar en el hub y
        // seguir en el movil. El canal de pruebas queda fuera para no ensuciarlo.
        .neq("channel", "test")
        // Por seq, no por created_at: las dos filas de un turno se insertan
        // juntas y comparten la hora de la transaccion, asi que con created_at
        // el orden dentro del par no estaba definido y podia salir invertido.
        .order("seq", { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase.from("google_accounts").select("id").eq("user_id", userId).maybeSingle(),
    ]);

  // Que falle la lectura no es "no habiamos hablado nunca": el agente arrancaria
  // de cero sin que nadie se entere.
  if (historyError) {
    throw new Error(`No se pudo leer el historial de la conversacion: ${historyError.message}`);
  }
  // Ni "no se nada de ti": volveria a preguntar lo que ya sabe y a reescribirlo.
  if (memoryError) {
    throw new Error(`No se pudo leer la memoria: ${memoryError.message}`);
  }

  const memories = (memoryRows ?? []) as { key: string; value: string }[];

  const system = buildSystemPrompt({
    perfil,
    now: new Date(),
    memories,
    // null, no false: si la lectura fallo no sabemos si esta conectado, y
    // afirmar que no lo esta hace que el agente avise de que el evento se queda
    // en el hub justo cuando persistEvent si lo esta escribiendo en Google.
    googleConnected: googleError ? null : Boolean(googleRow),
  });

  // El historial viene del mas nuevo al mas viejo: hay que darle la vuelta.
  const history = ((historyRows ?? []) as { role: string; content: string }[])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  // La API exige que el primer mensaje sea del usuario. Si la ventana corta
  // justo detras de una respuesta, ese 'assistant' suelto la haria fallar.
  while (history.length > 0 && history[0].role === "assistant") history.shift();

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const toolContext: ToolContext = {
    supabase,
    userId,
    timezone,
  };
  const toolsUsed: string[] = [];
  let reply = "";

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    // En la ultima vuelta se le prohibe pedir mas herramientas. Antes se
    // ejecutaban igual y el bucle terminaba sin ensenarle el resultado, asi que
    // llegaba "me hice bolas" DESPUES de que la tarea ya estaba guardada, se
    // repetia el mensaje, y se duplicaba.
    const ultima = turn === MAX_TURNS - 1;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      tools: toolsFor(),
      ...(ultima ? { tool_choice: { type: "none" as const } } : {}),
      messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (response.stop_reason !== "tool_use") {
      reply = text;
      break;
    }

    const calls = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    messages.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      toolsUsed.push(call.name);
      const output = await executeTool(
        call.name,
        (call.input ?? {}) as Record<string, unknown>,
        toolContext,
      );
      results.push({ type: "tool_result", tool_use_id: call.id, content: output });
    }

    messages.push({ role: "user", content: results });
  }

  if (!reply) {
    // Invitar a repetir despues de haber tocado la base de datos es como se
    // duplica una tarea. Si hubo herramientas, se dice cuales.
    reply =
      toolsUsed.length > 0
        ? `Ejecute ${[...new Set(toolsUsed)].join(", ")} pero me trabe al redactarte la respuesta. ` +
          `Revisa que haya quedado bien antes de pedirmelo otra vez, no vaya a duplicarse.`
        : "Me hice bolas procesando eso. Intenta decirmelo de otra forma.";
  }

  // Guardamos solo el texto: los bloques de herramientas no hacen falta para
  // que la siguiente conversacion tenga sentido, y abultan mucho.
  await supabase.from("messages").insert([
    { user_id: userId, channel, role: "user", content: userMessage },
    { user_id: userId, channel, role: "assistant", content: reply },
  ]);

  return { reply, toolsUsed };
}
