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
