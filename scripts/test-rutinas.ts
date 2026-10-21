/** Expansion del horario. Sin red ni base de datos. */
import { diaSemana, etiquetaDias, rutinasDelDia, type Rutina } from "@/lib/rutinas";

let fallos = 0;
function ok(que: string, real: unknown, esperado: unknown) {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos += 1;
  console.log(`${bien ? "  ok" : "FALLA"}  ${que}`);
  if (!bien) console.log(`        real: ${JSON.stringify(real)}\n        esp.: ${JSON.stringify(esperado)}`);
}

const base = { location: null, startsOn: null, endsOn: null, kind: "clase" as const };
const calculo: Rutina = { ...base, id: "1", title: "Calculo", weekdays: [1, 3], startMinute: 420, endMinute: 540 };
const gym: Rutina = { ...base, id: "2", title: "Gym", weekdays: [1, 2, 3, 4, 5], startMinute: 360, endMinute: 420, kind: "ejercicio" };
const semestre: Rutina = { ...base, id: "3", title: "Seminario", weekdays: [4], startMinute: 600, endMinute: 720, startsOn: "2026-09-01", endsOn: "2026-12-15" };

// 2026-09-10 es jueves; 09-14 lunes; 09-16 miercoles.
ok("jueves", diaSemana("2026-09-10"), 4);
ok("lunes", diaSemana("2026-09-14"), 1);
ok("domingo", diaSemana("2026-09-13"), 0);

const todas = [calculo, gym, semestre];

ok("lunes trae gym y calculo, en orden de hora",
   rutinasDelDia(todas, "2026-09-14").map((r) => `${r.startMinute} ${r.title}`),
   ["360 Gym", "420 Calculo"]);

ok("martes solo gym", rutinasDelDia(todas, "2026-09-15").map((r) => r.title), ["Gym"]);
ok("domingo nada", rutinasDelDia(todas, "2026-09-13").map((r) => r.title), []);
ok("jueves trae gym y seminario", rutinasDelDia(todas, "2026-09-10").map((r) => r.title), ["Gym", "Seminario"]);

// Vigencia: el seminario no existe fuera del semestre.
ok("antes de empezar el semestre, no aparece",
   rutinasDelDia(todas, "2026-08-27").map((r) => r.title), ["Gym"]);
ok("el ultimo dia del semestre si aparece",
   rutinasDelDia([semestre], "2026-12-10").map((r) => r.title), ["Seminario"]);
ok("despues de acabar, no aparece",
   rutinasDelDia([semestre], "2026-12-17").map((r) => r.title), []);

ok("etiqueta de dias", etiquetaDias([1, 3, 5]), "Lun, Mie y Vie");
ok("etiqueta de un solo dia", etiquetaDias([4]), "Jue");
ok("etiqueta de la semana entera", etiquetaDias([0, 1, 2, 3, 4, 5, 6]), "Todos los dias");

console.log(fallos === 0 ? "\nTodo bien." : `\n${fallos} fallos.`);
process.exit(fallos === 0 ? 0 : 1);
