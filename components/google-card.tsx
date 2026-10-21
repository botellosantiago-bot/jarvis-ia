"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CalendarSync, Loader2, Link2, Unlink } from "lucide-react";
import type { GoogleAccount } from "@/lib/types";
import { Card } from "@/components/ui";

export function GoogleCard({
  account,
  configured,
  timezone,
}: {
  account: GoogleAccount | null;
  configured: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setBusy("sync");
    setMessage(null);
    try {
      const response = await fetch("/api/google/sync", { method: "POST" });
      // Una respuesta no-JSON (502 de un proxy, timeout) rompe .json():
      // sin esto el boton se quedaba mudo.
      const data = await response.json().catch(() => ({}) as { error?: string; reauth?: boolean });

      setMessage(
        response.ok
          ? `${data.error ? "" : ""}${(data as { synced?: number }).synced ?? 0} eventos sincronizados.`
          : (data.error ?? `Fallo la sincronizacion (${response.status}).`),
      );
      // Si el token murio, el servidor ya marco la cuenta: refrescamos para
      // que la tarjeta pase a modo "Reconectar".
      if (response.ok || data.reauth) router.refresh();
    } catch {
      setMessage("No se pudo contactar con el servidor.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!configured) {
    return (
      <Card title="Google Calendar">
        <div className="px-4 py-3.5 text-sm text-text-muted">
          <p>Sin configurar en este despliegue.</p>
          <p className="mt-1.5 text-xs text-text-faint">
            Anade <code className="font-mono">GOOGLE_CLIENT_ID</code> y{" "}
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code> para sincronizar tu agenda.
          </p>
        </div>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card title="Google Calendar">
        <div className="px-4 py-3.5">
          <p className="text-sm text-text-muted">
            Conecta tu cuenta y tus citas apareceran aqui. Lo que crees en el hub se escribe en tu
            calendario real.
          </p>
          <a
            href="/api/google/connect"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-text transition hover:opacity-90"
          >
            <Link2 className="size-4" aria-hidden />
            Conectar Google Calendar
          </a>
        </div>
      </Card>
    );
  }

  const lastSynced = account.last_synced_at
    ? new Intl.DateTimeFormat("es-MX", {
        timeZone: timezone,
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(account.last_synced_at))
    : "nunca";

  if (account.needs_reconnect) {
    return (
      <Card title="Google Calendar">
        <div className="px-4 py-3.5">
          <p className="flex items-start gap-2 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            La conexion caduco. Tus citas siguen aqui, pero no se estan
            sincronizando.
          </p>
          <p className="mt-1.5 truncate text-xs text-text-faint">{account.google_email}</p>
          <div className="mt-3 flex items-center gap-2">
            <a
              href="/api/google/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-text transition hover:opacity-90"
            >
              <Link2 className="size-4" aria-hidden />
              Reconectar
            </a>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy !== null}
              aria-label="Desconectar Google Calendar"
              className="inline-flex items-center rounded-lg px-2 py-2 text-sm text-text-faint transition hover:text-danger disabled:opacity-50"
            >
              <Unlink className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Google Calendar">
      <div className="px-4 py-3.5">
        <p className="truncate text-sm">{account.google_email}</p>
        <p className="mt-0.5 text-xs text-text-faint">Ultima sincronizacion: {lastSynced}</p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void sync()}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-1.5 text-sm transition hover:bg-surface-muted disabled:opacity-50"
          >
            {busy === "sync" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <CalendarSync className="size-3.5" aria-hidden />
            )}
            Sincronizar
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy !== null}
            aria-label="Desconectar Google Calendar"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-faint transition hover:text-danger disabled:opacity-50"
          >
            <Unlink className="size-3.5" aria-hidden />
          </button>
        </div>

        {message && <p className="mt-2.5 text-xs text-text-muted">{message}</p>}
      </div>
    </Card>
  );
}
