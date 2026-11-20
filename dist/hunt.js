(function huntModule() {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const en = v => `<bdi dir="ltr" lang="en">${esc(v)}</bdi>`;
  const norm = v => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const L = (he, english) => window.AtlasI18n?.text?.(he, english) ?? he;
  const D = value => window.AtlasI18n?.data?.(value) ?? value;
  const fmt = n => Number(n).toLocaleString(window.AtlasI18n?.locale || 'he-IL');
  const pct = n => `${Number(n).toLocaleString(window.AtlasI18n?.locale || 'he-IL', {maximumFractionDigits:1})}%`;
  const labels = {get item(){return L('פריטים','Items');}, get monster(){return L('מפלצות','Monsters');}, get boss(){return L('בוסים','Bosses');}, get npc(){return L('דמויות','NPCs');}};
  const singular = {get item(){return L('פריט','item');}, get monster(){return L('מפלצת','monster');}, get boss(){return L('בוס','boss');}, get npc(){return L('דמות','NPC');}};
  const state = {tab:'item', query:'', selected:null, originId:null, originText:null, rank:'points', targets:null, limit:72, documented:false, compare:[], compareOpen:false, basket:[], basketOpen:false, levelMin:'', levelMax:'', creatureType:'regular'};
  const MAX_BASKET=8, RESULTS_PER_PAGE=6;
  Object.assign(state,{detailTab:'maps',resultPage:0,resultQuery:''});
  const routeCache = new Map();
  let data = null, dropData = {links:[],meta:{}}, loading = null, visible = false, index = [];
  let catalogFailed = false, dropFailed = false, dropLoading = false, opener = null, pendingDetailFocus = false;
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
  const defaultOrigin = () => getMap(window.AtlasExplorer?.getCurrentMap?.())?.id ?? getMap(activeMapId())?.id ?? getMap(10001000)?.id ?? atlasMaps()[0]?.id ?? null;
  const savedOrigin = () => getMap(window.AtlasPersonal?.getOrigin?.())?.id ?? null;
  const entityFor = (kind,id) => (kind === 'item' ? itemsById : kind === 'npc' ? npcsById : mobsById).get(Number(id));

  function ensurePanel() {
    if ($('huntPanel')) return $('huntPanel');
    const host = document.querySelector('.world-pane');
    if (!host) return null;
    const panel = document.createElement('section');
    panel.id = 'huntPanel'; panel.className = 'hunt-panel'; panel.hidden = true;
    panel.setAttribute('aria-label',L('חיפוש פריטים, מפלצות, בוסים ודמויות','Search items, monsters, bosses and NPCs'));
    panel.innerHTML = `<header class="hunt-header"><div><span id="huntEyebrow" class="hunt-eyebrow">${L('כל חיפוש מתחיל ברמז','Every search starts with a clue')}</span><h2 id="huntTitle">${L('יוצאים לגלות','Set out to discover')}</h2></div><button type="button" data-hunt-action="close" class="hunt-close" aria-label="${L('סגירת החיפוש','Close search')}">×</button></header>
      <nav class="hunt-tabs" aria-label="${L('מה מחפשים?','What are you looking for?')}">${Object.entries(labels).map(([k,v])=>`<button type="button" data-hunt-tab="${k}" aria-pressed="${k===state.tab}">${v}</button>`).join('')}</nav>
      <div class="hunt-search-row"><label class="hunt-search-field"><span id="huntSearchLabel" class="hunt-sr-only">${L('חיפוש בקטלוג','Search the catalogue')}</span><input id="huntSearch" type="search" maxlength="200" autocomplete="off" placeholder="${L('שם פריט או מזהה…','Item name or ID…')}" aria-controls="huntBody" dir="auto"></label></div>
      <div id="huntBasketBar" class="hunt-basket-bar"></div><div id="huntAnnouncement" class="hunt-sr-only" role="status" aria-live="polite" aria-atomic="true"></div><div id="huntBody" class="hunt-body"></div>`;
    host.appendChild(panel);
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('change', onPanelChange);
    panel.addEventListener('input', onPanelInput);
    panel.addEventListener('keydown', onDetailKeydown);
    panel.addEventListener('error', e => {
      if (e.target.tagName !== 'IMG') return;
      const fallback = e.target.dataset.fallback;
      if (fallback && e.target.getAttribute('src') !== fallback) {e.target.src = fallback; delete e.target.dataset.fallback;}
      else {e.target.classList.add('hunt-icon-unavailable'); e.target.removeAttribute('src');}
    }, true);
    return panel;
  }

  function refreshPanelLanguage(panel) {
    panel.setAttribute('aria-label',L('חיפוש פריטים, מפלצות, בוסים ודמויות','Search items, monsters, bosses and NPCs'));
    if ($('huntEyebrow')) $('huntEyebrow').textContent=L('כל חיפוש מתחיל ברמז','Every search starts with a clue');
    if ($('huntTitle')) $('huntTitle').textContent=L('יוצאים לגלות','Set out to discover');
    if ($('huntSearchLabel')) $('huntSearchLabel').textContent=L('חיפוש בקטלוג','Search the catalogue');
    panel.querySelector('.hunt-close')?.setAttribute('aria-label',L('סגירת החיפוש','Close search'));
    panel.querySelector('.hunt-tabs')?.setAttribute('aria-label',L('מה מחפשים?','What are you looking for?'));
    panel.querySelectorAll('[data-hunt-tab]').forEach(button=>{button.textContent=labels[button.dataset.huntTab];});
  }

  function show() {
    const panel = ensurePanel(); if (!panel) return;
    if (!visible) opener = document.activeElement;
    visible = true; panel.hidden = false;
    window.AtlasShell?.showCatalog(panel);
    $('huntToggle')?.setAttribute('aria-expanded','true');
    if (state.originId == null && state.originText == null) {
      state.originId = savedOrigin() ?? defaultOrigin(); state.originText = getMap(state.originId) ? mapLabel(getMap(state.originId)) : '';
    }
    if (!data) boot();
    render();
  }
  function close({restoreFocus=true}={}) {
    if (!visible) return;
    visible = false; const p = $('huntPanel'); if (p) p.hidden = true;
    $('huntToggle')?.setAttribute('aria-expanded','false');
    if (window.AtlasShell) window.AtlasShell.catalogClosed({restoreFocus});
    else if (restoreFocus) {
      const target = opener?.isConnected && opener!==document.body && !opener.closest('[hidden]') ? opener : $('huntToggle');
      target?.focus({preventScroll:true});
    }
    pendingDetailFocus = false;
  }
  function open(kind,id) {
    if (!Object.hasOwn(labels,kind)) return;
    const changed=state.selected?.kind!==kind || state.selected?.id!==Number(id);
    if(changed){state.compare=[];state.compareOpen=false;state.targets=null;state.rank='points';state.detailTab='maps';state.resultPage=0;state.resultQuery='';}
    if (kind !== state.tab) state.query = '';
    state.tab = kind; state.basketOpen=false;
    state.selected = id == null ? null : {kind,id:Number(id)};
    pendingDetailFocus = !!state.selected;
    state.limit = 72;
    show();
    if ($('huntBody')) $('huntBody').scrollTop = 0;
    if (!state.selected) $('huntSearch')?.focus(); else if (data) focusDetail();
  }
  function openBasket() {
    if(!state.basketOpen){state.compare=[];state.compareOpen=false;state.resultPage=0;state.resultQuery='';}
    state.basketOpen=true;state.selected=null;pendingDetailFocus=true;
    show();if($('huntBody'))$('huntBody').scrollTop=0;if(data)focusDetail();
  }

  function announce(message) {if ($('huntAnnouncement')) $('huntAnnouncement').textContent = message;}
  function focusDetail() {
    if (!visible || !pendingDetailFocus) return;
    ($('huntEntityTitle') || $('huntSearch'))?.focus({preventScroll:true}); pendingDetailFocus = false;
  }
  function preserveView(renderFn) {
    const body=$('huntBody'), scroll=body.scrollTop, active=document.activeElement;
    const wasInside=body.contains(active), id=active?.id, target=active?.dataset.huntTarget, action=active?.dataset.huntAction, map=active?.dataset.map,entityId=active?.dataset.id,kind=active?.dataset.kind;
    renderFn();
    if (wasInside) {
      let next=(id && $(id)) || (target && body.querySelector(`[data-hunt-target="${Number(target)}"]`)) || (action && [...body.querySelectorAll(`[data-hunt-action="${action}"]`)].find(el=>(map==null||el.dataset.map===map)&&(entityId==null||el.dataset.id===entityId)&&(kind==null||el.dataset.kind===kind))) || $('huntEntityTitle') || $('huntSearch');
      if(next?.disabled||next?.closest('[hidden]'))next=$('huntEntityTitle')||$('huntSearch');
      next?.focus({preventScroll:true});
    }
    body.scrollTop=scroll;
  }
  async function fetchDrops() {
    const response=await fetch('drop-data.json'); if(!response.ok)throw new Error('drop-data');
    const result=await response.json(); if(!Array.isArray(result?.links))throw new Error('Invalid drop data');
    return result;
  }
  function applyDrops(result) {
    dropData=result; dropFailed=false; dropsByItem=new Map();
    for(const link of dropData.links) {
      if(!itemsById.has(Number(link.itemId)) || !mobsById.has(Number(link.mobId)))continue;
      const id=Number(link.itemId); if(!dropsByItem.has(id))dropsByItem.set(id,[]);
      dropsByItem.get(id).push(link);
    }
  }
  function publishData() {
    data.dropData=dropData; window.HuntData=data;
    window.dispatchEvent(new CustomEvent('hunt-ready',{detail:data}));
  }
  async function retryDrops() {
    if(dropLoading || !data)return;
    dropLoading=true; if(visible)preserveView(render);
    let recovered=false;
    try {applyDrops(await fetchDrops()); recovered=true;}
    catch(error){dropFailed=true; console.error('Drop evidence loading failed',error);}
    finally {dropLoading=false; if(recovered)publishData(); if(visible)preserveView(render); announce(dropFailed?L('תיעוד הנפילות עדיין לא זמין. אפשר לנסות שוב.','Drop records are still unavailable. Please try again.'):L('תיעוד הנפילות נטען.','Drop records loaded.'));}
  }

  async function boot() {
    if (data || loading || !window.Atlas) return loading;
    catalogFailed = false;
    loading = (async () => {
      try {
        const responses = await Promise.allSettled([
          fetch('hunt-data.json').then(r=>{if(!r.ok)throw new Error('hunt-data');return r.json();}),
          fetchDrops()
        ]);
        if (responses[0].status !== 'fulfilled') throw responses[0].reason;
        const catalog=responses[0].value;
        if(!Array.isArray(catalog?.items) || !Array.isArray(catalog?.monsters))throw new Error('Invalid hunt catalogue');
        data = catalog;
        data.items ||= []; data.monsters ||= []; data.npcs ||= []; data.mapSpawns ||= {};
        itemsById = new Map(data.items.map(x=>[Number(x.id),x]));
        mobsById = new Map(data.monsters.map(x=>[Number(x.id),x]));
        npcsById = new Map(data.npcs.map(x=>[Number(x.id),x]));
        if(responses[1].status==='fulfilled')applyDrops(responses[1].value); else dropFailed=true;
        index = [
          ...data.items.map(x=>({...x,kind:'item'})),
          ...data.monsters.map(x=>({...x,kind:x.isBoss?'boss':'monster'})),
          ...data.npcs.map(x=>({...x,kind:'npc'}))
        ].map(x=>({...x,searchText:norm(`${x.name} ${x.id}`)}));
        publishData();
        if (visible) {render(); focusDetail();}
      } catch (error) {
        catalogFailed=true; data=null;
        window.dispatchEvent(new CustomEvent('hunt-unavailable'));
        if (visible) render();
        announce(L('הקטלוג לא נטען. אפשר לנסות שוב.','The catalogue could not be loaded. Please try again.'));
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
    refreshPanelLanguage(panel);
    panel.dataset.view=state.selected?'detail':state.basketOpen?'basket':'catalog';
    renderBasketBar();
    panel.querySelectorAll('[data-hunt-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.huntTab===state.tab)));
    $('huntSearch').placeholder = L(`שם ${singular[state.tab]} או מזהה…`,`${singular[state.tab]} name or ID…`);
    if ($('huntSearch').value !== state.query) $('huntSearch').value = state.query;
    $('huntBody').setAttribute('aria-busy',String(!data&&!catalogFailed));
    if (!data) {
      $('huntBody').innerHTML=catalogFailed?`<p class="hunt-empty">${L('הקטלוג לא נטען. אפשר לנסות שוב.','The catalogue could not be loaded. Please try again.')}</p><button type="button" class="button quiet" data-hunt-action="retry">${L('טעינה מחדש','Reload')}</button>`:`<div class="hunt-loading"><span class="loading-orb" aria-hidden="true"></span>${L('אוספים את הרמזים…','Gathering the clues…')}</div>`;
      announce(catalogFailed?L('הקטלוג לא נטען.','The catalogue could not be loaded.'):L('אוספים את הרמזים…','Gathering the clues…')); return;
    }
    if(state.basketOpen)renderBasket();else if (state.selected) renderDetail(); else renderCatalog();
  }
  function onPanelInput(e) {
    if(e.target.id==='huntResultSearch'){
      state.resultQuery=e.target.value.slice(0,200);state.resultPage=0;updateResultVisibility(currentResultRows());
    }else if(e.target.id==='huntSearch'){
      state.query=e.target.value.slice(0,200);state.selected=null;state.basketOpen=false;pendingDetailFocus=false;state.limit=72;render();$('huntBody').scrollTop=0;
    }else if(e.target.id==='huntLevelMin'||e.target.id==='huntLevelMax'){
      state[e.target.id==='huntLevelMin'?'levelMin':'levelMax']=e.target.value.slice(0,8);state.limit=72;preserveView(renderCatalog);
    }
  }
  function levelFilter() {
    const levels=(data?.monsters||[]).map(m=>m.level).filter(Number.isFinite),min=levels.length?Math.min(...levels):1,max=levels.length?Math.max(...levels):200;
    const values=[state.levelMin,state.levelMax].map(v=>v.trim()===''?null:/^\d+$/.test(v)?Number(v):NaN);
    const invalid=values.some(v=>v!==null&&(!Number.isSafeInteger(v)||v<min||v>max));
    const reversed=values[0]!==null&&values[1]!==null&&values[0]>values[1];
    return {min,max,from:values[0],to:values[1],error:invalid?L(`הזינו רמה שלמה בין ${min} ל־${max}, או השאירו שדה ריק.`,`Enter a whole level from ${min} to ${max}, or leave the field empty.`):reversed?L('הרמה ההתחלתית צריכה להיות קטנה מהסופית או שווה לה.','The minimum level must not exceed the maximum.'):''};
  }
  function creatureFilters(range) {
    return `<div class="hunt-level-filters"><label>${L('מרמה','Minimum level')}<input id="huntLevelMin" type="number" inputmode="numeric" min="${range.min}" max="${range.max}" step="1" value="${esc(state.levelMin)}" placeholder="${range.min}" aria-invalid="${!!range.error}" aria-describedby="huntLevelError"></label><label>${L('עד רמה','Maximum level')}<input id="huntLevelMax" type="number" inputmode="numeric" min="${range.min}" max="${range.max}" step="1" value="${esc(state.levelMax)}" placeholder="${range.max}" aria-invalid="${!!range.error}" aria-describedby="huntLevelError"></label>${state.tab==='monster'?`<label>${L('סוג מפלצת','Monster type')}<select id="huntCreatureType"><option value="regular" ${state.creatureType==='regular'?'selected':''}>${L('מפלצות רגילות','Regular monsters')}</option><option value="all" ${state.creatureType==='all'?'selected':''}>${L('מפלצות ובוסים','Monsters and bosses')}</option><option value="boss" ${state.creatureType==='boss'?'selected':''}>${L('בוסים בלבד','Bosses only')}</option></select></label>`:''}<button type="button" class="button quiet" data-hunt-action="clear-levels">${L('איפוס הסינון','Reset filters')}</button></div><p id="huntLevelError" class="hunt-filter-error" role="status" ${range.error?'':'hidden'}>${esc(range.error)}</p>`;
  }
  function renderCatalog() {
    const query = norm(state.query), tokens = query.split(/\s+/).filter(Boolean);
    const creatureTab=state.tab==='monster'||state.tab==='boss',range=creatureTab?levelFilter():null;
    let records = index.filter(e=>(state.tab==='monster'?(state.creatureType==='all'?['monster','boss'].includes(e.kind):e.kind===(state.creatureType==='boss'?'boss':'monster')):e.kind===state.tab) && tokens.every(t=>e.searchText.includes(t)));
    if(range)records=range.error?[]:records.filter(e=>(range.from===null||e.level>=range.from)&&(range.to===null||e.level<=range.to));
    const documentedFilter=state.tab==='item' && state.documented && !dropFailed;
    if (documentedFilter) records=records.filter(e=>dropsByItem.has(Number(e.id))||hasUnresolved(e.id));
    records.sort((a,b)=> query ? matchScore(b,query)-matchScore(a,query)||a.name.localeCompare(b.name)||a.id-b.id
      : (state.tab==='item' ? Number(dropsByItem.has(b.id)||hasUnresolved(b.id))-Number(dropsByItem.has(a.id)||hasUnresolved(a.id)) : state.tab==='boss' ? Number(b.hasRecordedSpawn)-Number(a.hasRecordedSpawn):0) || a.name.localeCompare(b.name)||a.id-b.id);
    const count = records.length, list = records.slice(0,state.limit);
    $('huntBody').innerHTML = `${creatureTab?creatureFilters(range):''}<div class="hunt-catalog-meta"><span>${fmt(count)} ${count===1?singular[state.tab]:labels[state.tab]}</span>${state.tab==='item'?`<label><input type="checkbox" id="huntDocumented" ${documentedFilter?'checked':''} ${dropFailed?'disabled':''}>${L('עם תיעוד נפילה במקורות','With drop records in the sources')}</label>`:''}</div>
      ${state.tab==='item'?(dropFailed?dropUnavailable():`<p class="hunt-note">${esc(dropData.meta?.coverageNoteHe ? D(dropData.meta.coverageNoteHe) : L('תיעוד נפילת הפריטים מבוסס על דיווחים קהילתיים חלקיים. היעדר תיעוד אינו מוכיח שהפריט אינו נופל.','Item drop records come from incomplete community reports. A missing record does not mean an item cannot drop.'))}</p>`):''}
      ${state.tab==='boss'?`<p class="hunt-note">${L('גרסאות בוס בעלות אותו שם נשמרות בנפרד לפי מזהה. מופיעה כאן גם רשומה שלא תועדה עבורה מפת הופעה.','Boss variants with the same name are listed separately by ID, including variants without a recorded spawn map.')}</p>`:''}
      <div class="hunt-catalog">${list.map(e=>`<button type="button" class="hunt-entity-card" data-hunt-open="${e.kind}" data-id="${e.id}">${iconImage(e)}<span class="hunt-entity-copy">${en(e.name)}<small>${L('מזהה','ID')} ${e.id}${e.level!=null?` · ${L('רמה','Level')} ${e.level}`:''}</small><span class="hunt-entity-state">${entityStatus(e)}</span></span></button>`).join('')}</div>
      ${!count&&!range?.error?(documentedFilter?`<p class="hunt-empty">${L('לא נמצאה התאמה בין הפריטים עם תיעוד נפילה שנאסף.','No matching items with collected drop records.')}</p><button type="button" class="button quiet" data-hunt-action="clear-filter">${L('חיפוש גם בפריטים ללא תיעוד','Include items without drop records')}</button>`:`<p class="hunt-empty">${L('לא נמצאה התאמה. אפשר לחפש חלק מהשם באנגלית או מזהה מספרי.','No matches. Try part of the English name or a numeric ID.')}</p>`):''}
      ${count>state.limit?`<button type="button" class="button quiet hunt-more" data-hunt-action="more">${L(`הצגת תוצאות נוספות · ${fmt(count-state.limit)} נותרו`,`Show more results · ${fmt(count-state.limit)} remaining`)}</button>`:''}`;
    announce(range?.error||L(`${fmt(count)} ${count===1?singular[state.tab]:labels[state.tab]} בחיפוש${documentedFilter?' עם תיעוד נפילה':''}.`,`${fmt(count)} ${count===1?singular[state.tab]:labels[state.tab]} found${documentedFilter?' with drop records':''}.`));
  }
  function normalizeGoalTarget(kind,id) {
    if(!['item','monster','boss'].includes(kind)||!Number.isSafeInteger(id)||id<0)return null;
    const entry=entityFor(kind,id);if(!entry)return null;
    return {kind:kind==='item'?'item':entry.isBoss?'boss':'monster',id};
  }
  const goalKey=target=>`${target.kind}:${target.id}`;
  function basketHas(kind,id){const target=normalizeGoalTarget(kind,id);return !!target&&state.basket.some(goal=>goalKey(goal)===goalKey(target));}
  function renderBasketBar() {
    const bar=$('huntBasketBar');if(!bar)return;
    bar.innerHTML=`<span>${L('ציד של כמה מטרות באותה מפה','Find overlap between hunting goals')}</span><button type="button" class="button quiet" data-hunt-action="basket-open" aria-pressed="${state.basketOpen}">${L(`סל ציד · ${state.basket.length}/${MAX_BASKET}`,`Hunt basket · ${state.basket.length}/${MAX_BASKET}`)}</button>`;
  }
  function basketButton(kind,id) {
    const added=basketHas(kind,id);
    return `<button type="button" class="button quiet hunt-basket-add" data-hunt-action="basket-toggle" data-kind="${kind}" data-id="${id}" aria-pressed="${added}" ${!added&&state.basket.length>=MAX_BASKET?'disabled':''}>${added?L('✓ בסל הציד · הסרה','✓ In hunt basket · Remove'):L('הוספה לסל הציד','Add to hunt basket')}</button>`;
  }
  function toggleBasket(kind,id) {
    const target=normalizeGoalTarget(kind,id);if(!target)return;
    const key=goalKey(target),exists=state.basket.some(goal=>goalKey(goal)===key);
    if(exists)state.basket=state.basket.filter(goal=>goalKey(goal)!==key);
    else if(state.basket.length<MAX_BASKET)state.basket.push(target);
    else {announce(L(`אפשר להוסיף עד ${MAX_BASKET} מטרות. הסירו מטרה כדי לבחור אחרת.`,`Add up to ${MAX_BASKET} goals. Remove one to choose another.`));return;}
    preserveView(render);
    announce(L(`${state.basket.length} מטרות בסל הציד.`,`Hunt basket: ${state.basket.length} ${state.basket.length===1?'goal':'goals'}.`));
  }
  function resolvedBasket() {
    return state.basket.map(target=>{
      const entry=entityFor(target.kind,target.id);
      const ids=target.kind==='item'?(dropFailed?[]:[...new Set((dropsByItem.get(target.id)||[]).map(link=>Number(link.mobId)))].filter(id=>mobsById.has(id))):[target.id];
      const note=ids.length?'':dropFailed?L('תיעוד הנפילות לא נטען; אי אפשר לקבוע מטרות לפריט.','Drop records are unavailable; monster targets cannot be resolved for this item.'):hasUnresolved(target.id)?L('דיווח קיים, אך גרסת המפלצת אינה מאומתת.','A report exists, but the monster variant is unconfirmed.'):L('לא נמצא תיעוד נפילה במקורות שנכללו.','No drop record was found in the included sources.');
      return {...target,entry,ids,note};
    });
  }
  function basketCandidates(goals=resolvedBasket()) {
    const candidates=buildCandidates([...new Set(goals.flatMap(goal=>goal.ids))]);
    return candidates.map(candidate=>({...candidate,coveredGoals:goals.filter(goal=>goal.ids.some(id=>candidate.ids.includes(id))),goalCount:goals.length}));
  }
  function activeCandidates() {
    return state.basketOpen?basketCandidates():state.selected&&state.selected.kind!=='npc'?buildCandidates(state.selected.kind==='item'?[...(state.targets||[])]:[state.selected.id]):[];
  }
  function routeGoal() {
    const targets=state.basketOpen?state.basket.map(target=>({...target})):state.selected?[normalizeGoalTarget(state.selected.kind,state.selected.id)].filter(Boolean):[];
    if(!targets.length)return null;
    const monsterIds=state.basketOpen?resolvedBasket().flatMap(goal=>goal.ids):state.selected.kind==='item'?[...(state.targets||[])]:[state.selected.id];
    return {kind:'hunt',targets:targets.slice(0,MAX_BASKET),monsterIds:[...new Set(monsterIds)].filter(id=>Number.isSafeInteger(id)&&mobsById.has(id)).slice(0,128)};
  }
  function describeGoal(goal) {
    const targets=goal?.kind==='hunt'&&Array.isArray(goal.targets)?goal.targets.slice(0,MAX_BASKET).filter(t=>t&&['item','monster','boss'].includes(t.kind)&&Number.isSafeInteger(t.id)&&t.id>=0):[];
    if(!targets.length)return '';
    const names=targets.map(target=>entityFor(target.kind,target.id)?.name).filter(Boolean);
    return names.length===targets.length?L(`מטרת הציד: ${names.join(' · ')}`,`Hunting goal: ${names.join(' · ')}`):L(`${targets.length} מטרות ציד`,`${targets.length} hunting ${targets.length===1?'goal':'goals'}`);
  }
  function renderBasket() {
    const goals=resolvedBasket(),candidates=basketCandidates(goals),ranked=sortCandidates(candidates);
    state.compare=state.compare.filter(id=>candidates.some(c=>c.map.id===id));if(!state.compare.length)state.compareOpen=false;
    const recommendation=state.rank==='points'?ranked.find(c=>!['event','system','unavailable'].includes(c.map.scope))?.map.id:null;
    $('huntBody').innerHTML=`<button type="button" class="hunt-back" data-hunt-action="catalog">${L('חזרה לחיפוש','Back to search')}</button><div class="hunt-basket-heading"><h3 id="huntEntityTitle" tabindex="-1">${L('סל הציד שלכם','Your hunt basket')}</h3>${goals.length?`<button type="button" class="button quiet" data-hunt-action="basket-clear">${L('ניקוי הסל','Clear basket')}</button>`:''}</div><p class="hunt-note">${L(`עד ${MAX_BASKET} פריטים ומפלצות. הסל נשמר לביקור הזה בלבד. מפות מדורגות תחילה לפי מספר המטרות שיש להן עדות במפה, ואז לפי המיון שבחרתם.`,`Up to ${MAX_BASKET} items and monsters, kept for this visit only. Maps rank first by the number of goals with recorded evidence, then by your selected sort order.`)}</p>
      ${goals.length?`<ul class="hunt-basket-goals">${goals.map(goal=>`<li>${iconImage(goal.entry)}<div><button type="button" class="hunt-text-button" data-hunt-open="${goal.kind}" data-id="${goal.id}">${en(goal.entry.name)}</button><small>${singular[goal.kind]} · ${goal.id}</small>${goal.note?`<p class="hunt-condition">${esc(goal.note)}</p>`:''}</div><button type="button" class="button quiet" data-hunt-action="basket-toggle" data-kind="${goal.kind}" data-id="${goal.id}" aria-label="${esc(L(`הסרת ${goal.entry.name} מסל הציד`,`Remove ${goal.entry.name} from hunt basket`))}">${L('הסרה','Remove')}</button></li>`).join('')}</ul><p class="hunt-note">${L('עדות לפריט היא דיווח נפילה ממפלצת עם נקודת הופעה מתועדת במפה. היא אינה הבטחה לנפילה או לנוכחות מפלצת כרגע. נקודות משותפות לכמה מטרות נספרות פעם אחת.','Evidence for an item means a reported drop from a monster with a recorded spawn point on that map. It does not guarantee a drop or a monster being present now. Spawn points shared by several goals are counted once.')}</p>${goals.some(goal=>goal.kind==='item')&&dropFailed?dropUnavailable():''}${originControls(true)}${comparisonSection(candidates)}<div class="hunt-results-pane" ${state.compareOpen?'hidden':''}><div class="hunt-results-heading"><h4>${L(`${fmt(ranked.length)} מפות עם עדות למטרה אחת לפחות`,`${fmt(ranked.length)} maps with evidence for at least one goal`)}</h4></div>${comparisonToolbar(ranked.length)}${resultsView(ranked,(candidate,i)=>candidateCard(candidate,i,recommendation,false,ranked.length>1))}${goals.some(goal=>goal.kind==='item')&&!dropFailed?dropAttribution():''}${!ranked.length?`<p class="hunt-empty">${L('לא נמצאה מפת הופעה מתועדת למטרות שניתן לזהות. זה אינו מוכיח שהמטרות אינן במשחק.','No recorded spawn map was found for the goals that could be resolved. This does not prove the targets are absent from the game.')}</p>`:''}</div>`:`<p class="hunt-empty">${L('פתחו פריט, מפלצת או בוס ובחרו הוספה לסל הציד. כאן תוכלו למצוא מפות עם עדות לכמה מטרות יחד.','Open an item, monster or boss and choose Add to hunt basket. Find maps with recorded evidence for multiple goals here.')}</p><button type="button" class="button primary" data-hunt-action="catalog">${L('בחירת מטרות','Choose goals')}</button>`}`;
    announce(L(`${goals.length} מטרות בסל. ${ranked.length} מפות מתועדות.`,`${goals.length} basket goals. ${ranked.length} recorded maps.`));
  }
  function entityStatus(entry) {
    if(entry.kind==='item')return dropFailed?L('תיעוד הנפילות לא נטען','Drop records unavailable'):dropsByItem.has(entry.id)?L('יש תיעוד נפילה','Drop recorded'):hasUnresolved(entry.id)?L('יש דיווח; גרסת המפלצת לא זוהתה','Reported; monster variant unconfirmed'):L('תיעוד נפילה לא נמצא','No drop record found');
    if(entry.kind==='npc')return entry.hasRecordedLocation?L('מיקומים וניווט','Locations and directions'):L('ללא מיקום מתועד','No recorded location');
    return entry.hasRecordedSpawn?L('מפת הופעה מתועדת','Spawn map recorded'):L('ללא מפת הופעה מתועדת','No recorded spawn map');
  }
  function entityHeading(entry,kind) {
    return `<button type="button" class="hunt-back" data-hunt-action="catalog">${L('חזרה לחיפוש','Back to search')}</button>
      <div class="hunt-entity-hero"><div class="hunt-entity-heading">${iconImage(entry,'hunt-icon-large')}<div><span class="hunt-eyebrow">${singular[kind]}</span><h3 id="huntEntityTitle" tabindex="-1">${en(entry.name)}</h3><p>${L('מזהה','ID')} ${entry.id}${entry.level!=null?` · ${L('רמה','Level')} ${entry.level}`:''}</p></div></div>${kind!=='npc'?basketButton(kind,entry.id):''}</div>`;
  }
  function detailSections(entry,kind,maps,information,rewards='') {
    const tabs=[['maps',L('מפות ומיקומים','Maps & locations'),maps],['info',kind==='item'?L('מקורות נפילה','Drop sources'):L('מידע ומקורות','Details & sources'),information]];
    if(kind!=='item'&&kind!=='npc')tabs.push(['drops',L('שלל מתועד','Recorded drops'),rewards||`<p class="hunt-empty">${L('אין במקורות שנכללו תיעוד נפילה למפלצת הזו. אין להסיק מכך שאינה מפילה פריטים.','The included sources have no drop records for this monster. This does not mean it drops no items.')}</p>`]);
    if(!tabs.some(([key])=>key===state.detailTab))state.detailTab='maps';
    return entityHeading(entry,kind)+`<div class="hunt-detail-tabs" role="tablist" aria-label="${L('פרטי הרשומה','Entry details')}">${tabs.map(([key,label])=>`<button id="huntDetailTab-${key}" type="button" role="tab" data-hunt-action="detail-tab" data-section="${key}" aria-selected="${state.detailTab===key}" aria-controls="huntDetail-${key}" tabindex="${state.detailTab===key?'0':'-1'}">${label}</button>`).join('')}</div>`+tabs.map(([key,,content])=>`<section id="huntDetail-${key}" class="hunt-detail-section" role="tabpanel" tabindex="0" aria-labelledby="huntDetailTab-${key}" ${state.detailTab===key?'':'hidden'}>${content}</section>`).join('');
  }
  function onDetailKeydown(e) {
    const tab=e.target.closest('[data-section]');if(!tab||tab.getAttribute('role')!=='tab')return;
    const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;
    const tabs=[...$('huntBody').querySelectorAll('[data-section]')],index=tabs.indexOf(tab);
    const rtl=window.AtlasI18n?.language!=='en',delta=(e.key==='ArrowRight'?1:-1)*(rtl?-1:1);
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+delta+tabs.length)%tabs.length;
    e.preventDefault();changeDetailTab(tabs[next].dataset.section);
  }
  function changeDetailTab(section) {
    const selected=$(`huntDetailTab-${section}`);
    if(!state.selected||!selected)return;
    state.detailTab=section;
    const body=$('huntBody');
    for(const tab of body.querySelectorAll('[data-section]')){
      const active=tab===selected;
      tab.setAttribute('aria-selected',String(active));
      tab.setAttribute('tabindex',active?'0':'-1');
      $(tab.getAttribute('aria-controls')).hidden=!active;
    }
    body.scrollTop=0;
    selected.focus({preventScroll:true});
  }
  function currentResultRows() {
    return state.selected?.kind==='npc'?npcLocations(npcsById.get(state.selected.id)):sortCandidates(activeCandidates());
  }
  function resultWindow(rows) {
    const query=norm(state.resultQuery),sharedMatches=new Set(query?(window.MapSearch?.search?.(query,atlasMaps().length)||[]).map(map=>Number(map.id)):[]);
    const matches=rows.filter(row=>!query||sharedMatches.has(Number(row.map.id))||norm(`${row.map.name} ${row.map.name_he||''} ${D(row.map.name)} ${row.map.id}`).includes(query));
    const pages=Math.max(1,Math.ceil(matches.length/RESULTS_PER_PAGE));
    state.resultPage=Math.max(0,Math.min(state.resultPage,pages-1));
    return {matches,pages,visible:new Set(matches.slice(state.resultPage*RESULTS_PER_PAGE,(state.resultPage+1)*RESULTS_PER_PAGE).map(row=>Number(row.map.id)))};
  }
  function resultCount(matches,pages) {
    if(!matches.length)return L('אין מפות שמתאימות לחיפוש','No maps match your search');
    const count=matches.length===1?L('מפה אחת','1 map'):L(`${fmt(matches.length)} מפות`,`${fmt(matches.length)} maps`);
    return count+(pages>1?L(` · עמוד ${state.resultPage+1} מתוך ${pages}`,` · Page ${state.resultPage+1} of ${pages}`):'');
  }
  function resultsView(rows,card) {
    if(!rows.length)return '';
    const {matches,pages,visible}=resultWindow(rows);
    return `${rows.length>1?`<div class="hunt-result-tools"><label for="huntResultSearch" class="hunt-sr-only">${L('חיפוש במפות האלה','Search these maps')}</label><input id="huntResultSearch" type="search" maxlength="200" value="${esc(state.resultQuery)}" placeholder="${L('סינון מפות לפי שם או מזהה…','Filter maps by name or ID…')}" dir="auto" aria-controls="huntResultList"></div>`:''}<nav class="hunt-result-pages" aria-label="${L('עמודי תוצאות המפות','Map result pages')}"><button id="huntPagePrevious" type="button" class="button quiet" data-hunt-action="result-previous" ${pages<=1?'hidden':''} ${state.resultPage===0?'disabled':''}>${L('הקודם','Previous')}</button><p id="huntResultCount" class="hunt-result-count" tabindex="-1">${resultCount(matches,pages)}</p><button id="huntPageNext" type="button" class="button quiet" data-hunt-action="result-next" ${pages<=1?'hidden':''} ${state.resultPage>=pages-1?'disabled':''}>${L('הבא','Next')}</button></nav><div id="huntResultList" class="hunt-candidates">${rows.map((row,i)=>card(row,i).replace('<article ',`<article ${visible.has(Number(row.map.id))?'':'hidden '}`)).join('')}</div><p id="huntResultEmpty" class="hunt-empty" ${matches.length?'hidden':''}>${L('נסו שם מפה אחר או מחקו את החיפוש כדי להציג את כל המפות.','Try another map name or clear the search to show all maps.')}</p>`;
  }
  function updateResultVisibility(rows) {
    const {matches,pages,visible}=resultWindow(rows);
    $('huntBody').querySelectorAll('[data-hunt-map]').forEach(card=>{card.hidden=!visible.has(Number(card.dataset.huntMap));});
    if($('huntResultCount'))$('huntResultCount').textContent=resultCount(matches,pages);
    if($('huntResultEmpty'))$('huntResultEmpty').hidden=!!matches.length;
    if($('huntPagePrevious')){$('huntPagePrevious').disabled=state.resultPage===0;$('huntPagePrevious').hidden=pages<=1;}
    if($('huntPageNext')){$('huntPageNext').disabled=state.resultPage>=pages-1;$('huntPageNext').hidden=pages<=1;}
    announce(resultCount(matches,pages));
  }
  function originControls(withRank=true) {
    const m=getMap(state.originId);
    return `<details id="huntRouteOptions" class="hunt-route-options" ${m?'':'open'}><summary><span>${L('מוצא ומיון','Starting map & sort')}</span><span id="huntOriginSummary">${esc(m?m.name:L('בחרו מפת מוצא','Choose starting map'))}</span></summary><div class="hunt-controls"><label>${L('מאיפה יוצאים?','Where are you starting?')}<input id="huntOrigin" list="mapOptions" value="${esc(m?mapLabel(m):state.originText||'')}" autocomplete="off" dir="auto" placeholder="${L('שם מפה בעברית, באנגלית או מזהה','Map name in Hebrew, English or ID')}" aria-invalid="${!m}" ${m?'':'aria-describedby="huntOriginNote"'}></label><div class="hunt-origin-actions"><button type="button" class="button quiet" data-hunt-action="origin-active">${L('מהמקום הנבחר','Use selected map')}</button>${window.AtlasPersonal?.setOrigin?`<button type="button" class="button quiet" data-hunt-action="origin-save" ${m?'':'disabled'}>${m&&savedOrigin()===m.id?L('✓ מפת המוצא השמורה','✓ Saved starting map'):L('שמירה כמפת מוצא','Save starting map')}</button>`:''}</div>${withRank?`<label>${L('סדר המפות','Sort maps')}<select id="huntRank"><option value="points" ${state.rank==='points'?'selected':''}>${L('מספר נקודות היעד','Target spawn points')}</option><option value="share" ${state.rank==='share'?'selected':''}>${L('חלק מנקודות ההופעה','Share of spawn points')}</option><option value="distance" ${state.rank==='distance'?'selected':''}>${L('מעברים במסלול המשוקלל','Passages on weighted route')}</option></select></label>`:''}</div><p id="huntOriginNote" class="hunt-note" ${m?'hidden':''}>${m?'':originNote()}</p></details>`;
  }
  function originNote(){return state.originText?.trim()?L('לא נמצאה מפת מוצא חד-משמעית. בחרו מפה מהרשימה או הזינו מזהה מפה.','No unique starting map found. Select a map from the list or enter its ID.'):L('בחרו מפת מוצא מהרשימה כדי להשוות מסלולים.','Choose a starting map from the list to compare routes.');}
  function hasUnresolved(id) { return (dropData.unresolved||[]).some(l=>Number(l.itemId)===Number(id)); }
  function walkDistanceText(distance) { return !getMap(state.originId)?L('בחרו מפת מוצא כדי לחשב מסלול','Choose a starting map to calculate a route'):distance==null?L('לא נמצא מסלול הליכה מהמוצא','No walking route from the starting map'):distance===0?L('זו מפת המוצא','This is the starting map'):distance===1?L('מעבר מפה אחד בהליכה','1 map transition on foot'):L(`${fmt(distance)} מעברי מפה בהליכה`,`${fmt(distance)} map transitions on foot`); }
  function dropUnavailable(){return `<div class="hunt-data-warning"><p>${L('תיעוד נפילות הפריטים לא נטען. אי אפשר לבדוק כרגע מאילו מפלצות פריט נופל.','Item drop records could not be loaded. The monsters that drop an item cannot be checked right now.')}</p><button type="button" class="button quiet" data-hunt-action="retry-drops" ${dropLoading?'disabled':''}>${dropLoading?L('טוענים את התיעוד…','Loading records…'):L('ניסיון נוסף לטעינת התיעוד','Retry loading records')}</button></div>`;}
  function renderDetail() {
    const {kind,id}=state.selected, entry=entityFor(kind,id);
    if (!entry) {$('huntBody').innerHTML=`<button class="hunt-back" data-hunt-action="catalog">${L('חזרה לחיפוש','Back to search')}</button><p class="hunt-empty">${L('הרשומה הזו אינה מופיעה בקטלוג שנטען.','This entry is not in the loaded catalogue.')}</p>`; return;}
    if(kind==='npc'){renderNpc(entry);return;}
    let targets=[id], lead='';
    if(kind==='item'){
      if(dropFailed){$('huntBody').innerHTML=entityHeading(entry,kind)+dropUnavailable()+sourceLink(entry.sourceUrl,L('הפריט במאגר המקור','Item in the source database'));announce(L('תיעוד נפילות הפריטים לא נטען.','Item drop records could not be loaded.'));return;}
      const links=dropsByItem.get(id)||[];
      if(!links.length){
        const unresolved=(dropData.unresolved||[]).filter(l=>Number(l.itemId)===id);
        announce(unresolved.length?L('דיווח קלאסיק קיים, אך גרסת המפלצת לא אומתה. אין יעד ניווט מאומת.','A Classic report exists, but the monster variant is unconfirmed. No verified navigation target is available.'):L('אין תיעוד נפילה במקורות שנכללו.','No drop record in the included sources.'));
        $('huntBody').innerHTML=entityHeading(entry,kind)+(unresolved.length?`<p class="hunt-empty">${L('דיווח קלאסיק קיים, אך לא הוכרע לאיזו גרסת מפלצת הוא שייך; אין יעד ניווט מאומת.','A Classic report exists, but its monster variant is unresolved; no verified navigation target is available.')}</p>${unresolved.map(l=>`<div class="hunt-drop-card">${en(l.mobName)}<p class="hunt-note">${esc(statusLabel(l.status))}</p>${sourceLink(l.sourceUrl,L('מקור הדיווח','Report source'))}</div>`).join('')}${dropAttribution()}`:`<p class="hunt-empty">${L('אין במקורות שנכללו תיעוד נפילה לפריט הזה; אין להסיק שאינו נופל.','The included sources have no drop record for this item; that does not mean it cannot drop.')}</p><p class="hunt-note">${esc(D(dropData.meta?.coverageNoteHe || ''))}</p>`)+sourceLink(entry.sourceUrl,L('הפריט במאגר המקור','Item in the source database'));return;
      }
      const ids=[...new Set(links.map(l=>Number(l.mobId)))];
      if(state.targets===null)state.targets=new Set(ids);
      targets=ids.filter(n=>state.targets.has(n));
      lead=`<h4 class="hunt-section-title">${L('המפלצות שהפריט תועד אצלן','Monsters with recorded drops of this item')}</h4><p class="hunt-note">${L('בחרו מפלצת אחת או כמה. דירוג המפות מתייחס לנקודות ההופעה של כל המפלצות שסומנו.','Select one or more monsters. Map rankings include the spawn points of every selected monster.')}</p><div class="hunt-drop-monsters">${ids.map(mid=>{
        const mob=mobsById.get(mid), observations=links.filter(l=>Number(l.mobId)===mid);
        return `<div class="hunt-drop-card"><label class="hunt-target-label"><input type="checkbox" data-hunt-target="${mid}" ${state.targets.has(mid)?'checked':''}>${iconImage(mob)}<span>${en(mob.name)}<small>${L('רמה','Level')} ${mob.level ?? L('לא ידועה','unknown')} · ${L('מזהה','ID')} ${mid}</small></span></label>
          ${observations.map(l=>`<div class="hunt-provenance"><span>${esc(statusLabel(l.status))}</span>${sourceLink(l.sourceUrl,L('מקור התצפית','Observation source'))}${l.condition?`<p class="hunt-condition" dir="auto">${esc(D(l.condition))}</p>`:''}</div>`).join('')}
          <button class="hunt-text-button" type="button" data-hunt-open="${mob.isBoss?'boss':'monster'}" data-id="${mid}">${L('כל המידע על המפלצת','View monster details')}</button></div>`;
      }).join('')}</div><p class="hunt-note">${esc(dropData.meta?.coverageNoteHe ? D(dropData.meta.coverageNoteHe) : L('דיווחים קהילתיים חלקיים; אין כאן אחוזי נפילת פריט.','Incomplete community reports; item drop rates are not provided.'))}</p>`;
    }else{
      lead=`<div class="hunt-creature-stats"><span>${L('חיים','HP')} <strong>${entry.hp==null?L('לא פורסמו','Not published'):fmt(entry.hp)}</strong></span><span>${L('ניסיון','EXP')} <strong>${entry.exp==null?L('לא פורסם','Not published'):fmt(entry.exp)}</strong></span></div>`;
      if(kind==='boss')lead+=`<p class="hunt-note hunt-gold-note">${L('הסימון מציין נקודת הופעה רשומה. הבוס עשוי לנוע ממנה, והוא אינו בהכרח נמצא כרגע במפה.','The marker shows a recorded spawn point. The boss can move away from it and may not be on the map right now.')}</p>`;
    }
    const candidates=buildCandidates(targets), ranked=sortCandidates(candidates), normal=ranked.find(c=>!['event','system','unavailable'].includes(c.map.scope));
    const recommendation=state.rank==='points'?normal?.map.id:null;
    state.compare=state.compare.filter(id=>candidates.some(c=>c.map.id===id));
    if(!state.compare.length)state.compareOpen=false;
    const maps=originControls(true)+comparisonSection(candidates)+
      `<div class="hunt-results-pane" ${state.compareOpen?'hidden':''}><div class="hunt-results-heading hunt-sr-only"><h4>${ranked.length===1?L('מפה אחת עם נקודות יעד מתועדות','1 map with recorded target spawn points'):L(`${fmt(ranked.length)} מפות עם נקודות יעד מתועדות`,`${fmt(ranked.length)} maps with recorded target spawn points`)}</h4></div>
      ${kind==='item'?`<p class="hunt-note">${L(`${targets.length} מפלצות נבחרו. אפשר לשנות בלשונית מקורות נפילה.`,`${targets.length} monsters selected. Change them in Drop sources.`)}</p>`:''}
      ${!ranked.length?`<p class="hunt-empty">${targets.length?L('אין במאגר מפת הופעה מתועדת למזהה הזה. אין להסיק מכך שהמפלצת או הבוס אינם במשחק.','No spawn map is recorded for this ID. This does not mean the monster or boss is absent from the game.'):L('סמנו לפחות מפלצת אחת כדי להציג מפות.','Select at least one monster to see maps.')}</p>`:''}
      ${comparisonToolbar(ranked.length)}${resultsView(ranked,(c,i)=>candidateCard(c,i,recommendation,kind==='boss',ranked.length>1))}</div>`;
    const information=lead+`<p class="hunt-note">${L('האחוז הוא חלק מנקודות ההופעה במפה. הוא אינו סיכוי לנפילת פריט, תדירות הופעה או מספר המפלצות החיות כרגע. הדירוג אינו אומדן לפריטים בשעה.','The percentage is the share of recorded spawn points on the map. It is not a drop chance, spawn rate or live monster count. Rankings do not estimate items per hour.')}</p>
      <details class="hunt-explainer"><summary>${L('איך נקבע סדר המפות?','How are maps ranked?')}</summary><p>${L('המיון הראשי משתמש במספר נקודות ההופעה המתועדות של היעד. בשוויון משווים את חלקן מכל נקודות המפה, ואחריו את מספר מעברי ההליכה מהמוצא. אפשר לבחור מיון אחר.','The default ranking uses recorded target spawn points, then their share of all map spawn points, then walking transitions from your starting map. You can choose another sort order.')}</p><p>${L('מספר נקודות אינו קיבולת. תקרת המפלצות היא אומדן לשחקן יחיד ומשותפת לכל סוגי המפלצות במפה. תזמוני שרת, שחקנים נוספים ותנאי משימות עשויים לשנות את המצב בפועל.','Spawn point count is not capacity. The monster cap is a single-player estimate shared by all monster types on the map. Server timing, other players and quest conditions can change what happens in game.')}</p><p>${L('המרחק מוצג במספר מעברי מפה דרך קישורי הליכה מתועדים, ולא בזמן. ייתכן שנדרש שירות נסיעה או תנאי כניסה שאינם נכללים במסלול ההליכה.','Distance counts map transitions along recorded walking connections, not travel time. Travel services or entry requirements may be needed and are not included in walking routes.')}</p></details>
      ${sourceLink(entry.sourceUrl,L('הרשומה במאגר המקור','Entry in the source database'))}${kind==='item'?dropAttribution():''}`;
    $('huntBody').innerHTML=detailSections(entry,kind,maps,information,kind!=='item'?rewardLinks(id):'');
    announce(L(`${fmt(ranked.length)} מפות עם נקודות יעד מתועדות.`,`${fmt(ranked.length)} ${ranked.length===1?'map':'maps'} with recorded target spawn points.`));
  }
  function sourceLink(url,label) {const u=safeUrl(url);return u?`<a class="hunt-source-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';}
  function statusLabel(status) {return ({classic_counted:L('תצפית קלאסיק עם ספירה במקור','Classic observation with a recorded count'),classic_confirmed:L('מסומן כמאומת בקלאסיק במקור','Marked as Classic-confirmed by the source'),team_seen:L('נצפה בידי צוות המקור','Observed by the source team')})[status]||L('תיעוד במקור הקהילתי','Recorded in the community source');}
  function dropAttribution(){return `<details class="hunt-explainer hunt-credits"><summary>${L('מקורות תיעוד הנפילות','Drop record sources')}</summary><p>${esc(D(dropData.meta?.historicalVersionNoteHe||''))}</p><p dir="ltr" lang="en">${esc(dropData.meta?.attribution||'')}</p>${sourceLink(dropData.meta?.licenseUrl,L('רישיון נתוני התצפיות','Observation data license'))}</details>`;}
  function rewardLinks(mobId) {
    if(dropFailed)return dropUnavailable();
    const found=[...new Set((dropData.links||[]).filter(l=>Number(l.mobId)===mobId).map(l=>Number(l.itemId)))].map(id=>itemsById.get(id)).filter(Boolean);
    if(!found.length)return '';
    return `<div class="hunt-recorded-drops"><h4 class="hunt-section-title">${found.length===1?L('פריט אחד עם תיעוד נפילה ממפלצת זו','1 item with a recorded drop from this monster'):L(`${fmt(found.length)} פריטים עם תיעוד נפילה ממפלצת זו`,`${fmt(found.length)} items with recorded drops from this monster`)}</h4><div class="hunt-rewards">${found.map(item=>`<button class="hunt-reward" type="button" data-hunt-open="item" data-id="${item.id}">${iconImage(item)}${en(item.name)}</button>`).join('')}</div>${dropAttribution()}</div>`;
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
      return ((b.coveredGoals?.length||0)-(a.coveredGoals?.length||0))||(state.rank==='share'?share||point||travel:state.rank==='distance'?travel||point||share:point||share||travel)||a.map.name.localeCompare(b.map.name)||a.map.id-b.map.id;
    });
  }
  function scopeNote(map) {
    return ({event:L('מפת אירוע; זמינות נוכחית אינה מאומתת','Event map; current availability unverified'),system:L('רשומת מערכת; נגישות לשחקן אינה מאומתת','System entry; player access unverified'),unavailable:L('דרך הכניסה אינה מאומתת','Entry route unverified'),conditional:L('כניסה מותנית במשימה או בשירות','Entry requires a quest or service')})[map.scope]||'';
  }
  function metricHelp(kind) {
    const definitions={
      points:[L('על נקודות הופעה','About spawn points'),L('מספר מיקומי ההופעה המתועדים של המפלצות שנבחרו. כמה מטרות שמשתמשות באותה נקודת הופעה מתועדת אינן מגדילות את הספירה. אין כאן ספירה של מפלצות חיות.','Recorded spawn locations for the selected monsters. Goals sharing a recorded spawn point do not increase the count. This is not a live monster count.')],
      share:[L('על חלק מנקודות ההופעה','About spawn point share'),L('נקודות היעד חלקי כל נקודות ההופעה במפה. האחוז אינו סיכוי לנפילת פריט או קצב הופעת מפלצות.','Target spawn points divided by all recorded spawn points on the map. This percentage is not an item drop chance or a monster respawn rate.')],
      total:[L('על כל נקודות המפה','About all map spawn points'),L('כל נקודות הופעת המפלצות המתועדות במפה, כולל מפלצות שלא נבחרו. זה אינו מספר המפלצות שנמצאות כרגע במפה.','All recorded monster spawn points on the map, including unselected monsters. This is not the number currently present.')],
      capacity:[L('על תקרת המפלצות','About the monster cap'),L('אומדן לשחקן יחיד, משותף לכל סוגי המפלצות במפה. תנאי שרת, משימות ושחקנים נוספים עשויים לשנות את המצב בפועל.','A single-player estimate shared by all monster types on the map. Server conditions, quests and other players can change the actual result.')]
    };
    const [label,description]=definitions[kind];
    return `<details class="hunt-metric-help"><summary aria-label="${label}"><span aria-hidden="true">ⓘ</span><span class="hunt-sr-only">${label}</span></summary><p>${description}</p></details>`;
  }
  function candidateCard(c,i,recommended,boss=false,canCompare=true) {
    const note=scopeNote(c.map), compared=state.compare.includes(c.map.id);
    return `<article class="hunt-map-card ${c.map.id===recommended?'hunt-recommended':''}" data-hunt-map="${c.map.id}" aria-label="${esc(c.map.name)}"><div class="hunt-map-top"><span class="hunt-rank-number">${i+1}</span><div><span class="hunt-recommend-label" ${c.map.id===recommended?'':'hidden'}>${c.coveredGoals?L('החפיפה המתועדת המובילה בין המטרות','Best recorded overlap between goals'):L('הכי הרבה נקודות הופעה מתועדות','Most recorded spawn points')}</span><button type="button" class="hunt-map-name" data-hunt-action="map" data-map="${c.map.id}">${en(c.map.name)}</button><small>${L('מזהה מפה','Map ID')} ${c.map.id}</small></div></div>
      ${c.coveredGoals?`<div class="hunt-goal-coverage"><strong>${L(`עדות ל־${c.coveredGoals.length} מתוך ${c.goalCount} מטרות`,`Evidence for ${c.coveredGoals.length} of ${c.goalCount} goals`)}</strong><p>${c.coveredGoals.map(goal=>en(goal.entry.name)).join(' · ')}</p></div>`:''}
      <p class="hunt-distance">${walkDistanceText(c.distance)}</p>${note?`<p class="hunt-condition">${esc(note)}</p>`:''}
      <details class="hunt-map-details"><summary><span><strong>${fmt(c.count)}</strong> ${L('נקודות יעד','target points')} · <strong>${pct(c.share)}</strong> ${L('מנקודות המפה','of map points')}</span><span>${L('כל הנתונים','Full data')}</span></summary>
      <div class="hunt-map-stats"><div><strong>${fmt(c.count)}</strong>${c.count===1?L('נקודת יעד','target point'):L('נקודות יעד','target points')}${metricHelp('points')}</div><div><strong>${pct(c.share)}</strong>${L('חלק מנקודות ההופעה','share of spawn points')}${metricHelp('share')}</div><div><strong>${fmt(c.total)}</strong>${c.total===1?L('נקודה במפה','map point'):L('נקודות במפה','map points')}${metricHelp('total')}</div></div>
      <div class="hunt-map-meta"><div class="hunt-capacity"><p>${c.capacity!=null?L(`תקרת מפלצות משוערת לשחקן יחיד: ${fmt(c.capacity)}`,`Estimated single-player monster cap: ${fmt(c.capacity)}`):L('תקרת מפלצות: לא פורסמה במקור','Monster cap: not published by the source')}</p>${metricHelp('capacity')}</div></div>
      ${boss?`<div class="hunt-boss-points"><span>${L('נקודת הופעה רשומה בתמונת המקור','Recorded spawn point in the source image')}</span>${c.points.map(p=>`<bdi dir="ltr">x ${p.x} · y ${p.y}</bdi>`).join('')}</div>`:''}
      </details>
      <div class="hunt-map-actions"><button type="button" class="button primary" data-hunt-action="positions" data-map="${c.map.id}" data-mobs="${c.ids.join(',')}" aria-label="${boss?L('הצגת נקודת הבוס במפה','Show boss spawn point on'):L('הצגת נקודות ההופעה במפה','Show spawn points on')} ${esc(c.map.name)}">${boss?L('מיקום הבוס','Boss location'):L('מיקומים במפה','Locations')}</button><button type="button" class="button quiet" data-hunt-action="route" data-map="${c.map.id}" aria-label="${L('תכנון מסלול למפה','Plan a route to')} ${esc(c.map.name)}">${L('מסלול','Route')}</button>${canCompare?`<button type="button" class="button quiet hunt-compare-toggle" data-hunt-action="compare-toggle" data-map="${c.map.id}" aria-pressed="${compared}" aria-label="${esc(compared?L(`הסרת ${c.map.name} מההשוואה`,`Remove ${c.map.name} from comparison`):L(`הוספת ${c.map.name} להשוואה`,`Add ${c.map.name} to comparison`))}" ${state.compare.length===3&&!compared?'disabled':''}>${compared?L('✓ בהשוואה','✓ Comparing'):L('השוואה +','Compare +')}</button>`:''}</div></article>`;
  }
  function comparisonToolbar(candidateCount) {
    if(candidateCount<2)return '';
    return `<div class="hunt-compare-toolbar"><span>${state.compare.length?L(`${state.compare.length} מתוך 3 מפות נבחרו`,`${state.compare.length} of 3 maps selected`):L('בחרו עד 3 מפות להשוואה','Choose up to 3 maps to compare')}</span><button id="huntCompareOpen" type="button" class="button ${state.compare.length?'primary':'quiet'}" data-hunt-action="compare-open" aria-expanded="${state.compareOpen}" aria-controls="huntComparison" ${state.compare.length?'':'disabled'}>${state.compareOpen?L('סגירת ההשוואה','Close comparison'):L('השוואת המפות','Compare maps')}</button>${state.compare.length?`<button type="button" class="button quiet" data-hunt-action="compare-clear">${L('ניקוי','Clear')}</button>`:''}</div>`;
  }
  function comparisonSection(candidates) {
    return `<section id="huntComparison" class="hunt-comparison" aria-labelledby="huntComparisonTitle" ${state.compareOpen?'':'hidden'}>${comparisonContent(candidates)}</section>`;
  }
  function comparisonAccess(map) {
    const conditions=(window.Atlas?.data?.services||[]).filter(s=>Number(s.to)===Number(map.id)).map(s=>s.condition||s.condition_he).filter(Boolean);
    const scope=scopeNote(map);
    return `${scope?`<p class="hunt-condition">${esc(scope)}</p>`:''}${conditions.length?`<p>${L('תנאי כניסות מתועדות; ייתכנו כניסות חלופיות:','Recorded entry requirements; other entrances may exist:')}</p><ul>${[...new Set(conditions)].map(note=>`<li>${esc(D(note))}</li>`).join('')}</ul>`:scope?'':L('לא פורסם כאן תנאי כניסה מיוחד. הנגישות בפועל אינה נבדקת.','No special entry requirement is recorded here. In-game access has not been checked.')}`;
  }
  function comparisonContent(candidates) {
    const rows=state.compare.map(id=>candidates.find(c=>c.map.id===id)).filter(Boolean);
    const row=(label,cell)=>`<tr><th scope="row">${label}</th>${rows.map(c=>`<td>${cell(c)}</td>`).join('')}</tr>`;
    return `<div class="hunt-comparison-heading"><h4 id="huntComparisonTitle" tabindex="-1">${L('השוואת מפות ציד','Compare hunting maps')}</h4><button type="button" class="button quiet" data-hunt-action="compare-open">${L('חזרה לרשימת המפות','Back to map list')}</button></div>
      <p class="hunt-note">${rows.length<2?L('הוסיפו מפה נוספת להשוואה זו לצד זו. ','Add another map for a side-by-side comparison. '):''}${L('כל הנתונים מתייחסים לאותן מפלצות שסומנו ולמוצא שנבחר. נקודות הופעה ואחוזים אינם תפוקת ציד או סיכויי נפילה.','All data uses the same selected monsters and starting map. Spawn points and percentages are not hunting yield or drop chances.')}</p>
      ${rows.length?`<div class="hunt-comparison-scroll" tabindex="0" role="region" aria-label="${L('טבלת השוואת מפות; אפשר לגלול לרוחב','Map comparison table; scroll horizontally to see all maps')}"><table><caption class="hunt-sr-only">${L(`השוואת ${rows.length} מפות לפי הנתונים המתועדים`,`Comparing ${rows.length} ${rows.length===1?'map':'maps'} using recorded data`)}</caption><thead><tr><th scope="col">${L('מדד','Metric')}</th>${rows.map(c=>`<th scope="col">${en(c.map.name)}<small>${L('מזהה','ID')} ${c.map.id}</small><button type="button" class="hunt-text-button" data-hunt-action="compare-toggle" data-map="${c.map.id}" aria-label="${esc(L(`הסרת ${c.map.name} מההשוואה`,`Remove ${c.map.name} from comparison`))}">${L('הסרה','Remove')}</button></th>`).join('')}</tr></thead><tbody>
      ${row(L('נקודות הופעה של היעד','Target spawn points'),c=>fmt(c.count))}
      ${row(L('חלק מנקודות ההופעה','Share of spawn points'),c=>pct(c.share))}
      ${row(L('כל נקודות ההופעה במפה','All map spawn points'),c=>fmt(c.total))}
      ${row(L('תקרת מפלצות משוערת לשחקן יחיד','Estimated single-player monster cap'),c=>c.capacity==null?L('לא פורסמה','Not published'):fmt(c.capacity))}
      ${state.basketOpen?row(L('מטרות עם עדות במפה','Goals with recorded map evidence'),c=>`${c.coveredGoals?.length||0} / ${c.goalCount||state.basket.length}`):''}
      ${row(L('מעברי מפה מהמוצא','Map transitions from start'),c=>walkDistanceText(c.distance))}
      ${row(L('תנאי כניסה ומגבלות','Entry requirements and restrictions'),c=>comparisonAccess(c.map))}
      ${row(L('פעולות','Actions'),c=>`<div class="hunt-compare-actions"><button type="button" class="button quiet" data-hunt-action="positions" data-map="${c.map.id}" data-mobs="${c.ids.join(',')}" aria-label="${L('הצגת נקודות ההופעה במפה','Show spawn points on')} ${esc(c.map.name)}">${L('מפה ומיקומים','Map and locations')}</button><button type="button" class="button primary" data-hunt-action="route" data-map="${c.map.id}" aria-label="${L('תכנון מסלול למפה','Plan a route to')} ${esc(c.map.name)}">${L('תכנון מסלול','Plan route')}</button></div>`)}</tbody></table></div>`:`<p class="hunt-empty">${L('לא נותרו מפות להשוואה עבור המפלצות שסומנו. בחרו מפות מתוך התוצאות.','No comparison maps remain for the selected monsters. Choose maps from the results.')}</p>`}`;
  }
  function toggleComparison(mapId) {
    if((!state.selected&&!state.basketOpen)||state.selected?.kind==='npc')return;
    const candidates=activeCandidates();
    if(!candidates.some(c=>c.map.id===mapId))return;
    if(state.compare.includes(mapId))state.compare=state.compare.filter(id=>id!==mapId);
    else if(state.compare.length<3)state.compare.push(mapId);
    else {announce(L('אפשר להשוות עד 3 מפות. הסירו מפה כדי לבחור אחרת.','You can compare up to 3 maps. Remove one to choose another.'));return;}
    if(!state.compare.length)state.compareOpen=false;
    preserveView(renderCurrentResults);
    announce(L(`${state.compare.length} מתוך 3 מפות בהשוואה.${state.compare.length===3?' הגעתם למגבלה; אפשר להסיר מפה כדי להחליף אותה.':''}`,`${state.compare.length} of 3 maps in comparison.${state.compare.length===3?' Limit reached; remove a map to replace it.':''}`));
  }
  function renderCurrentResults(){if(state.basketOpen)renderBasket();else if(state.selected)renderDetail();}
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
    const maps=originControls(false)+`<div class="hunt-results-heading hunt-sr-only"><h4>${places.length===1?L('מפה אחת מתועדת לדמות הזו','1 recorded map for this NPC'):L(`${fmt(places.length)} מפות מתועדות לדמות הזו`,`${fmt(places.length)} recorded maps for this NPC`)}</h4></div>
      ${!places.length?`<p class="hunt-empty">${L('אין במאגר מפת מיקום מתועדת לדמות הזו. אין להסיק מכך שהיא אינה במשחק.','No location map is recorded for this NPC. This does not mean the NPC is absent from the game.')}</p>`:''}
      ${resultsView(places,({map,points,distance},i)=>`<article class="hunt-map-card" data-hunt-map="${map.id}" aria-label="${esc(map.name)}"><div class="hunt-map-top"><span class="hunt-rank-number">${i+1}</span><div><button type="button" class="hunt-map-name" data-hunt-action="map" data-map="${map.id}" ${getMap(map.id)?'':'disabled'}>${en(map.name)}</button><small>${L('מזהה מפה','Map ID')} ${map.id}</small></div></div><div class="hunt-map-meta"><p>${points.length===1?L('נקודת מיקום מתועדת אחת במפה','1 recorded location on the map'):points.length?L(`${fmt(points.length)} נקודות מיקום מתועדות במפה`,`${fmt(points.length)} recorded locations on the map`):L('המפה רשומה במקור, אך אין בה קואורדינטות מתועדות לדמות.','The source lists this map, but no NPC coordinates are recorded.')}</p><p class="hunt-distance">${walkDistanceText(distance)}</p>${scopeNote(map)?`<p class="hunt-condition">${esc(scopeNote(map))}</p>`:''}</div><div class="hunt-map-actions"><button type="button" class="button primary" data-hunt-action="npc-positions" data-map="${map.id}" data-npc="${npc.id}" aria-label="${L('הצגת מיקום הדמות במפה','Show NPC location on')} ${esc(map.name)}" ${points.length&&getMap(map.id)?'':'disabled'}>${L('פתיחה וסימון מיקום הדמות','Open and highlight NPC')}</button><button type="button" class="button quiet" data-hunt-action="route" data-map="${map.id}" aria-label="${L('תכנון מסלול למפה','Plan a route to')} ${esc(map.name)}" ${getMap(map.id)?'':'disabled'}>${L('תכנון מסלול','Plan route')}</button></div></article>`)}`;
    const information=`<p class="hunt-note">${L('כל המיקומים שייכים למזהה הדמות שנבחר. דמויות בעלות אותו שם נשמרות בנפרד.','All locations belong to the selected NPC ID. NPCs with the same name are listed separately.')}</p>${sourceLink(npc.sourceUrl,L('הדמות במאגר המקור','NPC in the source database'))}`;
    $('huntBody').innerHTML=detailSections(npc,'npc',maps,information);
    announce(L(`${fmt(places.length)} מפות מתועדות לדמות הזו.`,`${fmt(places.length)} recorded ${places.length===1?'map':'maps'} for this NPC.`));
  }
  function parseOrigin(value) {
    if(window.MapSearch)return window.MapSearch.resolve(value);
    const id=value.match(/\[(\d+)\]\s*$/);
    if(id)return getMap(Number(id[1]));
    const q=norm(value), found=atlasMaps().filter(m=>norm(m.name)===q||String(m.id)===q);
    return found.length===1?found[0]:null;
  }
  function updateOrigin(value) {
    const map=parseOrigin(value); state.originId=map?.id??null; state.originText=map?mapLabel(map):value;
    const input=$('huntOrigin'), note=$('huntOriginNote');
    if($('huntOriginSummary'))$('huntOriginSummary').textContent=map?map.name:L('בחרו מפת מוצא','Choose starting map');
    if(!map&&$('huntRouteOptions'))$('huntRouteOptions').open=true;
    if(input){input.value=state.originText;input.setAttribute('aria-invalid',String(!map));if(map)input.removeAttribute('aria-describedby');else input.setAttribute('aria-describedby','huntOriginNote');}
    if(note){note.hidden=!!map;note.textContent=map?'':originNote();}
    updateOriginSave();
    refreshCandidateOrder();
    if(!map)announce(originNote());
  }
  function updateOriginSave() {
    const button=$('huntBody')?.querySelector('[data-hunt-action="origin-save"]');if(!button)return;
    const map=getMap(state.originId);button.disabled=!map;button.textContent=map&&savedOrigin()===map.id?L('✓ מפת המוצא השמורה','✓ Saved starting map'):L('שמירה כמפת מוצא','Save starting map');
  }
  function refreshCandidateOrder() {
    if(!state.selected&&!state.basketOpen)return;
    const body=$('huntBody'), container=body.querySelector('.hunt-candidates'); if(!container)return;
    const {kind,id}=state.selected||{kind:'basket'};
    const rows=kind==='npc'?npcLocations(npcsById.get(id)):sortCandidates(activeCandidates());
    const recommended=kind!=='npc'&&state.rank==='points'?rows.find(c=>!['event','system','unavailable'].includes(c.map.scope))?.map.id:null;
    const cards=new Map([...container.children].map(card=>[Number(card.dataset.huntMap),card]));
    const scroll=body.scrollTop, active=document.activeElement;
    rows.forEach((row,i)=>{
      const card=cards.get(Number(row.map.id)); if(!card)return;
      card.querySelector('.hunt-rank-number').textContent=String(i+1);
      card.querySelector('.hunt-distance').textContent=walkDistanceText(row.distance);
      card.classList.toggle('hunt-recommended',row.map.id===recommended);
      const badge=card.querySelector('.hunt-recommend-label');if(badge)badge.hidden=row.map.id!==recommended;
      if(container.children[i]!==card)container.insertBefore(card,container.children[i]||null);
    });
    state.resultPage=0;updateResultVisibility(rows);
    if(active?.isConnected && document.activeElement!==active)active.focus({preventScroll:true});
    const comparison=$('huntComparison');if(comparison&&kind!=='npc'){comparison.innerHTML=comparisonContent(rows);}
    body.scrollTop=scroll;
    const order=kind==='npc'||state.rank==='distance'?(getMap(state.originId)?L('סודרו לפי מסלול ההליכה מהמוצא.','Sorted by walking route from the starting map.'):L('בחרו מפת מוצא כדי להשוות מסלולים.','Choose a starting map to compare routes.')):state.rank==='share'?L('סודרו לפי חלק מנקודות ההופעה.','Sorted by share of spawn points.'):L('סודרו לפי מספר נקודות היעד.','Sorted by target spawn point count.');
    announce(`${L(`${fmt(rows.length)} מפות.`,`${fmt(rows.length)} ${rows.length===1?'map':'maps'}.`)} ${order}`);
  }
  function onPanelChange(e) {
    if(e.target.id==='huntDocumented'){state.documented=e.target.checked;state.limit=72;preserveView(renderCatalog);}
    if(e.target.id==='huntRank'){state.rank=e.target.value;refreshCandidateOrder();}
    if(e.target.id==='huntOrigin')updateOrigin(e.target.value);
    if(e.target.id==='huntCreatureType'&&['regular','all','boss'].includes(e.target.value)){state.creatureType=e.target.value;state.limit=72;preserveView(renderCatalog);}
    if(e.target.matches('[data-hunt-target]')){
      const id=Number(e.target.dataset.huntTarget);if(e.target.checked)state.targets.add(id);else state.targets.delete(id);state.resultPage=0;preserveView(renderDetail);
    }
  }
  function onPanelClick(e) {
    const tab=e.target.closest('[data-hunt-tab]');
    if(tab){state.tab=tab.dataset.huntTab;state.selected=null;state.basketOpen=false;pendingDetailFocus=false;state.query='';state.limit=72;render();$('huntBody').scrollTop=0;$('huntSearch')?.focus();return;}
    const entry=e.target.closest('[data-hunt-open]');
    if(entry){open(entry.dataset.huntOpen,entry.dataset.id);$('huntBody').scrollTop=0;return;}
    const button=e.target.closest('[data-hunt-action]');if(!button)return;
    const mid=Number(button.dataset.map);
    switch(button.dataset.huntAction){
      case'close':close();break;
      case'detail-tab':changeDetailTab(button.dataset.section);break;
      case'result-next':case'result-previous':{
        const rows=currentResultRows(),{pages}=resultWindow(rows);
        state.resultPage=Math.max(0,Math.min(pages-1,state.resultPage+(button.dataset.huntAction==='result-next'?1:-1)));
        updateResultVisibility(rows);
        const count=$('huntResultCount');count?.focus({preventScroll:true});count?.scrollIntoView?.({block:'nearest',behavior:'auto'});break;
      }
      case'catalog':state.selected=null;state.basketOpen=false;pendingDetailFocus=false;render();$('huntBody').scrollTop=0;$('huntSearch')?.focus();break;
      case'basket-open':openBasket();break;
      case'basket-toggle':toggleBasket(button.dataset.kind,Number(button.dataset.id));break;
      case'basket-clear':state.basket=[];state.compare=[];state.compareOpen=false;preserveView(render);break;
      case'clear-levels':state.levelMin='';state.levelMax='';state.creatureType='regular';state.limit=72;preserveView(renderCatalog);break;
      case'more':{const first=state.limit;state.limit+=72;renderCatalog();$('huntBody').querySelectorAll('.hunt-entity-card')[first]?.focus();break;}
      case'clear-filter':state.documented=false;state.limit=72;renderCatalog();$('huntBody').scrollTop=0;$('huntSearch')?.focus();break;
      case'retry':boot();render();$('huntSearch')?.focus();break;
      case'retry-drops':retryDrops();break;
      case'compare-toggle':toggleComparison(mid);break;
      case'compare-open':{
        state.compareOpen=!state.compareOpen;preserveView(renderCurrentResults);
        const target=$(state.compareOpen?'huntComparisonTitle':'huntCompareOpen'),body=$('huntBody');
        if(target&&body){target.focus({preventScroll:true});body.scrollTo({top:Math.max(0,body.scrollTop+target.getBoundingClientRect().top-body.getBoundingClientRect().top-12),behavior:'auto'});}
        break;
      }
      case'compare-clear':state.compare=[];state.compareOpen=false;preserveView(renderCurrentResults);announce(L('ההשוואה נוקתה. אפשר לבחור מפות אחרות.','Comparison cleared. You can choose other maps.'));break;
      case'origin-active':{const origin=getMap(defaultOrigin());updateOrigin(origin?mapLabel(origin):'');break;}
      case'origin-save':{
        const origin=getMap(state.originId);if(!origin){$('huntOrigin')?.focus();announce(originNote());break;}
        if(window.AtlasPersonal?.setOrigin?.(origin.id)){
          updateOriginSave();announce(window.AtlasPersonal.storageOk===false?L('מפת המוצא נבחרה לביקור הזה. השמירה בדפדפן אינה זמינה.','Starting map selected for this visit. Browser storage is unavailable.'):L('מפת המוצא נשמרה לביקור הבא.','Starting map saved for your next visit.'));
        }else announce(L('לא ניתן לשמור את מפת המוצא כרגע.','The starting map could not be saved.'));
        break;
      }
      case'map':close({restoreFocus:false});window.Atlas?.selectMap(mid,{focus:true});if(window.AtlasShell)window.AtlasShell.catalogClosed();else $('huntToggle')?.focus({preventScroll:true});break;
      case'route':
        if(!getMap(state.originId)){if($('huntRouteOptions'))$('huntRouteOptions').open=true;$('huntOrigin')?.focus();if($('huntOriginNote'))$('huntOriginNote').hidden=false;announce(originNote());return;}
        {const goal=routeGoal();close({restoreFocus:false});if(goal)window.Atlas?.planTo(mid,Number(state.originId),{goal});else window.Atlas?.planTo(mid,Number(state.originId));$(window.AtlasShell?'startRoute':'routeTo')?.focus({preventScroll:true});break;}
      case'positions':window.Atlas?.openSpawns(mid,button.dataset.mobs.split(',').map(Number));break;
      case'npc-positions':window.Atlas?.openNpcs(mid,[Number(button.dataset.npc)]);break;
    }
  }
  window.Hunt={searchAll,open,close,openBasket,describeGoal,get data(){return data;},get drops(){return dropData;},get dropData(){return dropData;},get dropStatus(){return dropLoading?'loading':dropFailed?'unavailable':data?'ready':'loading';},get catalogStatus(){return data?'ready':catalogFailed?'unavailable':'loading';}};
  window.addEventListener('atlas-ready',()=>boot());
  window.addEventListener('atlas-languagechange',()=>{
    const panel=$('huntPanel');if(!panel)return;
    refreshPanelLanguage(panel);
    if(visible)preserveView(render);
  });
  window.addEventListener('atlas-originchange',updateOriginSave);
  document.addEventListener('click',e=>{if(e.target.closest('#huntToggle')){if(visible)close();else open(state.tab,state.selected?.id);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&visible&&!document.querySelector('dialog[open]'))close();});
  if(window.Atlas)boot();
})();
