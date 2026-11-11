# TidenUhr – Test- und Freigabeprotokoll

## A. Automatisierte Repository-Prüfung
- Versionskonstante in index.html vorhanden.
- HTML-Titel und sichtbare Versionskennung stimmen mit ihr überein.
- Service-Worker-Cachekennung passt zur Anwendungsversion.
- Archivkatalog enthält die erwartete Offset-Paginierung.
- ZIP enthält ausschließlich index.html und deren Inhalt stimmt bytegenau.

## B. Veröffentlichung
- Commit auf main vorhanden.
- GitHub Pages Build/Deployment erfolgreich.
- Automatischer Rollback-Sicherungspunkt erfolgreich.

## C. Browser-Funktionstest
Nur nach tatsächlicher Prüfung als bestanden eintragen:
- MacBook Safari: Seite neu laden und sichtbare Version prüfen.
- iPhone Safari/PWA: Seite neu laden und sichtbare Version prüfen.
- BSH-Archiv: Jahr wählen und vollständige Einträge prüfen.
- Archivliste bleibt zusammenhängend ohne sichtbare Blocktrennung.
- Import-/Löschfunktionen nur mit geeigneten Testfällen prüfen; keine produktiven Daten unbeabsichtigt verändern.

| Feld | Eintrag |
|---|---|
| Version / Commit | |
| Datum | |
| Automatisierter Check | offen / bestanden / fehlgeschlagen |
| GitHub Pages | offen / erfolgreich / fehlgeschlagen |
| MacBook Safari | nicht geprüft / bestanden / fehlgeschlagen |
| iPhone Safari/PWA | nicht geprüft / bestanden / fehlgeschlagen |
| Archivkatalog | nicht geprüft / bestanden / fehlgeschlagen |
| Bemerkungen | |

Ein erfolgreicher Workflow oder Pages-Build beweist nicht, dass alle Funktionen im Browser korrekt arbeiten.


## Nachweisbare historische Prüfergebnisse (11.11.2026)
Die folgenden Ergebnisse werden nur für die tatsächlich protokollierten Commits festgehalten:

| Commit | Automatischer Release-Check | GitHub Pages | Rollback-Sicherung | Browser |
|---|---|---|---|---|
| `829c38c6d9563c1fddcb27418066430e3d226393` | erfolgreich, Workflow 43090570010 | für diesen Commit nicht separat hier bestätigt | erfolgreich, Lauf 43090570154 | nicht Bestandteil des Workflows |
| `90dfa732bafd7de15cb7f3b7c450bc7b01553242` | letzter dokumentierter Release-Check bezog sich auf vorherigen Commit | erfolgreich, Lauf 43090584944 | erfolgreich, Lauf 43090586064 | nicht geprüft durch Workflow |
| `6f344d99a44fb557670aa724ffd45f4a96ad1d90` | kein Release-Check für reine Dokumentationsänderungen nachgewiesen | erfolgreich, Lauf 43094950152 | erfolgreich, Lauf 43094950281 | nicht durch diese Läufe geprüft |

Der Betreiber bestätigte am 11.11.2026 zwei erfolgreiche Turnstile-Funktionstests. Das ist ein Betreiberbericht und kein automatischer GitHub-Browser-Test.

## Regel für neue Testeinträge
Für jeden neuen Änderungsvorgang einen eigenen Datensatz im Änderungsregister führen. Browserprüfungen nur mit Datum, Gerät/Browser, geprüften Funktionen und tatsächlichem Ergebnis als bestanden markieren. „Pages erfolgreich“ ist kein Ersatz für „Funktional bestätigt“.
