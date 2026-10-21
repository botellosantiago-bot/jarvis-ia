import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google/oauth";
import { googleConfigured } from "@/lib/env";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));

  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar no esta configurado en este despliegue." },
      { status: 501 },
    );
  }

  // El state protege contra CSRF: lo guardamos en cookie y lo comparamos al volver.
  const state = randomBytes(16).toString("base64url");
  const response = NextResponse.redirect(buildAuthUrl(state));

  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
