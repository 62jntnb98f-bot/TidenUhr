TidenUhr v47.38 – Produktiver GitHub-Pages-Stand
=================================================

Produktive Quelle
------------------
Repository: 62jntnb98f-bot/TidenUhr
Branch: main
Startdatei: index.html
Service Worker: sw.js
Deployment: GitHub Pages aus dem Repository-Hauptverzeichnis (/(root))

Veröffentlichung und Nutzung
-----------------------------
1. Änderungen ausschließlich nach Prüfung im Branch main veröffentlichen.
2. GitHub Pages stellt die statischen Dateien aus dem Hauptverzeichnis bereit.
3. Auf dem iPhone die veröffentlichte Seite in Safari öffnen.
4. Über „Teilen“ -> „Zum Home-Bildschirm“ als PWA hinzufügen.

Wichtige Dateien
----------------
- index.html: Anwendung und Versionskennung v47.38
- sw.js: Offline-Cache und Netzwerkverhalten; Cachekennung tiden-v47-37-2026
- manifest.webmanifest: PWA-Metadaten
- stations.json und catalog.json: Stations- und Jahresdatei-Metadaten
- DE__510P2026.json, DE__632P2026.json und KIEL-HOLTENAU2026.json: gebündelte Jahresdateien im Repository-Hauptverzeichnis
- audit-data/bsh-stations-172.json: BSH-Stammdaten und Zuordnungsprüfung

Dateipfade
----------
Die Jahresdateien und stations.json liegen im Repository-Hauptverzeichnis.
Es wird kein data/-Unterordner vorausgesetzt. Metadaten, Anwendungs-Fallbacks
und Service-Worker-Assets müssen dieselben relativen Pfade verwenden.

Datenschutz und Datenhaltung
----------------------------
Das produktive Supabase-BSH-Archiv ist von den statischen GitHub-Dateien getrennt.
Änderungen an diesem Repository verändern keine Supabase-Archivobjekte oder
Datenbankeinträge automatisch.
