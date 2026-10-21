export type TaskStatus =
  | "inbox"
  | "next"
  | "waiting"
  | "scheduled"
  | "done"
  | "cancelled";

/** Estados que cuentan como pendiente. La migracion 0005 retiro "pending". */
export const OPEN_TASK_STATUSES: TaskStatus[] = ["inbox", "next", "waiting", "scheduled"];

/** P1 urgente/dinero/cliente, P2 importante, P3 normal, P4 algun dia. */
export type TaskPriority = 1 | 2 | 3 | 4;
export type EventSource = "google" | "local";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  area: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  source: EventSource;
  google_event_id: string | null;
  calendar_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: string;
  html_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  remind_at: string;
  channel: string;
  sent_at: string | null;
  task_id: string | null;
  event_id: string | null;
  created_at: string;
}

export interface GoogleAccount {
  id: string;
  user_id: string;
  google_email: string;
  token_expires_at: string | null;
  calendar_id: string;
  last_synced_at: string | null;
  needs_reconnect: boolean;
}
