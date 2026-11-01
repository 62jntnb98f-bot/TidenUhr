
const API='https://pegelonline.wsv.de/webservices/rest-api/v2';
const API_FALLBACK='https://m.pegelonline.wsv.de/webservices/rest-api/v2';
async function poFetch(path,options={}){
 try{
  const response=await fetch(API+path,options);
  if(!response.ok)throw Error('HTTP '+response.status);
  return response;
 }catch(error){
  // CORS-/Netzwerkfehler sind Fetch-TypeErrors. Ein zweiter Host-Aufruf
  // erzeugt bei gleicher CORS-Sperre nur einen weiteren Konsolenfehler.
  if(error instanceof TypeError)throw error;
  const response=await fetch(API_FALLBACK+path,options);
  if(!response.ok)throw Error('HTTP '+response.status);
  return response;
 }
}
let bshCatalog=[],po=[],mode='all',current=null,data=[],meta=null,selectedYear=null,poCurrent=null,coastalOnly=true;

const BSH_ARCHIVE_API='https://hqdoufaiuslwnqwnrltc.supabase.co/functions/v1';
let bshArchiveCatalogCache=null,bshArchiveCatalogPromise=null;
async function getBshArchiveCatalog(){
 if(bshArchiveCatalogCache)return bshArchiveCatalogCache;
 if(bshArchiveCatalogPromise)return bshArchiveCatalogPromise;
 bshArchiveCatalogPromise=(async()=>{
   const r=await fetch(BSH_ARCHIVE_API+'/bsh-archiv-katalog?limit=100',{method:'GET',headers:{Accept:'application/json'},cache:'no-store'});
   if(!r.ok)throw Error('BSH-Archivkatalog HTTP '+r.status);
   const j=await r.json();
   if(!j||!Array.isArray(j.items))throw Error('Ungültige Antwort des BSH-Archivkatalogs');
   bshArchiveCatalogCache=j.items.filter(x=>x&&x.id&&x.station_code&&Number.isFinite(Number(x.datenjahr))&&x.archiv_status==='archiviert');
   return bshArchiveCatalogCache;
 })().catch(e=>{bshArchiveCatalogPromise=null;throw e});
 return bshArchiveCatalogPromise;
}
function archiveStationId(code){
 const c=String(code||'').trim().replace(/^DE__?/i,'').toUpperCase();
 return c==='3020P'?'KIEL-HOLTENAU':'DE__'+c;
}
function updateBshTxtDownload(){
 const link=$('bshTxtDownload'),check=$('bshTxtCheck');
 if(link){link.hidden=true;link.removeAttribute('href');link.removeAttribute('download');}
 if(check){
   const poStation=modeForSelection?.po||(mode==='po'?current:poCurrent);
   // BSH-only stations (z. B. Wyk, Föhr) müssen den Direktdownload ebenfalls anbieten.
   check.hidden=!(currentBsh||poStation);
   check.disabled=false;
   check.textContent='BSH-TXT-Direktdownload prüfen';
 }
}
async function checkBshTxtDirectDownload(){
 const check=$('bshTxtCheck'),link=$('bshTxtDownload');
 const poStation=modeForSelection?.po||(mode==='po'?current:poCurrent);
 const selectedBsh=currentBsh||(modeForSelection?.bsh||null)||(mode==='bsh'?current:null);
 // Wenn für eine PEGELONLINE-only-Station kein BSH-Jahr gesetzt ist,
 // das aktuell gewählte Datum als Prüfjahr verwenden.
 const dateYear=Number(String($('date')?.value||'').slice(0,4));
 // Das sichtbare Kalenderdatum ist maßgeblich. selectedYear kann nach
 // Stationswechseln noch auf dem zuvor geladenen Archivjahr stehen.
 const year=dateYear||Number(selectedYear);
 const status=$('bshSourceStatus');
 if(!check||!status)return;
 if(link){link.hidden=true;link.removeAttribute('href');}
 window.tidenuhrBshDirectUrl='';
 if(!poStation&&!selectedBsh){
   status.textContent='Die Prüfung kann nicht starten: Es wurde keine BSH- oder PEGELONLINE-Messstelle erkannt. Bitte die Pegelstelle erneut auswählen.';
   status.className='small warn';
   return;
 }
 if(!/^\d{4}$/.test(String(year))){
   status.textContent='Die Prüfung kann nicht starten: Es ist noch kein gültiges Datenjahr ausgewählt. Bitte zuerst ein Jahr auswählen und erneut prüfen.';
   status.className='small warn';
   return;
 }
 check.disabled=true;check.textContent='BSH-Datei wird geprüft …';
 let directUrl=null;
 try{
   let candidate=selectedBsh||(poStation?findBshForPo(poStation):null);
   // Verifizierte Sonderzuordnung Büsum: PEGELONLINE 9510095 entspricht
   // der offiziellen BSH-Dateikennung 505P. Andere Stationen werden nicht
   // anhand ähnlicher Namen oder vermuteter Nummern zugeordnet.
   if(!candidate&&String(poStation?.number||'').trim()==='9510095'){
     candidate={id:'DE__505P',name:'Büsum, Schleuse',archiveStationCode:'505P',waterPegelNr:'9510095',pegelonlineNumber:'9510095'};
   }
   // Verifizierte Zuordnung aus dem offiziellen BSH-Stationsverzeichnis:
   // „Eider-Sperrwerk, Außenpegel“ hat bshnr 664P.
   // Nur den eindeutig benannten Pegel zuordnen; keine Teilstring-/Nähe-Suche.
   if(!candidate){
     const poName=norm(poStation.longname||poStation.shortname||poStation.name||'');
     if(/eider/.test(poName)&&/sperrwerk/.test(poName)&&(/aussenpegel/.test(poName)||/(^| )ap($| )/.test(poName))){
       candidate={id:'DE__664P',name:'Eider-Sperrwerk, Außenpegel',archiveStationCode:'664P'};
     }
   }
   const items=await getBshArchiveCatalog();
   const targetName=norm(poStation?.longname||poStation?.shortname||poStation?.name||'');
   const sameName=items.filter(x=>norm(x.station_name||'')===targetName&&targetName.length>4);
   if(!candidate&&sameName.length){
     const code=String(sameName[0].station_code||'').trim().toUpperCase();
     candidate=bshCatalog.find(x=>archiveCodeForBsh(x)===code)||{id:archiveStationId(code),name:sameName[0].station_name,archiveStationCode:code};
   }
   if(!candidate){
     status.textContent='Für diese PEGELONLINE-Messstelle ist keine eindeutige BSH-Stationskennung bekannt. Ein sicherer Direktdownload kann deshalb nicht ermittelt werden.';
     status.className='small warn';return;
   }
   const code=archiveCodeForBsh(candidate);
   if(!/^[A-Z0-9]{3,12}$/.test(code)){
     status.textContent='Für diese Station ist keine gültige BSH-Dateikennung vorhanden.';
     status.className='small warn';return;
   }
   const archivedItem=items.find(x=>String(x.station_code||'').trim().toUpperCase()===code&&Number(x.datenjahr)===year&&x.archiv_status==='archiviert');
   if(archivedItem){
     status.textContent='Für '+candidate.name+' ist bereits eine BSH-TXT-Datei für genau das Jahr '+year+' im Archiv vorhanden ('+(archivedItem.original_dateiname||('Pegel '+code))+'). Ein Eintrag aus einem anderen Jahr verhindert den Download nicht.';
     status.className='small';return;
   }
   // Kiel-Holtenau Ostsee bietet laut BSH-Seite keinen direkten HW/NW-TXT-Download.
   // Erst nach der Archivprüfung abfangen, damit vorhandene Archivdaten Vorrang haben.
   if(code==='3020P'||candidate.id==='KIEL-HOLTENAU'){
     status.textContent='Für Kiel-Holtenau Ostsee stellt der BSH keinen direkten Hoch-/Niedrigwasser-TXT-Download bereit. Beobachtungsdaten finden Sie auf der BSH-Seite unter „Weitere Daten“ bei PegelOnline.';
     status.className='small warn';
     return;
   }
   const url=new URL('https://filebox.bsh.de/index.php/s/SbJ3z5NBkpOZloY/download');
   url.searchParams.set('path','/vb_hwnw/deu'+year);
   url.searchParams.set('files','DE__'+code+year+'.txt');
   // Serverseitige Prüfung vermeidet Safari-CORS-Probleme.
   // Ein Downloadlink wird ausschließlich bei bestätigter BSH-Datei angeboten.
   const verifyResponse=await fetch(BSH_ARCHIVE_API+'/bsh-direktdownload-pruefen',{
     method:'POST',
     headers:{'Content-Type':'application/json',Accept:'application/json'},
     cache:'no-store',
     body:JSON.stringify({stationCode:code,year})
   });
   if(!verifyResponse.ok)throw Error('BSH-Prüfdienst HTTP '+verifyResponse.status);
   const verified=await verifyResponse.json();
   if(verified?.available!==true||verified?.confirmed!==true){
     throw Error(verified?.message||'Der BSH-Direktdownload konnte nicht eindeutig bestätigt werden.');
   }
   directUrl=verified.downloadUrl||url.href;
   window.tidenuhrBshDirectUrl=directUrl;
   if(link){link.href=directUrl;link.download=verified.filename||('DE__'+code+year+'.txt');link.hidden=false;}
   status.textContent='BSH-Direktdatei bestätigt: '+(verified.stationName||candidate.name)+' · '+year+' · '+Number(verified.vb2Records||0)+' HW/NW-Datensätze. Sie ist für dieses Jahr noch nicht im Archiv eingetragen.';
   status.className='small ok';
 }catch(e){
   if(link){link.hidden=true;link.removeAttribute('href');}
   window.tidenuhrBshDirectUrl='';
   status.textContent='Kein bestätigter BSH-Direktdownload für diese Station und dieses Jahr: '+String(e?.message||e);
   status.className='small warn';
 }finally{
   check.disabled=false;check.textContent='BSH-TXT-Direktdownload erneut prüfen';
 }
}
function archiveCodeForBsh(b){
 // Stationskennung aus sämtlichen gängigen Feldern des BSH-Stationsverzeichnisses
 // lesen. So funktionieren neue Nordsee- und Ostsee-Pegel ohne feste
 // Büsum-Sonderbehandlung, sofern die offizielle BSH-Kennung mitgeliefert wird.
 const id=String(b?.id||'').trim().toUpperCase();
 if(id==='KIEL-HOLTENAU'||id==='DE_3020P')return '3020P';
 const match=id.match(/^DE__?([A-Z0-9]+)$/);
 if(match)return match[1];
 const raw=[
   b?.archiveStationCode,b?.bshnr,b?.bshNr,b?.bshNumber,b?.stationCode,
   b?.station_code,b?.downloadCode,b?.pegelNr,b?.pegelnummer,b?.pegelnr
 ].find(v=>String(v??'').trim()!=='');
 return String(raw||'').trim().replace(/^DE__?/i,'').toUpperCase();
}
function archiveRecordsForStation(b,items){
 const code=archiveCodeForBsh(b);
 let records=items.filter(x=>String(x.station_code||'').trim().toUpperCase()===code);
 if(!records.length){
   const target=norm(b?.name||'');
   if(target.length>4)records=items.filter(x=>norm(x.station_name||'')===target);
 }
 return records;
}
async function addArchiveStationsToCatalog(){
 let items;
 try{items=await getBshArchiveCatalog()}catch(e){console.warn('BSH-Archivkatalog nicht verfügbar:',e);return}
 const grouped=new Map();
 for(const item of items){
   const code=String(item.station_code||'').trim().toUpperCase();
   if(!code)continue;
   const id=archiveStationId(code);
   let b=grouped.get(id);
   if(!b){b=bshCatalog.find(x=>x.id===id)||{id,name:item.station_name||id,region:mapCoastRegion({name:item.station_name||id}),files:{},years:[],bshAvailable:true,archiveStationCode:code};grouped.set(id,b)}
   b.name=b.name||item.station_name||id;
   b.archiveStationCode=code;
   b.archiveAvailable=true;
   b.years=[...new Set([...(b.years||[]).map(Number),Number(item.datenjahr)].filter(Number.isFinite))].sort((a,b)=>a-b);
   b.files=b.files||{};
 }
 for(const [id,b] of grouped){
   const existing=bshCatalog.findIndex(x=>x.id===id);
   if(existing>=0)bshCatalog[existing]={...bshCatalog[existing],...b,files:{...(bshCatalog[existing].files||{}),...(b.files||{})},years:[...new Set([...(bshCatalog[existing].years||[]).map(Number),...(b.years||[]).map(Number)])].sort((a,b)=>a-b)};
   else bshCatalog.push(b);
 }
 dedupeBshCatalog();
}
async function loadOfficialBshTxtYear(bsh,year,requestIsCurrent){
 const code=archiveCodeForBsh(bsh);
 if(!/^[A-Z0-9]{3,12}$/.test(code))return null;
 const base='https'+':'+'/'+'/filebox.bsh.de/index.php/s/SbJ3z5NBkpOZloY/download';
 const url=new URL(base);url.searchParams.set('path','/vb_hwnw/deu'+Number(year));url.searchParams.set('files','DE__'+code+Number(year)+'.txt');
 const response=await fetch(url.href,{method:'GET',cache:'no-store'});if(!requestIsCurrent())return null;if(!response.ok)throw Error('BSH-TXT HTTP '+response.status);
 const txt=await response.text();if(!requestIsCurrent())return null;
 const parsed=parseBshTxtText(txt,'DE__'+code+Number(year)+'.txt');
 if(!parsed||!Array.isArray(parsed.events)||!parsed.events.length)throw Error('Keine HW/NW-Datensätze im BSH-TXT');
 const events=parsed.events.filter(e=>String(e.datetime||'').slice(0,4)===String(year));if(!events.length)throw Error('Keine Ereignisse für das Jahr');
 parsed.events=events;parsed.year=Number(year);parsed.station=parsed.station||bsh.name;parsed.source='BSH-Originaldownload';return {parsed,events};
}
async function loadBshArchiveYear(bsh,year,requestIsCurrent){
 const items=await getBshArchiveCatalog();
 if(!requestIsCurrent())return null;
 const records=archiveRecordsForStation(bsh,items).filter(x=>Number(x.datenjahr)===Number(year));
 if(!records.length)return null;
 // Bei doppelten Station/Jahr-Einträgen den zuletzt erstellten Datensatz bevorzugen.
 records.sort((a,b)=>String(b.erstellt_am||'').localeCompare(String(a.erstellt_am||''))||String(a.id).localeCompare(String(b.id)));
 const chosen=records[0];
 const url=new URL(BSH_ARCHIVE_API+'/bsh-archiv-download');
 url.searchParams.set('id',chosen.id);
 const response=await fetch(url.href,{method:'GET',headers:{Accept:'application/octet-stream'},cache:'no-store'});
 if(!requestIsCurrent())return null;
 if(!response.ok)throw Error('BSH-Archivdownload HTTP '+response.status);
 const txt=await response.text();
 if(!requestIsCurrent())return null;
 const parsed=parseBshTxtText(txt,chosen.original_dateiname||('DE__'+chosen.station_code+year+'.txt'));
 if(!parsed||!Array.isArray(parsed.events)||!parsed.events.length)throw Error('Keine HW/NW-Datensätze in der archivierten BSH-Datei');
 const events=parsed.events.filter(e=>String(e.datetime||'').slice(0,4)===String(year));
 if(!events.length)throw Error('Keine HW/NW-Ereignisse für '+year+' in der Archivdatei');
 parsed.events=events;parsed.year=Number(year);parsed.station=chosen.station_name||parsed.station;parsed.filename=chosen.original_dateiname||parsed.filename;parsed.source='Supabase BSH-Archiv';
 return {parsed,events,record:chosen};
}

const $=id=>document.getElementById(id); const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
// Quota-sichere Speicherung: zuerst entbehrliche API-Caches entfernen, niemals BSH-Importe/Favoriten löschen.
function pruneStorageCaches(){
 const remove=[];
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k && (k==='tiden.po.catalog'||k.startsWith('tiden.water.history.')||k.startsWith('tiden.forecast.')||k.startsWith('tiden.water.')))remove.push(k);}}catch(_){}
 for(const k of remove){try{localStorage.removeItem(k)}catch(_){}}
 return remove.length;
}
function storageSet(key,value){
 try{localStorage.setItem(key,value);return true;}
 catch(err){
   pruneStorageCaches();
   try{localStorage.setItem(key,value);return true;}
   catch(err2){
     // Große, neu geladene API-Caches sind optional; ein BSH-Import dagegen nicht.
     if(key==='tiden.po.catalog'||key.startsWith('tiden.water.history.')||key.startsWith('tiden.forecast.')||key.startsWith('tiden.water.'))return false;
     const e=new Error('Der Browser-Speicher ist voll. Entbehrliche Messwert-Caches wurden entfernt. Bitte die TidenUhr neu laden und den BSH-Import erneut versuchen.');
     e.name='QuotaExceededError'; throw e;
   }
 }
}

