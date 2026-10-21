// Genera las frases de Jarvis con TU voz de ElevenLabs.
//
//   node scripts/voz/generar-frases.mjs                 <- solo cuenta créditos (no gasta nada)
//   node scripts/voz/generar-frases.mjs --generar       <- genera las que falten
//   node scripts/voz/generar-frases.mjs --generar --todas   <- rehace todas con tu voz
//
// Lee ELEVENLABS_API_KEY y ELEVENLABS_VOZ_ID de .env.local. Las frases y su texto
// están en public/voz/frases.json: edítalo para cambiar lo que dice Jarvis o
// agregar frases nuevas (cada una con su id, archivo y texto).
// La llave nunca se imprime.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const generar = process.argv.includes("--generar");
const todas = process.argv.includes("--todas");
const carpeta = join("public", "voz");
const { frases } = JSON.parse(readFileSync(join(carpeta, "frases.json"), "utf8"));

const pendientes = frases.filter((f) => todas || !existsSync(join(carpeta, f.archivo)));
const caracteres = pendientes.reduce((n, f) => n + f.texto.length, 0);

console.log(`${pendientes.length} frases por generar, ${caracteres} caracteres.`);
console.log("En ElevenLabs, eleven_multilingual_v2 cobra ~1 crédito por carácter (el plan gratis trae 10,000 al mes).");

if (!generar) {
  console.log("\nNo se generó nada. Para hacerlo: node scripts/voz/generar-frases.mjs --generar");
  process.exit(0);
}

const llave = process.env.ELEVENLABS_API_KEY;
const voz = process.env.ELEVENLABS_VOZ_ID;
if (!llave || !voz) {
  console.error("Faltan ELEVENLABS_API_KEY y/o ELEVENLABS_VOZ_ID en .env.local (ver README, 'La voz').");
  process.exit(1);
}

for (const f of pendientes) {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": llave, "Content-Type": "application/json" },
      body: JSON.stringify({ text: f.texto, model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!r.ok) {
    console.error(`  ${f.id}: ElevenLabs contestó ${r.status}. ${(await r.text()).slice(0, 200)}`);
    process.exit(1);
  }
  writeFileSync(join(carpeta, f.archivo), Buffer.from(await r.arrayBuffer()));
  console.log(`  ${f.id} → ${join(carpeta, f.archivo)}`);
}
console.log("\nListo. Si usas la bienvenida de la Mac, corre otra vez scripts/mac/instalar.sh para copiarlas.");
