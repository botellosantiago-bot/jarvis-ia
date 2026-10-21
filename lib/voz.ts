/**
 * La voz de Jarvis, sin llave: 18 frases ya generadas con ElevenLabs que viven
 * en public/voz/. Sirven igual en la web (se reproducen al guardar algo), en
 * Telegram (nota de voz al vincularte) y en la Mac (scripts/mac/).
 *
 * El texto de cada una esta en public/voz/frases.json. Para hacer las tuyas con
 * tu propia voz: scripts/voz/generar-frases.mjs (ver README, "La voz").
 */

export const FRASES = {
  "a-sus-ordenes": "A sus órdenes.",
  "si-senor": "¿Sí, señor?",
  "digame-senor": "Dígame, señor.",
  "ahora-que-senor": "¿Ahora qué, señor?",
  "como-guste": "Como guste, señor.",
  "silencio-tactico": "Entendido. Silencio táctico.",
  "listo-ya-quedo": "Listo, señor. Ya quedó.",
  "usted-lo-hizo": "Listo, señor. Si alguien pregunta, usted lo hizo.",
  "tarea-completa": "Señor, la tarea está completa. Nadie salió herido. Esta vez.",
  "hice-todo-yo": "Señor, terminé. Otra vez hice todo yo, como siempre.",
  "le-dejo-el-merito":
    "Terminé, señor. Le dejo el mérito; yo me quedo con la satisfacción, que es lo único que puedo tener.",
  "encargo-en-pantalla": "Señor, terminé su encargo. Se lo dejé en pantalla.",
  "necesito-autorizacion": "Señor, necesito su autorización para continuar.",
  "apruebe-algo": "Señor, necesito que apruebe algo. Es por su bien, casi siempre.",
  "respondere-con-brevedad":
    "Entendido, señor. Responderé con brevedad, como quien tiene prisa por llegar a la siguiente tarea.",
  "contesto-mas-rapido": "Listo, señor. Ahora contesto más rápido. No se acostumbre.",
  "vigilo-sus-creditos": "Señor, ahora vigilo sus créditos como si fueran míos.",
  "aviso-de-su-mac": "Señor, ahora puedo avisarle de lo que pasa en su Mac.",
} as const;

export type FraseId = keyof typeof FRASES;

/** Las que suenan cuando Jarvis termina de guardar algo. */
export const AL_TERMINAR: readonly FraseId[] = [
  "listo-ya-quedo",
  "usted-lo-hizo",
  "tarea-completa",
  "hice-todo-yo",
  "como-guste",
];

/** Ruta publica del audio, para un <audio> o un fetch desde el navegador. */
export function rutaFrase(id: FraseId): string {
  return `/voz/${id}.mp3`;
}

export function fraseAlAzar(lista: readonly FraseId[]): FraseId {
  return lista[Math.floor(Math.random() * lista.length)];
}
