#!/usr/bin/env python3
"""Read-only probes for non-PEGELONLINE BSH measurement providers."""
import csv, io, json, re, sys, urllib.error, urllib.parse, urllib.request
from html.parser import HTMLParser
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

BSH_URL = "https://gdi.bsh.de/ldproxy/rest/services/WaterLevelForecast/collections/waterlevelforecastdata/items?limit=500&f=json"
OUT = Path("audit-output")
MAX_RESPONSE_BYTES = 50_000_000

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent":"TidenUhr-External-Pegel-Audit/1.0","Accept":"application/json,text/csv,text/html,*/*"})
    with urllib.request.urlopen(req, timeout=35) as r:
        body = r.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise RuntimeError(f"Antwort überschreitet Sicherheitsgrenze von {MAX_RESPONSE_BYTES} Bytes: {url}")
        return r.status, r.geturl(), r.headers.get("Content-Type",""), body

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


def inspect_csv(url):
    """Read CSV rows and validate recognizable timestamp and water-level columns."""
    base = inspect(url)
    if base.get("status") != "CSV_OR_TEXT":
        return {**base, "csvValidation": "NOT_CSV"}
    try:
        _, _, ctype, body = get(url)
        try:
            content = body.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = body.decode("cp1252")
        sample = content[:12000]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
        except csv.Error:
            dialect = csv.excel
            dialect.delimiter = ";" if sample.count(";") >= sample.count(",") else ","
        rows = list(csv.reader(io.StringIO(content), dialect))
        rows = [r for r in rows if any(cell.strip() for cell in r)]
        if len(rows) < 2:
            return {**base, "csvValidation": "NO_DATA_ROWS", "rowCount": max(0, len(rows)-1)}
        header = [c.strip() for c in rows[0]]
        norm = [re.sub(r"[^a-z0-9]+", "", h.lower()) for h in header]
        time_tokens = ("datumzeit", "zeitstempel", "timestamp", "messzeit", "zeit", "date")
        level_tokens = ("wasserstand", "wasserhoehe", "wasserstandcm", "wasserstandm",
                        "waterlevel", "level", "pegel", "w")
        time_idx = next((i for i,n in enumerate(norm) if any(t in n for t in time_tokens)), None)
        level_idx = next((i for i,n in enumerate(norm) if any(t in n for t in level_tokens)), None)

        def parse_time(value):
            value = value.strip()
            if not value:
                return None
            candidate = value.replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                for fmt in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M",
                            "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
                            "%d.%m.%Y", "%Y-%m-%d"):
                    try:
                        return datetime.strptime(value, fmt)
                    except ValueError:
                        pass
            return None

        def parse_number(value):
            value = value.strip().replace(" ", "")
            if not value:
                return None
            if "," in value and "." in value:
                value = value.replace(".", "").replace(",", ".") if value.rfind(",") > value.rfind(".") else value.replace(",", "")
            elif "," in value:
                value = value.replace(",", ".")
            try:
                return float(value)
            except ValueError:
                return None

        data_rows = rows[1:]
        time_values = [parse_time(row[time_idx]) for row in data_rows if time_idx is not None and len(row) > time_idx]
        level_values = [parse_number(row[level_idx]) for row in data_rows if level_idx is not None and len(row) > level_idx]
        valid_times = [v for v in time_values if v is not None]
        valid_levels = [v for v in level_values if v is not None]
        latest = max(valid_times).isoformat() if valid_times else None
        if time_idx is None or level_idx is None:
            state = "CSV_SCHEMA_UNRECOGNIZED"
        elif not valid_times or not valid_levels:
            state = "CSV_NO_VALID_MEASUREMENTS"
        else:
            state = "CSV_MEASUREMENTS_OK"
        return {**base, "csvValidation": state, "delimiter": dialect.delimiter,
                "header": header, "rowCount": len(data_rows),
                "timestampColumn": header[time_idx] if time_idx is not None else None,
                "validTimestampCount": len(valid_times),
                "latestTimestamp": latest,
                "waterLevelColumn": header[level_idx] if level_idx is not None else None,
                "validWaterLevelCount": len(valid_levels),
                "sampleWaterLevels": valid_levels[:3]}
    except Exception as e:
        return {**base, "csvValidation": "CSV_PARSE_ERROR", "parseError": str(e)[:240]}

class PageLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts=[]
        self.links=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag.lower()=="script" and a.get("src"): self.scripts.append(a["src"])
        if tag.lower()=="a" and a.get("href"): self.links.append(a["href"])

def inspect_mv_page(url):
    result={"page":inspect(url),"scripts":[],"fullRecordLinks":[]}
    try:
        _, final, _, body=get(url)
        parser=PageLinks()
        parser.feed(body.decode("utf-8",errors="replace"))
        for src in parser.scripts:
            absolute=urllib.parse.urljoin(final,src)
            if urllib.parse.urlsplit(absolute).netloc==urllib.parse.urlsplit(final).netloc:
                info=inspect(absolute)
                entry={"url":absolute,"http":info.get("http"),"contentType":info.get("contentType"),"bytes":info.get("bytes"),"status":info.get("status")}
                if "/data/" in urllib.parse.urlsplit(absolute).path and info.get("http")==200:
                    try:
                        _, script_final, script_type, script_body=get(absolute)
                        source=script_body.decode("utf-8-sig",errors="replace")
                        row_pattern=re.compile(r"\[\s*new\s+Date\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]")
                        parsed=[]
                        for match in row_pattern.finditer(source):
                            try:
                                stamp=datetime.strptime(match.group(1), "%Y/%m/%d %H:%M")
                                parsed.append((stamp,float(match.group(2)),float(match.group(3))))
                            except ValueError:
                                continue
                        timestamps=[r[0] for r in parsed]
                        timestamp_counts=Counter(timestamps)
                        positive_deltas=[int((timestamps[i]-timestamps[i-1]).total_seconds()/60) for i in range(1,len(timestamps)) if (timestamps[i]-timestamps[i-1]).total_seconds()>0]
                        delta_counts=Counter(positive_deltas)
                        modal_interval=delta_counts.most_common(1)[0][0] if delta_counts else None
                        gaps=[]
                        out_of_order=sum(1 for i in range(1,len(timestamps)) if timestamps[i]<timestamps[i-1])
                        for i in range(1,len(timestamps)):
                            delta=int((timestamps[i]-timestamps[i-1]).total_seconds()/60)
                            if modal_interval and delta>modal_interval:
                                gaps.append({"from":timestamps[i-1].isoformat(),"to":timestamps[i].isoformat(),"minutes":delta,
                                             "expectedSlotsMissing":max(0,round(delta/modal_interval)-1) if delta % modal_interval==0 else None})
                        entry["dataInspection"]={
                            "finalUrl":script_final,"contentType":script_type,"characters":len(source),
                            "lineCount":source.count("\\n")+1,
                            "recordCount":len(parsed),
                            "duplicateTimestampCount":sum(n-1 for n in timestamp_counts.values() if n>1),
                            "outOfOrderCount":out_of_order,
                            "modalIntervalMinutes":modal_interval,
                            "intervalDistributionMinutes":{str(k):v for k,v in delta_counts.most_common(8)},
                            "gapCountAboveModalInterval":len(gaps),
                            "largestGaps":sorted(gaps,key=lambda g:g["minutes"],reverse=True)[:10],
                            "firstTimestamp":min((r[0] for r in parsed),default=None).isoformat() if parsed else None,
                            "latestTimestamp":max((r[0] for r in parsed),default=None).isoformat() if parsed else None,
                            "firstRecords":[[r[0].isoformat(),r[1],r[2]] for r in parsed[:3]],
                            "lastRecords":[[r[0].isoformat(),r[1],r[2]] for r in parsed[-3:]],
                            "zeroFirstValueCount":sum(1 for r in parsed if r[1]==0),
                            "firstValueRange":[min((r[1] for r in parsed),default=None),max((r[1] for r in parsed),default=None)],
                            "secondValueRange":[min((r[2] for r in parsed),default=None),max((r[2] for r in parsed),default=None)],
                            "sourceStart":source[:9000]
                        }
                        markers=[]
                        patterns=(r"new\\s+Date\\s*\\(",r"Date\\.UTC\\s*\\(",r"timestamp",r"\\bdata\\s*=",r"Dygraph",r"20[0-9]{2}[-/.][0-9]{1,2}[-/.][0-9]{1,2}")
                        for pattern in patterns:
                            match=re.search(pattern,source,re.I)
                            if match:
                                a=max(0,match.start()-220); b=min(len(source),match.end()+520)
                                markers.append({"pattern":pattern,"excerpt":source[a:b]})
                        entry["dataInspection"]["markerContexts"]=markers
                    except Exception as e:
                        entry["dataInspectionError"]=str(e)[:240]
                result["scripts"].append(entry)
        for href in parser.links:
            absolute=urllib.parse.urljoin(final,href)
            if "voll" in absolute.lower() or "datensatz" in absolute.lower(): result["fullRecordLinks"].append(absolute)
        result["fullRecordLinks"]=list(dict.fromkeys(result["fullRecordLinks"]))
    except Exception as e: result["inspectionError"]=str(e)[:240]
    return result

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
        if x["provider"]=="Pegelportal MV":
            item["mvInspection"]=inspect_mv_page(x["sourceUrl"])
        if x["provider"]=="HSI-SH":
            candidates=re.findall(r"(?<!\d)(\d{5,7})(?!\d)",x["sourceUrl"]) or re.findall(r"(?<!\d)(\d{5,7})(?!\d)",x["operatorId"])
            if candidates:
                sid=candidates[-1]
                item["stationId"]=sid
                item["data"]={
                    "json":inspect("https://hsi-sh.de/pegel/od/"+sid+"_w_messwerte.json"),
                    "csv":inspect_csv("https://hsi-sh.de/pegel/download/"+sid+"_w_messwerte.csv")}
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
        if data and "json" in data: detail="JSON "+data["json"]["status"]+"; CSV "+data["csv"].get("csvValidation", data["csv"]["status"])+" ("+str(data["csv"].get("validTimestampCount", 0))+" Zeitstempel, "+str(data["csv"].get("validWaterLevelCount", 0))+" Wasserstände)"
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
