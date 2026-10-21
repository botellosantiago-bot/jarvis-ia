"use client";

import { useEffect, useState } from "react";
import { CircleDot, MoveRight } from "lucide-react";
import { minutesInDay } from "@/lib/format";

export interface BloqueAhora {
  id: string;
  title: string;
  start: number;
  end: number;
  kind: "event" | "task";
}

/** "en 25 min", "en 3 h 10", "en 2 h". Sin segundos: nadie los mira. */
function enCuanto(minutos: number): string {
  if (minutos <= 0) return "ahora";
  if (minutos < 60) return `en ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `en ${horas} h` : `en ${horas} h ${resto}`;
}

/**
 * Que esta pasando y que sigue. Es cliente porque se recalcula cada minuto:
 * un "sigue en 20 min" que lleva dos horas congelado es peor que no ponerlo.
 *
 * Devuelve null hasta que monta, para no pintar en el servidor una hora que
 * dejaria de ser cierta en cuanto llegue al navegador.
 */
export function Ahora({
  bloques,
  timezone,
}: {
  bloques: BloqueAhora[];
  timezone: string;
}) {
  const [minuto, setMinuto] = useState<number | null>(null);

  useEffect(() => {
    const actualizar = () => setMinuto(minutesInDay(new Date(), timezone));
    actualizar();
    const t = setInterval(actualizar, 60_000);
    return () => clearInterval(t);
  }, [timezone]);

  if (minuto === null || bloques.length === 0) return null;

  const enCurso = bloques.find((b) => b.kind === "event" && b.start <= minuto && minuto < b.end);
  const siguiente = bloques
    .filter((b) => b.start > minuto)
    .sort((a, b) => a.start - b.start)[0];

  if (!enCurso && !siguiente) {
    return (
      <p className="border-b border-[var(--glass-edge-low)] px-4 py-2.5 text-sm text-text-muted">
        Ya no queda nada con hora hoy.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--glass-edge-low)] px-4 py-2.5 text-sm">
      {enCurso && (
        <span className="flex min-w-0 items-center gap-1.5 text-accent">
          <CircleDot className="size-3.5 shrink-0 animate-pulse" aria-hidden />
          <span className="truncate font-medium">{enCurso.title}</span>
          <span className="shrink-0 text-xs text-text-faint">
            termina {enCuanto(enCurso.end - minuto)}
          </span>
        </span>
      )}
      {siguiente && (
        <span className="flex min-w-0 items-center gap-1.5 text-text-muted">
          <MoveRight className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{siguiente.title}</span>
          <span className="shrink-0 text-xs text-text-faint">
            {enCuanto(siguiente.start - minuto)}
          </span>
        </span>
      )}
    </div>
  );
}
