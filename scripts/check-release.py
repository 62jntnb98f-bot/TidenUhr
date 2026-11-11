#!/usr/bin/env python3
"""Read-only consistency checks for the TidenUhr release."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
html_path = root / "index.html"
sw_path = root / "sw.js"
errors = []

if not html_path.is_file() or not sw_path.is_file():
    print("FEHLER: index.html oder sw.js fehlt.")
    sys.exit(1)

html = html_path.read_text(encoding="utf-8")
sw = sw_path.read_text(encoding="utf-8")
match = re.search(r"""const\s+TIDENUHR_VERSION\s*=\s*["']([0-9]+(?:\.[0-9]+)+)["']""", html)
version = match.group(1) if match else None
if not version:
    errors.append("TIDENUHR_VERSION fehlt.")
else:
    if not re.search(rf"<title>[^<]*v{re.escape(version)}\s*[·|]", html):
        errors.append(f"HTML-Titel enthält nicht v{version}.")
    if not re.search(rf'data-app-version[^>]*>\s*{re.escape(version)}\s*</', html):
        errors.append(f"Sichtbare Versionskennung enthält nicht {version}.")
    cache_version = version.replace(".", "-")
    if not re.search(rf"""const\s+CACHE\s*=\s*['"]tiden-v{re.escape(cache_version)}-[^'"]+['"]""", sw):
        errors.append(f"Service-Worker-Cachekennung passt nicht zu v{version}.")

if "async function loadCatalog()" not in html:
    errors.append("loadCatalog() fehlt.")
if 'params.set("offset", String(offset))' not in html:
    errors.append("Archiv-Offset-Paginierung fehlt.")
if "rawItems.push(...data.items)" not in html:
    errors.append("Zusammenführung der Archivseiten fehlt.")
if "offset < total" not in html:
    errors.append("Vollständigkeitsprüfung des Archivkatalogs fehlt.")

if errors:
    print("TidenUhr Release-Check: FEHLGESCHLAGEN")
    for error in errors:
        print("- " + error)
    sys.exit(1)

print("TidenUhr Release-Check: OK – v" + version)
print("Geprüft: Titel, sichtbare Version, Service-Worker-Cache und Archiv-Paginierung.")
