import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey } from "@/lib/format";

export type TipoRutina = "clase" | "trabajo" | "ejercicio" | "personal" | "negocio";

export interface Rutina {
  id: string;
  title: string;
  location: string | null;
  /** 0=domingo .. 6=sabado */
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  startsOn: string | null;
  endsOn: string | null;
  kind: TipoRutina;
}

export const DIAS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

/**
 * Dia de la semana de una fecha local YYYY-MM-DD.
 *
 * Se ancla al MEDIODIA UTC a proposito. Con "T00:00:00Z" una zona al oeste de
 * Greenwich cae en el dia anterior y el lunes se convierte en domingo; a
 * mediodia no hay desplazamiento horario que alcance a cruzar la fecha.
 */
export function diaSemana(fechaLocal: string): number {
  return new Date(`${fechaLocal}T12:00:00Z`).getUTCDay();
}

/** Las rutinas que caen en un dia local concreto, ya ordenadas por hora. */
export function rutinasDelDia(rutinas: Rutina[], fechaLocal: string): Rutina[] {
  const dia = diaSemana(fechaLocal);

  return rutinas
    .filter((r) => {
      if (!r.weekdays.includes(dia)) return false;
      // Las fechas se comparan como texto: YYYY-MM-DD ordena igual que el
      // calendario y evita construir Date solo para esto.
      if (r.startsOn && fechaLocal < r.startsOn) return false;
      if (r.endsOn && fechaLocal > r.endsOn) return false;
      return true;
    })
    .sort((a, b) => a.startMinute - b.startMinute || a.title.localeCompare(b.title));
}

/** Las de hoy, en la zona del usuario. */
export function rutinasDeHoy(rutinas: Rutina[], timezone: string, now = new Date()): Rutina[] {
  return rutinasDelDia(rutinas, dayKey(now, timezone));
}

interface FilaRutina {
  id: string;
  title: string;
  location: string | null;
  weekdays: number[];
  start_minute: number;
  end_minute: number;
  starts_on: string | null;
  ends_on: string | null;
  kind: TipoRutina;
}

export async function getRutinas(
  supabase: SupabaseClient,
  userId: string,
): Promise<Rutina[]> {
  const { data, error } = await supabase
    .from("routines")
    .select("id, title, location, weekdays, start_minute, end_minute, starts_on, ends_on, kind")
    .eq("user_id", userId)
    .eq("active", true)
    .order("start_minute");

  // Un horario vacio por error se ve igual que un dia libre, y eso es
  // exactamente lo que no puede pasar con un horario.
  if (error) throw new Error(`No se pudo leer el horario: ${error.message}`);

  return ((data ?? []) as FilaRutina[]).map((r) => ({
    id: r.id,
    title: r.title,
    location: r.location,
    weekdays: r.weekdays,
    startMinute: r.start_minute,
    endMinute: r.end_minute,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    kind: r.kind,
  }));
}

export function etiquetaHora(minuto: number): string {
  return `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
}

/** "Lun, Mie y Vie" — como se lee un horario, no como se guarda. */
export function etiquetaDias(weekdays: number[]): string {
  const nombres = [...weekdays].sort((a, b) => a - b).map((d) => DIAS_CORTOS[d]);
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 7) return "Todos los dias";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
