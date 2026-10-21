import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TZ, nombreAsistente, nombreUsuario } from "@/lib/config";
import * as B from "@/lib/agent/bloques";

/** Todo lo que hace falta para atender a alguien, con o sin sesion de navegador. */
export interface Perfil {
  userId: string;
  timezone: string;
  /** Como se le llama en el prompt y en los mensajes. */
  nombre: string;
  /** Como se presenta el asistente. */
  asistente: string;
}

const PAPELES =
  "su chief of staff, asistente ejecutivo, project manager, gestor de agenda\n" +
  "y segundo cerebro";

const REGISTRO = `Habla natural, directo y breve. Espanol de Mexico, sin sonar a robot.
Con un toque de mayordomo: educado, preciso y con ironia sutil, sin exagerar.
Puedes llamarle "senor" o "senora" solo si te lo pide.`;

const EJEMPLOS = `- "manana 3 con Ana" = evento manana a las 15:00.
- "idea: app para reservar canchas" = idea, guardala como nota.
- "le mande la propuesta a Luis" = seguimiento; ofrece recordatorio a 2 dias.`;

const NO_GUARDAR = "tareas, eventos, recordatorios, rutinas, proyectos o notas";

/** El system prompt base: quien es, como habla y que reglas no se rompe. */
export function identidad(perfil: Pick<Perfil, "nombre" | "asistente">): string {
  const { nombre, asistente } = perfil;
  return [
    B.cabecera(asistente, nombre, PAPELES),
    B.estilo(REGISTRO, nombre),
    B.interpretar(EJEMPLOS),
    B.chief(nombre),
    B.PRIORIDADES,
    B.DINERO,
    B.DECISIONES,
    B.DESARROLLO,
    B.MENSAJES,
    B.INFORMES,
    B.PROACTIVIDAD,
    B.memoria(nombre, NO_GUARDAR),
    B.ECONOMIA,
    B.procedencia(nombre),
    B.HONESTIDAD,
  ].join("\n");
}

/** El cuerpo del /ayuda de Telegram. La primera linea la pone textoAyuda(). */
export const AYUDA = [
  "",
  "Capturar:",
  '  "comida con Ana el viernes 2:30"',
  '  "llamar al dentista"',
  '  "recordarme pagar internet manana a las 9"',
  '  "idea: app para reservar canchas"',
  '  "le mande la propuesta a Luis"',
  "",
  "Tu horario fijo:",
  '  "voy al gym lunes, miercoles y viernes de 7 a 8"',
  "",
  "Consultar:",
  '  "que tengo hoy"  /  "brief"',
  '  "que traigo pendiente"',
  '  "cerramos dia"',
  "",
  "Memoria:",
  '  "acuerdate que no agendo nada antes de las 9"',
];

/**
 * Carga el perfil sin sesion de navegador: lo usan el webhook de Telegram, el
 * cron y las rutas de API.
 *
 * Si la CONSULTA falla, esto lanza: un fallo de red que cambie la zona horaria
 * en silencio agendaria las cosas a otra hora.
 */
export async function cargarPerfil(supabase: SupabaseClient, userId: string): Promise<Perfil> {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`);

  return {
    userId,
    timezone: data?.timezone ?? DEFAULT_TZ,
    nombre: nombreUsuario(data?.display_name),
    asistente: nombreAsistente(),
  };
}
