"use client";

import { useEffect, useState } from "react";
import { minutesInDay } from "@/lib/format";

/**
 * Linea de "ahora" sobre la rejilla. Es cliente porque se mueve sola cada
 * minuto; el resto del horario se renderiza en el servidor.
 */
export function NowLine({
  timezone,
  startMinute,
  endMinute,
  pxPerHour,
}: {
  timezone: string;
  startMinute: number;
  endMinute: number;
  pxPerHour: number;
}) {
  const [minute, setMinute] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setMinute(minutesInDay(new Date(), timezone));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [timezone]);

  if (minute === null || minute < startMinute || minute > endMinute) return null;

  const top = ((minute - startMinute) / 60) * pxPerHour;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top }}
      aria-hidden
    >
      <span className="size-2 shrink-0 rounded-full bg-danger" />
      <span className="h-px flex-1 bg-danger" />
    </div>
  );
}
