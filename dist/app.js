'use strict';
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  route:'<circle cx="5" cy="18" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h4"/>',
  book:'<path d="M12 5c-4-3-9-2-9-2v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  label:'<path d="M4 18 10 4h4l6 14M7 13h10M3 21h18"/>',
  pin:'<circle cx="12" cy="10" r="3"/><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>'
};
const icon = (name) => `<span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.pin}</svg></span>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eng = (value) => `<bdi dir="${/[א-ת]/.test(String(value))?'rtl':'ltr'}" lang="${/[א-ת]/.test(String(value))?'he':'en'}">${esc(value)}</bdi>`;
const fmt = (n) => Number(n).toLocaleString('he-IL');
const scopeLabels = {world:'עולם המשחק',conditional:'כניסה מותנית',event:'אירוע · זמינות לא מאומתת',system:'חדר מערכת',unavailable:'כניסה לא זמינה / לא מאומתת'};
let atlas, maps, groups, byId, incoming, adjacency, activeId, currentRegion='world', detailsTab='cross', sceneId, sceneKind='cross', selectedGate=null, route=null;
let world = {x:0,y:0,k:1}, scene = {x:0,y:0,k:1}, showAllLabels=false, worldMoved=false;
let nodeElements=new Map(), edgeElements=[], serviceElements=[], portalPinElements=new Map();
let activeSearchResults=[], searchIndex=-1, toastTimer;
let sceneLayer='portals', sceneEntityIds=[], sceneEntityPoints=[], selectedEntity=null;
const entityPinElements=new Map();
const groupId = (id) => groups.find((g) => g.id === id);
const mapLabel = (m) => `${m.name} [${m.id}]`;
const getServices = (id) => (atlas.services || []).filter((s) => Number(s.from) === Number(id));
const serviceLabel = (s) => s.label || s.label_he || 'מעבר מותנה';
const serviceCondition = (s) => s.condition || s.condition_he || '';
const serviceUrls = (s) => s.sourceUrls || s.source_urls || [];
const canRouteService = (s) => (s.routeAllowed ?? s.route_allowed) && s.to != null;
const supplementForGate = (p,m) => getServices(m.id).find(s => s.to != null && ((s.source_portal_id != null && String(s.source_portal_id) === String(p.rawId)) || (s.portal_name && s.portal_name === p.name)));
const displayKind = (p,m) => p.kind==='unknown' && supplementForGate(p,m) ? 'cross' : p.kind;

function svgEl(tag, attrs={}, text) {
  const el=document.createElementNS(NS,tag);
  for (const [key,value] of Object.entries(attrs)) if(value!=null) el.setAttribute(key,String(value));
  if(text!==undefined) el.textContent=text;
  return el;
}
function toast(message) { $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500); }
function imageFallback(el) { if(el.dataset.fallbackUsed)return;el.dataset.fallbackUsed='1';const m=byId.get(Number(el.dataset.map));if(m && el.getAttribute('src') !== m.image)el.src=m.image;else el.style.opacity='.3'; }
function groupLabel(m) { return groupId(m.group)?.he || m.region; }
function directionLabel(p,m) {
  if(!m.width || !m.height)return 'מיקום מסומן בתמונת המפה';
  const x=p.x/m.width,y=p.y/m.height;
  const horizontal=x<.34?'שמאל':x>.67?'ימין':'מרכז';
  const vertical=y<.34?'למעלה':y>.67?'למטה':'באמצע';
  return `${horizontal} · ${vertical}`;
}
function portalTypeLabel(p,m) {
  const supplement=supplementForGate(p,m);
  if(p.kind==='unknown' && supplement)return supplement.walkable?'שער נסתר · תועד במדריך':'מעבר מותנה · תועד במדריך';
  if(p.kind==='unknown')return 'ללא יעד קבוע';
  if(p.kind==='internal')return p.noEffect?'קיצור דרך ללא אפקט':'מעבר בתוך המפה';
  if(p.noEffect)return m.isTown?'דלת / שער ללא אפקט':'שער ללא אפקט';
  if(p.type===3)return 'מעבר אוטומטי';
  return 'שער מעבר';
}
function portalTarget(p,m) { const supplement=supplementForGate(p,m);if(p.kind==='internal'){const targets=m.portals.filter(q=>q.name===p.toPortal);return targets.length===1?`נחיתה בשער ${targets[0].number}`:targets.length>1?`נקודות נחיתה: ${targets.map(q=>q.number).join(', ')}`:(p.toPortal || 'נקודת יעד באותה מפה');}return p.kind==='cross'?(byId.get(p.to)?.name || `Map ${p.to}`):supplement?(byId.get(supplement.to)?.name || p.name):(p.name || 'נקודה ללא שם'); }
function portalCard(p,m,sceneMode=false) {
  return `<div class="portal-card ${p.noEffect?'no-effect':''} ${p.kind} ${sceneMode && selectedGate===p.key?'chosen':''}" data-gate="${esc(p.key)}"><span class="portal-number">${p.number}</span><button type="button" class="portal-main" data-action="${sceneMode?'scene-pick':'portal-go'}" data-gate="${esc(p.key)}">${eng(portalTarget(p,m))}<span class="portal-meta">${esc(portalTypeLabel(p,m))} · ${esc(directionLabel(p,m))}</span>${p.kind==='internal'?'<small>אותה מפה, נקודת נחיתה אחרת</small>':''}</button><button type="button" class="portal-locate" data-action="locate" data-gate="${esc(p.key)}" title="מצא את השער בתמונה" aria-label="מצא את שער ${p.number} בתמונה">${icon('pin')}</button></div>`;
}

function renderDetails() {
  const m=byId.get(activeId);if(!m)return;
  const counts={cross:m.portals.filter(p=>displayKind(p,m)==='cross').length,internal:m.portals.filter(p=>p.kind==='internal').length,unknown:m.portals.filter(p=>displayKind(p,m)==='unknown').length,incoming:(incoming.get(m.id)||[]).length+(atlas.services||[]).filter(s=>s.to===m.id).length};
  const tags=[];if(m.major)tags.push('<span class="tag">עיר / מוקד מרכזי</span>');else if(m.hiddenArea)tags.push('<span class="tag">אזור נסתר</span>');if(m.isNew)tags.push('<span class="tag new">תוספת נובמבר</span>');if(m.scope!=='world')tags.push(`<span class="tag warning">${scopeLabels[m.scope]||'כניסה מיוחדת'}</span>`);
  $('mapDetails').innerHTML=`<div class="map-detail-head"><div class="map-breadcrumb">${esc(groupLabel(m))}</div><h2 dir="ltr">${esc(m.name)}</h2><bdi dir="ltr" class="map-street">${esc(m.street)}</bdi>${tags.length?`<div class="tag-row">${tags.join('')}</div>`:''}</div><button type="button" class="map-preview" data-action="open-scene"><img src="${esc(m.image)}" alt="תמונת המפה ${esc(m.name)}" data-map="${m.id}"><span class="preview-label"><span>פתח את המפה ואת כל שעריה</span>${icon('expand')}</span></button><div class="detail-actions"><button type="button" class="button quiet" data-action="route-from">יציאה מכאן</button><button type="button" class="button primary" data-action="route-to">נווט לכאן</button></div><nav class="portal-tabs" aria-label="סוגי חיבורים">${[['cross','יציאות'],['internal','קיצורים'],['incoming','נכנסים'],['unknown','לא פתורים']].map(([k,v])=>`<button type="button" data-tab="${k}" class="${detailsTab===k?'active':''}">${v}<span class="count">${counts[k]}</span></button>`).join('')}</nav><div class="portal-content" id="portalContent"></div><div class="map-notes">${(m.notes||[]).map(n=>`<p>${esc(n)}</p>`).join('')}</div><div class="map-id"><span>מזהה מפה: <bdi>${m.id}</bdi></span><span>${m.portals.length} רשומות שער</span></div>`;
  $('mapDetails').querySelector('img').addEventListener('error',e=>imageFallback(e.target));
  renderPortalContent();
  const spawnCount=window.HuntData?.mapSpawns?.[m.id]?.totalPoints||0;
  const npcCount=(m.npcs||[]).length;
  if(spawnCount||npcCount)$('mapDetails').querySelector('.portal-tabs').insertAdjacentHTML('beforebegin',`<div class="entity-shortcuts">${spawnCount?`<button type="button" data-action="map-monsters">${fmt(spawnCount)} נקודות הופעה</button>`:''}${npcCount?`<button type="button" data-action="map-npcs">${npcCount===1?'מיקום דמות אחד':fmt(npcCount)+' מיקומי דמויות'}</button>`:''}</div>`);
}
function renderPortalContent() {
  const m=byId.get(activeId);if(!m || !$('portalContent'))return;
  let html='';
  if(detailsTab==='incoming'){
    const ins=incoming.get(m.id)||[];
    html=ins.length?ins.map(({from,p})=>`<div class="portal-card ${p.noEffect?'no-effect':''}"><span class="portal-number">${p.number}</span><button class="portal-main" type="button" data-action="incoming" data-from="${from.id}">${eng(from.name)}<span class="portal-meta">שער ${p.number} במפת המקור · ${portalTypeLabel(p,from)}</span></button><button type="button" class="portal-locate" data-action="incoming-scene" data-from="${from.id}" data-gate="${esc(p.key)}" aria-label="הצגת שער המקור">${icon('pin')}</button></div>`).join(''):'<p class="empty-state">לא נמצאה כניסה דרך שער קבוע ממפה אחרת. ייתכן שהכניסה דרך דמות, אירוע או משימה.</p>';
    const services=(atlas.services||[]).filter(s=>s.to===m.id);if(services.length)html+=serviceSection(services,true);
  }else{
    const ps=m.portals.filter(p=>displayKind(p,m)===detailsTab);
    if(detailsTab==='unknown')html+='<p class="section-note">אלה רשומות ללא מפת יעד קבועה בנתוני הלקוח. חלקן נקודות נחיתה, עוגנים או מעברים שהמשחק מפעיל באמצעות תסריט. הן אינן מוצגות כיציאות מאומתות.</p>';
    if(detailsTab==='internal')html+='<p class="section-note">קיצורי דרך בין שתי נקודות בתוך המפה הזאת. לחיצה מציגה את מיקום השער ואת נקודת הנחיתה, כשזו רשומה במקור.</p>';
    html+=ps.length?ps.map(p=>portalCard(p,m)).join(''):`<p class="empty-state">${detailsTab==='cross'?'אין במקור שער יציאה בעל יעד קבוע למפה אחרת.':detailsTab==='internal'?'לא נרשמו מעברים פנימיים במפה הזאת.':'לכל רשומות השער במפה הזאת יש יעד קבוע.'}</p>`;
    if(detailsTab==='cross' || detailsTab==='unknown') {const services=getServices(m.id);if(services.length)html+=serviceSection(services);}
  }
  $('portalContent').innerHTML=html;
  document.querySelectorAll('.portal-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===detailsTab));
}
function serviceSection(services,isIncoming=false) {
  return `<section class="service-section"><h3>${isIncoming?'כניסות ממקורות משלימים':'מעברים ממקורות משלימים'}</h3>${services.map(s=>{const target=byId.get(isIncoming?s.from:s.to);const urls=serviceUrls(s);return `<div class="service-card"><button type="button" data-action="service-target" data-target="${target?.id||''}"><span>${esc(serviceLabel(s))}</span>${target?eng(target.name):'<span class="scope-description">היעד תלוי במצב המשחק</span>'}</button>${s.npc?eng(s.npc):''}<p>${esc(serviceCondition(s))}</p>${urls[0]?`<a class="source-link" href="${esc(urls[0])}" target="_blank" rel="noopener noreferrer">מקור והסבר</a>`:''}</div>`;}).join('')}</section>`;
}
function selectMap(id,{focus=false,hash=true,scroll=true}={}) {
  id=Number(id);if(!byId.has(id))return;
  const target=byId.get(id);
  if(!visibleMap(target)){
    currentRegion=['event','system','unavailable'].includes(target.scope)?'archive':'world';
    document.querySelectorAll('[data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region===currentRegion));
    updateVisibleNodes();
  }
  activeId=id;detailsTab='cross';renderDetails();highlightGraph();
  if(hash)history.replaceState(null,'',`#map=${id}`);
  if(focus)centerOnMap(byId.get(id));
  if(scroll)$('sidePanel').scrollTo({top:0,behavior:'smooth'});
}
function highlightGraph() {
  const m=byId.get(activeId);if(!m)return;
  const neighbors=new Set(m.portals.filter(p=>p.kind==='cross').map(p=>p.to));
  (incoming.get(m.id)||[]).forEach(i=>neighbors.add(i.from.id));
  for(const s of serviceElements){if(s.a===m.id)neighbors.add(s.b);if(s.b===m.id)neighbors.add(s.a);}
  for(const [id,g] of nodeElements){g.classList.toggle('selected',id===m.id);g.classList.toggle('neighbor',neighbors.has(id));}
  for(const {element,a,b} of [...edgeElements,...serviceElements])element.classList.toggle('highlighted',a===m.id || b===m.id);
}

