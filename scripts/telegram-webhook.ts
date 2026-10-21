import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { getWebhookInfo, setWebhook } from "@/lib/telegram/api";

/**
 * Registra el webhook de Telegram, o solo lo consulta.
 *
 *   npx tsx scripts/telegram-webhook.ts                       <- ver como esta
 *   npx tsx scripts/telegram-webhook.ts --set                 <- registrarlo
 *   npx tsx scripts/telegram-webhook.ts --set --url https://…  <- con otro dominio
 *
 * El --url hace falta porque .env.local apunta a localhost, que es lo correcto
 * para desarrollo pero no sirve como webhook: Telegram tiene que poder llamarlo.
 *
 * Hace falta re-registrarlo al anadir tipos de update nuevos: Telegram solo
 * manda los que estan en allowed_updates, asi que sin esto las pulsaciones de
 * los botones no llegan nunca y los botones parecen rotos.
 */
async function main() {
  const registrar = process.argv.includes("--set");

  if (registrar) {
    const bandera = process.argv.indexOf("--url");
    const base = bandera !== -1 ? process.argv[bandera + 1] : process.env.NEXT_PUBLIC_APP_URL;
    const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!base?.startsWith("https://")) {
      throw new Error(
        "Hace falta el dominio https de produccion. Pasalo con --url, porque " +
          `NEXT_PUBLIC_APP_URL apunta a ${process.env.NEXT_PUBLIC_APP_URL ?? "(vacio)"}.`,
      );
    }
    if (!secreto) throw new Error("Falta TELEGRAM_WEBHOOK_SECRET.");

    const url = `${base.replace(/\/$/, "")}/api/telegram/webhook`;
    await setWebhook(url, secreto);
    console.log(`Registrado en ${url}\n`);
  }

  const info = (await getWebhookInfo()) as {
    ok: boolean;
    result?: {
      url?: string;
      allowed_updates?: string[];
      pending_update_count?: number;
      last_error_message?: string;
      last_error_date?: number;
    };
  };

  const r = info.result ?? {};
  console.log("url                  ", r.url || "(sin registrar)");
  // Telegram omite allowed_updates cuando son los de por defecto, y los de por
  // defecto NO incluyen callback_query.
  console.log("allowed_updates      ", r.allowed_updates?.join(", ") || "(por defecto: sin callback_query)");
  console.log("pendientes           ", r.pending_update_count ?? 0);
  if (r.last_error_message) {
    const cuando = r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : "?";
    console.log("ultimo error         ", `${r.last_error_message} (${cuando})`);
  }

  const listo = r.allowed_updates?.includes("callback_query");
  console.log(
    listo
      ? "\nLos botones funcionan: callback_query esta permitido."
      : "\nLos botones NO van a responder. Corre esto mismo con --set.",
  );
}

void main();
