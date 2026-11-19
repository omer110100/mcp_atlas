(function huntModule() {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const en = v => `<bdi dir="ltr" lang="en">${esc(v)}</bdi>`;
  const norm = v => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const fmt = n => Number(n).toLocaleString('he-IL');
  const pct = n => `${Number(n).toLocaleString('he-IL', {maximumFractionDigits:1})}%`;
  const labels = {item:'פריטים', monster:'מפלצות', boss:'בוסים', npc:'דמויות'};
  const singular = {item:'פריט', monster:'מפלצת', boss:'בוס', npc:'דמות'};
  const state = {tab:'item', query:'', selected:null, originId:null, rank:'points', targets:null, limit:72, documented:false};
  const routeCache = new Map();
  let data = null, dropData = {links:[],meta:{}}, loading = null, visible = false, index = [];
  let itemsById = new Map(), mobsById = new Map(), npcsById = new Map(), dropsByItem = new Map();
  const safeUrl = u => {
    if (!u) return '';
    try { const url = new URL(u, location.href); return ['http:','https:'].includes(url.protocol) ? String(u) : ''; }
    catch { return ''; }
  };
  const iconImage = (entry, cls='') => entry?.icon || entry?.originalIcon
    ? `<img class="hunt-icon ${cls}" src="${esc(safeUrl(entry.icon || entry.originalIcon))}" data-fallback="${esc(safeUrl(entry.originalIcon))}" alt="" loading="lazy">`
    : '<span class="hunt-icon hunt-empty-icon" aria-hidden="true">✦</span>';
  const atlasMaps = () => window.Atlas?.data?.maps || window.Atlas?.maps || [];
  const getMap = id => atlasMaps().find(m => Number(m.id) === Number(id));
  const mapLabel = m => `${m.name} [${m.id}]`;
  const activeMapId = () => Number(window.Atlas?.activeMap?.id ?? window.Atlas?.activeMap);
  const defaultOrigin = () => getMap(activeMapId())?.id ?? getMap(10001000)?.id ?? atlasMaps()[0]?.id ?? null;
  const entityFor = (kind,id) => (kind === 'item' ? itemsById : kind === 'npc' ? npcsById : mobsById).get(Number(id));

  function ensurePanel() {
    if ($('huntPanel')) return $('huntPanel');
    const host = document.querySelector('.world-pane');
    if (!host) return null;
    const panel = document.createElement('section');
    panel.id = 'huntPanel'; panel.className = 'hunt-panel'; panel.hidden = true;
    panel.setAttribute('aria-label','חיפוש פריטים, מפלצות, בוסים ודמויות');
    panel.innerHTML = `<header class="hunt-header"><div><span class="hunt-eyebrow">כל חיפוש מתחיל ברמז</span><h2>יוצאים לגלות</h2></div><button type="button" data-hunt-action="close" class="hunt-close" aria-label="סגירת החיפוש">×</button></header>
      <nav class="hunt-tabs" aria-label="מה מחפשים?">${Object.entries(labels).map(([k,v])=>`<button type="button" data-hunt-tab="${k}" aria-pressed="${k===state.tab}">${v}</button>`).join('')}</nav>
      <div class="hunt-search-row"><label class="hunt-search-field"><span class="hunt-sr-only">חיפוש בקטלוג</span><input id="huntSearch" type="search" autocomplete="off" placeholder="שם פריט או מזהה…" aria-controls="huntBody" dir="auto"></label></div>
      <div id="huntBody" class="hunt-body" aria-live="polite"></div>`;
    host.appendChild(panel);
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('change', onPanelChange);
    panel.addEventListener('input', e => {
      if (e.target.id !== 'huntSearch') return;
      state.query = e.target.value; state.selected = null; state.limit = 72; render(); $('huntBody').scrollTop = 0;
    });
    panel.addEventListener('error', e => {
      if (e.target.tagName !== 'IMG') return;
      const fallback = e.target.dataset.fallback;
      if (fallback && e.target.getAttribute('src') !== fallback) {e.target.src = fallback; delete e.target.dataset.fallback;}
      else {e.target.classList.add('hunt-icon-unavailable'); e.target.removeAttribute('src');}
    }, true);
    return panel;
  }

  function show() {
    const panel = ensurePanel(); if (!panel) return;
    visible = true; panel.hidden = false;
    $('huntToggle')?.setAttribute('aria-expanded','true');
    if (state.originId == null) state.originId = defaultOrigin();
    if (!data) boot();
    render();
  }
  function close() {
    visible = false; const p = $('huntPanel'); if (p) p.hidden = true;
    $('huntToggle')?.setAttribute('aria-expanded','false');
  }
  function open(kind,id) {
    if (!Object.hasOwn(labels,kind)) return;
    if (kind !== state.tab) state.query = '';
    state.tab = kind;
    state.selected = id == null ? null : {kind,id:Number(id)};
    state.targets = null; state.rank = 'points'; state.limit = 72;
    show();
    if ($('huntBody')) $('huntBody').scrollTop = 0;
    if (!state.selected) $('huntSearch')?.focus();
  }

  async function boot() {
    if (data || loading || !window.Atlas) return loading;
    loading = (async () => {
      try {
        const responses = await Promise.allSettled([
          fetch('hunt-data.json').then(r=>{if(!r.ok)throw new Error('hunt-data');return r.json();}),
          fetch('drop-data.json').then(r=>r.ok?r.json():{links:[],meta:{}})
        ]);
        if (responses[0].status !== 'fulfilled') throw responses[0].reason;
        data = responses[0].value;
        dropData = responses[1].status === 'fulfilled' ? responses[1].value : {links:[],meta:{}};
        data.items ||= []; data.monsters ||= []; data.npcs ||= []; data.mapSpawns ||= {};
        itemsById = new Map(data.items.map(x=>[Number(x.id),x]));
        mobsById = new Map(data.monsters.map(x=>[Number(x.id),x]));
        npcsById = new Map(data.npcs.map(x=>[Number(x.id),x]));
        dropsByItem = new Map();
        for (const link of dropData.links || []) {
          if (!itemsById.has(Number(link.itemId)) || !mobsById.has(Number(link.mobId))) continue;
          const itemId = Number(link.itemId);
          if (!dropsByItem.has(itemId)) dropsByItem.set(itemId,[]);
          dropsByItem.get(itemId).push(link);
        }
        index = [
          ...data.items.map(x=>({...x,kind:'item'})),
          ...data.monsters.map(x=>({...x,kind:x.isBoss?'boss':'monster'})),
          ...data.npcs.map(x=>({...x,kind:'npc'}))
        ].map(x=>({...x,searchText:norm(`${x.name} ${x.id}`)}));
        data.dropData = dropData; window.HuntData = data;
        window.dispatchEvent(new CustomEvent('hunt-ready',{detail:data}));
        if (visible) render();
      } catch (error) {
        if ($('huntBody')) $('huntBody').innerHTML = '<p class="hunt-note">הקטלוג לא נטען. אפשר לנסות שוב.</p><button type="button" class="button quiet" data-hunt-action="retry">טעינה מחדש</button>';
        console.error('Hunt catalogue loading failed',error);
      } finally { loading = null; }
    })();
    return loading;
  }

  function searchAll(q) {
    const query = norm(q); if (!data || !query) return [];
    const tokens = query.split(/\s+/);
    return index.filter(e=>tokens.every(t=>e.searchText.includes(t)))
      .sort((a,b)=>matchScore(b,query)-matchScore(a,query)||a.name.localeCompare(b.name)||a.id-b.id)
      .map(({kind,id,name,icon,originalIcon})=>({kind,id,name,icon,originalIcon}));
  }
  function matchScore(e,q) {return norm(e.name)===q?5:String(e.id)===q?4:norm(e.name).startsWith(q)?3:1;}
  function render() {
    const panel = ensurePanel(); if (!panel || !visible) return;
    panel.querySelectorAll('[data-hunt-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.huntTab===state.tab)));
    $('huntSearch').placeholder = `שם ${singular[state.tab]} או מזהה…`;
    if ($('huntSearch').value !== state.query) $('huntSearch').value = state.query;
    if (!data) {$('huntBody').innerHTML='<div class="hunt-loading"><span class="loading-orb"></span>אוספים את הרמזים…</div>'; return;}
    if (state.selected) renderDetail(); else renderCatalog();
  }
  function renderCatalog() {
    const query = norm(state.query), tokens = query.split(/\s+/).filter(Boolean);
    let records = index.filter(e=>e.kind===state.tab && tokens.every(t=>e.searchText.includes(t)));
    if (state.tab==='item' && state.documented) records=records.filter(e=>dropsByItem.has(Number(e.id))||hasUnresolved(e.id));
    records.sort((a,b)=> query ? matchScore(b,query)-matchScore(a,query)||a.name.localeCompare(b.name)||a.id-b.id
      : (state.tab==='item' ? Number(dropsByItem.has(b.id)||hasUnresolved(b.id))-Number(dropsByItem.has(a.id)||hasUnresolved(a.id)) : state.tab==='boss' ? Number(b.hasRecordedSpawn)-Number(a.hasRecordedSpawn):0) || a.name.localeCompare(b.name)||a.id-b.id);
    const count = records.length, list = records.slice(0,state.limit);
    $('huntBody').innerHTML = `<div class="hunt-catalog-meta"><span>${fmt(count)} ${count===1?singular[state.tab]:labels[state.tab]}</span>${state.tab==='item'?`<label><input type="checkbox" id="huntDocumented" ${state.documented?'checked':''}>עם תיעוד נפילה במקורות</label>`:''}</div>
      ${state.tab==='item'?`<p class="hunt-note">${esc(dropData.meta?.coverageNoteHe || 'תיעוד נפילת הפריטים מבוסס על דיווחים קהילתיים חלקיים. היעדר תיעוד אינו מוכיח שהפריט אינו נופל.')}</p>`:''}
      ${state.tab==='boss'?'<p class="hunt-note">גרסאות בוס בעלות אותו שם נשמרות בנפרד לפי מזהה. מופיעה כאן גם רשומה שלא תועדה עבורה מפת הופעה.</p>':''}
      <div class="hunt-catalog">${list.map(e=>`<button type="button" class="hunt-entity-card" data-hunt-open="${e.kind}" data-id="${e.id}">${iconImage(e)}<span class="hunt-entity-copy">${en(e.name)}<small>מזהה ${e.id}${e.level!=null?` · רמה ${e.level}`:''}</small><span class="hunt-entity-state">${e.kind==='item'?(dropsByItem.has(e.id)?'יש תיעוד נפילה':hasUnresolved(e.id)?'יש דיווח; גרסת המפלצת לא זוהתה':'תיעוד נפילה לא נמצא'):e.kind==='npc'?'מיקומים וניווט':e.hasRecordedSpawn?'מפת הופעה מתועדת':'ללא מפת הופעה מתועדת'}</span></span></button>`).join('')}</div>
      ${!count?'<p class="hunt-empty">לא נמצאה התאמה. אפשר לחפש חלק מהשם באנגלית או מזהה מספרי.</p>':''}
      ${count>state.limit?`<button type="button" class="button quiet hunt-more" data-hunt-action="more">הצגת תוצאות נוספות · ${fmt(count-state.limit)} נותרו</button>`:''}`;
  }
  function entityHeading(entry,kind) {
    return `<button type="button" class="hunt-back" data-hunt-action="catalog">חזרה לחיפוש</button>
      <div class="hunt-entity-heading">${iconImage(entry,'hunt-icon-large')}<div><span class="hunt-eyebrow">${singular[kind]}</span><h3>${en(entry.name)}</h3><p>מזהה ${entry.id}${entry.level!=null?` · רמה ${entry.level}`:''}</p></div></div>`;
  }
  function originControls(withRank=true) {
    const m=getMap(state.originId);
    return `<div class="hunt-controls"><label>מאיפה יוצאים?<input id="huntOrigin" list="mapOptions" value="${esc(m?mapLabel(m):'')}" autocomplete="off" dir="ltr" placeholder="שם מפה או מזהה"></label><button type="button" class="button quiet" data-hunt-action="origin-active">מהמקום הנבחר</button>${withRank?`<label>סדר המפות<select id="huntRank"><option value="points" ${state.rank==='points'?'selected':''}>מספר נקודות היעד</option><option value="share" ${state.rank==='share'?'selected':''}>חלק מנקודות ההופעה</option><option value="distance" ${state.rank==='distance'?'selected':''}>מסלול ההליכה הקצר ביותר</option></select></label>`:''}</div><p id="huntOriginNote" class="hunt-note" ${m?'hidden':''}>בחרו מפת מוצא מהרשימה כדי להשוות מסלולים.</p>`;
  }
  function hasUnresolved(id) { return (dropData.unresolved||[]).some(l=>Number(l.itemId)===Number(id)); }
  function walkDistanceText(distance) { return distance==null?'לא נמצא מסלול הליכה מהמוצא':distance===0?'זו מפת המוצא':distance===1?'מעבר מפה אחד בהליכה':`${fmt(distance)} מעברי מפה בהליכה`; }
  function renderDetail() {
    const {kind,id}=state.selected, entry=entityFor(kind,id);
    if (!entry) {$('huntBody').innerHTML='<button class="hunt-back" data-hunt-action="catalog">חזרה לחיפוש</button><p class="hunt-empty">הרשומה הזו אינה מופיעה בקטלוג שנטען.</p>'; return;}
    if(kind==='npc'){renderNpc(entry);return;}
    let targets=[id], lead='';
    if(kind==='item'){
      const links=dropsByItem.get(id)||[];
      if(!links.length){
        const unresolved=(dropData.unresolved||[]).filter(l=>Number(l.itemId)===id);
        $('huntBody').innerHTML=entityHeading(entry,kind)+(unresolved.length?`<p class="hunt-empty">דיווח קלאסיק קיים, אך לא הוכרע לאיזו גרסת מפלצת הוא שייך; אין יעד ניווט מאומת.</p>${unresolved.map(l=>`<div class="hunt-drop-card">${en(l.mobName)}<p class="hunt-note">${esc(statusLabel(l.status))}</p>${sourceLink(l.sourceUrl,'מקור הדיווח')}</div>`).join('')}${dropAttribution()}`:`<p class="hunt-empty">אין במקורות שנכללו תיעוד נפילה לפריט הזה; אין להסיק שאינו נופל.</p><p class="hunt-note">${esc(dropData.meta?.coverageNoteHe || '')}</p>`)+sourceLink(entry.sourceUrl,'הפריט במאגר המקור');return;
      }
      const ids=[...new Set(links.map(l=>Number(l.mobId)))];
      if(state.targets===null)state.targets=new Set(ids);
      targets=ids.filter(n=>state.targets.has(n));
      lead=`<h4 class="hunt-section-title">המפלצות שהפריט תועד אצלן</h4><p class="hunt-note">בחרו מפלצת אחת או כמה. דירוג המפות מתייחס לנקודות ההופעה של כל המפלצות שסומנו.</p><div class="hunt-drop-monsters">${ids.map(mid=>{
        const mob=mobsById.get(mid), observations=links.filter(l=>Number(l.mobId)===mid);
        return `<div class="hunt-drop-card"><label class="hunt-target-label"><input type="checkbox" data-hunt-target="${mid}" ${state.targets.has(mid)?'checked':''}>${iconImage(mob)}<span>${en(mob.name)}<small>רמה ${mob.level ?? 'לא ידועה'} · מזהה ${mid}</small></span></label>
          ${observations.map(l=>`<div class="hunt-provenance"><span>${esc(statusLabel(l.status))}</span>${sourceLink(l.sourceUrl,'מקור התצפית')}${l.condition?`<p class="hunt-condition" dir="auto">${esc(l.condition)}</p>`:''}</div>`).join('')}
          <button class="hunt-text-button" type="button" data-hunt-open="${mob.isBoss?'boss':'monster'}" data-id="${mid}">כל המידע על המפלצת</button></div>`;
      }).join('')}</div><p class="hunt-note">${esc(dropData.meta?.coverageNoteHe || 'דיווחים קהילתיים חלקיים; אין כאן אחוזי נפילת פריט.')}</p>`;
    }else{
      lead=`<div class="hunt-creature-stats"><span>חיים <strong>${fmt(entry.hp||0)}</strong></span><span>ניסיון <strong>${fmt(entry.exp||0)}</strong></span></div>`;
      if(kind==='boss')lead+='<p class="hunt-note hunt-gold-note">הסימון מציין נקודת הופעה רשומה. הבוס עשוי לנוע ממנה, והוא אינו בהכרח נמצא כרגע במפה.</p>';
    }
    const candidates=buildCandidates(targets), ranked=sortCandidates(candidates), normal=ranked.find(c=>!['event','system','unavailable'].includes(c.map.scope));
    const recommendation=state.rank==='points'?normal?.map.id:null;
    $('huntBody').innerHTML=entityHeading(entry,kind)+lead+originControls(true)+
      `<div class="hunt-results-heading"><h4>${ranked.length===1?'מפה אחת עם נקודות יעד מתועדות':`${fmt(ranked.length)} מפות עם נקודות יעד מתועדות`}</h4></div>
      <p class="hunt-note">האחוז הוא חלק מנקודות ההופעה במפה. הוא אינו סיכוי לנפילת פריט, תדירות הופעה או מספר המפלצות החיות כרגע. הדירוג אינו אומדן לפריטים בשעה.</p>
      ${!ranked.length?`<p class="hunt-empty">${targets.length?'אין במאגר מפת הופעה מתועדת למזהה הזה. אין להסיק מכך שהמפלצת או הבוס אינם במשחק.':'סמנו לפחות מפלצת אחת כדי להציג מפות.'}</p>`:''}
      <div class="hunt-candidates">${ranked.map((c,i)=>candidateCard(c,i,recommendation,kind==='boss')).join('')}</div>
      ${kind!=='item'?rewardLinks(id):''}
      <details class="hunt-explainer"><summary>איך נקבע סדר המפות?</summary><p>המיון הראשי משתמש במספר נקודות ההופעה המתועדות של היעד. בשוויון משווים את חלקן מכל נקודות המפה, ואחריו את מספר מעברי ההליכה מהמוצא. אפשר לבחור מיון אחר.</p><p>מספר נקודות אינו קיבולת. תקרת המפלצות היא אומדן לשחקן יחיד ומשותפת לכל סוגי המפלצות במפה. תזמוני שרת, שחקנים נוספים ותנאי משימות עשויים לשנות את המצב בפועל.</p><p>המרחק מוצג במספר מעברי מפה דרך קישורי הליכה מתועדים, ולא בזמן. ייתכן שנדרש שירות נסיעה או תנאי כניסה שאינם נכללים במסלול ההליכה.</p></details>
      ${sourceLink(entry.sourceUrl,'הרשומה במאגר המקור')}${kind==='item'?dropAttribution():''}`;
  }
  function sourceLink(url,label) {const u=safeUrl(url);return u?`<a class="hunt-source-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';}
  function statusLabel(status) {return ({classic_counted:'תצפית קלאסיק עם ספירה במקור',classic_confirmed:'מסומן כמאומת בקלאסיק במקור',team_seen:'נצפה בידי צוות המקור'})[status]||'תיעוד במקור הקהילתי';}
  function dropAttribution(){return `<details class="hunt-explainer hunt-credits"><summary>מקורות תיעוד הנפילות</summary><p>${esc(dropData.meta?.historicalVersionNoteHe||'')}</p><p dir="ltr" lang="en">${esc(dropData.meta?.attribution||'')}</p>${sourceLink(dropData.meta?.licenseUrl,'רישיון נתוני התצפיות')}</details>`;}
  function rewardLinks(mobId) {
    const found=[...new Set((dropData.links||[]).filter(l=>Number(l.mobId)===mobId).map(l=>Number(l.itemId)))].map(id=>itemsById.get(id)).filter(Boolean);
    if(!found.length)return '';
    return `<details class="hunt-explainer"><summary>${found.length===1?'פריט אחד עם תיעוד נפילה ממפלצת זו':`${fmt(found.length)} פריטים עם תיעוד נפילה ממפלצת זו`}</summary><div class="hunt-rewards">${found.map(item=>`<button class="hunt-reward" type="button" data-hunt-open="item" data-id="${item.id}">${iconImage(item)}${en(item.name)}</button>`).join('')}</div></details>`;
  }
  function distanceTo(mapId) {
    if(!getMap(state.originId))return null;
    const key=`${state.originId}:${mapId}`; if(routeCache.has(key))return routeCache.get(key);
    let result=null;
    try {const r=window.Atlas?.findRoute(Number(state.originId),Number(mapId),false); if(r)result=Array.isArray(r)?r.length:r.steps?.length??null;} catch {}
    routeCache.set(key,result);return result;
  }
  function buildCandidates(targetIds) {
    const wanted=new Set(targetIds.map(Number)), out=[];
    for(const [mapId,spawn] of Object.entries(data.mapSpawns)){
      const map=getMap(mapId);if(!map)continue;
      const points=(spawn.points||[]).filter(p=>wanted.has(Number(p.mobId)));
      const count=points.length;
      if(!count)continue;
      const total=Number(spawn.totalPoints ?? (spawn.points||[]).length);
      out.push({map,points,count,total,share:total?count/total*100:0,capacity:spawn.capacity,ids:[...new Set(points.map(p=>Number(p.mobId)))],distance:distanceTo(map.id)});
    }return out;
  }
  const byDistance=(a,b)=>a.distance===b.distance?0:a.distance==null?1:b.distance==null?-1:a.distance-b.distance;
  function sortCandidates(list) {
    return list.slice().sort((a,b)=>{
      const point=b.count-a.count, share=b.share-a.share, travel=byDistance(a,b);
      return (state.rank==='share'?share||point||travel:state.rank==='distance'?travel||point||share:point||share||travel)||a.map.name.localeCompare(b.map.name)||a.map.id-b.map.id;
    });
  }
  function scopeNote(map) {
    return ({event:'מפת אירוע; זמינות נוכחית אינה מאומתת',system:'רשומת מערכת; נגישות לשחקן אינה מאומתת',unavailable:'דרך הכניסה אינה מאומתת',conditional:'כניסה מותנית במשימה או בשירות'})[map.scope]||'';
  }
  function candidateCard(c,i,recommended,boss=false) {
    const note=scopeNote(c.map);
    return `<article class="hunt-map-card ${c.map.id===recommended?'hunt-recommended':''}"><div class="hunt-map-top"><span class="hunt-rank-number">${i+1}</span><div>${c.map.id===recommended?'<span class="hunt-recommend-label">מומלץ לפי נקודות ההופעה</span>':''}<button type="button" class="hunt-map-name" data-hunt-action="map" data-map="${c.map.id}">${en(c.map.name)}</button><small>מזהה מפה ${c.map.id}</small></div></div>
      <div class="hunt-map-stats"><span><strong>${fmt(c.count)}</strong>${c.count===1?'נקודת יעד':'נקודות יעד'}</span><span><strong>${pct(c.share)}</strong>חלק מנקודות ההופעה</span><span><strong>${fmt(c.total)}</strong>${c.total===1?'נקודה במפה':'נקודות במפה'}</span></div>
      <div class="hunt-map-meta"><p>${c.capacity!=null?`תקרת מפלצות משוערת לשחקן יחיד: ${fmt(c.capacity)}`:'תקרת מפלצות: לא פורסמה במקור'}</p><p>${walkDistanceText(c.distance)}</p>${note?`<p class="hunt-condition">${esc(note)}</p>`:''}</div>
      ${boss?`<div class="hunt-boss-points"><span>נקודת הופעה רשומה בתמונת המקור</span>${c.points.map(p=>`<bdi dir="ltr">x ${p.x} · y ${p.y}</bdi>`).join('')}</div>`:''}
      <div class="hunt-map-actions"><button type="button" class="button primary" data-hunt-action="positions" data-map="${c.map.id}" data-mobs="${c.ids.join(',')}">${boss?'הצגת נקודת הבוס':'הצגת נקודות ההופעה'}</button><button type="button" class="button quiet" data-hunt-action="route" data-map="${c.map.id}">תכנון מסלול</button></div></article>`;
  }
  function npcLocations(npc) {
    const found=new Map();
    for(const map of atlasMaps()){
      const points=(map.npcs||[]).filter(n=>Number(n.id ?? n.npcId)===Number(npc.id));
      if(points.length)found.set(Number(map.id),{map,points,distance:distanceTo(map.id)});
    }
    for(const item of npc.maps||npc.locations||[]){
      const mid=Number(typeof item==='object' ? item.mapId ?? item.map_id ?? item.id : item);
      if(!Number.isFinite(mid)||found.has(mid))continue;
      const map=getMap(mid)||{id:mid,name:`Unknown map ${mid}`,scope:'unavailable'};
      const points=typeof item==='object'?(item.points||item.positions||[]):[];
      found.set(mid,{map,points,distance:getMap(mid)?distanceTo(mid):null});
    }
    return [...found.values()].sort((a,b)=>byDistance(a,b)||a.map.name.localeCompare(b.map.name)||a.map.id-b.map.id);
  }
  function renderNpc(npc) {
    const places=npcLocations(npc);
    $('huntBody').innerHTML=entityHeading(npc,'npc')+originControls(false)+`<div class="hunt-results-heading"><h4>${places.length===1?'מפה אחת מתועדת לדמות הזו':`${fmt(places.length)} מפות מתועדות לדמות הזו`}</h4></div><p class="hunt-note">כל המיקומים שייכים למזהה הדמות שנבחר. דמויות בעלות אותו שם נשמרות בנפרד.</p>
      ${!places.length?'<p class="hunt-empty">אין במאגר מפת מיקום מתועדת לדמות הזו. אין להסיק מכך שהיא אינה במשחק.</p>':''}
      <div class="hunt-candidates">${places.map(({map,points,distance},i)=>`<article class="hunt-map-card"><div class="hunt-map-top"><span class="hunt-rank-number">${i+1}</span><div><button type="button" class="hunt-map-name" data-hunt-action="map" data-map="${map.id}" ${getMap(map.id)?'':'disabled'}>${en(map.name)}</button><small>מזהה מפה ${map.id}</small></div></div><div class="hunt-map-meta"><p>${points.length===1?'נקודת מיקום מתועדת אחת במפה':points.length?`${fmt(points.length)} נקודות מיקום מתועדות במפה`:'המפה רשומה במקור, אך אין בה קואורדינטות מתועדות לדמות.'}</p><p>${walkDistanceText(distance)}</p>${scopeNote(map)?`<p class="hunt-condition">${esc(scopeNote(map))}</p>`:''}</div><div class="hunt-map-actions"><button type="button" class="button primary" data-hunt-action="npc-positions" data-map="${map.id}" data-npc="${npc.id}" ${points.length&&getMap(map.id)?'':'disabled'}>הצגת מיקום הדמות</button><button type="button" class="button quiet" data-hunt-action="route" data-map="${map.id}" ${getMap(map.id)?'':'disabled'}>תכנון מסלול</button></div></article>`).join('')}</div>${sourceLink(npc.sourceUrl,'הדמות במאגר המקור')}`;
  }
  function parseOrigin(value) {
    const id=value.match(/\[(\d+)\]\s*$/);
    if(id)return getMap(Number(id[1]));
    const q=norm(value), found=atlasMaps().filter(m=>norm(m.name)===q||String(m.id)===q);
    return found.length===1?found[0]:null;
  }
  function onPanelChange(e) {
    if(e.target.id==='huntDocumented'){state.documented=e.target.checked;state.limit=72;renderCatalog();}
    if(e.target.id==='huntRank'){state.rank=e.target.value;renderDetail();}
    if(e.target.id==='huntOrigin'){state.originId=parseOrigin(e.target.value)?.id??null;renderDetail();}
    if(e.target.matches('[data-hunt-target]')){
      const id=Number(e.target.dataset.huntTarget);if(e.target.checked)state.targets.add(id);else state.targets.delete(id);renderDetail();
    }
  }
  function onPanelClick(e) {
    const tab=e.target.closest('[data-hunt-tab]');
    if(tab){state.tab=tab.dataset.huntTab;state.selected=null;state.query='';state.limit=72;render();$('huntBody').scrollTop=0;$('huntSearch')?.focus();return;}
    const entry=e.target.closest('[data-hunt-open]');
    if(entry){open(entry.dataset.huntOpen,entry.dataset.id);$('huntBody').scrollTop=0;return;}
    const button=e.target.closest('[data-hunt-action]');if(!button)return;
    const mid=Number(button.dataset.map);
    switch(button.dataset.huntAction){
      case'close':close();break;
      case'catalog':state.selected=null;render();$('huntBody').scrollTop=0;break;
      case'more':state.limit+=72;renderCatalog();break;
      case'retry':boot();break;
      case'origin-active':state.originId=defaultOrigin();renderDetail();break;
      case'map':window.Atlas?.selectMap(mid,{focus:true});close();break;
      case'route':
        if(!getMap(state.originId)){$('huntOrigin')?.focus();$('huntOriginNote').hidden=false;return;}
        close();window.Atlas?.planTo(mid,Number(state.originId));break;
      case'positions':window.Atlas?.openSpawns(mid,button.dataset.mobs.split(',').map(Number));break;
      case'npc-positions':window.Atlas?.openNpcs(mid,[Number(button.dataset.npc)]);break;
    }
  }
  window.Hunt={searchAll,open,close,get data(){return data;},get drops(){return dropData;},get dropData(){return dropData;}};
  window.addEventListener('atlas-ready',()=>boot());
  document.addEventListener('click',e=>{if(e.target.closest('#huntToggle')){if(visible)close();else open(state.tab,state.selected?.id);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&visible&&!document.querySelector('dialog[open]'))close();});
  if(window.Atlas)boot();
})();