function buildWorld() {
  $('worldDefs').innerHTML=`<radialGradient id="landGrad"><stop offset="0" stop-color="#335d45"/><stop offset=".65" stop-color="#284d3c"/><stop offset="1" stop-color="#203d35"/></radialGradient><radialGradient id="hollowGrad"><stop offset="0" stop-color="#4d496e"/><stop offset="1" stop-color="#273e46"/></radialGradient><radialGradient id="rockGrad"><stop offset="0" stop-color="#77704e"/><stop offset="1" stop-color="#4a5038"/></radialGradient><radialGradient id="mapleGrad"><stop offset="0" stop-color="#507146"/><stop offset="1" stop-color="#2d4b39"/></radialGradient><filter id="landShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="19" stdDeviation="26" flood-color="#071820" flood-opacity=".6"/></filter><pattern id="contour" width="190" height="140" patternUnits="userSpaceOnUse"><path d="M0 80Q45 40 95 70T190 50M0 100Q45 60 95 90T190 70M-30 130Q60 100 110 120T230 95" fill="none" stroke="#c7d396" stroke-opacity=".04" stroke-width="2"/></pattern>`;
  buildLandscape();
  const unique=new Map();
  for(const m of maps)for(const p of m.portals)if(p.kind==='cross' && byId.has(p.to)){
    const a=Math.min(m.id,p.to),b=Math.max(m.id,p.to),key=`${a}:${b}`;
    if(!unique.has(key))unique.set(key,{a,b,noEffect:p.noEffect});else if(!p.noEffect)unique.get(key).noEffect=false;
  }
  $('edgeLayer').replaceChildren();edgeElements=[];serviceElements=[];
  for(const edge of unique.values()){
    const a=byId.get(edge.a),b=byId.get(edge.b);
    const element=svgEl('path',{d:edgePath(a,b),class:`world-edge ${edge.noEffect?'no-effect':''}`});
    $('edgeLayer').append(element);edgeElements.push({...edge,element});
  }
  for(const s of atlas.services||[])if(s.to!=null && byId.has(s.from) && byId.has(s.to)){
    const a=byId.get(s.from),b=byId.get(s.to),element=svgEl('path',{d:edgePath(a,b),class:'world-edge service'});$('edgeLayer').append(element);serviceElements.push({a:s.from,b:s.to,element});
  }
  $('nodeLayer').replaceChildren();nodeElements.clear();
  const ordered=[...maps].sort((a,b)=>Number(a.major)-Number(b.major));
  for(const m of ordered){
    const g=svgEl('g',{class:`world-node ${m.major?'major':''}`,transform:`translate(${m.x},${m.y})`,tabindex:'0',role:'button','aria-label':`${m.name}. ${groupLabel(m)}. ${m.portals.filter(p=>p.kind==='cross').length} יציאות`,'data-map':m.id});
    const major=Boolean(m.major),r=major?37:8.5;
    g.append(svgEl('circle',{class:'node-hit',r:major?57:22}),svgEl('circle',{class:'node-halo',r:major?46:17}));
    if(major){g.append(svgEl('circle',{class:'town-base',r}));const glyph=svgEl('g',{class:'town-glyph',transform:'translate(-25,-25)'});glyph.innerHTML=townGlyph(m);g.append(glyph);}
    else g.append(svgEl('circle',{class:`node-dot ${m.hiddenArea?'node-secret':''}`,r}));
    const label=svgEl('text',{class:`node-label ${major?'town-label':'map-label'}`,y:major?66:-19,'font-size':major?31:19},m.name.length>39 && !major?m.name.slice(0,36)+'…':m.name);g.append(label);
    g.addEventListener('click',()=>{if(!worldMoved)selectMap(m.id);});
    g.addEventListener('dblclick',e=>{e.stopPropagation();selectMap(m.id);openScene(m.id);});
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectMap(m.id,{focus:true});}});
    g.addEventListener('pointerenter',e=>showMapTooltip(e,m));g.addEventListener('pointermove',e=>showMapTooltip(e,m));g.addEventListener('pointerleave',()=>$('mapTooltip').hidden=true);
    $('nodeLayer').append(g);nodeElements.set(m.id,g);
  }
  updateVisibleNodes();
}
function townGlyph(m) {
  const name=m.name.toLowerCase();
  if(name.includes('ellinia'))return '<path d="M24 3 6 22h10L8 34h13v13h8V34h13L33 22h10L25 3Z" fill="#72956b" stroke-width="2"/><path d="M20 47V32h11v15M19 26h12" fill="none" stroke-width="2.2"/>';
  if(name.includes('perion'))return '<path d="m4 40 12-26 8 16 10-25 13 35Z" fill="#ad9364" stroke-width="2"/><path d="m21 44 5-14 6 14M15 20l4 8-4-2-4 2M34 11l4 9-4-3-4 3" fill="none" stroke-width="2"/>';
  if(name.includes('kerning'))return '<path d="M7 45V17h13V8h18v18h6v19Z" fill="#6f9094" stroke-width="2"/><path d="M12 24h3m-3 7h3m11-15h5m-5 8h5m-5 8h5m-5 8h5M9 45h34" fill="none" stroke-width="2"/>';
  if(name.includes('hollow'))return '<path d="M5 45C4 17 17 4 26 4s22 13 21 41H36C37 27 30 15 25 15S12 27 15 45Z" fill="#7a7693" stroke-width="2"/><path d="m24 22-6 11 7 11 6-11Z" fill="#a4d3c4" stroke-width="1.5"/>';
  if(name.includes('harbor')||name.includes('southperry'))return '<path d="M5 35h41l-8 10H14Z" fill="#ab8c5c" stroke-width="2"/><path d="M25 5v30M24 8 8 29h16Zm4 3v18h13Z" fill="#d5c18f" stroke-width="2"/>';
  if(name.includes('florina'))return '<path d="M23 45c6-10 6-21 1-30M24 16Q10 4 3 20q11-4 21-4M24 16Q31 3 45 14q-13 0-21 2M24 16Q9 17 8 30q10-9 16-14M4 46q20-6 43 0" fill="none" stroke-width="3"/>';
  if(name.includes('sleepy'))return '<path d="M8 43V23h33v20M5 25 25 8l21 17Z" fill="#928a63" stroke-width="2"/><path d="M21 43V31h10v12M11 26h29M9 18l15-13 17 12" fill="none" stroke-width="2"/>';
  if(name.includes('market'))return '<path d="M8 23v22h34V23M5 21l5-13h29l6 13Z" fill="#c49d65" stroke-width="2"/><path d="M5 21q5 8 10 0 5 8 10 0 5 8 10 0 5 8 10 0M20 45V32h11v13" fill="none" stroke-width="2"/>';
  return '<path d="M15 28h22v17H15Z" fill="#b39969" stroke-width="2"/><path d="M4 27C4 3 45 3 47 27q-22 8-43 0Z" fill="#b7775e" stroke-width="2"/><path d="M23 45V34h8v11" fill="none" stroke-width="2"/><circle cx="17" cy="20" r="4" fill="#e8d8a7" stroke="none"/><circle cx="31" cy="15" r="4" fill="#e8d8a7" stroke="none"/><circle cx="39" cy="24" r="3" fill="#e8d8a7" stroke="none"/>';
}
function buildLandscape() {
  const land=$('landLayer');land.innerHTML='';
  const mainland='M250 790C170 620 390 530 600 570C650 380 780 240 1000 260C1240 180 1400 300 1510 440C1760 380 1890 470 2080 570C2270 640 2430 840 2340 1070C2410 1250 2460 1470 2300 1650C2150 1840 1870 1900 1640 1830C1420 1930 1120 1840 990 1790C740 1910 420 1810 280 1620C120 1450 140 1260 220 1100C120 990 130 870 250 790Z';
  const island='M140 270C150 130 300 30 470 80C590 0 770 80 840 220C980 360 770 480 620 480C470 540 280 450 180 390C90 360 110 320 140 270Z';
  land.append(svgEl('path',{d:mainland,fill:'url(#landGrad)',class:'land-border',filter:'url(#landShadow)'}),svgEl('path',{d:island,fill:'url(#mapleGrad)',class:'land-border',filter:'url(#landShadow)'}));
  land.append(svgEl('path',{d:mainland,fill:'url(#contour)'}));
  land.append(svgEl('ellipse',{cx:1170,cy:550,rx:300,ry:260,fill:'url(#rockGrad)',opacity:.5}));
  land.append(svgEl('ellipse',{cx:2050,cy:1510,rx:310,ry:310,fill:'url(#hollowGrad)',opacity:.75}));
  const other=[{x:500,y:2070,rx:300,ry:180,c:'url(#mapleGrad)'},{x:2070,y:290,rx:330,ry:230,c:'url(#landGrad)'},{x:2700,y:1550,rx:290,ry:340,c:'#293f49'},{x:2700,y:550,rx:300,ry:330,c:'#2a3d48'},{x:2700,y:2100,rx:240,ry:150,c:'#293f49'}];
  for(const a of other){const path=organicIsland(a.x,a.y,a.rx,a.ry,9,a.x);land.append(svgEl('path',{d:path,fill:a.c,stroke:'#849b7655','stroke-width':2,filter:'url(#landShadow)'}));}
  for(let i=0;i<5;i++){const off=i*24;land.append(svgEl('path',{d:`M140 ${610-off}Q450 ${480-off} 680 ${530-off}M2380 ${1120+off}Q2570 ${1280+off} 2370 ${1720+off}M110 ${1840+off}Q700 ${1980+off} 1080 ${1910+off}`,class:'ocean-lines'}));}
  land.append(svgEl('text',{class:'land-title',x:1250,y:1980},'VICTORIA ISLAND'));
  land.append(svgEl('text',{class:'group-label',x:480,y:40,'font-size':29},'MAPLE ISLAND'));
  land.append(svgEl('text',{class:'group-label',x:2070,y:40,'font-size':27},'FREE MARKET'));
  land.append(svgEl('text',{class:'group-label',x:2700,y:1180,'font-size':27},'SPECIAL ENTRANCES'));
  land.append(svgEl('text',{class:'group-label',x:2700,y:110,'font-size':27},'EVENT ARCHIVE'));
  let seed=729;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<155;i++){
    const x=260+rand()*2030,y=610+rand()*1120;
    if(maps.some(m=>Math.hypot(m.x-x,m.y-y)<(m.major?85:35)))continue;
    const tree=svgEl('g',{class:'decor-tree',transform:`translate(${x},${y}) scale(${.8+rand()*.7})`});tree.innerHTML='<path d="M0 12V-30" stroke="#6f8353" stroke-width="5"/><path d="m0-54-22 35h12L-27 2h54L10-19h12Z" fill="#7c9c61" stroke="#9eb478" stroke-opacity=".25" stroke-width="1.5"/>';land.append(tree);
  }
  for(let i=0;i<35;i++){const x=1800+rand()*480,y=1280+rand()*480;land.append(svgEl('circle',{cx:x,cy:y,r:1+rand()*2,fill:'#d4baf2',opacity:.4+rand()*.4}));}
  const compass=svgEl('g',{class:'compass',transform:'translate(100,2080)'});compass.innerHTML='<circle r="51"/><circle r="42"/><path d="m0-75 12 58 63 17-63 12-12 63-12-63-63-12 63-17Z"/><path d="M0-51V51M-51 0H51"/><text y="-90">N</text>';land.append(compass);
}
function organicIsland(cx,cy,rx,ry,n,seed){const pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=.9+.12*Math.sin(i*2.73+seed);pts.push([cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r]);}let d=`M${(pts[n-1][0]+pts[0][0])/2},${(pts[n-1][1]+pts[0][1])/2}`;for(let i=0;i<n;i++){const p=pts[i],q=pts[(i+1)%n];d+=`Q${p[0]},${p[1]} ${(p[0]+q[0])/2},${(p[1]+q[1])/2}`;}return d+'Z';}
function edgePath(a,b) {const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const offset=((a.id+b.id)%3-1)*8;return `M${a.x},${a.y}Q${mx+offset},${my-offset} ${b.x},${b.y}`;}
function visibleMap(m) {
  if(currentRegion==='archive')return ['event','system','unavailable'].includes(m.scope);
  if(currentRegion==='world')return !['event','system','unavailable'].includes(m.scope);
  if(currentRegion==='victoria')return m.region==='Victoria Island' && m.scope!=='unavailable';
  if(currentRegion==='hollow')return m.group==='hollow';
  if(currentRegion==='maple')return m.group==='maple';
  if(currentRegion==='special')return ['market','special'].includes(m.group);
  return true;
}
function updateVisibleNodes(){
  for(const m of maps){const visible=visibleMap(m);nodeElements.get(m.id)?.classList.toggle('dimmed',!visible);}
  for(const e of [...edgeElements,...serviceElements]){const show=visibleMap(byId.get(e.a))&&visibleMap(byId.get(e.b));e.element.classList.toggle('dimmed',!show);}
}
function applyWorld(){
  $('worldViewport').setAttribute('transform',`translate(${world.x},${world.y}) scale(${world.k})`);
  $('worldSvg').classList.toggle('detail-zoom',world.k>.82);$('worldSvg').classList.toggle('all-labels',showAllLabels);
  for(const [id,g] of nodeElements){const m=byId.get(id),label=g.querySelector('text');const size=m.major?14/world.k:12/world.k;label.setAttribute('font-size',size);if(!m.major)g.querySelector('.node-hit').setAttribute('r',Math.max(18,11/world.k));}
}
function fitWorld(){
  const ms=maps.filter(visibleMap);if(!ms.length)return;const r=$('mapCanvas').getBoundingClientRect();const padX=r.width<600?50:90,padY=100;
  const minX=Math.min(...ms.map(m=>m.x))-70,maxX=Math.max(...ms.map(m=>m.x))+70,minY=Math.min(...ms.map(m=>m.y))-70,maxY=Math.max(...ms.map(m=>m.y))+80;
  const k=Math.min((r.width-padX)/(maxX-minX),(r.height-padY-85)/(maxY-minY));world.k=Math.max(.06,Math.min(1.9,k));world.x=(r.width-(minX+maxX)*world.k)/2;world.y=110+(r.height-155-(minY+maxY)*world.k)/2;applyWorld();
  $('mapIntro').classList.toggle('is-hidden',currentRegion!=='world'||r.width<850||r.height<650);
}
function centerOnMap(m){const r=$('mapCanvas').getBoundingClientRect();world.k=Math.max(world.k,1.25);world.x=r.width/2-m.x*world.k;world.y=(r.height+90)/2-m.y*world.k;applyWorld();$('mapIntro').classList.add('is-hidden');}
function zoomWorld(factor,cx,cy){const r=$('mapCanvas').getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;const k=Math.max(.06,Math.min(4,world.k*factor)),ratio=k/world.k;world.x=cx-(cx-world.x)*ratio;world.y=cy-(cy-world.y)*ratio;world.k=k;applyWorld();$('mapIntro').classList.add('is-hidden');}
function showMapTooltip(e,m){if(worldMoved||e.pointerType==='touch')return;const box=$('mapCanvas').getBoundingClientRect();const x=e.clientX-box.left,y=e.clientY-box.top;const tip=$('mapTooltip');tip.innerHTML=`${eng(m.name)}<small>${esc(groupLabel(m))} · ${m.portals.filter(p=>p.kind==='cross').length} שערי יציאה</small>`;tip.hidden=false;tip.style.left=`${Math.min(box.width-290,Math.max(12,x+18))}px`;tip.style.top=`${Math.min(box.height-90,y+18)}px`;}

