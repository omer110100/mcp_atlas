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
const L = (he,en) => typeof window!=='undefined'&&window.AtlasI18n?.language==='en'?en:he;
const D = (value) => typeof window!=='undefined'&&window.AtlasI18n?.data?window.AtlasI18n.data(value):value;
const fmt = (n) => Number(n).toLocaleString(L('he-IL','en-US'));
const scopeLabels = {
  get world(){return L('עולם המשחק','Game world');},
  get conditional(){return L('כניסה מותנית','Conditional entrance');},
  get event(){return L('אירוע · זמינות לא מאומתת','Event · availability unverified');},
  get system(){return L('חדר מערכת','System room');},
  get unavailable(){return L('כניסה לא זמינה / לא מאומתת','Entrance unavailable / unverified');}
};
let atlas, maps, groups, byId, incoming, adjacency, activeId, currentRegion='world', detailsTab='cross', sceneId, sceneKind='cross', selectedGate=null, route=null;
let world = {x:0,y:0,k:1}, scene = {x:0,y:0,k:1}, showAllLabels=false, worldMoved=false;
let nodeElements=new Map(), edgeElements=[], serviceElements=[], portalPinElements=new Map();
let activeSearchResults=[], searchIndex=-1, toastTimer;
let sceneLayer='portals', sceneEntityIds=[], sceneEntityPoints=[], selectedEntity=null;
let routeStopValues=[],pendingRouteGoal=null,pendingGoalDestination=null,routeChoices=null;
const entityPinElements=new Map();
const groupId = (id) => groups.find((g) => g.id === id);
const mapLabel = (m) => `${m.name} [${m.id}]`;
const getServices = (id) => (atlas.services || []).filter((s) => Number(s.from) === Number(id));
const serviceLabel = (s) => D(s.label || s.label_he) || L('מעבר מותנה','Conditional passage');
const serviceCondition = (s) => D(s.condition || s.condition_he || '');
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
function scrollBehavior(){return document.documentElement?.dataset?.motion==='off'||(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)?'auto':'smooth';}
function notifyView(){if(typeof window!=='undefined'&&window.Atlas)window.dispatchEvent(new Event('atlas-viewchange'));}
function describeMap(id){
  const map=byId.get(Number(id));if(!map)return null;
  const monsterPoints=window.HuntData?.mapSpawns?.[map.id]?.totalPoints||0,npcCount=(map.npcs||[]).length;
  const category=['event','system','unavailable'].includes(map.scope)?'archive':map.scope==='conditional'?'special':map.isTown||map.major?'town':monsterPoints?'hunting':'field';
  const labels={town:L('עיר ומוקד','Town or hub'),hunting:L('מפת ציד','Hunting map'),special:L('כניסה מותנית','Conditional entrance'),archive:L('אירוע או מערכת','Event or system'),field:L('מפת שטח','Field map')};
  return {category,label:labels[category],region:groupLabel(map),exits:map.portals.filter(portal=>displayKind(portal,map)==='cross').length,monsterPoints,npcCount};
}
function getContext(){
  const brief=id=>{const map=byId.get(id);return map?{id:map.id,name:map.name}:null;},recipe=getJourney();
  return {activeMap:brief(activeId),sceneMap:$('sceneDialog').open?brief(sceneId):null,route:recipe?{...recipe,index:recipe.step,total:route.steps.length}:null,step:recipe?.step??0,sceneOpen:!!$('sceneDialog').open};
}
function imageFallback(el) { if(el.dataset.fallbackUsed)return;el.dataset.fallbackUsed='1';const m=byId.get(Number(el.dataset.map));if(m && el.getAttribute('src') !== m.image)el.src=m.image;else el.style.opacity='.3'; }
function groupName(g) { return g?L(g.he,g.en||D(g.he)):''; }
function groupLabel(m) { return groupName(groupId(m.group)) || D(m.region); }
function directionLabel(p,m) {
  if(!m.width || !m.height)return L('מיקום מסומן בתמונת המפה','Position marked on the map image');
  const x=p.x/m.width,y=p.y/m.height;
  const horizontal=x<.34?L('שמאל','Left'):x>.67?L('ימין','Right'):L('מרכז','Center');
  const vertical=y<.34?L('למעלה','top'):y>.67?L('למטה','bottom'):L('באמצע','middle');
  return `${horizontal} · ${vertical}`;
}
function portalTypeLabel(p,m) {
  const supplement=supplementForGate(p,m);
  if(p.kind==='unknown' && supplement)return supplement.walkable?L('שער נסתר · תועד במדריך','Hidden portal · guide documented'):L('מעבר מותנה · תועד במדריך','Conditional passage · guide documented');
  if(p.kind==='unknown')return L('ללא יעד קבוע','No fixed destination');
  if(p.kind==='internal')return p.noEffect?L('קיצור דרך ללא אפקט','Shortcut without a visual effect'):L('מעבר בתוך המפה','Within-map passage');
  if(p.noEffect)return m.isTown?L('דלת / שער ללא אפקט','Door / portal without a visual effect'):L('שער ללא אפקט','Portal without a visual effect');
  if(p.type===3)return L('מעבר אוטומטי','Automatic passage');
  return L('שער מעבר','Portal');
}
function portalTarget(p,m) { const supplement=supplementForGate(p,m);if(p.kind==='internal'){const targets=m.portals.filter(q=>q.name===p.toPortal);return targets.length===1?L(`נחיתה בשער ${targets[0].number}`,`Arrive at portal ${targets[0].number}`):targets.length>1?L(`נקודות נחיתה: ${targets.map(q=>q.number).join(', ')}`,`Arrival points: ${targets.map(q=>q.number).join(', ')}`):(p.toPortal || L('נקודת יעד באותה מפה','Destination within this map'));}return p.kind==='cross'?(byId.get(p.to)?.name || `Map ${p.to}`):supplement?(byId.get(supplement.to)?.name || p.name):(p.name || L('נקודה ללא שם','Unnamed point')); }
function portalCard(p,m,sceneMode=false) {
  return `<div class="portal-card ${p.noEffect?'no-effect':''} ${p.kind} ${sceneMode && selectedGate===p.key?'chosen':''}" data-gate="${esc(p.key)}"><span class="portal-number">${p.number}</span><button type="button" class="portal-main" data-action="${sceneMode?'scene-pick':'portal-go'}" data-gate="${esc(p.key)}">${eng(portalTarget(p,m))}<span class="portal-meta">${esc(portalTypeLabel(p,m))} · ${esc(directionLabel(p,m))}</span>${p.kind==='internal'?`<small>${L('אותה מפה, נקודת נחיתה אחרת','Same map, different arrival point')}</small>`:''}</button><button type="button" class="portal-locate" data-action="locate" data-gate="${esc(p.key)}" title="${L('מצא את השער בתמונה','Locate portal on the image')}" aria-label="${L(`מצא את שער ${p.number} בתמונה`,`Locate portal ${p.number} on the image`)}">${icon('pin')}</button></div>`;
}

