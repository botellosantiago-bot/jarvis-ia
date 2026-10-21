"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * El correo del ultimo acceso, guardado en este navegador. Solo es una
 * comodidad: no da acceso a nada, la contrasena y el enlace siguen haciendo
 * falta.
 */
const CORREO_RECORDADO = "jarvis:ultimo-correo";

function correoRecordado(): string {
  try {
    return window.localStorage.getItem(CORREO_RECORDADO) ?? "";
  } catch {
    // Ventana privada o almacenamiento bloqueado: se escribe a mano y ya.
    return "";
  }
}

function recordarCorreo(correo: string) {
  try {
    window.localStorage.setItem(CORREO_RECORDADO, correo);
  } catch {
    // Si no se puede guardar, el login funciona igual.
  }
}

/**
 * Con el alta cerrada, Supabase contesta distinto segun el correo exista o no.
 * Ensenar ese error convierte /login en un comprobador de correos ajenos:
 * cualquiera podria ir tecleando direcciones para ver quien tiene cuenta aqui.
 * Estos codigos se tragan y se sigue igual a "revisa tu correo", aunque no se
 * haya mandado nada.
 *
 * El resto de errores SI se ensenan. El mas probable en la practica es el
 * limite de envios por hora de Supabase, que no revela nada y que sin mensaje
 * parece que el acceso esta roto cuando solo esta capado.
 */
function revelaSiExiste(error: { code?: string; message: string }): boolean {
  if (error.code && ["otp_disabled", "signup_disabled", "user_not_found"].includes(error.code)) {
    return true;
  }
  return /signups not allowed|user not found/i.test(error.message);
}

/**
 * A donde volver despues de entrar. El proxy pone aqui la ruta que te reboto,
 * pero solo se aceptan rutas de esta misma app: un `next` con host propio
 * ("//otro.com", "/\otro.com") convertiria el login en un redirector abierto.
 */
function destinoSeguro(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || next[0] !== "/" || next[1] === "/" || next[1] === "\\") return "/";
  return next;
}

type Estado = "idle" | "trabajando" | "enlace-enviado" | "error";

