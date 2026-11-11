#!/usr/bin/env python3
"""Read-only batch audit of 172 BSH stations for 2026/2027."""
import csv, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "audit-data" / "bsh-stations-172.json"
OUT = ROOT / "audit-output"
YEARS = (2026, 2027)
PROJECT = "https://hqdoufaiuslwnqwnrltc.supabase.co/functions/v1"
ORIGIN = "https://62jntnb98f-bot.github.io"
CATALOG_URL = PROJECT + "/bsh-archiv-katalog"
CHECK_URL = PROJECT + "/bsh-direktdownload-pruefen"
TIMEOUT = 40

def request_json(url, method="GET", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Accept":"application/json", "User-Agent":"TidenUhr-BSH-172-Audit/1.0", "Origin":ORIGIN}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        raw = response.read(2_000_000)
        return response.status, json.loads(raw.decode("utf-8-sig"))

def load_archive():
    items, offset, total = [], 0, None
    while total is None or offset < total:
        status, data = request_json(CATALOG_URL + "?" + urllib.parse.urlencode({"limit":100,"offset":offset}))
        if status != 200 or not isinstance(data.get("items"), list):
            raise RuntimeError("Archivkatalog lieferte keine gültige Liste.")
        items.extend(data["items"])
        total = int(data.get("total", len(items)))
        offset += len(data["items"])
        if not data["items"]:
            break
    return items

def check_one(gauge, year, archived):
    code = gauge["bshnr"]
    record = {
        "station": gauge["station_name"], "station_code":code,
        "gauge_group":gauge["gauge_group"], "year":year,
        "archive": "ARCHIVIERT" if (code,year) in archived else "NICHT_ARCHIVIERT",
        "direct_download":"NICHT_GEPRUEFT", "reason":""
    }
    if (code,year) in archived:
        record["reason"] = "Archivdatei vorhanden; Direktdownload nicht erneut erforderlich."
        return record
    if code == "632P":
        record["direct_download"] = "SONDERFALL_MAIL"
        record["reason"] = "Wyk auf Föhr: bekannter Sonderfall, BSH-Datei bei Bedarf per E-Mail beschaffen."
        return record
    if code == "3020P":
        record["direct_download"] = "SONDERFALL_KIEL"
        record["reason"] = "Kiel-Holtenau: Sonderbehandlung der TidenUhr; kein regulärer HW/NW-TXT-Direktdownload voraussetzen."
        return record
    try:
        status, data = request_json(CHECK_URL, method="POST", payload={"stationCode":code,"year":year})
        if status != 200:
            record["direct_download"] = "PRUEFUNG_FEHLGESCHLAGEN"
            record["reason"] = "Prüffunktion HTTP " + str(status)
        elif data.get("available") is True and data.get("confirmed") is True:
            record["direct_download"] = "VERFUEGBAR"
            record["reason"] = "Gültige BSH-Datei bestätigt; VB2-Datensätze: " + str(data.get("vb2Records","?"))
        elif data.get("confirmed") is True and data.get("reason") == "NO_DIRECT_FILE":
            record["direct_download"] = "KEINE_DATEI_BESTAETIGT"
            record["reason"] = data.get("message","Keine Datei am geprüften BSH-Pfad.")
        else:
            record["direct_download"] = "NICHT_EINDEUTIG"
            record["reason"] = str(data.get("reason") or data.get("message") or "Antwort nicht eindeutig.")
    except urllib.error.HTTPError as exc:
        record["direct_download"] = "PRUEFUNG_FEHLGESCHLAGEN"
        record["reason"] = "HTTP-Fehler " + str(exc.code)
    except Exception as exc:
        record["direct_download"] = "PRUEFUNG_FEHLGESCHLAGEN"
        record["reason"] = type(exc).__name__ + ": " + str(exc)[:180]
    time.sleep(0.15)
    return record

def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    gauges = catalog["gauges"]
    if len(gauges) != 172 or len({g["bshnr"] for g in gauges}) != 172:
        raise RuntimeError("Stationsverzeichnis ist nicht exakt 172 Stationen mit eindeutigen Kennungen.")
    print("Lese produktiven Archivkatalog (GET, keine Änderungen) …")
    archive_items = load_archive()
    archived = {(str(x["station_code"]), int(x["datenjahr"])) for x in archive_items
                if x.get("archiv_status") == "archiviert"}
    print("Archivdatensätze:", len(archive_items), "| eindeutige Station/Jahr-Paare:", len(archived))
    jobs = [(g,y) for g in gauges for y in YEARS]
    results = []
    print("Prüfe", len(jobs), "Station/Jahr-Kombinationen; maximal 2 gleichzeitige BSH-Prüfungen …")
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(check_one,g,y,archived) for g,y in jobs]
        for i,future in enumerate(as_completed(futures),1):
            results.append(future.result())
            if i % 25 == 0 or i == len(futures):
                print("Fortschritt:", i, "/", len(futures))
    results.sort(key=lambda x:(x["station"],x["year"]))
    OUT.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    summary = {}
    for row in results:
        key = row["archive"] + " / " + row["direct_download"]
        summary[key] = summary.get(key,0)+1
    report = {"checkedAtUtc":stamp,"catalogSource":catalog.get("source"),
              "catalogSnapshotCommit":catalog.get("sourceSnapshotCommit"),
              "stationCount":len(gauges),"years":list(YEARS),"combinationCount":len(results),
              "archiveMetadataRows":len(archive_items),"summary":summary,"results":results,
              "policy":"Read-only GET archive catalogue and POST validator; validator performs BSH GET only. No upload, deletion, database write, app or service-worker change."}
    (OUT/"bsh-172-audit.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    with (OUT/"bsh-172-audit.csv").open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=list(results[0].keys()),delimiter=";")
        writer.writeheader(); writer.writerows(results)
    lines=["# BSH-172-Prüfung","",f"- Prüfzeitpunkt UTC: {stamp}",f"- Messstellen: {len(gauges)}",
           f"- Station/Jahr-Prüfungen: {len(results)}",f"- Archivdatensätze gelesen: {len(archive_items)}","","## Ergebnisübersicht","","| Archiv | Direktdownload | Kombinationen |","|---|---|---:|"]
    for key,count in sorted(summary.items()):
        a,d=key.split(" / ",1); lines.append(f"| {a} | {d} | {count} |")
    lines += ["","## Einzelheiten","","| Station | Kennung | Jahr | Archiv | Direktdownload | Hinweis |","|---|---|---:|---|---|---|"]
    for r in results:
        clean=lambda s:str(s).replace("|","\\|").replace("\n"," ")
        lines.append("| "+ " | ".join(clean(r[k]) for k in ("station","station_code","year","archive","direct_download","reason"))+" |")
    lines += ["","## Grenzen","- Ein bestätigter Download bedeutet: Datei am geprüften BSH-Pfad vorhanden und Dateikopf/Datensätze plausibel; keine inhaltliche nautische Qualitätsbewertung.",
              "- 'Keine Datei bestätigt' gilt nur für den geprüften BSH-Pfad und das konkrete Jahr.",
              "- Sonderfälle Wyk auf Föhr und Kiel-Holtenau werden nicht durch eine generische Pfadprüfung falsch klassifiziert.",
              "- Ausschließlich lesende Abfragen; keine Archivierung und keine Änderungen an TidenUhr, Supabase-Daten oder Service Worker.",""]
    (OUT/"bsh-172-audit.md").write_text("\n".join(lines),encoding="utf-8")
    print("Fertig. Berichte liegen in audit-output/.")

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print("AUDIT FEHLGESCHLAGEN:",repr(exc),file=sys.stderr)
        sys.exit(1)
