import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que no pasan por la sesion de Supabase. El webhook y el cron traen su
// propia autenticacion por secreto compartido: si el proxy los redirigiera a
// /login, Telegram y Vercel nunca llegarian al handler.
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/api/telegram/webhook", // cabecera X-Telegram-Bot-Api-Secret-Token
  "/api/cron", // cabecera Authorization: Bearer CRON_SECRET
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // No metas logica entre createServerClient y getUser: rompe el refresco de sesion.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Cuando el emailRedirectTo que pidio el login no esta en la lista de Redirect
  // URLs, Supabase manda el `code` al Site URL, que es la raiz. Sin esto el
  // codigo se pierde, el proxy rebota a /login y el acceso falla sin decir nada.
  const code = request.nextUrl.searchParams.get("code");
  if (!user && code && !pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Una llamada de API sin sesion no puede acabar en la pagina de login: el
  // fetch sigue la redireccion, recibe HTML con estado 200 y quien llamo cree
  // que su tarea se guardo. Los handlers ya devuelven 401; aqui solo hay que
  // no pisarlos. Se excluye /api/google porque ahi el navegador SI navega de
  // verdad y ver el login es lo correcto.
  if (!user && !isPublic && pathname.startsWith("/api/") && !pathname.startsWith("/api/google/")) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
