import { z } from "zod";

/** Una entrada ya estructurada: lo que el agente manda a guardar (ver lib/persist.ts). */
export const capturedItemSchema = z.object({
  kind: z.enum(["task", "event", "reminder"]),
  title: z.string().min(1),
  notes: z.string().nullish(),
  location: z.string().nullish(),
  area: z.string().nullish(),
  priority: z.number().int().min(1).max(3).nullish(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  all_day: z.boolean().nullish(),
  due_at: z.string().nullish(),
  remind_at: z.string().nullish(),
});

export type CapturedItem = z.infer<typeof capturedItemSchema>;

/** Suma una hora a un instante ISO. Usado cuando no hay hora de fin. */
export function plusOneHour(iso: string): string {
  return new Date(Date.parse(iso) + 60 * 60 * 1000).toISOString();
}
