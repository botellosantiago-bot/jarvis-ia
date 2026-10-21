"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { CornerDownLeft, Loader2, Sparkles, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { AL_TERMINAR, fraseAlAzar, rutaFrase } from "@/lib/voz";

/** Herramientas que guardan o cambian algo: tras ellas, Jarvis dice "listo" con su voz. */
const ESCRIBEN = /^(crear_|completar_|guardar_|actualizar_|borrar_)/;
const CLAVE_VOZ = "jarvis-voz";

type Result = { ok: true; reply: string } | { ok: false; message: string };

export function CaptureBar({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [voz, setVoz] = useState(true);

  // La preferencia vive en este navegador. Si el almacenamiento no esta (modo
  // privado), la voz queda encendida y ya.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una vez al montar
      if (localStorage.getItem(CLAVE_VOZ) === "no") setVoz(false);
    } catch {}
  }, []);

  function alternarVoz() {
    const nueva = !voz;
    setVoz(nueva);
    try {
      localStorage.setItem(CLAVE_VOZ, nueva ? "si" : "no");
    } catch {}
  }

  function hablar() {
    // Un audio que no carga no puede romper la captura: se ignora.
    new Audio(rutaFrase(fraseAlAzar(AL_TERMINAR))).play().catch(() => {});
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;

    setBusy(true);
    setResult(null);

    try {
      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = await response
        .json()
        .catch(() => ({}) as { error?: string; reply?: string; toolsUsed?: string[] });

      if (!response.ok) {
        setResult({ ok: false, message: data.error ?? `Fallo (${response.status}).` });
        return;
      }

      setResult({ ok: true, reply: data.reply ?? "" });
      setText("");
      const herramientas: string[] = Array.isArray(data.toolsUsed) ? data.toolsUsed : [];
      if (voz && herramientas.some((h) => ESCRIBEN.test(h))) hablar();
      // El agente pudo crear o completar cosas: recargamos las tarjetas.
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Fallo de red. Revisa tu conexion." });
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter hace salto de linea.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={submit} aria-busy={busy} className="glass specular rounded-2xl">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
        <label htmlFor="jarvis-capture" className="sr-only">
          Captura una tarea, cita, recordatorio o consulta para Jarvis
        </label>
        <textarea
          id="jarvis-capture"
          rows={1}
          value={text}
          disabled={!enabled || busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            enabled
              ? "¿Qué quieres capturar o consultar?"
              : "Añade ANTHROPIC_API_KEY para activar el asistente"
          }
          className="min-h-11 min-w-0 flex-1 resize-none bg-transparent py-3 text-sm outline-none placeholder:text-text-faint disabled:opacity-60"
        />
        <button
          type="button"
          onClick={alternarVoz}
          aria-pressed={voz}
          aria-label={voz ? "Silenciar la voz de Jarvis" : "Activar la voz de Jarvis"}
          title={voz ? "Voz encendida" : "Voz apagada"}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors duration-150 hover:text-text"
        >
          {voz ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
        </button>
        <button
          type="submit"
          disabled={!enabled || busy || !text.trim()}
          aria-label="Capturar"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-text transition-opacity duration-150 hover:opacity-90 disabled:opacity-30"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <CornerDownLeft className="size-4" aria-hidden />
          )}
        </button>
      </div>

      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          aria-live="polite"
          className={cn(
            "border-t border-border px-4 py-3 text-sm whitespace-pre-wrap",
            result.ok ? "bg-surface-muted text-text" : "bg-danger-soft text-danger",
          )}
        >
          {result.ok ? result.reply : result.message}
        </div>
      )}
    </form>
  );
}
