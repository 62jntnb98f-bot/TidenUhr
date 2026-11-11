#!/usr/bin/env python3
"""Read-only audit of BSH water-forecast measurement_url references against PEGELONLINE."""
from __future__ import annotations
import json, os, sys, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BSH_URL = "https://gdi.bsh.de/ldproxy/rest/services/WaterLevelForecast/collections/waterlevelforecastdata/items?limit=500&f=json"
PO_URL = "https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json"
EXPECTED_BASELINE = 72
OUT = Path(os.environ.get("AUDIT_OUT", "audit-output"))

def fetch_json(url):
    req = urllib.request.Request(url, headers={"Accept":"application/geo+json, application/json","User-Agent":"TidenUhr-BSH-PEGELONLINE-Audit/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        if response.status != 200: raise RuntimeError(f"HTTP {response.status} für {url}")
        return json.loads(response.read().decode("utf-8"))

def txt(value):
    return "" if value is None else str(value).strip()

def parse_ref(feature):
    p = feature.get("properties") or {}
    raw = txt(p.get("measurement_url"))
    if not raw: return None
    u = urllib.parse.urlsplit(raw)
    if (u.hostname or "").lower() != "www.pegelonline.wsv.de": return None
    q = urllib.parse.parse_qs(u.query)
    fragment_query = u.fragment.partition("?")[2]
    f = urllib.parse.parse_qs(fragment_query)
    number = txt((q.get("pegelnr") or [""])[0])
    uuid = txt((f.get("id") or [""])[0])
    operator = txt(p.get("operator_gauge_id"))
    if not number and not uuid and not operator: return None
    return {
        "bshGaugeLabel":txt(p.get("gauge_label")), "region":txt(p.get("region")),
        "area":txt(p.get("area")), "state":txt(p.get("state")),
        "operatorGaugeId":operator, "pegelonlineNumber":number,
        "pegelonlineUuid":uuid, "measurementUrl":raw
    }

def main():
    print("Lade aktuellen BSH-Wasserstandsprognose-Datensatz …")
    bsh = fetch_json(BSH_URL)
    features = bsh.get("features")
    if not isinstance(features, list): raise RuntimeError("BSH-Antwort enthält kein gültiges Feld 'features'.")
    refs = [r for f in features if (r := parse_ref(f)) is not None]
    if not refs: raise RuntimeError("Keine PEGELONLINE measurement_url-Referenzen im BSH-Datensatz.")
    print("Lade aktuellen PEGELONLINE-Stationskatalog …")
    po = fetch_json(PO_URL)
    if not isinstance(po, list): raise RuntimeError("PEGELONLINE-Antwort ist keine Stationsliste.")
    by_uuid, by_number = defaultdict(list), defaultdict(list)
    for s in po:
        u, n = txt(s.get("uuid")), txt(s.get("number"))
        if u: by_uuid[u].append(s)
        if n: by_number[n].append(s)
    results = []
    for ref in refs:
        uuid, number, operator = ref["pegelonlineUuid"], ref["pegelonlineNumber"], ref["operatorGaugeId"]
        uh, nh = by_uuid.get(uuid, []) if uuid else [], by_number.get(number, []) if number else []
        actual = uh[0] if uh else None
        actual_number = txt(actual.get("number")) if actual else ""
        if operator and number and operator != number:
            status, detail = "KONFLIKT_BSH_NUMMER", "BSH operator_gauge_id und URL-pegelnr weichen ab."
        elif len(uh) > 1:
            status, detail = "KONFLIKT_UUID_MEHRFACH", "UUID kommt mehrfach im PEGELONLINE-Katalog vor."
        elif actual:
            if actual_number == number:
                status, detail = "STIMMT", "UUID und Pegelnummer stimmen überein."
            else:
                status, detail = "KONFLIKT_UUID_NUMMER", f"UUID gefunden, Katalognummer {actual_number or 'leer'} statt {number or 'leer'}."
        elif nh:
            other = sorted({txt(s.get("uuid")) for s in nh if txt(s.get("uuid"))})
            status, detail = "KONFLIKT_NUMMER_ANDERE_UUID", "Nummer mit anderer UUID gefunden: " + ", ".join(other)
        else:
            status, detail = "NICHT_GEFUNDEN", "Weder UUID noch Pegelnummer im aktuellen PEGELONLINE-Katalog gefunden."
        results.append({
            **ref, "status":status, "detail":detail, "catalogNumber":actual_number or None,
            "catalogShortname":txt(actual.get("shortname")) or None if actual else None,
            "catalogLongname":txt(actual.get("longname")) or None if actual else None,
            "catalogUuidMatches":len(uh), "catalogNumberMatches":len(nh)
        })
    counts = defaultdict(int)
    for x in results: counts[x["status"]] += 1
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    report = {
        "auditVersion":1, "checkedAtUtc":now,
        "sources":{"bshUrl":BSH_URL,"bshTimestamp":bsh.get("timeStamp"),
                   "bshNumberReturned":bsh.get("numberReturned"),"bshNumberMatched":bsh.get("numberMatched"),
                   "pegelonlineUrl":PO_URL,"pegelonlineStationCount":len(po)},
        "baselineExpectedReferences":EXPECTED_BASELINE,"referencesFoundInCurrentBshSource":len(refs),
        "baselineCountChanged":len(refs)!=EXPECTED_BASELINE,"summary":dict(sorted(counts.items())),
        "stations":results,
        "matchingPolicy":"UUID ist Identitätsschlüssel; Pegelnummer zusätzliche Kontrolle. Keine Namens-, Fuzzy- oder Koordinatenzuordnung."
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/"bsh-pegelonline-audit.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    lines = ["# BSH ↔ PEGELONLINE – Prüfergebnis","",f"- Prüfzeitpunkt UTC: {now}",
             f"- BSH-Datenstand: {bsh.get('timeStamp') or 'nicht angegeben'}",
             f"- BSH-Referenzen: {len(refs)} (Ausgangsstand: {EXPECTED_BASELINE})",
             f"- PEGELONLINE-Katalogeinträge: {len(po)}","","## Zusammenfassung","","| Status | Anzahl |","|---|---:|"]
    for k,v in sorted(counts.items()): lines.append(f"| {k} | {v} |")
    if len(refs)!=EXPECTED_BASELINE:
        lines += ["",f"> Hinweis: Die Anzahl weicht vom Ausgangsstand {EXPECTED_BASELINE} ab. Das ist ein Prüfhinweis, kein automatischer Fehler."]
    lines += ["","## Einzelprüfung","","| BSH-Station | BSH-ID | PO-Nummer | UUID | Status | Katalogname | Erläuterung |",
              "|---|---:|---:|---|---|---|---|"]
    for x in results:
        clean = lambda v: (v or "").replace("|","\\|")
        pname = x["catalogLongname"] or x["catalogShortname"] or ""
        lines.append(f"| {clean(x['bshGaugeLabel'])} | {clean(x['operatorGaugeId'])} | {clean(x['pegelonlineNumber'])} | {clean(x['pegelonlineUuid'])} | **{x['status']}** | {clean(pname)} | {clean(x['detail'])} |")
    lines += ["","## Prüfregeln","",
              "- UUID ist der Identitätsschlüssel; Pegelnummer wird zusätzlich kontrolliert.",
              "- Namen dienen nur der Sichtprüfung; keine automatische Namenszuordnung.",
              "- Keine Fuzzy-Suche und keine Zuordnung über geografische Nähe.",
              "- Ausschließlich lesender Zugriff auf öffentliche Quellen; keine Rückschreibevorgänge.",""]
    (OUT/"bsh-pegelonline-audit.md").write_text("\n".join(lines),encoding="utf-8")
    print(f"BSH-Referenzen: {len(refs)}; PEGELONLINE-Stationen: {len(po)}")
    for k,v in sorted(counts.items()): print(f"{k}: {v}")
    print(f"Berichte geschrieben nach {OUT}")

if __name__ == "__main__":
    try: main()
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"FEHLER: {exc}",file=sys.stderr); sys.exit(1)
