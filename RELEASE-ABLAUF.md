# TidenUhr – Release-Ablauf

Bei Änderungen an index.html, sw.js, dem Release-Prüfskript oder dem Workflow startet automatisch **TidenUhr release check and index ZIP**.

Der Workflow:
1. prüft die Versionskennung in index.html,
2. gleicht HTML-Titel und sichtbare Versionskennung ab,
3. gleicht die Service-Worker-Cachekennung ab,
4. prüft die erwartete Archiv-Offset-Paginierung,
5. erstellt ein ZIP mit genau einer Datei: index.html,
6. prüft den ZIP-Inhalt bytegenau,
7. stellt das ZIP als GitHub-Actions-Artefakt für 90 Tage bereit.

Der Workflow verändert weder Supabase noch produktive Archivdaten.

## ZIP herunterladen
GitHub öffnen: Actions → TidenUhr release check and index ZIP → erfolgreichen Lauf → Artifacts. Das Artefakt TidenUhr-index-html-<Commit-SHA> herunterladen. Es enthält ausschließlich index.html.

## Grenzen
Der Workflow ist eine automatisierte statische Prüfung und ersetzt keinen Safari- oder iPhone-Funktionstest. Er startet automatisch bei relevanten Änderungen auf main und kann zusätzlich manuell über Run workflow ausgelöst werden.


## Cloudflare Turnstile – wann im Release zu berücksichtigen
Cloudflare Turnstile schützt den Upload zur BSH-Archivierung und ist eine externe Sicherheitsabhängigkeit. Die normale GitHub-Versionshistorie und die GitHub-Actions-Release-Artefakte funktionieren unabhängig davon.

Eine erneute Cloudflare-Prüfung ist erforderlich, wenn eine Änderung Folgendes betrifft:
- Turnstile-Aufruf oder Site-Key in `index.html`,
- GitHub-Pages-Hostname bzw. zugelassene Widget-Hostnamen,
- Supabase-Upload-Funktion oder deren serverseitige Turnstile-Validierung,
- Sicherheits- oder Freigabeablauf der BSH-Archivierung.

Bei gewöhnlichen Releases ohne Änderungen an diesen Bereichen ist keine zusätzliche Cloudflare-Prüfung notwendig. Bei relevanten Änderungen sind Widget-Hostname/Site-Key, serverseitige Secret-Konfiguration (ohne Offenlegung des Werts) und die erfolgreiche Turnstile-Verifizierung zu berücksichtigen. Ein Funktionstest ist nur dann neu einzuplanen, wenn die betroffene Kette geändert wurde oder ein konkreter Fehlerhinweis vorliegt.



## Verbindliche Änderungs- und Freigabekontrolle
Vor jeder produktiven Änderung:
1. Aktuellen `main`-Commit und betroffene Dateien live abrufen; Ausgangsversion und SHA im `AENDERUNGSREGISTER.md` festhalten.
2. Anlass, Ziel, konkrete Dateien/Systeme, Seiteneffekte und Rückholpunkt beschreiben.
3. Ausdrückliche Freigabe für genau diesen Umfang abwarten. Eine Freigabe für GitHub-Dateien umfasst nicht automatisch Änderungen an Supabase, Cloudflare oder produktiven Archivdaten.
4. Änderung eng begrenzt umsetzen und jeden Commit dokumentieren.
5. Automatische Checks, Pages-Deployment und Rollback-Sicherung getrennt kontrollieren.
6. Die tatsächlichen Browser-/Gerätetests durchführen und im `TESTPROTOKOLL.md` dokumentieren. Nicht ausgeführte Tests bleiben „nicht geprüft“.
7. Erst nach allen erforderlichen Prüfschritten den Eintrag im Änderungsregister auf „Abgeschlossen“ setzen.

## Branch- und Direktarbeitsregel
- `main` bleibt der einzige produktive Arbeitszweig.
- Vorhandene ältere Feature-/Fix-Branches sind Altbestand und werden nicht ohne separate Bestandsprüfung und ausdrückliche Freigabe gelöscht, gemergt oder verändert.
- `main` war bei der Bestandsaufnahme nicht geschützt. Eine Branch-Protection wird nicht ohne Prüfung der Auswirkungen auf den bestehenden Arbeits- und Releaseablauf aktiviert. Insbesondere dürfen automatische Sicherungs- und Pages-Workflows nicht unbeabsichtigt blockiert werden.
