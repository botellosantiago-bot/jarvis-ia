import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  title,
  action,
  children,
  className,
  /**
   * "glass" deja pasar el fondo. Se reserva para las superficies que mandan en
   * la pantalla: apilar cristal sobre cristal deshace la legibilidad, asi que
   * lo de dentro va siempre solido.
   */
  material = "solid",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  material?: "solid" | "glass";
}) {
  const cristal = material === "glass";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl",
        cristal
          ? "glass specular"
          : "border border-border bg-surface shadow-[var(--shadow-low)]",
        className,
      )}
    >
      {(title || action) && (
        <header
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3",
            cristal ? "border-b border-[var(--glass-edge-low)]" : "border-b border-border",
          )}
        >
          <h2 className="title text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-text-faint">{children}</p>;
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "warn" | "danger" | "ok";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-muted text-text-muted",
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    ok: "bg-ok-soft text-ok",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium tnum",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
