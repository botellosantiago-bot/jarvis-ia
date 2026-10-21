import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ } from "@/lib/config";

export interface Sesion {
  user: User;
  /** El nombre del perfil, para saludar. Puede no estar. */
  nombre: string | null;
  timezone: string;
}

/**
 * Sesion y perfil, una sola vez por peticion.
 *
 * Va envuelto en cache() de React porque lo piden varios sitios del mismo
 * render; sin esto serian varios viajes a Supabase para pintar una pantalla.
 */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    nombre: profile?.display_name ?? null,
    timezone: profile?.timezone ?? DEFAULT_TZ,
  };
});

/** Para las paginas: sin sesion, al login. */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  return sesion;
}
