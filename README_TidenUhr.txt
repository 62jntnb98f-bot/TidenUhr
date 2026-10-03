TidenUhr v45
====================

Projekt
-------
TidenUhr ist eine browserbasierte Progressive Web App (PWA) für iPhone, Android und Desktop-Browser. Die Entwicklung und der lokale Test sind ohne Mac möglich; für einen späteren nativen iPhone-Build wird macOS/Xcode benötigt.

Datenquellen
------------
- BSH: Gezeitenvorausberechnungen (HW/NW, optional 10-Minuten-Kurve über importierte TXT-Dateien).
- PEGELONLINE / WSV: aktueller Wasserstand und Wasserstands-Zeitreihen.
- PEGELONLINE-WV: Wasserstandsvorhersage, sofern für eine Station verfügbar.
- BSH-Wasserstandsvorhersage: offizieller Webzugang für Ostsee-Wasserstände.

Stationslogik
-------------
Nordsee:
- BSH-Gezeiten werden als HW/NW angezeigt, sofern echte BSH-Daten für die Station vorhanden sind.
- PEGELONLINE liefert unabhängig davon den aktuellen Wasserstand und die Zeitreihe.

Ostsee:
- Für reine Wasserstands-Messstellen werden keine erfundenen HW/NW-Ereignisse angezeigt.
- Kiel-Holtenau ist mit PEGELONLINE/WSV Messstelle 9610066 verknüpft.
- BSH-Wasserstandsvorhersage und PEGELONLINE-WV werden getrennt behandelt.

Wichtige Grundsätze
-------------------
- Keine erfundenen Tidewerte.
- BSH- und PEGELONLINE-Daten bleiben als getrennte Quellen erkennbar.
- Offline-Verhalten verwendet zuletzt erfolgreich geladene Daten, soweit verfügbar.
- Mehrere Favoriten werden lokal gespeichert.
- Die Küstenkarte, Stationensuche, Wasserstandsverlauf, Wasserstandsvorhersage, Stationsdatenbank und der BSH-Import sind beim Start geschlossen.

V40 – Änderungen gegenüber v39
------------------------------
1. Wasserstandsvorhersage ist jetzt ein einklappbarer Bereich.
2. Stationsdatenbank wurde direkt unter die Wasserstandsvorhersage verschoben und ist ebenfalls einklappbar.
3. Wasserstand ist jetzt ein eigener einklappbarer Bereich und steht direkt unter dem Wasserstandsverlauf.
4. Die bisherige Reihenfolge der Hauptdatenbereiche wurde damit für die mobile Nutzung übersichtlicher.
5. README-Dateien wurden konsolidiert: Diese Datei ersetzt die alten versionsbezogenen README-Dateien.
6. Versionskennung auf v40 angehoben und Service-Worker-Cache auf v40 umgestellt.
7. Browser-Titel, Startskript und sichtbare Versionsanzeige verwenden v40.

V39 und vorherige Entwicklung (Kurzchronik)
--------------------------------------------
v39:
- Stationsdatenbank aus dem oberen Bereich entfernt und in den Daten-/Statusbereich verschoben.
- Küstenkarte, Stationen in meiner Nähe, Wasserstandsverlauf und BSH-Import beim Start geschlossen.
- Mehrere Favoriten und Favoriten-Menü beibehalten.
- Service-Worker auf neue Cache-Version und Network-First für die Navigation umgestellt.

v38:
- Layout des Bereichs „BSH-Tabelle öffnen“ korrigiert.
- BSH-Button in einen responsiven eigenen Bereich gesetzt.

v37:
- Mehrere Favoriten mit lokaler Speicherung.
- Favoriten-Menü im oberen Bereich.
- Einzelne Favoriten können gelöscht werden.
- Migration des früheren Einzel-Favoriten.

v35/v36:
- Stationsauswahl Nordsee/Ostsee.
- PEGELONLINE-Wasserstand für Kiel-Holtenau.
- BSH-HW/NW-Daten für vorhandene Nordsee-Stationen.
- Mobile Layout- und Cache-Verbesserungen.

Frühere Projektphasen
----------------------
- Aufbau der PWA-Grundstruktur.
- Import echter BSH-TXT-Dateien für Wyk/Föhr und Husum.
- Automatische Erkennung und Verarbeitung der BSH-HW/NW-Datensätze.
- Trennung von Tidevorausberechnung und gemessenem Wasserstand.
- Einbindung der PEGELONLINE-REST-API.


v41:
- Reihenfolge der Datenbereiche angepasst: Wasserstand → Wasserstandsvorhersage → Wasserstandsverlauf → Datenstatus → Stationsdatenbank.
- Datenstatus als auf-/zuklappbarer Bereich umgesetzt und beim Start geschlossen.
- Die übrigen Bereiche bleiben wie in v40 konfiguriert.

v42:
- Versionskennung im Anwendungscode auf v42 angehoben.
- Browser-Titel und Startskript auf v42 korrigiert.
- Service-Worker-Cache von v40 auf v42 angehoben, damit der Browser einen sauberen neuen Cache verwendet.
- Keine funktionalen Änderungen an den getesteten v41-Funktionen und Datenquellen.

Aktueller Teststand
-------------------
Version: 43
Zielplattformen: Browser/PWA, iPhone, Android
Lokaler Test unter Windows 10/Chromium: unterstützt

Hinweis
-------
Die für Kiel-Holtenau bestellten BSH-TXT-Dateien werden nach Eingang separat geprüft. Erst danach wird deren tatsächliches Format in den Import übernommen. Es werden keine Werte aus anderen Stationen als Kiel-Holtenau-Tidewerte ausgegeben.


v45:
- Versionskennung im Anwendungscode, Browser-Titel, Startskript, sichtbare Anzeige und Service-Worker-Cache auf v44 angehoben.
- Button „BSH-Originaltabelle ↗“ öffnet die offizielle BSH-Gezeitentabelle explizit in einem neuen Tab.
- Der externe BSH-Link wird stationabhängig aus der hinterlegten BSH-URL gesetzt.
- Keine Änderungen an den getesteten TidenUhr-Funktionen oder Datenquellen.
