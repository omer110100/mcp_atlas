'use strict';
// Local interface preferences and small entry points. No network calls or account data.
(() => {
  const KEY='maple-atlas-experience-v1', RELEASE='expedition-20261120';
  const $=id=>document.getElementById(id);
  const L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  let state={version:1,welcomeSeen:false,readability:false,sidebarWidth:null,lastSeenRelease:'',view:'map'};
  let storageOk=true,ready=false,drag=null,resizeFrame=0;
  try {
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved?.version===1)state={version:1,welcomeSeen:saved.welcomeSeen===true,readability:saved.readability===true,
      sidebarWidth:Number.isFinite(saved.sidebarWidth)&&saved.sidebarWidth>=300&&saved.sidebarWidth<=520?saved.sidebarWidth:null,
      lastSeenRelease:typeof saved.lastSeenRelease==='string'?saved.lastSeenRelease.slice(0,60):'',view:saved.view==='list'?'list':'map'};
  } catch {storageOk=false;}
  const labels={
    tools:['כלים למסע','Journey tools'],welcome:['מאיפה מתחילים?','Start exploring'],shortcuts:['קיצורי מקלדת','Keyboard shortcuts'],news:['מה חדש','What’s new'],newBadge:['חדש','New'],
    report:['דיווח על בעיה','Report a problem'],reportHelp:['פתיחת טיוטת דיווח ב־GitHub; הדיווח לא נשלח אוטומטית.','Open a draft on GitHub; nothing is submitted automatically.'],
    support:['תמיכה באטלס','Support the atlas'],supportNote:['נהנים מהאטלס? אפשר לתמוך בפרויקט, לבחירתכם.','Finding the atlas useful? Supporting the project is optional.'],
    readability:['נוח יותר לקרוא','Comfortable reading'],readabilityToggle:['טקסט מרווח וכפתורים גדולים יותר','Roomier text and larger controls'],readabilityHelp:['יותר מקום לקריאה, בלי לשנות את המפה או את מיקומי השערים.','More room to read, with map and portal positions preserved.'],
    resetWidth:['איפוס רוחב חלונית הפרטים','Reset details panel width'],view:['תצוגת האטלס','Atlas view'],map:['מפה','Map'],list:['גלויות','Postcards'],search:['חיפוש','Search'],route:['מסלול','Route'],places:['המקומות שלי','My places'],
    welcomeEyebrow:['כל עולם מתחיל בשער','Every world begins with a portal'],welcomeTitle:['לאן יוצאים היום?','Where are we headed?'],welcomeIntro:['חפשו מקום, תכננו מסלול או מצאו את מפת הציד הבאה שלכם.','Find a place, plan a route, or choose your next hunting map.'],
    welcomeSearch:['למצוא משהו','Find something'],welcomeSearchNote:['מפות, פריטים, מפלצות ודמויות','Maps, items, monsters, and NPCs'],welcomeRoute:['לתכנן מסע','Plan a journey'],welcomeRouteNote:['מוצא, יעד והשערים שבדרך','A start, a destination, and every portal along the way'],welcomeHunt:['למצוא מקום לצוד','Find a hunting spot'],welcomeHuntNote:['נקודות הופעה, המלצות והשוואת מפות','Spawn points, suggestions, and map comparisons'],welcomeSkip:['פשוט להסתכל במפה','Just explore the map'],
    close:['סגירה','Close'],keyboardTitle:['הדרך הקצרה באטלס','Shortcuts through the atlas'],keyboardIntro:['הקיצורים פועלים כשלא מקלידים בשדה.','Shortcuts work when you are not typing in a field.'],keyboardSearch:['מיקוד בחיפוש האחיד','Focus unified search'],keyboardHelp:['פתיחת העזרה הזאת','Open this help'],keyboardClose:['סגירת החלונית הפעילה','Close the active dialog'],keyboardResult:['מעבר בתוצאות חיפוש ובחירה','Move through search results and select'],keyboardScene:['בתוך חלונית ניווט פעילה','Inside an active navigation dialog'],keyboardNext:['לשלב הבא במסלול','Next route step'],keyboardPrevious:['לשלב הקודם במסלול','Previous route step'],keyboardFocus:['מיקוד בשער היציאה','Focus the exit portal'],keyboardResize:['רוחב חלונית הפרטים: מיקוד במפריד ואז חיצים ימינה/שמאלה.','Details width: focus the divider, then use the left/right arrow keys.'],
    releaseTitle:['המסע ממשיך','The journey continues'],releaseDate:['עדכון 20 בנובמבר 2026','November 20, 2026 update'],releaseIntro:['השיפורים האחרונים שמחכים לכם באטלס.','The latest improvements waiting in your atlas.'],
    releaseOne:['שלוש אווירות עיצוב, עברית ואנגלית, וגלויות לכל מפה.','Three visual themes, Hebrew and English, and postcard map collections.'],
    releaseTwo:['ניווט דרך שערים, התקדמות במסלול וחישוב מחדש אחרי סטייה.','Portal navigation, route progress, and recalculation after a detour.'],
    releaseThree:['כלים לתכנון מסע וציד, שמירת מקומות והשוואת מפות.','Journey and hunting tools, saved places, and map comparisons.'],
    releaseFour:['תצוגה נוחה לקריאה, ניווט בנייד, קיצורי מקלדת ועזרה בהקשר הנכון.','Comfortable reading, mobile navigation, keyboard shortcuts, and contextual help.'],
    releaseDone:['יוצאים לדרך','Let’s explore'],resize:['שינוי רוחב חלונית הפרטים','Resize the details panel'],mobileNav:['ניווט מהיר','Quick navigation']
  };
  const text=key=>L(...labels[key]);
  const label=(key,tag='span')=>`<${tag} data-xp-label="${key}"></${tag}>`;
  const glyphs={search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',route:'<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h5"/>',map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',star:'<path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9z"/>',hunt:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',list:'<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><path d="M3 16h7M3 20h7M14 16h7M14 20h7"/>'};
  const icon=name=>`<span class="xp-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${glyphs[name]||glyphs.map}</svg></span>`;
  const element=(tag,attrs,content)=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(content)node.innerHTML=content;return node;};
  const closeButton=()=>`<button type="button" class="icon-button" data-xp-close data-xp-title="close">×</button>`;
  const tools=element('section',{id:'experienceTools',class:'experience-tools','data-xp-aria':'tools'},`
    <div class="experience-utility"><button type="button" data-xp-action="welcome">${label('welcome')}</button><button type="button" data-xp-action="shortcuts">${label('shortcuts')}</button><button type="button" data-xp-action="news">${label('news')} <span class="experience-new" data-xp-label="newBadge"></span></button></div>
    <a id="experienceReport" class="experience-report" href="https://github.com/omer110100/mcp_atlas/issues/new" target="_blank" rel="noopener noreferrer" data-xp-title="reportHelp">${label('report')} <span aria-hidden="true">↗</span></a>
    <div class="experience-support"><p data-xp-label="supportNote"></p><a href="https://buymeacoffee.com/omerlabinsky" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">☕</span>${label('support')} <span aria-hidden="true">↗</span></a></div>`);
  $('sidePanel').insertBefore(tools,document.querySelector('.panel-footer'));
  const viewToggle=element('div',{class:'experience-view',role:'group','data-xp-aria':'view'},`<button type="button" data-xp-view="map" aria-pressed="true">${icon('map')}${label('map')}</button><button type="button" data-xp-view="list" aria-pressed="false">${icon('list')}${label('list')}</button>`);
  document.querySelector('.map-topbar').append(viewToggle);
  document.documentElement.classList.add('has-experience');
  const mobile=element('nav',{id:'mobileNav',class:'mobile-navigation','data-xp-aria':'mobileNav'},[['search','search'],['route','route'],['places','star'],['map','map']].map(([action,g])=>`<button type="button" data-xp-mobile="${action}"${action==='map'?' aria-current="page"':''}>${icon(g)}${label(action)}</button>`).join(''));
  document.body.append(mobile);
  const welcome=element('dialog',{id:'welcomeDialog',class:'experience-dialog welcome-dialog','aria-labelledby':'welcomeTitle'},`<header class="experience-dialog-heading"><div>${label('welcomeEyebrow','small')}<h2 id="welcomeTitle" data-xp-label="welcomeTitle"></h2></div>${closeButton()}</header><p data-xp-label="welcomeIntro"></p><div class="welcome-actions">${[['search','welcomeSearch','welcomeSearchNote','search'],['route','welcomeRoute','welcomeRouteNote','route'],['hunt','welcomeHunt','welcomeHuntNote','hunt']].map(([action,title,note,g])=>`<button type="button" data-xp-start="${action}">${icon(g)}<span><strong data-xp-label="${title}"></strong><small data-xp-label="${note}"></small></span><span aria-hidden="true">↗</span></button>`).join('')}</div><button type="button" class="button quiet full" data-xp-close data-xp-label="welcomeSkip"></button>`);
  const shortcuts=element('dialog',{id:'shortcutDialog',class:'experience-dialog shortcut-dialog','aria-labelledby':'shortcutTitle'},`<header class="experience-dialog-heading"><h2 id="shortcutTitle" data-xp-label="keyboardTitle"></h2>${closeButton()}</header><p data-xp-label="keyboardIntro"></p><dl class="shortcut-list"><div><dt><kbd>/</kbd></dt><dd data-xp-label="keyboardSearch"></dd></div><div><dt><kbd>?</kbd></dt><dd data-xp-label="keyboardHelp"></dd></div><div><dt><kbd>Esc</kbd></dt><dd data-xp-label="keyboardClose"></dd></div><div><dt><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></dt><dd data-xp-label="keyboardResult"></dd></div></dl><h3 data-xp-label="keyboardScene"></h3><dl class="shortcut-list">${[['N','keyboardNext'],['P','keyboardPrevious'],['F','keyboardFocus']].map(([key,description])=>`<div><dt><kbd>${key}</kbd></dt><dd data-xp-label="${description}"></dd></div>`).join('')}</dl><p class="experience-desktop-only" data-xp-label="keyboardResize"></p>`);
  const release=element('dialog',{id:'releaseDialog',class:'experience-dialog release-dialog','aria-labelledby':'releaseTitle'},`<header class="experience-dialog-heading"><div>${label('releaseDate','small')}<h2 id="releaseTitle" data-xp-label="releaseTitle"></h2></div>${closeButton()}</header><p data-xp-label="releaseIntro"></p><ul class="release-notes">${['releaseOne','releaseTwo','releaseThree','releaseFour'].map(key=>`<li data-xp-label="${key}"></li>`).join('')}</ul><button type="button" class="button primary full" data-xp-close data-xp-label="releaseDone"></button>`);
  document.body.append(welcome,shortcuts,release);
  const readability=element('section',{class:'appearance-section experience-readability'},`<h3 data-xp-label="readability"></h3><label class="check-row"><input id="readabilityToggle" type="checkbox">${label('readabilityToggle')}</label><p data-xp-label="readabilityHelp"></p><button type="button" class="button quiet experience-desktop-only" id="resetSidebarWidth" data-xp-label="resetWidth"></button><p id="experienceStorage" class="personal-storage" role="status"></p>`);
  $('appearanceDialog').insertBefore(readability,$('appearanceStorage'));
  const divider=element('div',{id:'sidePanelResizeHandle',class:'side-panel-resizer',role:'separator',tabindex:'0','aria-orientation':'vertical','aria-controls':'sidePanel','aria-valuemin':'300','aria-valuemax':'520','data-xp-aria':'resize'});
  document.querySelector('.workspace').append(divider);
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}renderStatus();}
  function renderStatus(){
    $('experienceStorage').textContent=storageOk?L('תצוגה נוחה, רוחב החלונית והבחירה בין מפה לגלויות נשמרים בדפדפן הזה.','Reading mode, panel width, and map/postcard view are saved in this browser.'):L('השמירה אינה זמינה. אפשר להשתמש בכלים עד לסגירת הדף.','Storage is unavailable. These settings apply until this page closes.');
  }
  function render(){
    document.documentElement.dataset.readability=state.readability?'comfortable':'standard';
    if(state.sidebarWidth!==null)document.documentElement.style.setProperty('--atlas-sidebar-width',`${state.sidebarWidth}px`);
    else document.documentElement.style.removeProperty('--atlas-sidebar-width');
    $('readabilityToggle').checked=state.readability;
    for(const node of document.querySelectorAll('[data-xp-label]'))node.textContent=text(node.dataset.xpLabel);
    for(const node of document.querySelectorAll('[data-xp-aria]'))node.setAttribute('aria-label',text(node.dataset.xpAria));
    for(const node of document.querySelectorAll('[data-xp-title]')){node.title=text(node.dataset.xpTitle);node.setAttribute('aria-label',text(node.dataset.xpTitle));}
    for(const node of document.querySelectorAll('.experience-new'))node.hidden=state.lastSeenRelease===RELEASE;
    renderStatus();updateDivider();syncView();
  }
  function openDialog(dialog){if(!dialog.open)dialog.showModal();}
  function markWelcome(){if(!state.welcomeSeen){state.welcomeSeen=true;save();}}
  function showWelcome(){openDialog(welcome);}
  function showRelease(){state.lastSeenRelease=RELEASE;save();render();openDialog(release);}
  function closeLayers(){window.Hunt?.close({restoreFocus:false});if($('sceneDialog').open)$('sceneDialog').close();if(!$('directory').hidden)$('closeDirectory').click();}
  function showMap(){closeLayers();if(!$('routePanel').hidden)$('closeRoute').click();state.view='map';save();window.Atlas?.fitWorld();$('worldSvg').setAttribute('tabindex','0');$('worldSvg').focus({preventScroll:true});syncView();}
  function showSearch(){closeLayers();$('search').focus();syncView('search');}
  function showRoute(){closeLayers();window.Atlas?.openRoute();$('routeFrom').focus();syncView('route');}
  function showPlaces(){if(ready)$('personalToggle').click();syncView('places');}
  function setView(value){
    if(!ready)return;
    if(value==='list'){window.Hunt?.close({restoreFocus:false});if($('sceneDialog').open)$('sceneDialog').close();if($('directory').hidden)$('directoryToggle').click();}
    else showMap();
    state.view=value;save();syncView();
  }
  function syncView(active){
    const list=!$('directory').hidden;
    viewToggle.querySelector('[data-xp-view="map"]').setAttribute('aria-pressed',String(!list));
    viewToggle.querySelector('[data-xp-view="list"]').setAttribute('aria-pressed',String(list));
    const current=active||($('personalDialog').open?'places':!$('routePanel').hidden?'route':'map');
    for(const button of mobile.querySelectorAll('button')){
      if(button.dataset.xpMobile===current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
      button.disabled=!ready;
    }
    for(const button of welcome.querySelectorAll('[data-xp-start]'))button.disabled=!ready;
    for(const button of viewToggle.querySelectorAll('button'))button.disabled=!ready;
  }
  function buildReportUrl(){
    const context=window.Atlas?.getContext?.()||{},map=context.sceneMap||context.activeMap;
    const id=Number.isSafeInteger(map?.id)?map.id:null,name=typeof map?.name==='string'?map.name.slice(0,160):'';
    const route=context.route;
    const stops=Array.isArray(route?.stops)?route.stops.filter(Number.isSafeInteger).slice(0,8):[];
    const routeLine=route&&Number.isSafeInteger(route.from)&&Number.isSafeInteger(route.to)?`${route.from} → ${route.to}; stops: ${stops.join(', ')||'—'}; step ${Number.isSafeInteger(route.index)?route.index:0}/${Number.isSafeInteger(route.total)?route.total:0}; services: ${route.services===true}`:'—';
    const body=[L('מה לא עבד?','What went wrong?'),'\n',L('מה ציפיתם שיקרה?','What did you expect?'),'\n','---',`Atlas release: ${RELEASE}`,`Map: ${id===null?'—':`${name} [${id}]`}`,`Route: ${routeLine}`,`Language: ${window.AtlasI18n?.language==='en'?'en':'he'}`,`Theme: ${['midnight','parchment','aurora'].includes(document.documentElement.dataset.theme)?document.documentElement.dataset.theme:'midnight'}`].join('\n');
    const url=new URL('https://github.com/omer110100/mcp_atlas/issues/new');
    url.searchParams.set('title',L('דיווח מהאטלס','Atlas report')+(id===null?'':` · ${name} [${id}]`));url.searchParams.set('body',body);
    return url.href;
  }
  function maxWidth(){return Math.max(300,Math.min(520,Math.floor(window.innerWidth*.45)));}
  function updateDivider(){const width=Math.round($('sidePanel').getBoundingClientRect().width);divider.setAttribute('aria-valuenow',String(width));divider.setAttribute('aria-valuemax',String(maxWidth()));divider.setAttribute('aria-valuetext',`${width} ${L('פיקסלים','pixels')}`);}
  function setWidth(width){state.sidebarWidth=Math.max(300,Math.min(maxWidth(),Math.round(width)));document.documentElement.style.setProperty('--atlas-sidebar-width',`${state.sidebarWidth}px`);updateDivider();}
  function refreshLayout(){window.dispatchEvent(new Event('resize'));}
  divider.addEventListener('pointerdown',event=>{if(event.button!==0||window.innerWidth<=780)return;event.preventDefault();drag={pointerId:event.pointerId};divider.setPointerCapture(event.pointerId);document.body.classList.add('resizing-sidebar');});
  divider.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>setWidth(window.innerWidth-event.clientX));});
  function finishDrag(event){if(!drag||event.pointerId!==drag.pointerId)return;cancelAnimationFrame(resizeFrame);drag=null;document.body.classList.remove('resizing-sidebar');if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);save();refreshLayout();}
  divider.addEventListener('pointerup',finishDrag);divider.addEventListener('pointercancel',finishDrag);divider.addEventListener('lostpointercapture',finishDrag);
  divider.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=$('sidePanel').getBoundingClientRect().width;setWidth(event.key==='Home'?300:event.key==='End'?maxWidth():current+(event.key==='ArrowLeft'?20:-20));save();refreshLayout();});
  $('resetSidebarWidth').addEventListener('click',()=>{state.sidebarWidth=null;save();render();refreshLayout();});
  $('readabilityToggle').addEventListener('change',()=>{state.readability=$('readabilityToggle').checked;save();render();refreshLayout();});
  for(const dialog of [welcome,shortcuts,release])dialog.addEventListener('click',event=>{if(event.target.closest('[data-xp-close]'))dialog.close();});
  welcome.addEventListener('close',markWelcome);
  welcome.addEventListener('click',event=>{const action=event.target.closest('[data-xp-start]')?.dataset.xpStart;if(!action||!ready)return;welcome.close();if(action==='search')showSearch();else if(action==='route')showRoute();else{closeLayers();window.Hunt?.open('monster');}});
  tools.addEventListener('click',event=>{const action=event.target.closest('[data-xp-action]')?.dataset.xpAction;if(action==='welcome')showWelcome();else if(action==='shortcuts')openDialog(shortcuts);else if(action==='news')showRelease();});
  $('experienceReport').addEventListener('click',()=>{$('experienceReport').href=buildReportUrl();});
  viewToggle.addEventListener('click',event=>{const value=event.target.closest('[data-xp-view]')?.dataset.xpView;if(value)setView(value);});
  mobile.addEventListener('click',event=>{const action=event.target.closest('[data-xp-mobile]')?.dataset.xpMobile;if(!ready)return;if(action==='map')showMap();else if(action==='search')showSearch();else if(action==='route')showRoute();else if(action==='places')showPlaces();});
  for(const id of ['directoryToggle','closeDirectory'])$(id).addEventListener('click',()=>queueMicrotask(()=>{state.view=$('directory').hidden?'map':'list';save();syncView();}));
  for(const id of ['directory','routePanel','personalDialog','sceneDialog'])new MutationObserver(()=>syncView()).observe($(id),{attributes:true,attributeFilter:['hidden','open']});
  $('search').addEventListener('focus',()=>syncView('search'));
  $('search').addEventListener('blur',()=>syncView());
  document.addEventListener('keydown',event=>{
    const target=event.target;if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
    const openDialogs=document.querySelectorAll('dialog[open]');
    if(event.key==='?'&&!openDialogs.length){event.preventDefault();openDialog(shortcuts);return;}
    if(openDialogs.length!==1||openDialogs[0].id!=='sceneDialog'||$('sceneNavigation').hidden)return;
    const id={n:'sceneNavNext',p:'sceneNavPrevious',f:'sceneNavFocus'}[event.key.toLowerCase()],button=id&&$(id);
    if(button&&!button.disabled&&!button.hidden){event.preventDefault();button.click();}
  });
  window.addEventListener('atlas-languagechange',render);
  window.addEventListener('atlas-viewchange',()=>syncView());
  window.addEventListener('resize',updateDivider);
  function onReady(){
    if(ready)return;ready=true;render();
    const params=new URLSearchParams(location.hash.slice(1));
    const hasContext=params.has('map')||params.has('route')||!!window.Atlas?.currentRoute;
    if(state.view==='list'&&!hasContext)setView('list');
    if(document.documentElement.dataset.appVersion!=='3'&&!window.AtlasShell&&!state.welcomeSeen&&!hasContext&&!document.querySelector('dialog[open]'))showWelcome();
  }
  window.addEventListener('atlas-ready',onReady,{once:true});
  render();if(window.Atlas)onReady();
  window.AtlasExperience={openWelcome:showWelcome,openShortcuts:()=>openDialog(shortcuts),openRelease:showRelease,buildReportUrl,get release(){return RELEASE;}};
})();
