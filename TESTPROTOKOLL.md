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
