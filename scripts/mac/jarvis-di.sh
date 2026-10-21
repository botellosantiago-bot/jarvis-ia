#!/bin/zsh
# jarvis-di: Jarvis dice algo en voz alta.
#   jarvis-di listo-ya-quedo                  (una frase incluida, por su nombre: gratis)
#   jarvis-di "Señor, terminó la descarga."   (texto libre: con tu llave de ElevenLabs)
#   jarvis-di --respaldo a-sus-ordenes "..."  (si no se puede generar, pone esa frase y el texto en pantalla)
#   jarvis-di --local "texto privado"         (NO se dice: notificación en pantalla; nada sale a internet)
#   jarvis-di --siempre "..."                 (también en horas de silencio)
#
# Las frases incluidas viven en ~/.jarvis/voz/frases (las copia instalar.sh desde
# public/voz). El texto libre se genera UNA vez con ElevenLabs y se guarda en
# ~/.jarvis/voz/cache: repetirlo no gasta créditos. Sin llave, sin red o pasado
# el tope del mes, el texto sale como notificación.
set -u
CONF="$HOME/.jarvis/bienvenida.conf"
[[ -f "$CONF" ]] && source "$CONF"
: ${VOZ_ID:=""}
: ${SILENCIO_DESDE:=23}
: ${SILENCIO_HASTA:=7}
# Tope de créditos nuevos al mes en ElevenLabs. El plan gratis trae 10,000; se deja margen.
: ${TOPE_ELEVENLABS:=8000}
FRASES="$HOME/.jarvis/voz/frases"

local_solo=0; siempre=0; respaldo=""; modelo="eleven_multilingual_v2"
while [[ $# -gt 0 && "$1" == --* ]]; do
  case "$1" in
    --local) local_solo=1 ;;
    --siempre) siempre=1 ;;
    --rapido) modelo="eleven_flash_v2_5" ;;   # más rápido y cuesta medio crédito por carácter
    --respaldo) shift; respaldo="${1:-}" ;;
  esac
  shift
done
frase="${*:-}"
[[ -z "$frase" ]] && exit 0

notificar() {
  /usr/bin/osascript - "$1" <<'OSA' >/dev/null 2>&1
on run argv
  display notification (item 1 of argv) with title "Jarvis"
end run
OSA
}

hora=$((10#$(date +%H)))
if (( ! siempre )) && (( hora >= SILENCIO_DESDE || hora < SILENCIO_HASTA )); then
  # De noche solo se calla si no estás en la Mac: si la estás usando, sí te habla.
  inactivo=$(ioreg -c IOHIDSystem -d 4 2>/dev/null | awk -F'= ' '/HIDIdleTime/ {print int($2/1000000000); exit}')
  (( ${inactivo:-9999} > 120 )) && exit 0
fi

# Dos avisos a la vez se pisan: uno espera a que termine el otro.
exec 9>"$HOME/.jarvis/.hablando"
/usr/bin/lockf -t 60 9 true 2>/dev/null || true

if (( local_solo )); then notificar "$frase"; exit 0; fi

# 1. ¿Es el nombre de una frase incluida? Gratis y sin red.
if [[ "$frase" =~ '^[a-z0-9-]+$' && -s "$FRASES/$frase.mp3" ]]; then
  afplay "$FRASES/$frase.mp3"; exit 0
fi

# 2. Texto libre con tu voz de ElevenLabs (opcional). La llave vive en
#    ~/.jarvis/voz.env (ELEVENLABS_API_KEY=...) y nunca se imprime.
archivo=""
if [[ -n "$VOZ_ID" && -f "$HOME/.jarvis/voz.env" ]]; then
  cache="$HOME/.jarvis/voz/cache"; mkdir -p "$cache"
  archivo="$cache/$(print -rn -- "$VOZ_ID $modelo $frase" | shasum | cut -c1-16).mp3"
  uso="$HOME/.jarvis/voz/uso-$(date +%Y-%m).json"
  usados=$(/usr/bin/python3 -I -c 'import json,sys
try: print(json.load(open(sys.argv[1])).get("caracteres",0))
except Exception: print(0)' "$uso")
  if [[ ! -s "$archivo" ]] && (( usados + ${#frase} > TOPE_ELEVENLABS )); then
    archivo=""   # sin créditos este mes: lo nuevo no se genera
  fi
  if [[ -n "$archivo" && ! -s "$archivo" ]]; then
    ELEVENLABS_API_KEY=""; source "$HOME/.jarvis/voz.env"
    cuerpo=$(/usr/bin/python3 -I -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "model_id": sys.argv[2]}))' "$frase" "$modelo")
    if curl -sS -m 30 -o "$archivo.tmp" -w '%{http_code}' \
        -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
        -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOZ_ID?output_format=mp3_44100_128" \
        -d "$cuerpo" 2>/dev/null | grep -q 200; then
      mv "$archivo.tmp" "$archivo"
      creditos=${#frase}; [[ "$modelo" == eleven_flash* ]] && creditos=$(( (${#frase} + 1) / 2 ))
      /usr/bin/python3 -I -c 'import json,sys
p,n=sys.argv[1],int(sys.argv[2])
try: d=json.load(open(p))
except Exception: d={}
d["caracteres"]=d.get("caracteres",0)+n
json.dump(d,open(p,"w"))' "$uso" "$creditos"
    else
      rm -f "$archivo.tmp"; archivo=""
    fi
  fi
fi
if [[ -n "$archivo" && -s "$archivo" ]]; then afplay "$archivo"; exit 0; fi

# 3. Sin voz para ese texto: una frase incluida de respaldo y el texto en pantalla.
notificar "$frase"
if [[ -n "$respaldo" && -s "$FRASES/$respaldo.mp3" ]]; then afplay "$FRASES/$respaldo.mp3"; fi
