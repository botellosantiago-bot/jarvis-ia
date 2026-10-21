import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAgent } from "@/lib/agent/run";
import {
  answerCallback,
  editKeyboard,
  sendMessage,
  sendTyping,
  sendVoiceUrl,
  type Teclado,
} from "@/lib/telegram/api";
import { leerDatos } from "@/lib/telegram/botones";
import { textoAyuda } from "@/lib/telegram/messages";
import { cargarPerfil } from "@/lib/agent/perfil";
import { urlPublica } from "@/lib/env";
import { rutaFrase } from "@/lib/voz";

// El agente puede encadenar varias vueltas de herramientas antes de contestar.
export const maxDuration = 60;


interface TelegramMessage {
  chat: { id: number; type?: string };
  text?: string;
  photo?: unknown[];
  voice?: unknown;
  document?: unknown;
  from?: { username?: string; first_name?: string };
}

interface TelegramCallback {
  id: string;
  data?: string;
  message?: {
    message_id: number;
    chat: { id: number };
    reply_markup?: { inline_keyboard: Teclado };
  };
}

/**
 * Telegram reintenta si no devolvemos 200, y un reintento significa capturar
 * dos veces lo mismo. Por eso todo error se atrapa y se le cuenta al usuario
 * por chat, pero la respuesta HTTP siempre es 200.
 */