function renderDetails() {
  const m=byId.get(activeId);if(!m)return;
  const counts={cross:m.portals.filter(p=>displayKind(p,m)==='cross').length,internal:m.portals.filter(p=>p.kind==='internal').length,unknown:m.portals.filter(p=>displayKind(p,m)==='unknown').length,incoming:(incoming.get(m.id)||[]).length+(atlas.services||[]).filter(s=>s.to===m.id).length};
  const tags=[];if(m.major)tags.push(`<span class="tag">${L('עיר / מוקד מרכזי','Town / major hub')}</span>`);else if(m.hiddenArea)tags.push(`<span class="tag">${L('אזור נסתר','Hidden area')}</span>`);if(m.isNew)tags.push(`<span class="tag new">${L('תוספת נובמבר','November addition')}</span>`);if(m.scope!=='world')tags.push(`<span class="tag warning">${scopeLabels[m.scope]||L('כניסה מיוחדת','Special entrance')}</span>`);
  $('mapDetails').innerHTML=`<div class="map-detail-head"><div class="map-breadcrumb">${esc(groupLabel(m))}</div><h2 dir="ltr">${esc(m.name)}</h2><bdi dir="ltr" class="map-street">${esc(m.street)}</bdi><button type="button" class="button quiet favorite-toggle" data-action="favorite" aria-pressed="${window.AtlasPersonal?.isFavorite(m.id)||false}">${window.AtlasPersonal?.isFavorite(m.id)?L('★ במועדפים','★ Saved'):L('☆ הוספה למועדפים','☆ Save favorite')}</button>${tags.length?`<div class="tag-row">${tags.join('')}</div>`:''}</div><button type="button" class="map-preview" data-action="open-scene"><img src="${esc(m.image)}" alt="${L('תמונת המפה','Map image:')} ${esc(m.name)}" data-map="${m.id}"><span class="preview-label"><span>${L('פתח את המפה ואת כל שעריה','Open map and all its portals')}</span>${icon('expand')}</span></button><div class="detail-actions"><button type="button" class="button quiet" data-action="route-from">${L('יציאה מכאן','Start here')}</button><button type="button" class="button primary" data-action="route-to">${L('נווט לכאן','Navigate here')}</button></div><nav class="portal-tabs" aria-label="${L('סוגי חיבורים','Connection types')}">${[['cross',L('יציאות','Exits')],['internal',L('קיצורים','Shortcuts')],['incoming',L('נכנסים','Incoming')],['unknown',L('לא פתורים','Unresolved')]].map(([k,v])=>`<button type="button" data-tab="${k}" class="${detailsTab===k?'active':''}">${v}<span class="count">${counts[k]}</span></button>`).join('')}</nav><div class="portal-content" id="portalContent"></div><div class="map-notes">${(m.notes||[]).map(n=>`<p>${esc(D(n))}</p>`).join('')}</div><div class="map-id"><span>${L('מזהה מפה:','Map ID:')} <bdi>${m.id}</bdi></span><span>${m.portals.length} ${L('רשומות שער','portal records')}</span></div>`;
  $('mapDetails').querySelector('img').addEventListener('error',e=>imageFallback(e.target));
  renderPortalContent();
  const spawnCount=window.HuntData?.mapSpawns?.[m.id]?.totalPoints||0;
  const npcCount=(m.npcs||[]).length;
  if(spawnCount||npcCount)$('mapDetails').querySelector('.portal-tabs').insertAdjacentHTML('beforebegin',`<div class="entity-shortcuts">${spawnCount?`<button type="button" data-action="map-monsters">${fmt(spawnCount)} ${L('נקודות הופעה','spawn points')}</button>`:''}${npcCount?`<button type="button" data-action="map-npcs">${npcCount===1?L('מיקום דמות אחד','1 NPC location'):fmt(npcCount)+' '+L('מיקומי דמויות','NPC locations')}</button>`:''}</div>`);
  notifyView();
}
function renderPortalContent() {
  const m=byId.get(activeId);if(!m || !$('portalContent'))return;
  let html='';
  if(detailsTab==='incoming'){
    const ins=incoming.get(m.id)||[];
    html=ins.length?ins.map(({from,p})=>`<div class="portal-card ${p.noEffect?'no-effect':''}"><span class="portal-number">${p.number}</span><button class="portal-main" type="button" data-action="incoming" data-from="${from.id}">${eng(from.name)}<span class="portal-meta">${L(`שער ${p.number} במפת המקור`,`Portal ${p.number} on the source map`)} · ${portalTypeLabel(p,from)}</span></button><button type="button" class="portal-locate" data-action="incoming-scene" data-from="${from.id}" data-gate="${esc(p.key)}" aria-label="${L('הצגת שער המקור','Show source portal')}">${icon('pin')}</button></div>`).join(''):`<p class="empty-state">${L('לא נמצאה כניסה דרך שער קבוע ממפה אחרת. ייתכן שהכניסה דרך דמות, אירוע או משימה.','No fixed incoming portal was found. Entry may require an NPC, event or quest.')}</p>`;
    const services=(atlas.services||[]).filter(s=>s.to===m.id);if(services.length)html+=serviceSection(services,true);
  }else{
    const ps=m.portals.filter(p=>displayKind(p,m)===detailsTab);
    if(detailsTab==='unknown')html+=`<p class="section-note">${L('אלה רשומות ללא מפת יעד קבועה בנתוני הלקוח. חלקן נקודות נחיתה, עוגנים או מעברים שהמשחק מפעיל באמצעות תסריט. הן אינן מוצגות כיציאות מאומתות.','These records have no fixed destination in the client data. Some are arrival points, anchors or scripted passages. They are not listed as verified exits.')}</p>`;
    if(detailsTab==='internal')html+=`<p class="section-note">${L('קיצורי דרך בין שתי נקודות בתוך המפה הזאת. לחיצה מציגה את מיקום השער ואת נקודת הנחיתה, כשזו רשומה במקור.','Shortcuts between points within this map. Select a portal to see its position and arrival point when recorded in the source.')}</p>`;
    html+=ps.length?ps.map(p=>portalCard(p,m)).join(''):`<p class="empty-state">${detailsTab==='cross'?L('אין במקור שער יציאה בעל יעד קבוע למפה אחרת.','No exit with a fixed destination on another map is recorded.'):detailsTab==='internal'?L('לא נרשמו מעברים פנימיים במפה הזאת.','No internal passages are recorded on this map.'):L('לכל רשומות השער במפה הזאת יש יעד קבוע.','All portal records on this map have a fixed destination.')}</p>`;
    if(detailsTab==='cross' || detailsTab==='unknown') {const services=getServices(m.id);if(services.length)html+=serviceSection(services);}
  }
  $('portalContent').innerHTML=html;
  document.querySelectorAll('.portal-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===detailsTab));
}
function serviceSection(services,isIncoming=false) {
  return `<section class="service-section"><h3>${isIncoming?L('כניסות ממקורות משלימים','Entrances from supplementary sources'):L('מעברים ממקורות משלימים','Passages from supplementary sources')}</h3>${services.map(s=>{const target=byId.get(isIncoming?s.from:s.to);const urls=serviceUrls(s);return `<div class="service-card"><button type="button" data-action="service-target" data-target="${target?.id||''}"><span>${esc(serviceLabel(s))}</span>${target?eng(target.name):`<span class="scope-description">${L('היעד תלוי במצב המשחק','Destination depends on game state')}</span>`}</button>${s.npc?eng(s.npc):''}<p>${esc(serviceCondition(s))}</p>${urls[0]?`<a class="source-link" href="${esc(urls[0])}" target="_blank" rel="noopener noreferrer">${L('מקור והסבר','Source and details')}</a>`:''}</div>`;}).join('')}</section>`;
}
function selectMap(id,{focus=false,hash=true,scroll=true,reveal=true,remember=true}={}) {
  id=Number(id);if(!byId.has(id))return;
  if($('sceneDialog').open)$('sceneDialog').close();
  const target=byId.get(id);
  if(!visibleMap(target)){
    currentRegion=['event','system','unavailable'].includes(target.scope)?'archive':'world';
    document.querySelectorAll('.region-nav [data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region===currentRegion));
    updateVisibleNodes();
  }
  activeId=id;detailsTab='cross';renderDetails();highlightGraph();
  window.AtlasPersonal?.visit(id);
  if(remember)window.AtlasExplorer?.rememberMap(id);
  if(reveal)window.AtlasShell?.showDrawer('details');
  if(hash)history.replaceState(null,'',window.AtlasPersonal?.mapHash(id)||`#map=${id}`);
  if(focus)centerOnMap(byId.get(id));
  if(scroll)$('sidePanel').scrollTo({top:0,behavior:scrollBehavior()});
}
function highlightGraph() {
  const m=byId.get(activeId);if(!m)return;
  const neighbors=new Set(m.portals.filter(p=>p.kind==='cross').map(p=>p.to));
  (incoming.get(m.id)||[]).forEach(i=>neighbors.add(i.from.id));
  for(const s of serviceElements){if(s.a===m.id)neighbors.add(s.b);if(s.b===m.id)neighbors.add(s.a);}
  for(const [id,g] of nodeElements){g.classList.toggle('selected',id===m.id);g.classList.toggle('neighbor',neighbors.has(id));}
  for(const {element,a,b} of [...edgeElements,...serviceElements])element.classList.toggle('highlighted',a===m.id || b===m.id);
  updateGraphDetail();
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
    const g=svgEl('g',{class:`world-node ${m.major?'major':''}`,transform:`translate(${m.x},${m.y})`,tabindex:'0',role:'button','aria-label':worldNodeLabel(m),'data-map':m.id});
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
  updateGraphDetail();
}
function updateGraphDetail(){
  const journeyMaps=new Set(route?[route.from,...route.steps.map(step=>step.to)]:[]);
  const unclutterOverview=currentRegion==='world'&&world.k<.3&&!showAllLabels;
  const labels=[];
  for(const [id,node]of nodeElements){
    const map=byId.get(id),hidden=currentRegion==='world'&&world.k<.3&&!showAllLabels&&!map.major&&id!==activeId&&!journeyMaps.has(id);
    node.style.display=hidden?'none':'';
    const label=node.querySelector('text');if(!label)continue;
    label.style.visibility='';
    if(unclutterOverview&&visibleMap(map)&&(map.major||id===activeId))labels.push({map,label,priority:id===activeId?2:journeyMaps.has(id)?1:0});
  }
  if(!unclutterOverview)return;
  // Read every text box before changing visibility to avoid repeated layout work.
  // Selection wins, followed by route towns and then stable numeric map order.
  const measured=labels.sort((a,b)=>b.priority-a.priority||a.map.id-b.map.id).map(entry=>({...entry,box:worldLabelBox(entry.map,entry.label)}));
  const occupied=[];
  for(const {label,box}of measured){
    const overlaps=occupied.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top);
    label.style.visibility=overlaps?'hidden':'';
    if(!overlaps)occupied.push(box);
  }
}
function worldLabelBox(map,label){
  const fontSize=map.major?14:12,padding=5,anchorX=world.x+map.x*world.k,anchorY=world.y+(map.y+(map.major?66:-19))*world.k;
  const fallbackWidth=(label.textContent||map.name).length*fontSize*.8;
  let box={left:anchorX-fallbackWidth/2,top:anchorY-fontSize,right:anchorX+fallbackWidth/2,bottom:anchorY+fontSize*.3};
  try{
    const bounds=label.getBBox?.();
    if(bounds&&[bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)&&bounds.width>0&&bounds.height>0)box={left:anchorX+bounds.x*world.k,top:world.y+(map.y+bounds.y)*world.k,right:anchorX+(bounds.x+bounds.width)*world.k,bottom:world.y+(map.y+bounds.y+bounds.height)*world.k};
  }catch{/* Detached or unavailable SVG metrics use the conservative text estimate. */}
  return {left:box.left-padding,top:box.top-padding,right:box.right+padding,bottom:box.bottom+padding};
}
function fitWorld(){
  const ms=maps.filter(visibleMap);if(!ms.length)return;const r=canvasView('mapCanvas');const padX=r.width<600?32:70,padY=32;
  const minX=Math.min(...ms.map(m=>m.x))-70,maxX=Math.max(...ms.map(m=>m.x))+70,minY=Math.min(...ms.map(m=>m.y))-70,maxY=Math.max(...ms.map(m=>m.y))+80;
  const k=Math.min((r.width-padX)/(maxX-minX),(r.height-padY)/(maxY-minY));world.k=Math.max(.03,Math.min(1.9,k));world.x=r.left+(r.width-(minX+maxX)*world.k)/2;world.y=r.top+(r.height-(minY+maxY)*world.k)/2;applyWorld();
  $('mapIntro').classList.toggle('is-hidden',currentRegion!=='world'||r.width<850||r.height<650);
}
function canvasView(id){const r=$(id).getBoundingClientRect();return window.AtlasShell?.mapViewport(id)||{left:0,top:0,width:r.width,height:r.height};}
function centerOnMap(m){const r=canvasView('mapCanvas');world.k=Math.max(world.k,1.25);world.x=r.left+r.width/2-m.x*world.k;world.y=r.top+r.height/2-m.y*world.k;applyWorld();$('mapIntro').classList.add('is-hidden');}
function zoomWorld(factor,cx,cy){const r=$('mapCanvas').getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;const k=Math.max(.06,Math.min(4,world.k*factor)),ratio=k/world.k;world.x=cx-(cx-world.x)*ratio;world.y=cy-(cy-world.y)*ratio;world.k=k;applyWorld();$('mapIntro').classList.add('is-hidden');}
function worldNodeLabel(m){return `${m.name}. ${groupLabel(m)}. ${m.portals.filter(p=>p.kind==='cross').length} ${L('יציאות','exits')}`;}
function showMapTooltip(e,m){if(worldMoved||e.pointerType==='touch')return;const box=$('mapCanvas').getBoundingClientRect();const x=e.clientX-box.left,y=e.clientY-box.top;const tip=$('mapTooltip');tip.innerHTML=`${eng(m.name)}<small>${esc(groupLabel(m))} · ${m.portals.filter(p=>p.kind==='cross').length} ${L('שערי יציאה','exit portals')}</small>`;tip.hidden=false;tip.style.left=`${Math.min(box.width-290,Math.max(12,x+18))}px`;tip.style.top=`${Math.min(box.height-90,y+18)}px`;}

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
  const kindLabels={map:L('מפה','Map'),item:L('פריט','Item'),monster:L('מפלצת','Monster'),boss:L('בוס','Boss'),npc:L('דמות','NPC')};
  $('searchResults').innerHTML=activeSearchResults.length?activeSearchResults.map((m,i)=>`<button type="button" id="search-option-${i}" class="search-result search-result-mixed" role="option" aria-selected="false" tabindex="-1" data-id="${m.id}" data-kind="${esc(m.kind)}">${m.icon?`<img class="search-entity-icon" src="${esc(m.icon)}" alt="">`:`<span class="search-entity-icon search-map-icon">${icon('pin')}</span>`}<span class="search-result-copy">${eng(m.name)}<small>${kindLabels[m.kind]||L('תוצאה','Result')} · ${m.kind==='map'?esc(groupLabel(m))+' · ':''}${m.id}${m.kind==='map'&&m.scope!=='world'?' · '+scopeLabels[m.scope]:''}</small></span></button>`).join(''):`<div class="search-empty">${L('לא נמצאה תוצאה. אפשר לחפש גם חלק משם באנגלית או מזהה.','No results found. Try part of an English name, a Hebrew alias or an ID.')}</div>`;
  $('searchResults').hidden=false;$('search').setAttribute('aria-expanded','true');
}
const aliases={'הנסיס':'henesys','אליניה':'ellinia','פריון':'perion','קרנינג':'kerning','סליפיווד':'sleepywood','לית':'lith','פלורינה':'florina','אמהרסט':'amherst'};
function findMaps(q){if(typeof window!=='undefined'&&window.MapSearch)return window.MapSearch.search(q,maps.length);q=q.trim().toLowerCase();const alias=Object.entries(aliases).find(([he])=>q===he);if(alias)q=alias[1];return maps.filter(m=>`${m.name} ${m.id} ${m.street} ${groupLabel(m)}`.toLowerCase().includes(q)).sort((a,b)=>Number(b.name.toLowerCase().startsWith(q))-Number(a.name.toLowerCase().startsWith(q))||Number(b.major)-Number(a.major)||a.name.localeCompare(b.name));}
function chooseSearch(id,kind='map'){closeSearch();activeSearchResults=[];$('search').value='';$('directory').hidden=true;if(kind!=='map'){window.Hunt?.open(kind,Number(id));return;}window.Hunt?.close();selectMap(id,{focus:true});}
function openDirectory(){const opening=$('directory').hidden;$('directory').hidden=!opening;if(opening){window.Hunt?.close();window.AtlasShell?.showCatalog($('directory'));renderDirectory();$('directorySearch').focus();}else window.AtlasShell?.catalogClosed();}
function renderDirectoryGroups(){const selected=$('directoryGroup').value;$('directoryGroup').innerHTML=`<option value="all">${L('כל האזורים','All regions')}</option>`+groups.map(g=>`<option value="${esc(g.id)}">${esc(groupName(g))}</option>`).join('');$('directoryGroup').value=selected||'all';}
function renderDirectory(){const q=$('directorySearch').value.trim().toLowerCase(),group=$('directoryGroup').value;const list=(q?findMaps(q):[...maps].sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id)).filter(m=>group==='all'||m.group===group);$('directoryCounter').textContent=L(`${fmt(list.length)} מתוך ${fmt(maps.length)} רשומות · כל מפה נשמרת לפי מזהה ייחודי`,`${fmt(list.length)} of ${fmt(maps.length)} records · Each map has a unique ID`);
  $('directoryGrid').innerHTML=list.map(m=>`<button type="button" class="directory-card" data-id="${m.id}" data-region="${['event','system','unavailable'].includes(m.scope)?'archive':['maple','hollow'].includes(m.group)?m.group:['market','special'].includes(m.group)?'special':'victoria'}"><img loading="lazy" decoding="async" src="${esc(m.minimap||m.image)}" alt="" data-map="${m.id}"><span class="card-info">${eng(m.name)}<small>${esc(groupLabel(m))} · ${m.id}</small>${m.scope!=='world'?`<small>${esc(scopeLabels[m.scope])}</small>`:''}</span></button>`).join('')||`<p class="no-results">${L('אין מפות שמתאימות לסינון הזה.','No maps match these filters.')}</p>`;
  $('directoryGrid').querySelectorAll('img').forEach(img=>img.addEventListener('error',e=>imageFallback(e.target)));
}

