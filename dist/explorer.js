'use strict';
// Search and nearby-map exploration use the existing catalogue; positions are never inferred.
(() => {
  const KEY='maple-atlas-location-v1',MAX_QUERY=160,MAX_RESULTS=30;
  const norm=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\u0591-\u05c7]/g,'').replace(/[׳״'"’]/g,'').replace(/\s+/g,' ').trim();
  // Search aliases, not translated game labels. Original names and IDs remain authoritative.
  const aliases={
    'הנסיס':'henesys','אליניה':'ellinia','אלינייה':'ellinia','פריון':'perion','קרנינג':'kerning','סליפיווד':'sleepywood','סליפי ווד':'sleepywood','לית הארבור':'lith harbor','פלורינה':'florina','אמהרסט':'amherst','סאותפרי':'southperry',
    'סטאמפי':'stumpy','סטמפי':'stumpy','סטאמפ':'stump','סטמפ':'stump','סליים':'slime','סלים':'slime','סנייל':'snail','חלזון':'snail','חילזון':'snail','פטריה':'mushroom','פטרייה':'mushroom','מאשרום':'mushroom','משרום':'mushroom','חזיר':'pig','פיג':'pig','סרטנים':'crab','סרטן':'crab','קוף':'monkey','קופים':'monkey',
    'כתום':'orange','כתומה':'orange','ירוק':'green','ירוקה':'green','כחול':'blue','כחולה':'blue','אדום':'red','אדומה':'red','סגול':'purple','סגולה':'purple','צהוב':'yellow','צהובה':'yellow','שחור':'black','שחורה':'black','לבן':'white','לבנה':'white','כהה':'dark','זומבי':'zombie','ברזל':'iron','פראי':'wild','קוצני':'horny','קרני':'horny','סרט':'ribbon','אבן':'stone',
    'גרנדל':'grendel','גרנדל הזקן':'grendel the really old','הלנה':'helena','אתנה':'athena','אתנה פירס':'athena pierce','דארק לורד':'dark lord','דארקלורד':'dark lord','מאנגי':'manji','מנגי':'manji','לאקליס':'lakelis','לקליס':'lakelis','נלה':'nella','שנקס':'shanks','שאנקס':'shanks','רובין':'robin','מריה':'maria','לוקאס':'lucas','מאי':'mai','קודי':'cody','קסנדרה':'cassandra','ברוס':'bruce','גין':'jane','גיין':'jane',
    'מנו':'mano','מאנוׁ':'mano','מאנו':'mano','מלך סליים':'king slime','קינג סליים':'king slime','מאמא פטריה':'mushmom','מאשמום':'mushmom','מושמום':'mushmom','דייל':'dyle','פאוסט':'faust','זומבי מאשמום':'zombie mushmom','פיאנוס':'pianus','באלרוג':'balrog','בלרוג':'balrog','גולם':'golem','דרייק':'drake','ויקינג':'viking','וייקינג':'viking','בובלי':'bubbling','בבלינג':'bubbling','אוקטופוס':'octopus',
    'חרב':'sword','מגן':'shield','כפפה':'glove','כפפות':'gloves','קסדה':'helmet','כובע':'hat','מגפיים':'boots','נעליים':'shoes','שיקוי':'potion','שרביט':'wand','מטה':'staff','קשת':'bow','חץ':'arrow','חצים':'arrows','גרזן':'axe','חנית':'spear','פגיון':'dagger','טבעת':'ring','עגיל':'earring','עגילים':'earrings','גלימה':'cape','מגילה':'scroll','יהלום':'diamond','עור':'leather','נוצה':'feather','עץ':'wood'
  };
  const aliasEntries=Object.entries(aliases).map(([he,en])=>[norm(he),norm(en)]).sort((a,b)=>b[0].length-a[0].length);
  const regions=[
    {id:'world',name:'World',he:'כל העולם'}, {id:'victoria',name:'Victoria Island',he:'ויקטוריה'},
    {id:'maple',name:'Maple Island',he:'אי המתחילים'}, {id:'hollow',name:'Forgotten Hollow',he:'החלל הנשכח'},
    {id:'special',name:'Market and quests',he:'שוק ומשימות'}, {id:'archive',name:'Events and system',he:'אירועים ומערכת'}
  ];
  const validId=(id,maps)=>Number.isSafeInteger(id)&&maps.has(id);
  function normalizeLocation(value,maps){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)return {version:1,current:null,recent:[]};
    const current=validId(value.current,maps)?value.current:null;
    const recent=Array.isArray(value.recent)?[...new Set(value.recent.filter(id=>validId(id,maps)))].slice(0,4):[];
    return {version:1,current,recent:current!==null?[current,...recent.filter(id=>id!==current)].slice(0,4):recent};
  }
  function queryTokens(value){
    let text=norm(String(value??'').slice(0,MAX_QUERY));
    for(const [he,en]of aliasEntries)text=text.replace(new RegExp(`(^| )${he}(?= |$)`,'g'),(_,space)=>space+en);
    return text.split(' ').filter(Boolean);
  }
  function indexEntry(entry,kind,terms=''){
    const name=norm(entry.name),localized=aliasEntries.filter(([,en])=>name.includes(en)).map(([he])=>he).join(' ');
    return {kind,id:entry.id,name:entry.name,entry,text:norm(`${entry.name} ${entry.id} ${terms} ${localized}`),nameText:name};
  }
  function makeIndex(maps,catalog={},groups=[]){
    const groupNames=new Map(groups.map(group=>[group.id,`${group.he||''} ${group.en||''}`]));
    return [
      ...maps.map(map=>indexEntry(map,'map',`${map.street||''} ${groupNames.get(map.group)||''}`)),
      ...regions.map(region=>indexEntry(region,'region',region.he)),
      ...(catalog.monsters||[]).map(entry=>indexEntry(entry,entry.isBoss?'boss':'monster')),
      ...(catalog.npcs||[]).map(entry=>indexEntry(entry,'npc')),
      ...(catalog.items||[]).map(entry=>indexEntry(entry,'item'))
    ];
  }
  function search(index,value,limit=MAX_RESULTS){
    const tokens=queryTokens(value);if(!tokens.length)return [];
    const query=tokens.join(' '),max=Number.isSafeInteger(limit)&&limit>=0?Math.min(limit,100):MAX_RESULTS;
    return index.filter(entry=>tokens.every(token=>entry.text.includes(token))).sort((a,b)=>
      Number(b.nameText===query)-Number(a.nameText===query)||Number(String(b.id)===query)-Number(String(a.id)===query)||
      Number(b.nameText.startsWith(query))-Number(a.nameText.startsWith(query))||a.name.localeCompare(b.name)||String(a.id).localeCompare(String(b.id))).slice(0,max);
  }
  function entityMaps(entry,kind,maps){
    const locations=kind==='npc'?(entry?.maps||[]).filter(location=>Array.isArray(location.points)&&location.points.length):(entry?.spawns||[]).filter(location=>Number(location.count)>0);
    return [...new Set(locations.map(location=>location.mapId).filter(id=>validId(id,maps)))];
  }
  function nearest(origin,candidates,findRoute,services=false){
    if(!Number.isSafeInteger(origin)||typeof services!=='boolean')return null;
    let best=null;
    for(const id of [...new Set(candidates)]){
      if(!Number.isSafeInteger(id))continue;
      const route=findRoute(origin,id,services);if(!route||!Number.isFinite(route.cost)||route.cost<0||!Array.isArray(route.steps))continue;
      if(!best||route.cost<best.route.cost||route.cost===best.route.cost&&(route.steps.length<best.route.steps.length||route.steps.length===best.route.steps.length&&id<best.id))best={id,route};
    }
    return best;
  }
  function summarizeMonsters(reachable,catalog){
    const ids=new Set(reachable.map(map=>map.id)),counts=new Map();
    for(const monster of catalog?.monsters||[]){const places=(monster.spawns||[]).filter(spawn=>ids.has(spawn.mapId)&&Number(spawn.count)>0);if(places.length)counts.set(monster.id,{id:monster.id,name:monster.name,maps:[...new Set(places.map(spawn=>spawn.mapId))],points:places.reduce((sum,spawn)=>sum+Number(spawn.count),0)});}
    return [...counts.values()].sort((a,b)=>b.maps.length-a.maps.length||a.name.localeCompare(b.name));
  }
  globalThis.AtlasExplorerCore={normalizeLocation,queryTokens,makeIndex,search,entityMaps,nearest,summarizeMonsters,MAX_QUERY};
  if(typeof document==='undefined'||typeof window==='undefined')return;

  const $=id=>document.getElementById(id),L=(he,en)=>window.AtlasI18n?.text?.(he,en)??he;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let maps=new Map(),index=[],state={version:1,current:null,recent:[]},storageOk=true,initialized=false,opener=null,skipFocus=false;
  let reach={from:null,hops:1,open:false,services:false,results:[]};
  const labels=()=>({map:L('מפה','Map'),region:L('אזור','Region'),monster:L('מפלצת','Monster'),boss:L('בוס','Boss'),npc:L('דמות','NPC'),item:L('פריט','Item')});
  const currentOrigin=()=>state.current??(validId(window.AtlasPersonal?.getOrigin?.(),maps)?window.AtlasPersonal.getOrigin():null)??(validId(window.Atlas?.activeMap,maps)?window.Atlas.activeMap:null);
  function readLocation(){
    try{const raw=localStorage.getItem(KEY);state=normalizeLocation(raw&&raw.length<=1000?JSON.parse(raw):null,maps);}catch{storageOk=false;}
  }
  function rememberMap(id){
    if(!maps.size&&window.Atlas)maps=new Map(window.Atlas.data.maps.map(map=>[map.id,map]));
    if(!validId(id,maps))return false;
    if(!initialized){readLocation();initialized=true;}
    state={version:1,current:id,recent:[id,...state.recent.filter(recent=>recent!==id)].slice(0,4)};
    try{localStorage.setItem(KEY,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}
    renderBreadcrumbs();return true;
  }
  function renderBreadcrumbs(){
    const host=$('atlasBreadcrumbs');if(!host)return;
    host.hidden=!state.recent.length;
    host.setAttribute('aria-label',L('ארבע המפות האחרונות','Last four maps'));
    host.innerHTML=state.recent.map(id=>`<button type="button" data-explore-map="${id}" ${id===state.current?'aria-current="location"':''} title="${esc(L('חזרה למפה','Return to map'))}"><span aria-hidden="true">${id===state.current?'⌖':'·'}</span><bdi>${esc(maps.get(id)?.name)}</bdi></button>`).join('')+(!storageOk?`<span class="breadcrumb-storage" role="status">${L('ללשונית בלבד','This tab only')}</span>`:'');
    host.title=storageOk?L('המיקום מתעדכן כשפותחים מפה באטלס, ולא מתוך המשחק.','Location follows maps you open in the atlas, not the live game.'):L('שמירת המיקום אינה זמינה; המיקום נשמר רק עד סגירת הלשונית.','Location storage is unavailable; it lasts only for this tab.');
  }
  function paletteLanguage(){
    $('commandTitle').textContent=L('לאן ממשיכים?','Where to next?');
    $('commandQuery').placeholder=L('מפה, מפלצת, דמות, פריט או אזור…','Map, monster, NPC, item or region…');
    $('commandQuery').setAttribute('aria-label',L('חיפוש בכל האטלס','Search the whole atlas'));
    $('commandClose').setAttribute('aria-label',L('סגירת חיפוש','Close search'));
    $('commandHunt').textContent=L('כלי ציד והשוואת מפות','Hunting tools & map comparison');
    $('commandServicesLabel').textContent=L('כולל שיגורים ומשימות','Include teleports and quests');
    $('commandHelp').textContent=L('שמות מקור באנגלית וכינויים נפוצים בעברית · Tab לפעולות · Esc לסגירה','Original English names and common Hebrew aliases · Tab for actions · Esc to close');
  }
  function ensureUI(){
    if($('commandDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='commandDialog';dialog.className='command-dialog';dialog.setAttribute('aria-labelledby','commandTitle');
    dialog.innerHTML=`<header class="command-heading"><h2 id="commandTitle"></h2><button id="commandClose" type="button" class="icon-button">×</button></header><div class="command-input-row"><span aria-hidden="true">⌕</span><input id="commandQuery" type="search" dir="auto" maxlength="${MAX_QUERY}" autocomplete="off" aria-controls="commandResults" aria-describedby="commandHelp"><kbd>Esc</kbd></div><div class="command-origin"><p id="commandOrigin"></p><label><input id="commandServices" type="checkbox"><span id="commandServicesLabel"></span></label></div><p id="commandStatus" class="command-status" role="status" aria-live="polite"></p><div id="commandResults" class="command-results"></div><footer class="command-footer"><button id="commandHunt" type="button" class="button quiet"></button><small id="commandHelp"></small></footer>`;
    const crumbs=document.createElement('nav');crumbs.id='atlasBreadcrumbs';crumbs.className='atlas-breadcrumbs';crumbs.hidden=true;
    document.body.append(dialog,crumbs);
    $('commandClose').addEventListener('click',()=>closeSearch());
    dialog.addEventListener('cancel',()=>{skipFocus=true;});
    $('commandQuery').addEventListener('input',renderSearch);
    $('commandQuery').addEventListener('keydown',event=>{if(!event.isComposing&&event.key==='ArrowDown'){const first=$('commandResults').querySelector('button:not([disabled])');if(first){event.preventDefault();first.focus();}}});
    $('commandServices').addEventListener('change',renderSearch);
    $('commandHunt').addEventListener('click',()=>{closeSearch(false);window.Hunt?.open('monster');});
    dialog.addEventListener('close',()=>{skipFocus=true;if(opener?.isConnected)opener.focus({preventScroll:true});queueMicrotask(()=>{skipFocus=false;});});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSearch();}});
    dialog.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.hidden=true;},true);
    $('commandResults').addEventListener('click',handleSearchAction);
    paletteLanguage();
  }
  function closeSearch(restoreFocus=true){skipFocus=true;if(!restoreFocus)opener=null;$('commandDialog')?.close();}
  function openSearch(query=''){
    if(!window.Atlas)return false;ensureUI();const dialog=$('commandDialog');
    if(!dialog.open){opener=document.activeElement;for(const id of ['appearanceDialog','personalDialog'])if($(id)?.open)$(id).close();dialog.showModal();}
    $('searchResults')&&( $('searchResults').hidden=true );$('search')?.setAttribute('aria-expanded','false');
    $('commandQuery').value=String(query).slice(0,MAX_QUERY);$('commandServices').checked=!!$('useServices')?.checked;
    paletteLanguage();renderSearch();$('commandQuery').focus();return true;
  }
  function renderSearch(){
    const query=$('commandQuery')?.value||'',host=$('commandResults');if(!host)return;
    const origin=maps.get(currentOrigin()),catalog=window.Hunt?.data;
    $('commandOrigin').textContent=origin?L(`מוצא לחיפוש: ${origin.name}`,`Search starts at: ${origin.name}`):L('פתחו מפה באטלס כדי לבחור מוצא לניווט.','Open a map to choose a navigation start.');
    $('commandOrigin').title=L('מוצא שנבחר באטלס; אין חיבור למיקום השחקן במשחק.','A start selected in the atlas; no live player location is available.');
    const found=search(index,query),kindLabels=labels();
    const catalogueStatus=window.Hunt?.catalogStatus;
    const catalogueNotice=catalogueStatus==='unavailable'?L('קטלוג המפלצות והפריטים לא נטען. כלי הציד מאפשרים ניסיון נוסף.','Monster and item catalogue unavailable. Open hunting tools to retry.'):catalogueStatus!=='ready'?L('קטלוג המפלצות, הדמויות והפריטים עדיין נטען…','Monster, NPC and item catalogue is still loading…'):'';
    $('commandStatus').textContent=[query.trim()?(found.length===MAX_RESULTS?L(`מוצגות ${MAX_RESULTS} התאמות. הוסיפו טקסט לצמצום.`,`Showing ${MAX_RESULTS} matches. Type more to narrow results.`):L(`${found.length} תוצאות`,`${found.length} results`)):'',catalogueNotice].filter(Boolean).join(' · ');
    if(!query.trim()){
      host.innerHTML=`<p class="command-empty">${L('אפשר לחפש יעד, מפלצת או דמות — גם בעברית.','Find a destination, monster or NPC — Hebrew aliases work too.')}</p><div class="command-recent">${state.recent.map(id=>`<button class="button quiet" type="button" data-command="view" data-kind="map" data-id="${id}"><bdi>${esc(maps.get(id)?.name)}</bdi></button>`).join('')}</div>`;return;
    }
    host.innerHTML=found.map(result=>{
      const locations=entityMaps(result.entry,result.kind,maps),isCreature=result.kind==='monster'||result.kind==='boss',canRoute=isCreature||result.kind==='npc';
      const image=/^assets\/[\w/.-]+$/.test(result.entry.icon||'')?`<img src="${esc(result.entry.icon)}" alt="" loading="lazy">`:`<span class="command-symbol" aria-hidden="true">${result.kind==='map'?'⌖':result.kind==='region'?'◉':result.kind==='npc'?'◇':'✦'}</span>`;
      const quick=canRoute&&locations.length?`<button class="button command-nearest" type="button" data-command="nearest" data-kind="${result.kind}" data-id="${result.id}" ${origin?'':'disabled'}>${L('נווט למיקום הקרוב','Navigate to nearest')}</button>`:'';
      const locationRows=canRoute?locations.map(id=>`<div class="command-map-row"><button type="button" data-command="positions" data-kind="${result.kind}" data-id="${result.id}" data-map="${id}"><bdi>${esc(maps.get(id).name)}</bdi></button><button type="button" class="button quiet" data-command="route" data-kind="${result.kind}" data-id="${result.id}" data-map="${id}" ${origin?'':'disabled'}>${L('נווט לכאן','Navigate here')}</button></div>`):[];
      return `<article class="command-result"><div class="command-result-head"><button type="button" class="command-open" data-command="view" data-kind="${result.kind}" data-id="${esc(result.id)}">${image}<span><bdi>${esc(result.kind==='region'?L(result.entry.he,result.name):result.name)}</bdi><small>${esc(kindLabels[result.kind])} · ${esc(result.id)}</small></span></button>${quick}</div>${locationRows.length?`<div class="command-locations">${locationRows.slice(0,3).join('')}${locationRows.length>3?`<details><summary>${L(`עוד ${locationRows.length-3} מפות`,`${locationRows.length-3} more maps`)}</summary>${locationRows.slice(3).join('')}</details>`:''}</div>`:canRoute?`<p class="command-empty">${L('אין מיקום מתועד; לא ניתן להמציא יעד לניווט.','No location is recorded; a navigation destination is unavailable.')}</p>`:''}</article>`;
    }).join('')||`<p class="command-empty">${L('לא נמצאה התאמה. נסו שם באנגלית, כינוי בעברית או מזהה.','No match. Try an English name, Hebrew alias or ID.')}</p>`;
  }
  function handleSearchAction(event){
    const button=event.target.closest('[data-command]');if(!button)return;
    const {command,kind}=button.dataset,id=kind==='region'?button.dataset.id:Number(button.dataset.id);
    const record=index.find(entry=>entry.kind===kind&&entry.id===id);if(!record)return;
    if(command==='view'){
      closeSearch(false);
      if(kind==='map'){window.Hunt?.close({restoreFocus:false});if($('sceneDialog')?.open)$('sceneDialog').close();window.Atlas.selectMap(id,{focus:true});window.AtlasShell?.showDrawer('details');}
      else if(kind==='region'){if($('sceneDialog')?.open)$('sceneDialog').close();document.querySelector(`.region-nav [data-region="${record.id}"]`)?.click();}
      else window.Hunt?.open(kind,id);
      return;
    }
    if(command==='positions'){
      const mapId=Number(button.dataset.map);if(!entityMaps(record.entry,kind,maps).includes(mapId))return;
      closeSearch(false);if(kind==='npc')window.Atlas.openNpcs(mapId,[id]);else window.Atlas.openSpawns(mapId,[id]);return;
    }
    if(command!=='nearest'&&command!=='route')return;
    const origin=currentOrigin(),services=$('commandServices').checked,candidates=entityMaps(record.entry,kind,maps);if(origin===null)return;
    const destination=command==='nearest'?nearest(origin,candidates,window.Atlas.findRoute,services)?.id:Number(button.dataset.map);
    if(!candidates.includes(destination)||!window.Atlas.findRoute(origin,destination,services)){$('commandStatus').textContent=L('לא נמצא מסלול לפי ההגדרות שנבחרו. אפשר לאפשר שיגורים ומשימות או לבחור מוצא אחר.','No route with these settings. Try allowing teleports and quests or choose another start.');return;}
    const goal=kind==='npc'?undefined:{kind:'hunt',targets:[{kind,id}],monsterIds:[id]};
    const success=window.Atlas.planJourney({from:origin,to:destination,services,step:0,...(goal?{goal}:{})});
    if(success){closeSearch(false);window.AtlasShell?.showDrawer('route');$('startRoute')?.focus({preventScroll:true});}
    else $('commandStatus').textContent=L('לא ניתן היה לפתוח את המסלול. נסו שוב.','Could not open the route. Please try again.');
  }
  function clearReachability(){
    reach={...reach,open:false,results:[]};for(const node of document.querySelectorAll('.world-node[data-map]')){node.classList.remove('reachable-map','reachability-origin');node.removeAttribute('data-reach-hops');}
    document.getElementById('worldSvg')?.classList.remove('reachability-active');renderReachability();
  }
  function computeReachability(){
    if(!validId(reach.from,maps))return;
    const focused=document.activeElement,focusedHops=focused?.dataset.explorerHops,focusedServices=focused?.id==='reachServices';
    reach.results=window.Atlas?.reachable?.(reach.from,reach.hops,reach.services)||[];
    const ids=new Map(reach.results.map(result=>[result.id,result.hops]));
    for(const node of document.querySelectorAll('.world-node[data-map]')){const id=Number(node.dataset.map);node.classList.toggle('reachable-map',ids.has(id));node.classList.toggle('reachability-origin',id===reach.from);if(ids.has(id))node.dataset.reachHops=String(ids.get(id));else node.removeAttribute('data-reach-hops');}
    $('worldSvg')?.classList.add('reachability-active');renderReachability();
    if(focusedHops)document.querySelector(`[data-explorer-hops="${focusedHops}"]`)?.focus({preventScroll:true});
    else if(focusedServices)$('reachServices')?.focus({preventScroll:true});
  }
  function renderReachability(){
    const mapId=window.Atlas?.activeMap,root=$('mapDetails');if(!validId(mapId,maps)||!root)return;
    if(reach.open&&mapId!==reach.from){clearReachability();return;}
    let host=$('reachability');if(!host||!root.contains(host)){host=document.createElement('section');host.id='reachability';host.className='reachability';root.append(host);}
    host.innerHTML=`<button type="button" class="button quiet reachability-toggle" data-explorer-reach="toggle" aria-expanded="${reach.open}">${L('מה נמצא במרחק 1–3 מעברים?','What is 1–3 passages away?')} <span aria-hidden="true">${reach.open?'−':'+'}</span></button>${reach.open?`<div class="reachability-body"><div class="reachability-controls" role="group" aria-label="${L('מספר מעברים','Number of passages')}">${[1,2,3].map(hops=>`<button type="button" data-explorer-hops="${hops}" aria-pressed="${reach.hops===hops}">${hops}</button>`).join('')}</div><label class="check-row"><input type="checkbox" id="reachServices" ${reach.services?'checked':''}><span>${L('כולל שיגורים ומשימות','Include teleports and quests')}</span></label><p role="status">${L(`${reach.results.length} מפות נגישות דרך המעברים המתועדים.`,`${reach.results.length} maps reachable through documented passages.`)}</p><div class="reachability-maps">${reach.results.map(result=>`<button type="button" data-explore-map="${result.id}"><bdi>${esc(maps.get(result.id)?.name)}</bdi><small>${result.hops}</small></button>`).join('')||`<p>${L('לא נמצאו מפות בטווח הזה.','No maps found within this range.')}</p>`}</div><details class="reachability-monsters"><summary>${L('מפלצות במפות הקרובות','Monsters on nearby maps')}</summary>${window.Hunt?.catalogStatus==='ready'?summarizeMonsters(reach.results,window.Hunt.data).map(monster=>`<button type="button" data-explorer-monster="${monster.id}"><bdi>${esc(monster.name)}</bdi><small>${L(`${monster.maps.length} מפות`,`${monster.maps.length} maps`)}</small></button>`).join('')||`<p>${L('אין הופעות מתועדות בטווח הזה.','No recorded spawns in this range.')}</p>`:`<p>${window.Hunt?.catalogStatus==='unavailable'?L('הקטלוג אינו זמין. פתחו את כלי הציד לניסיון נוסף.','Catalogue unavailable. Open hunting tools to retry.'):L('נתוני המפלצות עדיין נטענים…','Monster data is still loading…')}</p>`}</details><p class="reachability-note">${L('המסלולים מכוונים. קִרבה אינה מבטיחה דרך חזרה; תנאי כניסה עדיין חלים.','Passages are directed. Nearby does not guarantee a return route; entry requirements still apply.')}</p></div>`:''}`;
  }
  function refresh(){
    if(!window.Atlas)return;maps=new Map(window.Atlas.data.maps.map(map=>[map.id,map]));
    if(!initialized){
      readLocation();initialized=true;
      // An explicit map link opens a place before the atlas-ready event fires.
      const hash=typeof location!=='undefined'&&location.hash.length<=8192?location.hash.slice(1):'',params=new URLSearchParams(hash),mapText=params.get('map');
      if(!params.has('route')&&/^\d+$/.test(mapText||'')&&validId(Number(mapText),maps))rememberMap(Number(mapText));
    }
    index=makeIndex([...maps.values()],window.Hunt?.data||{},window.Atlas.data.groups||[]);
    ensureUI();renderBreadcrumbs();renderReachability();if($('commandDialog').open){paletteLanguage();renderSearch();}
  }
  window.AtlasExplorer={getCurrentMap:()=>state.current,rememberMap,openSearch,refresh,clearReachability};
  document.addEventListener('click',event=>{
    const map=event.target.closest('[data-explore-map]');if(map){const id=Number(map.dataset.exploreMap);if(validId(id,maps)){if($('sceneDialog')?.open)$('sceneDialog').close();window.Atlas.selectMap(id,{focus:true});window.AtlasShell?.showDrawer('details');}return;}
    const toggle=event.target.closest('[data-explorer-reach]');if(toggle){if(reach.open){clearReachability();return;}reach={from:window.Atlas.activeMap,hops:reach.hops,services:false,open:true,results:[]};if($('sceneDialog')?.open)$('sceneDialog').close();document.querySelector('.region-nav [data-region="world"]')?.click();computeReachability();return;}
    const hops=event.target.closest('[data-explorer-hops]');if(hops){reach.hops=Number(hops.dataset.explorerHops);computeReachability();return;}
    const monster=event.target.closest('[data-explorer-monster]');if(monster){window.Hunt?.open('monster',Number(monster.dataset.explorerMonster));}
  });
  document.addEventListener('change',event=>{if(event.target.id==='reachServices'){reach.services=event.target.checked;computeReachability();}});
  document.addEventListener('focusin',event=>{if(event.target.id==='search'&&!skipFocus&&!$('commandDialog')?.open){event.stopImmediatePropagation();openSearch(event.target.value);}},true);
  document.addEventListener('click',event=>{if(event.target.id==='search'&&!$('commandDialog')?.open){event.stopImmediatePropagation();openSearch(event.target.value);}},true);
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.altKey)return;
    const shortcut=(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k',typing=event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    if(!shortcut&&(event.key!=='/'||typing||event.ctrlKey||event.metaKey))return;
    if(document.querySelector('dialog[open]:not(#sceneDialog):not(#commandDialog):not(#appearanceDialog):not(#personalDialog)'))return;
    event.preventDefault();event.stopImmediatePropagation();openSearch();
  },true);
  window.addEventListener('atlas-ready',refresh);window.addEventListener('hunt-ready',refresh);window.addEventListener('hunt-unavailable',refresh);
  window.addEventListener('atlas-viewchange',()=>{renderBreadcrumbs();renderReachability();});
  window.addEventListener('atlas-languagechange',()=>{if($('commandDialog'))paletteLanguage();renderBreadcrumbs();renderReachability();if($('commandDialog')?.open)renderSearch();});
  window.addEventListener('storage',event=>{if(event.key===KEY&&storageOk){readLocation();renderBreadcrumbs();}});
  if(window.Atlas)refresh();
})();