function closeSearch(){
  $('searchResults').hidden=true;$('search').setAttribute('aria-expanded','false');
  $('search').removeAttribute('aria-activedescendant');searchIndex=-1;
  $('searchResults').querySelectorAll('[role="option"]').forEach(b=>b.setAttribute('aria-selected','false'));
}
function moveSearchSelection(delta){
  if(!activeSearchResults.length)return;
  searchIndex=searchIndex<0?(delta>0?0:activeSearchResults.length-1):(searchIndex+delta+activeSearchResults.length)%activeSearchResults.length;
  const options=$('searchResults').querySelectorAll('[role="option"]');
  options.forEach((b,i)=>b.setAttribute('aria-selected',String(i===searchIndex)));
  const selected=options[searchIndex];
  if(selected){$('search').setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest'});}
}
function handleSearchKey(e){
  if(e.key==='Escape'){closeSearch();return;}
  if(!$('search').value.trim())return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();if($('searchResults').hidden)renderSearch();moveSearchSelection(e.key==='ArrowDown'?1:-1);
  }else if(e.key==='Enter'&&!$('searchResults').hidden&&activeSearchResults.length){
    e.preventDefault();const result=activeSearchResults[Math.max(0,searchIndex)];chooseSearch(result.id,result.kind);
  }else if(e.key==='Tab')closeSearch();
}
function renderSearch(){
  const q=$('search').value.trim().toLowerCase();searchIndex=-1;
  $('search').removeAttribute('aria-activedescendant');
  if(!q){activeSearchResults=[];$('searchResults').innerHTML='';closeSearch();return;}
  const mapMatches=findMaps(q).map(m=>({...m,kind:'map'}));
  const huntMatches=window.Hunt?.searchAll(q)||[];
  activeSearchResults=[...mapMatches,...huntMatches].sort((a,b)=>Number(String(b.id)===q)-Number(String(a.id)===q)||Number(b.name.toLowerCase()===q)-Number(a.name.toLowerCase()===q)||Number(b.name.toLowerCase().startsWith(q))-Number(a.name.toLowerCase().startsWith(q))).slice(0,16);
  const kindLabels={map:'מפה',item:'פריט',monster:'מפלצת',boss:'בוס',npc:'דמות'};
  $('searchResults').innerHTML=activeSearchResults.length?activeSearchResults.map((m,i)=>`<button type="button" id="search-option-${i}" class="search-result search-result-mixed" role="option" aria-selected="false" tabindex="-1" data-id="${m.id}" data-kind="${esc(m.kind)}">${m.icon?`<img class="search-entity-icon" src="${esc(m.icon)}" alt="">`:`<span class="search-entity-icon search-map-icon">${icon('pin')}</span>`}<span class="search-result-copy">${eng(m.name)}<small>${kindLabels[m.kind]||'תוצאה'} · ${m.kind==='map'?esc(groupLabel(m))+' · ':''}${m.id}${m.kind==='map'&&m.scope!=='world'?' · '+scopeLabels[m.scope]:''}</small></span></button>`).join(''):'<div class="search-empty">לא נמצאה תוצאה. אפשר לחפש גם חלק משם באנגלית או מזהה.</div>';
  $('searchResults').hidden=false;$('search').setAttribute('aria-expanded','true');
}
const aliases={'הנסיס':'henesys','אליניה':'ellinia','פריון':'perion','קרנינג':'kerning','סליפיווד':'sleepywood','לית':'lith','פלורינה':'florina','אמהרסט':'amherst'};
function findMaps(q){q=q.trim().toLowerCase();const alias=Object.entries(aliases).find(([he])=>q===he);if(alias)q=alias[1];return maps.filter(m=>`${m.name} ${m.id} ${m.street} ${groupLabel(m)}`.toLowerCase().includes(q)).sort((a,b)=>Number(b.name.toLowerCase().startsWith(q))-Number(a.name.toLowerCase().startsWith(q))||Number(b.major)-Number(a.major)||a.name.localeCompare(b.name));}
function chooseSearch(id,kind='map'){closeSearch();activeSearchResults=[];$('search').value='';$('directory').hidden=true;if(kind!=='map'){window.Hunt?.open(kind,Number(id));return;}window.Hunt?.close();selectMap(id,{focus:true});}
function openDirectory(){const opening=$('directory').hidden;$('directory').hidden=!opening;if(opening){window.Hunt?.close();renderDirectory();$('directorySearch').focus();}}
function renderDirectory(){const q=$('directorySearch').value.trim().toLowerCase(),group=$('directoryGroup').value;const list=(q?findMaps(q):[...maps].sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id)).filter(m=>group==='all'||m.group===group);$('directoryCounter').textContent=`${fmt(list.length)} מתוך ${fmt(maps.length)} רשומות · כל מפה נשמרת לפי מזהה ייחודי`;
  $('directoryGrid').innerHTML=list.map(m=>`<button type="button" class="directory-card" data-id="${m.id}"><img loading="lazy" decoding="async" src="${esc(m.minimap||m.image)}" alt="" data-map="${m.id}"><span class="card-info">${eng(m.name)}<small>${esc(groupLabel(m))} · ${m.id}</small>${m.scope!=='world'?`<small>${esc(scopeLabels[m.scope])}</small>`:''}</span></button>`).join('')||'<p class="no-results">אין מפות שמתאימות לסינון הזה.</p>';
  $('directoryGrid').querySelectorAll('img').forEach(img=>img.addEventListener('error',e=>imageFallback(e.target)));
}

