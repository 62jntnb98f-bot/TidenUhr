# TidenUhr – Projektdokumentation

**Produktiver Stand: v47.43**  
**Repository:** 62jntnb98f-bot/TidenUhr  
**Produktiver Branch:** main  
**Startdatei:** index.html

## Aktuelle Architektur

TidenUhr ist eine browserbasierte Progressive Web App für iPhone, Android und Desktop-Browser.

### Datenquellen
- **BSH:** Gezeitenvorausberechnungen (Hoch- und Niedrigwasser) und importierte BSH-TXT-Dateien.
- **PEGELONLINE / WSV:** aktuelle Wasserstände und Messreihen.
- **PEGELONLINE-WV:** Wasserstandsvorhersagen, sofern verfügbar.
- **HSI-SH:** ergänzende Wasserstandsdaten.
- **Supabase BSH-Archiv:** archivierte BSH-Jahresdateien; getrennt von den statischen GitHub-Dateien.

### Stationslogik
- Nordsee: BSH-Gezeiten und Wasserstandsdaten werden quellengetrennt behandelt.
- Ostsee: reine Wasserstandsmessstellen erhalten keine erfundenen HW/NW-Ereignisse.
- Kiel-Holtenau ist mit PEGELONLINE/WSV-Messstelle 9610066 verknüpft.
- BSH-Wasserstandsvorhersage und PEGELONLINE-WV werden getrennt behandelt.

### Produktive Dateien
- `index.html`: Anwendung, Versionskennung v47.43.
- `sw.js`: Service Worker, Cachekennung `tiden-v47-43-2026`.
- `manifest.webmanifest`: PWA-Metadaten.
- `stations.json`, `catalog.json`: Stations- und Jahresdatei-Metadaten.
- `DE__510P2026.json`, `DE__632P2026.json`, `KIEL-HOLTENAU2026.json`: Jahresdateien im Repository-Hauptverzeichnis.
- `audit-data/bsh-stations-172.json`: BSH-Stammdaten und dokumentierte Zuordnungsprüfung.

### Pfadregel
Die genannten Jahresdateien und `stations.json` liegen im Repository-Hauptverzeichnis. Ein `data/`-Unterordner wird nicht vorausgesetzt. Metadaten, Fallback-Lader und Service Worker müssen dieselben relativen Pfade verwenden.

### Grundsätze
- Keine erfundenen Tidewerte.
- BSH- und PEGELONLINE-Daten bleiben als getrennte Quellen erkennbar.
- Supabase-Archivdaten werden nicht durch Änderungen an statischen GitHub-Dateien verändert.
- Änderungen an produktiven Daten oder Zuordnungen erfolgen nur nach ausdrücklicher Freigabe.

## Historische Entwicklungshinweise

Die folgenden Abschnitte der früheren Projektdokumentation beschreiben Entwicklungsstände v39 bis v45. Sie sind als historische Chronik erhalten und nicht als Beschreibung des aktuellen Funktionsumfangs oder Versionsstands zu verstehen.