function ok() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = request.headers.get("x-telegram-bot-api-secret-token");

  // Sin esto, cualquiera que adivine la URL puede inyectar mensajes falsos.
  if (!expected || received !== expected) {
    return new NextResponse(null, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as {
    message?: TelegramMessage;
    callback_query?: TelegramCallback;
  } | null;

  // Pulsacion de un boton. Telegram deja el boton girando hasta que se
  // responde, asi que esto se atiende aparte y rapido.
  if (update?.callback_query) {
    const consulta = update.callback_query;
    after(() => manejarPulsacion(consulta));
    return ok();
  }

  const message = update?.message;
  const text = message?.text?.trim();

  // Por ahora Jarvis solo lee texto. Callarse ante una foto o una nota de voz
  // parece un bot roto, asi que se dice.
  if (message && !text && (message.photo || message.voice || message.document)) {
    const chatId = message.chat.id;
    after(() =>
      sendMessage(chatId, "Por ahora solo leo texto. Escribemelo y lo acomodo.").catch((e) =>
        console.error("[telegram] no pude contestar:", e),
      ),
    );
    return ok();
  }

  if (!message || !text) return ok();

  const chatId = message.chat.id;

  // Se contesta a Telegram YA y el trabajo sigue despues de la respuesta.
  // El agente puede tardar 40 segundos en razonar algo largo; hacer esperar a
  // Telegram todo ese rato deja la peticion sin margen para el envio, y el
  // usuario se queda sin respuesta aunque por dentro todo saliera bien.
  after(async () => {
    const supabase = createAdminClient();
    try {
      if (text.startsWith("/start")) {
        await handleStart(supabase, chatId, text, message);
        return;
      }

      const { data: account } = await supabase
        .from("telegram_accounts")
        .select("user_id")
        .eq("chat_id", chatId)
        .maybeSingle();

      if (!account) {
        await sendMessage(
          chatId,
          "No te reconozco todavia.\n\nAbre tu hub de Jarvis, ve a la tarjeta de Telegram y copia el comando de vinculacion que te da. Es de un solo uso.",
        );
        return;
      }

      await handleLinked(supabase, chatId, account.user_id, text);
    } catch (error) {
      // Nada de tragarse el fallo en silencio: sin esto no hay forma de saber
      // por que un mensaje se quedo sin respuesta.
      console.error("[telegram] fallo procesando el mensaje:", error);
      const detail = error instanceof Error ? error.message : "Error desconocido.";
      await sendMessage(chatId, `Algo se rompio por dentro: ${detail}`).catch((e) =>
        console.error("[telegram] tampoco pude avisar del fallo:", e),
      );
    }
  });

  return ok();
}

type Admin = ReturnType<typeof createAdminClient>;

async function handleStart(
  supabase: Admin,
  chatId: number,
  text: string,
  message: TelegramMessage,
) {
  // En un grupo, chat_id es el del GRUPO. Vincularlo ahi haria que cualquiera
  // del grupo escribiera en la cuenta de quien pego el codigo, y que su resumen
  // matutino saliera delante de todos.
  if (message.chat.type && message.chat.type !== "private") {
    await sendMessage(
      chatId,
      "Aqui no. Vinculate escribiendome por privado: en un grupo tus cosas saldrian delante de todos.",
    );
    return;
  }

  const code = text.split(/\s+/)[1]?.trim();

  if (!code) {
    await sendMessage(
      chatId,
      "Hola. Soy Jarvis.\n\nPara vincularte, abre tu hub, copia el comando de la tarjeta de Telegram y mandamelo tal cual.",
    );
    return;
  }

  const { data: link } = await supabase
    .from("telegram_link_codes")
    .select("code, user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (!link || link.used_at || Date.parse(link.expires_at) < Date.now()) {
    await sendMessage(
      chatId,
      "Ese codigo no vale: o ya se uso, o caduco. Genera uno nuevo desde el hub.",
    );
    return;
  }

  // Un usuario, un chat: limpiamos cualquier vinculo previo por ambos lados.
  await supabase.from("telegram_accounts").delete().eq("user_id", link.user_id);
  await supabase.from("telegram_accounts").delete().eq("chat_id", chatId);

  const { error } = await supabase.from("telegram_accounts").insert({
    user_id: link.user_id,
    chat_id: chatId,
    username: message.from?.username ?? null,
    first_name: message.from?.first_name ?? null,
  });

  if (error) {
    await sendMessage(chatId, `No pude vincularte: ${error.message}`);
    return;
  }

  await supabase
    .from("telegram_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  const perfil = await cargarPerfil(supabase, link.user_id);
  await sendMessage(chatId, `Listo, ya estamos conectados.\n\n${textoAyuda(perfil)}`);

  // El saludo con voz: una nota de voz con una frase que ya viene en el repo.
  // Telegram la baja de la URL publica, asi que en localhost no aplica.
  const base = urlPublica();
  if (base.startsWith("https://")) {
    await sendVoiceUrl(chatId, `${base}${rutaFrase("a-sus-ordenes")}`).catch((e) =>
      console.error("[telegram] no pude mandar la nota de voz:", e),
    );
  }
}

async function handleLinked(supabase: Admin, chatId: number, userId: string, text: string) {
  // /ayuda es lo unico que atajamos: el resto lo interpreta el agente, que es
  // justo el punto — nadie deberia tener que aprenderse comandos.
  const perfil = await cargarPerfil(supabase, userId);

  if (text.toLowerCase() === "/ayuda" || text.toLowerCase() === "/help") {
    await sendMessage(chatId, textoAyuda(perfil));
    return;
  }

  await sendTyping(chatId);
  const { reply } = await runAgent(supabase, perfil, text, { channel: "telegram" });
  await sendMessage(chatId, reply);
}

/** Quita del teclado el boton que se acaba de pulsar y borra las filas vacias. */
function sinBoton(teclado: Teclado | undefined, datos: string): Teclado {
  if (!teclado) return [];
  return teclado
    .map((fila) => fila.filter((b) => !("callback_data" in b) || b.callback_data !== datos))
    .filter((fila) => fila.length > 0);
}

async function manejarPulsacion(consulta: TelegramCallback): Promise<void> {
  const chatId = consulta.message?.chat.id;
  const crudo = consulta.data;

  if (!chatId || !crudo) {
    await answerCallback(consulta.id);
    return;
  }

  const orden = leerDatos(crudo);
  if (!orden) {
    await answerCallback(consulta.id, "Ese boton ya no vale.");
    return;
  }

  const supabase = createAdminClient();

  // Este cliente ignora la RLS, asi que el dueno se comprueba a mano en cada
  // consulta. Sin esto, un chat_id ajeno podria cerrar tareas de otro.
  const { data: cuenta } = await supabase
    .from("telegram_accounts")
    .select("user_id")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (!cuenta) {
    await answerCallback(consulta.id, "No te reconozco.");
    return;
  }

  try {
    if (orden.accion === "tarea_ok") {
      const { data, error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", orden.id)
        .eq("user_id", cuenta.user_id)
        .select("title")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        await answerCallback(consulta.id, "Esa tarea ya no existe.");
        return;
      }
      await answerCallback(consulta.id, `Hecho: ${data.title}`);
    } else if (orden.accion === "rec_mas") {
      // Volver a dejarlo sin enviar es lo que hace que el cron lo repita.
      const { data, error } = await supabase
        .from("reminders")
        .update({
          remind_at: new Date(Date.now() + 3_600_000).toISOString(),
          sent_at: null,
          delivered_via: null,
        })
        .eq("id", orden.id)
        .eq("user_id", cuenta.user_id)
        .select("title")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        await answerCallback(consulta.id, "Ese recordatorio ya no existe.");
        return;
      }
      await answerCallback(consulta.id, "Te lo recuerdo en una hora.");
    } else {
      // rec_ok: el recordatorio ya salio; solo se quitan sus botones.
      await answerCallback(consulta.id, "Listo.");
    }

    // El boton pulsado desaparece: dejarlo invita a pulsarlo otra vez y a
    // preguntarse si la primera conto.
    if (consulta.message) {
      await editKeyboard(
        chatId,
        consulta.message.message_id,
        orden.accion === "tarea_ok"
          ? sinBoton(consulta.message.reply_markup?.inline_keyboard, crudo)
          : [], // recordatorio: se contesto, se van sus dos botones
      );
    }
  } catch (error) {
    console.error("[telegram] fallo atendiendo el boton:", error);
    await answerCallback(consulta.id, "No pude hacerlo, intenta desde el hub.");
  }
}