function openRoute(){ $('routePanel').hidden=false;$('routeToggle').setAttribute('aria-pressed','true');$('sidePanel').scrollTo({top:0,behavior:'smooth'});if(!$('routeFrom').value && byId.has(activeId))$('routeFrom').value=mapLabel(byId.get(activeId)); }
function planTo(mapId,fromId){
  const target=byId.get(Number(mapId)),origin=byId.get(Number(fromId))||byId.get(activeId);
  if(!target||!origin)return;
  window.Hunt?.close();if($('sceneDialog').open)$('sceneDialog').close();$('directory').hidden=true;
  selectMap(target.id,{scroll:false});openRoute();
  $('routeFrom').value=mapLabel(origin);$('routeTo').value=mapLabel(target);
  // Conditional entrances stay visible in each route step; only use them when needed.
  $('useServices').checked=!findRoute(origin.id,target.id,false)&&!!findRoute(origin.id,target.id,true);
  submitRoute();
}
function routeMap(value){const id=value.match(/\[(\d+)\]\s*$/);if(id)return byId.get(Number(id[1]));const normalized=value.trim().toLowerCase();const exact=maps.filter(m=>m.name.toLowerCase()===normalized||String(m.id)===normalized);return exact.length===1?exact[0]:null;}
function findRoute(from,to,services=false){
  const queue=[{id:from,origin:null}],seen=new Set([`${from}:null`]),prev=new Map();let found=null;
  for(let i=0;i<queue.length;i++){
    const item=queue[i],key=`${item.id}:${item.origin}`;if(item.id===to){found=key;break;}
    const options=[...(adjacency.get(item.id)||[])];for(const s of getServices(item.id))if(canRouteService(s) && (services || s.walkable===true))options.push({to:s.to,service:s});
    for(const option of options){let origin=item.origin;const s=option.service;
      if(s?.active_until_utc && new Date(s.active_until_utc).getTime()<new Date(atlas.meta.asOf+'T00:00:00Z').getTime())continue;
      if(s?.requires_state?.florina_origin && origin!==s.requires_state.florina_origin)continue;
      if(s?.stores_state==='florina_origin')origin=s.from;
      const nextKey=`${option.to}:${origin}`;if(seen.has(nextKey))continue;seen.add(nextKey);prev.set(nextKey,{key,from:item.id,to:option.to,p:option.p,service:s});queue.push({id:option.to,origin});
    }
  }
  if(found===null)return null;const steps=[];while(prev.has(found)){const step=prev.get(found);steps.push(step);found=step.key;}steps.reverse();return {from,to,steps};
}
function submitRoute(e){if(e)e.preventDefault();const from=routeMap($('routeFrom').value),to=routeMap($('routeTo').value);if(!from||!to){$('routeResult').innerHTML='<p class="route-warning">בחרו שתי מפות מהרשימה. כששם מופיע כמה פעמים, המזהה בסוגריים מבדיל בין המפות.</p>';return;}
  route=findRoute(from.id,to.id,$('useServices').checked);drawRoute();
  if(!route){$('routeResult').innerHTML='<p class="route-warning">אין מסלול מלא דרך המעברים הידועים שנבחרו. ייתכן שנדרשים שירות נסיעה, תנאי משחק, או מעבר שהיעד שלו אינו מופיע בקבצים. אפשר לסמן שימוש בכניסות דרך דמויות ומשימות; גם אז חלק מהמעברים נשארים לא ידועים.</p>';return;}
  const serviceCount=route.steps.filter(s=>s.service && !s.service.walkable).length;
  const ids=[route.from,...route.steps.map(s=>s.to)];
  let html=`<p class="route-summary">${route.steps.length===0?'כבר נמצאים במפת היעד.':`${route.steps.length} מעברים · ${serviceCount?serviceCount+' מהם מותנים':'דרך שערים עם יעד מתועד'}`}</p>`;
  if(serviceCount)html+='<p class="route-warning">המסלול כולל כניסות מותנות. יש לעמוד בתנאים שמופיעים בכל שלב; לא נבדקו הדמות, המשימות או הערוץ שלך.</p>';
  if(ids.some(id=>['event','system','unavailable'].includes(byId.get(id).scope)))html+='<p class="route-warning">המסלול עובר ברשומות אירוע או מערכת. קיום החיבור בקובץ אינו מבטיח כניסה במשחק.</p>';
  html+=ids.map((id,i)=>{const step=route.steps[i],m=byId.get(id),gate=step?.p||(step?.service?m.portals.find(p=>supplementForGate(p,m)?.id===step.service.id):null);return `<div class="route-step"><span class="step-number">${i+1}</span><div class="route-step-content"><button type="button" data-route-map="${id}">${eng(m.name)}${step?`<small>${step.service?esc(serviceLabel(step.service)):esc(`שער ${step.p.number} · ${directionLabel(step.p,m)} · ${portalTypeLabel(step.p,m)}`)}</small>${step.service?`<small>${esc(serviceCondition(step.service))}</small>`:''}`:'<small>מפת היעד</small>'}</button>${gate?`<button type="button" class="route-locate" data-route-scene="${id}" data-route-gate="${esc(gate.key)}">${icon('pin')}הצגת שער היציאה ${gate.number}</button>`:''}</div></div>`;}).join('');
  html+='<button type="button" id="clearRoute" class="clear-route">ניקוי המסלול</button>';$('routeResult').innerHTML=html;
  if(ids.length>1)fitRoute(ids);toast(route.steps.length?`נמצא מסלול עם ${route.steps.length} מעברים`:'זו כבר מפת המוצא');
}
function drawRoute(){const layer=$('routeLayer');layer.replaceChildren();if(!route)return;for(const s of route.steps){const a=byId.get(s.from),b=byId.get(s.to);layer.append(svgEl('path',{d:edgePath(a,b),class:`route-edge ${s.service?'service':''}`}));}const ids=[route.from,...route.steps.map(s=>s.to)];ids.forEach((id,i)=>{const m=byId.get(id),g=svgEl('g',{transform:`translate(${m.x+19},${m.y-20})`});g.append(svgEl('circle',{class:'route-dot',r:17}),svgEl('text',{class:'route-number'},i+1));layer.append(g);});}
function fitRoute(ids){const ms=ids.map(id=>byId.get(id)),r=$('mapCanvas').getBoundingClientRect();const minX=Math.min(...ms.map(m=>m.x))-100,maxX=Math.max(...ms.map(m=>m.x))+100,minY=Math.min(...ms.map(m=>m.y))-100,maxY=Math.max(...ms.map(m=>m.y))+100;world.k=Math.min((r.width-90)/(maxX-minX),(r.height-185)/(maxY-minY),1.6);world.k=Math.max(.07,world.k);world.x=(r.width-(minX+maxX)*world.k)/2;world.y=100+(r.height-150-(minY+maxY)*world.k)/2;applyWorld();$('mapIntro').classList.add('is-hidden');}

