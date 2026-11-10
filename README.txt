BSH-Jahresdateien – Hinweise zum produktiven TidenUhr-Repository
=====================================================================

Produktiver Stand: v47.54
Repository: 62jntnb98f-bot/TidenUhr
Branch: main

Die gebündelten JSON-Jahresdateien liegen im Repository-Hauptverzeichnis:
- DE__510P2026.json
- DE__632P2026.json
- KIEL-HOLTENAU2026.json

Die dazugehörigen Metadaten stehen in stations.json und catalog.json.
Die relativen Dateipfade in diesen Dateien müssen mit den tatsächlichen
Dateipositionen im GitHub-Repository übereinstimmen.

Wichtiger Hinweis
----------------
Ältere Importanleitungen verwiesen auf tools/update_bsh.py und einen
data/-Unterordner. Diese Pfade gehören nicht zur aktuellen Dateistruktur
des produktiven Repositorys und dürfen nicht als aktuelle Arbeitsanleitung
verwendet werden.

Die produktiven Supabase-BSH-Archivdaten sind separat. Eine Aktualisierung
dieser statischen Repository-Dateien verändert das Supabase-Archiv nicht.
