#!/bin/bash
# Hook PreToolUse para la herramienta Agent de Claude Code.
# Obliga a orquestar: bloquea los subagentes que correrían con el modelo caro de la sesión.
#
#   1. Un subagente pedido con el modelo del orquestador.
#   2. Un fork (hereda el modelo de la sesión e ignora el override).
#   3. Un agente genérico o sin tipo, salvo que pida un modelo barato explícito.
#
# Lee el JSON del hook por stdin. Salida 2 = bloquear (el mensaje de stderr le llega al agente).
# Requiere jq.
#
# Ajusta con variables de entorno si tus nombres son otros:
#   MODELO_ORQUESTADOR  nombre (o parte) del modelo caro de la sesión. Por defecto: fable
#   MODELOS_BARATOS     modelos permitidos para agentes genéricos, separados por |. Por defecto: opus|sonnet|haiku

command -v jq >/dev/null || { echo "Falta jq: instálalo para que el hook pueda revisar el encargo." >&2; exit 2; }

orquestador=$(printf '%s' "${MODELO_ORQUESTADOR:-fable}" | tr '[:upper:]' '[:lower:]')
baratos="${MODELOS_BARATOS:-opus|sonnet|haiku}"

entrada=$(cat)
modelo=$(printf '%s' "$entrada" | jq -r '.tool_input.model // ""' | tr '[:upper:]' '[:lower:]')
tipo=$(printf '%s' "$entrada" | jq -r '.tool_input.subagent_type // ""' | tr '[:upper:]' '[:lower:]')

bloquear() {
  echo "La sesión principal sólo orquesta: usa programador para código, obrero para renders y scripts, mensajero para lecturas y auditor para seguridad. ($1)" >&2
  exit 2
}

# 1. Agente pedido con el modelo del orquestador.
case "$modelo" in
  *"$orquestador"*) bloquear "model=$modelo" ;;
esac

# 2. Un fork hereda el modelo de la sesión.
[ "$tipo" = "fork" ] && bloquear "un fork hereda el modelo de la sesión"

# 3. Agentes genéricos o sin tipo, salvo que pidan un modelo barato.
case "$tipo" in
  ""|general-purpose|claude)
    if ! printf '%s' "$modelo" | grep -Eq "$baratos"; then
      bloquear "agente genérico sin modelo barato explícito"
    fi
    ;;
esac

exit 0
