#!/usr/bin/env python3
"""
El latido: revisa que lo básico siga vivo y avisa sólo cuando hace falta.

  - Cada chequeo es un comando: si sale con 0, está vivo.
  - Una falla avisa hasta la segunda vuelta seguida (un parpadeo no es falla).
  - Avisa UNA vez por falla y UNA vez cuando se recupera. Mientras siga igual, se calla.
  - No arregla nada: sólo avisa.

Configuración (JSON):

    {
      "estado": "~/.agente/latido-estado.json",
      "disco_min_gb": 15,
      "avisar": ["~/.agente/bin/avisar"],
      "chequeos": [
        {"nombre": "el servidor local", "comando": ["curl", "-sf", "http://127.0.0.1:3000"]}
      ]
    }

"avisar" es el comando que recibe el texto del aviso como último argumento (tu bot, tu app,
una notificación del sistema). Sin "avisar", el aviso sólo se imprime.

Ojo: este JSON equivale a código que se ejecuta cada pocos minutos. Debe ser sólo tuyo,
con permisos 600 (chmod 600 latido.json), y no debe ser la misma ruta que "estado".

Uso:
    python3 latido.py --config latido.json            la vuelta normal (la corre launchd o cron)
    python3 latido.py --config latido.json --prueba   imprime cada chequeo; no avisa ni toca el estado

Sólo biblioteca estándar.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

VUELTAS_PARA_AVISAR = 2


def correr(cmd, timeout=15):
    try:
        return subprocess.run([os.path.expanduser(c) for c in cmd], capture_output=True, timeout=timeout).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def revisar(cfg):
    resultados = {}
    for c in cfg.get("chequeos", []):
        resultados[c["nombre"]] = correr(c["comando"], c.get("timeout", 15))
    minimo = cfg.get("disco_min_gb")
    if minimo:
        libre = shutil.disk_usage(os.path.expanduser("~")).free / 1e9
        resultados["el disco"] = libre >= minimo
    return resultados


def avisar(cfg, texto):
    cmd = cfg.get("avisar")
    if not cmd:
        print(f"AVISO: {texto}")
        return
    if not correr(cmd + [texto]):
        # Si el canal de avisos falla, el latido sigue: lo deja en su salida.
        print(f"AVISO (el canal falló): {texto}", file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description="Latido: chequeos con aviso sin ruido.")
    p.add_argument("--config", required=True)
    p.add_argument("--prueba", action="store_true")
    a = p.parse_args()

    with open(a.config, encoding="utf-8") as f:
        cfg = json.load(f)
    resultados = revisar(cfg)

    if a.prueba:
        for nombre, vivo in resultados.items():
            print(f"{'ok   ' if vivo else 'FALLA'}  {nombre}")
        return 0

    ruta = os.path.expanduser(cfg.get("estado", "~/.agente/latido-estado.json"))
    try:
        with open(ruta, encoding="utf-8") as f:
            estado = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        estado = {}

    for nombre, vivo in resultados.items():
        e = estado.get(nombre, {"fallas": 0, "avisado": False})
        if vivo:
            if e["avisado"]:
                avisar(cfg, f"Se recuperó {nombre}.")
            e = {"fallas": 0, "avisado": False}
        else:
            e["fallas"] += 1
            if e["fallas"] >= VUELTAS_PARA_AVISAR and not e["avisado"]:
                avisar(cfg, f"Falla {nombre} desde hace {e['fallas']} vueltas.")
                e["avisado"] = True
        estado[nombre] = e

    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