function defaultRouteOrigin(){return byId.get(window.AtlasExplorer?.getCurrentMap?.())||byId.get(window.AtlasPersonal?.getOrigin?.())||byId.get(activeId);}
function openRoute(){ $('routePanel').hidden=false;window.AtlasShell?.showDrawer('route');$('routeToggle').setAttribute('aria-pressed','true');$('sidePanel').scrollTo({top:0,behavior:scrollBehavior()});const origin=defaultRouteOrigin();if(origin&&(!$('routeFrom').value||$('routeFrom').value===$('routeFrom').dataset.autoOrigin)){$('routeFrom').value=mapLabel(origin);$('routeFrom').dataset.autoOrigin=$('routeFrom').value;} }
function planTo(mapId,fromId,options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))return false;
  const target=byId.get(Number(mapId)),origin=fromId==null?defaultRouteOrigin():byId.get(Number(fromId));
  if(!target||!origin)return false;
  window.Hunt?.close();if($('sceneDialog').open)$('sceneDialog').close();$('directory').hidden=true;
  selectMap(target.id,{scroll:false,remember:false});openRoute();
  const stops=options.stops??[];
  // Conditional entrances stay visible in each route step; only use them when needed.
  const services=options.services??(!findRoute(origin.id,target.id,false,stops)&&!!findRoute(origin.id,target.id,true,stops));
  return planJourney({from:origin.id,to:target.id,stops,services,step:0,...(options.goal?{goal:options.goal}:{})});
}
function readRouteStops(){return routeStopValues.map((value,index)=>$('routeStop'+index)?.value??value);}
function renderRouteStops(){
  const host=$('routeStops');if(!host)return;
  host.innerHTML=routeStopValues.map((value,index)=>`<div class="route-stop-row"><label for="routeStop${index}">${L('עצירה','Stop')} ${index+1}</label><input id="routeStop${index}" data-route-stop="${index}" data-map-lookup type="text" autocomplete="off" dir="auto" aria-describedby="routeStop${index}Error" value="${esc(value)}"><div class="route-stop-actions"><button type="button" data-stop-move="${index}" data-stop-direction="-1" aria-label="${L('הקדמת העצירה','Move stop earlier')} ${index+1}" ${index===0?'disabled':''}>↑</button><button type="button" data-stop-move="${index}" data-stop-direction="1" aria-label="${L('דחיית העצירה','Move stop later')} ${index+1}" ${index===routeStopValues.length-1?'disabled':''}>↓</button><button type="button" data-stop-remove="${index}" aria-label="${L('הסרת עצירה','Remove stop')} ${index+1}">×</button></div><small id="routeStop${index}Error" class="field-error" role="status"></small></div>`).join('');
  routeStopValues.forEach((value,index)=>{const input=$('routeStop'+index);if(input){input.value=value;window.MapSearch?.attach(input);}});
  if($('routeAddStop')){$('routeAddStop').disabled=routeStopValues.length>=AtlasJourney.MAX_STOPS;$('routeAddStop').textContent=L('＋ הוספת עצירה','＋ Add stop');}
  if($('routeSwap')){$('routeSwap').textContent=L('⇄ החלפת מוצא ויעד','⇄ Swap start and destination');$('routeSwap').setAttribute('aria-label',L('החלפת המוצא והיעד והיפוך סדר העצירות','Swap start and destination and reverse stop order'));}
}
function addStop(mapId){
  if(routeStopValues.length>=AtlasJourney.MAX_STOPS){toast(L('אפשר לתכנן עד 8 עצירות ביניים.','You can plan up to 8 intermediate stops.'));return false;}
  if(mapId!=null&&(!Number.isSafeInteger(mapId)||!byId.has(mapId)))return false;
  routeStopValues=readRouteStops();routeStopValues.push(mapId==null?'':mapLabel(byId.get(mapId)));openRoute();renderRouteStops();$('routeStop'+(routeStopValues.length-1))?.focus();return true;
}
function swapRouteEnds(){
  const from=$('routeFrom').value;$('routeFrom').value=$('routeTo').value;$('routeTo').value=from;
  routeStopValues=readRouteStops().reverse();pendingRouteGoal=null;pendingGoalDestination=null;renderRouteStops();renderRouteGoal();
  for(const id of ['routeFrom','routeTo']){$(id).removeAttribute('aria-invalid');$(id+'Error').textContent='';}
  toast(L('המוצא, היעד וסדר העצירות הוחלפו. לחצו על מציאת מסלול כדי לחשב מחדש.','Start, destination and stop order swapped. Find a route to recalculate.'));
}
let routeExclusions={};
function getJourney(){return route?{from:route.from,to:route.to,stops:[...(route.stops||[])],...routeExclusions,services:routeUsesServices,step:navigationActive()?navigationIndex:0,...(route.goal?{goal:AtlasJourney.normalizeGoal(route.goal)}:{})}:null;}
function planJourney(value,{persist=true,show=false,restoreStep=true}={}){
  const recipe=AtlasJourney.normalizeRecipe(value,byId);if(!recipe)return false;
  if(!show&&$('sceneDialog').open)$('sceneDialog').close();
  routeExclusions={...(recipe.avoidMaps?.length?{avoidMaps:[...recipe.avoidMaps]}:{}),...(recipe.avoidEdges?.length?{avoidEdges:[...recipe.avoidEdges]}:{})};
  openRoute();$('routeFrom').value=mapLabel(byId.get(recipe.from));$('routeTo').value=mapLabel(byId.get(recipe.to));$('useServices').checked=recipe.services;
  routeStopValues=recipe.stops.map(id=>mapLabel(byId.get(id)));pendingRouteGoal=recipe.goal||null;pendingGoalDestination=recipe.goal?recipe.to:null;renderRouteStops();
  submitRoute(null,{persist:false});if(!route)return false;
  const step=restoreStep&&recipe.step<=route.steps.length?recipe.step:0;
  if(show){openRouteStep(step);return true;}
  if(restoreStep&&step){navigationRoute=route;navigationIndex=step;navigationFollowing=false;updateRouteProgress();renderSceneNavigation();}
  if(persist)window.AtlasPersonal?.saveJourney();notifyView();return true;
}
function renderRouteGoal(){
  const host=$('routeGoal');if(!host)return;host.hidden=!pendingRouteGoal;
  host.innerHTML=pendingRouteGoal?`<div class="route-goal-copy"><strong>${L('מטרת המסע','Journey goal')}</strong><p>${esc(window.Hunt?.describeGoal?.(pendingRouteGoal)||L('מסע ציד לפי המטרות שנבחרו','Hunting journey for your selected targets'))}</p></div><button type="button" class="button quiet" id="routeClearGoal">${L('הסרת המטרה','Remove goal')}</button>`:'';
}
function renderRouteAlternatives(){
  const host=$('routeAlternatives');if(!host)return;host.hidden=!routeChoices;if(!routeChoices){host.innerHTML='';return;}
  const same=routeChoices.ordinary&&routeChoices.conditional&&AtlasJourney.pathSignature(routeChoices.ordinary)===AtlasJourney.pathSignature(routeChoices.conditional);
  host.innerHTML=`<h3>${L('השוואת אפשרויות מסלול','Compare route options')}</h3><div class="route-alternative-grid">${[['ordinary',false,L('הליכה רציפה','Continuous walking')],['conditional',true,L('כולל קיצורי דרך','Allow shortcuts')]].map(([key,services,label])=>{const candidate=routeChoices[key],count=candidate?.steps.filter(step=>step.service&&!step.service.walkable).length||0;return `<button type="button" class="route-alternative" data-route-policy="${key}" aria-pressed="${routeUsesServices===services}" ${candidate?'':'disabled'}><strong>${label}</strong><span>${candidate?L(`${candidate.steps.length} מעברים · ~${Math.max(1,Math.ceil(candidate.estimatedMinutes||0))} דק׳ · ${count} מותנים`,`${candidate.steps.length} passages · ~${Math.max(1,Math.ceil(candidate.estimatedMinutes||0))} min · ${count} conditional`):L('לא נמצא מסלול מלא','No complete route')}</span></button>`;}).join('')}</div>${!same&&routeChoices.ordinary&&routeChoices.conditional?`<p class="route-help">${routeChoices.conditional.cost<routeChoices.ordinary.cost*.9?L('קיצורי הדרך חוסכים יותר מ־10% מהעלות המשוערת.','Shortcuts save over 10% of estimated route cost.'):L('לא נמצא חיסכון משמעותי במסלול המותנה.','Conditional travel does not offer substantial estimated savings.')}</p>`:''}${same?`<p class="route-help">${L('שתי האפשרויות מובילות לאותו מסלול מתועד.','Both options follow the same documented route.')}</p>`:''}`;
}
function routeMap(value){if(typeof window!=='undefined'&&window.MapSearch)return window.MapSearch.resolve(value);const id=value.match(/\[(\d+)\]\s*$/);if(id)return byId.get(Number(id[1]));const normalized=value.trim().toLowerCase();const exact=maps.filter(m=>m.name.toLowerCase()===normalized||String(m.id)===normalized);return exact.length===1?exact[0]:null;}
function journeyGraph(){return {maps:byId,adjacency,services:atlas.services,asOf:atlas.meta.asOf};}
function findRoute(from,to,services=false,stops=[],options={}){return AtlasJourney.findRoute(journeyGraph(),from,to,services,stops,options);}
function reachable(from,hops,services=false,options={}){return AtlasJourney.reachable(journeyGraph(),from,hops,services,options);}
function routeInputError(){return L('בחרו מפה מההצעות. כשיש כמה שמות זהים, המזהה מבדיל ביניהם.','Choose a map from the suggestions. Use the ID to distinguish maps with identical names.');}
function startRouteLabel(){return navigationActive()&&navigationIndex?L(`המשך מהמקום ששמרת · ${navigationIndex===route.steps.length?'מפת היעד':'מעבר '+(navigationIndex+1)}`,`Resume saved progress · ${navigationIndex===route.steps.length?'Destination':'Passage '+(navigationIndex+1)}`):L('פתיחת מדריך המסלול','Open route guide');}
function submitRoute(e,{persist=true}={}){
  if(e)e.preventDefault();const from=routeMap($('routeFrom').value),to=routeMap($('routeTo').value);
  routeStopValues=readRouteStops();const stops=routeStopValues.map(routeMap),fields=[['routeFrom',from],...stops.map((map,index)=>['routeStop'+index,map]),['routeTo',to]];
  for(const [id,map]of fields){$(id).setAttribute('aria-invalid',String(!map));$(id+'Error').textContent=map?'':routeInputError();}
  const invalid=fields.find(([,map])=>!map);if(invalid){$(invalid[0]).focus();return;}
  if($('sceneDialog').open)$('sceneDialog').close();
  if(e)routeExclusions={};
  if(to.id!==pendingGoalDestination){pendingRouteGoal=null;pendingGoalDestination=null;}
  routeUsesServices=$('useServices').checked;
  const recipe={from:from.id,to:to.id,stops:stops.map(map=>map.id),...routeExclusions,services:routeUsesServices,step:0,...(pendingRouteGoal?{goal:pendingRouteGoal}:{})};
  routeChoices={recipe,ordinary:findRoute(from.id,to.id,false,recipe.stops,recipe),conditional:findRoute(from.id,to.id,true,recipe.stops,recipe)};
  for(const candidate of [routeChoices.ordinary,routeChoices.conditional])if(candidate&&pendingRouteGoal)candidate.goal=AtlasJourney.normalizeGoal(pendingRouteGoal);
  route=routeChoices[routeUsesServices?'conditional':'ordinary'];navigationRoute=null;navigationIndex=0;$('routeRestoreNote').textContent='';$('routeShareBox').hidden=true;if(persist)window.AtlasPersonal?.saveJourney();renderSceneNavigation();drawRoute();
  renderRouteResult();renderRouteAlternatives();renderRouteGoal();notifyView();
  if(!route)return;
  window.AtlasRouteTools?.prefetch(route);
  const ids=[route.from,...route.steps.map(s=>s.to)];
  if(ids.length>1)fitRoute(ids);toast(route.steps.length?L(`נמצא מסלול עם ${route.steps.length} מעברים`,`Found a route with ${route.steps.length} ${route.steps.length===1?'passage':'passages'}`):L('זו כבר מפת המוצא','You are already at the destination'));
}
function renderRouteResult(){
  if(!route){$('routeResult').innerHTML=`<p class="route-warning">${L('אין מסלול מלא דרך המעברים הידועים שנבחרו. ייתכן שנדרשים שירות נסיעה, תנאי משחק, או מעבר שהיעד שלו אינו מופיע בקבצים. אפשר לסמן שימוש בכניסות דרך דמויות ומשימות; גם אז חלק מהמעברים נשארים לא ידועים.','No complete route was found using the selected passages. Travel services, game conditions or undocumented destinations may be required. Try allowing NPC and quest entrances; some connections may still be unknown.')}</p>`;return;}
  const serviceCount=route.steps.filter(s=>s.service && !s.service.walkable).length;
  const ids=[route.from,...route.steps.map(s=>s.to)];
  let html=`<p class="route-summary">${route.steps.length===0?L('כבר נמצאים במפת היעד.','You are already at the destination.'):L(`${route.steps.length} מעברים · ${serviceCount?serviceCount+' מהם מותנים':'דרך שערים עם יעד מתועד'}`,`${route.steps.length} passages · ${serviceCount?serviceCount+' conditional':'Through portals with documented destinations'}`)}</p>`;
  if(serviceCount)html+=`<p class="route-warning">${L('המסלול כולל כניסות מותנות. יש לעמוד בתנאים שמופיעים בכל שלב; לא נבדקו הדמות, המשימות או הערוץ שלך.','This route includes conditional entrances. Follow the requirements for each step; your character, quests and channel have not been checked.')}</p>`;
  if(ids.some(id=>['event','system','unavailable'].includes(byId.get(id).scope)))html+=`<p class="route-warning">${L('המסלול עובר ברשומות אירוע או מערכת. קיום החיבור בקובץ אינו מבטיח כניסה במשחק.','This route passes through event or system records. A connection in the data does not guarantee entry in the game.')}</p>`;
  html+=`<button type="button" id="startRoute" class="button primary start-route">${startRouteLabel()}</button>`;
  html+=`<div class="route-secondary-actions"><button type="button" id="shareRoute" class="button quiet">${L('שיתוף מסלול ושלב נוכחי','Share route and current step')}</button><button type="button" id="restartRoute" class="button quiet">${L('התחלה מחדש','Start over')}</button></div>`;
  html+=ids.map((id,i)=>{const step=route.steps[i],m=byId.get(id),gate=step?.p||(step?.service?m.portals.find(p=>supplementForGate(p,m)?.id===step.service.id):null);return `<div class="route-step" data-step-index="${i}" data-step-state="${routeStepState(i)}"><span class="step-number">${i+1}</span><div class="route-step-content"><button type="button" data-route-map="${id}">${eng(m.name)}${step?`<small>${step.service?esc(serviceLabel(step.service)):esc(`${L('שער','Portal')} ${step.p.number} · ${directionLabel(step.p,m)} · ${portalTypeLabel(step.p,m)}`)}</small>${step.service?`<small>${esc(serviceCondition(step.service))}</small>`:''}`:`<small>${L('מפת היעד','Destination map')}</small>`}</button>${gate?`<button type="button" class="route-locate" data-route-scene="${id}" data-route-gate="${esc(gate.key)}" data-route-index="${i}">${icon('pin')}${L(`הצגת שער היציאה ${gate.number}`,`Show exit portal ${gate.number}`)}</button>`:''}</div></div>`;}).join('');
  html+=`<button type="button" id="clearRoute" class="clear-route">${L('ניקוי המסלול','Clear route')}</button>`;$('routeResult').innerHTML=html;
}
function drawRoute(){const layer=$('routeLayer');layer.replaceChildren();if(!route){updateGraphDetail();return;}for(const s of route.steps){const a=byId.get(s.from),b=byId.get(s.to);layer.append(svgEl('path',{d:edgePath(a,b),class:`route-edge ${s.service?'service':''}`}));}const ids=[route.from,...route.steps.map(s=>s.to)];ids.forEach((id,i)=>{const m=byId.get(id),g=svgEl('g',{transform:`translate(${m.x+19},${m.y-20})`});g.append(svgEl('circle',{class:'route-dot',r:17}),svgEl('text',{class:'route-number'},i+1));layer.append(g);});updateGraphDetail();}
function fitRoute(ids){const ms=ids.map(id=>byId.get(id)),r=canvasView('mapCanvas');const minX=Math.min(...ms.map(m=>m.x))-100,maxX=Math.max(...ms.map(m=>m.x))+100,minY=Math.min(...ms.map(m=>m.y))-100,maxY=Math.max(...ms.map(m=>m.y))+100;world.k=Math.min((r.width-90)/(maxX-minX),(r.height-32)/(maxY-minY),1.6);world.k=Math.max(.03,world.k);world.x=r.left+(r.width-(minX+maxX)*world.k)/2;world.y=r.top+(r.height-(minY+maxY)*world.k)/2;applyWorld();$('mapIntro').classList.add('is-hidden');}