export default function LoginPage() {
  // useSearchParams obliga a un limite de Suspense para que Next pueda
  // prerenderizar la cascara de la pagina.
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const router = useRouter();

  const [modo, setModo] = useState<"clave" | "enlace">("clave");
  const [estado, setEstado] = useState<Estado>("idle");
  const [mensaje, setMensaje] = useState("");
  const [enviadoA, setEnviadoA] = useState("");

  /**
   * /auth/callback rebota aqui con ?error=... cuando falla el intercambio del
   * enlace magico, y nadie leia ese parametro: el enlace fallaba y se volvia a
   * ver el formulario en blanco, sin una sola pista de por que. Pasa de verdad,
   * sobre todo en el telefono: el correo se abre dentro de Gmail, que es otro
   * navegador, y ahi no esta el verificador que pidio el enlace.
   *
   * Se lee en el render y no en un efecto: un setState dentro de un efecto
   * encadena renders, y ademas el error ya se conoce al pintar.
   */
  const rebote = useSearchParams().get("error");

  const trabajando = estado === "trabajando";

  /**
   * Los dos campos van SIN controlar a proposito. Un input controlado se
   * reescribe con el valor de React en cada re-render, asi que la contrasena
   * que acababa de poner el gestor del navegador se borraba sola al montar.
   * Sin control, lo que escribe el gestor se queda, y los valores se leen del
   * FormData al enviar.
   */
  const prepararCorreo = useCallback((campo: HTMLInputElement | null) => {
    // Solo rellenamos el hueco: si el gestor ya puso un correo, manda el suyo.
    if (campo && !campo.value) campo.value = correoRecordado();
  }, []);

  function cambiarModo(siguiente: "clave" | "enlace") {
    setModo(siguiente);
    // El error del otro modo ya no viene a cuento.
    if (estado === "error") setEstado("idle");
  }

  async function entrarConClave(correo: string, clave: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });

    if (error) {
      setEstado("error");
      // Supabase responde exactamente lo mismo si la contrasena es incorrecta
      // que si esta cuenta nunca puso una. Sin la pista, la primera vez te
      // quedas atascado sin saber que el camino es el enlace.
      setMensaje(
        error.message === "Invalid login credentials"
          ? "Correo o contrasena incorrectos. Si todavia no has puesto contrasena, entra con el enlace y creala desde el hub."
          : error.message,
      );
      return;
    }

    recordarCorreo(correo);
    // La cookie de sesion se acaba de escribir en el navegador: hay que hacer
    // que el servidor la lea otra vez, o el hub se pinta aun sin sesion.
    router.replace(destinoSeguro());
    router.refresh();
  }

  async function mandarEnlace(correo: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: correo,
      options: {
        // SIN esto, Supabase crea la cuenta sola y esta pagina es un alta
        // abierta: cualquiera que sepa la URL se da de alta con su correo. No
        // se habia notado porque solo habia un usuario.
        //
        // Ojo: esto NO es el candado. La anon key viaja en el bundle, asi que
        // se puede llamar al endpoint de auth directamente desde la consola del
        // navegador. El candado de verdad es "Allow new users to sign up" en
        // OFF, en el panel de Supabase. Esto evita el accidente; aquello, el
        // intento.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error && !revelaSiExiste(error)) {
      setEstado("error");
      setMensaje(error.message);
      return;
    }

    // Solo se recuerda lo que Supabase acepto: asi una errata no se queda fija.
    recordarCorreo(correo);
    setEnviadoA(correo);
    setEstado("enlace-enviado");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const datos = new FormData(event.currentTarget);
    const correo = String(datos.get("email") ?? "").trim();
    const clave = String(datos.get("password") ?? "");

    setEstado("trabajando");
    if (modo === "clave") await entrarConClave(correo, clave);
    else await mandarEnlace(correo);
  }

  const campo =
    "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

  return (
    <main className="flex-1 grid place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Jarvis</h1>
          <p className="mt-2 text-sm text-text-muted">
            Tu agenda, pendientes y recordatorios en un solo sitio.
          </p>
        </div>

        {estado === "enlace-enviado" ? (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm font-medium">Revisa tu correo</p>
            <p className="mt-1.5 text-sm text-text-muted">
              Te enviamos un enlace de acceso a <span className="text-text">{enviadoA}</span>.
              Abrelo en este mismo navegador.
            </p>
            <button
              type="button"
              onClick={() => {
                setEstado("idle");
                cambiarModo("clave");
              }}
              className="mt-3 text-sm text-accent transition hover:opacity-80"
            >
              Volver
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <label htmlFor="email" className="block text-sm font-medium">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              ref={prepararCorreo}
              placeholder="tu@correo.com"
              className={campo}
            />

            {modo === "clave" && (
              <>
                <label htmlFor="clave" className="block pt-1 text-sm font-medium">
                  Contrasena
                </label>
                <input
                  id="clave"
                  name="password"
                  type="password"
                  required
                  // Que el gestor de contrasenas la guarde y la rellene es
                  // justo lo que hace esto mas comodo que el enlace.
                  autoComplete="current-password"
                  className={campo}
                />
              </>
            )}

            <button
              type="submit"
              disabled={trabajando}
              className="w-full rounded-lg bg-accent px-3.5 py-2.5 text-sm font-medium text-accent-text transition hover:opacity-90 disabled:opacity-50"
            >
              {modo === "clave"
                ? trabajando
                  ? "Entrando..."
                  : "Entrar"
                : trabajando
                  ? "Enviando..."
                  : "Enviar enlace de acceso"}
            </button>

            {estado === "error" ? (
              <p className="text-sm text-danger">{mensaje}</p>
            ) : (
              rebote && (
                <p className="text-sm text-danger">
                  {rebote === "enlace_invalido"
                    ? "Ese enlace ya no vale. Pide otro y abrelo en el mismo navegador desde el que lo pediste."
                    : rebote}
                </p>
              )
            )}

            <button
              type="button"
              onClick={() => cambiarModo(modo === "clave" ? "enlace" : "clave")}
              className="pt-1 text-xs text-text-faint underline-offset-2 transition hover:text-text-muted hover:underline"
            >
              {modo === "clave"
                ? "No tengo contrasena: mandame un enlace"
                : "Entrar con contrasena"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
