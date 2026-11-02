#!/usr/bin/env python3
"""Read-only probes for non-PEGELONLINE BSH measurement providers."""
import json, re, sys, urllib.error, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

BSH_URL = "https://gdi.bsh.de/ldproxy/rest/services/WaterLevelForecast/collections/waterlevelforecastdata/items?limit=500&f=json"
OUT = Path("audit-output")
LIMIT = 2_000_000

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent":"TidenUhr-External-Pegel-Audit/1.0","Accept":"application/json,text/csv,text/html,*/*"})
    with urllib.request.urlopen(req, timeout=35) as r:
        body = r.read(LIMIT + 1)
        return r.status, r.geturl(), r.headers.get("Content-Type",""), body[:LIMIT]

def inspect(url):
    try:
        code, final, ctype, body = get(url)
        sample = body[:1200].decode("utf-8", errors="replace").lstrip()
        low = sample.lower()
        if "json" in ctype.lower() or low.startswith(("{","[")):
            try:
                obj = json.loads(body.decode("utf-8-sig"))
                count = len(obj) if isinstance(obj,list) else len(obj.get("features",obj.get("data",[]))) if isinstance(obj,dict) else 1
                state, detail = "JSON_OK", "JSON lesbar; oberste Einträge/Features: " + str(count)
            except Exception as e:
                state, detail = "JSON_INVALID", str(e)[:180]
        elif "csv" in ctype.lower() or (";" in sample and "\n" in sample):
            state, detail = "CSV_OR_TEXT", "Nichtleere CSV/Textantwort"
        elif "<html" in low or "<!doctype" in low:
            state, detail = "HTML_ONLY", "HTML-Seite erreichbar; Messdatenformat nicht bestätigt"
        else:
            state, detail = ("TEXT_OK","Nichtleere Textantwort") if body else ("EMPTY","Leere Antwort")
        return {"url":url,"http":code,"finalUrl":final,"contentType":ctype,"bytes":len(body),"status":state,"detail":detail}
    except urllib.error.HTTPError as e:
        return {"url":url,"http":e.code,"status":"HTTP_ERROR","detail":str(e)[:200]}
    except Exception as e:
        return {"url":url,"status":"FETCH_ERROR","detail":str(e)[:200]}

def provider(host):
    h=(host or "").lower()
    if "pegelportal-mv.de" in h or "fis-wasser-mv.de" in h: return "Pegelportal MV"
    if "hsi-sh.de" in h or "lfu.landsh.de" in h: return "HSI-SH"
    if "nlwkn.niedersachsen.de" in h: return "NLWKN"
    return "Sonstige"

def main():
    print("Lade BSH-Wasserstandsprognose …")
    _,_,_,body=get(BSH_URL)
    bsh=json.loads(body.decode("utf-8"))
    refs=[]; seen=set()
    for f in bsh.get("features",[]):
        p=f.get("properties") or {}
        raw=str(p.get("measurement_url") or "").strip()
        if not raw: continue
        u=urllib.parse.urlsplit(raw); host=(u.hostname or "").lower()
        if not host or host=="www.pegelonline.wsv.de" or (host,raw) in seen: continue
        seen.add((host,raw))
        refs.append({"station":str(p.get("gauge_label") or ""),"operatorId":str(p.get("operator_gauge_id") or ""),
                     "provider":provider(host),"host":host,"sourceUrl":raw})
    if not refs: raise RuntimeError("Keine externen Referenzen gefunden.")
    results=[]
    for x in refs:
        print("Prüfe",x["provider"],x["station"])
        direct=inspect(x["sourceUrl"])
        item={**x,"direct":direct,"data":None}
        if x["provider"]=="HSI-SH":
            candidates=re.findall(r"(?<!\d)(\d{5,7})(?!\d)",x["sourceUrl"]) or re.findall(r"(?<!\d)(\d{5,7})(?!\d)",x["operatorId"])
            if candidates:
                sid=candidates[-1]
                item["stationId"]=sid
                item["data"]={
                    "json":inspect("https://hsi-sh.de/pegel/od/"+sid+"_w_messwerte.json"),
                    "csv":inspect("https://hsi-sh.de/pegel/download/"+sid+"_w_messwerte.csv")}
            else:
                item["data"]={"status":"NO_STATION_ID","detail":"Keine eindeutige HSI-Stationsnummer aus BSH-Referenz ermittelbar"}
        results.append(item)
    pc=defaultdict(Counter)
    for x in results:
        if x["data"] and "json" in x["data"]:
            states=[x["data"]["json"]["status"],x["data"]["csv"]["status"]]
            state="DATA_ENDPOINT_OK" if any(s in ("JSON_OK","CSV_OR_TEXT") for s in states) else "DATA_ENDPOINT_UNCONFIRMED"
        elif x["data"]: state=x["data"]["status"]
        else: state=x["direct"]["status"]
        pc[x["provider"]][state]+=1
        x["overall"]=state
    now=datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    report={"auditVersion":1,"checkedAtUtc":now,"bshTimestamp":bsh.get("timeStamp"),"referenceCount":len(results),
            "providerCounts":{k:dict(v) for k,v in pc.items()},"stations":results,
            "policy":"Read-only GET. Exact BSH measurement_url is tested. HSI CSV/JSON paths are derived only from an explicit station number. No guessed MV/NLWKN API paths; no name/coordinate matching; no write operations."}
    OUT.mkdir(exist_ok=True)
    (OUT/"bsh-external-provider-audit.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    lines=["# BSH – externe Wasserstandsdatenquellen","",f"- Prüfung UTC: {now}",f"- BSH-Datenstand: {bsh.get('timeStamp')}",f"- Referenzen: {len(results)}","","| Station | Anbieter | Direkt-HTTP | Datentest | Status |","|---|---|---:|---|---|"]
    for x in results:
        data=x["data"]
        if data and "json" in data: detail="JSON "+data["json"]["status"]+"; CSV "+data["csv"]["status"]
        elif data: detail=data["status"]
        else: detail="kein separater Datenendpunkt getestet"
        lines.append("| "+x["station"]+" | "+x["provider"]+" | "+str(x["direct"].get("http","-"))+" | "+detail+" | "+x["overall"]+" |")
    lines += ["","## Grenzen","- HTTP 200 einer HTML-Seite bestätigt keine Messdatenabfrage.","- Für MV und NLWKN werden keine unbelegten API-Pfade konstruiert.","- Ausschließlich lesende GET-Abfragen; keine Änderungen an App oder Supabase.",""]
    (OUT/"bsh-external-provider-audit.md").write_text("\n".join(lines),encoding="utf-8")
    for p,c in sorted(pc.items()): print(p,dict(c))
    print("Berichte geschrieben.")

if __name__=="__main__":
    try: main()
    except Exception as e:
        print("FEHLER:",str(e),file=sys.stderr); sys.exit(1)
