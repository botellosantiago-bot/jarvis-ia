import { createClient } from "@supabase/supabase-js";
import { required } from "@/lib/env";

/**
 * Cliente con la service role key: ignora RLS.
 *
 * Solo para codigo de servidor que actua SIN sesion de usuario: el webhook de
 * Telegram y el cron. Nunca lo importes desde un componente de cliente, y
 * filtra siempre por user_id a mano, porque aqui no hay red de seguridad.
 */
export function createAdminClient() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