// v46.60: Beim Öffnen die veröffentlichte HTML-Version ohne Browsercache prüfen; Service Worker aktiv aktualisieren.
// Ein Update wird niemals ungefragt geladen; der Nutzer kann den Neuladevorgang auslösen.
async function checkForPublishedUpdate(){
 try{
  const url=new URL('version.json',location.href);
  url.searchParams.set('_',String(Date.now()));
  const response=await fetch(url.href,{cache:'no-store',headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
  if(!response.ok)return;
  const versionData=await response.json();
  const remote=String(versionData?.version||'').trim(),current=TIDENUHR_VERSION;
  if(!/^\d+(?:\.\d+)+$/.test(remote))return;
  const parts=v=>v.split('.').map(n=>parseInt(n,10)||0);
  const a=parts(remote),b=parts(current);let newer=false;
  for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)>(b[i]||0)){newer=true;break;}if((a[i]||0)<(b[i]||0))break;}
  if(!newer) return;
  let notice=document.getElementById('updateNotice');
  if(!notice){
   notice=document.createElement('div');notice.id='updateNotice';notice.setAttribute('role','status');notice.innerHTML='<div><strong>Neue TidenUhr-Version verfügbar</strong><div id="updateNoticeText" style="margin-top:4px"></div></div><div class="updateActions"><button type="button" class="updatePrimary" id="updateReload">Jetzt aktualisieren</button><button type="button" class="updateSecondary" id="updateLater">Später</button></div>';
   document.body.appendChild(notice);
   notice.querySelector('#updateReload').addEventListener('click',()=>{
    // Cache-busting URL lädt die veröffentlichte Datei frisch, auch wenn die Web-App die alte Seite zwischenspeichert.
    const fresh=new URL(location.href);fresh.searchParams.set('__tiden_refresh',remote+'-'+Date.now());location.replace(fresh.href);
   });
   notice.querySelector('#updateLater').addEventListener('click',()=>notice.remove());
  }
  notice.querySelector('#updateNoticeText').textContent='Installierte Version v'+current+' · online verfügbar v'+remote+'. Beim Aktualisieren bleiben gespeicherte Favoriten und BSH-Importe erhalten.';
 }catch(_){/* Offline oder GitHub vorübergehend nicht erreichbar: aktuelle Seite unverändert weiterverwenden. */}
}
function applyVersion(){ document.title='TidenUhr v'+TIDENUHR_VERSION+' · index.html'; const v=document.querySelector('[data-app-version]'); if(v) v.textContent=TIDENUHR_VERSION; }
const localDate=()=>{let d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
function syncDateToData(){
 // Ein vom Nutzer gewähltes Datum hat Vorrang, sofern es zum ausgewählten Datenjahr gehört.
 // Nicht bei jeder Neuladung auf heute zurückspringen: sonst kann die Tagesauswahl
 // im Kalender (z.B. 28.10.) nicht übernommen werden.
 const selected=String($('date').value||'');
 if(selected && Number(selected.slice(0,4))===Number(selectedYear)) return;
 const today=localDate();
 if(Number(today.slice(0,4))===Number(selectedYear)){ $('date').value=today; return; }
 const first=data.find(e=>e&&e.datetime&&Number(String(e.datetime).slice(0,4))===Number(selectedYear));
 if(first) $('date').value=String(first.datetime).slice(0,10);
}
$('date').value=localDate();
function cleanStationName(name){
 let v=String(name??'');
 // Bekannter Zeichensatzfehler bei der BSH-Station Wyk, Föhr.
 if(/^Wyk,\s*F[�?]hr$/i.test(v) || /^Wyk,\s*Föhr$/i.test(v)) return 'Wyk, Föhr';
 return v;
}
function label(s){return cleanStationName(s.longname||s.shortname||s.name||'Unbenannte Station')+(s.water?.longname?' · '+cleanStationName(s.water.longname):'')}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function stationNameCore(v){
 return norm(String(v||'')
   .replace(/\b(ostsee|nordsee|see|elbe|eider|weser|ems|jade|trave|schlei|foerde|förder|bucht|hafen)\b/g,' '));
}
function findPoForBsh(b){
 const waterUuid=b.waterUuid||b.uuid||null;
 if(waterUuid){const byU=po.find(x=>x.uuid===waterUuid);if(byU)return byU;}
 // Gemeinsame kanonische ID vor Namens-/Nummernvergleich prüfen.
 const bCanonical=canonicalBshId(b);
 if(bCanonical){const byCanonical=po.find(x=>canonicalBshId(x)===bCanonical);if(byCanonical)return byCanonical;}
 const nums=[b.waterPegelNr,b.pegelnummer,b.pegelnr,b.pegelonlineNumber,b.importedPegelNr].map(String).filter(x=>x&&x!=='undefined');
 const byN=po.find(x=>nums.includes(String(x.number||''))); if(byN)return byN;
 const bn=stationNameCore(b.name);
 const byExact=po.find(x=>stationNameCore(x.longname||x.shortname||x.name)===bn&&bn.length>4); if(byExact)return byExact;
 // Keine Zuordnung allein über Nähe oder Teilstrings: benachbarte Pegel
 // können eigenständige Messstellen sein und dürfen nicht verwechselt werden.
 return null;
}
function findBshForPo(p){
 // Kartenpunkte stammen aus PEGELONLINE, während die Tidezeiten aus dem
 // BSH-Katalog kommen. Zuerst über die kanonische Stationskennung verknüpfen,
 // damit Kiel-Holtenau trotz abweichender Nummern/Namenszusätze gefunden wird.
 const pCanonical=canonicalBshId(p);
 if(pCanonical){const byCanonical=bshCatalog.find(x=>canonicalBshId(x)===pCanonical);if(byCanonical)return byCanonical;}
 const n=String(p.number||'');
 const byN=bshCatalog.find(x=>[x.waterPegelNr,x.pegelnummer,x.pegelnr,x.pegelonlineNumber,x.importedPegelNr].map(String).includes(n));
 if(byN)return byN;
 const pn=stationNameCore(p.longname||p.shortname||p.name);
 const byExact=bshCatalog.find(x=>stationNameCore(x.name)===pn&&pn.length>4); if(byExact)return byExact;
 // Keine Zuordnung allein über räumliche Nähe oder Teilstrings:
 // ein PEGELONLINE-Pegel ohne eindeutige BSH-Kennung bleibt ein Wasserpegel.
 return null;
}
function mergeStations(){
 // BSH und PEGELONLINE werden über eine kanonische Stationsidentität
 // zusammengeführt. Dadurch kann ein importierter BSH-Datensatz niemals
 // zusätzlich als zweite Kiel-Holtenau-Station erscheinen.
 dedupeBshCatalog();
 const out=[]; const used=new Set();
 bshCatalog.forEach(b=>{
   const canonical=canonicalBshId(b)||b.id;
   const p=findPoForBsh(b);
   const key='station:'+(p?.uuid||canonical);
   const region=stationRegion({...b,po:p,bsh:b});
   out.push({key,name:canonical==='KIEL-HOLTENAU'?'Kiel-Holtenau':b.name,region,bsh:b,po:p});
   if(p?.uuid)used.add(p.uuid);
 });
 po.forEach(p=>{
   if(used.has(p.uuid))return;
   out.push({key:'station:'+p.uuid,name:cleanStationName(p.longname||p.shortname||'Unbenannte Station'),region:stationRegion(p),bsh:null,po:p});
 });
 return out;
}
function validateBsh(meta,events){
 const issues=[]; if(!meta) return ['Keine BSH-Jahresdatei geladen.'];
 if(!/^\d{4}$/.test(String(meta.year)))issues.push('Jahr fehlt/ungültig');
 if(!meta.reference)issues.push('Bezugsniveau fehlt');
 if(!meta.timezone)issues.push('Zeitzone fehlt');
 if(!Array.isArray(events)||!events.length)issues.push('Keine HW/NW-Ereignisse');
 let prev=null; for(const e of (events||[])){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.datetime))issues.push('Zeitformat ungültig'); if(!['HW','NW'].includes(e.type))issues.push('Unbekannter Ereignistyp'); if(!Number.isFinite(Number(e.height)))issues.push('Höhe ungültig'); if(prev&&e.datetime<prev)issues.push('Ereignisse nicht chronologisch'); prev=e.datetime;}
 return [...new Set(issues)];
}
function renderQuality(){
 const issues=validateBsh(meta,data); const parts=[];
 if(currentBsh){parts.push(issues.length?`<span class="warn">⚠ BSH: ${esc(issues.join(' · '))}</span>`:`<span class="ok">✓ BSH-Daten geprüft: ${data.length} HW/NW-Ereignisse, ${esc(meta.reference||'')} · ${esc(meta.timezone||'')}</span>`)}else parts.push('<span class="small">– Für diese Station ist derzeit keine BSH-Jahresdatei im Projekt eingebunden.</span>');
 if(poCurrent?.uuid)parts.push('<span class="ok">✓ PEGELONLINE-Station über UUID verknüpft.</span>'); else parts.push('<span class="small">– Keine PEGELONLINE-Verknüpfung.</span>');
 $('quality').innerHTML=parts.join('<br>');
}
async function refreshDatabase(){
 try{
  const merged=mergeStations();
  const linked=merged.filter(x=>x.bsh&&x.po).length;
  $('dbInfo').textContent=`${merged.length} kombinierte Stationen · ${linked} mit BSH + PEGELONLINE · PEGELONLINE ${po.length} Messstellen · BSH ${bshCatalog.length} Tide-Stationen`;
 }catch(e){}
}

let mapRegion='all';
function mapStations(){
 const arr=po
   .filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude)))
   .map(x=>({...x,_mapRegion:mapCoastRegion(x)}))
   .filter(x=>x._mapRegion==='Nordsee'||x._mapRegion==='Ostsee');
 if(mapRegion==='north')return arr.filter(x=>x._mapRegion==='Nordsee');
 if(mapRegion==='baltic')return arr.filter(x=>x._mapRegion==='Ostsee');
 return arr;
}
async function selectMapStation(uuid){
 const target=po.find(s=>String(s.uuid)===String(uuid));
 if(!target){
   $('status').textContent='Kartenstation konnte nicht zugeordnet werden.';
   $('status').className='small error';
   return;
 }
 // Kartenmarker stammen aus PEGELONLINE. Auch wenn zuvor eine BSH-TXT-Datei
 // importiert wurde (mode='bsh'), muss die Kartenauswahl über die PEGELONLINE-
 // UUID erfolgen und darf nicht als BSH-ID interpretiert werden.
 const oldMode=mode;
 mode='po';
 try{await selectStation(target.uuid);}finally{mode=oldMode;}
}

function renderMap(){
 const host=$('map'); if(!host)return;
 const stations=mapStations();
 const W=900,H=420,pad=28;
 let lonVals=stations.map(s=>Number(s.longitude)),latVals=stations.map(s=>Number(s.latitude));
 let lon0=lonVals.length?Math.min(...lonVals)-0.7:5,lon1=lonVals.length?Math.max(...lonVals)+0.7:15;
 let lat0=latVals.length?Math.min(...latVals)-0.35:53,lat1=latVals.length?Math.max(...latVals)+0.35:55.5;
 if(lon1-lon0<3){const c=(lon0+lon1)/2;lon0=c-1.5;lon1=c+1.5}
 if(lat1-lat0<1){const c=(lat0+lat1)/2;lat0=c-.5;lat1=c+.5}
 const key=mapRegion==='north'?'north':mapRegion==='baltic'?'baltic':'all';
 if(!window._tideMapView||window._tideMapView.key!==key){
   window._tideMapView={key,zoom:1,cx:(lon0+lon1)/2,cy:(lat0+lat1)/2};
 }
 const mv=window._tideMapView;
 const baseLonSpan=lon1-lon0,baseLatSpan=lat1-lat0;
 // Begrenzter Zoom: Die Karte soll nicht so weit auseinandergezogen werden,
 // dass nur noch ein winziger Ausschnitt der Hintergrundkarte sichtbar ist.
 const MIN_ZOOM=1,MAX_ZOOM=5;
 mv.zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Number(mv.zoom)||1));
 const viewLonSpan=baseLonSpan/mv.zoom,viewLatSpan=baseLatSpan/mv.zoom;
 // Mittelpunkt innerhalb des Datenbereichs halten. So kann beim Zoomen
 // keine Ansicht entstehen, in der nur noch leere Land-/Seefläche zu sehen ist.
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const halfLon=viewLonSpan/2,halfLat=viewLatSpan/2;
 mv.cx=clamp(Number(mv.cx)||((lon0+lon1)/2),lon0+halfLon,lon1-halfLon);
 mv.cy=clamp(Number(mv.cy)||((lat0+lat1)/2),lat0+halfLat,lat1-halfLat);
 const vLon0=mv.cx-halfLon,vLon1=mv.cx+halfLon,vLat0=mv.cy-halfLat,vLat1=mv.cy+halfLat;
 const px=x=>pad+(x-vLon0)/(vLon1-vLon0)*(W-2*pad),py=y=>H-pad-(y-vLat0)/(vLat1-vLat0)*(H-2*pad);
 const selectedUuid=window._tideMapSelectedUuid||poCurrent?.uuid;
 const suppressNextMapClick=window._tideMapSuppressClick===true;
 window._tideMapSuppressClick=false;
 const clusterRadius=mv.zoom>=MAX_ZOOM-0.05 ? 0 : Math.max(8,22/Math.sqrt(mv.zoom));
 const clusters=[];
 stations.forEach(st=>{
   const x=px(Number(st.longitude)),y=py(Number(st.latitude));
   let c=clusters.find(g=>Math.hypot(g.x-x,g.y-y)<clusterRadius);
   if(!c){c={x,y,stations:[]};clusters.push(c)}
   c.stations.push(st);
 });
 const svgElId='tideMapSvg';
 let svg=`<div class="mapbox"><div class="mapcontrols"><button type="button" id="mapZoomOut" aria-label="Karte verkleinern">−</button><button type="button" id="mapZoomReset" aria-label="Karte zurücksetzen">↺</button><button type="button" id="mapZoomIn" aria-label="Karte vergrößern">+</button></div><svg id="${svgElId}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Interaktive Küstenkarte"><rect class="mapsea" width="${W}" height="${H}"/><g id="mapLayer">`;
 // Hintergrund und Marker werden mit exakt derselben lon/lat-Projektion gezeichnet.
 // Die Küstenlinie ist bewusst nur eine schematische Orientierung; entscheidend ist,
 // dass sie bei jeder Zoomstufe dieselbe Transformation wie die Pegel erhält.
 const coastBaseLat=lat0+(lat1-lat0)*0.58;
 const coastPts=[
   [lon0,coastBaseLat+0.08*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.11,coastBaseLat-0.02*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.22,coastBaseLat+0.04*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.31,coastBaseLat-0.03*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.42,coastBaseLat+0.07*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.52,coastBaseLat-0.01*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.64,coastBaseLat+0.05*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.76,coastBaseLat-0.02*(lat1-lat0)],
   [lon0+(lon1-lon0)*0.88,coastBaseLat+0.03*(lat1-lat0)],
   [lon1,coastBaseLat-0.01*(lat1-lat0)]
 ];
 const coastD=`M${px(coastPts[0][0]).toFixed(1)} ${py(coastPts[0][1]).toFixed(1)} `+
   coastPts.slice(1).map((p,i)=>{
     const prev=coastPts[i],mx=(prev[0]+p[0])/2;
     return `C${px(mx).toFixed(1)} ${py(prev[1]).toFixed(1)},${px(mx).toFixed(1)} ${py(p[1]).toFixed(1)},${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`;
   }).join(' ')+` V${H} H0 Z`;
 svg+=`<path class="mapland" d="${coastD}"/>`;
 for(let lon=Math.ceil(vLon0);lon<=Math.floor(vLon1);lon++){const x=px(lon);svg+=`<line class="mapgrid" x1="${x}" y1="0" x2="${x}" y2="${H}"/><text x="${x+3}" y="18" class="small">${lon}°E</text>`}
 for(let lat=Math.ceil(vLat0*2)/2;lat<=vLat1;lat+=.5){const y=py(lat);svg+=`<line class="mapgrid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text x="4" y="${y-3}" class="small">${lat.toFixed(1)}°N</text>`}
 clusters.forEach(g=>{
   if(g.stations.length===1){
     const st=g.stations[0],x=px(Number(st.longitude)),y=py(Number(st.latitude));
     const name=st.shortname||st.longname||st.name||'Pegel';
     const active=selectedUuid&&st.uuid===selectedUuid;
     svg+=`<g class="mapdot ${active?'active':''}" data-uuid="${esc(st.uuid)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(name)}"><circle class="mapHit" r="16"/><circle r="${active?8:5}"/><title>${esc(name)} – anklicken, um diese Station auszuwählen</title>${active?`<text x="9" y="-8">${esc(name).slice(0,28)}</text>`:''}</g>`;
   } else {
     const names=g.stations.map(st=>st.shortname||st.longname||st.name||'Pegel');
     svg+=`<g class="mapcluster" data-cluster="${g.stations.map(st=>esc(st.uuid)).join(',')}" transform="translate(${g.x.toFixed(1)},${g.y.toFixed(1)})" tabindex="0" role="button" aria-label="${g.stations.length} Messstellen in diesem Bereich"><circle r="${Math.min(18,8+Math.sqrt(g.stations.length)*2)}"/><text y="1">${g.stations.length}</text><title>${g.stations.length} Messstellen: ${esc(names.slice(0,5).join(', '))}${names.length>5?' …':''}</title></g>`;
   }
 });
 svg+='</g></svg><div id="mapPopup" class="mapPopup" aria-live="polite"></div></div>'; host.innerHTML=svg;
 const zoomAt=(factor,focusLon=mv.cx,focusLat=mv.cy)=>{
   const nz=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,mv.zoom*factor));
   if(nz===mv.zoom)return;
   // Der angeklickte/überfahrene Kartenpunkt bleibt beim Zoomen unter dem Cursor.
   const ratio=mv.zoom/nz;
   mv.cx=focusLon+(mv.cx-focusLon)*ratio;
   mv.cy=focusLat+(mv.cy-focusLat)*ratio;
   mv.zoom=nz;
   renderMap();
 };
 $('mapZoomIn')?.addEventListener('click',()=>zoomAt(1.5));
 $('mapZoomOut')?.addEventListener('click',()=>zoomAt(1/1.5));
 $('mapZoomReset')?.addEventListener('click',()=>{mv.zoom=1;mv.cx=(lon0+lon1)/2;mv.cy=(lat0+lat1)/2;renderMap()});
 const showMapPopup=(uuid)=>{
   const st=stations.find(x=>String(x.uuid)===String(uuid));
   const popup=$('mapPopup'); if(!popup||!st)return;
   const name=cleanStationName(st.longname||st.shortname||st.name||'Pegel');
   let waterHtml='Wasserstand wird geladen …';
   try{const cached=JSON.parse(localStorage.getItem(waterCacheKey(uuid))||'null');const val=Number(cached?.value);if(Number.isFinite(val))waterHtml=`${(val/100).toFixed(2)} m <span style="font-size:12px;font-weight:400">(letzter gespeicherter Messwert)</span>`;}catch(_){}
   popup.innerHTML=`<strong>${esc(name)}</strong><div class="mapPopupWater">${waterHtml}</div>`;
   popup.classList.add('visible');
 };
 document.querySelectorAll('.mapdot').forEach(el=>{
   const activate=()=>{
     if(window._tideMapSuppressClick){window._tideMapSuppressClick=false;return;}
     const uuid=el.dataset.uuid;
     // Sofortige visuelle Rückmeldung, bevor Netzwerkanfragen/Stationswechsel laufen.
     window._tideMapSelectedUuid=uuid;
     showMapPopup(uuid);
     document.querySelectorAll('.mapdot').forEach(n=>n.classList.toggle('active',n.dataset.uuid===uuid));
     selectMapStation(uuid).then(()=>{renderMap();showMapPopup(uuid);});
   };
   el.onclick=activate;
   el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}};
   el.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();activate();}},{passive:false});
 });
 document.querySelectorAll('.mapcluster').forEach(el=>{
   const activate=()=>{
     if(window._tideMapSuppressClick){window._tideMapSuppressClick=false;return;}
     const ids=String(el.dataset.cluster||'').split(',');
     const group=stations.filter(st=>ids.includes(String(st.uuid)));
     if(!group.length)return;
     const xs=group.map(s=>Number(s.longitude)),ys=group.map(s=>Number(s.latitude));
     const gx=(Math.min(...xs)+Math.max(...xs))/2,gy=(Math.min(...ys)+Math.max(...ys))/2;
     const spanLon=Math.max(Math.max(...xs)-Math.min(...xs),0.01);
     const spanLat=Math.max(Math.max(...ys)-Math.min(...ys),0.01);
     // Nur so weit hineinzoomen, dass die Gruppe auseinanderlaufen kann und
     // gleichzeitig vollständig im sichtbaren Bereich bleibt.
     const target=Math.min(MAX_ZOOM,Math.max(mv.zoom*1.5,baseLonSpan/(spanLon/0.62),baseLatSpan/(spanLat/0.62)));
     zoomAt(target/mv.zoom,gx,gy);
   };
   el.onclick=activate;
   el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}};
 });
 const svgNode=document.getElementById(svgElId);
 // Freies Verschieben per Maus oder Finger. Die Kartenebene wird während des
 // Ziehens direkt verschoben und erst beim Loslassen in geografische Koordinaten
 // übernommen. Dadurch bleibt das Ziehen flüssig, ohne die Event-Handler während
 // des Drags neu aufzubauen.
 if(svgNode){
   let pan=null;
   const layer=svgNode.querySelector('#mapLayer');
   const pointFromEvent=e=>{
     const rect=svgNode.getBoundingClientRect();
     return {x:e.clientX-rect.left,y:e.clientY-rect.top};
   };
   const clearLayerTransform=()=>{if(layer)layer.removeAttribute('transform')};
   svgNode.addEventListener('pointerdown',e=>{
     if(e.button!==undefined && e.button!==0 && e.pointerType!=='touch') return;
     if(e.target.closest('.mapdot,.mapcluster')) return;
     const pt=pointFromEvent(e);
     pan={id:e.pointerId,startX:pt.x,startY:pt.y,dx:0,dy:0,moved:false};
     svgNode.classList.add('dragging');
     try{svgNode.setPointerCapture(e.pointerId)}catch(_){}
   });
   svgNode.addEventListener('pointermove',e=>{
     if(!pan || pan.id!==e.pointerId)return;
     const pt=pointFromEvent(e);
     pan.dx=pt.x-pan.startX; pan.dy=pt.y-pan.startY;
     if(Math.hypot(pan.dx,pan.dy)>5)pan.moved=true;
     if(!pan.moved)return;
     if(layer)layer.setAttribute('transform',`translate(${pan.dx.toFixed(1)} ${pan.dy.toFixed(1)})`);
     e.preventDefault();
   },{passive:false});
   const endPan=e=>{
     if(!pan || pan.id!==e.pointerId)return;
     const p=pan; pan=null; svgNode.classList.remove('dragging');
     try{svgNode.releasePointerCapture(e.pointerId)}catch(_){}
     if(p.moved){
       const spanLon=vLon1-vLon0,spanLat=vLat1-vLat0;
       mv.cx-=p.dx/svgNode.clientWidth*spanLon;
       mv.cy+=p.dy/svgNode.clientHeight*spanLat;
       const halfLon=spanLon/2,halfLat=spanLat/2;
       mv.cx=clamp(mv.cx,lon0+halfLon,lon1-halfLon);
       mv.cy=clamp(mv.cy,lat0+halfLat,lat1-halfLat);
       clearLayerTransform();
       renderMap();
       window._tideMapSuppressClick=true;
     }
   };
   svgNode.addEventListener('pointerup',endPan);
   svgNode.addEventListener('pointercancel',endPan);
 }
 let pinchStart=null;
 let pinchLast=null;
 svgNode?.addEventListener('touchstart',e=>{
   if(e.touches.length===2){
     e.preventDefault();
     const a=e.touches[0],b=e.touches[1];
     const rect=svgNode.getBoundingClientRect();
     const mx=(a.clientX+b.clientX)/2, my=(a.clientY+b.clientY)/2;
     const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
     const sx=(mx-rect.left)/rect.width, sy=(my-rect.top)/rect.height;
     pinchStart={dist,flon:vLon0+sx*(vLon1-vLon0),flat:vLat1-sy*(vLat1-vLat0)};
     pinchLast={dist};
   }
 },{passive:false});
 svgNode?.addEventListener('touchmove',e=>{
   if(e.touches.length===2 && pinchStart){
     e.preventDefault();
     const a=e.touches[0],b=e.touches[1];
     const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
     if(pinchLast && pinchLast.dist>0){
       const factor=dist/pinchLast.dist;
       if(Math.abs(factor-1)>0.01) zoomAt(factor,pinchStart.flon,pinchStart.flat);
     }
     pinchLast={dist};
   }
 },{passive:false});
 svgNode?.addEventListener('touchend',e=>{
   if(e.touches.length<2){pinchStart=null;pinchLast=null;}
 },{passive:false});
 svgNode?.addEventListener('wheel',e=>{
   e.preventDefault();
   const rect=svgNode.getBoundingClientRect();
   const sx=(e.clientX-rect.left)/rect.width,sy=(e.clientY-rect.top)/rect.height;
   const flon=vLon0+sx*(vLon1-vLon0),flat=vLat1-sy*(vLat1-vLat0);
   zoomAt(e.deltaY<0?1.25:1/1.25,flon,flat);
 },{passive:false});
 $('mapInfo').textContent=`${stations.length} Küsten-Messstellen · Bereich: ${mapRegion==='north'?'Nordsee':mapRegion==='baltic'?'Ostsee':'Nordsee + Ostsee'} · ${clusters.filter(g=>g.stations.length>1).length} Gruppen bei dieser Ansicht · Zoom ${mv.zoom.toFixed(1)}×`;
}

