TidenUhr v47.39 – iPhone / PWA
==============================

Diese Datei beschreibt den produktiven GitHub-Pages-Stand.

Betrieb
-------
- Die TidenUhr läuft als Web-App/PWA in Safari.
- GitHub Pages stellt die Anwendung statisch aus dem Repository-Hauptverzeichnis bereit.
- Für aktuelle PEGELONLINE-Werte und das produktive BSH-Archiv ist eine Internetverbindung erforderlich.
- Der Service Worker verwendet Network-First für Navigationen und einen Offline-Fallback.
- Nach einer neuen Veröffentlichung kann ein Neuladen erforderlich sein, damit der aktuelle Service Worker aktiv wird.

Installation
------------
1. Die produktive GitHub-Pages-Seite in Safari öffnen.
2. „Teilen“ wählen.
3. „Zum Home-Bildschirm“ auswählen.

Dateien
-------
Die Anwendung verwendet index.html, sw.js und manifest.webmanifest.
Die gebündelten Jahresdateien DE__510P2026.json, DE__632P2026.json und
KIEL-HOLTENAU2026.json liegen neben index.html im Repository-Hauptverzeichnis.
Die Stationsmetadaten stehen in stations.json und catalog.json.
Es wird kein data/-Unterordner vorausgesetzt.

Quellentrennung
---------------
BSH-Gezeiten, PEGELONLINE-Messwerte, BSH-Wasserstandsvorhersagen und
Supabase-BSH-Archiv bleiben getrennte Datenquellen. Die Anzeige kennzeichnet
die jeweils verwendete Quelle.
