import Link from "next/link";
import { Home, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Las secciones de la barra. Si construyes una pagina nueva (por ejemplo
 * /finanzas), agregala aqui y aparece en escritorio y en el celular.
 */
const LINKS: { href: string; label: string; icon: typeof Home }[] = [
  { href: "/", label: "Hub", icon: Home },
];

export function Nav({ current }: { current: string }) {
  const visibles = LINKS;

  // Con una sola entrada no hay a donde navegar: la pestana "Hub" estaria
  // siempre activa, y en movil seria un boton gigante al lado del de salir.
  const conPestanas = visibles.length > 1;

  return (
    <>
      <div className="hidden items-center gap-1 sm:flex">
        {conPestanas && (
          <nav
            aria-label="Navegación principal"
            className="glass flex items-center gap-1 rounded-xl p-0.5"
          >
            {visibles.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current === link.href ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  current === link.href
                    ? "bg-surface-muted font-medium text-text"
                    : "text-text-muted hover:text-text",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="glass pressable inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <LogOut className="size-4" aria-hidden />
            <span>Salir</span>
          </button>
        </form>
      </div>

      <nav
        aria-label="Navegación principal"
        // Las columnas van en estilo en linea y no en una clase arbitraria
        // porque Tailwind no puede construir la clase en tiempo de ejecucion:
        // con el 4 escrito a mano, quitar una pestana dejaba un hueco vacio.
        style={{
          gridTemplateColumns: conPestanas
            ? `repeat(${visibles.length}, minmax(0,1fr)) 2.75rem`
            : "1fr",
        }}
        className="fixed inset-x-3 bottom-3 z-50 grid items-stretch gap-1 rounded-2xl border border-border bg-surface p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-lg sm:hidden"
      >
        {conPestanas &&
          visibles.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current === link.href ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                current === link.href
                  ? "bg-surface-muted font-medium text-text"
                  : "text-text-muted hover:text-text",
              )}
            >
              <link.icon className="size-4" aria-hidden />
              {link.label}
            </Link>
          ))}
        <form action="/auth/signout" method="post" className="flex">
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="pressable grid min-h-11 flex-1 place-items-center rounded-xl text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </nav>
    </>
  );
}
