'use strict';
// Presentation only: existing map/route nodes keep their delegated actions and data.
const AtlasDrawerLayoutCore=(() => {
  const normalize=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
  function page(items,{query='',page=0,size=5}={}){
    const terms=normalize(query).split(/\s+/).filter(Boolean);
    const matches=items.map((item,index)=>({item,index})).filter(({item})=>terms.every(term=>normalize(item).includes(term)));
    const count=Math.max(1,Math.ceil(matches.length/size));
    const current=Math.max(0,Math.min(count-1,Number.isFinite(page)?Math.floor(page):0));
    return {page:current,pages:count,total:matches.length,indices:matches.slice(current*size,(current+1)*size).map(entry=>entry.index)};
  }
  return {normalize,page};
})();
if(typeof window!=='undefined'&&typeof document!=='undefined')(() => {
  const $=id=>document.getElementById(id),L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  const states=new Map(),watches=new Map();
  let queued=false,lastRoute=null,lastStep=null,previewMap=null,previewOpen=false;
  const labels={
    previous:['הקודם','Previous'],next:['הבא','Next'],current:['לשלב הנוכחי','Current step'],
    options:['שיתוף וכלי מסלול','Sharing & route tools'],preview:['תצוגה מקדימה של המפה','Map preview'],
    source:['קואורדינטות ונתוני מקור','Coordinates & source data'],
    route:['שלבי המסלול','Route steps'],portals:['שערים','Portals'],monsters:['מפלצות','Monsters'],npcs:['דמויות','NPCs'],
    locations:['מיקומים במפה','Map locations'],filter:['סינון לפי שם או מספר','Filter by name or number'],clear:['ניקוי הסינון','Clear filter']
  };
  const text=key=>L(...labels[key]);
  function element(tag,attrs={},value){
    const node=document.createElement(tag);for(const [key,val]of Object.entries(attrs))node.setAttribute(key,String(val));
    if(value!==undefined)node.textContent=value;return node;
  }
  function setText(node,value){if(node.textContent!==value)node.textContent=value;}
  function watch(key,node){
    if(watches.get(key)?.node===node)return;
    watches.get(key)?.observer.disconnect();watches.delete(key);
    if(!node)return;
    const observer=new MutationObserver(schedule);observer.observe(node,{childList:true});watches.set(key,{node,observer});
  }
  function state(key,context){
    let current=states.get(key);
    if(!current||current.context!==context){current={context,page:0,query:'',selected:null};states.set(key,current);}
    return current;
  }
  function pager(host,rows,{key,context,label,search=false,currentIndex=null,follow=false,selected=null}={}){
    if(!host)return;
    const model=state(key,context);
    let controls=Array.from(host.children).find(node=>node.dataset.drawerPager===key);
    if(!rows.length){controls?.remove();return;}
    if(!controls){
      controls=element('div',{class:'drawer-pager','data-drawer-pager':key});
      if(search){
        const filter=element('label',{class:'drawer-list-filter'}),caption=element('span',{class:'drawer-filter-caption'},text('filter'));
        const input=element('input',{type:'search',maxlength:'100',autocomplete:'off','data-drawer-filter':key});
        input.value=model.query;filter.append(caption,input);controls.append(filter);
        input.addEventListener('input',()=>{controls.drawerModel.query=input.value.slice(0,100);controls.drawerModel.page=0;update();});
      }
      const bar=element('nav',{class:'drawer-page-controls'}),previous=element('button',{type:'button','data-drawer-page':'previous'}),status=element('span',{class:'drawer-page-status',role:'status','aria-live':'polite'}),next=element('button',{type:'button','data-drawer-page':'next'});
      bar.append(previous,status,next);controls.append(bar);
      for(const [button,delta]of [[previous,-1],[next,1]])button.addEventListener('click',()=>{
        controls.drawerModel.page+=delta;update();
        if(button.disabled)(delta>0?previous:next).focus({preventScroll:true});
      });
      if(currentIndex!==null){const jump=element('button',{type:'button',class:'drawer-current-step','data-drawer-current':''});controls.append(jump);jump.addEventListener('click',()=>{
        const index=Number(window.Atlas?.getContext?.()?.step)||0;controls.drawerModel.page=Math.floor(index/5);update();
        controls.drawerRows[index]?.querySelector('button')?.focus({preventScroll:true});
      });}
      const empty=element('p',{class:'drawer-filter-empty',hidden:''}),clear=element('button',{type:'button','data-drawer-clear':''},text('clear'));
      empty.append(element('span'),clear);controls.append(empty);
      clear.addEventListener('click',()=>{controls.drawerModel.query='';controls.drawerModel.page=0;const input=controls.querySelector('input');if(input)input.value='';update();input?.focus({preventScroll:true});});
      rows[0].before(controls);
    }
    // A re-render replaces row nodes, so handlers above delegate to the latest update.
    controls.drawerUpdate=render;controls.drawerModel=model;controls.drawerRows=rows;
    const searchInput=controls.querySelector('input');if(searchInput&&searchInput.value!==model.query)searchInput.value=model.query;
    function update(){controls.drawerUpdate();}
    if(follow&&currentIndex!==null)model.page=Math.floor(currentIndex/5);
    if(selected!==model.selected){
      model.selected=selected;
      const index=selected===null?-1:rows.findIndex(row=>(row.dataset.gate||row.dataset.entityKey)===selected);
      if(index>=0){model.query='';model.page=Math.floor(index/5);const input=controls.querySelector('input');if(input)input.value='';}
    }
    function render(){
      const result=AtlasDrawerLayoutCore.page(rows.map(row=>row.textContent),model);model.page=result.page;
      const visible=new Set(result.indices),active=document.activeElement;
      rows.forEach((row,index)=>row.hidden=!visible.has(index));
      const input=controls.querySelector('input');
      if(input){input.setAttribute('aria-label',`${text('filter')} · ${text(label)}`);input.placeholder=text('filter');setText(controls.querySelector('.drawer-filter-caption'),text('filter'));}
      const previous=controls.querySelector('[data-drawer-page="previous"]'),next=controls.querySelector('[data-drawer-page="next"]');
      setText(previous,text('previous'));setText(next,text('next'));previous.disabled=result.page===0;next.disabled=result.page===result.pages-1;
      controls.querySelector('nav').setAttribute('aria-label',text(label));
      setText(controls.querySelector('.drawer-page-status'),result.total?L(`${result.page*5+1}–${Math.min((result.page+1)*5,result.total)} מתוך ${result.total}`,`${result.page*5+1}–${Math.min((result.page+1)*5,result.total)} of ${result.total}`):L('אין התאמות','No matches'));
      const jump=controls.querySelector('[data-drawer-current]');if(jump){setText(jump,text('current'));jump.hidden=result.pages<=1;}
      const empty=controls.querySelector('.drawer-filter-empty');empty.hidden=!model.query||result.total>0;
      setText(empty.querySelector('span'),L('לא נמצאו תוצאות בסינון הזה.','No results match this filter.'));setText(empty.querySelector('button'),text('clear'));
      controls.hidden=rows.length<=5&&!model.query;
      if(rows.some(row=>row.hidden&&row.contains(active)))controls.querySelector('input,button')?.focus({preventScroll:true});
    }
    render();
  }
  function routeLayout(){
    const host=$('routeResult'),route=window.Atlas?.currentRoute;
    if(!host||!route){lastRoute=null;lastStep=null;return;}
    const rows=Array.from(host.querySelectorAll('.route-step')),step=Number(window.Atlas.getContext?.()?.step)||0;
    pager(host,rows,{key:'route',context:route,label:'route',currentIndex:step,follow:route!==lastRoute||step!==lastStep});
    lastRoute=route;lastStep=step;
    let options=host.querySelector('.drawer-route-options');
    if(!options){options=element('details',{class:'drawer-route-options'});options.append(element('summary',{},text('options')));host.append(options);}
    setText(options.querySelector('summary'),text('options'));
    // Status and detour reset stay visible. Requirements and warnings are never folded.
    const status=$('routeToolsStatus'),reset=$('clearRouteAvoids');
    for(const node of [status,reset])if(node&&node.parentElement!==host)options.before(node);
    for(const node of [host.querySelector('.route-secondary-actions'),host.querySelector('.route-tools'),host.querySelector('.route-tools-footer')])if(node&&node.parentElement!==options)options.append(node);
    const fallback=$('routeCopyFallback');if(fallback&&!fallback.hidden)options.open=true;
    // The visible stop control in the drawer header replaces this duplicate footer link.
    const legacyStop=$('clearRoute');if(legacyStop&&$('shellRouteStop'))legacyStop.hidden=true;
  }
  function mapLayout(){
    const host=$('mapDetails');if(!host)return;
    const mapId=window.Atlas?.activeMap;
    if(mapId!==previewMap){previewMap=mapId;previewOpen=false;}
    const preview=host.querySelector('.map-preview');
    if(preview){
      let disclosure=host.querySelector('.drawer-map-preview');
      if(!disclosure){
        disclosure=element('details',{class:'drawer-map-preview'});disclosure.open=previewOpen;
        disclosure.append(element('summary',{},text('preview')));preview.before(disclosure);disclosure.append(preview);
        disclosure.addEventListener('toggle',()=>{if(disclosure.isConnected)previewOpen=disclosure.open;});
      }
      setText(disclosure.querySelector('summary'),text('preview'));
    }
    const portals=$('portalContent');watch('map-portals',portals);
    const kind=host.querySelector('.portal-tabs .active')?.dataset.tab||'cross';
    if(portals)pager(portals,Array.from(portals.querySelectorAll('.portal-card')),{key:'map-portals',context:`${mapId}:${kind}`,label:'portals',search:true});
    for(const [index,section]of Array.from(host.querySelectorAll('.map-occupants')).entries()){
      const grid=section.querySelector('.map-occupant-grid'),key=index?'map-npcs':'map-monsters';watch(key,grid);
      if(grid)pager(grid,Array.from(grid.querySelectorAll('.map-occupant')),{key,context:mapId,label:index?'npcs':'monsters',search:true});
    }
  }
  function selectedLayout(){
    const selected=$('sceneSelected')?.querySelector('.scene-selected');if(!selected)return;
    let source=selected.querySelector('.drawer-selected-source');
    if(!source){
      // Coordinates and raw portal names are metadata; warnings, source links and travel stay in view.
      const children=Array.from(selected.children),details=selected.classList.contains('entity-selected')?
        children.filter(node=>node.classList.contains('entity-coordinates')||(node.tagName==='SMALL'&&/^(מזהה:|ID:|מיקום בתמונת המקור|Position in source image)/.test(node.textContent))):
        children.filter(node=>(node.tagName==='SMALL'&&/^(מיקום בתמונת המקור|Position in source image|שם השער בקובץ|Portal name in the data)/.test(node.textContent))||(node.tagName==='BDI'&&children.indexOf(node)>children.findIndex(item=>item.tagName==='SMALL')));
      if(details.length){source=element('details',{class:'drawer-selected-source'});source.append(element('summary',{},text('source')));selected.append(source);for(const node of details)source.append(node);}
    }
    if(source)setText(source.querySelector('summary'),text('source'));
  }
  function sceneLayout(){
    const host=$('scenePortalList');if(!host)return;
    const context=window.Atlas?.getContext?.(),layer=$('sceneLayers')?.querySelector('.active')?.dataset.layer||'portals',kind=$('sceneFilters')?.querySelector('.active')?.dataset.kind||'cross';
    const rows=Array.from(host.querySelectorAll('.portal-card,.entity-location-card')),chosen=rows.find(row=>row.classList.contains('chosen'));
    pager(host,rows,{key:'scene',context:`${context?.sceneMap?.id}:${layer}:${kind}`,label:'locations',search:true,selected:chosen?.dataset.gate||chosen?.dataset.entityKey||null});
    selectedLayout();
  }
  function sync(){routeLayout();mapLayout();sceneLayout();}
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});}
  for(const [key,id]of [['route','routeResult'],['map','mapDetails'],['scene','scenePortalList'],['selected','sceneSelected']])watch(key,$(id));
  for(const event of ['atlas-ready','atlas-viewchange','atlas-languagechange','hunt-ready','hunt-unavailable'])window.addEventListener(event,schedule);
  window.AtlasDrawerLayout={sync};schedule();
})();
