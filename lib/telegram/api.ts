import { required } from "@/lib/env";

const API_BASE = "https://api.telegram.org";

function endpoint(method: string): string {
  return `${API_BASE}/bot${required("TELEGRAM_BOT_TOKEN")}/${method}`;
}

async function call(method: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(endpoint(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!data.ok) {
    const detail = `Telegram ${method} fallo (${response.status}): ${data.description ?? "sin descripcion"}`;
    console.error("[telegram]", detail);
    throw new Error(detail);
  }
  return data.result;
}

/** Escapa los caracteres que rompen el parseo de MarkdownV2. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

/** Telegram rechaza mensajes de mas de 4096 caracteres. */
const MAX_LENGTH = 4000;

/** Trocea respetando saltos de linea, para no partir a mitad de frase. */
function split(text: string): string[] {
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let current = "";

  for (const line of text.split("\n")) {
    if (current.length + line.length + 1 > MAX_LENGTH) {
      if (current) chunks.push(current);
      // Una linea sola mas larga que el limite: se corta a lo bruto.
      current = line.length > MAX_LENGTH ? "" : line;
      if (line.length > MAX_LENGTH) {
        for (let i = 0; i < line.length; i += MAX_LENGTH) {
          chunks.push(line.slice(i, i + MAX_LENGTH));
        }
      }
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Un boton de teclado en linea. Solo los tres tipos que usamos. */
export type Boton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

export type Teclado = Boton[][];

export async function sendMessage(
  chatId: number | string,
  text: string,
  options: { markdown?: boolean; teclado?: Teclado } = {},
): Promise<void> {
  const trozos = split(text);

  for (const [i, chunk] of trozos.entries()) {
    // El teclado va solo en el ultimo trozo: repetirlo en cada uno dejaria
    // varios juegos de botones para la misma cosa.
    const esUltimo = i === trozos.length - 1;
    const cuerpo: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
      ...(options.markdown ? { parse_mode: "MarkdownV2" } : {}),
      link_preview_options: { is_disabled: true },
    };
    if (esUltimo && options.teclado?.length) {
      cuerpo.reply_markup = { inline_keyboard: options.teclado };
    }

    try {
      await call("sendMessage", cuerpo);
    } catch (error) {
      // Un teclado que Telegram rechaza no puede costarle el mensaje entero:
      // el texto es lo importante, los botones son un extra.
      if (!cuerpo.reply_markup) throw error;
      console.error("[telegram] reintentando sin botones:", error);
      delete cuerpo.reply_markup;
      await call("sendMessage", cuerpo);
    }
  }
}

/**
 * Telegram deja el boton girando hasta que se responde la pulsacion. Es
 * obligatorio aunque no haya nada que decir.
 */
export async function answerCallback(
  callbackId: string,
  texto?: string,
): Promise<void> {
  await call("answerCallbackQuery", {
    callback_query_id: callbackId,
    ...(texto ? { text: texto } : {}),
  }).catch((e) => console.error("[telegram] no pude responder la pulsacion:", e));
}

/** Cambia los botones de un mensaje ya enviado. Se usa para quitar el pulsado. */
export async function editKeyboard(
  chatId: number | string,
  messageId: number,
  teclado: Teclado,
): Promise<void> {
  await call("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: teclado },
  }).catch((e) => console.error("[telegram] no pude actualizar los botones:", e));
}

/** Muestra "escribiendo..." mientras el agente piensa. Dura ~5 s. */
export async function sendTyping(chatId: number | string): Promise<void> {
  await call("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

/** Registra el webhook. Se llama una vez, desde el script de setup. */
export async function setWebhook(url: string, secretToken: string): Promise<void> {
  await call("setWebhook", {
    url,
    secret_token: secretToken,
    // callback_query hace falta para que lleguen las pulsaciones de los
    // botones. Sin el, Telegram ni siquiera las manda.
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function getWebhookInfo(): Promise<unknown> {
  const response = await fetch(endpoint("getWebhookInfo"));
  return response.json();
}

/**
 * Nota de voz desde una URL publica (https). Telegram la descarga solo, asi que
 * el audio no tiene que viajar por esta funcion. Acepta MP3.
 */
export async function sendVoiceUrl(chatId: number | string, url: string, caption?: string): Promise<void> {
  await call("sendVoice", {
    chat_id: chatId,
    voice: url,
    ...(caption ? { caption: caption.slice(0, 1000) } : {}),
  });
}
