import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminClient } from "@/lib/supabase/admin";
import { runAgent } from "@/lib/agent/run";
import { cargarPerfil } from "@/lib/agent/perfil";

/**
 * Habla con el agente desde la terminal, sin desplegar nada:
 *
 *   npx tsx scripts/test-agent.ts "que tengo hoy" "cena con Ana el viernes 8:30"
 *   npx tsx scripts/test-agent.ts --email tu@correo.com "que traigo pendiente"
 *
 * OJO: crea datos de verdad en tu base (y eventos en Google Calendar si lo
 * conectaste). La conversacion se guarda en el canal "test", que no se mezcla
 * con la de la web y Telegram.
 */
async function main() {
  const args = process.argv.slice(2);
  const bandera = args.indexOf("--email");
  const email = bandera !== -1 ? args.splice(bandera, 2)[1] : undefined;
  const prompts = args;
  if (prompts.length === 0) throw new Error("Pasa al menos un mensaje de prueba.");

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 50 });
  if (error) throw new Error(`No pude listar usuarios: ${error.message}`);

  const usuarios = data.users.filter((u) => !email || u.email === email);
  if (usuarios.length === 0) throw new Error("No hay ningun usuario. Crea el tuyo en Supabase (ver README).");
  if (usuarios.length > 1) throw new Error("Hay varios usuarios: di cual con --email tu@correo.com");

  const perfil = await cargarPerfil(supabase, usuarios[0].id);

  for (const prompt of prompts) {
    console.log("\n" + "=".repeat(70));
    console.log(`${perfil.nombre.toUpperCase()}:`, prompt);
    const started = Date.now();
    const { reply, toolsUsed } = await runAgent(supabase, perfil, prompt, { channel: "test" });
    console.log(`\nHERRAMIENTAS: ${toolsUsed.length ? toolsUsed.join(", ") : "(ninguna)"}`);
    console.log(`TIEMPO: ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log(`\n${perfil.asistente}:`, reply);
  }
}

main().catch((error) => {
  console.error("FALLO:", error);
  process.exit(1);
});
