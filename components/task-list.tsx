"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { dueLabel, isOverdue } from "@/lib/format";
import { Empty, Pill } from "@/components/ui";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<number, string> = {
  1: "bg-danger",
  2: "bg-text-faint",
  3: "bg-border-strong",
};

export function TaskList({ tasks, timezone }: { tasks: Task[]; timezone: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Marcamos localmente para que el tachado sea inmediato, sin esperar al servidor.
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());

  async function toggle(task: Task) {
    const done = task.status === "done" || optimisticDone.has(task.id);
    setOptimisticDone((prev) => {
      const next = new Set(prev);
      if (done) next.delete(task.id);
      else next.add(task.id);
      return next;
    });

    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: done ? "next" : "done" }),
    });
    startTransition(() => router.refresh());
  }

  async function remove(task: Task) {
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  if (tasks.length === 0) {
    return <Empty>Nada pendiente. Disfrutalo.</Empty>;
  }

  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => {
        const done = task.status === "done" || optimisticDone.has(task.id);
        const overdue = task.due_at ? isOverdue(task.due_at) && !done : false;

        return (
          <li key={task.id} className="group flex items-start gap-3 px-4 py-2.5">
            <button
              type="button"
              onClick={() => void toggle(task)}
              aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
              className={cn(
                "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded border transition",
                done
                  ? "border-ok bg-ok text-white"
                  : "border-border-strong hover:border-accent",
              )}
            >
              {done && <Check className="size-3" aria-hidden />}
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm leading-snug",
                  done && "text-text-faint line-through",
                )}
              >
                {task.title}
              </p>
              {(task.area || task.notes) && (
                <p className="mt-0.5 truncate text-xs text-text-faint">
                  {task.area ? `${task.area}` : ""}
                  {task.area && task.notes ? " · " : ""}
                  {task.notes ?? ""}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {task.due_at && !done && (
                <Pill tone={overdue ? "danger" : "neutral"}>
                  {dueLabel(task.due_at, timezone)}
                </Pill>
              )}
              {!done && (
                <span
                  className={cn("size-1.5 rounded-full", PRIORITY_DOT[task.priority])}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => void remove(task)}
                aria-label="Borrar tarea"
                className="text-text-faint opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
