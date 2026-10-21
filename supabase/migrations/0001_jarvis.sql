-- =============================================================================
-- Jarvis :: esquema completo
--
-- Un solo archivo para un proyecto NUEVO de Supabase. Pegalo entero en
-- Supabase > SQL Editor > New query > Run (o usa `supabase db push`).
-- No siembra datos: tu cuenta se crea desde Authentication (ver README).
--
-- Seguridad: cada tabla tiene RLS y una politica "solo el dueno" por user_id.
-- El webhook de Telegram y el cron usan la service role key (se salta la RLS),
-- por eso esas rutas filtran por user_id a mano.
-- =============================================================================

-- gen_random_uuid() viene de serie desde Postgres 13: no hace falta ninguna extension.

-- ---------- utilidades ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
-- Una fila por usuario, creada sola al darlo de alta en Authentication.
-- display_name es como te saluda Jarvis; timezone, la hora de todo.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text not null default 'America/Mexico_City',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Solo la usa el trigger: nadie con sesion tiene por que llamarla.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Google Calendar ----------
-- access_token y refresh_token se guardan CIFRADOS (AES-256-GCM) desde la app,
-- con TOKEN_ENCRYPTION_KEY. Una cuenta de Google por usuario.
create table public.google_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  google_email     text not null,
  access_token     text not null,
  refresh_token    text,
  token_expires_at timestamptz,
  scope            text,
  sync_token       text,
  calendar_id      text not null default 'primary',
  last_synced_at   timestamptz,
  -- En modo "Prueba" Google caduca el refresh token a los 7 dias: el hub pide
  -- reconectar en vez de fallar en silencio.
  needs_reconnect  boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint google_accounts_user_uniq unique (user_id)
);

-- ---------- eventos ----------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  source          text not null default 'local' check (source in ('google', 'local')),
  google_event_id text,
  calendar_id     text,
  title           text not null,
  description     text,
  location        text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  all_day         boolean not null default false,
  status          text not null default 'confirmed',
  html_link       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint events_time_order check (ends_at >= starts_at),
  -- Unique normal (no parcial) para que sirva en ON CONFLICT. Los eventos
  -- locales tienen google_event_id null y Postgres no los cuenta como repetidos.
  constraint events_google_uniq unique (user_id, google_event_id)
);

create index events_user_starts on public.events (user_id, starts_at);

-- ---------- proyectos ----------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  client      text,
  description text,
  price       numeric(12,2),
  currency    text not null default 'MXN',
  status      text not null default 'activo'
              check (status in ('activo', 'pausado', 'entregado', 'cancelado')),
  next_step   text,
  due_date    date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_user_status on public.projects (user_id, status);