// Navigation progress is explicit, never inferred from the player's location.
let navigationRoute=null, navigationIndex=0, navigationFollowing=false, routeUsesServices=false, compactNavigation=false;
function navigationGate(index=navigationIndex){
  const step=route?.steps[index];if(!step)return null;
  return step.p||(step.service?byId.get(step.from)?.portals.find(p=>supplementForGate(p,byId.get(step.from))?.id===step.service.id):null);
}
function navigationActive(){return !!route&&navigationRoute===route;}
function navigationArrival(){return navigationActive()&&navigationFollowing?AtlasJourney.arrivalInfo(route,navigationIndex,byId):{portal:null,reason:'start'};}
function routeStepState(index){return !navigationActive()?'upcoming':index<navigationIndex?'completed':index===navigationIndex?'current':'upcoming';}
function updateRouteProgress(){
  const start=$('startRoute');if(start)start.textContent=startRouteLabel();
  $('routeResult').querySelectorAll('[data-step-index]').forEach(step=>step.setAttribute('data-step-state',routeStepState(Number(step.dataset.stepIndex))));
}
function openRouteStep(index,{show=true}={}){
  if(!route||!Number.isInteger(index)||index<0||index>route.steps.length)return;
  navigationRoute=route;navigationIndex=index;
  const id=route.steps[index]?.from??route.to;
  if(show)openScene(id,navigationGate(index)?.key,{following:true});else navigationFollowing=false;
  updateRouteProgress();
  window.AtlasPersonal?.saveJourney();
}
function renderSceneNavigation(){
  const bar=$('sceneNavigation'),active=navigationActive();bar.hidden=!active;
  $('sceneDialog').classList.toggle('compact-navigation',active&&navigationFollowing&&compactNavigation);
  window.AtlasShell?.setCompanion(active&&navigationFollowing&&compactNavigation);
  $('sceneNavCompact').setAttribute('aria-pressed',String(compactNavigation));$('sceneNavCompact').textContent=compactNavigation?L('תצוגה מלאה','Full view'):L('ניווט מצומצם','Compact navigation');
  if(!active){if($('sceneDialog').open&&sceneLayer==='portals')renderScenePins();notifyView();return;}
  const step=route.steps[navigationIndex],gate=navigationGate();
  const following=navigationFollowing&&sceneId===(step?.from??route.to);
  $('sceneNavStatus').textContent=!following?L('סיור חופשי · המסלול שלך שמור','Free exploration · Your route is saved'):step?L(`מעבר ${navigationIndex+1} מתוך ${route.steps.length}`,`Passage ${navigationIndex+1} of ${route.steps.length}`):L('הגעת למפת היעד','You reached the destination map');
  $('sceneNavTarget').textContent=!following?byId.get(route.steps[navigationIndex]?.from??route.to).name:step?byId.get(step.to).name:byId.get(route.to).name;
  $('sceneNavLabel').textContent=!following?L('חזרה לנקודה שבה עצרת','Return to your saved step'):step?L('המפה הבאה','Next map'):L('סיום המסלול','Route complete');
  $('sceneNavInstruction').textContent=!following?L('אפשר לחקור ולחזור למסלול בכל רגע.','Explore freely and return to your route at any time.'):step?.service?serviceCondition(step.service):gate?L(`שער ${gate.number} מודגש בתמונה · ${directionLabel(gate,byId.get(sceneId))}`,`Portal ${gate.number} is highlighted · ${directionLabel(gate,byId.get(sceneId))}`):L('השלמת את כל המעברים במדריך. המיקום במשחק אינו מזוהה אוטומטית.','You completed all passages in the guide. Your in-game location is not detected automatically.');
  $('sceneNavPrevious').disabled=navigationIndex===0;
  $('sceneNavNext').disabled=navigationIndex===route.steps.length;
  $('sceneNavNext').textContent=navigationIndex===route.steps.length-1?L('למפת היעד','To destination'):L('הבא במסלול','Next step');
  $('sceneNavReturn').hidden=following;
  $('sceneNavReroute').hidden=following;
  $('sceneNavReroute').setAttribute('aria-label',L(`חישוב מסלול מהמפה המוצגת אל ${byId.get(route.to).name}`,`Calculate a route from this map to ${byId.get(route.to).name}`));
  $('sceneNavCompact').hidden=!following;
  $('sceneNavError').textContent='';
  $('sceneNavFocus').hidden=!following||!gate;
  $('sceneNavProgress').max=Math.max(1,route.steps.length);
  $('sceneNavProgress').value=navigationIndex;
  renderJourneyNavigation(following);notifyView();
}
function renderJourneyNavigation(following){
  const ids=[route.from,...route.steps.map(step=>step.to)],breadcrumb=$('sceneNavBreadcrumb'),picker=$('sceneNavStep'),goalHost=$('sceneNavGoal');
  if(breadcrumb){
    const arrival=navigationArrival(),entry=arrival.portal?L(`כניסה מתועדת: שער ${arrival.portal.number}`,`Recorded arrival: portal ${arrival.portal.number}`):arrival.reason==='ambiguous'?L('שם שער הכניסה מופיע בכמה נקודות; לא נבחר מיקום משוער.','The arrival portal name matches several points; no position was guessed.'):L('לא תועד שער כניסה מדויק למעבר הזה.','No exact arrival portal is recorded for this passage.');
    breadcrumb.innerHTML=`<div class="journey-breadcrumb">${[navigationIndex-1,navigationIndex,navigationIndex+1].filter(index=>index>=0&&index<ids.length).map(index=>`<button type="button" data-route-jump="${index}" ${index===navigationIndex?'aria-current="step"':''}><small>${index<navigationIndex?L('הקודמת','Previous'):index===navigationIndex?L('עכשיו','Current'):L('הבאה','Next')}</small>${eng(byId.get(ids[index]).name)}</button>`).join('')}</div>${following&&navigationIndex>0?`<p class="journey-entry-note">${entry}</p>`:''}`;
  }
  if(picker){picker.innerHTML=ids.map((id,index)=>`<option value="${index}">${index+1}. ${esc(byId.get(id).name)}${index===route.steps.length?' · '+L('היעד','Destination'):''}</option>`).join('');picker.value=String(navigationIndex);picker.setAttribute('aria-label',L('כל שלבי המסלול','All route steps'));}
  if(!goalHost)return;
  const goal=route.goal,atDestination=following&&navigationIndex===route.steps.length;
  goalHost.hidden=!goal;if(!goal){goalHost.innerHTML='';return;}
  const present=new Set((window.HuntData?.mapSpawns?.[route.to]?.points||[]).map(point=>point.mobId)),idsAtDestination=goal.monsterIds.filter(id=>present.has(id));
  goalHost.innerHTML=`<strong>${L('מטרת המסע','Journey goal')}</strong><p>${esc(window.Hunt?.describeGoal?.(goal)||L('מטרות הציד שבחרתם','Your selected hunting targets'))}</p>${atDestination?`<button type="button" class="button primary" id="sceneNavArrival" ${idsAtDestination.length?'':'disabled'}>${L('הצגת נקודות ההופעה ביעד','Show target spawn points')}</button><small>${idsAtDestination.length?L('הנקודות מבוססות על נתוני המפה; אינן מיקום חי.','Points come from map data; they are not live positions.'):window.HuntData?L('למטרות האלה אין נקודות הופעה מתועדות במפת היעד.','These targets have no recorded spawn points on the destination map.'):L('נתוני נקודות ההופעה עדיין נטענים.','Spawn point data is still loading.')}</small>`:''}`;
}
function fitNavigationScene(){
  fitScene();
  if(navigationActive()&&navigationFollowing&&compactNavigation){const gate=navigationGate();if(gate)pickGate(gate.key,true);}
}
function setCompactNavigation(enabled){
  compactNavigation=!!enabled;renderSceneNavigation();
  if(navigationActive()&&navigationFollowing&&compactNavigation){const gate=navigationGate();if(gate)sceneKind=displayKind(gate,byId.get(sceneId));setSceneLayer('portals',[]);}
  requestAnimationFrame(fitNavigationScene);
}
function rerouteFromScene(){
  if(!navigationActive()||!byId.has(sceneId))return false;
  const destination=route.to,stops=AtlasJourney.remainingStops(route,navigationIndex),goal=route.goal,candidate=findRoute(sceneId,destination,routeUsesServices,stops,routeExclusions);
  if(!candidate){$('sceneNavError').textContent=rerouteError();return false;}
  planJourney({from:sceneId,to:destination,stops,...routeExclusions,services:routeUsesServices,step:0,...(goal?{goal}:{})},{show:true});$('sceneNavCompact').focus();toast(L('המסלול חושב מחדש מהמפה שבחרת לאותו יעד.','Route recalculated from the selected map to the same destination.'));return true;
}
function rerouteError(){return L('לא נמצא מסלול מהמפה הזאת עם אפשרויות המעבר שבחרת. המסלול הקודם נשמר; אפשר לחזור אליו או לשנות את אפשרויות התכנון.','No route was found from this map with your selected travel options. Your previous route is saved; return to it or change the route options.');}
function travelScenePortal(key){
  const m=byId.get(sceneId),p=m?.portals.find(p=>p.key===key);if(!p)return;
  const supplement=supplementForGate(p,m),target=byId.get(p.kind==='cross'?p.to:supplement?.to);
  if(!target){pickGate(key,true);return;}
  if(navigationActive()&&navigationFollowing&&navigationGate()?.key===key){openRouteStep(navigationIndex+1);return;}
  const arrivals=p.kind==='cross'&&p.to===target.id&&p.toPortal?target.portals.filter(q=>q.name===p.toPortal):[];
  selectMap(target.id,{scroll:false});
  openScene(target.id,arrivals.length===1?arrivals[0].key:null);
}
const loadedSceneImages=new Set();
function loadSceneImage(retry=false){
  const m=byId.get(sceneId);if(!m)return;
  const image=$('sceneImage'),status=$('sceneImageStatus'),requestedMap=sceneId;
  if(!retry&&loadedSceneImages.has(m.image)&&image.getAttribute('href')===m.image){status.hidden=true;return;}
  status.hidden=false;status.dataset.state='loading';$('sceneImageMessage').textContent=L("טוענים את תמונת המפה…","Loading map image…");$('sceneImageRetry').hidden=true;
  image.style.visibility='hidden';$('sceneCanvas').setAttribute('aria-busy','true');
  image.onload=()=>{if(sceneId!==requestedMap)return;loadedSceneImages.add(m.image);image.style.visibility='';status.hidden=true;$('sceneCanvas').setAttribute('aria-busy','false');};
  image.onerror=()=>{if(sceneId!==requestedMap)return;status.dataset.state='error';$('sceneImageMessage').textContent=L("תמונת המפה לא נטענה. השערים והמיקומים עדיין זמינים ברשימה.","The map image could not load. Portals and locations are still available in the list.");$('sceneImageRetry').hidden=false;$('sceneCanvas').setAttribute('aria-busy','false');};
  image.setAttribute('href',retry?`${m.image}?retry=${Date.now()}`:m.image);
}
function openScene(id,gateKey=null,options={}){const m=byId.get(Number(id));if(!m)return;navigationFollowing=options.following===true;sceneId=m.id;window.AtlasPersonal?.visit(m.id);window.AtlasExplorer?.rememberMap(m.id);selectedGate=gateKey;const gate=m.portals.find(p=>p.key===gateKey);sceneKind=gate?displayKind(gate,m):'cross';$('sceneTitle').textContent=m.name;$('sceneRegion').textContent=groupLabel(m);$('sceneImage').setAttribute('width',m.width||3000);$('sceneImage').setAttribute('height',m.height||1500);loadSceneImage();$('originalImage').href=m.originalImage||m.image;if(window.AtlasShell)window.AtlasShell.showScene($('sceneDialog'),{following:options.following===true});else if(!$('sceneDialog').open)$('sceneDialog').showModal();setSceneLayer('portals',[]);renderSceneNavigation();$('sceneNavigation').scrollTop=0;requestAnimationFrame(()=>{fitNavigationScene();if(gate&&!compactNavigation)pickGate(gate.key,false);});}
function fitScene(){const m=byId.get(sceneId);if(!m)return;const r=canvasView('sceneCanvas'),w=m.width||3000,h=m.height||1500;scene.k=Math.max(.015,Math.min((r.width-48)/w,(r.height-60)/h));scene.x=r.left+(r.width-w*scene.k)/2;scene.y=r.top+(r.height-h*scene.k)/2;applyScene();}
function applyScene(){const m=byId.get(sceneId);if(!m)return;$('sceneViewport').setAttribute('transform',`translate(${scene.x},${scene.y}) scale(${scene.k})`);for(const pin of portalPinElements.values()){pin.querySelector('circle').setAttribute('r',12/scene.k);pin.querySelector('circle').setAttribute('stroke-width',1.7/scene.k);pin.querySelector('text').setAttribute('font-size',11/scene.k);const label=pin.querySelector('.route-pin-label');if(label){label.setAttribute('font-size',13/scene.k);label.setAttribute('y',-26/scene.k);label.setAttribute('stroke-width',4/scene.k);}}for(const pin of entityPinElements.values()){pin.querySelector('circle').setAttribute('r',(pin.classList.contains('boss')?14:11)/scene.k);pin.querySelector('circle').setAttribute('stroke-width',1.7/scene.k);pin.querySelector('text').setAttribute('font-size',10/scene.k);}document.querySelectorAll('.internal-path').forEach(p=>{p.setAttribute('stroke-width',2/scene.k);p.setAttribute('stroke-dasharray',`${6/scene.k} ${5/scene.k}`);});}
function zoomScene(factor,cx,cy){const r=$('sceneCanvas').getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;const k=Math.max(.015,Math.min(3,scene.k*factor)),ratio=k/scene.k;scene.x=cx-(cx-scene.x)*ratio;scene.y=cy-(cy-scene.y)*ratio;scene.k=k;applyScene();}
function renderScenePins(){
  const m=byId.get(sceneId),arrival=navigationArrival().portal,required=navigationActive()&&navigationFollowing?navigationGate():null;
  $('scenePins').replaceChildren();portalPinElements.clear();
  for(const p of m.portals){
    const isArrival=arrival?.key===p.key,isRequired=required?.key===p.key;
    if(sceneKind!=='all'&&displayKind(p,m)!==sceneKind&&!isArrival&&!isRequired)continue;
    const role=[isArrival?L('כניסה מתועדת','Recorded arrival'):'',isRequired?L('היציאה הבאה','Next exit'):''].filter(Boolean).join(' · ');
    const g=svgEl('g',{class:`scene-pin ${p.kind} ${p.noEffect?'no-effect':''} ${p.key===selectedGate?'chosen':''} ${isRequired?'route-required':''} ${isArrival?'route-arrival':''}`,transform:`translate(${p.x},${p.y})`,role:'button',tabindex:'0','aria-label':`${L('שער','Portal')} ${p.number}: ${portalTarget(p,m)}${role?' · '+role:''}`});
    g.append(svgEl('circle',{r:12/scene.k}),svgEl('text',{'font-size':11/scene.k},p.number));
    if(isArrival||isRequired){const text=[isArrival?L('נכנסת מכאן','You entered here'):'',isRequired?L('צא מכאן ➔ ','Exit here ➔ ')+portalTarget(p,m):''].filter(Boolean).join(' · ');g.append(svgEl('text',{class:'route-pin-label','text-anchor':'middle'},text));}
    g.addEventListener('click',e=>{e.stopPropagation();if(!sceneDragging)pickGate(p.key,false);});
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickGate(p.key,false);}});
    $('scenePins').append(g);portalPinElements.set(p.key,g);
  }
  drawInternal();applyScene();
}
function renderSceneSidebar(){const m=byId.get(sceneId);document.querySelectorAll('#sceneFilters button').forEach(b=>b.classList.toggle('active',b.dataset.kind===sceneKind));const ps=m.portals.filter(p=>sceneKind==='all'||displayKind(p,m)===sceneKind);let text='';if(sceneKind==='unknown')text=`<p class="section-note">${L('נקודות ללא יעד קבוע. אין להסיק שכל נקודה כזאת היא שער פעיל.','Points without a fixed destination. Not every point is an active portal.')}</p>`;if(sceneKind==='internal')text=`<p class="section-note">${L('בחרו שער כדי לראות גם את נקודת הנחיתה שלו. קו מופיע רק אם נקודת היעד נמצאה בשמה.','Select a portal to see its arrival point. A line appears only when a destination with the matching name is found.')}</p>`;$('scenePortalList').innerHTML=text+(ps.length?ps.map(p=>portalCard(p,m,true)).join(''):`<p class="empty-state">${L('אין שערים מהסוג הזה במפה.','This map has no portals of this type.')}</p>`);renderSceneSelected();}
function renderSceneSelected(){
  const m=byId.get(sceneId),p=m.portals.find(p=>p.key===selectedGate);if(!p){$('sceneSelected').innerHTML='';return;}
  const supplement=supplementForGate(p,m),target=byId.get(p.to??supplement?.to);
  let html=`<div class="scene-selected"><span>${L('שער','Portal')} ${p.number} · ${portalTypeLabel(p,m)}</span>${eng(portalTarget(p,m))}<small>${L('מיקום בתמונת המקור:','Position in source image:')} <bdi dir="ltr">x ${p.x}, y ${p.y}</bdi></small><small>${L('שם השער בקובץ','Portal name in the data')}</small>${eng(p.name||L('ללא שם','Unnamed'))}`;
  if((p.kind==='cross'||supplement)&&target){
    if(supplement)html+=`<p>${esc(serviceCondition(supplement))}</p><small>${L('יעד זה מתועד במקור משלים; הוא אינו יעד קבוע ברשומת הלקוח.','This destination is documented by a supplementary source, not as a fixed destination in the client record.')}</small><a class="source-link" href="${esc(serviceUrls(supplement)[0])}" target="_blank" rel="noopener noreferrer">${L('מקור התיעוד','Documentation source')}</a>`;
    html+=`<button type="button" class="button primary" data-scene-travel="${target.id}" data-travel-gate="${esc(p.key)}">${L('לעבור אל מפת היעד','Go to destination map')}</button>`;
  }else if(p.kind==='internal'){
    const destinations=m.portals.filter(q=>q.name===p.toPortal);
    html+=`<small>${destinations.length===0?L('שם נקודת היעד קיים, אך לא נמצאה לה קואורדינטה ברשומות השערים.','The destination name is recorded, but no coordinates were found in the portal records.'):destinations.length>1?L('נמצאו כמה נקודות עם שם היעד; כולן מסומנות.','Multiple points share the destination name; all are marked.'):L('הקו מחבר לשער הנחיתה באותה מפה.','The line connects to the arrival portal within this map.')}</small>`;
  }else html+=`<small>${L('היעד אינו קבוע בנתוני הלקוח. אין כאן חיבור מאומת למפה אחרת.','The client data has no fixed destination. This is not a verified connection to another map.')}</small>`;
  html+='</div>';$('sceneSelected').innerHTML=html;
}
function pickGate(key,focus){const m=byId.get(sceneId),p=m.portals.find(p=>p.key===key);if(!p)return;selectedGate=key;for(const [k,g]of portalPinElements)g.classList.toggle('chosen',k===key);$('scenePortalList').querySelectorAll('.portal-card').forEach(c=>c.classList.toggle('chosen',c.dataset.gate===key));renderSceneSelected();drawInternal();if(focus){const r=canvasView('sceneCanvas');const targetK=Math.max(scene.k,Math.min(.7,r.width/1000));scene.k=targetK;scene.x=r.left+r.width/2-p.x*scene.k;scene.y=r.top+r.height/2-p.y*scene.k;applyScene();}}
function drawInternal(){const layer=$('sceneInternal');layer.replaceChildren();const m=byId.get(sceneId),p=m?.portals.find(p=>p.key===selectedGate);if(!p||p.kind!=='internal')return;const targets=m.portals.filter(q=>q.name===p.toPortal);for(const t of targets){layer.append(svgEl('path',{class:'internal-path',d:`M${p.x},${p.y}Q${(p.x+t.x)/2},${Math.min(p.y,t.y)-100} ${t.x},${t.y}`}));const target=svgEl('circle',{cx:t.x,cy:t.y,r:19/scene.k,fill:'none',stroke:'#f5ddac','stroke-width':2/scene.k});layer.append(target);}applyScene();}

