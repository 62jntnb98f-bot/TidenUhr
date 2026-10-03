Neue BSH-Jahresdateien hier ablegen:

DE__<Pegelnummer><Jahr>.txt

Danach im Projektordner ausführen:

python tools/update_bsh.py --incoming

Der Import prüft Metadaten, HW/NW-Ereignisse und Chronologie und erzeugt die JSON-Datei sowie catalog.json neu.

Hinweis: Die BSH-Website bietet die Standard-TXT-Dateien zum Download an. TidenUhr umgeht keine Download-Freischaltung oder Nutzungsbedingungen des BSH; die vom BSH bereitgestellte Datei wird anschließend automatisch importiert.
