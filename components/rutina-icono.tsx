import { Dumbbell, GraduationCap, Hammer, Store, Sunrise, type LucideIcon } from "lucide-react";
import type { TipoRutina } from "@/lib/rutinas";
import { cn } from "@/lib/utils";

/**
 * Cara de cada tipo de bloque. El icono es lo que hace que el dia se lea de un
 * vistazo sin tener que leer los titulos uno por uno.
 */
const ICONOS: Record<TipoRutina, LucideIcon> = {
  clase: GraduationCap,
  trabajo: Hammer,
  ejercicio: Dumbbell,
  personal: Sunrise,
  negocio: Store,
};

const COLORES: Record<TipoRutina, string> = {
  clase: "#7048e8",
  trabajo: "#1c7ed6",
  ejercicio: "#0f9d76",
  personal: "#e8890c",
  negocio: "#c2255c",
};

export function colorRutina(kind: TipoRutina): string {
  return COLORES[kind];
}

export function RutinaIcono({
  kind,
  size = "md",
  className,
}: {
  kind: TipoRutina;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icono = ICONOS[kind];
  const color = COLORES[kind];

  return (
    <span
      aria-hidden
      style={{ backgroundColor: `${color}1f`, color }}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-lg",
        size === "sm" ? "size-6" : "size-7",
        className,
      )}
    >
      <Icono className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
    </span>
  );
}