const loadedSceneImages=new Set();
function loadSceneImage(retry=false){
  const m=byId.get(sceneId);if(!m)return;
  const image=$('sceneImage'),status=$('sceneImageStatus'),requestedMap=sceneId;
  if(!retry&&loadedSceneImages.has(m.image)&&image.getAttribute('href')===m.image){status.hidden=true;return;}
  status.hidden=false;status.dataset.state='loading';$('sceneImageMessage').textContent='טוענים את תמונת המפה…';$('sceneImageRetry').hidden=true;
  image.style.visibility='hidden';$('sceneCanvas').setAttribute('aria-busy','true');
  image.onload=()=>{if(sceneId!==requestedMap)return;loadedSceneImages.add(m.image);image.style.visibility='';status.hidden=true;$('sceneCanvas').setAttribute('aria-busy','false');};
  image.onerror=()=>{if(sceneId!==requestedMap)return;status.dataset.state='error';$('sceneImageMessage').textContent='תמונת המפה לא נטענה. השערים והמיקומים עדיין זמינים ברשימה.';$('sceneImageRetry').hidden=false;$('sceneCanvas').setAttribute('aria-busy','false');};
  image.setAttribute('href',retry?`${m.image}?retry=${Date.now()}`:m.image);
}
function openScene(id,gateKey=null){const m=byId.get(Number(id));if(!m)return;sceneId=m.id;selectedGate=gateKey;const gate=m.portals.find(p=>p.key===gateKey);sceneKind=gate?displayKind(gate,m):'cross';$('sceneTitle').textContent=m.name;$('sceneRegion').textContent=groupLabel(m);$('sceneImage').setAttribute('width',m.width||3000);$('sceneImage').setAttribute('height',m.height||1500);loadSceneImage();$('originalImage').href=m.originalImage||m.image;if(!$('sceneDialog').open)$('sceneDialog').showModal();setSceneLayer('portals',[]);requestAnimationFrame(()=>{fitScene();if(gate)pickGate(gate.key,false);});}
function fitScene(){const m=byId.get(sceneId);if(!m)return;const r=$('sceneCanvas').getBoundingClientRect(),w=m.width||3000,h=m.height||1500;scene.k=Math.min((r.width-48)/w,(r.height-60)/h);scene.x=(r.width-w*scene.k)/2;scene.y=(r.height-h*scene.k)/2;applyScene();}
function applyScene(){const m=byId.get(sceneId);if(!m)return;$('sceneViewport').setAttribute('transform',`translate(${scene.x},${scene.y}) scale(${scene.k})`);for(const pin of portalPinElements.values()){pin.querySelector('circle').setAttribute('r',12/scene.k);pin.querySelector('circle').setAttribute('stroke-width',1.7/scene.k);pin.querySelector('text').setAttribute('font-size',11/scene.k);}for(const pin of entityPinElements.values()){pin.querySelector('circle').setAttribute('r',(pin.classList.contains('boss')?14:11)/scene.k);pin.querySelector('circle').setAttribute('stroke-width',1.7/scene.k);pin.querySelector('text').setAttribute('font-size',10/scene.k);}document.querySelectorAll('.internal-path').forEach(p=>{p.setAttribute('stroke-width',2/scene.k);p.setAttribute('stroke-dasharray',`${6/scene.k} ${5/scene.k}`);});}
function zoomScene(factor,cx,cy){const r=$('sceneCanvas').getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;const k=Math.max(.015,Math.min(3,scene.k*factor)),ratio=k/scene.k;scene.x=cx-(cx-scene.x)*ratio;scene.y=cy-(cy-scene.y)*ratio;scene.k=k;applyScene();}
function renderScenePins(){const m=byId.get(sceneId);$('scenePins').replaceChildren();portalPinElements.clear();for(const p of m.portals){if(sceneKind!=='all'&&displayKind(p,m)!==sceneKind)continue;const g=svgEl('g',{class:`scene-pin ${p.kind} ${p.noEffect?'no-effect':''} ${p.key===selectedGate?'chosen':''}`,transform:`translate(${p.x},${p.y})`,role:'button',tabindex:'0','aria-label':`שער ${p.number}: ${portalTarget(p,m)}`});g.append(svgEl('circle',{r:12/scene.k}),svgEl('text',{'font-size':11/scene.k},p.number));g.addEventListener('click',e=>{e.stopPropagation();if(!sceneDragging)pickGate(p.key,false);});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickGate(p.key,false);}});$('scenePins').append(g);portalPinElements.set(p.key,g);}drawInternal();applyScene();}
function renderSceneSidebar(){const m=byId.get(sceneId);document.querySelectorAll('#sceneFilters button').forEach(b=>b.classList.toggle('active',b.dataset.kind===sceneKind));const ps=m.portals.filter(p=>sceneKind==='all'||displayKind(p,m)===sceneKind);let text='';if(sceneKind==='unknown')text='<p class="section-note">נקודות ללא יעד קבוע. אין להסיק שכל נקודה כזאת היא שער פעיל.</p>';if(sceneKind==='internal')text='<p class="section-note">בחרו שער כדי לראות גם את נקודת הנחיתה שלו. קו מופיע רק אם נקודת היעד נמצאה בשמה.</p>';$('scenePortalList').innerHTML=text+(ps.length?ps.map(p=>portalCard(p,m,true)).join(''):'<p class="empty-state">אין שערים מהסוג הזה במפה.</p>');renderSceneSelected();}
function renderSceneSelected(){const m=byId.get(sceneId),p=m.portals.find(p=>p.key===selectedGate);if(!p){$('sceneSelected').innerHTML='';return;}const supplement=supplementForGate(p,m);const target=byId.get(p.to??supplement?.to);let html=`<div class="scene-selected"><span>שער ${p.number} · ${portalTypeLabel(p,m)}</span>${eng(portalTarget(p,m))}<small>מיקום בתמונת המקור: <bdi dir="ltr">x ${p.x}, y ${p.y}</bdi></small><small>שם השער בקובץ</small>${eng(p.name||'ללא שם')}`;if((p.kind==='cross'||supplement)&&target){if(supplement)html+=`<p>${esc(serviceCondition(supplement))}</p><small>יעד זה מתועד במקור משלים; הוא אינו יעד קבוע ברשומת הלקוח.</small><a class="source-link" href="${esc(serviceUrls(supplement)[0])}" target="_blank" rel="noopener noreferrer">מקור התיעוד</a>`;html+=`<button type="button" class="button primary" data-scene-travel="${target.id}">לעבור אל מפת היעד</button>`;}else if(p.kind==='internal'){const destinations=m.portals.filter(q=>q.name===p.toPortal);html+=`<small>${destinations.length===0?'שם נקודת היעד קיים, אך לא נמצאה לה קואורדינטה ברשומות השערים.':destinations.length>1?'נמצאו כמה נקודות עם שם היעד; כולן מסומנות.':'הקו מחבר לשער הנחיתה באותה מפה.'}</small>`;}else html+='<small>היעד אינו קבוע בנתוני הלקוח. אין כאן חיבור מאומת למפה אחרת.</small>';html+='</div>';$('sceneSelected').innerHTML=html;}
function pickGate(key,focus){const m=byId.get(sceneId),p=m.portals.find(p=>p.key===key);if(!p)return;selectedGate=key;for(const [k,g]of portalPinElements)g.classList.toggle('chosen',k===key);$('scenePortalList').querySelectorAll('.portal-card').forEach(c=>c.classList.toggle('chosen',c.dataset.gate===key));renderSceneSelected();drawInternal();if(focus){const r=$('sceneCanvas').getBoundingClientRect();const targetK=Math.max(scene.k,Math.min(.7,r.width/1000));scene.k=targetK;scene.x=r.width/2-p.x*scene.k;scene.y=r.height/2-p.y*scene.k;applyScene();}}
function drawInternal(){const layer=$('sceneInternal');layer.replaceChildren();const m=byId.get(sceneId),p=m?.portals.find(p=>p.key===selectedGate);if(!p||p.kind!=='internal')return;const targets=m.portals.filter(q=>q.name===p.toPortal);for(const t of targets){layer.append(svgEl('path',{class:'internal-path',d:`M${p.x},${p.y}Q${(p.x+t.x)/2},${Math.min(p.y,t.y)-100} ${t.x},${t.y}`}));const target=svgEl('circle',{cx:t.x,cy:t.y,r:19/scene.k,fill:'none',stroke:'#f5ddac','stroke-width':2/scene.k});layer.append(target);}applyScene();}

