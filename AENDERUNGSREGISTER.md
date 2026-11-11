# TidenUhr – Änderungsregister

Dieses Register dokumentiert jede geplante und ausgeführte Änderung am produktiven Repository.

## Verbindliche Regeln
1. Vor jeder Änderung den aktuellen Stand von `main`, die betroffenen Dateien und den letzten bestätigten App-Stand live abrufen.
2. Vor der Umsetzung Änderungs-ID, Anlass, Ziel, Umfang, Risiken und Rückholpunkt eintragen.
3. Produktive Änderungen nur nach ausdrücklicher Freigabe des Betreibers.
4. Keine Änderungen außerhalb des freigegebenen Umfangs. Supabase, Cloudflare und Archivdaten sind getrennte Freigabebereiche.
5. Nach der Änderung Commit-SHA, Dateiänderungen, automatische Prüfungen, Pages-Deployment und Browserprüfungen getrennt erfassen.
6. Nicht durchgeführte Tests ausdrücklich als „nicht geprüft“ markieren. Keine Ergebnisse vermuten oder rückwirkend erfinden.
7. Bei Fehlern: Änderungen stoppen, aktuellen Stand sichern, Ursache eingrenzen und erst nach Freigabe korrigieren oder zurückrollen.

## Statusdefinitionen
- **Vorgeschlagen:** noch nicht freigegeben.
- **Freigegeben:** Umfang ausdrücklich genehmigt, Umsetzung noch offen.
- **In Arbeit:** genehmigte Umsetzung läuft.
- **Automatisch geprüft:** GitHub-Prüfung erfolgreich; kein Browser-Funktionstest damit behauptet.
- **Veröffentlicht:** GitHub-Pages-Deployment erfolgreich.
- **Funktional bestätigt:** die benannten Browser-/Gerätetests wurden tatsächlich durchgeführt und bestanden.
- **Abgeschlossen:** alle für die Änderung erforderlichen Prüfschritte dokumentiert.

## Änderungsprotokoll

| ID | Datum | Ausgangsstand | Änderung / Dateien | Freigabe | Commit / Sicherung | Prüfung / Ergebnis |
|---|---|---|---|---|---|---|
| TU-2026-11-11-01 | 11.11.2026 | App v47.68, Commit `7ff1389031c57663126d80d3fa250e6178439a84` | Projektakte, Änderungsprotokoll, Testprotokoll, Release-Prüfung und Release-Ablauf angelegt | Vom Betreiber freigegeben | Commits `59787bc`, `93a6e80`, `01d8e81`, `790992b`, `829c38c`, `90dfa73` | Release-Check erfolgreich; Pages und Rollback-Sicherung für Commit `90dfa73` erfolgreich |
| TU-2026-11-11-02 | 11.11.2026 | Dokumentationsstand nach TU-2026-11-11-01 | Cloudflare Turnstile in `PROJECT_STATE.md`, `RELEASE-ABLAUF.md`, `CHANGELOG.md` dokumentiert | Vom Betreiber freigegeben | Commits `3c32333`, `deeb085`, `6f344d9` | Dashboard-/Code-Abgleich dokumentiert; Betreiber bestätigte zwei erfolgreiche Funktionstests; Pages und Rollback für letzten Commit erfolgreich |
| TU-2026-11-11-03 | 11.11.2026 | `main` Commit `6f344d99a44fb557670aa724ffd45f4a96ad1d90` | Änderungsregister und Bestands-/Arbeitsregeln ergänzen | Vom Betreiber freigegeben | Commit `84670d11d751c4d5a183f25d4ccecce465a39dd7` | Dokumentationsänderungen eingetragen; Pages- und Rollback-Actions zuletzt noch als queued gemeldet |
| TU-2026-11-11-04 | 11.11.2026 | BSH-Archivkatalog mit 100er-Paginierung | Vollständige Anzeige des BSH-Online-Textdateibestands für 2026 und 2027 sowie Archivbestand dokumentiert | Vom Betreiber ausdrücklich freigegeben | Dokumentation; keine Änderung an App-Code, Supabase-Funktionen oder Archivobjekten | Betreiberprüfung: 168 archivierte Dateien für 2026 und 168 für 2027 angezeigt. Vier Pegelstände haben laut Direktimport-Hinweis keine von BSH Online bereitgestellten Textdateien. Ergebnis als Betreiberprüfung dokumentiert, keine unabhängige Einzeldateiprüfung behauptet. |

## Offene Einträge
Neue Änderungen hier vor Beginn mit Status „Vorgeschlagen“ erfassen. Nach Freigabe und Umsetzung denselben Eintrag vervollständigen.
