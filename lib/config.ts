/**
 * Lo poco que se configura de Jarvis sin tocar codigo. Todo sale de variables de
 * entorno (ver .env.example), y todo tiene un valor por defecto que funciona.
 */

/** Zona horaria con la que nace un perfil nuevo. La de cada quien vive en profiles.timezone. */
export const DEFAULT_TZ = process.env.JARVIS_ZONA_HORARIA || "America/Mexico_City";

/** Como se presenta el asistente en el chat y en el briefing. */
export function nombreAsistente(): string {
  return process.env.JARVIS_NOMBRE?.trim() || "Jarvis";
}

/**
 * Como se le llama a quien usa Jarvis. Primero el display_name del perfil (si
 * no es un correo: Supabase lo rellena con el correo al crear la cuenta), luego
 * JARVIS_TU_NOMBRE, y si no hay nada, un neutro que no suena raro en el prompt.
 */
export function nombreUsuario(displayName?: string | null): string {
  const perfil = displayName?.trim();
  if (perfil && !perfil.includes("@")) return perfil.split(/\s+/)[0];
  return process.env.JARVIS_TU_NOMBRE?.trim() || "quien te escribe";
}