function openSpawns(mapId,mobIds=[]){openScene(mapId);setSceneLayer('monsters',mobIds);}
function openNpcs(mapId,npcIds=[]){openScene(mapId);setSceneLayer('npcs',npcIds);}
function entityDefinition(id){
  const catalog=sceneLayer==='npcs'?window.HuntData?.npcs:window.HuntData?.monsters;
  return catalog?.find(n=>n.id===id)||{id,name:byId.get(sceneId)?.npcs.find(n=>n.id===id)?.name||String(id)};
}
function setSceneLayer(layer,ids=[]){
  sceneLayer=layer;sceneEntityIds=(Array.isArray(ids)?ids:[ids]).map(Number);selectedEntity=null;
  const isPortal=layer==='portals';
  $('scenePins').style.display=isPortal?'':'none';$('sceneInternal').style.display=isPortal?'':'none';
  $('sceneFilters').hidden=!isPortal;$('sceneEntitySummary').hidden=isPortal;
  $('sceneEntities').replaceChildren();entityPinElements.clear();
  document.querySelectorAll('#sceneLayers button').forEach(b=>{b.classList.toggle('active',b.dataset.layer===layer);b.setAttribute('aria-pressed',String(b.dataset.layer===layer));});
  $('sceneHint').textContent=isPortal?'המספרים תואמים לרשימת השערים · גלגלת לקירוב · גרירה לתנועה':layer==='npcs'?'מיקומי דמויות מתוך קובץ המפה · גלגלת לקירוב · גרירה לתנועה':'נקודות הופעה רשומות · אינן מציגות מפלצות חיות בזמן אמת';
  if(isPortal){renderScenePins();renderSceneSidebar();return;}
  renderSceneEntities();
}
function renderSceneEntities(){
  const m=byId.get(sceneId),isNpc=sceneLayer==='npcs';
  if(!isNpc&&!window.HuntData){
    sceneEntityPoints=[];$('sceneSelected').innerHTML='';
    $('sceneEntitySummary').innerHTML=window.Hunt?.catalogStatus==='unavailable'?'<p class="section-note" role="status">נתוני נקודות ההופעה לא נטענו.</p><button type="button" class="button quiet" id="sceneRetryCatalog">פתיחת הקטלוג לניסיון נוסף</button>':'<p class="section-note" role="status">טוענים את נתוני נקודות ההופעה…</p>';
    $('scenePortalList').innerHTML='';return;
  }
  const raw=isNpc?(m.npcs||[]).map(p=>({...p,entityId:p.id})):(window.HuntData?.mapSpawns?.[sceneId]?.points||[]).map(p=>({...p,entityId:p.mobId}));
  sceneEntityPoints=raw.filter(p=>(!sceneEntityIds.length||sceneEntityIds.includes(p.entityId))&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map((p,i)=>({...p,number:i+1,key:`${sceneLayer}:${sceneId}:${i}`}));
  const uniqueIds=[...new Set(sceneEntityPoints.map(p=>p.entityId))];
  const selectedNames=sceneEntityIds.map(entityDefinition).map(n=>eng(n.name)).join('');
  let summary=`<div class="entity-scene-summary"><span class="eyebrow">${isNpc?'אנשים בדרך':'איפה מתחיל הציד'}</span>${selectedNames}<strong>${sceneEntityPoints.length===1?(isNpc?'מיקום דמות אחד':'נקודת הופעה אחת'):fmt(sceneEntityPoints.length)+' '+(isNpc?'מיקומי דמויות':'נקודות הופעה')} · ${uniqueIds.length===1?(isNpc?'דמות אחת':'סוג מפלצת אחד'):uniqueIds.length+' '+(isNpc?'מזהי דמות':'סוגי מפלצות')}</strong>`;
  if(sceneEntityIds.length)summary+=`<button type="button" class="entity-show-all" id="sceneShowAll">${isNpc?'הצג את כל הדמויות במפה':'הצג את כל המפלצות במפה'}</button>`;
  summary+=`<p>${isNpc?'המיקום מבוסס על קובץ המפה. דמות משימה או אירוע עשויה להופיע רק בתנאים מסוימים.':'זו פריסת נקודות ההופעה שבנתונים. מספר המפלצות החיות וזמן החזרה נשלטים על ידי שרת המשחק.'}</p></div>`;
  $('sceneEntitySummary').innerHTML=summary;
  $('sceneSelected').innerHTML='';
  for(const p of sceneEntityPoints){
    const def=entityDefinition(p.entityId),boss=!isNpc&&def.isBoss;
    const pin=svgEl('g',{class:`entity-pin ${isNpc?'npc':boss?'boss':'monster'}`,transform:`translate(${p.x},${p.y})`,role:'button',tabindex:'0','aria-label':`${isNpc?'מיקום':'נקודת הופעה'} ${p.number}: ${def.name}`});
    pin.append(svgEl('circle'),svgEl('text',{},p.number));
    pin.addEventListener('click',e=>{e.stopPropagation();if(!sceneDragging)pickEntity(p.key,false);});
    pin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickEntity(p.key,false);}});
    $('sceneEntities').append(pin);entityPinElements.set(p.key,pin);
  }
  $('scenePortalList').innerHTML=sceneEntityPoints.length?sceneEntityPoints.map(p=>{
    const def=entityDefinition(p.entityId);
    return `<button type="button" class="entity-location-card" data-entity-key="${esc(p.key)}"><span class="entity-location-number">${p.number}</span>${def.icon?`<img src="${esc(def.icon)}" alt="" loading="lazy">`:''}<span>${eng(def.name)}<small>${!isNpc&&def.isBoss?'בוס · ':''}${esc(directionLabel(p,m))}</small></span></button>`;
  }).join(''):`<p class="empty-state">${isNpc?'לא נרשם במפה הזאת מיקום של הדמות שנבחרה.':'אין נקודות הופעה רשומות לבחירה הזאת במפה. זימון באמצעות משימה או אירוע עשוי לא להופיע בקובץ.'}</p>`;
  if(sceneEntityPoints.length===1)pickEntity(sceneEntityPoints[0].key,false);
  applyScene();
}
function pickEntity(key,focus){
  const p=sceneEntityPoints.find(p=>p.key===key);if(!p)return;
  selectedEntity=key;const def=entityDefinition(p.entityId),isNpc=sceneLayer==='npcs';
  for(const [k,pin]of entityPinElements)pin.classList.toggle('chosen',k===key);
  $('scenePortalList').querySelectorAll('[data-entity-key]').forEach(b=>b.classList.toggle('chosen',b.dataset.entityKey===key));
  $('sceneSelected').innerHTML=`<div class="scene-selected entity-selected"><span>${isNpc?'מיקום דמות':def.isBoss?'נקודת הופעה של בוס':'נקודת הופעה'} ${p.number}</span>${eng(def.name)}<small>מזהה: ${p.entityId}${!isNpc&&def.level!=null?' · רמה '+def.level:''}</small><small>מיקום בתמונת המקור</small><bdi class="entity-coordinates" dir="ltr">x ${p.x}, y ${p.y}</bdi><p>${isNpc?'הסימון מראה את המיקום הרשום של הדמות במפה.':'הסימון מציין נקודת הופעה אפשרית. הוא אינו מאשר שהמפלצת נמצאת כאן כרגע.'}</p>${def.sourceUrl?`<a class="source-link" href="${esc(def.sourceUrl)}" target="_blank" rel="noopener noreferrer">רשומת המקור</a>`:''}</div>`;
  if(focus){const r=$('sceneCanvas').getBoundingClientRect();scene.k=Math.max(scene.k,Math.min(.8,r.width/900));scene.x=r.width/2-p.x*scene.k;scene.y=r.height/2-p.y*scene.k;applyScene();}
}