function openSpawns(mapId,mobIds=[]){openScene(mapId);setSceneLayer('monsters',mobIds);}
function openNpcs(mapId,npcIds=[]){openScene(mapId);setSceneLayer('npcs',npcIds);requestAnimationFrame(()=>{if(sceneLayer==='npcs'&&sceneEntityPoints.length===1)pickEntity(sceneEntityPoints[0].key,true);});}
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
  $('sceneHint').textContent=isPortal?L("המספרים תואמים לרשימת השערים · גלגלת לקירוב · גרירה לתנועה","Numbers match the portal list · Scroll to zoom · Drag to pan"):layer==='npcs'?L("מיקומי דמויות מתוך קובץ המפה · גלגלת לקירוב · גרירה לתנועה","NPC locations from map data · Scroll to zoom · Drag to pan"):L("נקודות הופעה רשומות · אינן מציגות מפלצות חיות בזמן אמת","Recorded spawn points · Not live monster positions");
  if(isPortal){renderScenePins();renderSceneSidebar();return;}
  renderSceneEntities();
}
function renderSceneEntities(){
  const m=byId.get(sceneId),isNpc=sceneLayer==='npcs';
  if(!isNpc&&!window.HuntData){
    sceneEntityPoints=[];$('sceneSelected').innerHTML='';
    $('sceneEntitySummary').innerHTML=window.Hunt?.catalogStatus==='unavailable'?`<p class="section-note" role="status">${L('נתוני נקודות ההופעה לא נטענו.','Spawn point data could not load.')}</p><button type="button" class="button quiet" id="sceneRetryCatalog">${L('פתיחת הקטלוג לניסיון נוסף','Open catalog to retry')}</button>`:`<p class="section-note" role="status">${L('טוענים את נתוני נקודות ההופעה…','Loading spawn point data…')}</p>`;
    $('scenePortalList').innerHTML='';return;
  }
  const raw=isNpc?(m.npcs||[]).map(p=>({...p,entityId:p.id})):(window.HuntData?.mapSpawns?.[sceneId]?.points||[]).map(p=>({...p,entityId:p.mobId}));
  sceneEntityPoints=raw.filter(p=>(!sceneEntityIds.length||sceneEntityIds.includes(p.entityId))&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map((p,i)=>({...p,number:i+1,key:`${sceneLayer}:${sceneId}:${i}`}));
  const uniqueIds=[...new Set(sceneEntityPoints.map(p=>p.entityId))];
  const selectedNames=sceneEntityIds.map(entityDefinition).map(n=>eng(n.name)).join('');
  let summary=`<div class="entity-scene-summary"><span class="eyebrow">${isNpc?L("אנשים בדרך","People along the way"):L("איפה מתחיל הציד","Where the hunt begins")}</span>${selectedNames}<strong>${sceneEntityPoints.length===1?(isNpc?L("מיקום דמות אחד","1 NPC location"):L("נקודת הופעה אחת","1 spawn point")):fmt(sceneEntityPoints.length)+' '+(isNpc?L("מיקומי דמויות","NPC locations"):L("נקודות הופעה","spawn points"))} · ${uniqueIds.length===1?(isNpc?L("דמות אחת","1 NPC"):L("סוג מפלצת אחד","1 monster type")):uniqueIds.length+' '+(isNpc?L("מזהי דמות","NPC IDs"):L("סוגי מפלצות","monster types"))}</strong>`;
  if(sceneEntityIds.length)summary+=`<button type="button" class="entity-show-all" id="sceneShowAll">${isNpc?L("הצג את כל הדמויות במפה","Show all NPCs on this map"):L("הצג את כל המפלצות במפה","Show all monsters on this map")}</button>`;
  summary+=`<p>${isNpc?L("המיקום מבוסס על קובץ המפה. דמות משימה או אירוע עשויה להופיע רק בתנאים מסוימים.","Locations come from the map data. Quest or event NPCs may appear only under certain conditions."):L("זו פריסת נקודות ההופעה שבנתונים. מספר המפלצות החיות וזמן החזרה נשלטים על ידי שרת המשחק.","This shows the recorded spawn point layout. The game server controls live monster counts and respawn times.")}</p></div>`;
  $('sceneEntitySummary').innerHTML=summary;
  $('sceneSelected').innerHTML='';
  for(const p of sceneEntityPoints){
    const def=entityDefinition(p.entityId),boss=!isNpc&&def.isBoss;
    const pin=svgEl('g',{class:`entity-pin ${isNpc?'npc':boss?'boss':'monster'}`,transform:`translate(${p.x},${p.y})`,role:'button',tabindex:'0','aria-label':`${isNpc?L("מיקום","Location"):L("נקודת הופעה","Spawn point")} ${p.number}: ${def.name}`});
    pin.append(svgEl('circle'),svgEl('text',{},p.number));
    pin.addEventListener('click',e=>{e.stopPropagation();if(!sceneDragging)pickEntity(p.key,false);});
    pin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickEntity(p.key,false);}});
    $('sceneEntities').append(pin);entityPinElements.set(p.key,pin);
  }
  $('scenePortalList').innerHTML=sceneEntityPoints.length?sceneEntityPoints.map(p=>{
    const def=entityDefinition(p.entityId);
    return `<button type="button" class="entity-location-card" data-entity-key="${esc(p.key)}"><span class="entity-location-number">${p.number}</span>${def.icon?`<img src="${esc(def.icon)}" alt="" loading="lazy">`:''}<span>${eng(def.name)}<small>${!isNpc&&def.isBoss?L("בוס · ","Boss · "):''}${esc(directionLabel(p,m))}</small></span></button>`;
  }).join(''):`<p class="empty-state">${isNpc?L("לא נרשם במפה הזאת מיקום של הדמות שנבחרה.","No location for the selected NPC is recorded on this map."):L("אין נקודות הופעה רשומות לבחירה הזאת במפה. זימון באמצעות משימה או אירוע עשוי לא להופיע בקובץ.","No spawn points match this selection on this map. Quest or event summons may not appear in the data.")}</p>`;
  if(sceneEntityPoints.length===1)pickEntity(sceneEntityPoints[0].key,false);
  applyScene();
}
function pickEntity(key,focus){
  const p=sceneEntityPoints.find(p=>p.key===key);if(!p)return;
  selectedEntity=key;const def=entityDefinition(p.entityId),isNpc=sceneLayer==='npcs';
  for(const [k,pin]of entityPinElements)pin.classList.toggle('chosen',k===key);
  $('scenePortalList').querySelectorAll('[data-entity-key]').forEach(b=>b.classList.toggle('chosen',b.dataset.entityKey===key));
  $('sceneSelected').innerHTML=`<div class="scene-selected entity-selected"><span>${isNpc?L("מיקום דמות","NPC location"):def.isBoss?L("נקודת הופעה של בוס","Boss spawn point"):L("נקודת הופעה","Spawn point")} ${p.number}</span>${eng(def.name)}<small>${L('מזהה:','ID:')} ${p.entityId}${!isNpc&&def.level!=null?L(" · רמה "," · Level ")+def.level:''}</small><small>${L('מיקום בתמונת המקור','Position in source image')}</small><bdi class="entity-coordinates" dir="ltr">x ${p.x}, y ${p.y}</bdi><p>${isNpc?L("הסימון מראה את המיקום הרשום של הדמות במפה.","This marker shows the recorded NPC location on the map."):L("הסימון מציין נקודת הופעה אפשרית. הוא אינו מאשר שהמפלצת נמצאת כאן כרגע.","This marker indicates a possible spawn point. It does not confirm that a monster is currently here.")}</p>${def.sourceUrl?`<a class="source-link" href="${esc(def.sourceUrl)}" target="_blank" rel="noopener noreferrer">${L('רשומת המקור','Source record')}</a>`:''}</div>`;
  if(focus){const r=canvasView('sceneCanvas');scene.k=Math.max(scene.k,Math.min(.8,r.width/900));scene.x=r.left+r.width/2-p.x*scene.k;scene.y=r.top+r.height/2-p.y*scene.k;applyScene();}
}

