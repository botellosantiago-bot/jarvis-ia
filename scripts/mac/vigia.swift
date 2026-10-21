// jarvis-vigia: escucha cuando vuelves a la Mac (desbloqueo o pantalla
// que despierta) y corre bienvenida.sh, como mucho una vez cada N horas para que
// no salude cada vez que regresas del baño.
//   jarvis-vigia <bienvenida.sh> <horas>
import Cocoa

let script = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : NSHomeDirectory() + "/.jarvis/bienvenida.sh"
let horas = CommandLine.arguments.count > 2 ? Double(CommandLine.arguments[2]) ?? 3 : 3
let marca = NSHomeDirectory() + "/.jarvis/.ultima-bienvenida"

func disparar(_ motivo: String) {
    let ahora = Date().timeIntervalSince1970
    if let s = try? String(contentsOfFile: marca, encoding: .utf8),
       let antes = Double(s.trimmingCharacters(in: .whitespacesAndNewlines)),
       ahora - antes < horas * 3600 {
        return
    }
    try? String(ahora).write(toFile: marca, atomically: true, encoding: .utf8)
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/bin/zsh")
    p.arguments = [script, motivo]
    try? p.run()
}

DistributedNotificationCenter.default().addObserver(
    forName: Notification.Name("com.apple.screenIsUnlocked"), object: nil, queue: .main
) { _ in disparar("desbloqueo") }

let ws = NSWorkspace.shared.notificationCenter
ws.addObserver(forName: NSWorkspace.screensDidWakeNotification, object: nil, queue: .main) { _ in disparar("pantalla") }
ws.addObserver(forName: NSWorkspace.sessionDidBecomeActiveNotification, object: nil, queue: .main) { _ in disparar("sesion") }

print("jarvis-vigia escuchando (cada \(horas) h como mucho)")
setvbuf(stdout, nil, _IOLBF, 0)

// Tras un reinicio, la sesion arranca antes que este vigia y el desbloqueo ya paso:
// si la Mac acaba de encender, se saluda en cuanto el escritorio esta listo.
if ProcessInfo.processInfo.systemUptime < 600 {
    DispatchQueue.main.asyncAfter(deadline: .now() + 20) { disparar("arranque") }
}
RunLoop.main.run()
