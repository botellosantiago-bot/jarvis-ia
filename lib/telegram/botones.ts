import type { Boton, Teclado } from "@/lib/telegram/api";
import type { Reminder, Task } from "@/lib/types";

/**
 * Los datos de un boton viajan a Telegram y vuelven al pulsarlo, con un limite
 * DURO de 64 bytes. Formato "accion:uuid" = 43 bytes, con margen de sobra.
 */
export type Accion = "tarea_ok" | "rec_ok" | "rec_mas";

const ACCIONES: readonly Accion[] = ["tarea_ok", "rec_ok", "rec_mas"];

export function datos(accion: Accion, id: string): string {
  return `${accion}:${id}`;
}

export function leerDatos(raw: string): { accion: Accion; id: string } | null {
  const corte = raw.indexOf(":");
  if (corte === -1) return null;
  const accion = raw.slice(0, corte);
  const id = raw.slice(corte + 1);
  if (!id) return null;
  if (!(ACCIONES as readonly string[]).includes(accion)) return null;
  return { accion: accion as Accion, id };
}

/** Telegram corta las etiquetas largas de forma fea; mejor cortarlas nosotros. */
function corto(texto: string, max = 22): string {
  const limpio = texto.trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1)}…`;
}

/**
 * Boton que abre el hub DENTRO de Telegram, sin salir a otra app.
 * Devuelve null si no hay dominio configurado: un boton a localhost desde el
 * telefono no lleva a ninguna parte.
 */
export function botonHub(): Boton | null {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !url.startsWith("https://")) return null;
  return { text: "Abrir Jarvis", web_app: { url } };
}

/** Teclado del resumen matutino: abrir el hub y cerrar lo que ya se hizo. */
export function tecladoBriefing(tareas: Task[]): Teclado {
  const teclado: Teclado = [];

  // Como maximo seis: mas botones que texto convierte el resumen en un formulario.
  for (const t of tareas.slice(0, 6)) {
    teclado.push([{ text: `✓ ${corto(t.title)}`, callback_data: datos("tarea_ok", t.id) }]);
  }

  const hub = botonHub();
  if (hub) teclado.push([hub]);

  return teclado;
}

export function tecladoRecordatorio(recordatorio: Reminder): Teclado {
  return [
    [
      { text: "Listo", callback_data: datos("rec_ok", recordatorio.id) },
      { text: "En 1 hora", callback_data: datos("rec_mas", recordatorio.id) },
    ],
  ];
}
