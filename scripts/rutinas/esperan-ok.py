#!/usr/bin/env python3
"""
Lee la lista "Esperan tu OK" y devuelve las decisiones abiertas, las más viejas primero.

Formato que entiende:

    ## Proyecto
    - [ ] Texto de la decisión (desde 3-mar)
    - [x] Algo ya resuelto (desde 1-mar) — resuelto el 4-mar

Uso:
    python3 esperan-ok.py "cerebro/Esperan tu OK.md"            texto para leer o mandar en un aviso
    python3 esperan-ok.py "cerebro/Esperan tu OK.md" --tope 5   sólo las 5 más viejas
    python3 esperan-ok.py "cerebro/Esperan tu OK.md" --json     para que otro script lo use
    python3 esperan-ok.py ... --conteo                          sólo el número (para avisos a la nube)

Sólo biblioteca estándar. No escribe nada.
"""
import argparse
import datetime
import json
import re
import sys

MESES = {m: i for i, m in enumerate(
    ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], start=1)}
CASILLA = re.compile(r"^\s*[-*]\s*\[( |x|X)\]\s*(.+?)\s*$")
DESDE = re.compile(r"\(desde (\d{1,2})-([a-záéíóú]{3})\w*\)", re.IGNORECASE)


def fecha_desde(texto, hoy):
    m = DESDE.search(texto)
    if not m:
        return None
    mes = MESES.get(m.group(2).lower()[:3])
    if not mes:
        return None
    try:
        f = datetime.date(hoy.year, mes, int(m.group(1)))
    except ValueError:
        return None
    # Una fecha "en el futuro" es del año pasado (la lista cruza de diciembre a enero).
    return f.replace(year=hoy.year - 1) if f > hoy else f


def leer(ruta, hoy):
    abiertas, seccion = [], "Sin sección"
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            if linea.startswith("## "):
                seccion = linea[3:].strip()
                continue
            m = CASILLA.match(linea)
            if not m or m.group(1) != " ":
                continue
            texto = m.group(2)
            desde = fecha_desde(texto, hoy)
            abiertas.append({
                "seccion": seccion,
                "texto": DESDE.sub("", texto).strip(),
                "desde": desde.isoformat() if desde else None,
                "dias": (hoy - desde).days if desde else None,
            })
    # Las más viejas primero; las que no traen fecha, al final.
    abiertas.sort(key=lambda d: -(d["dias"] if d["dias"] is not None else -1))
    return abiertas


def main():
    p = argparse.ArgumentParser(description="Decisiones abiertas de 'Esperan tu OK'.")
    p.add_argument("ruta")
    p.add_argument("--tope", type=int, default=0, help="máximo de decisiones a mostrar (0 = todas)")
    p.add_argument("--json", action="store_true")
    p.add_argument("--conteo", action="store_true", help="sólo el número de abiertas")
    p.add_argument("--hoy", help="fecha AAAA-MM-DD para pruebas")
    a = p.parse_args()

    hoy = datetime.date.fromisoformat(a.hoy) if a.hoy else datetime.date.today()
    try:
        abiertas = leer(a.ruta, hoy)
    except FileNotFoundError:
        print(f"No encuentro la lista: {a.ruta}", file=sys.stderr)
        return 1

    total = len(abiertas)
    if a.tope > 0:
        abiertas = abiertas[: a.tope]

    if a.conteo:
        print(total)
    elif a.json:
        print(json.dumps({"total": total, "abiertas": abiertas}, ensure_ascii=False, indent=2))
    elif total == 0:
        print("Nada espera tu OK.")
    else:
        print(("1 decisión espera tu OK" if total == 1 else f"{total} decisiones esperan tu OK") + (("; la más vieja:" if len(abiertas) == 1 else f"; las {len(abiertas)} más viejas:") if len(abiertas) < total else ":"))
        for d in abiertas:
            edad = f" ({d['dias']} días)" if d["dias"] is not None else ""
            print(f"- [{d['seccion']}] {d['texto']}{edad}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
