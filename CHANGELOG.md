# TidenUhr – Änderungsprotokoll

## 2026-11-11 – Gebündelte Änderungspakete
- Verbindliche Arbeitsweise für mehrere zusammengehörige, einzeln freigegebene Änderungsschritte festgelegt.
- Jeder Teilpunkt erhält eine eigene Änderungs-ID und wird nach der Umsetzung intern geprüft und laufend dokumentiert.
- GitHub-Übertragung, Actions, Pages und Rollback-Prüfung werden grundsätzlich für das gemeinsam geprüfte Änderungspaket gebündelt, statt nach jedem Zwischenschritt unnötig neue Veröffentlichungsabläufe auszulösen.
- Eine laufende GitHub-Prüfung verhindert nicht die Planung oder interne Bearbeitung weiterer freigegebener Punkte; eine neue produktive Veröffentlichung erfolgt erst nach Klärung des vorherigen Veröffentlichungslaufs.
- Keine Änderungen an Anwendungscode, Supabase, Cloudflare oder produktiven Archivdaten.

## 2026-11-11 – BSH-Archiv: vollständiger Verfügbarkeitsbestand 2026/2027
- Nach Erweiterung der Kataloganzeige über 100 Einträge hinaus hat der Betreiber die Anzeige des BSH-Archivbestands geprüft.
- Für 2026 werden 168 archivierte Textdateien angezeigt; für 2027 ebenfalls 168. Insgesamt sind damit 336 Dateien im Archivbestand sichtbar.
- Der Betreiber bestätigt, dass damit der vollständige, von BSH Online für 2026 und 2027 bereitgestellte Textdateibestand im TidenUhr-BSH-Archiv enthalten ist.
- Für vier Pegelstände stellt BSH Online laut Direktimport-Hinweis keine Textdateien bereit. Die TidenUhr meldet dies entsprechend; diese Fälle sind keine fehlgeschlagenen Downloads.
- Prüfstatus: erfolgreiche Betreiberprüfung; keine unabhängige Einzelprüfung aller Dateien behauptet.
- Erwarteter nächster Datenstand: Aktualisierung/Verfügbarkeit der BSH-Textdateien für 2028.
- Dokumentation in `AENDERUNGSREGISTER.md` und `TESTPROTOKOLL.md` ergänzt. Keine Änderung an Anwendungscode, Supabase-Funktionen oder Archivobjekten.

## 2026-11-11 – Arbeits- und Änderungssteuerung
- Zentrales `AENDERUNGSREGISTER.md` für Anlass, Freigabe, Umfang, Commit, Sicherung und Prüfergebnis angelegt.
- Projektstatus um GitHub-Branch-Bestand, Rollback-Mechanismen und Grenzen der automatischen Prüfungen ergänzt.
- Testprotokoll um belegte historische Workflow-/Pages-/Rollback-Ergebnisse ergänzt; nicht durchgeführte Browserprüfungen bleiben ausdrücklich ungeprüft.
- Release-Ablauf um verbindliche Änderungsfreigabe und getrennte Prüfschritte erweitert.
- Keine Änderungen an `index.html`, `sw.js`, Supabase, Cloudflare oder produktiven Archivdaten.


## 2026-11-11 – Infrastruktur-Dokumentation
- Cloudflare Turnstile als externe Sicherheitskomponente der BSH-Archivierung in der Projektakte dokumentiert.
- Prüfanlässe für Cloudflare in den Release-Ablauf aufgenommen; gewöhnliche GitHub-Releases bleiben davon unabhängig.
- Keine Änderungen an Anwendungscode, Supabase-Funktionen, Cloudflare-Einstellungen oder Archivdaten.


## 2026-11-11 – v47.68
- NLWKN-Stationsverzeichnis und Stationsabgleich ergänzt bzw. erweitert.
- Service Worker auf tiden-v47-68-2026 aktualisiert.
- Versionskennung auf v47.68 gesetzt.
- BSH-Archivkatalog lädt vollständig in 100er-Seiten; Anzeige bleibt zusammenhängend.
- Letzter bestätigter Anwendungscode-Commit: 7ff1389031c57663126d80d3fa250e6178439a84.

## 2026-11-10 – v47.67 / v47.66
- Archiv-Jahresanzeige und Jahresprüfung weiterentwickelt.
- Kompakte Jahreskarten und Darstellung angepasst.
- Service-Worker-Cache aktualisiert.

Neue Einträge oben ergänzen. Nur veröffentlichte und bestätigte Änderungen eintragen; geplante Arbeiten nicht als umgesetzt darstellen.
