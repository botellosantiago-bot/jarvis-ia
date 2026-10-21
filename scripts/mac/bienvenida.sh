#!/bin/zsh
# La bienvenida de Jarvis: te saluda con voz, abre tu flujo de trabajo y pone
# una canción. La dispara jarvis-vigia (vigia.swift) al desbloquear o despertar
# la Mac, como mucho una vez cada HORAS. Todo se ajusta en ~/.jarvis/bienvenida.conf.
#   zsh ~/.jarvis/bienvenida.sh prueba    (para oírlo ya)
set -u
CONF="$HOME/.jarvis/bienvenida.conf"
[[ -f "$CONF" ]] && source "$CONF"
: ${NOMBRE:="señor"}
: ${CANCION:="spotify:track:08mG3Y1vljYA6bvDt4Wqkj"}   # AC/DC, Back In Black
: ${VOLUMEN:=60}
: ${MUSICA:=1}
: ${VOZ_ID:=""}            # tu voz de ElevenLabs (opcional); vacío = frases incluidas
(( ${+FLUJO} )) || FLUJO=()

hora=$(date +%H)
if (( 10#$hora < 12 )); then saludo="Buenos días"
elif (( 10#$hora < 19 )); then saludo="Buenas tardes"
else saludo="Buenas noches"; fi

# Un remate por día de la semana: siete frases que se pagan una sola vez.
remates=(
  "Es domingo. Técnicamente usted descansa; yo no, pero nadie me pregunta."
  "Es lunes. Le preparé el café, en sentido figurado; no tengo manos."
  "Es martes. Estadísticamente, el día más aburrido de la semana. Hagamos algo al respecto."
  "Es miércoles. Mitad de semana: vamos bien, o eso le diré."
  "Es jueves. Ya casi es viernes, que es casi sábado. Sobreviva."
  "Es viernes. Nada de despliegues a producción, se lo ruego."
  "Es sábado. Si va a trabajar, que se note que durmió."
)
remate=${remates[$(( $(date +%w) + 1 ))]}
texto="$saludo, $NOMBRE. Abriendo su flujo de trabajo. $remate"
echo "$(date -u +%FT%TZ) bienvenida (${1:-sin motivo}): $texto"

# 1. La voz. jarvis-di decide: con tu llave de ElevenLabs y VOZ_ID genera el
#    saludo con tu voz (y lo guarda: el mismo saludo no se vuelve a pagar); sin
#    llave, pone una frase de las que ya vienen y el texto sale en pantalla.
"$HOME/.jarvis/bin/jarvis-di" --respaldo a-sus-ordenes "$texto"

# 2. El flujo de trabajo: apps por nombre o enlaces.
for destino in "${FLUJO[@]}"; do
  if [[ "$destino" == *://* ]]; then open "$destino"; else open -a "$destino"; fi
done

# 3. La canción (Spotify de escritorio; la primera vez macOS pide permiso de Automatización).
if (( MUSICA )) && [[ -n "$CANCION" ]]; then
  open -ga Spotify
  for _ in {1..20}; do
    osascript -e 'application "Spotify" is running' 2>/dev/null | grep -q true && break
    sleep 0.5
  done
  sleep 2
  osascript -e "tell application \"Spotify\"
    set sound volume to $VOLUMEN
    play track \"$CANCION\"
  end tell" || echo "no pude controlar Spotify (¿permiso de Automatización?)"
fi