let sceneDragging=false;
function enablePanZoom(svg,kind){let points=new Map(),start=null,moved=false,lastDist=null;const isWorld=kind==='world',model=()=>isWorld?world:scene,apply=()=>isWorld?applyWorld():applyScene();
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===1){start={x:e.clientX,y:e.clientY,tx:model().x,ty:model().y};moved=false;if(isWorld)worldMoved=false;else sceneDragging=false;}else if(points.size===2){const ps=[...points.values()];lastDist=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y);}(e.target.setPointerCapture?e.target:svg).setPointerCapture(e.pointerId);});
  svg.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2){const ps=[...points.values()],dist=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y);if(lastDist){const r=svg.getBoundingClientRect(),cx=(ps[0].x+ps[1].x)/2-r.left,cy=(ps[0].y+ps[1].y)/2-r.top;(isWorld?zoomWorld:zoomScene)(dist/lastDist,cx,cy);}lastDist=dist;moved=true;}else if(start){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)>4)moved=true;if(moved){model().x=start.tx+dx;model().y=start.ty+dy;apply();}}if(moved){svg.classList.add('dragging');if(isWorld){worldMoved=true;$('mapTooltip').hidden=true;$('mapIntro').classList.add('is-hidden');}else sceneDragging=true;}});
  const end=e=>{points.delete(e.pointerId);if(points.size===0){start=null;lastDist=null;svg.classList.remove('dragging');setTimeout(()=>{if(isWorld)worldMoved=false;else sceneDragging=false;},0);}else{const p=[...points.values()][0];start={x:p.x,y:p.y,tx:model().x,ty:model().y};lastDist=null;}};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect();(isWorld?zoomWorld:zoomScene)(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
}