function setMapRegion(r){mapRegion=r;['mapAll','mapNorth','mapBaltic'].forEach(id=>$(id)?.classList.toggle('active',(r==='all'&&id==='mapAll')||(r==='north'&&id==='mapNorth')||(r==='baltic'&&id==='mapBaltic')));renderMap()}
function dedupeBshCatalog(){
 const src=Array.isArray(bshCatalog)?bshCatalog:[];
 const out=[]; const byId=new Map();
 for(const raw of src){
   if(!raw) continue;
   const cid=canonicalBshId(raw)||raw.id||raw.pegelNr||raw.name;
   let b=byId.get(cid);
   if(!b){
     b={...raw};
     b.id=cid;
     b.files={...(raw.files||{})};
     b.years=[...(raw.years||[])];
     byId.set(cid,b); out.push(b);
   }else{
     b.files={...(b.files||{}),...(raw.files||{})};
     b.years=[...new Set([...(b.years||[]),...(raw.years||[])].map(Number).filter(Number.isFinite))];
     for(const k of ['imported','importedPegelNr','importedSourceId','bshAvailable','bshUrl','waterPegelNr','pegelonlineNumber','waterUuid','latitude','longitude']){
       if(raw[k]!==undefined && raw[k]!==null && raw[k]!=='') b[k]=raw[k];
     }
   }
   if(cid==='KIEL-HOLTENAU'){
     const base=EMBEDDED_BSH_CATALOG.find(x=>x.id===cid);
     if(base){
       // Kanonischen Datensatz niemals mit dem Roh-Namen des Imports überschreiben.
       b.name=base.name; b.region=base.region; b.waterPegelNr=base.waterPegelNr; b.pegelonlineNumber=base.pegelonlineNumber; b.waterUuid=base.waterUuid; b.bshAvailable=base.bshAvailable; b.bshUrl=base.bshUrl;
     }
   }
 }
 for(const b of out){
   b.years=[...new Set((b.years||[]).map(Number).filter(Number.isFinite))].sort((a,c)=>a-c);
 }
 // Zweite Sicherheitsstufe: auch nach dem Zusammenführen darf es pro
 // kanonischer Stationsidentität nur EINEN Eintrag geben.
 const final=[]; const finalById=new Map();
 for(const b of out){
   const cid=canonicalBshId(b)||b.id;
   const existing=finalById.get(cid);
   if(!existing){b.id=cid;finalById.set(cid,b);final.push(b);continue;}
   existing.years=[...new Set([...(existing.years||[]),...(b.years||[])])].sort((a,c)=>a-c);
   existing.files={...(existing.files||{}),...(b.files||{})};
   if(b.imported) existing.imported=true;
   if(b.importedPegelNr) existing.importedPegelNr=b.importedPegelNr;
   if(b.importedSourceId) existing.importedSourceId=b.importedSourceId;
 }
 const kiel=final.find(x=>x.id==='KIEL-HOLTENAU');
 if(kiel){const base=EMBEDDED_BSH_CATALOG.find(x=>x.id==='KIEL-HOLTENAU'); if(base){kiel.name=base.name;kiel.region=base.region;kiel.waterPegelNr=base.waterPegelNr;kiel.pegelonlineNumber=base.pegelonlineNumber;kiel.waterUuid=base.waterUuid;kiel.bshAvailable=base.bshAvailable;kiel.bshUrl=base.bshUrl;}}
 bshCatalog=final;
}

// v46.66: Nach einem Neuladen lokale BSH-Importe wieder in den Stationskatalog aufnehmen.
function restoreImportedBshStations(){
 try{
  const imports=[];
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   const m=String(key||'').match(/^tiden\.bsh\.import\.(.+)\.(20\d{2}|21\d{2})$/);
   if(!m) continue;
   try{const d=JSON.parse(localStorage.getItem(key)||'null');if(d&&Array.isArray(d.events)&&d.events.length&&d.year)imports.push(d)}catch(_){}
  }
  // Frühere Importe zuerst einlesen; ein späterer Datensatz desselben Pegels ergänzt dessen Jahre.
  imports.sort((a,b)=>Number(a.year)-Number(b.year));
  for(const d of imports){
   const sourceId=String(d.pegelNr||'').trim()||String(d.station||'').trim()||String(d.filename||'BSH-TXT').replace(/\.txt$/i,'');
   const canonicalId=canonicalBshId(d)||sourceId;
   let b=bshCatalog.find(x=>x.id===canonicalId);
   if(!b){
    b={id:canonicalId,name:d.station||canonicalId,region:mapCoastRegion(d),latitude:d.latitude,longitude:d.longitude,files:{},years:[],bshAvailable:true,imported:true,importedPegelNr:d.pegelNr||sourceId,importedSourceId:sourceId};
    bshCatalog.push(b);
   }else{
    b.imported=true;b.importedPegelNr=d.pegelNr||sourceId;b.importedSourceId=sourceId;
    if(!Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(d.latitude)))b.latitude=d.latitude;
    if(!Number.isFinite(Number(b.longitude))&&Number.isFinite(Number(d.longitude)))b.longitude=d.longitude;
   }
   if(!b.years.includes(Number(d.year)))b.years.push(Number(d.year));
  }
  dedupeBshCatalog();
  for(const b of bshCatalog)if(b.imported)b.years=[...new Set((b.years||[]).map(Number))].sort((a,c)=>a-c);
 }catch(_){}
}