-- ---------- tareas ----------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  notes        text,
  status       text not null default 'inbox'
               check (status in ('inbox', 'next', 'waiting', 'scheduled', 'done', 'cancelled')),
  -- 1 urgente, 2 importante, 3 normal, 4 algun dia.
  priority     smallint not null default 2 check (priority between 1 and 4),
  due_at       timestamptz,
  area         text,
  kind         text not null default 'task' check (kind in ('task', 'follow_up')),
  waiting_on   text,
  project_id   uuid references public.projects(id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tasks_user_status_due on public.tasks (user_id, status, due_at);

-- ---------- recordatorios ----------
create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  remind_at     timestamptz not null,
  channel       text not null default 'web',
  sent_at       timestamptz,
  delivered_via text,
  task_id       uuid references public.tasks(id) on delete cascade,
  event_id      uuid references public.events(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index reminders_pending on public.reminders (user_id, remind_at) where sent_at is null;
create index reminders_due_unsent on public.reminders (remind_at) where sent_at is null;

-- ---------- horario fijo (rutinas) ----------
-- "Gym lunes y miercoles de 7 a 8" es UNA fila que se repite, no treinta eventos.
create table public.routines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  location     text,
  -- 0 = domingo .. 6 = sabado.
  weekdays     smallint[] not null,
  -- Minutos desde medianoche en la hora LOCAL: "las 7" siguen siendo las 7
  -- aunque cambie el horario de verano.
  start_minute smallint not null,
  end_minute   smallint not null,
  starts_on    date,
  ends_on      date,
  kind         text not null default 'clase'
               check (kind in ('clase', 'trabajo', 'ejercicio', 'personal', 'negocio')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint routines_weekdays_validos
    check (array_length(weekdays, 1) between 1 and 7
           and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint routines_minutos_validos
    check (start_minute between 0 and 1439
           and end_minute between 1 and 1440
           and end_minute > start_minute),
  constraint routines_vigencia_valida
    check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create index routines_user on public.routines (user_id) where active;

-- ---------- notas, memoria e historial del agente ----------
create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text,
  category   text not null default 'note',
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);

create index notes_user_created on public.notes (user_id, created_at desc);

create table public.memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      text not null,
  category   text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- La conversacion (web y Telegram comparten hilo). seq es una clave monotona:
-- los dos mensajes de un turno se insertan juntos y comparten created_at, asi
-- que ordenar por la hora podia cruzar los roles.
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  channel    text not null default 'telegram',
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  seq        bigint generated by default as identity,
  created_at timestamptz not null default now()
);

create index messages_user_seq on public.messages (user_id, seq desc);

-- ---------- Telegram ----------
create table public.telegram_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  chat_id          bigint not null unique,
  username         text,
  first_name       text,
  briefing_enabled boolean not null default true,
  -- Hora LOCAL del resumen de la manana (ver profiles.timezone).
  briefing_hour    smallint not null default 7 check (briefing_hour between 0 and 23),
  last_briefing_on date,
  linked_at        timestamptz not null default now(),
  constraint telegram_one_per_user unique (user_id)
);

-- Codigo de un solo uso (15 min) para vincular tu chat con /start CODIGO.
create table public.telegram_link_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index telegram_link_codes_user on public.telegram_link_codes (user_id);

-- ---------- updated_at automatico ----------
create trigger touch_profiles        before update on public.profiles        for each row execute function public.touch_updated_at();
create trigger touch_google_accounts before update on public.google_accounts for each row execute function public.touch_updated_at();
create trigger touch_events          before update on public.events          for each row execute function public.touch_updated_at();
create trigger touch_projects        before update on public.projects        for each row execute function public.touch_updated_at();
create trigger touch_tasks           before update on public.tasks           for each row execute function public.touch_updated_at();
create trigger touch_routines        before update on public.routines        for each row execute function public.touch_updated_at();
create trigger touch_memories        before update on public.memories        for each row execute function public.touch_updated_at();

-- ---------- RLS: cada quien ve solo lo suyo ----------
alter table public.profiles            enable row level security;
alter table public.google_accounts     enable row level security;
alter table public.events              enable row level security;
alter table public.projects            enable row level security;
alter table public.tasks               enable row level security;
alter table public.reminders           enable row level security;
alter table public.routines            enable row level security;
alter table public.notes               enable row level security;
alter table public.memories            enable row level security;
alter table public.messages            enable row level security;
alter table public.telegram_accounts   enable row level security;
alter table public.telegram_link_codes enable row level security;

create policy "profiles: propietario" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "google_accounts: propietario" on public.google_accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "events: propietario" on public.events for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "projects: propietario" on public.projects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "tasks: propietario" on public.tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "reminders: propietario" on public.reminders for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "routines: propietario" on public.routines for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "notes: propietario" on public.notes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "memories: propietario" on public.memories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "messages: propietario" on public.messages for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "telegram_accounts: propietario" on public.telegram_accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Los codigos los crea el servidor con la service role; desde el navegador solo
-- se leen y se borran los propios.
create policy "telegram_link_codes: leer los propios" on public.telegram_link_codes
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "telegram_link_codes: borrar los propios" on public.telegram_link_codes
  for delete to authenticated using ((select auth.uid()) = user_id);
