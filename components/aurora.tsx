"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Fondo de gradiente animado por shader.
 *
 * Va contenido en una cabecera, no a pantalla completa: un fondo grande en
 * movimiento permanente distrae de lo unico que importa de la pantalla, que son
 * los datos. El ciclo dura ~90 segundos, lejos de las frecuencias que marean.
 *
 * Degrada en tres escalones, y ninguno deja un hueco: sin WebGL o con
 * "reducir movimiento" queda el degradado CSS de la capa de abajo, que es el
 * mismo dibujo pero quieto.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2  u_res;
uniform float u_t;
uniform vec3  u_c1;
uniform vec3  u_c2;
uniform vec3  u_c3;

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p  = uv * 2.0 - 1.0;
  p.x *= u_res.x / max(u_res.y, 1.0);

  float t = u_t * 0.06;

  // Tres campos suaves a ritmos distintos. Al no ser multiplos entre si, el
  // conjunto no se repite de forma reconocible.
  float a = sin(p.x * 1.6 + t * 1.10) * cos(p.y * 1.3 - t * 0.70);
  float b = sin(length(p * 1.1) * 2.2 - t * 0.90);
  float c = cos(p.x * 0.9 - p.y * 1.5 + t * 0.60);

  vec3 col = mix(u_c1, u_c2, smoothstep(-1.0, 1.0, a));
  col = mix(col, u_c3, smoothstep(-1.0, 1.0, b) * 0.55);
  col += (smoothstep(-1.0, 1.0, c) - 0.5) * 0.04;

  // gl_FragCoord.y crece hacia ARRIBA: uv.y = 1 es el borde superior. Se pinta
  // opaco arriba y se apaga hacia abajo, para fundirse con la pagina en lugar
  // de cortarse con una linea dura contra lo que venga debajo.
  gl_FragColor = vec4(col, smoothstep(-0.05, 0.92, uv.y));
}
`;

type Triada = [number, number, number];

/**
 * Fuera del componente a proposito. Como literales por defecto en los props,
 * React los recreaba en cada render, el efecto se reejecutaba entero y el
 * shader nunca llegaba a pintar un fotograma completo.
 */
const CLARO: [Triada, Triada, Triada] = [
  [0.42, 0.39, 0.86],
  [0.55, 0.72, 0.95],
  [0.86, 0.62, 0.9],
];
const OSCURO: [Triada, Triada, Triada] = [
  [0.16, 0.14, 0.42],
  [0.1, 0.28, 0.46],
  [0.33, 0.15, 0.44],
];
/**
 * Las tres en banda calida a proposito. Bastaba con meter un azul o un violeta
 * en la capa de encima para que toda la cabecera se leyera lila, que es justo
 * lo contrario de rosa.
 */
const ROSA: [Triada, Triada, Triada] = [
  [0.86, 0.33, 0.55],
  [1.0, 0.6, 0.71],
  [1.0, 0.82, 0.78],
];

function compilar(gl: WebGLRenderingContext, tipo: number, fuente: string) {
  const sh = gl.createShader(tipo);
  if (!sh) return null;
  gl.shaderSource(sh, fuente);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function Aurora({
  claro = CLARO,
  oscuro = OSCURO,
  rosa = ROSA,
  className,
}: {
  claro?: [Triada, Triada, Triada];
  oscuro?: [Triada, Triada, Triada];
  rosa?: [Triada, Triada, Triada];
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      // El gradiente se pinta una vez por frame y se compone: no hace falta
      // conservar el buffer y asi el navegador puede descartarlo antes.
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    // Sin WebGL no se toca nada: queda el degradado CSS de debajo.
    if (!gl) return;

    const vs = compilar(gl, gl.VERTEX_SHADER, VERT);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uT = gl.getUniformLocation(prog, "u_t");
    const uC = [1, 2, 3].map((n) => gl.getUniformLocation(prog, `u_c${n}`));

    const quietoQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // El tema ya no lo decide el sistema sino data-theme, igual que la paleta
    // CSS. Seguir mirando prefers-color-scheme pintaria un degradado oscuro
    // sobre una pagina clara en cuanto alguien tuviera el movil en oscuro.
    //
    // "dark" sigue en ingles porque asi esta en globals.css desde el principio;
    // el valor nuevo es "rosa". Sin tema, claro.
    const tema = () => document.documentElement.dataset.theme;

    function pintarColores() {
      const t = tema();
      const p = t === "dark" ? oscuro : t === "rosa" ? rosa : claro;
      p.forEach((c, i) => gl!.uniform3f(uC[i], c[0], c[1], c[2]));
    }

    function dimensionar() {
      // A media resolucion: es un degradado desenfocado, nadie va a notar el
      // detalle y baja el coste de pintarlo a la mitad.
      const escala = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
      const w = Math.max(1, Math.round(canvas!.clientWidth * escala));
      const h = Math.max(1, Math.round(canvas!.clientHeight * escala));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
    }

    let raf = 0;
    let visible = true;

    function frame(ms: number) {
      dimensionar();
      pintarColores();
      gl!.uniform1f(uT, ms / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }

    function unaVez() {
      dimensionar();
      pintarColores();
      gl!.uniform1f(uT, 12);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    function arrancar() {
      if (raf || quietoQuery.matches || !visible) return;
      raf = requestAnimationFrame(frame);
    }
    function parar() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    // Siempre se pinta un fotograma de entrada. Si se dejara en manos del
    // observador, un primer aviso de "no visible" dejaria la cabecera vacia.
    unaVez();

    // Con "reducir movimiento" ese fotograma es todo: el color sigue ahi, el
    // movimiento no. Quitarlo del todo seria perder informacion visual.
    if (!quietoQuery.matches) arrancar();

    // Fuera de pantalla o con la pestana en segundo plano no se pinta nada.
    const observador = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) arrancar();
      else parar();
    });
    observador.observe(canvas);

    const alCambiarVisibilidad = () => (document.hidden ? parar() : arrancar());
    const alCambiarMovimiento = () => {
      parar();
      if (quietoQuery.matches) unaVez();
      else arrancar();
    };

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    quietoQuery.addEventListener("change", alCambiarMovimiento);

    // Si algun dia hay interruptor de tema, el degradado lo sigue solo.
    const observadorTema = new MutationObserver(unaVez);
    observadorTema.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      parar();
      observador.disconnect();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      quietoQuery.removeEventListener("change", alCambiarMovimiento);
      observadorTema.disconnect();
      // Nada de loseContext(): en desarrollo React monta, limpia y vuelve a
      // montar, y un contexto perdido no revive. El canvas se recoge solo.
    };
  }, [claro, oscuro, rosa]);

  return (
    <div className={cn("aurora pointer-events-none absolute inset-0 -z-10", className)} aria-hidden>
      {/* Capa de respaldo: el mismo dibujo, quieto. Se ve cuando no hay WebGL. */}
      <div className="aurora-static absolute inset-0 bg-[radial-gradient(120%_140%_at_12%_18%,color-mix(in_srgb,var(--accent)_34%,transparent),transparent_58%),radial-gradient(120%_140%_at_82%_12%,color-mix(in_srgb,var(--wash-alt)_22%,transparent),transparent_60%),radial-gradient(140%_120%_at_50%_100%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_60%)]" />
      <canvas ref={ref} className="absolute inset-0 size-full" />
    </div>
  );
}