async function loadOfficialBshCatalog(){
 const response=await fetch('data/bsh-stations.json',{cache:'default'});
 if(!response.ok)throw Error('BSH-Stationsverzeichnis HTTP '+response.status);
 const json=await response.json();
 if(!json||!Array.isArray(json.gauges)||json.gauges.length!==172)throw Error('Ungültige oder unvollständige BSH-Stationsübersicht');
 const previous=[...bshCatalog];
 const official=json.gauges.map(g=>{
   const code=String(g.bshnr||'').trim().toUpperCase();
   if(!/^[A-Z0-9]{3,12}$/.test(code))return null;
   const id=code==='3020P'?'KIEL-HOLTENAU':'DE__'+code;
   const region=/,\s*Ostsee\s*$/i.test(String(g.station_name||''))?'Ostsee':'Nordsee';
   const old=previous.find(x=>archiveCodeForBsh(x)===code)||{};
   return {...old,id,name:String(g.station_name||''),region,bshnr:code,number:code,latitude:Number(g.latitude),longitude:Number(g.longitude),gauge_group:Number(g.gauge_group),seo_id:String(g.seo_id||''),bshUrl:g.seo_id?'https://gezeiten.bsh.de/'+g.seo_id:'https://gezeiten.bsh.de/',files:{...(old.files||{})},years:[...(old.years||[])]};
 }).filter(Boolean);
 const officialIds=new Set(official.map(x=>canonicalBshId(x)||x.id));
 const extras=previous.filter(x=>!officialIds.has(canonicalBshId(x)||x.id));
 bshCatalog=[...official,...extras];
 dedupeBshCatalog();
}
let poCatalogLoadPromise=null;
async function loadCatalog(){
 // Lokale und gespeicherte Kataloge sofort bereitstellen. Kein Netzwerkdienst
 // darf den ersten Seitenaufbau oder die Stationsauswahl aufhalten.
 bshCatalog=EMBEDDED_BSH_CATALOG.map(x=>({...x,files:{...(x.files||{})},years:[...(x.years||[])]}));
 dedupeBshCatalog();restoreImportedBshStations();
 try{const cached=localStorage.getItem('tiden.po.catalog');if(cached){const parsed=JSON.parse(cached);if(Array.isArray(parsed))po=parsed;}}catch(_){}
 renderList();refreshDatabase();

 const officialTask=Promise.race([loadOfficialBshCatalog(),new Promise((_,reject)=>setTimeout(()=>reject(Error('BSH-Katalog-Zeitüberschreitung')),5000))]).then(()=>true).catch(e=>{console.warn('Offizielle BSH-Stationsliste konnte nicht geladen werden:',e);return false;});

 const archiveTask=getBshArchiveCatalog().catch(e=>{console.warn('BSH-Archivkatalog nicht verfügbar:',e);return null});

 // PEGELONLINE aktualisiert die Liste im Hintergrund; der lokale Cache bleibt nutzbar.
 poCatalogLoadPromise=(async()=>{
   try{
     const request=poFetch('/stations.json',{cache:'default'}).then(response=>{if(!response.ok)throw Error('PEGELONLINE HTTP '+response.status);return response.json();});
     const fresh=await Promise.race([request,new Promise((_,reject)=>setTimeout(()=>reject(Error('PEGELONLINE-Zeitüberschreitung')),8000))]);
     if(Array.isArray(fresh)){
       po=fresh;storageSet('tiden.po.catalog',JSON.stringify(po));
       $('status').textContent=`PEGELONLINE-Stationsliste geladen: ${po.length} Messstellen.`;$('status').className='small ok';
       renderList();refreshDatabase();if($('coastMapCard')?.open)renderMap();
       const saved=localStorage.getItem('tiden.station.id'),savedMode=localStorage.getItem('tiden.station.mode');
       if(saved&&savedMode==='po'&&!po.some(x=>x.uuid===current?.uuid)){mode='po';renderList();selectStation(saved);}
     }
   }catch(e){if(!po.length){$('status').textContent='PEGELONLINE-Stationsliste momentan nicht erreichbar; BSH-Stationen bleiben auswählbar.';$('status').className='small warn';}}
 })();

 // Offizieller BSH-Katalog hat immer Vorrang. Er wird sofort nach dem Laden
 // sichtbar; der ältere Zusatzkatalog darf ihn nicht mehr überschreiben.
 officialTask.then(officialLoaded=>{
    // Bei Ausfall des offiziellen Katalogs bleibt der eingebettete Katalog
    // samt importierten Stationen verfügbar; es gibt keinen Legacy-Download.
   restoreImportedBshStations();renderList();refreshDatabase();
   if($('coastMapCard')?.open)renderMap();
   // Ein Startversuch mit dem noch unvollständigen eingebetteten Katalog kann
   // scheitern. Sobald der vollständige Katalog da ist, gespeicherte Station
   // erneut auflösen und laden.
   const saved=localStorage.getItem('tiden.station.id'),savedMode=localStorage.getItem('tiden.station.mode');
   if(saved&&savedMode!=='po'&&(!currentBsh||String(currentBsh.id)!==String(saved))){
     const match=bshCatalog.find(x=>String(x.id)===String(saved)
       ||archiveCodeForBsh(x)===String(saved).toUpperCase().replace(/^DE__?/,''));
     if(match){mode=savedMode||'all';renderList();selectStation(match.id);}
   }
 });
 archiveTask.then(async items=>{
   if(!items)return;
   try{await addArchiveStationsToCatalog();renderList();refreshDatabase();if($('coastMapCard')?.open)renderMap();}
   catch(e){console.warn('Archivstationen konnten nicht ergänzt werden:',e);}
 });
}
function mapCoastRegion(s){
 // Konservative Küstenklassifizierung:
 // Ein Pegel wird nur dann als Nordsee/Ostsee geführt, wenn sein Gewässer
 // selbst eindeutig küsten-/tidebezogen ist oder bei großen Tideflüssen
 // innerhalb des bekannten tidebeeinflussten Abschnitts liegt.
 // Reine Koordinaten-/Namensheuristiken für Binnenpegel werden bewusst nicht
 // mehr verwendet. Dadurch können z.B. ROGÄTZ, TANGERMÜNDE, WITTENBERGE
 // oder GROPPENBRUCH nicht allein wegen "ELBE"/"EMS" als Küste erscheinen.
 const b=s?.bsh||s||null;
 // Explizite BSH-Region hat Vorrang: sonst kann z. B. Wyk, Föhr
 // durch den Küstenfilter als „Weitere Gewässer“ ausgeblendet werden.
 const bshRegion=norm(b?.region||'');
 if(bshRegion==='nordsee') return 'Nordsee';
 if(bshRegion==='ostsee') return 'Ostsee';
 const water=norm(s?.water?.longname||s?.po?.water?.longname||b?.water?.longname||'');
 const waterShort=norm(s?.water?.shortname||s?.po?.water?.shortname||b?.water?.shortname||'');
 const stationText=norm([s?.longname,s?.shortname,s?.name,b?.name].filter(Boolean).join(' '));
 const agency=norm(s?.agency||s?.po?.agency||b?.agency||'');
 const km=Number(s?.km??s?.po?.km??b?.km);

 // Ostsee: PEGELONLINE führt die entsprechenden Messstellen ausdrücklich
 // am Gewässer OSTSEE bzw. an bekannten Küsten-/Fördengewässern.
 const balticWaters=[
   'ostsee','kieler foerde','kieler förde','flensburger foerde','flensburger förde',
   'schlei','schleimuende','schleimünde','eckernfoerder bucht','eckernförder bucht',
   'luebecker bucht','lübecker bucht','travemuender bucht','travemünder bucht',
   'mecklenburger bucht','warnow','bodden','stettiner haff'
 ];
 if(balticWaters.includes(water)||balticWaters.includes(waterShort))return 'Ostsee';
 // Bei einigen PEGELONLINE-Datensätzen steht die Küstengewässerangabe nicht
 // sauber im water-Feld; die bekannten Ostsee-Küstenstationen dürfen deshalb
 // ergänzend über ihren Stationsnamen erkannt werden.
 if(/^(kiel-holtenau|heiligenhafen|neustadt|kappeln|schleswig|lt kiel|marienleuchte)$/i.test(stationText))return 'Ostsee';

 // Nordsee: eindeutig küstenbezogene Gewässer.
 const northWaters=[
   'nordsee','jade','jadebusen','aussenjade','außenjade','weserästuar',
   'unterweser','unterelbe','aussenelbe','außenelbe','wattenmeer',
   'eider','unterems','osterems','emsästuar','emsästuar','dollart',
   'elbe-seitenkanal' // bleibt weiter unten ohne Treffer, dient nur der Klarheit
 ];
 if(northWaters.includes(water)||northWaters.includes(waterShort)){
   // Ein Elbe-/Weser-/Ems-Name im water-Feld allein ist noch kein Freibrief;
   // diese Fälle werden weiter unten anhand von Flusskilometer/Abschnitt geprüft.
   if(!['unterelbe','aussenelbe','außenelbe','unterweser','weserästuar','unterems','osterems','emsästuar','emsästuar'].includes(water)){
     return 'Nordsee';
   }
 }

 // Tidebeeinflusste Großgewässer: nur die küstennahen Abschnitte.
 // ELBE: ab dem Bereich Geesthacht (km ~583) stromabwärts.
 if(water==='elbe'||waterShort==='elbe'){
   if(Number.isFinite(km) && km>=583) return 'Nordsee';
   return 'Weitere Gewässer';
 }
 // WESER: der küsten-/tidebeeinflusste Abschnitt liegt im unteren Weserlauf.
 if(water==='weser'||waterShort==='weser'){
   if(Number.isFinite(km) && km<=100) return 'Nordsee';
   return 'Weitere Gewässer';
 }
 // EMS: nur die vom WSA EMS-NORDSEE betreuten unteren Ems-Pegel werden
 // berücksichtigt; Binnenstationen wie LINGEN-DARME werden ausgeschlossen.
 if(water==='ems'||waterShort==='ems'){
   if(agency.includes('ems-nordsee') && Number.isFinite(km) && km<=80) return 'Nordsee';
   return 'Weitere Gewässer';
 }
 // Dortmund-Ems-Kanal, Datteln-Hamm-Kanal usw. sind Binnenwasserstraßen,
 // auch wenn ihr Name "Ems" enthält.
 return 'Weitere Gewässer';
}
function stationRegion(s){
 const r=mapCoastRegion(s);
 if(r!=='Weitere Gewässer')return r;
 return 'Weitere Gewässer';
}
function isCoastalStation(s){ return stationRegion(s)==='Nordsee'||stationRegion(s)==='Ostsee'; }
function stationSearchText(s){
 const parts=[];
 const add=v=>{if(v!==undefined&&v!==null&&String(v).trim())parts.push(String(v));};
 add(s.longname);add(s.shortname);add(s.name);add(s.number);add(s.pegelNr);add(s.pegelnr);add(s.pegelnummer);add(s.pegelonlineNumber);add(s.uuid);add(s.waterUuid);add(s.region);add(s.water?.longname);add(s.water?.shortname);add(s.water?.name);
 if(s.bsh){add(s.bsh.id);add(s.bsh.name);add(s.bsh.pegelNr);add(s.bsh.pegelnr);add(s.bsh.pegelnummer);add(s.bsh.waterPegelNr);add(s.bsh.pegelonlineNumber);add(s.bsh.waterUuid);add(s.bsh.region);add(s.bsh.bshUrl);}
 if(s.po){add(s.po.longname);add(s.po.shortname);add(s.po.name);add(s.po.number);add(s.po.pegelNr);add(s.po.pegelnr);add(s.po.uuid);add(s.po.region);add(s.po.water?.longname);add(s.po.water?.shortname);add(s.po.water?.name);}
 return norm(parts.join(' '));
}
const stationRenderCache=new WeakMap();
function stationRenderData(s){
 let cached=stationRenderCache.get(s);
 if(!cached){
   cached={search:stationSearchText(s),region:stationRegion(s)};
   stationRenderCache.set(s,cached);
 }
 return cached;
}
function renderList(){
 const q=norm($('search').value.trim());
 let arr=mode==='po'?po:bshCatalog;
 if(mode==='north') arr=arr.filter(s=>s.region==='Nordsee');
 if(mode==='baltic') arr=arr.filter(s=>s.region==='Ostsee');
 arr=arr.filter(s=>{const txt=stationRenderData(s).search;return !q||txt.includes(q)});
 if(mode!=='po'){
   arr.sort((a,b)=>{
     if(mode==='all'){
       const order={Nordsee:0,Ostsee:1,'Weitere Gewässer':2};
       const ar=stationRenderData(a).region,br=stationRenderData(b).region;
       const regionDiff=(order[ar]??3)-(order[br]??3);
       if(regionDiff)return regionDiff;
     }
     return String(a.name||'').localeCompare(String(b.name||''),'de');
   });
 }
 const limited=arr.slice(0,500); let html=''; let last='';
 for(const s of limited){
   const reg=stationRenderData(s).region; if(mode==='all'&&reg!==last){html+=`<div class="stationgroup">${esc(reg)}</div>`;last=reg;}
   let id=mode==='po'?s.uuid:s.id;
   const sourceLabel=mode==='po'?'· Wasserstand':'· BSH Tide';
   html+=`<div class="stationitem" data-id="${esc(id)}" role="button" tabindex="0"><b>${esc(mode==='po'?label(s):s.name||'Unbenannte BSH-Station')}</b><div class="small">${esc(mode==='po'?(s.number||''):(s.bshnr||s.id||''))} ${sourceLabel}</div></div>`;
 }
 $('stationList').innerHTML=html||'<div class="stationitem">Keine Treffer</div>';
 $('stationList').onclick=(ev)=>{const item=ev.target.closest('.stationitem[data-id]');if(!item)return;ev.preventDefault();selectStation(item.dataset.id);};
 $('stationList').onkeydown=(ev)=>{if(ev.key!=='Enter'&&ev.key!==' ')return;const item=ev.target.closest('.stationitem[data-id]');if(!item)return;ev.preventDefault();selectStation(item.dataset.id);};
 $('dbInfo').textContent=`${arr.length} Stationen im aktuellen Bereich · PEGELONLINE ${po.length} Messstellen · BSH ${bshCatalog.length} Tide-Stationen`;
}
let stationSelectionToken=0;
async function selectStation(id){
 const selectionToken=++stationSelectionToken;
 const selectionIsCurrent=()=>selectionToken===stationSelectionToken;
 try{
 if(mode==='po'){
   current=po.find(s=>s.uuid===id);
   if(!current){$('status').textContent='PEGELONLINE-Station konnte nicht gefunden werden.';$('status').className='small error';return;}
   modeForSelection=null;
 }else{
   const requestedId=String(id||'').trim();
   const requestedCode=requestedId.toUpperCase().replace(/^DE__?/,'');
   // Stationslisten können je nach Herkunft die interne ID (DE__634P)
   // oder die offizielle BSH-Kennung (634P) liefern. Beide müssen
   // zuverlässig auf denselben offiziellen Katalogeintrag zeigen.
   current=bshCatalog.find(s=>String(s.id||'')===requestedId)
     ||bshCatalog.find(s=>archiveCodeForBsh(s)===requestedCode
       ||String(s.bshnr||s.bshNr||'').trim().toUpperCase()===requestedCode);
   if(!current){$('status').textContent='BSH-Station konnte nicht gefunden werden (Kennung: '+requestedId+').';$('status').className='small error';return;}
   id=current.id;
   const linkedPo=findPoForBsh(current);
   modeForSelection={key:canonicalBshId(current)||current.id,name:current.name,bsh:current,po:linkedPo||null};
 }
 storageSet('tiden.station.id',id);storageSet('tiden.station.mode',mode);
 $('stationName').textContent=modeForSelection?(modeForSelection.name||modeForSelection.bsh?.name||'Station'):label(current); $('stationMeta').textContent=modeForSelection?'BSH · '+(modeForSelection.bsh?.bshnr||modeForSelection.bsh?.id||'')+(modeForSelection.po?' · PEGELONLINE verknüpft':''):'PEGELONLINE · '+(current.water?.longname||'');
 $('gaugeLink').href=(modeForSelection?.po?.number||current.number)?`https://pegelonline.wsv.de/gast/stammdaten?pegelnr=${encodeURIComponent(modeForSelection?.po?.number||current.number)}`:'#';
 $('bshLink').href=(modeForSelection?.bsh?.bshUrl||currentBsh?.bshUrl||'https://gezeiten.bsh.de/'); $('bshLink').target='_blank'; $('bshLink').rel='noopener noreferrer';
 data=[];meta=null;selectedYear=null;poCurrent=null;
 // Vorherige Quellenanzeige beim Stationswechsel zurücksetzen.
 $('bshSourceStatus').textContent='';
 $('bshSourceStatus').className='small';
 // Bei einer Auswahl aus der zusammengeführten Liste ist bsh:null eine bewusste
 // Aussage: dieser PEGELONLINE-Pegel hat keine BSH-Zuordnung. Nicht erneut raten,
 // sonst kann eine vorherige/falsche BSH-Quelle (z. B. Husum) hängen bleiben.
 let bsh=modeForSelection ? (modeForSelection.bsh||null) : null;
 let poStation=modeForSelection ? (modeForSelection.po||null) : current;
 if(bsh){currentBsh=bsh}else{currentBsh=null}
 if(poStation){poCurrent=poStation}
 updateBshTxtDownload();
 if(!bsh){
   $('bshSourceStatus').textContent='Für diese Pegelstelle ist keine BSH-Tidequelle zugeordnet.';
   $('bshSourceStatus').className='small';
 }
 updateSources(); syncFavorite(); renderQuality();
 let years=[];
 let archiveYearsPromise=Promise.resolve([]);
 if(bsh){
   // v46.70: beim Wiederöffnen der Home-Bildschirm-App lokale Importjahre erneut aus localStorage lesen.
   refreshImportedBshCatalog(bsh.id);
   // Lokale BSH-Jahre sofort anzeigen. Online-Archivjahre werden nach
   // dem ersten Stationsaufbau asynchron ergänzt und blockieren die Auswahl nicht.
   years=[...new Set([...(bsh.years||[]).map(Number),...Object.keys(bsh.files||{}).map(Number)])].filter(Number.isFinite).sort((a,c)=>a-c);
   archiveYearsPromise=getBshArchiveCatalog()
     .then(items=>archiveRecordsForStation(bsh,items).map(x=>Number(x.datenjahr)).filter(Number.isFinite))
     .catch(e=>{console.warn('BSH-Archivjahre konnten nicht geladen werden:',e);return []});
   let preferredYear=null;
   try{
     const last=JSON.parse(localStorage.getItem('tiden.lastBshImport')||'null');
     if(last&&last.year&&loadLocalBsh(bsh.id,Number(last.year))) preferredYear=Number(last.year);
   }catch(_){}
   $('year').innerHTML=years.length?years.map(y=>`<option value="${y}">${y}</option>`).join(''):'<option>–</option>';
   const currentCalendarYear=Number(localDate().slice(0,4));
   selectedYear=years.includes(currentCalendarYear)?currentCalendarYear:((preferredYear&&years.includes(preferredYear))?preferredYear:(years.length?years[years.length-1]:null));
   if(selectedYear){
     $('year').value=String(selectedYear);
     const currentDate=String($('date').value||'');
     if(Number(selectedYear)===currentCalendarYear){
       $('date').value=localDate();
     }else if(Number(currentDate.slice(0,4))!==Number(selectedYear)){
       const first=loadLocalBsh(bsh.id,selectedYear)?.events?.find(e=>String(e.datetime||'').slice(0,4)===String(selectedYear));
       $('date').value=first?String(first.datetime).slice(0,10):`${selectedYear}-01-01`;
     }
     await loadBshYear();
     if(!selectionIsCurrent())return;
   }
 }
 else{$('year').innerHTML='<option>–</option>';}
 if(!selectionIsCurrent())return;
 render(); await loadWater(selectionToken); if(!selectionIsCurrent())return;
 await loadHistory(selectionToken); if(!selectionIsCurrent())return;
 await loadForecast(selectionToken);
 if(bsh){
   const archiveYears=await archiveYearsPromise;
   if(!selectionIsCurrent())return;
   const mergedYears=[...new Set([...years,...archiveYears])].filter(Number.isFinite).sort((a,c)=>a-c);
   if(mergedYears.length!==years.length){
     const currentYear=selectedYear;
     $('year').innerHTML=mergedYears.map(y=>`<option value="${y}">${y}</option>`).join('');
     selectedYear=mergedYears.includes(Number(currentYear))?Number(currentYear):mergedYears[mergedYears.length-1];
     $('year').value=String(selectedYear);
   }
 }
 }catch(e){console.error(e);$('status').textContent='Fehler beim Öffnen der Station: '+(e&&e.message||e);$('status').className='small error';}
}
let currentBsh=null, modeForSelection=null;
function parseBshTxtText(text, filename='BSH-TXT'){
 const get=(patterns,def='')=>{for(const re of patterns){const m=text.match(re);if(m)return m[1].trim()}return def};
 const pegel=get([/^A03#.*?#\s*([^#]+?)\s*#/m,/PegelNr\.\s*:\s*([^\s#]+)\s*/m,/Pegelnummer\s*:\s*([^\s#]+)\s*/m]);
 const station=get([/^A04#.*?#\s*([^#]+?)\s*#/m,/GT-Name\s*:\s*([^\r\n#]+)/m,/Standort\s+([^\r\n#]+)/m],filename.replace(/\.txt$/i,''));
 const ym=get([/^A06#.*?#\s*(\d{4})\s*#/m,/GT-Jahr\s*:\s*(\d{4})/m]);
 const tz=get([/^A11#.*?#\s*([^#]+?)\s*#/m,/Zeitzone\s*:\s*([^\r\n]+)/m]);
 const ref=get([/^C03#.*?#\s*([^#]+?)\s*#/m,/Höhenniveau\s*:\s*([^\r\n]+)/m]);
 const unit=get([/^C05#.*?#\s*([^#]+?)\s*#/m,/EinheitHöhe\s*:\s*([^\r\n]+)/m],'m');
 const pos=get([/^A08#.*?#\s*([^#]+?)\s*#/m], '');
 function parseDms(v,dir){const m=String(v||'').match(/(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)''\s*([NSWE])/i);if(!m)return null;let n=Number(m[1])+Number(m[2])/60+Number(m[3])/3600;return /[SW]/i.test(m[4])?-n:n}
 const pm=pos.match(/(\d+°\s*\d+'\s*\d+(?:\.\d+)?''\s*[NS])\s+(\d+°\s*\d+'\s*\d+(?:\.\d+)?''\s*[EW])/i);
 const latitude=pm?parseDms(pm[1],'N'):null, longitude=pm?parseDms(pm[2],'E'):null;
 // BSH-VB2-Zeilen sind nicht immer gleich aufgebaut. Vor H/N können z.B.
 // #H#, #0#H#, #1#H# usw. stehen. Deshalb wird H/N als Ereignismarker
 // gesucht und Datum, Uhrzeit und Höhe anschließend aus derselben Zeile gelesen.
 const events=[];
 const lines=String(text||'').split(/\r?\n/);
 const dateRe=/(\d{1,2})\.\s*(\d{1,2})\.(\d{4})/;
 const timeRe=/(\d{1,2}):(\d{2})/;
 const heightRe=/(-?\d+(?:[\.,]\d+)?)(?=\s*(?:#|$|[A-Za-z]))/;
 for(const line of lines){
   if(!/^VB2#/i.test(line)) continue;
   const parts=line.split('#');
   const markerIndex=parts.findIndex(x=>/^\s*[HN]\s*$/i.test(x));
   if(markerIndex<0) continue;
   const typ=parts[markerIndex].trim().toUpperCase()==='H'?'HW':'NW';
   const rest=parts.slice(markerIndex+1).join('#');
   const dm=rest.match(dateRe), tm=rest.match(timeRe);
   if(!dm||!tm) continue;
   const afterTime=rest.slice((tm.index||0)+tm[0].length);
   const hm=afterTime.match(heightRe) || afterTime.match(/(-?\d+(?:[\.,]\d+)?)/);
   if(!hm) continue;
   const height=Number(hm[1].replace(',','.'));
   if(!Number.isFinite(height)) continue;
   events.push({datetime:`${dm[3]}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}T${String(tm[1]).padStart(2,'0')}:${tm[2]}`,type:typ,height});
 }
 events.sort((a,b)=>a.datetime.localeCompare(b.datetime));
 const seen=new Set();
 const unique=events.filter(e=>{const k=e.datetime+'|'+e.type+'|'+e.height;if(seen.has(k))return false;seen.add(k);return true});
 const year=ym?Number(ym):(unique[0]?Number(unique[0].datetime.slice(0,4)):null);
 return {station:cleanStationName(station),pegelNr:pegel,year,timezone:tz,reference:ref||'PNP',unit,latitude,longitude,source:'BSH',events:unique,eventCount:unique.length,filename};
}
function localBshKey(id,year){return `tiden.bsh.import.${id}.${year}`}
function bshEquivalentIds(idOrRecord){
 if(String(idOrRecord||'').trim()==='DE_3020P'){return ['KIEL-HOLTENAU','DE_3020P','9610066']}
 const src=typeof idOrRecord==='string'?bshCatalog.find(x=>x.id===idOrRecord)||EMBEDDED_BSH_CATALOG.find(x=>x.id===idOrRecord):idOrRecord;
 const ids=[];
 const add=v=>{v=String(v||'').trim();if(v&&!ids.includes(v))ids.push(v)};
 if(!src)return ids;
 add(src.id);
 if(String(src.id||'')==='KIEL-HOLTENAU')add('DE_3020P'); add(src.pegelNr); add(src.pegelnummer); add(src.pegelnr); add(src.pegelonlineNumber);
 const name=norm(src.name||src.station||'');
 const num=String(src.waterPegelNr||src.pegelonlineNumber||'');
 const uuid=String(src.waterUuid||src.uuid||'');
 const all=[...bshCatalog,...EMBEDDED_BSH_CATALOG];
 for(const b of all){
   const bn=norm(b.name||'');
   const sameName=name.length>4&&bn.length>4&&(bn===name||bn.includes(name)||name.includes(bn));
   const sameNum=num&&String(b.waterPegelNr||b.pegelonlineNumber||'')===num;
   const sameUuid=uuid&&String(b.waterUuid||b.uuid||'')===uuid;
   if(sameName||sameNum||sameUuid){add(b.id);add(b.pegelNr);add(b.pegelnummer);add(b.pegelnr);add(b.pegelonlineNumber)}
 }
 return ids;
}
function canonicalBshId(idOrRecord){
 const rawId=String(typeof idOrRecord==='string'?idOrRecord:(idOrRecord?.id||'' )).trim();
 if(rawId==='DE_3020P'||rawId==='KIEL-HOLTENAU')return 'KIEL-HOLTENAU';
 const src=typeof idOrRecord==='string'?bshCatalog.find(x=>x.id===idOrRecord)||EMBEDDED_BSH_CATALOG.find(x=>x.id===idOrRecord):idOrRecord;
 const name=norm(src?.name||src?.station||'');
 const num=String(src?.waterPegelNr||src?.pegelonlineNumber||src?.pegelNr||src?.pegelnummer||src?.pegelnr||src?.importedPegelNr||src?.number||'');
 const uuid=String(src?.waterUuid||src?.uuid||'');
 // Alle bekannten Darstellungen von Kiel-Holtenau müssen auf genau EINEN
 // BSH-Katalogeintrag zeigen. Das ist absichtlich auch namensbasiert, damit
 // alte Katalogvarianten wie „Kiel, Holtenau, Ostsee“ keinen zweiten Eintrag
 // erzeugen können.
 if(name.includes('kiel holtenau') || name.includes('kiel holtenau ostsee') || num==='9610066' || num==='DE_3020P' || uuid==='3ad4013f-644b-47f5-a641-44b332bfecb2') return 'KIEL-HOLTENAU';
 const ids=bshEquivalentIds(idOrRecord);
 if(ids.includes('KIEL-HOLTENAU') || ids.includes('DE_3020P') || ids.includes('9610066')) return 'KIEL-HOLTENAU';
 const match=[...bshCatalog,...EMBEDDED_BSH_CATALOG].find(b=>{
   const bn=norm(b.name||'');
   return (num&&String(b.waterPegelNr||b.pegelonlineNumber||'')===num)||(uuid&&String(b.waterUuid||b.uuid||'')===uuid)||(name.length>4&&bn.length>4&&(bn===name||bn.includes(name)||name.includes(bn)));
 });
 return match?.id||src?.id||src?.pegelNr||null;
}
function loadLocalBsh(id,year){
 const ids=[canonicalBshId(id),...bshEquivalentIds(id),String(id||'')].filter(Boolean);
 // Zuerst die bekannten, schnellen Schlüssel prüfen.
 for(const keyId of [...new Set(ids)]){
   try{const j=JSON.parse(localStorage.getItem(localBshKey(keyId,year))||'null');if(j&&Array.isArray(j.events)&&j.events.length)return j}catch{}
 }
 // Wiederherstellungs-Fallback: ältere Versionen oder zusammengeführte Stationen
 // können denselben Import unter einer abweichenden Pegel-ID abgelegt haben.
 // Daher gespeicherte BSH-Datensätze nach Jahr und Stationskennung durchsuchen.
 try{
   const target=typeof id==='string'?(bshCatalog.find(x=>x.id===id)||EMBEDDED_BSH_CATALOG.find(x=>x.id===id)||{id}):id;
   const targetName=norm(target?.name||target?.station||'');
   const targetPegel=String(target?.importedPegelNr||target?.pegelNr||target?.pegelnummer||target?.pegelnr||target?.waterPegelNr||target?.pegelonlineNumber||'').trim();
   for(let i=0;i<localStorage.length;i++){
     const key=localStorage.key(i); if(!/^tiden\.bsh\.import\./.test(String(key||'')))continue;
     try{
       const j=JSON.parse(localStorage.getItem(key)||'null');
       if(!j||!Array.isArray(j.events)||!j.events.length||Number(j.year)!==Number(year))continue;
       const jp=String(j.pegelNr||'').trim();
       const jn=norm(j.station||'');
       const samePegel=targetPegel&&jp&&targetPegel===jp;
       const sameName=targetName.length>4&&jn.length>4&&(targetName===jn||targetName.includes(jn)||jn.includes(targetName));
       const sameCanonical=canonicalBshId(j)===canonicalBshId(target);
       if(samePegel||sameName||sameCanonical)return j;
     }catch{}
   }
 }catch{}
 return null;
}
function refreshImportedBshCatalog(idOrRecord){
 const ids=[canonicalBshId(idOrRecord),...bshEquivalentIds(idOrRecord),String(typeof idOrRecord==='string'?idOrRecord:'')].filter(Boolean);
 const b=bshCatalog.find(x=>x.id===canonicalBshId(idOrRecord))||bshCatalog.find(x=>x.id===idOrRecord); if(!b)return;
 const years=new Set((b.years||[]).map(Number));
 for(const keyId of [...new Set(ids)]) for(let y=2020;y<=2100;y++){if(localStorage.getItem(localBshKey(keyId,y)))years.add(y)}
 b.years=[...years].sort((a,c)=>a-c);
}
function ensureImportedBshStation(d){
 const sourceId=String(d.pegelNr||'').trim() || String(d.station||'').trim() || d.filename.replace(/\.txt$/i,'');
 const canonicalId=canonicalBshId(d);
 let b=bshCatalog.find(x=>x.id===canonicalId);
 if(!b){
   b={id:canonicalId||sourceId,name:d.station||canonicalId||sourceId,region:mapCoastRegion(d),latitude:d.latitude,longitude:d.longitude,files:{},years:[],bshAvailable:true,bshUrl:'https://gezeiten.bsh.de/kiel_holtenau'};
   bshCatalog.push(b);
 }else{
   b.name=d.station||b.name||canonicalId||sourceId;
   b.region=mapCoastRegion({...b,...d});
   if(Number.isFinite(Number(d.latitude)))b.latitude=Number(d.latitude);
   if(Number.isFinite(Number(d.longitude)))b.longitude=Number(d.longitude);
   b.files=b.files||{};
   b.years=b.years||[];
 }
 if(d.year&&!b.years.includes(d.year))b.years.push(d.year),b.years.sort((a,c)=>a-c);
 b.imported=true;
 b.importedPegelNr=d.pegelNr||sourceId;
 b.importedSourceId=sourceId;
 dedupeBshCatalog();
 b=bshCatalog.find(x=>x.id===canonicalId)||b;
 return {id:b.id,b,sourceId};
}
async function importBshFile(file){
 if(!file) throw Error('Bitte zuerst eine BSH-TXT-Datei auswählen.');
 // Vor dem Import merken wir uns die aktuelle Station, damit ein späteres Entfernen
 // des Imports wieder auf die vorherige/default Station zurückkehren kann.
 if(!localStorage.getItem('tiden.preImportStation')){
   // Die sichtbare Stationsauswahl hat Vorrang vor gespeicherten Werten:
   // Küstenverzeichnis-/Favoriten-Auswahlen können den lokalen Schlüssel ändern,
   // bevor ein Archivimport startet.
   const liveId=modeForSelection?.key||((mode==='bsh')?current?.id:((mode==='po')?current?.uuid:null));
   const sid=liveId||localStorage.getItem('tiden.station.id')||'KIEL-HOLTENAU';
   const sm=localStorage.getItem('tiden.station.mode')||mode||'all';
   storageSet('tiden.preImportStation',JSON.stringify({id:sid,mode:sm}));
 }
 const text=await file.text(); const d=parseBshTxtText(text,file.name);
 if(!d.events.length) throw Error('Keine HW/NW-Datensätze gefunden. Bitte die BSH-TXT-Datei „Hoch-/Niedrigwasser“ auswählen.');
 if(!d.year) throw Error('Jahr konnte aus der BSH-Datei nicht gelesen werden.');
 const {id,b,sourceId}=ensureImportedBshStation(d);
 storageSet(localBshKey(id,d.year),JSON.stringify(d));
 // Bestehende Alt-Imports unter der BSH-Pegelkennung bleiben als Fallback erhalten.
 if(sourceId!==id && localStorage.getItem(localBshKey(sourceId,d.year))){}
 storageSet('tiden.lastBshImport',JSON.stringify({id,sourceId,year:d.year,filename:d.filename||file.name}));
 refreshImportedBshCatalog(id);
 $('bshImportInfo').innerHTML=`<span class="ok">✓ BSH ${d.year} importiert: ${d.eventCount} HW/NW-Ereignisse · ${esc(d.station||id)} · ${esc(d.pegelNr||'Pegelnummer nicht erkannt')}</span>`;
 $('bshRemoveBtn').disabled=false;$('bshRemoveStatusBtn').style.display='inline-block';
 mode='bsh';
 renderList();
 await selectStation(id);
 // Nach einem Import das importierte Jahr ausdrücklich aktivieren.
 // selectStation() kann zunächst das zuletzt bekannte Stationsjahr auswählen.
 if(currentBsh && String(currentBsh.id)===String(id)){
   let option=[...$('year').options].find(o=>Number(o.value)===Number(d.year));
   if(!option){option=document.createElement('option');option.value=String(d.year);option.textContent=String(d.year);$('year').appendChild(option);}
   selectedYear=Number(d.year);$('year').value=String(d.year);
   const selectedDate=String($('date').value||'');
   const parts=selectedDate.split('-').map(Number);const month=parts[1]||1,day=parts[2]||1;
   const candidate=`${selectedYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   const check=new Date(`${candidate}T12:00:00`);
   $('date').value=(check.getFullYear()===selectedYear&&check.getMonth()+1===month&&check.getDate()===day)?candidate:`${selectedYear}-01-01`;
   await loadBshYear();
 }
}

// v47.00: Archivdateien verwenden denselben geprüften Import wie lokale BSH-TXT-Dateien.
window.importBshArchiveText = async function(text, filename){
 if(typeof text!=='string'||!text.trim()) throw Error('Die Archivdatei ist leer.');
 const safeFilename=String(filename||'BSH-TXT.txt').replace(/[\\/\\\\]/g,'_').slice(0,255)||'BSH-TXT.txt';
 const file=new File([text],safeFilename,{type:'text/plain;charset=utf-8'});
 await importBshFile(file);
};
async function removeBshImport(){
 const fileInput=$('bshFile');
 // Vor dem Entfernen die vorherige Stationsauswahl sichern, damit Kiel-Holtenau
 // nicht unabhängig von der vorherigen Auswahl erzwungen wird.
 let previousStation=null;
 try{previousStation=JSON.parse(localStorage.getItem('tiden.preImportStation')||'null')}catch(_){}
 // Das Dateifeld wird immer geleert; zusätzlich wird der zuletzt importierte
 // lokale BSH-Datensatz entfernt, damit der Import nicht dauerhaft aktiv bleibt.
 let last=null;
 try{last=JSON.parse(localStorage.getItem('tiden.lastBshImport')||'null')}catch(_){}
 if(last?.id&&last?.year){
   const ids=[last.id,last.sourceId,canonicalBshId(last.id),...bshEquivalentIds(last.id)].filter(Boolean);
   for(const keyId of [...new Set(ids)]) localStorage.removeItem(localBshKey(keyId,last.year));
   refreshImportedBshCatalog(last.id);
   const canonical=canonicalBshId(last.id);
   const b=bshCatalog.find(x=>x.id===canonical)||bshCatalog.find(x=>x.id===last.id);
   if(b){
     let hasImported=false;
     const ids2=[canonical,...bshEquivalentIds(b)].filter(Boolean);
     for(const keyId of [...new Set(ids2)]) for(let y=2020;y<=2100;y++){if(localStorage.getItem(localBshKey(keyId,y))){hasImported=true;break}}
     if(!hasImported && b.imported){
       const embedded=EMBEDDED_BSH_CATALOG.find(x=>x.id===canonical);
       if(embedded){Object.assign(b,JSON.parse(JSON.stringify(embedded)));}
       else bshCatalog=bshCatalog.filter(x=>x.id!==canonical);
     }
   }
 }
 localStorage.removeItem('tiden.lastBshImport');
 localStorage.removeItem('tiden.preImportStation');
 if(fileInput) fileInput.value='';
 $('bshRemoveBtn').disabled=true;$('bshRemoveStatusBtn').style.display='none';
 $('bshImportInfo').innerHTML='<span class="ok">✓ BSH-Datei entfernt. Der lokale Import wurde zurückgesetzt.</span>';
 const restoreMode=['all','bsh','po'].includes(previousStation?.mode)?previousStation.mode:'all';
 mode=restoreMode;
 $('tabAll').classList.toggle('active',mode==='all');
 $('tabBsh').classList.toggle('active',mode==='bsh');
 $('tabPo').classList.toggle('active',mode==='po');
 renderList();
 // Frühere Auswahl wiederherstellen. Nur wenn keine frühere Auswahl gespeichert
 // ist, bleibt Kiel-Holtenau die normale Startstation.
 const restoreId=previousStation?.id||'KIEL-HOLTENAU';
 await selectStation(restoreId);
 // v46.97: selectStation/loadBshYear kann noch einen alten Importzustand in den
 // Arbeitsspeicher übernehmen. Nach Abschluss deshalb die Tide-Datenanzeige sicher leeren.
 data=[];
 meta=null;
 const bshStatus=$('bshSourceStatus');
 if(bshStatus){
   bshStatus.textContent='Keine lokale BSH-TXT-Datei geladen. Für Hoch-/Niedrigwasser bitte eine passende BSH-Jahresdatei importieren.';
   bshStatus.className='small warn';
 }
 render();
 renderQuality();
}
let bshYearLoadToken=0;
async function loadBshYear(){
 const loadToken=++bshYearLoadToken;
 const requestedStationId=currentBsh?.id||null;
 const requestedYear=Number(selectedYear);
 const requestIsCurrent=()=>loadToken===bshYearLoadToken&&currentBsh?.id===requestedStationId&&Number(selectedYear)===requestedYear;
 if(!currentBsh||!selectedYear){data=[];meta=null;render();renderQuality();return}
 const imported=loadLocalBsh(currentBsh.id,selectedYear); if(imported){meta=imported;data=(imported.events||[]).filter(e=>String(e.datetime||'').slice(0,4)===String(selectedYear)); syncDateToData(); $('bshSourceStatus').textContent=`Datenquelle: Lokale BSH-TXT-Datei · ${imported.filename||'importierte Datei'} · ${imported.station||currentBsh.name} · ${data.length} HW/NW-Ereignisse (${selectedYear}).`; $('bshSourceStatus').className='small ok'; render(); renderQuality(); return;}
 // v46.70: Vor jedem Fallback die vorherige Station/Jahres-Datenbasis verwerfen.
 // Verhindert, dass „Nächste Tide“ nach einem Wechsel weiterhin auf einen alten Import zeigt.
 data=[]; meta=null;
 $('bshSourceStatus').textContent=`Keine lokale BSH-TXT-Datei für ${currentBsh.name} ${selectedYear} importiert. Suche nach einer eingebundenen Jahresdatei …`;
 $('bshSourceStatus').className='small'; render(); renderQuality();
 // Zuerst das produktive Supabase-BSH-Archiv verwenden, sofern für Station/Jahr vorhanden.
 try{
   const archived=await loadBshArchiveYear(currentBsh,selectedYear,requestIsCurrent);
   if(!requestIsCurrent())return;
   if(archived){
     meta=archived.parsed;data=archived.events;syncDateToData();
     $('bshSourceStatus').textContent=`Datenquelle: Supabase-BSH-Archiv · ${archived.parsed.filename||'BSH-TXT'} · ${archived.parsed.station||currentBsh.name} · ${data.length} HW/NW-Ereignisse (${selectedYear}).`;
     $('bshSourceStatus').className='small ok';render();renderQuality();return;
   }
 }catch(e){
   if(!requestIsCurrent())return;
   console.warn('Supabase-BSH-Archiv konnte nicht geladen werden; bisherige Datenpfade werden fortgesetzt:',e);
 }
 // Falls kein Archivdatensatz vorliegt, offiziellen BSH-TXT-Direktdownload versuchen.
 try{
   const official=await loadOfficialBshTxtYear(currentBsh,selectedYear,requestIsCurrent);
   if(!requestIsCurrent())return;
   if(official){meta=official.parsed;data=official.events;syncDateToData();$('bshSourceStatus').textContent=`Datenquelle: offizieller BSH-TXT-Download · ${official.parsed.station||currentBsh.name} · ${data.length} HW/NW-Ereignisse (${selectedYear}).`; $('bshSourceStatus').className='small ok';render();renderQuality();return;}
 }catch(e){if(!requestIsCurrent())return;console.warn('BSH-TXT-Direktdownload nicht verfügbar; bestehende Datenpfade werden fortgesetzt:',e)}
 // v46.70: Gebündelte Kiel-Jahresdatei im GitHub-Hauptverzeichnis laden.
 // Der Dateiname liegt absichtlich neben index.html, damit kein data/-Ordner nötig ist.
 if(currentBsh.id==='KIEL-HOLTENAU' && Number(selectedYear)===2026){
   try{
     const r=await fetch('./KIEL-HOLTENAU2026.json',{cache:'no-store'});
     if(!requestIsCurrent()) return;
     if(!r.ok) throw Error('HTTP '+r.status);
     const j=await r.json();
     if(!requestIsCurrent()) return;
     if(!j||!Array.isArray(j.events)||!j.events.length) throw Error('Keine HW/NW-Ereignisse');
     meta=j; data=j.events.filter(e=>String(e.datetime||'').slice(0,4)===String(selectedYear)); if(!data.length) throw Error('Keine HW/NW-Ereignisse für das ausgewählte Jahr'); syncDateToData();
     $('bshSourceStatus').textContent=`Datenquelle: eingebundene BSH-Jahresdatei · ${j.station||currentBsh.name} · ${data.length} HW/NW-Ereignisse (${selectedYear}).`;
     $('bshSourceStatus').className='small ok'; render(); renderQuality(); return;
   }catch(e){
     if(!requestIsCurrent()) return;
     // Falls die Jahresdatei fehlt oder nicht lesbar ist, mit dem bisherigen BSH-Webpfad fortfahren.
   }
 }
 
// Lokaler BSH-TXT-Fallback aus data/bsh; nur Kiel-Holtenau 2026.
if (currentBsh.id === 'KIEL-HOLTENAU' && Number(selectedYear) === 2026) {
  try {
    const r = await fetch('./data/bsh/DE_3020P2026_hwnw.txt', {cache:'no-store'});
    if (!requestIsCurrent()) return;
    if (!r.ok) throw Error('Lokale BSH-TXT-Datei: HTTP ' + r.status);
    const text = await r.text();
    if (!requestIsCurrent()) return;
    const parsed = parseBshTxtText(text, 'DE_3020P2026_hwnw.txt');
    if (!parsed || !Array.isArray(parsed.events) || !parsed.events.length)
      throw Error('Keine HW/NW-Ereignisse in der lokalen BSH-TXT-Datei');
    const events = parsed.events.filter(e =>
      String(e.datetime || '').slice(0,4) === String(selectedYear));
    if (!events.length) throw Error('Keine Ereignisse für das ausgewählte Jahr');
    meta = parsed;
    data = events;
    syncDateToData();
    $('bshSourceStatus').textContent =
      `Datenquelle: lokale BSH-TXT-Datei · ${parsed.filename} · ${data.length} HW/NW-Ereignisse (${selectedYear}).`;
    $('bshSourceStatus').className = 'small ok';
    render();
    renderQuality();
    return;
  } catch (e) {
    if (!requestIsCurrent()) return;
    // Bei fehlender oder ungültiger lokaler Datei den bisherigen Web-Fallback versuchen.
  }
}

// Kiel-Holtenau: Nach einem vorhandenen lokalen TXT-Import versuchen wir zusätzlich,
 // die BSH-Webtabelle direkt zu lesen. Das klappt nur, wenn BSH/CORS den Browserzugriff zulässt.
 // Der TXT-Import bleibt die zuverlässige Alternative; andere Stationen nutzen ihren normalen Datenpfad.
 if(currentBsh.bshUrl){
   data=[]; meta=null;
   $('bshSourceStatus').textContent=`BSH-Webtabelle für ${currentBsh.name} wird geprüft …`;
   $('bshSourceStatus').className='small'; render(); renderQuality();
   try{
     const r=await fetch(currentBsh.bshUrl,{cache:'no-store'});
     if(!requestIsCurrent()) return;
     if(!r.ok) throw Error('HTTP '+r.status);
     const html=await r.text();
     if(!requestIsCurrent()) return;
     const doc=new DOMParser().parseFromString(html,'text/html');
     const rows=[...doc.querySelectorAll('table tr')];
     const out=[]; let previousDate='';
     for(const tr of rows){
       const c=[...tr.querySelectorAll('th,td')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
       if(c.length<4) continue;
       let date=c[0], time=c[1], height=c[2], event=c[3];
       if(!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) date=previousDate;
       const dm=date.match(/(\d{2})\.(\d{2})\.(\d{4})/), tm=time.match(/(\d{1,2}):(\d{2})/);
       if(!dm||!tm) continue;
       previousDate=`${dm[1]}.${dm[2]}.${dm[3]}`;
       const typ=/\bHW\b|Hochwasser/i.test(event)?'HW':/\bNW\b|Niedrigwasser/i.test(event)?'NW':null;
       const h=Number(String(height).replace(',','.').replace(/[^0-9+\-.]/g,''));
       if(!typ||!Number.isFinite(h)) continue;
       out.push({datetime:`${dm[3]}-${dm[2]}-${dm[1]}T${String(tm[1]).padStart(2,'0')}:${tm[2]}`,type:typ,height:h,displayDate:previousDate});
     }
     const events=out.filter(e=>e.datetime.startsWith(String(selectedYear)));
     if(!events.length) throw Error('Keine HW/NW-Zeilen für das gewählte Jahr gefunden');
     data=events.filter(e=>String(e.datetime||'').slice(0,4)===String(selectedYear)); meta={station:currentBsh.name,year:selectedYear,reference:'SKN',timezone:'Gesetzliche Zeit / BSH-Tabelle',source:'BSH online',eventCount:data.length};
     syncDateToData();
     $('bshSourceStatus').textContent=`Datenquelle: BSH-Webtabelle · ${events.length} HW/NW-Ereignisse (${selectedYear}). Bitte Werte prüfen; bei Fehlern die BSH-TXT-Datei importieren.`;
     $('bshSourceStatus').className='small ok'; render(); renderQuality(); return;
   }catch(e){
     if(!requestIsCurrent()) return;
     data=[]; meta=null;
     $('bshSourceStatus').textContent=`BSH-Webtabelle für ${currentBsh.name} konnte nicht automatisch gelesen werden. Bitte „BSH Text importieren“ verwenden.`;
     $('bshSourceStatus').className='small warn'; render(); renderQuality(); return;
   }
 }
 const file=(currentBsh.files||{})[String(selectedYear)] || `data/${currentBsh.id}${selectedYear}.json`;
 // Falls im GitHub-Projekt eine separate Jahresdatei liegt, darf sie geladen werden;
 // die Jahresdaten werden nicht mehr als großer Datenblock in index.html gespeichert.
 try{
   const r=await fetch(file,{cache:'no-store'});
   if(!requestIsCurrent()) return;
   if(!r.ok) throw Error('HTTP '+r.status);
   const j=await r.json();
   if(!requestIsCurrent()) return;
   if(!j||!Array.isArray(j.events)||!j.events.length) throw Error('Keine HW/NW-Ereignisse');
   meta=j; data=j.events.filter(e=>String(e.datetime||'').slice(0,4)===String(selectedYear)); if(!data.length) throw Error('Keine HW/NW-Ereignisse für das ausgewählte Jahr'); syncDateToData();
   $('bshSourceStatus').textContent=`Datenquelle: separate BSH-Jahresdatei · ${j.station||currentBsh.name} · ${data.length} HW/NW-Ereignisse (${selectedYear}).`;
   $('bshSourceStatus').className='small ok'; render(); renderQuality();
 }catch(e){
   if(!requestIsCurrent()) return;
   data=[]; meta=null;
   $('bshSourceStatus').textContent=`Keine BSH-Daten für ${currentBsh.name} ${selectedYear} geladen. Bitte die passende BSH-TXT-Datei importieren.`;
   $('bshSourceStatus').className='small warn'; render(); renderQuality();
 }
}
const FIXED_WATER_STATIONS={
 'KIEL-HOLTENAU':{uuid:'3ad4013f-644b-47f5-a641-44b332bfecb2',number:'9610066',longname:'KIEL-HOLTENAU',water:{longname:'OSTSEE'}}
};
function getWaterStation(){
 const b=currentBsh||modeForSelection?.bsh;
 if(b?.id==='KIEL-HOLTENAU') return FIXED_WATER_STATIONS['KIEL-HOLTENAU'];
 return poCurrent||((mode==='po')?current:null);
}
function waterCacheKey(uuid){return 'tiden.water.'+uuid}
function historyCacheKey(uuid,range){return 'tiden.water.history.'+uuid+'.'+range}
function showCachedWater(uuid){try{const j=JSON.parse(localStorage.getItem(waterCacheKey(uuid))||'null');if(!j)return false;const val=Number(j.value),ts=j.timestamp?new Date(j.timestamp):null;if(!Number.isFinite(val)||!ts)return false;$('water').textContent=(val/100).toFixed(2)+' m';$('waterTime').textContent=ts.toLocaleString('de-DE')+' · zuletzt gespeichert';$('waterTime').title='Alter der gespeicherten Messung: '+Math.round(Math.max(0,Date.now()-ts.getTime())/60000)+' min';return true}catch{return false}}
let waterLoadToken=0,forecastLoadToken=0,historyLoadToken=0;
async function loadWater(selectionToken=stationSelectionToken){
 const requestToken=++waterLoadToken;
 const requestIsCurrent=()=>selectionToken===stationSelectionToken&&requestToken===waterLoadToken;
 let st=getWaterStation(),uuid=st?.uuid;
 if(!uuid){$('water').textContent='–';$('waterTime').textContent='Keine PEGELONLINE-Zuordnung';return}
 try{
  const r=await poFetch(`/stations/${uuid}/W/currentmeasurement.json`,{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const j=await r.json();
  if(!requestIsCurrent()||getWaterStation()?.uuid!==uuid)return;
  const val=Number(j.value),ts=j.timestamp?new Date(j.timestamp):null;
  if(!Number.isFinite(val))throw Error('Ungültiger Messwert');
  storageSet(waterCacheKey(uuid),JSON.stringify(j));
  $('water').textContent=(val/100).toFixed(2)+' m';$('waterTime').textContent=ts?ts.toLocaleString('de-DE'):'–'; const mp=$('mapPopup'); if(mp?.classList.contains('visible')&&String(window._tideMapSelectedUuid||'')===String(uuid)){const w=mp.querySelector('.mapPopupWater');if(w)w.textContent=(val/100).toFixed(2)+' m';}
  const age=ts?Math.max(0,Date.now()-ts.getTime()):null;$('waterTime').title=age!==null?'Alter der Messung: '+Math.round(age/60000)+' min':'';
  $('status').textContent=age!==null&&age>25*3600*1000?'Wasserstand geladen – Messwert älter als 25 Stunden.':'Wasserstand aktuell geladen.';$('status').className='small ok';
 }catch(e){
  if(!requestIsCurrent()||getWaterStation()?.uuid!==uuid)return;
  if(showCachedWater(uuid)){$('status').textContent='Internet/API momentan nicht erreichbar – letzter gespeicherter Wasserstand wird angezeigt.';$('status').className='small warn'}
  else{$('water').textContent='–';$('waterTime').textContent='';$('status').textContent='Aktueller Wasserstand momentan nicht erreichbar.';$('status').className='small warn'}
 }
}
function stationKind(){
 const r=stationRegion(modeForSelection||current||{});
 const b=modeForSelection?.bsh||findBshForPo(current||{});
 if(r==='Ostsee') return 'waterlevel';
 if(b) return 'tide';
 return 'waterlevel';
}
function getUuid(){ const st=getWaterStation(); return st?.uuid||modeForSelection?.po?.uuid||current?.uuid||null; }
function bshForecastUrl(){
 const n=norm(modeForSelection?.name||current?.longname||current?.shortname||'');
 const map={'kiel-holtenau':'kiel-holtenau','kappeln':'kappeln','schleswig':'schleswig','schleimünde':'schleimuende','schleimuende':'schleimuende'};
 for(const k in map) if(n.includes(k)) return 'https://wasserstand.bsh.de/'+map[k];
 return 'https://wasserstand.bsh.de/';
}
async function loadForecast(selectionToken=stationSelectionToken){
 const requestToken=++forecastLoadToken;
 const requestIsCurrent=()=>selectionToken===stationSelectionToken&&requestToken===forecastLoadToken;
 const kind=stationKind(), uuid=getUuid();
 const card=$('forecastCard'); if(!card)return;
 $('bshForecastLink').href=bshForecastUrl();
 if(kind==='tide' && stationRegion(modeForSelection||current||{})==='Nordsee'){
   $('forecastSubtitle').textContent='Für diese Nordsee-Tidestelle sind BSH-HW/NW-Daten maßgeblich.';
 } else $('forecastSubtitle').textContent='PEGELONLINE-WV und BSH-Ostsee-Vorhersage, sofern verfügbar';
 let rendered=false;
 if(uuid){
   try{
     const url=`${API}/stations/${uuid}/WV/measurements.json`;
     const r=await poFetch(url.replace(API,''),{cache:'no-store'}); if(!r.ok)throw Error('HTTP '+r.status);
     const j=await r.json(); if(!requestIsCurrent()||getUuid()!==uuid)return; const arr=Array.isArray(j)?j:[];
     if(arr.length){
       storageSet('tiden.forecast.'+uuid,JSON.stringify({savedAt:Date.now(),items:arr}));
       renderForecast(arr,'PEGELONLINE · WV'); rendered=true;
     }
   }catch(e){
     if(!requestIsCurrent()||getUuid()!==uuid)return;
     try{const c=JSON.parse(localStorage.getItem('tiden.forecast.'+uuid)||'null'); if(c?.items?.length){renderForecast(c.items,'PEGELONLINE · WV · Cache');rendered=true;}}
     catch(_){ }
   }
 }
 if(!rendered){
   $('forecast').innerHTML=stationRegion(modeForSelection||current||{})==='Ostsee'
     ? '<div class="small">Für diese Station ist derzeit keine abrufbare PEGELONLINE-WV-Zeitreihe verfügbar. Die amtliche BSH-Ostsee-Wasserstandsvorhersage kann über den Button geöffnet werden.</div>'
     : '<div class="small">Keine separate Wasserstandsvorhersage verfügbar.</div>';
   $('forecastInfo').textContent='';
 }
}
function renderForecast(arr,source){
 const pts=arr.map(x=>({t:new Date(x.timestamp),v:Number(x.value),type:x.type||''})).filter(x=>!isNaN(x.t)&&isFinite(x.v)).sort((a,b)=>a.t-b.t);
 if(!pts.length){$('forecast').innerHTML='';return;}
 const first=pts[0],last=pts[pts.length-1];
 const upcoming=pts.filter(x=>x.t.getTime()>=Date.now()).slice(0,6);
 let html='<div class="small"><b>Vorhersagewerte</b> · '+esc(source)+'</div>';
 if(upcoming.length) html+='<div style="margin-top:8px">'+upcoming.map(x=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #edf1f3"><span>${x.t.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span><b>${(x.v/100).toFixed(2)} m</b><span class="small">${esc(x.type)}</span></div>`).join('')+'</div>';
 $('forecast').innerHTML=html;
 $('forecastInfo').textContent=`Zeitraum: ${first.t.toLocaleString('de-DE')} bis ${last.t.toLocaleString('de-DE')} · Werte von PEGELONLINE sind ungeprüfte Roh-/Vorhersagedaten.`;
}
async function loadHistory(selectionToken=stationSelectionToken){
 const requestToken=++historyLoadToken;
 const requestIsCurrent=()=>selectionToken===stationSelectionToken&&requestToken===historyLoadToken;
 let st=getWaterStation(),uuid=st?.uuid;if(!uuid){$('chart').innerHTML='<div class="small">Für diese Station ist keine PEGELONLINE-Wasserstandszeitreihe verknüpft.</div>';$('chartInfo').textContent='';return}
 let range=$('range').value;
 try{
  const r=await poFetch(`/stations/${uuid}/W/measurements.json?start=${encodeURIComponent(range)}`,{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();
  if(!requestIsCurrent()||getWaterStation()?.uuid!==uuid||String($('range').value)!==String(range))return;
  if(!Array.isArray(j))throw Error('Ungültige Messreihe');
  storageSet(historyCacheKey(uuid,range),JSON.stringify({savedAt:new Date().toISOString(),rows:j}));
  renderChart(j);
 }catch(e){
  if(!requestIsCurrent()||getWaterStation()?.uuid!==uuid||String($('range').value)!==String(range))return;
  try{const c=JSON.parse(localStorage.getItem(historyCacheKey(uuid,range))||'null');if(Array.isArray(c?.rows)&&c.rows.length){renderChart(c.rows);$('chartInfo').textContent+=' · zuletzt gespeichert';return}}catch{}
  $('chart').innerHTML='<div class="small warn">Wasserstandsverlauf momentan nicht erreichbar.</div>';$('chartInfo').textContent='';
 }
}
function renderChart(rows){let pts=rows.map(x=>({t:new Date(x.timestamp),v:Number(x.value)})).filter(x=>Number.isFinite(x.v)&&!isNaN(x.t.getTime())).sort((a,b)=>a.t-b.t);if(!pts.length){$('chart').innerHTML='<div class="small">Keine Messwerte für den gewählten Zeitraum.</div>';return}
 const w=860,h=228,pad={l:48,r:16,t:9,b:27},min=Math.min(...pts.map(x=>x.v)),max=Math.max(...pts.map(x=>x.v));const span=max-min||1;const x=t=>pad.l+(t-pts[0].t)/(pts[pts.length-1].t-pts[0].t||1)*(w-pad.l-pad.r);const y=v=>h-pad.b-(v-min)/span*(h-pad.t-pad.b);const poly=pts.map(p=>`${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');const ticks=[0,.25,.5,.75,1];let grid=ticks.map(q=>{let yy=pad.t+q*(h-pad.t-pad.b);let vv=max-q*span;return `<line x1="${pad.l}" y1="${yy}" x2="${w-pad.r}" y2="${yy}" stroke="#dfe8ec"/><text x="4" y="${yy+4}" font-size="11" fill="#52636e">${(vv/100).toFixed(2)} m</text>`}).join('');let xlabels=[pts[0],pts[Math.floor(pts.length/2)],pts[pts.length-1]].map(p=>`<text x="${x(p.t)}" y="${h-8}" text-anchor="middle" font-size="11" fill="#52636e">${p.t.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</text>`).join('');$('chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="228" role="img" aria-label="Wasserstandsverlauf"><rect width="100%" height="100%" fill="#fff"/>${grid}<polyline points="${poly}" fill="none" stroke="#0b3954" stroke-width="2" vector-effect="non-scaling-stroke"/>${xlabels}</svg>`;$('chartInfo').textContent=`${pts.length} Messwerte · ${pts[0].t.toLocaleString('de-DE')} bis ${pts[pts.length-1].t.toLocaleString('de-DE')} · PEGELONLINE-Rohdaten`}
function eventDate(e){return displayEvent(e)}

// Lokale Zeitdiagnose: nur Ausgabe in der Browser-Konsole, keine Datenänderung.
function diagnoseBshTimes(){
  const rows = data.filter(e => String(e.datetime || '').startsWith('2026-10-18'));
  console.table(rows.map(e => ({
    rohzeit: e.datetime,
    typ: e.type,
    anzeigezeit: displayEvent(e).toLocaleString('de-DE', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    })
  })));
}


// Keep the compact priority tiles synchronized with asynchronously loaded water measurements.
try{
 const waterNode=document.getElementById('water');
 if(waterNode && window.MutationObserver){
  new MutationObserver(()=>updatePrioritySummary()).observe(waterNode,{childList:true,subtree:true,characterData:true});
 }
}catch(_){}

function updateClock(){ $('clock').textContent=new Date().toLocaleString('de-DE',{dateStyle:'full',timeStyle:'medium'}); }
function updateSources(){ let hasBsh=!!currentBsh, hasPo=!!poCurrent; $('sourceBadges').innerHTML=(hasBsh?'<span class=\"pill\">BSH Tide</span>':'')+(hasPo?'<span class=\"pill\">PEGELONLINE Wasserstand</span>':''); }
function canonicalFavorite(f){
 if(!f||typeof f!=='object') return f;
 const out={...f};
 if(out.mode==='bsh'){
   const cid=canonicalBshId(out.id);
   if(cid) out.id=cid;
   if(out.id==='KIEL-HOLTENAU'){
     out.name='Kiel-Holtenau';
     out.region='Ostsee';
   }
 }
 return out;
}
function getFavorites(){
 try{
   const j=JSON.parse(localStorage.getItem('tiden.favorites')||'[]');
   if(!Array.isArray(j)) return [];
   const migrated=[]; const seen=new Set();
   for(const raw of j){
     const f=canonicalFavorite(raw); if(!f||!f.id) continue;
     const key=(f.mode||'all')+'|'+f.id;
     if(seen.has(key)) continue;
     seen.add(key); migrated.push(f);
   }
   // Alte Favoriten-IDs/Namen werden beim Lesen dauerhaft auf die kanonische
   // Stationsidentität umgestellt. Dadurch bleiben vorhandene Favoriten nach
   // dem BSH-Katalog-Deduplizieren funktionsfähig.
   const raw=JSON.stringify(migrated), old=JSON.stringify(j);
   if(raw!==old) storageSet('tiden.favorites',raw);
   return migrated;
 }catch{return []}
}
function saveFavorites(arr){storageSet('tiden.favorites',JSON.stringify(arr.map(canonicalFavorite)));}
function favoriteId(){if(!current)return null;return mode==='bsh'?canonicalBshId(current.id)||current.id:mode==='po'?current.uuid:modeForSelection?.key||null}
function isFavorite(){const id=favoriteId();if(!id)return false;return getFavorites().some(f=>f.mode===mode&&f.id===id)}
function syncFavorite(){ const active=isFavorite(); const btn=$('favBtn'); btn.textContent=active?'★ Favorit':'☆ Favorit'; btn.classList.toggle('favorite-active',active); btn.setAttribute('aria-pressed',String(active)); renderFavorites(); }
function renderFavorites(){
 const menu=$('favoriteMenu'); if(!menu)return; const favs=getFavorites();
 if(!favs.length){menu.innerHTML='<div class="favoriteEmpty">Noch keine Favoriten gespeichert.</div><div class="favoriteHint">Eine Station auswählen und auf „☆ Favorit“ klicken.</div>';return;}
 menu.innerHTML=favs.map((f,i)=>{const c=canonicalFavorite(f);return `<div class="favoriteItem"><button class="favSelect" data-fav-index="${i}" title="Favorit öffnen">★ ${esc(c.name||'Station')}<div class="small">${esc(c.region||'')} · ${c.mode==='bsh'?'BSH':c.mode==='po'?'PEGELONLINE':'Küste'}</div></button><button class="favoriteRemove" data-fav-remove="${i}" title="Favorit entfernen">×</button></div>`}).join('');
 menu.querySelectorAll('[data-fav-index]').forEach(btn=>btn.onclick=()=>{const f=getFavorites()[Number(btn.dataset.favIndex)];if(!f)return;const c=canonicalFavorite(f);mode=c.mode||'all';setListMode(mode);selectStation(c.id);closeFavoriteMenu();});
 menu.querySelectorAll('[data-fav-remove]').forEach(btn=>btn.onclick=()=>{const arr=getFavorites();arr.splice(Number(btn.dataset.favRemove),1);saveFavorites(arr);renderFavorites();syncFavorite();});
}
let favoriteMenuAutoHideTimer=null;
function closeFavoriteMenu(){
 const menu=$('favoriteMenu'); if(!menu)return;
 menu.classList.remove('open'); $('favListBtn')?.classList.remove('favorites-open');
 if(favoriteMenuAutoHideTimer!==null){clearTimeout(favoriteMenuAutoHideTimer);favoriteMenuAutoHideTimer=null;}
}
function toggleFavoriteMenu(){
 const menu=$('favoriteMenu'); if(!menu)return;
 if(menu.classList.contains('open')){closeFavoriteMenu();return;}
 renderFavorites(); menu.classList.add('open'); $('favListBtn')?.classList.add('favorites-open');
 if(favoriteMenuAutoHideTimer!==null)clearTimeout(favoriteMenuAutoHideTimer);
 // Favoriten bleiben gespeichert; nur die angezeigte Ergebnisliste klappt nach 6 Sekunden zu.
 favoriteMenuAutoHideTimer=setTimeout(closeFavoriteMenu,6000);
}

function isGermanSummerTime(y,m,d){const lastSunday=(month)=>{const last=new Date(Date.UTC(y,month,0));return last.getUTCDate()-last.getUTCDay()};const start=lastSunday(3),end=lastSunday(10);return (m>3&&m<10)||(m===3&&d>=start)||(m===10&&d<end)}
function displayEvent(e){const [ys,ms,ds]=e.datetime.slice(0,10).split('-').map(Number);const [hs,mins]=e.datetime.slice(11,16).split(':').map(Number);const dt=new Date(ys,ms-1,ds,hs,mins);if(isGermanSummerTime(ys,ms,ds))dt.setHours(dt.getHours()+1);return dt}

function updatePrioritySummary(){
 const waterText=String($('water')?.textContent||'–').trim();
 const waterTime=String($('waterTime')?.textContent||'').trim();
 const pw=$('priorityWater'), pwt=$('priorityWaterTime');
 if(pw) pw.textContent=waterText||'–';
 if(pwt) pwt.textContent=waterTime||'Aktueller Messwert';

 const today=new Date();
 const future=data.map(e=>({...e, _dt:eventDate(e)}))
   .filter(e=>e._dt instanceof Date && Number.isFinite(e._dt.getTime()) && e._dt>today)
   .sort((a,b)=>a._dt-b._dt);
 const highs=future.filter(e=>e.type==='HW').slice(0,2);
 const lows=future.filter(e=>e.type==='NW').slice(0,2);
 const high=highs[0], highNext=highs[1], low=lows[0], lowNext=lows[1];
 const fmtTime=e=>e?e._dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'–';
 const eventLabel=(e,kind)=>{
if(!e)return '<span class="tideKind"></span>';
const d=e._dt;
const eventDay=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dateSuffix=eventDay!==localDate()?'<span style="font-size:.72em;font-weight:400;opacity:.7;margin-left:5px;white-space:nowrap">'+d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+'</span>':'';
return '<span class="tideEventLine"><span class="tideKind">'+kind+'</span><strong class="tideTime">'+fmtTime(e)+'</strong>'+dateSuffix+'</span>';
};
 const ph=$('priorityHigh'), phs=$('priorityHighSub'), phn=$('priorityHighNext'), pl=$('priorityLow'), pls=$('priorityLowSub'), pln=$('priorityLowNext');
 // v46.96: Tide-Bereiche bleiben bei fehlender BSH-Datei sichtbar und erklären, was fehlt.
 if(ph) ph.innerHTML=high?eventLabel(high,'Flut'):'Keine BSH-Daten';
 if(phs) phs.textContent=high?'':'BSH-Jahresdatei laden';
 if(phn) phn.innerHTML=highNext?eventLabel(highNext,'Flut'):'';
 if(pl) pl.innerHTML=low?eventLabel(low,'Ebbe'):'Keine BSH-Daten';
 if(pls) pls.textContent=low?'':'BSH-Jahresdatei laden';
 if(pln) pln.innerHTML=lowNext?eventLabel(lowNext,'Ebbe'):'';
 const summary=$('prioritySummary');
 const hasTideStation=!!currentBsh || stationKind()==='tide';
 if(summary) summary.style.display=(hasTideStation?'grid':'none');
}

function render(){
 updatePrioritySummary();
 const sourceLabel=$('tideSourceLabel');
 if(sourceLabel){
   const stationName=meta?.station||currentBsh?.name||currentBsh?.longname||'BSH-Station';
   const fileName=meta?.filename||meta?.sourceFile||'';
   sourceLabel.textContent=meta
     ? 'Datenquelle: '+stationName+(fileName?' · Datei: '+fileName:'')+' · Jahr '+selectedYear
     : (currentBsh?'Station: '+stationName+' · keine BSH-Jahresdaten geladen':'Keine BSH-Datenquelle ausgewählt');
 }
 const hasTideStation=!!currentBsh || stationKind()==='tide';
 const tideCard=document.querySelector('#next')?.closest('.grid2')?.children?.[1]; if(tideCard) tideCard.style.display=(hasTideStation?'block':'none');updateClock();
 const d=String($('date').value||'');
 const day=data.filter(e=>{const dt=displayEvent(e);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')===d});
 $('events').innerHTML=day.length?day.map(e=>{const dt=displayEvent(e);return `<div class="event"><span>${dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span><span class="${e.type==='HW'?'hw':'nw'}">${e.type==='HW'?'Hochwasser':'Niedrigwasser'}</span><span class="right">${Number(e.height).toFixed(2)} m</span></div>`}).join(''):'<div class="small">Keine BSH-HW/NW-Daten für diesen Tag.</div>';
 $('bshInfo').textContent=meta?`Bezugsniveau: ${meta.reference||'–'} · Zeitzone: Gesetzliche Ortszeit (MEZ/MESZ) · ${meta.eventCount||data.length} Ereignisse ${meta.year||selectedYear}`:'Keine BSH-Jahresdatei für diese Station eingebunden.';
 tick();
}
function tick(){
 const selectedDate=String($('date')?.value||'');
 const yearData=data.filter(e=>String(e.datetime||'').slice(0,4)===String(selectedYear));
 const dateData=yearData.map(e=>({...e,d:eventDate(e)})).filter(e=>e.d.getFullYear()+'-'+String(e.d.getMonth()+1).padStart(2,'0')+'-'+String(e.d.getDate()).padStart(2,'0')===selectedDate).sort((a,b)=>a.d-b.d);
 if(!dateData.length){
  const activeStation=currentBsh||modeForSelection?.bsh||((mode==='bsh'||stationKind()==='tide')?current:null)||{};
  const activeCode=archiveCodeForBsh(activeStation);
  const visibleYear=Number($('year')?.value||String($('date')?.value||'').slice(0,4)||selectedYear);
  if(activeCode==='634P'&&visibleYear===2026){
   $('next').textContent='Für Südwesthörn (634P) stellt der BSH für 2026 keine Jahresdatei zum Direktdownload bereit. Daher sind hier keine BSH-HW/NW-Daten verfügbar.';
  }else{
   $('next').textContent='Keine BSH-Gezeitendaten verfügbar. Bitte eine passende BSH-Jahresdatei laden.';
  }
  $('countDays').textContent='';$('countDays').hidden=true;$('countTime').textContent='';$('nextHeight').textContent='';updatePrioritySummary();return;
 }
 const today=localDate();
 // Die obere Tideanzeige bezieht sich auf das gewählte Datum. Nur wenn dieses heute ist,
 // wird die nächste noch bevorstehende Tide des Tages gewählt; sonst die erste Tide des Datums.
 const now=new Date();const n=data.map(e=>({...e,d:eventDate(e)})).filter(e=>e.d instanceof Date&&Number.isFinite(e.d.getTime())&&e.d>now).sort((a,b)=>a.d-b.d)[0]||dateData[0];
 $('next').textContent=`${n.d.toLocaleDateString('de-DE')} ${n.d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} · ${n.type==='HW'?'Hochwasser':'Niedrigwasser'}`;
 $('nextHeight').textContent=`Höhe: ${Number(n.height).toFixed(2)} m`;
 const seconds=Math.floor((n.d.getTime()-Date.now())/1000);
 if(seconds<=0){$('countDays').textContent='';$('countDays').hidden=true;$('countTime').textContent='';return;}
 const days=Math.floor(seconds/86400),h=Math.floor((seconds%86400)/3600),m=Math.floor(seconds%3600/60),sec=seconds%60;
 const dayLabel=days>=1?`${days} ${days===1?'Tag':'Tage'}`:'';$('countDays').textContent=dayLabel;$('countDays').hidden=!dayLabel;
 $('countTime').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
 updatePrioritySummary();
}

async function nearbyStations(lat,lon,radius=50){
 const url=`${API}/stations.json?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&radius=${radius}`;
 const r=await poFetch(url.replace(API,''),{cache:'no-store'}); if(!r.ok) throw Error('HTTP '+r.status);
 const arr=await r.json();
 return arr.filter(isCoastalStation).map(s=>{
   const R=6371, a=(lat)*Math.PI/180, b=Number(s.latitude)*Math.PI/180, dLat=(Number(s.latitude)-lat)*Math.PI/180, dLon=(Number(s.longitude)-lon)*Math.PI/180;
   const q=Math.sin(dLat/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dLon/2)**2;
   return {...s,distance:2*R*Math.asin(Math.sqrt(q))};
 }).sort((a,b)=>a.distance-b.distance).slice(0,15);
}
function renderNearby(arr){
 if(!arr.length){$('nearby').innerHTML='Keine Küstenmessstelle im gewählten Umkreis gefunden.';return;}
 $('nearby').innerHTML=arr.map(s=>`<div class="stationitem" data-near="${esc(s.uuid)}"><b>${esc(s.longname||s.shortname||'Pegel')}</b><div class="small">${esc(s.water?.longname||'')} · ${s.distance.toFixed(1)} km</div></div>`).join('');
 document.querySelectorAll('[data-near]').forEach(x=>x.onclick=()=>{mode='po';$('tabAll').classList.remove('active');$('tabBsh').classList.remove('active');$('tabPo').classList.add('active');renderList();selectStation(x.dataset.near)});
}
function nearbyLocationError(err){
 const insecure=location.protocol==='http:'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1';
 if(err&&err.code===1)return '<span class="warn">Standortfreigabe wurde verweigert. Bitte die Standortfreigabe für diese Seite in Safari erlauben – oder Ort/PLZ eingeben.</span>';
 if(err&&err.code===2)return '<span class="warn">Der Standort ist momentan nicht verfügbar. Bitte erneut versuchen – oder Ort/PLZ eingeben.</span>';
 if(err&&err.code===3)return '<span class="warn">Die Standortabfrage hat zu lange gedauert. Bei Aufruf über lokales HTTP kann die Ortung blockiert sein. Bitte Ort/PLZ eingeben oder die Seite über HTTPS öffnen.</span>';
 if(insecure)return '<span class="warn">Diese Seite wird über lokales HTTP geöffnet. Safari kann die Standortabfrage über die Mac-IP (z. B. 192.168.x.x) blockieren. Bitte Ort/PLZ eingeben oder die Seite über HTTPS öffnen.</span>';
 return '<span class="warn">Standortabfrage ist nicht verfügbar. Bitte Ort/PLZ eingeben.</span>';
}
async function showNearbyForCoordinates(lat,lon,label){
 try{
   const arr=await nearbyStations(lat,lon,50);
   renderNearby(arr);
   $('nearby').insertAdjacentHTML('afterbegin',`<div class="small" style="margin-bottom:6px">Umkreis: 50 km · ${esc(label||'Standort')}.</div>`);
 }catch(e){$('nearby').innerHTML='<span class="warn">PEGELONLINE-Umkreissuche momentan nicht erreichbar.</span>'}
}
async function findNearby(){
 if(!navigator.geolocation){$('nearby').innerHTML='<span class="warn">Dieser Browser unterstützt keine Standortabfrage. Bitte Ort/PLZ eingeben.</span>';return;}
 $('nearby').textContent='Standort wird ermittelt …';
 navigator.geolocation.getCurrentPosition(async pos=>{
   await showNearbyForCoordinates(pos.coords.latitude,pos.coords.longitude,'Standort nur für diese Suche verwendet');
 },err=>{$('nearby').innerHTML=nearbyLocationError(err);},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
}
async function findNearbyByPlace(){
 const q=$('nearbyPlace')?.value.trim();
 if(!q){$('nearby').innerHTML='<span class="warn">Bitte einen Ort oder eine deutsche PLZ eingeben.</span>';return;}
 $('nearby').textContent='Ort wird gesucht …';
 try{
   const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&accept-language=de&q='+encodeURIComponent(q);
   const r=await fetch(url,{cache:'no-store',headers:{'Accept':'application/json'}});
   if(!r.ok)throw Error('Geocoding HTTP '+r.status);
   const hits=await r.json();
   if(!Array.isArray(hits)||!hits.length)throw Error('Ort/PLZ nicht gefunden');
   const lat=Number(hits[0].lat),lon=Number(hits[0].lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error('Ungültige Koordinaten');
   await showNearbyForCoordinates(lat,lon,hits[0].display_name||q);
 }catch(e){$('nearby').innerHTML='<span class="warn">Ort/PLZ konnte nicht gefunden werden. Bitte Schreibweise prüfen oder einen anderen Ort eingeben.</span>';}
}
$('nearbyBtn').onclick=findNearby;
$('nearbyPlaceBtn').onclick=findNearbyByPlace;
$('nearbyPlace').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findNearbyByPlace();}};

function setListMode(m){mode=m;['tabAll','tabBsh','tabPo','tabNorth','tabBaltic'].forEach(id=>$(id)?.classList.remove('active'));const ids={all:'tabAll',bsh:'tabBsh',po:'tabPo',north:'tabNorth',baltic:'tabBaltic'};$(ids[m])?.classList.add('active');renderList();}
$('bshGuideToggle').onclick=()=>{const text=$('bshGuideText'),open=text.hidden;text.hidden=!open;$('bshGuideToggle').textContent=open?'▾ Import-Anleitung ausblenden':'▸ Import-Anleitung anzeigen';$('bshGuideToggle').setAttribute('aria-expanded',String(open))};
$('bshArchiveSelectedBtn').onclick=()=>{
  const selected=$('bshFile').files[0];
  const archiveCard=$('bshArchiveCard');
  const archiveFile=$('bshArchiveUploadFile');
  const archiveForm=$('bshArchiveUploadForm');
  const archiveStatus=$('bshArchiveUploadStatus');
  if(!selected){
    $('bshImportInfo').textContent='Bitte zuerst eine BSH-Datei auswählen, die archiviert werden soll.';
    $('bshFile').click();
    return;
  }
  if(!archiveCard||!archiveFile||!archiveForm){
    $('bshImportInfo').textContent='Die Archivierungsfunktion ist derzeit nicht verfügbar.';
    return;
  }
  try{
    const transfer=new DataTransfer();
    transfer.items.add(selected);
    archiveFile.files=transfer.files;
  }catch(error){
    $('bshImportInfo').textContent='Die Datei konnte nicht automatisch an das Archivformular übergeben werden. Bitte im BSH-Archiv erneut auswählen.';
    archiveCard.open=true;
    archiveCard.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  archiveCard.open=true;
  $('bshArchiveConsent').checked=false;
  archiveCard.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('bshArchiveUpload').scrollIntoView({behavior:'smooth',block:'end'});
  archiveStatus.textContent='Datei vorbereitet. Bitte die Sicherheitsprüfung abschließen und der Archivierung ausdrücklich zustimmen. Es wurde noch nichts hochgeladen.';
};
$('bshRemoveStatusBtn').onclick=removeBshImport;$('bshImportBtn').onclick=async()=>{try{await importBshFile($('bshFile').files[0])}catch(e){$('bshImportInfo').innerHTML=`<span class="warn">⚠ ${esc(e.message||e)}</span>`}};$('bshFile').addEventListener('change',()=>{$('bshRemoveBtn').disabled=!$('bshFile').files.length&&!localStorage.getItem('tiden.lastBshImport')});$('bshRemoveBtn').onclick=async()=>{try{await removeBshImport()}catch(e){$('bshImportInfo').innerHTML=`<span class="warn">⚠ ${esc(e.message||e)}</span>`}};$('tabAll').onclick=()=>setListMode('all');$('tabBsh').onclick=()=>setListMode('bsh');$('tabPo').onclick=()=>setListMode('po');$('tabNorth').onclick=()=>setListMode('north');$('tabBaltic').onclick=()=>setListMode('baltic');function syncSearchClear(){const has=!!$('search').value.trim();$('searchClear').classList.toggle('visible',has);$('searchClear').hidden=!has} $('search').oninput=()=>{renderList();syncSearchClear()};syncSearchClear();$('searchClear').onclick=()=>{$('search').value='';syncSearchClear();$('search').focus();renderList()};/* v47.01: custom calendar combines month and year selection while preserving existing date-change logic */
(function initIntegratedDatePicker(){
 const byId=id=>document.getElementById(id),input=byId('date'),trigger=byId('datePickerTrigger'),pop=byId('datePickerPopover');if(!input||!trigger||!pop)return;
 let view=new Date((input.value||new Date().toISOString().slice(0,10))+'T12:00:00');if(Number.isNaN(view.getTime()))view=new Date();
 const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],weekdays=['MO','DI','MI','DO','FR','SA','SO'];const pad=n=>String(n).padStart(2,'0'),iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 function syncTrigger(){if(input.value){const d=new Date(input.value+'T12:00:00');byId('datePickerValue').textContent=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});view=new Date(d.getFullYear(),d.getMonth(),1,12)}else byId('datePickerValue').textContent='Datum wählen'}
 function syncYears(){const sel=byId('datePickerYear'),source=byId('year'),ys=new Set();for(let y=view.getFullYear()-8;y<=view.getFullYear()+8;y++)ys.add(y);if(source)Array.from(source.options).forEach(o=>{const y=Number(o.value);if(Number.isFinite(y)&&y>1900&&y<2201)ys.add(y)});sel.innerHTML=Array.from(ys).sort((a,b)=>a-b).map(y=>'<option value="'+y+'">'+y+'</option>').join('');sel.value=String(view.getFullYear())}
 function render(){syncYears();byId('datePickerMonth').textContent=months[view.getMonth()];const grid=byId('datePickerGrid');grid.innerHTML='';weekdays.forEach(w=>{const el=document.createElement('div');el.className='datePickerWeekday';el.textContent=w;grid.appendChild(el)});const first=new Date(view.getFullYear(),view.getMonth(),1,12),offset=(first.getDay()+6)%7,days=new Date(view.getFullYear(),view.getMonth()+1,0,12).getDate();for(let i=0;i<offset;i++)grid.appendChild(document.createElement('span'));const today=typeof localDate==='function'?localDate():new Date().toISOString().slice(0,10);for(let n=1;n<=days;n++){const d=new Date(view.getFullYear(),view.getMonth(),n,12),b=document.createElement('button');b.type='button';b.className='datePickerDay'+(iso(d)===input.value?' selected':'')+(iso(d)===today?' today':'');b.textContent=String(n);b.setAttribute('aria-label',d.toLocaleDateString('de-DE',{dateStyle:'full'}));b.onclick=()=>{input.value=iso(d);input.dispatchEvent(new Event('change',{bubbles:true}));syncTrigger();close()};grid.appendChild(b)}}
 function open(){const value=input.value||(typeof localDate==='function'?localDate():new Date().toISOString().slice(0,10));view=new Date(value+'T12:00:00');if(Number.isNaN(view.getTime()))view=new Date();view.setDate(1);render();pop.hidden=false;trigger.setAttribute('aria-expanded','true');if(window.matchMedia('(max-width: 600px)').matches){const vv=window.visualViewport,margin=12,vw=vv?vv.width:document.documentElement.clientWidth,vh=vv?vv.height:window.innerHeight,ox=vv?vv.offsetLeft:0,oy=vv?vv.offsetTop:0,r=trigger.getBoundingClientRect();pop.style.position='fixed';pop.style.right='auto';pop.style.bottom='auto';pop.style.transform='none';pop.style.margin='0';pop.style.boxSizing='border-box';pop.style.width=Math.min(350,vw-margin*2)+'px';pop.style.maxWidth=(vw-margin*2)+'px';pop.style.maxHeight=Math.max(180,Math.min(420,vh-margin*2))+'px';pop.style.overflowY='auto';pop.style.transform='scale(.6375)';pop.style.transformOrigin='top left';const pr=pop.getBoundingClientRect(),pw=pr.width,ph=pr.height,sw=pw,sh=ph;let left=Math.max(ox+margin,Math.min(r.left+ox,ox+vw-sw-margin));let top=r.bottom+oy+8;if(top+sh>oy+vh-margin)top=Math.max(oy+margin,r.top+oy-sh-8);top=Math.max(oy+margin,Math.min(top,oy+vh-sh-margin));pop.style.left=left+'px';pop.style.top=top+'px';}}function close(){pop.hidden=true;trigger.setAttribute('aria-expanded','false');pop.style.position='';pop.style.left='';pop.style.top='';pop.style.right='';pop.style.bottom='';pop.style.width='';pop.style.maxWidth='';pop.style.maxHeight='';pop.style.overflowY='';pop.style.boxSizing='';pop.style.transform='';pop.style.margin=''}
 trigger.addEventListener('click',()=>pop.hidden?open():close());byId('datePickerPrev').onclick=()=>{view.setMonth(view.getMonth()-1);render()};byId('datePickerNext').onclick=()=>{view.setMonth(view.getMonth()+1);render()};byId('datePickerYear').onchange=()=>{view.setFullYear(Number(byId('datePickerYear').value));render()};byId('datePickerToday').onclick=()=>{input.value=typeof localDate==='function'?localDate():new Date().toISOString().slice(0,10);input.dispatchEvent(new Event('change',{bubbles:true}));syncTrigger();close()};input.addEventListener('change',()=>{syncTrigger();if(!pop.hidden)render()});document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target)&&!trigger.contains(e.target))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden)close()});syncTrigger();
})();

$('bshTxtCheck')?.addEventListener('click',checkBshTxtDirectDownload);
function prepareBshArchiveAfterDirectDownload(){
 const link=$('bshTxtDownload');
 if(!link||link.hidden||!link.href||link.href==='#')return;
 const card=$('bshArchiveCard'),upload=$('bshArchiveUpload');
 const file=$('bshArchiveUploadFile'),consent=$('bshArchiveConsent');
 const uploadStatus=$('bshArchiveUploadStatus');
 if(!card||!upload||!file||!consent||!uploadStatus)return;
 // Der BSH-Link öffnet den Download in einem neuen Tab. Die heruntergeladene
 // Datei kann der Browser aus Sicherheitsgründen nicht automatisch in ein
 // Datei-Auswahlfeld übertragen; deshalb wird hier die vorhandene Uploadfläche
 // vorbereitet und die manuelle Dateiauswahl ausdrücklich erklärt.
 card.open=true;
 upload.open=true;
 file.value='';
 consent.checked=false;
 consent.dispatchEvent(new Event('change',{bubbles:true}));
 uploadStatus.textContent='Der BSH-Download wurde in einem neuen Tab geöffnet. Sobald der Download abgeschlossen ist, hier unten im Feld „BSH-TXT-Datei auswählen“ genau diese heruntergeladene Datei auswählen. Danach die Sicherheitsprüfung abschließen und der Archivierung ausdrücklich zustimmen. Es wurde noch nichts hochgeladen.';
 card.scrollIntoView({behavior:'smooth',block:'start'});
 upload.scrollIntoView({behavior:'smooth',block:'start'});
}
// v47.17: BSH-Download-Klick löst keine automatische Archiv-UI oder Scrollbewegung aus.
 $('coastMapCard')?.addEventListener('toggle',()=>{if($('coastMapCard')?.open&&!$('map')?.dataset.rendered){renderMap();$('map').dataset.rendered='1';}});
$('bshArchiveDirectDownload')?.addEventListener('click',()=>{
 const url=String(window.tidenuhrBshDirectUrl||'').trim();
 const info=$('bshArchiveDirectDownloadInfo');
 const uploadStatus=$('bshArchiveUploadStatus');
 const card=$('bshArchiveCard'),upload=$('bshArchiveUpload');
 const consent=$('bshArchiveConsent'),file=$('bshArchiveUploadFile');
 if(!url){
   if(info)info.textContent='Noch kein Direktdownload-Link vorhanden. Bitte oben bei der ausgewählten Pegelstelle das gewünschte Jahr einstellen und „BSH-TXT-Direktdownload prüfen“ ausführen.';
   return;
 }
 if(card)card.open=true;
 if(upload)upload.open=true;
 if(file)file.value='';
 if(consent){consent.checked=false;consent.dispatchEvent(new Event('change',{bubbles:true}));}
 if(info)info.textContent='Der geprüfte BSH-Link ist für den direkten Serverabruf vorbereitet. Bitte die Sicherheitsprüfung abschließen, der Archivierung ausdrücklich zustimmen und anschließend „Datei ins Online-Archiv übernehmen“ drücken.';
 if(uploadStatus)uploadStatus.textContent='Bereit für den direkten Abruf von BSH. Es wird erst nach abgeschlossener Sicherheitsprüfung und ausdrücklicher Zustimmung archiviert.';
 if(upload)upload.scrollIntoView({behavior:'smooth',block:'start'});
});
$('date').onchange=async()=>{
 const chosenDate=String($('date').value||'');
 const dateYear=Number(chosenDate.slice(0,4));
 if(!chosenDate || !Number.isFinite(dateYear)||dateYear<1900||dateYear>2200){render();return;}
 // Kalenderdatum ist bei direkter Auswahl maßgeblich: Jahr und Datensatz folgen ihm.
 selectedYear=dateYear;
 updateBshTxtDownload();
 let yearOption=[...$('year').options].find(o=>Number(o.value)===dateYear);
 if(!yearOption){
   yearOption=document.createElement('option');
   yearOption.value=String(dateYear);
   yearOption.textContent=String(dateYear);
   $('year').appendChild(yearOption);
 }
 $('year').value=String(dateYear);
 await loadBshYear();
};$('year').onchange=async()=>{
 selectedYear=Number($('year').value);
 updateBshTxtDownload();
 // Beim Wechsel ins aktuelle Kalenderjahr stets auf heute zurückspringen.
 // Für andere Jahre Monat/Tag beibehalten, sofern das Datum gültig ist.
 const today=localDate();
 if(selectedYear===Number(today.slice(0,4))){
   $('date').value=today;
 }else{
   const oldDate=String($('date').value||'');
   const parts=oldDate.split('-').map(Number);
   const month=parts[1]||1, day=parts[2]||1;
   const candidate=`${selectedYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   const check=new Date(`${candidate}T12:00:00`);
   const valid=check.getFullYear()===selectedYear && check.getMonth()+1===month && check.getDate()===day;
   $('date').value=valid?candidate:`${selectedYear}-01-01`;
 }
 await loadBshYear();
};function stepYear(delta){const y=$('year');if(!y||!y.options.length)return;const next=Math.max(0,Math.min(y.options.length-1,y.selectedIndex+delta));if(next!==y.selectedIndex){y.selectedIndex=next;y.dispatchEvent(new Event('change',{bubbles:true}));}}$('yearPrev').onclick=()=>stepYear(-1);$('yearNext').onclick=()=>stepYear(1);$('range').onchange=loadHistory;$('favBtn').onclick=()=>{if(!current)return;const id=favoriteId();if(!id)return;let arr=getFavorites();const ix=arr.findIndex(f=>f.mode===mode&&f.id===id);if(ix>=0)arr.splice(ix,1);else{const station=modeForSelection||current;arr.push({mode,id,name:modeForSelection?.name||label(current),region:modeForSelection?stationRegion(modeForSelection):stationRegion(current)});}saveFavorites(arr);syncFavorite();};$('favListBtn').onclick=toggleFavoriteMenu;setInterval(tick,1000); setInterval(updateClock,1000);setInterval(loadWater,60000);
applyVersion();updateClock();setTimeout(()=>checkForPublishedUpdate(),1200);(function migrateFavorite(){if(localStorage.getItem('tiden.favorites'))return;const raw=localStorage.getItem('tiden.favorite');if(!raw)return;try{const f=JSON.parse(raw);if(f&&f.id)storageSet('tiden.favorites',JSON.stringify([f]));}catch{}})();
// Safari kann einen zuvor geöffneten Vollbildzustand wiederherstellen. Beim
// regulären Seitenstart werden ausschließlich die Vollbild-Overlays entfernt.
function resetRestoredOverlays(){const map=$('coastMapCard'),archive=$('bshArchiveCard');map?.classList.remove('map-fullscreen');document.body.classList.remove('map-is-fullscreen');$('mapExpand')?.classList.remove('hidden');$('mapClose')?.classList.add('hidden');$('mapExpand')?.setAttribute('aria-expanded','false');if(archive?.open)archive.open=false;}
resetRestoredOverlays();window.addEventListener('pageshow',resetRestoredOverlays);
loadCatalog();let saved=localStorage.getItem('tiden.station.id'),sm=localStorage.getItem('tiden.station.mode');if(saved){mode=sm||'all';$('tabAll').classList.toggle('active',mode==='all');$('tabBsh').classList.toggle('active',mode==='bsh');$('tabPo').classList.toggle('active',mode==='po');$('tabNorth').classList.toggle('active',mode==='north');$('tabBaltic').classList.toggle('active',mode==='baltic');renderList();if(mode!=='po'||po.some(x=>x.uuid===saved))selectStation(saved);}renderFavorites();
function setMapFullscreen(enabled){
 const card=$('coastMapCard');if(!card)return;
 card.classList.toggle('map-fullscreen',!!enabled);document.body.classList.toggle('map-is-fullscreen',!!enabled);
 $('mapExpand')?.classList.toggle('hidden',!!enabled);$('mapClose')?.classList.toggle('hidden',!enabled);
 $('mapExpand')?.setAttribute('aria-expanded',String(!!enabled));
 if(enabled){card.open=true;setTimeout(()=>{renderMap();},60)}else{setTimeout(()=>{renderMap();},60)}
}
$('mapExpand')?.addEventListener('click',()=>setMapFullscreen(true));
$('mapClose')?.addEventListener('click',()=>setMapFullscreen(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('coastMapCard')?.classList.contains('map-fullscreen'))setMapFullscreen(false)});
document.getElementById('mapFit')?.addEventListener('click',()=>{window._tideMapView=null;renderMap();});document.getElementById('mapAll')?.addEventListener('click',()=>setMapRegion('all'));document.getElementById('mapNorth')?.addEventListener('click',()=>setMapRegion('north'));document.getElementById('mapBaltic')?.addEventListener('click',()=>setMapRegion('baltic'));