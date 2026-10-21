/** Lee una variable de entorno obligatoria y falla con un mensaje util. */
export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa .env.local (o las variables del proyecto en Vercel).`,
    );
  }
  return value;
}

/** True si Google Calendar esta configurado en este despliegue. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** True si la captura en lenguaje natural esta configurada. */
export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * La URL estable de produccion, para links que salen de la app (Telegram, las
 * notas de voz). No vale VERCEL_URL: cambia en cada despliegue y
 * puede estar protegida. Primero NEXT_PUBLIC_APP_URL, luego el dominio de
 * produccion que da Vercel.
 */
export function urlPublica(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return appUrl();
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return appUrl();
}

/** URL publica de la app, usada para construir los redirect de OAuth. */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
