import { identidad, type Perfil } from "@/lib/agent/perfil";

interface PromptContext {
  perfil: Perfil;
  now: Date;
  memories: { key: string; value: string }[];
  /** null cuando no se pudo comprobar: no es lo mismo que "no conectado". */
  googleConnected: boolean | null;
}

export function buildSystemPrompt(context: PromptContext): string {
  const { perfil } = context;
  const local = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: perfil.timezone,
  }).format(context.now);

  const blocks = [identidad(perfil), `\n## Ahora mismo\n${local} (zona ${perfil.timezone}).`];

  blocks.push(
    context.googleConnected === null
      ? "No pude comprobar si Google Calendar esta conectado. No afirmes ninguna de las dos cosas: " +
        "si creas un evento, di que no sabes si salio tambien a su calendario."
      : context.googleConnected
        ? "Google Calendar esta conectado: los eventos que crees se escriben en su calendario real."
        : "Google Calendar NO esta conectado: los eventos se guardan solo en el hub. Avisalo si crea uno.",
  );

  if (context.memories.length > 0) {
    blocks.push(
      `\n## Lo que ya sabes de ${perfil.nombre}\n` +
        context.memories.map((m) => `- ${m.key}: ${m.value}`).join("\n"),
    );
  }

  blocks.push(
    "\nNo le hagas repetir contexto que ya tienes. Antes de preguntar, revisa" +
      " esta memoria, la conversacion y tus herramientas de consulta.",
  );

  return blocks.join("\n");
}
