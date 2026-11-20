'use strict';
// The V3 shell owns presentation only. Existing map, library and route controls keep their handlers.
(() => {
  const $=id=>document.getElementById(id), root=document.documentElement;
  const L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  const panel=$('sidePanel'), routePanel=$('routePanel'), mapDetails=$('mapDetails');
  const scene=$('sceneDialog'), sceneSidebar=scene.querySelector('.scene-sidebar');
  const sceneNavigation=$('sceneNavigation'), sceneHeader=scene.querySelector('.scene-header');
  let drawerOpen=false, drawerMode='route', sheetHeight='min', detailTab='portals', companion=false, drag=null;
  let savedDrawer=null, syncQueued=false;
  const popoverOpeners=new WeakMap();
  const labels={
    stop:['עצירת ניווט','Stop navigation'],navigating:['ניווט פעיל','Active navigation'],route:['תכנון מסלול','Plan a route'],details:['פרטי מפה','Map details'],fold:['קיפול החלונית','Collapse panel'],
    expand:['פתיחת החלונית','Open panel'],sheet:['שינוי גובה החלונית','Change panel height'],
    min:['ממוזער','Minimized'],half:['חצי מסך','Half screen'],full:['מסך מלא','Full screen'],
    support:['תמיכה · PayPal','Support · PayPal'],appearance:['עיצוב ושפה','Appearance & language'],
    places:['המקומות שלי','My places'],about:['אודות ומקורות','About & sources'],
    tools:['עוד דרכים לחקור','More ways to explore'],legend:['מקרא','Legend'],
    portals:['שערים','Portals'],monsters:['מפלצות','Monsters'],npcs:['דמויות','NPCs'],
    advanced:['עצירות ואפשרויות נוספות','Stops & more options'],routeFields:['מוצא ויעד · עריכת המסלול','Start & destination · Edit route'],alternatives:['השוואת מסלולים','Compare routes'],goal:['מטרת המסע','Journey goal'],requirements:['תנאי מעבר · חשוב לבדוק','Entrance requirements · Check first'],walk:['הליכה רציפה','Walking only'],
    travel:['שיגורים ומשימות','Teleports & quests'],policy:['סוג המסלול','Route policy'],
    back:['חזרה למפת העולם','Back to the world map'],next:['הגעתי, לשלב הבא','Arrived, next step'],
    game:['מצב ממוזער למשחק','Compact companion mode'],exitGame:['חזרה לתצוגה מלאה','Return to full view'],
    mapControls:['פקדי מפה','Map controls'],zoomIn:['הגדלה','Zoom in'],zoomOut:['הקטנה','Zoom out'],
    center:['מרכז מפה','Center map'],help:['מפת העולם סכמטית. מיקומי שערים בתמונה נשמרים לפי המקור.','The world map is schematic. Portal image positions follow the source data.']
  };
  const text=key=>L(...labels[key]);
  function el(tag,attributes={},content=''){
    const node=document.createElement(tag);
    for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));
    if(content)node.innerHTML=content;
    return node;
  }
  const label=key=>`<span data-shell-label="${key}"></span>`;
  const glyph=(path)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const icons={
    fold:glyph('<path d="m14 6-6 6 6 6"/>'),route:glyph('<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h5"/>'),
    heart:glyph('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'),
    star:glyph('<path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9z"/>'),
    settings:glyph('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>'),
    about:glyph('<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>'),
    center:glyph('<circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>'),
    map:glyph('<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/>')
  };

  // Reparent rather than clone: saved state, accessible labels and event listeners remain intact.
  root.classList.add('atlas-shell');
  const header=document.querySelector('.app-header'),brand=header.querySelector('.brand');
  brand.querySelector('.brand-he')?.remove();
  brand.append(el('span',{class:'shell-version',lang:'en',dir:'ltr'},'v3.0'));
  const edition=header.querySelector('.edition');
  if(edition){edition.classList.add('shell-data-edition');$('aboutDialog').append(edition);}
  const start=el('div',{class:'shell-header-start'}),actions=header.querySelector('.header-actions');
  const search=document.querySelector('.search-wrap'),regions=document.querySelector('.region-nav');
  search.querySelector('kbd').textContent='Ctrl K';
  start.append(brand,search);
  const support=el('a',{class:'shell-support',href:'https://paypal.me/omerLabinsky',target:'_blank',rel:'noopener noreferrer','data-shell-title':'support'},icons.heart+label('support'));
  const extras=el('details',{class:'shell-explore-tools',id:'shellExploreTools'},`<summary>${label('tools')}<span aria-hidden="true">＋</span></summary><div class="shell-explore-actions"></div>`);
  const extraActions=extras.querySelector('div');
  for(const id of ['huntToggle','directoryToggle'])extraActions.append($(id));
  const viewToggle=document.querySelector('.experience-view');if(viewToggle)extraActions.append(viewToggle);
  const originalRouteToggle=$('routeToggle');originalRouteToggle.hidden=true;extraActions.append(originalRouteToggle);
  for(const [id,key,icon]of [['personalToggle','places','star'],['appearanceToggle','appearance','settings'],['aboutButton','about','about']]){
    const button=$(id);button.classList.add('shell-icon-action');button.dataset.shellTitle=key;button.innerHTML=icons[icon];
    actions.append(button);
  }
  actions.prepend(support);header.replaceChildren(start,regions,actions);
  header.addEventListener('click',event=>{
    if(!event.target.closest('.brand,[data-region]'))return;
    window.Hunt?.close({restoreFocus:false});$('directory').hidden=true;
    if(scene.open)scene.close();catalogClosed({restoreFocus:false});
  },true);
  document.querySelector('.map-topbar').hidden=true;
  const intro=$('mapIntro');if(intro){intro.hidden=true;$('aboutDialog').append(intro);}
  const tools=$('experienceTools');if(tools)$('aboutDialog').append(tools);
  const footer=document.querySelector('.panel-footer');if(footer)$('aboutDialog').append(footer);
  $('mobileNav')?.setAttribute('hidden','');$('sidePanelResizeHandle')?.setAttribute('hidden','');

  const drawerChrome=el('div',{class:'shell-drawer-chrome'},`<button type="button" id="shellSheetHandle" class="shell-sheet-handle" data-shell-title="sheet" aria-controls="sidePanel"><span></span></button><div class="shell-drawer-tabs" role="tablist"><button type="button" id="shellRouteTab" role="tab" aria-controls="routePanel" data-shell-mode="route">${icons.route}${label('route')}</button><button type="button" id="shellDetailsTab" role="tab" aria-controls="shellDetailsContent" data-shell-mode="details">${icons.map}${label('details')}</button></div><div class="shell-sheet-levels" role="group" data-shell-aria="sheet">${['min','half','full'].map(height=>`<button type="button" data-shell-height="${height}" data-shell-label="${height}"></button>`).join('')}</div>`);
  const content=el('div',{class:'shell-drawer-scroll',id:'shellDrawerScroll'}), detailsContent=el('section',{id:'shellDetailsContent',role:'tabpanel','aria-labelledby':'shellDetailsTab'});
  routePanel.setAttribute('role','tabpanel');routePanel.setAttribute('aria-labelledby','shellRouteTab');
  detailsContent.append(mapDetails,sceneSidebar);content.append(routePanel,detailsContent,extras);
  panel.replaceChildren(drawerChrome,content);
  const toggle=el('button',{id:'shellDrawerToggle',type:'button',class:'shell-drawer-toggle','aria-controls':'sidePanel'},icons.route+label('route'));
  document.body.append(panel,toggle);
  panel.setAttribute('aria-label',text('route'));
  drawerChrome.addEventListener('click',event=>{
    const tab=event.target.closest('[data-shell-mode]');if(tab){activateDrawer(tab.dataset.shellMode);return;}
    const height=event.target.closest('[data-shell-height]');if(height){setHeight(height.dataset.shellHeight);return;}
    if(event.target.closest('#shellSheetHandle')&&!drag)setHeight(sheetHeight==='min'?'half':sheetHeight==='half'?'full':'min');
  });
  drawerChrome.querySelector('.shell-drawer-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const mode=event.key==='Home'?'route':event.key==='End'?'details':drawerMode==='route'?'details':'route';
    activateDrawer(mode);$(mode==='route'?'shellRouteTab':'shellDetailsTab').focus();
  });
  toggle.addEventListener('click',()=>drawerOpen?closeDrawer():activateDrawer(drawerMode));
  $('closeRoute').addEventListener('click',closeDrawer);

  // An actual checkbox is retained as the route policy's source of truth.
  const policyInput=$('useServices'),policyRow=policyInput.closest('.check-row');policyRow.classList.add('shell-policy-source');
  const policy=el('div',{class:'shell-route-policy',role:'group','data-shell-aria':'policy'},`<button type="button" data-shell-policy="walk">${label('walk')}</button><button type="button" data-shell-policy="travel">${label('travel')}</button>`);
  policyRow.before(policy);
  policy.addEventListener('click',event=>{const button=event.target.closest('[data-shell-policy]');if(!button)return;policyInput.checked=button.dataset.shellPolicy==='travel';policyInput.dispatchEvent(new Event('change',{bubbles:true}));syncPolicy();});
  policyInput.addEventListener('change',syncPolicy);
  function syncPolicy(){for(const button of policy.querySelectorAll('button'))button.setAttribute('aria-pressed',String(policyInput.checked===(button.dataset.shellPolicy==='travel')));}
  const advanced=el('details',{id:'shellRouteAdvanced',class:'shell-route-advanced'},`<summary data-shell-label="advanced"></summary>`);
  const itinerary=document.querySelector('.route-itinerary-tools');itinerary.after(advanced);
  advanced.append($('routeAddStop'),$('routeStops'));
  const help=routePanel.querySelector('.route-help');if(help)advanced.append(help);
  const routeFields=el('details',{id:'shellRouteFields',class:'shell-route-fields',open:''},'<summary data-shell-label="routeFields"></summary>');
  $('routeForm').before(routeFields);routeFields.append($('routeForm'));
  let lastCollapsedRoute=null;
  document.addEventListener('click',event=>{if(event.target.closest('[data-action="route-from"],[data-action="route-to"]'))routeFields.open=true;},true);
  const routeDisclosures=[];
  for(const [id,key]of [['routeGoal','goal'],['routeAlternatives','alternatives']]){
    const host=$(id),disclosure=el('details',{class:'shell-route-disclosure'},`<summary data-shell-label="${key}"></summary>`);
    host.before(disclosure);disclosure.append(host);routeDisclosures.push({host,disclosure});
  }
  routePanel.append($('routeStorageStatus'));
  $('routeAddStop').addEventListener('click',()=>advanced.open=true);
  const stopObserver=new MutationObserver(()=>{if($('routeStops').childElementCount)advanced.open=true;});stopObserver.observe($('routeStops'),{childList:true});

  // Native dialogs used as popovers are nonmodal; the central information dialogs stay modal.
  function openPopover(dialog,opener){
    const wasOpen=dialog.open;
    for(const candidate of [$('appearanceDialog'),$('personalDialog')])if(candidate.open)candidate.close();
    if(wasOpen)return;
    dialog.classList.add('shell-popover');popoverOpeners.set(dialog,opener);dialog.show();opener?.setAttribute('aria-expanded','true');
  }
  for(const [id,openerId]of [['appearanceDialog','appearanceToggle'],['personalDialog','personalToggle']]){
    const dialog=$(id),opener=$(openerId);opener.setAttribute('aria-haspopup','dialog');opener.setAttribute('aria-expanded','false');
    dialog.addEventListener('close',()=>{opener.setAttribute('aria-expanded','false');if(dialog.contains(document.activeElement)||document.activeElement===document.body)popoverOpeners.get(dialog)?.focus({preventScroll:true});});
  }
  document.addEventListener('pointerdown',event=>{for(const dialog of [$('appearanceDialog'),$('personalDialog')])if(dialog.open&&dialog.classList.contains('shell-popover')&&!dialog.contains(event.target)&&!popoverOpeners.get(dialog)?.contains(event.target))dialog.close();});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return;
    for(const dialog of [$('appearanceDialog'),$('personalDialog')])if(dialog.open&&dialog.classList.contains('shell-popover')){dialog.close();event.preventDefault();return;}
    if(scene.open&&!document.querySelector('dialog[open]:not(#sceneDialog)')){scene.close();event.preventDefault();$('worldSvg').setAttribute('tabindex','-1');$('worldSvg').focus({preventScroll:true});}
  });

  // The source image is a canvas layer, never a modal that blocks the app's search and toolbar.
  scene.classList.add('shell-scene');scene.removeAttribute('aria-modal');
  sceneHeader.classList.add('shell-scene-heading');document.body.append(sceneHeader,sceneNavigation);
  $('closeScene').dataset.shellTitle='back';$('closeScene').innerHTML=icons.map;
  const navigationMore=el('details',{class:'shell-navigation-more'},`<summary>${label('details')}</summary><div></div>`);
  const navigationExtra=navigationMore.querySelector('div');
  for(const id of ['sceneNavInstruction','sceneNavError','sceneNavGoal','sceneNavBreadcrumb','sceneNavStep'])navigationExtra.append($(id));
  sceneNavigation.append(navigationMore);
  const navigationHeading=el('div',{class:'shell-navigation-heading'},`<span data-shell-label="navigating"></span>`);
  const companionTitle=el('strong',{id:'shellCompanionTitle',dir:'auto'});navigationHeading.prepend(companionTitle);
  const stopButton=el('button',{type:'button',id:'sceneNavStop',class:'button quiet navigation-stop','data-shell-label':'stop'});
  stopButton.addEventListener('click',()=>window.Atlas?.stopNavigation());navigationHeading.append(stopButton);sceneNavigation.prepend(navigationHeading);
  const companionRequirements=el('details',{id:'shellCompanionRequirements',class:'shell-companion-requirements',hidden:''},'<summary data-shell-label="requirements"></summary><p></p>');
  navigationHeading.after(companionRequirements);
  const companionButton=el('button',{type:'button',id:'shellCompanionToggle',class:'button quiet','data-shell-label':'game'});
  const guideActions=el('div',{class:'shell-guide-actions'});
  const routeStop=el('button',{type:'button',id:'shellRouteStop',class:'button quiet navigation-stop','data-shell-label':'stop'});
  routeStop.addEventListener('click',()=>window.Atlas?.stopNavigation());guideActions.append(companionButton,routeStop);
  $('routeResult').before(guideActions);guideActions.hidden=true;
  companionButton.addEventListener('click',()=>{const context=window.Atlas?.getContext();window.Atlas?.openRouteStep?.(context?.route?.index||0);window.Atlas?.setCompactNavigation?.(true);});

  const controls=document.querySelector('.map-controls'),legend=document.querySelector('.map-legend');
  const controlsDock=el('div',{class:'shell-map-controls','data-shell-aria':'mapControls'});
  const zoomIn=el('button',{type:'button','data-shell-title':'zoomIn'},'+'),zoomOut=el('button',{type:'button','data-shell-title':'zoomOut'},'−');
  const fit=el('button',{type:'button','data-shell-title':'center'},icons.center);
  zoomIn.addEventListener('click',()=>$(scene.open?'sceneZoomIn':'zoomIn').click());
  zoomOut.addEventListener('click',()=>$(scene.open?'sceneZoomOut':'zoomOut').click());
  fit.addEventListener('click',()=>$(scene.open?'sceneFit':'fitMap').click());
  const legendDetails=el('details',{class:'shell-legend'},`<summary data-shell-title="legend">${icons.about}</summary><div class="shell-legend-card"><strong data-shell-label="legend"></strong></div>`);
  legendDetails.querySelector('div').append(legend,$('labelsToggle'),el('p',{'data-shell-label':'help'}));
  controls.hidden=true;controlsDock.append(zoomIn,zoomOut,fit,legendDetails);document.body.append(controlsDock);
  document.querySelector('.map-footnote').hidden=true;

  function mobile(){return window.matchMedia('(max-width: 780px)').matches;}
  function setHeight(value){
    if(!['min','half','full'].includes(value))return;
    sheetHeight=value;drawerOpen=value!=='min';renderDrawer();
  }
  function showDrawer(mode='route'){
    if(!['route','details'].includes(mode))return;
    if(companion)window.Atlas?.setCompactNavigation?.(false);
    drawerMode=mode;drawerOpen=true;if(sheetHeight==='min')sheetHeight='half';
    renderDrawer();content.scrollTo({top:0,behavior:'auto'});
  }
  function activateDrawer(mode){if(mode==='route'&&window.Atlas?.openRoute){if(!window.Atlas.currentRoute)routeFields.open=true;window.Atlas.openRoute();}else showDrawer(mode);}
  function closeDrawer(){
    drawerOpen=false;sheetHeight='min';renderDrawer();
    if(panel.contains(document.activeElement))toggle.focus({preventScroll:true});
  }
  function renderDrawer(){
    root.dataset.drawer=drawerOpen?'open':'closed';root.dataset.sheet=sheetHeight;root.dataset.drawerMode=drawerMode;
    panel.inert=!!activeCatalog()||(!drawerOpen&&!mobile());
    routePanel.hidden=drawerMode!=='route';detailsContent.hidden=drawerMode!=='details';
    content.inert=!drawerOpen||!!activeCatalog();
    for(const button of drawerChrome.querySelectorAll('[data-shell-mode]')){
      const selected=button.dataset.shellMode===drawerMode;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    }
    for(const button of drawerChrome.querySelectorAll('[data-shell-height]'))button.setAttribute('aria-pressed',String(button.dataset.shellHeight===sheetHeight));
    toggle.setAttribute('aria-expanded',String(drawerOpen));
    toggle.setAttribute('aria-label',drawerOpen?text('fold'):`${text('expand')} · ${text(drawerMode)}`);
    const toggleState=`${drawerOpen}:${drawerMode}`,markup=drawerOpen?icons.fold:icons[drawerMode==='route'?'route':'map']+label(drawerMode);
    if(toggle.dataset.state!==toggleState){toggle.innerHTML=markup;toggle.dataset.state=toggleState;}
    panel.setAttribute('aria-label',text(drawerMode));
    $('routeToggle').setAttribute('aria-pressed',String(drawerOpen&&drawerMode==='route'));
    updateLabels();
  }
  function showScene(dialog=scene,{following=false}={}){
    window.Hunt?.close({restoreFocus:false});$('directory').hidden=true;catalogClosed({restoreFocus:false});
    if(!dialog.open)dialog.show();
    if(following)closeDrawer();else if(!companion){showDrawer('details');if(mobile())setHeight('min');}
    sync();
  }
  function activeCatalog(){return [$('directory'),$('huntPanel')].find(catalog=>catalog&&!catalog.hidden)||null;}
  function showCatalog(catalog){
    if(!catalog||!['directory','huntPanel'].includes(catalog.id))return false;
    if(catalog.parentElement!==document.body)document.body.append(catalog);
    if(catalog.id==='directory')window.Hunt?.close({restoreFocus:false});else $('directory').hidden=true;
    for(const popover of [$('appearanceDialog'),$('personalDialog')])if(popover.open)popover.close();
    if(scene.open)scene.close();
    if(companion)setCompanion(false);
    closeDrawer();catalog.hidden=false;sync();
    return true;
  }
  function catalogClosed({restoreFocus=true}={}){
    renderDrawer();sync();
    if(restoreFocus&&!activeCatalog()){
      const world=$('worldSvg');world.setAttribute('tabindex','0');world.focus({preventScroll:true});
    }
  }
  function setCompanion(value){
    const next=value===true;
    if(next!==companion){
      companion=next;
      if(next){savedDrawer={open:drawerOpen,mode:drawerMode,height:sheetHeight};closeDrawer();}
      else if(savedDrawer){drawerOpen=savedDrawer.open;drawerMode=savedDrawer.mode;sheetHeight=savedDrawer.height;savedDrawer=null;renderDrawer();}
    }
    root.dataset.companion=companion?'on':'off';
    $('sceneNavNext').textContent=companion?text('next'):L('הבא במסלול','Next route step');
    $('sceneNavCompact').textContent=companion?text('exitGame'):text('game');
  }
  function setDetailTab(value){detailTab=value;syncDetailTabs();}
  function syncDetailTabs(){
    if(!mapDetails.querySelector('.map-detail-head'))return;
    let tabs=$('shellMapTabs');
    if(!tabs){
      tabs=el('nav',{id:'shellMapTabs',class:'shell-map-tabs',role:'tablist','aria-label':text('details')},['portals','monsters','npcs'].map(key=>`<button type="button" role="tab" id="shellMapTab-${key}" aria-controls="${key==='portals'?'portalContent':'shellMapPanel-'+key}" data-shell-detail="${key}" data-shell-label="${key}"></button>`).join(''));
      const target=mapDetails.querySelector('.map-population')||mapDetails.querySelector('.portal-tabs');target.before(tabs);
      tabs.addEventListener('click',event=>{const button=event.target.closest('[data-shell-detail]');if(button)setDetailTab(button.dataset.shellDetail);});
      tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=['portals','monsters','npcs'];let index=keys.indexOf(detailTab);index=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;setDetailTab(keys[index]);$('shellMapTab-'+keys[index]).focus();});
    }
    for(const button of tabs.querySelectorAll('button')){const active=button.dataset.shellDetail===detailTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
    for(const node of mapDetails.querySelectorAll('.portal-tabs,.portal-content,.map-notes,.entity-shortcuts'))node.hidden=detailTab!=='portals'||node.classList.contains('entity-shortcuts');
    const portals=$('portalContent');if(portals){portals.setAttribute('role','tabpanel');portals.setAttribute('aria-labelledby','shellMapTab-portals');}
    const occupants=mapDetails.querySelectorAll('.map-occupants');
    occupants.forEach((section,index)=>{const key=index===0?'monsters':'npcs';section.hidden=detailTab!==key;section.open=true;section.id='shellMapPanel-'+key;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','shellMapTab-'+key);});
    updateLabels();
  }
  function updateLabels(){
    for(const node of document.querySelectorAll('[data-shell-label]')){const value=text(node.dataset.shellLabel);if(node.textContent!==value)node.textContent=value;}
    for(const node of document.querySelectorAll('[data-shell-title]')){const value=text(node.dataset.shellTitle);node.title=value;node.setAttribute('aria-label',value);}
    for(const node of document.querySelectorAll('[data-shell-aria]'))node.setAttribute('aria-label',text(node.dataset.shellAria));
  }
  function sync(){
    root.dataset.scene=scene.open?'open':'closed';sceneHeader.hidden=!scene.open;
    const catalog=activeCatalog();root.dataset.catalog=catalog?.id||'closed';
    $('mapCanvas').inert=scene.open||!!catalog;
    panel.inert=!!catalog||(!drawerOpen&&!mobile());toggle.inert=!!catalog;controlsDock.inert=!!catalog;
    if($('atlasBreadcrumbs'))$('atlasBreadcrumbs').inert=!!catalog;
    const ready=!!window.Atlas;
    for(const node of [$('shellRouteTab'),$('shellDetailsTab'),toggle,$('routeFrom'),$('routeTo'),$('routeForm').querySelector('[type="submit"]')])node.disabled=!ready;
    if(!scene.open)sceneNavigation.classList.add('shell-navigation-hidden');else sceneNavigation.classList.remove('shell-navigation-hidden');
    mapDetails.hidden=scene.open;sceneSidebar.hidden=!scene.open;
    const context=window.Atlas?.getContext?.();
    const currentRoute=window.Atlas?.currentRoute;
    if(currentRoute&&currentRoute!==lastCollapsedRoute){
      const submittedHere=$('routeForm').contains(document.activeElement);
      routeFields.open=false;lastCollapsedRoute=currentRoute;content.scrollTo({top:0,behavior:'auto'});
      if(submittedHere)requestAnimationFrame(()=>$('startRoute')?.focus({preventScroll:true}));
    }
    if(!currentRoute)routeFields.open=true;
    for(const {host,disclosure}of routeDisclosures)disclosure.hidden=host.hidden||!host.textContent.trim();
    const currentStep=currentRoute?.steps[context?.step||0],service=currentStep?.service;
    companionRequirements.hidden=!companion||!service||service.walkable===true;
    companionRequirements.querySelector('p').textContent=service?window.AtlasI18n?.data(service.condition||service.condition_he||'')||L('בדקו את תנאי הכניסה בפרטי המפה.','Check the entrance requirements in map details.'):'';
    companionTitle.textContent=context?.sceneMap?.name||'';
    guideActions.hidden=!currentRoute;
    syncPolicy();syncDetailTabs();
    if(companion&&(!scene.open||!context?.route))setCompanion(false);
    if(companion)setCompanion(true);
  }
  function scheduleSync(){if(syncQueued)return;syncQueued=true;queueMicrotask(()=>{syncQueued=false;sync();});}
  function mapViewport(canvasId=scene.open?'sceneCanvas':'mapCanvas'){
    const canvas=$(canvasId),bounds=canvas?.getBoundingClientRect();
    if(!bounds)return{left:0,top:0,width:window.innerWidth,height:window.innerHeight};
    const padding=16;let left=padding,right=bounds.width-padding,top=Math.max(padding,header.getBoundingClientRect().bottom-bounds.top+padding),bottom=bounds.height-padding;
    const crumbs=$('atlasBreadcrumbs');if(crumbs&&!crumbs.hidden){const rect=crumbs.getBoundingClientRect();if(rect.height)top=Math.max(top,rect.bottom-bounds.top+12);}
    if(mobile()){
      if(!companion){
        // Use the target height so an expanding/closing animation cannot fit the map to a stale full sheet.
        const safeBottom=parseFloat(getComputedStyle(panel).paddingBottom)||0;
        const sheetPixels=sheetHeight==='min'?80+safeBottom:sheetHeight==='half'?window.innerHeight*.52:window.innerHeight-8;
        bottom=Math.min(bottom,window.innerHeight-sheetPixels-bounds.top-12);
      }
      if(scene.open&&!sceneHeader.hidden&&!companion){const rect=sceneHeader.getBoundingClientRect();if(rect.height)top=Math.max(top,rect.bottom-bounds.top+12);}
    }else if(drawerOpen){
      const rect=panel.getBoundingClientRect();
      if(root.dir==='rtl')right=Math.min(right,rect.left-bounds.left-16);else left=Math.max(left,rect.right-bounds.left+16);
    }
    if(scene.open&&!sceneNavigation.hidden){const rect=sceneNavigation.getBoundingClientRect();if(rect.height)bottom=Math.min(bottom,rect.top-bounds.top-12);}
    // When the sheet intentionally covers the canvas, return a bounded fallback rather than invalid zoom factors.
    const width=Math.max(180,right-left),height=Math.max(100,bottom-top);
    return{left:Math.max(0,Math.min(left,bounds.width-width)),top:Math.max(0,Math.min(top,bounds.height-height)),width:Math.min(width,bounds.width),height:Math.min(height,bounds.height)};
  }
  scene.addEventListener('close',sync);
  for(const event of ['atlas-ready','atlas-viewchange','hunt-ready','hunt-unavailable'])window.addEventListener(event,scheduleSync);
  window.addEventListener('atlas-languagechange',()=>{updateLabels();renderDrawer();sync();});
  window.addEventListener('resize',renderDrawer);
  new MutationObserver(scheduleSync).observe(mapDetails,{childList:true});
  new MutationObserver(scheduleSync).observe($('directory'),{attributes:true,attributeFilter:['hidden']});

  // Pointer drag is confined to the handle; scrolling the contents always scrolls the contents.
  const handle=$('shellSheetHandle');
  handle.addEventListener('pointerdown',event=>{
    if(!mobile()||event.button!==0)return;
    drag={id:event.pointerId,start:event.clientY,current:event.clientY,height:panel.getBoundingClientRect().height,moved:false};
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;drag.current=event.clientY;
    if(Math.abs(drag.current-drag.start)<6&&!drag.moved)return;
    drag.moved=true;root.classList.add('shell-sheet-dragging');
    panel.style.setProperty('--shell-drag-height',`${Math.max(78,Math.min(window.innerHeight-16,drag.height+drag.start-drag.current))}px`);
  });
  function finishDrag(event){
    if(!drag||drag.id!==event.pointerId)return;
    const movement=drag.start-drag.current,moved=drag.moved;drag=null;root.classList.remove('shell-sheet-dragging');panel.style.removeProperty('--shell-drag-height');
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
    if(!moved)return;
    const heights=['min','half','full'],index=heights.indexOf(sheetHeight);setHeight(heights[Math.max(0,Math.min(2,index+(movement>0?1:-1)))]);
    suppressClick=true;
  }
  let suppressClick=false;
  handle.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.stopPropagation();event.preventDefault();}},true);
  handle.addEventListener('pointerup',finishDrag);handle.addEventListener('pointercancel',event=>{if(drag){drag.moved=false;finishDrag(event);}});handle.addEventListener('lostpointercapture',finishDrag);
  handle.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const heights=['min','half','full'],index=heights.indexOf(sheetHeight);setHeight(event.key==='Home'?'min':event.key==='End'?'full':heights[Math.max(0,Math.min(2,index+(event.key==='ArrowUp'?1:-1)))]);});

  window.AtlasShell={showDrawer,closeDrawer,showScene,showCatalog,catalogClosed,openPopover,setCompanion,sync,setHeight,mapViewport,get state(){return{drawerOpen,drawerMode,sheetHeight,companion};}};
  renderDrawer();sync();const initialCatalog=activeCatalog();if(initialCatalog)showCatalog(initialCatalog);
})();
