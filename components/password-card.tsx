"use client";

import { useState, type FormEvent } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";

/**
 * Supabase acepta 6 por defecto. Pedimos 8 porque esto abre tu agenda, tu
 * memoria y un agente que puede escribir en tu nombre.
 */
const MINIMO = 8;

export function PasswordCard({ email }: { email: string }) {
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<"idle" | "guardando" | "listo" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    // Escribirla mal dos veces seguidas y no poder entrar manana es el fallo
    // caro aqui, asi que se comprueba antes de mandarla.
    if (clave !== repetida) {
      setEstado("error");
      setMensaje("Las dos no coinciden.");
      return;
    }

    setEstado("guardando");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: clave });

    if (error) {
      setEstado("error");
      setMensaje(error.message);
      return;
    }

    setClave("");
    setRepetida("");
    setEstado("listo");
  }

  const campo =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

  return (
    <Card title="Contrasena">
      <div className="px-4 py-3.5">
        {!abierto ? (
          <>
            <p className="text-sm text-text-muted">
              Entra escribiendo una contrasena en vez de pedir un enlace cada vez.
            </p>
            <button
              type="button"
              onClick={() => {
                setAbierto(true);
                setEstado("idle");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-1.5 text-sm transition hover:bg-surface-muted"
            >
              <KeyRound className="size-3.5" aria-hidden />
              Definir o cambiar
            </button>
            {estado === "listo" && (
              <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-ok">
                <Check className="size-3.5" aria-hidden />
                Guardada. Ya puedes entrar con ella.
              </p>
            )}
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-2.5">
            {/* El correo, oculto, para que el gestor del navegador sepa a que
                cuenta pertenece la contrasena que le estas pidiendo guardar. */}
            <input type="text" name="username" autoComplete="username" value={email} hidden readOnly />
            <div>
              <label htmlFor="clave-nueva" className="block text-xs text-text-muted">
                Nueva contrasena
              </label>
              <input
                id="clave-nueva"
                type="password"
                required
                minLength={MINIMO}
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className={`mt-1 ${campo}`}
              />
            </div>
            <div>
              <label htmlFor="clave-repetida" className="block text-xs text-text-muted">
                Repitela
              </label>
              <input
                id="clave-repetida"
                type="password"
                required
                minLength={MINIMO}
                autoComplete="new-password"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                className={`mt-1 ${campo}`}
              />
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="submit"
                disabled={estado === "guardando"}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-text transition hover:opacity-90 disabled:opacity-50"
              >
                {estado === "guardando" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAbierto(false);
                  setClave("");
                  setRepetida("");
                  setEstado("idle");
                }}
                className="rounded-lg px-2 py-1.5 text-sm text-text-faint transition hover:text-text"
              >
                Cancelar
              </button>
            </div>

            <p className="text-xs text-text-faint">Minimo {MINIMO} caracteres.</p>
            {estado === "error" && <p className="text-xs text-danger">{mensaje}</p>}
          </form>
        )}
      </div>
    </Card>
  );
}