function renderAbout(){const stats=atlas.meta.stats;$('coverageStats').innerHTML=[[maps.length,L("רשומות מפה","map records")],[stats.cross,L("שערים בין מפות","portals between maps")],[stats.internal,L("מעברים פנימיים","internal passages")],[stats.unknown,L('ללא יעד קבוע','no fixed destination')]].map(([v,l])=>`<div class="coverage-stat"><b>${fmt(v)}</b><span>${l}</span></div>`).join('');$('sourcesList').innerHTML=(atlas.sources||[]).map(s=>`<div class="source-item"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(D(s.title))}</a><p>${esc(D(s.description||''))}</p></div>`).join('');}
function renderHuntAbout(){
  const data=window.HuntData;if(!data)return;
  let section=$('huntingCoverage');
  if(!section){section=document.createElement('section');section.id='huntingCoverage';$('sourcesList').insertAdjacentElement('beforebegin',section);}
  const stats=data.meta.stats,dropMeta=data.dropData?.meta||{};
  const coverage=L(`הקטלוג כולל ${fmt(stats.items)} פריטים, ${fmt(stats.monsters)} רשומות מפלצת ו־${fmt(stats.npcs)} רשומות דמות. ${fmt(stats.spawnPoints)} נקודות הופעה מסומנות ב־${fmt(stats.mapsWithSpawns)} מפות. ${fmt(stats.npcPlacements)} מיקומי דמויות נרשמו ב־${fmt(stats.mapsWithNpcs)} מפות.`,`The catalog contains ${fmt(stats.items)} items, ${fmt(stats.monsters)} monster records and ${fmt(stats.npcs)} NPC records. ${fmt(stats.spawnPoints)} spawn points are marked across ${fmt(stats.mapsWithSpawns)} maps. ${fmt(stats.npcPlacements)} NPC locations are recorded across ${fmt(stats.mapsWithNpcs)} maps.`);
  const dropCoverage=L(`תיעוד הפריטים מכסה כרגע ${fmt(dropMeta.acceptedRelationships||0)} קשרים בין ${fmt(dropMeta.coveredItemIds||0)} פריטים לבין ${fmt(dropMeta.coveredMonsterIds||0)} מזהי מפלצת. נכללו רק דיווחים שסומנו בקלאסיק, ללא שיעורי הנפילה של גרסאות אחרות. זהו מאגר קהילתי חלקי; אין תאריך או גרסת תצפית לכל שורה, ולא כל דיווח נבדק מחדש בעדכון הנוכחי.`,`Drop observations currently cover ${fmt(dropMeta.acceptedRelationships||0)} relationships between ${fmt(dropMeta.coveredItemIds||0)} items and ${fmt(dropMeta.coveredMonsterIds||0)} monster IDs. Only Classic-tagged reports are included, without drop rates from other versions. This is a partial community dataset; individual rows lack observation dates or versions, and not every report was rechecked in the current update.`);
  section.innerHTML=`<h3>${L('חיפוש פריטים, מפלצות ודמויות','Find items, monsters and NPCs')}</h3><p>${coverage}</p><p>${L('שמות כפולים נשמרים בנפרד לפי מזהה. לדמות או לבוס ללא מיקום מתועד לא ניתנה כתובת משוערת. המלצת הציד מבוססת על נקודות הופעה, ולא על תדירות הופעה, סיכוי נפילה או פריטים בשעה.','Duplicate names are kept separate by ID. NPCs and bosses without documented locations are not assigned estimated positions. Hunting suggestions use spawn points, not respawn frequency, drop chance or items per hour.')}</p>${window.Hunt?.dropStatus==='unavailable'?`<p class="route-warning">${L('תיעוד הנפילות לא נטען בביקור הזה. אפשר לנסות שוב בחלונית החיפוש והציד; אין להסיק מכך שלפריטים אין נפילות מתועדות.','Drop observations could not load during this visit. Retry in the search and hunting panel; this does not mean the items have no documented drops.')}</p>`:`<p>${dropCoverage}</p>`}<p><a class="source-link" href="https://ms-classic.com/drops" target="_blank" rel="noopener noreferrer">${L('טבלת תצפיות הנפילה','Drop observation table')}</a><a class="source-link" href="https://maplelandhub.com/classic/en/monster/700000" target="_blank" rel="noopener noreferrer">${L('תצפיות נוספות של בוס הפטרייה','Additional Mushroom boss observations')}</a></p><p class="copyright" dir="ltr" lang="en">${esc(dropMeta.attribution||'')} ${esc(dropMeta.license||'')} <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">License</a></p><div class="coverage-downloads"><a href="hunt-data.json" download="classic-hunt-data.json" class="button quiet">${L('הורדת קטלוג ומיקומים','Download catalog and locations')}</a><a href="drop-data.json" download="classic-drop-observations.json" class="button quiet">${L('הורדת תצפיות הנפילה','Download drop observations')}</a></div><h3>${L('מקורות המפות והמעברים','Map and passage sources')}</h3>`;
}
// Refresh copy in place. Changing language must never resubmit a route or move the camera.
function refreshLanguage(){
  if(!atlas)return;
  const selectedSearch=activeSearchResults[searchIndex],searchOpen=!$('searchResults').hidden;
  const invalidStops=routeStopValues.map((_,index)=>$('routeStop'+index)?.getAttribute('aria-invalid')==='true');
  routeStopValues=readRouteStops();renderRouteStops();invalidStops.forEach((invalid,index)=>{if(invalid){$('routeStop'+index).setAttribute('aria-invalid','true');$('routeStop'+index+'Error').textContent=routeInputError();}});
  renderRouteAlternatives();renderRouteGoal();
  renderDetails();renderDirectoryGroups();
  if(!$('directory').hidden)renderDirectory();
  if(searchOpen&&$('search').value.trim()){
    renderSearch();
    if(selectedSearch){const index=activeSearchResults.findIndex(result=>result.id===selectedSearch.id&&result.kind===selectedSearch.kind);if(index>=0){searchIndex=index-1;moveSearchSelection(1);}}
  }
  for(const [id,node]of nodeElements)node.setAttribute('aria-label',worldNodeLabel(byId.get(id)));
  $('mapTooltip').hidden=true;
  if(route||$('routeResult').innerHTML)renderRouteResult();
  for(const id of ['routeFrom','routeTo'])if($(id).getAttribute('aria-invalid')==='true')$(id+'Error').textContent=routeInputError();
  renderAbout();renderHuntAbout();
  if(byId.has(sceneId)){
    const selected=selectedEntity,hadRerouteError=!!$('sceneNavError').textContent;
    $('sceneRegion').textContent=groupLabel(byId.get(sceneId));
    setSceneLayer(sceneLayer,sceneEntityIds);
    if(selected&&sceneLayer!=='portals')pickEntity(selected,false);
    renderSceneNavigation();
    if(hadRerouteError)$('sceneNavError').textContent=rerouteError();
    $('sceneImageMessage').textContent=$('sceneImageStatus').dataset.state==='error'?L('תמונת המפה לא נטענה. השערים והמיקומים עדיין זמינים ברשימה.','The map image could not load. Portals and locations are still available in the list.'):L('טוענים את תמונת המפה…','Loading map image…');
  }
  // Contextual modules must see the final rebuilt route even before a scene is opened.
  notifyView();
}
function renderLoadingError(){
  $('loading').innerHTML=`<div style="padding:30px;text-align:center;line-height:1.9">${L('המפה לא נטענה.','The atlas could not load.')}<br>${L('נסו לרענן את העמוד.','Try refreshing the page.')}<br><small>${L('אם פתחתם קובץ מקומי, השתמשו בקישור לאטלס.','If you opened a local file, use the online atlas link instead.')}</small></div>`;
}
function bindEvents(){
  window.addEventListener('atlas-languagechange',refreshLanguage);
  $('routeAddStop')?.addEventListener('click',()=>addStop());
  $('routeSwap')?.addEventListener('click',swapRouteEnds);
  $('routeStops')?.addEventListener('input',event=>{const index=Number(event.target.dataset.routeStop);if(Number.isInteger(index)&&index>=0&&index<routeStopValues.length){routeStopValues[index]=event.target.value;event.target.removeAttribute('aria-invalid');$('routeStop'+index+'Error').textContent='';}});
  $('routeStops')?.addEventListener('click',event=>{
    const remove=event.target.closest('[data-stop-remove]'),move=event.target.closest('[data-stop-move]');if(!remove&&!move)return;
    routeStopValues=readRouteStops();const index=Number((remove||move).dataset[remove?'stopRemove':'stopMove']);if(!Number.isInteger(index)||index<0||index>=routeStopValues.length)return;
    let focus=index;if(remove)routeStopValues.splice(index,1);else{const direction=Number(move.dataset.stopDirection),next=index+direction;if(![-1,1].includes(direction)||next<0||next>=routeStopValues.length)return;[routeStopValues[index],routeStopValues[next]]=[routeStopValues[next],routeStopValues[index]];focus=next;}
    renderRouteStops();($('routeStop'+Math.min(focus,routeStopValues.length-1))||$('routeAddStop'))?.focus();
  });
  $('routeAlternatives')?.addEventListener('click',event=>{const button=event.target.closest('[data-route-policy]');if(!button||!routeChoices)return;const key=button.dataset.routePolicy;if(!['ordinary','conditional'].includes(key)||!routeChoices[key])return;planJourney({...routeChoices.recipe,services:key==='conditional'});});
  $('routeGoal')?.addEventListener('click',event=>{if(event.target.id!=='routeClearGoal')return;pendingRouteGoal=null;pendingGoalDestination=null;if(route)delete route.goal;if(routeChoices){delete routeChoices.recipe.goal;for(const candidate of [routeChoices.ordinary,routeChoices.conditional])if(candidate)delete candidate.goal;}window.AtlasPersonal?.saveJourney();renderRouteGoal();renderSceneNavigation();});
  $('sceneNavBreadcrumb')?.addEventListener('click',event=>{const button=event.target.closest('[data-route-jump]');if(button)openRouteStep(Number(button.dataset.routeJump));});
  $('sceneNavStep')?.addEventListener('change',event=>openRouteStep(Number(event.target.value)));
  $('sceneNavGoal')?.addEventListener('click',event=>{if(event.target.id!=='sceneNavArrival'||!navigationActive()||!navigationFollowing||navigationIndex!==route.steps.length||!route.goal)return;const present=new Set((window.HuntData?.mapSpawns?.[route.to]?.points||[]).map(point=>point.mobId)),ids=route.goal.monsterIds.filter(id=>present.has(id));if(!ids.length)return;setCompactNavigation(false);setSceneLayer('monsters',ids);fitScene();notifyView();});
  $('sceneDialog').addEventListener('close',notifyView);
  $('search').addEventListener('input',renderSearch);$('search').addEventListener('focus',()=>{if($('search').value.trim())renderSearch();});$('search').addEventListener('keydown',handleSearchKey);
  $('searchResults').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)chooseSearch(b.dataset.id,b.dataset.kind);});document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))closeSearch();});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.activeElement.isContentEditable&&!document.querySelector('dialog[open]')){e.preventDefault();$('search').focus();}});
  document.querySelectorAll('.region-nav [data-region]').forEach(b=>b.addEventListener('click',()=>{currentRegion=b.dataset.region;document.querySelectorAll('.region-nav [data-region]').forEach(btn=>btn.classList.toggle('active',btn===b));updateVisibleNodes();fitWorld();$('directory').hidden=true;}));
  $('zoomIn').addEventListener('click',()=>zoomWorld(1.35));$('zoomOut').addEventListener('click',()=>zoomWorld(1/1.35));$('fitMap').addEventListener('click',fitWorld);$('labelsToggle').addEventListener('click',()=>{showAllLabels=!showAllLabels;$('labelsToggle').setAttribute('aria-pressed',String(showAllLabels));applyWorld();});
  $('directoryToggle').addEventListener('click',openDirectory);$('closeDirectory').addEventListener('click',()=>{$('directory').hidden=true;window.AtlasShell?.catalogClosed();});$('directorySearch').addEventListener('input',renderDirectory);$('directoryGroup').addEventListener('change',renderDirectory);$('directoryGrid').addEventListener('click',e=>{const card=e.target.closest('[data-id]');if(card){$('directory').hidden=true;window.AtlasShell?.catalogClosed({restoreFocus:false});selectMap(card.dataset.id,{focus:true});}});
  $('routeToggle').addEventListener('click',()=>{if($('routePanel').hidden)openRoute();else{$('routePanel').hidden=true;$('routeToggle').setAttribute('aria-pressed','false');}});$('closeRoute').addEventListener('click',()=>{$('routePanel').hidden=true;$('routeToggle').setAttribute('aria-pressed','false');});$('routeForm').addEventListener('submit',submitRoute);
  $('routeResult').addEventListener('click',e=>{if(e.target.id==='shareRoute'){window.AtlasPersonal?.share();return;}if(e.target.id==='restartRoute'){openRouteStep(0);return;}if(e.target.id==='startRoute'){openRouteStep(navigationActive()?navigationIndex:0);return;}const gate=e.target.closest('[data-route-scene]');if(gate){const index=gate.dataset.routeIndex!==undefined?Number(gate.dataset.routeIndex):route?.steps.findIndex((s,i)=>s.from===Number(gate.dataset.routeScene)&&navigationGate(i)?.key===gate.dataset.routeGate);openRouteStep(index);return;}const map=e.target.closest('[data-route-map]');if(map)selectMap(map.dataset.routeMap,{focus:true,scroll:false});if(e.target.id==='clearRoute'){window.AtlasRouteTools?.prefetch(null);route=null;navigationRoute=null;navigationIndex=0;routeChoices=null;pendingRouteGoal=null;pendingGoalDestination=null;renderRouteAlternatives();renderRouteGoal();window.AtlasPersonal?.saveJourney();renderSceneNavigation();drawRoute();$('routeResult').innerHTML='';$('routeRestoreNote').textContent='';$('routeShareBox').hidden=true;}});
  $('mapDetails').addEventListener('click',e=>{const tab=e.target.closest('[data-tab]');if(tab){detailsTab=tab.dataset.tab;renderPortalContent();return;}const b=e.target.closest('[data-action]');if(!b)return;const m=byId.get(activeId),p=m.portals.find(p=>p.key===b.dataset.gate);switch(b.dataset.action){case'favorite':window.AtlasPersonal?.toggle(m.id);break;case'open-scene':openScene(m.id);break;case'map-monsters':openSpawns(m.id);break;case'map-npcs':openNpcs(m.id);break;case'route-from':openRoute();$('routeFrom').value=mapLabel(m);$('routeTo').focus();break;case'route-to':{const old=routeMap($('routeFrom').value);openRoute();if(!old||old.id===m.id){const origin=defaultRouteOrigin();$('routeFrom').value=mapLabel(origin&&origin.id!==m.id?origin:byId.get(10001000)||maps[0]);}$('routeTo').value=mapLabel(m);$('routeFrom').focus();break;}case'portal-go':if(p?.kind==='cross')selectMap(p.to,{focus:true});else if(p)openScene(m.id,p.key);break;case'locate':if(p)openScene(m.id,p.key);break;case'incoming':selectMap(b.dataset.from,{focus:true});break;case'incoming-scene':openScene(Number(b.dataset.from),b.dataset.gate);break;case'service-target':if(b.dataset.target)selectMap(b.dataset.target,{focus:true});else toast(L("למעבר הזה אין יעד קבוע. הפרטים מופיעים בתנאי השירות.","This passage has no fixed destination. See its requirements for details."));break;}});
  $('sceneNavCompact').addEventListener('click',()=>setCompactNavigation(!compactNavigation));
  $('sceneNavReroute').addEventListener('click',rerouteFromScene);
  for(const id of ['routeFrom','routeTo'])$(id).addEventListener('input',()=>{$(id).removeAttribute('aria-invalid');$(id+'Error').textContent='';});
  $('sceneNavPrevious').addEventListener('click',()=>openRouteStep(navigationIndex-1));
  $('sceneNavNext').addEventListener('click',()=>openRouteStep(navigationIndex+1));
  $('sceneNavReturn').addEventListener('click',()=>openRouteStep(navigationIndex));
  $('sceneNavFocus').addEventListener('click',()=>{const gate=navigationGate();if(gate){sceneKind=displayKind(gate,byId.get(sceneId));setSceneLayer('portals',[]);pickGate(gate.key,true);}});
  $('closeScene').addEventListener('click',()=>$('sceneDialog').close());$('sceneFit').addEventListener('click',fitScene);$('sceneZoomIn').addEventListener('click',()=>zoomScene(1.4));$('sceneZoomOut').addEventListener('click',()=>zoomScene(1/1.4));document.querySelectorAll('#sceneFilters button').forEach(b=>b.addEventListener('click',()=>{sceneKind=b.dataset.kind;selectedGate=null;renderScenePins();renderSceneSidebar();}));
  $('scenePortalList').addEventListener('click',e=>{const entity=e.target.closest('[data-entity-key]');if(entity){pickEntity(entity.dataset.entityKey,true);return;}const b=e.target.closest('[data-gate]');if(b){if(e.target.closest('.portal-main'))travelScenePortal(b.dataset.gate);else pickGate(b.dataset.gate,true);}});$('sceneSelected').addEventListener('click',e=>{const b=e.target.closest('[data-scene-travel]');if(b)travelScenePortal(b.dataset.travelGate);});
  $('sceneLayers').addEventListener('click',e=>{const b=e.target.closest('[data-layer]');if(b)setSceneLayer(b.dataset.layer,[]);});
  $('sceneImageRetry').addEventListener('click',()=>loadSceneImage(true));
  $('sceneEntitySummary').addEventListener('click',e=>{if(e.target.id==='sceneShowAll')setSceneLayer(sceneLayer,[]);if(e.target.id==='sceneRetryCatalog'){$('sceneDialog').close();window.Hunt?.open('monster');}});
  window.addEventListener('hunt-unavailable',()=>{if($('sceneDialog').open&&sceneLayer==='monsters')setSceneLayer(sceneLayer,sceneEntityIds);});
  window.addEventListener('hunt-ready',()=>{const rerouteFailed=!!$('sceneNavError').textContent;renderDetails();if($('search').value)renderSearch();renderHuntAbout();renderRouteGoal();renderSceneNavigation();if(rerouteFailed)$('sceneNavError').textContent=rerouteError();if($('sceneDialog').open&&sceneLayer!=='portals')setSceneLayer(sceneLayer,sceneEntityIds);});
  const about=()=>{renderHuntAbout();$('aboutDialog').showModal();};$('aboutButton').addEventListener('click',about);$('coverageButton').addEventListener('click',about);$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());$('aboutDialog').addEventListener('click',e=>{if(e.target===$('aboutDialog')){const r=$('aboutDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('aboutDialog').close();}});
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();currentRegion='world';document.querySelectorAll('.region-nav [data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region==='world'));updateVisibleNodes();fitWorld();});
  enablePanZoom($('worldSvg'),'world');enablePanZoom($('sceneSvg'),'scene');let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{fitWorld();if($('sceneDialog').open)fitNavigationScene();},180);});window.addEventListener('hashchange',()=>{const id=location.hash.match(/map=(\d+)/);if(id)selectMap(Number(id[1]),{focus:true,hash:false});});
}
async function init(){
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[el.dataset.icon]||ICONS.pin}</svg>`);
  try{const response=await fetch('atlas-data.json');if(!response.ok)throw Error(`data ${response.status}`);atlas=await response.json();maps=atlas.maps;groups=atlas.groups;byId=new Map(maps.map(m=>[m.id,m]));incoming=new Map();adjacency=new Map();for(const m of maps){const out=[];for(const p of m.portals){if(p.kind==='cross'&&byId.has(p.to)){out.push({to:p.to,p});if(!incoming.has(p.to))incoming.set(p.to,[]);incoming.get(p.to).push({from:m,p});}}adjacency.set(m.id,out);}
    $('mapCount').textContent=maps.length;$('mapOptions').innerHTML=maps.map(m=>`<option value="${esc(mapLabel(m))}"></option>`).join('');renderDirectoryGroups();
    window.MapSearch?.init({maps,groupLabel,groupTerms:m=>{const g=groupId(m.group);return `${g?.he||''} ${g?.en||''} ${window.AtlasTranslations?.[g?.he]||''}`;}});
    buildWorld();renderAbout();renderRouteStops();bindEvents();const hash=location.hash.match(/map=(\d+)/);selectMap(hash&&byId.has(Number(hash[1]))?Number(hash[1]):10001000,{hash:false,scroll:false,reveal:!!hash,remember:!!hash});$('loading').hidden=true;requestAnimationFrame(()=>{fitWorld();if(hash)centerOnMap(byId.get(activeId));});
    window.Atlas={get data(){return atlas},findRoute,reachable,selectMap,openScene,openSpawns,openNpcs,planTo,planJourney,getJourney,addStop,swapRouteEnds,openRoute,openRouteStep,setCompactNavigation,zoomScene,fitScene,getContext,describeMap,get activeMap(){return activeId},get currentRoute(){return route},fitWorld};
    window.AtlasPersonal?.init({maps:byId,version:`${atlas.meta.version||''}:${atlas.meta.asOf}`,escape:esc,notice:toast,
      getRoute:()=>route,getStep:()=>navigationActive()?navigationIndex:0,getServices:()=>routeUsesServices,
      refresh:renderDetails,select:id=>selectMap(id,{focus:true}),
      restore:saved=>planJourney(saved,{persist:false,restoreStep:false}),
      resume:(index,show)=>openRouteStep(index,{show})});
    window.dispatchEvent(new Event('atlas-ready'));
  }catch(error){renderLoadingError();window.addEventListener('atlas-languagechange',renderLoadingError);console.error('Atlas loading failed',error);}
}
init();
