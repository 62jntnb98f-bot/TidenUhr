# TidenUhr – Projektstatus

Stand: 11.11.2026  
Repository: 62jntnb98f-bot/TidenUhr  
Branch: main · Startdatei: index.html · Deployment: GitHub Pages  
Supabase-Projekt: hqdoufaiuslwnqwnrltc

## Maßgebliche Quellen
- main ist die maßgebliche Quelle für Anwendungscode.
- Das produktive Supabase-Projekt ist maßgeblich für Funktionen, Metadaten und Storage.
- Gesprächsnotizen und README-Dateien ersetzen keine Live-Prüfung.
- Produktive Daten und Funktionen nur nach ausdrücklicher Freigabe ändern.
- Keine lokalen Testzweige oder parallelen Produktionsstände ohne Auftrag.

## Letzter bestätigter Stand vor dieser Projektakte
- Anwendung: v47.68
- Commit: 7ff1389031c57663126d80d3fa250e6178439a84
- index.html Blob-SHA: 3fb977b4b01a730498a0727254f9e896d5199a14
- sw.js Blob-SHA: c6bff519e4997be9b2f0042badd42e1d897970e1
- Cachekennung: tiden-v47-68-2026
- Archivkatalog lädt vollständig in 100er-Seiten; Anzeige bleibt zusammenhängend.
- bsh-archiv-katalog unterstützt limit bis 100 und offset.
- Pages-Build und Rollback-Sicherungspunkt für diesen Commit waren erfolgreich.

## Supabase – lesend geprüfte Momentaufnahme
Aktive Funktionen (Auswahl): bsh-archiv-katalog, bsh-archiv-upload-online, bsh-archiv-delete, bsh-archiv-download, bsh-direktdownload-pruefen, hsi-messwerte-proxy, nlwkn-messwerte-proxy.

Storage:
- bsh-archiv: privat, 336 Objekte
- bsh-pegel-prueflog: privat, 6 Objekte
- tidenuhr-archiv: öffentlich, 16 Objekte; Zweck und Sichtbarkeit noch bestätigen

Momentaufnahme; vor Änderungen erneut live prüfen. Die paarweise inhaltliche Zuordnung aller Archivobjekte wurde nicht vollständig geprüft.

## Offene Prüfhinweise
1. Supabase Advisor meldet public.rls_auto_enable() als für anon und authenticated ausführbare SECURITY DEFINER Event-Trigger-Funktion; sie ist an ensure_rls gebunden. Vor Änderungen klären, ob Supabase-verwaltet.
2. public.bsh_archiv_metadaten hat RLS aktiviert und keine Tabellen-Policies. Der aktuelle Zugriff erfolgt serverseitig über Edge Functions mit Service Role. Keine Änderung ohne Architekturprüfung.
3. Der NLWKN-API-Schlüssel steht im Quelltext von nlwkn-messwerte-proxy. Prüfen, ob er in Supabase Secrets verlagert werden kann.
4. README-Dateien dokumentieren noch v47.60.
5. Öffentlicher Bucket tidenuhr-archiv: beabsichtigte Sichtbarkeit klären.

## Verbindlicher Ablauf
1. Produktionsstand live abrufen.
2. Änderungsumfang und Seiteneffekte bestimmen.
3. Sicherungen und Rollback prüfen.
4. Nur nach ausdrücklicher Freigabe produktiv ändern.
5. Commit, Dateien und SHA dokumentieren.
6. GitHub-Actions-Ergebnis kontrollieren.
7. Browser-/iPhone-Test getrennt dokumentieren; Deployment ist kein Funktionstest.
8. Supabase nur ändern, wenn die Freigabe diesen Bereich einschließt.

## Versionsregel
Version in index.html, HTML-Titel, sichtbarer Versionshinweis und Cachekennung in sw.js müssen übereinstimmen. ZIP-Artefakte enthalten ausschließlich die geprüfte index.html.
