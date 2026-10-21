#!/bin/zsh
# Instala la voz de Jarvis en tu Mac: el comando jarvis-di y la bienvenida al
# desbloquear (saludo, apps de trabajo y canción).
#   zsh scripts/mac/instalar.sh
# Para quitar la bienvenida:
#   launchctl bootout gui/$(id -u)/com.jarvis.bienvenida
set -eu
AQUI="${0:A:h}"
REPO="${AQUI:h:h}"
DESTINO="$HOME/.jarvis"
PLIST="$HOME/Library/LaunchAgents/com.jarvis.bienvenida.plist"
mkdir -p "$DESTINO/bin" "$DESTINO/voz/frases" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

# Las frases que ya vienen en el repo, para hablar sin llave ni internet.
cp "$REPO"/public/voz/*.mp3 "$DESTINO/voz/frases/"

cp "$AQUI/jarvis-di.sh" "$DESTINO/bin/jarvis-di"
cp "$AQUI/bienvenida.sh" "$DESTINO/bienvenida.sh"
chmod 700 "$DESTINO/bin/jarvis-di" "$DESTINO/bienvenida.sh"
swiftc -O "$AQUI/vigia.swift" -o "$DESTINO/bin/jarvis-vigia"

if [[ ! -f "$DESTINO/bienvenida.conf" ]]; then
  cat > "$DESTINO/bienvenida.conf" <<'CONF'
# La bienvenida de Jarvis. Cambia lo que quieras; aplica en la siguiente.
NOMBRE="señor"                         # cómo te saluda: "señor", "jefa", tu nombre...
VOZ_ID=""                              # tu Voice ID de ElevenLabs (opcional, ver README)
CANCION="spotify:track:08mG3Y1vljYA6bvDt4Wqkj"   # AC/DC, Back In Black (copia el link de Spotify)
VOLUMEN=60
MUSICA=1                               # 0 = sin canción
HORAS=3                                # no saluda más de una vez cada 3 horas
# Lo que se abre: apps por nombre o enlaces (pon aquí el link de tu Jarvis).
FLUJO=(
  "Calendar"
  "https://TU-JARVIS.vercel.app"
)
CONF
fi
HORAS=$(zsh -c "source '$DESTINO/bienvenida.conf'; print -r -- \${HORAS:-3}")

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.jarvis.bienvenida</string>
  <key>ProgramArguments</key>
  <array>
    <string>$DESTINO/bin/jarvis-vigia</string>
    <string>$DESTINO/bienvenida.sh</string>
    <string>${HORAS:-3}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/jarvis-bienvenida.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/jarvis-bienvenida.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/com.jarvis.bienvenida" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Listo: Jarvis te saluda al desbloquear la Mac (una vez cada ${HORAS:-3} h)."
echo "Pruébalo ya:   zsh ~/.jarvis/bienvenida.sh prueba"
echo "Una frase:     ~/.jarvis/bin/jarvis-di listo-ya-quedo"
echo "Config: $DESTINO/bienvenida.conf · Log: ~/Library/Logs/jarvis-bienvenida.log"
