TidenUhr v45.2 – iPhone/PWA-Paket
====================================

Dieses Paket ist die statische iPhone-Version der TidenUhr.

Wichtig:
- Es wird KEIN Windows-Server benötigt.
- Es gibt keine .BAT- oder PowerShell-Datei in diesem Paket.
- Die TidenUhr läuft als normale Web-App/PWA in Safari.
- Die lokalen BSH-Daten und das Offline-Caching bleiben erhalten.
- Der Button „BSH-Originaltabelle ↗“ führt direkt zur offiziellen BSH-Seite:
  https://gezeiten.bsh.de/kiel_holtenau
- Für aktuelle PEGELONLINE-Werte benötigt die App eine Internetverbindung.
- Die automatische Übernahme der aktuellen BSH-Webtabelle hängt davon ab,
  ob der BSH-Webserver den direkten Browserzugriff (CORS) erlaubt. Wenn nicht,
  bleibt die offizielle BSH-Originaltabelle als direkter Link verfügbar.

VERWENDUNG AUF DEM iPHONE
--------------------------
Die Dateien können nicht sinnvoll aus der Dateien-App per file:// als
installierbare PWA betrieben werden, weil iOS Service Worker nur über einen
geeigneten Web-Kontext zulässt.

Daher dieses Paket auf einen statischen Webserver/Webhosting-Dienst hochladen
(z. B. eine eigene Website oder GitHub Pages). Danach die TidenUhr in Safari
öffnen und über „Teilen“ -> „Zum Home-Bildschirm“ hinzufügen.

Die App benötigt keine serverseitige Programmlogik für die normale
PWA-Funktion. Der frühere Windows-PowerShell-Server diente hauptsächlich dem
lokalen Bereitstellen der Dateien und dem BSH-Proxy.

DESKTOP-VERSION
---------------
Die ursprünglichen Windows-Serverdateien bleiben im Ausgangsprojekt erhalten.
Dieses ZIP ist bewusst die separate, statische iPhone-Version.
