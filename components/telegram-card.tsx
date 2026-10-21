"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Loader2, Send, Unlink } from "lucide-react";
import { Card } from "@/components/ui";

interface LinkedAccount {
  username: string | null;
  first_name: string | null;
  briefing_hour: number;
  briefing_enabled: boolean;
}

interface PendingLink {
  code: string;
  command: string;
  expires_in_minutes: number;
}

export function TelegramCard({
  account,
  botUsername,
}: {
  account: LinkedAccount | null;
  botUsername: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<PendingLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/link", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "No se pudo generar el codigo.");
        return;
      }
      setLink(data);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
      setLink(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!botUsername) {
    return (
      <Card title="Telegram">
        <div className="px-4 py-3.5 text-sm text-text-muted">
          <p>Sin configurar en este despliegue.</p>
          <p className="mt-1.5 text-xs text-text-faint">
            Anade <code className="font-mono">TELEGRAM_BOT_TOKEN</code> para hablarle a Jarvis
            desde el movil.
          </p>
        </div>
      </Card>
    );
  }

  if (account) {
    const handle = account.username ? `@${account.username}` : (account.first_name ?? "vinculado");
    return (
      <Card title="Telegram">
        <div className="px-4 py-3.5">
          <p className="truncate text-sm">{handle}</p>
          <p className="mt-0.5 text-xs text-text-faint">
            {account.briefing_enabled
              ? `Briefing diario a las ${String(account.briefing_hour).padStart(2, "0")}:00`
              : "Briefing desactivado"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-1.5 text-sm transition hover:bg-surface-muted"
            >
              <Send className="size-3.5" aria-hidden />
              Abrir chat
            </a>
            <button
              type="button"
              onClick={() => void unlink()}
              disabled={busy}
              aria-label="Desvincular Telegram"
              className="inline-flex items-center rounded-lg px-2 py-1.5 text-sm text-text-faint transition hover:text-danger disabled:opacity-50"
            >
              <Unlink className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Telegram">
      <div className="px-4 py-3.5">
        {link ? (
          <>
            <p className="text-sm text-text-muted">
              Abre el chat y mandale este comando. Caduca en {link.expires_in_minutes} minutos.
            </p>
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2">
              <code className="flex-1 truncate font-mono text-sm">{link.command}</code>
              <button
                type="button"
                onClick={() => void copy(link.command)}
                aria-label="Copiar comando"
                className="text-text-faint transition hover:text-text"
              >
                {copied ? (
                  <Check className="size-3.5 text-ok" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
              </button>
            </div>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-text transition hover:opacity-90"
            >
              <Send className="size-4" aria-hidden />
              Abrir @{botUsername}
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              Habla con Jarvis desde el movil: le escribes y te contesta, y te manda el resumen
              cada manana.
            </p>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-text transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Vincular Telegram
            </button>
          </>
        )}
        {error && <p className="mt-2.5 text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}