let sceneDragging=false;
function enablePanZoom(svg,kind){let points=new Map(),start=null,moved=false,lastDist=null;const isWorld=kind==='world',model=()=>isWorld?world:scene,apply=()=>isWorld?applyWorld():applyScene();
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===1){start={x:e.clientX,y:e.clientY,tx:model().x,ty:model().y};moved=false;if(isWorld)worldMoved=false;else sceneDragging=false;}else if(points.size===2){const ps=[...points.values()];lastDist=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y);}(e.target.setPointerCapture?e.target:svg).setPointerCapture(e.pointerId);});
  svg.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2){const ps=[...points.values()],dist=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y);if(lastDist){const r=svg.getBoundingClientRect(),cx=(ps[0].x+ps[1].x)/2-r.left,cy=(ps[0].y+ps[1].y)/2-r.top;(isWorld?zoomWorld:zoomScene)(dist/lastDist,cx,cy);}lastDist=dist;moved=true;}else if(start){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)>4)moved=true;if(moved){model().x=start.tx+dx;model().y=start.ty+dy;apply();}}if(moved){svg.classList.add('dragging');if(isWorld){worldMoved=true;$('mapTooltip').hidden=true;$('mapIntro').classList.add('is-hidden');}else sceneDragging=true;}});
  const end=e=>{points.delete(e.pointerId);if(points.size===0){start=null;lastDist=null;svg.classList.remove('dragging');setTimeout(()=>{if(isWorld)worldMoved=false;else sceneDragging=false;},0);}else{const p=[...points.values()][0];start={x:p.x,y:p.y,tx:model().x,ty:model().y};lastDist=null;}};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect();(isWorld?zoomWorld:zoomScene)(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
}

