"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { minutesInDay } from "@/lib/format";
import type { TipoRutina } from "@/lib/rutinas";
import { RutinaIcono } from "@/components/rutina-icono";
import { cn } from "@/lib/utils";

export interface ItemDia {
  id: string;
  title: string;
  detail: string | null;
  /** Minuto del dia. null en los que no tienen hora. */
  start: number | null;
  end: number | null;
  kind: "event" | "task" | "allday" | "untimed" | "rutina";
  routineKind?: TipoRutina;
  overdue: boolean;
  urgente: boolean;
}

function etiquetaHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function colorPunto(item: ItemDia): string {
  if (item.kind === "rutina") return "bg-[#4c6ef5]";
  if (item.kind === "event" || item.kind === "allday") return "bg-accent";
  if (item.overdue) return "bg-danger";
  if (item.kind === "untimed") return item.urgente ? "bg-danger" : "bg-text-faint";
  return "bg-warn";
}

/**
 * El dia en telefono, como carril vertical.
 *
 * Antes era una lista plana: se perdia el sentido de la hora, que es justo lo
 * que uno busca al abrir el hub a media manana. Un carril conserva el orden y
 * el "donde voy" sin pintar quince horas de cuadricula vacia, que es lo que no
 * cabe en una pantalla de telefono.
 *
 * Es cliente porque el marcador de ahora y el atenuado de lo ya pasado tienen
 * que ser ciertos cuando se miran, no de cuando se cargo la pagina.
 */
export function DiaMovil({ items, timezone }: { items: ItemDia[]; timezone: string }) {
  const [minuto, setMinuto] = useState<number | null>(null);

  useEffect(() => {
    const actualizar = () => setMinuto(minutesInDay(new Date(), timezone));
    actualizar();
    const t = setInterval(actualizar, 60_000);
    return () => clearInterval(t);
  }, [timezone]);

  // Los que tienen hora van en orden; sin hora, al final.
  const conHora = items.filter((i) => i.start !== null);
  const resto = items.filter((i) => i.start === null);

  // El marcador se cuela entre el ultimo que ya paso y el primero que viene.
  // Si aun no hay hora (primer render) no se pinta: mejor nada que en el sitio
  // equivocado.
  const posicionAhora =
    minuto === null ? -1 : conHora.filter((i) => (i.start ?? 0) <= minuto).length;

  const filas: (ItemDia | "ahora")[] = [];
  conHora.forEach((item, i) => {
    if (i === posicionAhora) filas.push("ahora");
    filas.push(item);
  });
  if (posicionAhora === conHora.length && conHora.length > 0) filas.push("ahora");
  filas.push(...resto);

  return (
    <ol className="relative px-4 py-3">
      {filas.map((fila, i) =>
        fila === "ahora" ? (
          <li key="ahora" className="relative flex items-center gap-3 py-1.5">
            <span className="tnum w-11 shrink-0 text-right text-[11px] font-medium text-danger">
              {minuto !== null ? etiquetaHora(minuto) : ""}
            </span>
            <span className="relative flex size-2.5 shrink-0 items-center justify-center">
              <span className="size-2.5 rounded-full bg-danger" />
            </span>
            <span className="h-px flex-1 bg-danger/60" />
          </li>
        ) : (
          <li key={fila.id} className="relative flex gap-3 py-2">
            <span
              className={cn(
                "tnum w-11 shrink-0 pt-0.5 text-right text-[11px]",
                minuto !== null && fila.end !== null && fila.end <= minuto
                  ? "text-text-faint/60"
                  : "text-text-faint",
              )}
            >
              {fila.kind === "allday"
                ? "todo"
                : fila.start === null
                  ? "—"
                  : etiquetaHora(fila.start)}
            </span>

            {/* Columna del carril: punto y linea de union hacia el siguiente. */}
            <span className="relative flex w-6 shrink-0 justify-center">
              {fila.routineKind ? (
                <RutinaIcono kind={fila.routineKind} size="sm" className="z-10" />
              ) : (
                <span className={cn("z-10 mt-1.5 size-2.5 shrink-0 rounded-full", colorPunto(fila))} />
              )}
              {i < filas.length - 1 && (
                <span className="absolute top-6 bottom-[-8px] w-px bg-border" aria-hidden />
              )}
            </span>

            <div
              className={cn(
                "min-w-0 flex-1 pb-0.5",
                // Lo que ya termino se apaga, no se esconde: sigue siendo parte
                // del dia, solo que ya no hay nada que hacer con ello.
                minuto !== null && fila.end !== null && fila.end <= minuto && "opacity-55",
              )}
            >
              <p className="text-pretty text-sm leading-snug font-medium">{fila.title}</p>
              {fila.detail && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-faint">
                  {fila.kind !== "task" && fila.kind !== "untimed" && <MapPin className="size-3 shrink-0" aria-hidden />}
                  {fila.detail}
                </p>
              )}
              {fila.kind === "untimed" && (
                <p className="mt-0.5 text-xs text-text-faint">Sin hora</p>
              )}
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
