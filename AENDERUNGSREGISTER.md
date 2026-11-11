# TidenUhr – Änderungsregister

Dieses Register dokumentiert jede geplante und ausgeführte Änderung am produktiven Repository.

## Verbindliche Regeln
1. Vor jeder Änderung den aktuellen Stand von `main`, die betroffenen Dateien und den letzten bestätigten App-Stand live abrufen.
2. Vor der Umsetzung Änderungs-ID, Anlass, Ziel, Umfang, Risiken und Rückholpunkt eintragen.
3. Produktive Änderungen nur nach ausdrücklicher Freigabe des Betreibers.
4. Keine Änderungen außerhalb des freigegebenen Umfangs. Supabase, Cloudflare und Archivdaten sind getrennte Freigabebereiche.
5. Jede Teiländerung erhält eine eigene Änderungs-ID und wird während der Arbeit dokumentiert. Mehrere freigegebene Teiländerungen dürfen zu einem gemeinsamen Änderungspaket gebündelt werden.
6. Nach jedem Teilsschritt erfolgt eine passende interne Prüfung. Die vollständige GitHub-/Pages-/Rollback-Prüfung erfolgt grundsätzlich nach dem gebündelten Paket, nicht zwingend nach jedem Zwischenschritt.
7. Nicht durchgeführte Tests ausdrücklich als „nicht geprüft“ markieren. Keine Ergebnisse vermuten oder rückwirkend erfinden.
8. Bei Fehlern: Änderungen stoppen, aktuellen Stand sichern, Ursache eingrenzen und erst nach Freigabe korrigieren oder zurückrollen.
9. Supabase, Cloudflare und produktive Archivdaten benötigen weiterhin eine eigene ausdrückliche Freigabe; sie werden nicht automatisch Teil eines GitHub-Änderungspakets.

## Statusdefinitionen
- **Vorgeschlagen:** noch nicht freigegeben.
- **Freigegeben:** Umfang ausdrücklich genehmigt, Umsetzung noch offen.
- **In Arbeit:** genehmigte Umsetzung läuft.
- **Intern geprüft:** Teiländerung wurde im vorgesehenen Umfang geprüft; noch keine Aussage über Veröffentlichung.
- **Automatisch geprüft:** GitHub-Prüfung erfolgreich; kein Browser-Funktionstest damit behauptet.
- **Veröffentlicht:** GitHub-Pages-Deployment erfolgreich.
- **Funktional bestätigt:** die benannten Browser-/Gerätetests wurden tatsächlich durchgeführt und bestanden.
- **Abgeschlossen:** alle für das Änderungspaket erforderlichen Prüfschritte dokumentiert.

## Gebündelte Änderungspakete
- Ein Paket kann mehrere einzeln freigegebene Teiländerungen enthalten.
- Jede Teiländerung wird mit eigener ID, Umfang und internem Prüfergebnis dokumentiert.
- Die Teiländerungen werden gesammelt und nach Abschluss des Pakets in einem gemeinsamen Veröffentlichungsschritt übertragen, soweit technisch sinnvoll.
- Vor dem gemeinsamen Push wird der Gesamtstand auf Wechselwirkungen geprüft und ein eindeutiger Ausgangs-/Rückholpunkt festgehalten.
- GitHub Actions, Pages und Rollback-Sicherung werden für den Paketstand kontrolliert. Browser-/Gerätetests folgen nach der Veröffentlichung.
- Zwischenstände dürfen lokal oder als nicht produktive Arbeitsstände geprüft werden; sie werden nicht ungefragt auf `main` veröffentlicht.
- Bei dringenden Sicherheits- oder Fehlerkorrekturen kann ein einzelner Änderungsschritt separat veröffentlicht werden; Grund und Freigabe werden dokumentiert.

## Änderungsprotokoll

| ID | Datum | Ausgangsstand | Änderung / Dateien | Freigabe | Commit / Sicherung | Prüfung / Ergebnis |
|---|---|---|---|---|---|---|
| TU-2026-11-11-01 | 11.11.2026 | App v47.68, Commit `7ff1389031c57663126d80d3fa250e6178439a84` | Projektakte, Änderungsprotokoll, Testprotokoll, Release-Prüfung und Release-Ablauf angelegt | Vom Betreiber freigegeben | Commits `59787bc`, `93a6e80`, `01d8e81`, `790992b`, `829c38c`, `90dfa73` | Release-Check erfolgreich; Pages und Rollback-Sicherung für Commit `90dfa73` erfolgreich |
| TU-2026-11-11-02 | 11.11.2026 | Dokumentationsstand nach TU-2026-11-11-01 | Cloudflare Turnstile in `PROJECT_STATE.md`, `RELEASE-ABLAUF.md`, `CHANGELOG.md` dokumentiert | Vom Betreiber freigegeben | Commits `3c32333`, `deeb085`, `6f344d9` | Dashboard-/Code-Abgleich dokumentiert; Betreiber bestätigte zwei erfolgreiche Funktionstests; Pages und Rollback für letzten Commit erfolgreich |
| TU-2026-11-11-03 | 11.11.2026 | `main` Commit `6f344d99a44fb557670aa724ffd45f4a96ad1d90` | Änderungsregister und Bestands-/Arbeitsregeln ergänzen | Vom Betreiber freigegeben | Commit `84670d11d751c4d5a183f25d4ccecce465a39dd7` | Dokumentationsänderungen eingetragen; Pages- und Rollback-Actions zuletzt noch als queued gemeldet |
| TU-2026-11-11-04 | 11.11.2026 | BSH-Archivkatalog mit 100er-Paginierung | Vollständige Anzeige des BSH-Online-Textdateibestands für 2026 und 2027 sowie Archivbestand dokumentiert | Vom Betreiber ausdrücklich freigegeben | Commit `d49da14d88218affed2e133e8f10c269b8f13432`; nur Dokumentation | Betreiberprüfung: 168 archivierte Dateien für 2026 und 168 für 2027 angezeigt. Vier Pegelstände haben laut Direktimport-Hinweis keine von BSH Online bereitgestellten Textdateien. Keine unabhängige Einzeldateiprüfung behauptet. |
| TU-2026-11-11-05 | 11.11.2026 | `main` Commit `d49da14d88218affed2e133e8f10c269b8f13432` | Gebündelte Änderungspakete, interne Teilprüfungen und gemeinsamer Veröffentlichungsschritt verbindlich festgelegt | Vom Betreiber ausdrücklich freigegeben | Wird nach Umsetzung ergänzt | Dokumentationsänderung; keine App-/Backend-/Archivänderung |

## Offene Einträge
Neue Änderungen hier vor Beginn mit Status „Vorgeschlagen“ erfassen. Nach Freigabe und Umsetzung denselben Eintrag vervollständigen.
