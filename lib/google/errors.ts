/**
 * Google invalido la concesion: refresh token caducado (las apps en modo
 * "Prueba" los caducan a los 7 dias), revocado desde myaccount.google.com, o
 * permisos cambiados. La unica salida es que el usuario vuelva a autorizar.
 *
 * Vive en su propio fichero para que calendar.ts pueda lanzarlo sin importar
 * oauth.ts y crear un ciclo.
 */
export class GoogleReauthRequired extends Error {
  constructor(message = "La conexion con Google caduco. Vuelve a conectarla.") {
    super(message);
    this.name = "GoogleReauthRequired";
  }
}