function renderAbout(){const stats=atlas.meta.stats;$('coverageStats').innerHTML=[[maps.length,'רשומות מפה'],[stats.cross,'שערים בין מפות'],[stats.internal,'מעברים פנימיים'],[stats.unknown,'ללא יעד קבוע']].map(([v,l])=>`<div class="coverage-stat"><b>${fmt(v)}</b><span>${l}</span></div>`).join('');$('sourcesList').innerHTML=(atlas.sources||[]).map(s=>`<div class="source-item"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><p>${esc(s.description||'')}</p></div>`).join('');}
function renderHuntAbout(){
  const data=window.HuntData;if(!data)return;
  let section=$('huntingCoverage');
  if(!section){section=document.createElement('section');section.id='huntingCoverage';$('sourcesList').insertAdjacentElement('beforebegin',section);}
  const stats=data.meta.stats,dropMeta=data.dropData?.meta||{};
  section.innerHTML=`<h3>חיפוש פריטים, מפלצות ודמויות</h3><p>הקטלוג כולל ${fmt(stats.items)} פריטים, ${fmt(stats.monsters)} רשומות מפלצת ו־${fmt(stats.npcs)} רשומות דמות. ${fmt(stats.spawnPoints)} נקודות הופעה מסומנות ב־${fmt(stats.mapsWithSpawns)} מפות. ${fmt(stats.npcPlacements)} מיקומי דמויות נרשמו ב־${fmt(stats.mapsWithNpcs)} מפות.</p><p>שמות כפולים נשמרים בנפרד לפי מזהה. לדמות או לבוס ללא מיקום מתועד לא ניתנה כתובת משוערת. המלצת הציד מבוססת על נקודות הופעה, ולא על תדירות הופעה, סיכוי נפילה או פריטים בשעה.</p>${window.Hunt?.dropStatus==='unavailable'?'<p class="route-warning">תיעוד הנפילות לא נטען בביקור הזה. אפשר לנסות שוב בחלונית החיפוש והציד; אין להסיק מכך שלפריטים אין נפילות מתועדות.</p>':`<p>תיעוד הפריטים מכסה כרגע ${fmt(dropMeta.acceptedRelationships||0)} קשרים בין ${fmt(dropMeta.coveredItemIds||0)} פריטים לבין ${fmt(dropMeta.coveredMonsterIds||0)} מזהי מפלצת. נכללו רק דיווחים שסומנו בקלאסיק, ללא שיעורי הנפילה של גרסאות אחרות. זהו מאגר קהילתי חלקי; אין תאריך או גרסת תצפית לכל שורה, ולא כל דיווח נבדק מחדש בעדכון הנוכחי.</p>`}<p><a class="source-link" href="https://ms-classic.com/drops" target="_blank" rel="noopener noreferrer">טבלת תצפיות הנפילה</a><a class="source-link" href="https://maplelandhub.com/classic/en/monster/700000" target="_blank" rel="noopener noreferrer">תצפיות נוספות של בוס הפטרייה</a></p><p class="copyright" dir="ltr" lang="en">${esc(dropMeta.attribution||'')} ${esc(dropMeta.license||'')} <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">License</a></p><div class="coverage-downloads"><a href="hunt-data.json" download="classic-hunt-data.json" class="button quiet">הורדת קטלוג ומיקומים</a><a href="drop-data.json" download="classic-drop-observations.json" class="button quiet">הורדת תצפיות הנפילה</a></div><h3>מקורות המפות והמעברים</h3>`;
}
function bindEvents(){
  $('search').addEventListener('input',renderSearch);$('search').addEventListener('focus',()=>{if($('search').value.trim())renderSearch();});$('search').addEventListener('keydown',handleSearchKey);
  $('searchResults').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)chooseSearch(b.dataset.id,b.dataset.kind);});document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))closeSearch();});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('sceneDialog').open&&!$('aboutDialog').open){e.preventDefault();$('search').focus();}});
  document.querySelectorAll('[data-region]').forEach(b=>b.addEventListener('click',()=>{currentRegion=b.dataset.region;document.querySelectorAll('[data-region]').forEach(btn=>btn.classList.toggle('active',btn===b));updateVisibleNodes();fitWorld();$('directory').hidden=true;}));
  $('zoomIn').addEventListener('click',()=>zoomWorld(1.35));$('zoomOut').addEventListener('click',()=>zoomWorld(1/1.35));$('fitMap').addEventListener('click',fitWorld);$('labelsToggle').addEventListener('click',()=>{showAllLabels=!showAllLabels;$('labelsToggle').setAttribute('aria-pressed',String(showAllLabels));applyWorld();});
  $('directoryToggle').addEventListener('click',openDirectory);$('closeDirectory').addEventListener('click',()=>$('directory').hidden=true);$('directorySearch').addEventListener('input',renderDirectory);$('directoryGroup').addEventListener('change',renderDirectory);$('directoryGrid').addEventListener('click',e=>{const card=e.target.closest('[data-id]');if(card){$('directory').hidden=true;selectMap(card.dataset.id,{focus:true});}});
  $('routeToggle').addEventListener('click',()=>{if($('routePanel').hidden)openRoute();else{$('routePanel').hidden=true;$('routeToggle').setAttribute('aria-pressed','false');}});$('closeRoute').addEventListener('click',()=>{$('routePanel').hidden=true;$('routeToggle').setAttribute('aria-pressed','false');});$('routeForm').addEventListener('submit',submitRoute);
  $('routeResult').addEventListener('click',e=>{const gate=e.target.closest('[data-route-scene]');if(gate){openScene(Number(gate.dataset.routeScene),gate.dataset.routeGate);return;}const map=e.target.closest('[data-route-map]');if(map)selectMap(map.dataset.routeMap,{focus:true,scroll:false});if(e.target.id==='clearRoute'){route=null;drawRoute();$('routeResult').innerHTML='';}});
  $('mapDetails').addEventListener('click',e=>{const tab=e.target.closest('[data-tab]');if(tab){detailsTab=tab.dataset.tab;renderPortalContent();return;}const b=e.target.closest('[data-action]');if(!b)return;const m=byId.get(activeId),p=m.portals.find(p=>p.key===b.dataset.gate);switch(b.dataset.action){case'open-scene':openScene(m.id);break;case'map-monsters':openSpawns(m.id);break;case'map-npcs':openNpcs(m.id);break;case'route-from':openRoute();$('routeFrom').value=mapLabel(m);$('routeTo').focus();break;case'route-to':{const old=routeMap($('routeFrom').value);openRoute();if(!old||old.id===m.id)$('routeFrom').value=mapLabel(byId.get(10001000)||maps[0]);$('routeTo').value=mapLabel(m);$('routeFrom').focus();break;}case'portal-go':if(p?.kind==='cross')selectMap(p.to,{focus:true});else if(p)openScene(m.id,p.key);break;case'locate':if(p)openScene(m.id,p.key);break;case'incoming':selectMap(b.dataset.from,{focus:true});break;case'incoming-scene':openScene(Number(b.dataset.from),b.dataset.gate);break;case'service-target':if(b.dataset.target)selectMap(b.dataset.target,{focus:true});else toast('למעבר הזה אין יעד קבוע. הפרטים מופיעים בתנאי השירות.');break;}});
  $('closeScene').addEventListener('click',()=>$('sceneDialog').close());$('sceneFit').addEventListener('click',fitScene);$('sceneZoomIn').addEventListener('click',()=>zoomScene(1.4));$('sceneZoomOut').addEventListener('click',()=>zoomScene(1/1.4));document.querySelectorAll('#sceneFilters button').forEach(b=>b.addEventListener('click',()=>{sceneKind=b.dataset.kind;selectedGate=null;renderScenePins();renderSceneSidebar();}));
  $('scenePortalList').addEventListener('click',e=>{const entity=e.target.closest('[data-entity-key]');if(entity){pickEntity(entity.dataset.entityKey,true);return;}const b=e.target.closest('[data-gate]');if(b)pickGate(b.dataset.gate,true);});$('sceneSelected').addEventListener('click',e=>{const b=e.target.closest('[data-scene-travel]');if(b){selectMap(b.dataset.sceneTravel);openScene(b.dataset.sceneTravel);}});
  $('sceneLayers').addEventListener('click',e=>{const b=e.target.closest('[data-layer]');if(b)setSceneLayer(b.dataset.layer,[]);});
  $('sceneImageRetry').addEventListener('click',()=>loadSceneImage(true));
  $('sceneEntitySummary').addEventListener('click',e=>{if(e.target.id==='sceneShowAll')setSceneLayer(sceneLayer,[]);if(e.target.id==='sceneRetryCatalog'){$('sceneDialog').close();window.Hunt?.open('monster');}});
  window.addEventListener('hunt-unavailable',()=>{if($('sceneDialog').open&&sceneLayer==='monsters')setSceneLayer(sceneLayer,sceneEntityIds);});
  window.addEventListener('hunt-ready',()=>{renderDetails();if($('search').value)renderSearch();renderHuntAbout();if($('sceneDialog').open&&sceneLayer!=='portals')setSceneLayer(sceneLayer,sceneEntityIds);});
  const about=()=>{renderHuntAbout();$('aboutDialog').showModal();};$('aboutButton').addEventListener('click',about);$('coverageButton').addEventListener('click',about);$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());$('aboutDialog').addEventListener('click',e=>{if(e.target===$('aboutDialog')){const r=$('aboutDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('aboutDialog').close();}});
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();currentRegion='world';document.querySelectorAll('[data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region==='world'));updateVisibleNodes();fitWorld();});
  enablePanZoom($('worldSvg'),'world');enablePanZoom($('sceneSvg'),'scene');let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{fitWorld();if($('sceneDialog').open)fitScene();},180);});window.addEventListener('hashchange',()=>{const id=location.hash.match(/map=(\d+)/);if(id)selectMap(Number(id[1]),{focus:true,hash:false});});
}
async function init(){
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[el.dataset.icon]||ICONS.pin}</svg>`);
  try{const response=await fetch('atlas-data.json');if(!response.ok)throw Error(`data ${response.status}`);atlas=await response.json();maps=atlas.maps;groups=atlas.groups;byId=new Map(maps.map(m=>[m.id,m]));incoming=new Map();adjacency=new Map();for(const m of maps){const out=[];for(const p of m.portals){if(p.kind==='cross'&&byId.has(p.to)){out.push({to:p.to,p});if(!incoming.has(p.to))incoming.set(p.to,[]);incoming.get(p.to).push({from:m,p});}}adjacency.set(m.id,out);}
    $('mapCount').textContent=maps.length;$('mapOptions').innerHTML=maps.map(m=>`<option value="${esc(mapLabel(m))}"></option>`).join('');$('directoryGroup').innerHTML='<option value="all">כל האזורים</option>'+groups.map(g=>`<option value="${esc(g.id)}">${esc(g.he)}</option>`).join('');
    buildWorld();renderAbout();bindEvents();const hash=location.hash.match(/map=(\d+)/);selectMap(hash&&byId.has(Number(hash[1]))?Number(hash[1]):10001000,{hash:false,scroll:false});$('loading').hidden=true;requestAnimationFrame(()=>{fitWorld();if(hash)centerOnMap(byId.get(activeId));});
    window.Atlas={get data(){return atlas},findRoute,selectMap,openScene,openSpawns,openNpcs,planTo,get activeMap(){return activeId},get currentRoute(){return route},fitWorld};
    window.dispatchEvent(new Event('atlas-ready'));
  }catch(error){$('loading').innerHTML='<div style="padding:30px;text-align:center;line-height:1.9">המפה לא נטענה.<br>נסו לרענן את העמוד.<br><small>אם פתחתם קובץ מקומי, השתמשו בקישור לאטלס.</small></div>';console.error('Atlas loading failed',error);}
}
init();
