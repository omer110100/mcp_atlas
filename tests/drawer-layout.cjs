'use strict';
// Exercise the real presentation module with DOM identity, events and mutation delivery.
// Pixel layout and browser focus visibility still require browser QA.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../dist/drawer-layout.js'),'utf8'),results=[];
function check(name,run){try{run();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
function setup({routeCount=12,sceneCount=17,mapCount=9,language='en'}={}){
  const queue=[],observers=[],events=new Map(),calls=[];let document,step=0,activeMap=1,sceneMap=1;
  function mutation(target){for(const observer of observers)if(observer.target===target&&!observer.pending){observer.pending=true;queue.push(()=>{observer.pending=false;if(observer.target===target)observer.callback([{target,type:'childList'}]);});}}
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs={};this.dataset={};this.className='';this.id='';this.hidden=false;this.open=false;this.disabled=false;this.value='';this.listeners=new Map();this._text='';this.classList={contains:value=>this.className.split(/\s+/).includes(value),add:value=>{if(!this.classList.contains(value))this.className+=' '+value;},remove:value=>{this.className=this.className.split(/\s+/).filter(name=>name!==value).join(' ');}};}
    setAttribute(key,value){value=String(value);this.attrs[key]=value;if(key==='class')this.className=value;if(key==='id')this.id=value;if(key==='hidden')this.hidden=true;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;}
    getAttribute(key){if(key==='class')return this.className;if(key==='id')return this.id;if(key.startsWith('data-'))return this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]??null;return this.attrs[key]??null;}
    append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}mutation(this);}
    before(node){const parent=this.parentElement;assert(parent,'Node must be attached');node.remove();const index=parent.children.indexOf(this);node.parentElement=parent;parent.children.splice(index,0,node);mutation(parent);}
    remove(){if(!this.parentElement)return;const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;mutation(parent);}
    replaceChildren(...nodes){for(const node of [...this.children])node.remove();this._text='';this.append(...nodes);}
    get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
    set textContent(value){for(const node of [...this.children])node.remove();this._text=String(value);mutation(this);}
    get isConnected(){return this===document||!!this.parentElement?.isConnected;}
    contains(node){for(let current=node;current;current=current.parentElement)if(current===this)return true;return false;}
    matchesSimple(selector){const tag=selector.match(/^[\w-]+/);if(tag&&this.tagName!==tag[0].toUpperCase())return false;for(const match of selector.matchAll(/#([\w-]+)/g))if(this.id!==match[1])return false;for(const match of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(match[1]))return false;for(const match of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)){const value=this.getAttribute(match[1]);if(value===null||(match[2]!==undefined&&value!==match[2]))return false;}return true;}
    matches(selector){return selector.split(',').some(part=>{const pieces=part.trim().split(/\s+/);if(!this.matchesSimple(pieces.pop()))return false;let parent=this.parentElement;while(pieces.length){const required=pieces.pop();while(parent&&!parent.matchesSimple(required))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;});}
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);}
    fire(name){const event={target:this,type:name};for(let current=this;current;current=current.parentElement)for(const callback of current.listeners.get(name)||[])callback(event);}
    click(){if(!this.disabled)this.fire('click');}
    focus(){document.activeElement=this;}
  }
  document=new Element('document');document.createElement=tag=>new Element(tag);document.getElementById=id=>document.querySelector('#'+id);document.activeElement=document;
  const body=new Element('body');document.body=body;document.append(body);
  const node=(tag,attrs={},parent=body,value)=>{const result=new Element(tag);for(const [key,val]of Object.entries(attrs))result.setAttribute(key,val);if(value!==undefined)result.textContent=value;parent.append(result);return result;};
  const routeHost=node('div',{id:'routeResult'}),warning=node('p',{class:'route-warning'},routeHost,'A quest is required before travel.'),summary=node('p',{class:'route-summary'},routeHost,'12 maps');
  node('button',{id:'startRoute'},routeHost,'Start guide');node('button',{id:'shellRouteStop'},body,'Stop navigation');
  const secondary=node('div',{class:'route-secondary-actions'},routeHost);const share=node('button',{id:'shareRoute'},secondary,'Share'),restart=node('button',{id:'restartRoute'},secondary,'Restart');
  const routeRows=Array.from({length:routeCount},(_,index)=>{const row=node('div',{class:'route-step','data-step-index':index},routeHost),button=node('button',{'data-route-map':index},row,'Route map '+index);if(index===6)node('small',{},button,'Requires the quest');return row;});
  const legacy=node('button',{id:'clearRoute'},routeHost,'Clear');
  const tools=node('section',{class:'route-tools'},routeHost);node('details',{class:'route-estimate'},tools,'Estimate');const status=node('p',{id:'routeToolsStatus'},tools,'');node('button',{id:'clearRouteAvoids'},tools,'Clear detours');
  const footer=node('div',{class:'route-tools-footer'},routeHost);node('textarea',{id:'routeCopyFallback',hidden:''},footer);node('a',{href:'https://paypal.me/omerLabinsky'},footer,'PayPal');
  routeHost.addEventListener('click',event=>{if(event.target.closest('[data-route-map]'))calls.push(['route',event.target.closest('[data-route-map]').dataset.routeMap]);if(event.target.id==='shareRoute')calls.push(['share']);});
  const details=node('section',{id:'mapDetails'}),preview=node('button',{class:'map-preview'},details,'Open map');node('div',{class:'detail-actions'},details);const portalTabs=node('nav',{class:'portal-tabs'},details);node('button',{class:'active','data-tab':'cross'},portalTabs,'Exits');
  const portals=node('div',{id:'portalContent'},details),mapRows=Array.from({length:mapCount},(_,index)=>node('div',{class:'portal-card','data-gate':'map-'+index},portals,'Portal '+index));const services=node('section',{class:'service-section'},portals);node('p',{},services,'Requires a party');
  const population=node('div',{class:'map-population'},details),occupants=node('details',{class:'map-occupants'},population),grid=node('div',{class:'map-occupant-grid'},occupants);Array.from({length:11},(_,index)=>node('button',{class:'map-occupant','data-map-occupant':'monster','data-entity':index},grid,'Monster '+index));
  const layers=node('nav',{id:'sceneLayers'});node('button',{class:'active','data-layer':'portals'},layers);const filters=node('div',{id:'sceneFilters'});node('button',{class:'active','data-kind':'cross'},filters);
  const selectedHost=node('div',{id:'sceneSelected'}),sceneHost=node('div',{id:'scenePortalList'}),sceneRows=Array.from({length:sceneCount},(_,index)=>{const row=node('div',{class:'portal-card','data-gate':'gate-'+index},sceneHost);node('button',{'data-gate':'gate-'+index},row,'Portal '+index+' Henesys');return row;});
  const route={steps:Array.from({length:Math.max(0,routeCount-1)},()=>({}))};
  const window={Atlas:{currentRoute:route,get activeMap(){return activeMap;},getContext:()=>({step,sceneMap:{id:sceneMap}})},AtlasI18n:{text:(he,en)=>language==='en'?en:he},addEventListener:(name,callback)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(callback);}};
  class MutationObserver{constructor(callback){this.callback=callback;this.pending=false;observers.push(this);}observe(target,options){assert.equal(options.childList,true);assert.equal(options.subtree,undefined);assert.equal(options.attributes,undefined);this.target=target;}disconnect(){this.target=null;}}
  const context=vm.createContext({window,document,MutationObserver,queueMicrotask:callback=>queue.push(callback)});
  vm.runInContext(source,context);const flush=()=>{let count=0;while(queue.length){if(++count>150)throw Error('Mutation observer loop');queue.shift()();}return count;};flush();
  const fire=name=>{for(const callback of events.get(name)||[])callback();flush();};
  return {window,document,node,flush,fire,calls,routeHost,routeRows,warning,summary,share,restart,status,tools,legacy,details,preview,portals,mapRows,services,grid,sceneHost,sceneRows,selectedHost,layers,filters,
    page:key=>document.querySelector(`[data-drawer-pager="${key}"]`),visible:rows=>rows.filter(row=>!row.hidden),setStep:value=>{step=value;},setMap:value=>{activeMap=value;},setScene:value=>{sceneMap=value;},setLanguage:value=>{language=value;},core:vm.runInContext('AtlasDrawerLayoutCore',context)};
}
check('long routes retain exact step nodes and delegated actions while displaying five rows',()=>{
  const h=setup();assert.equal(h.routeHost.querySelectorAll('.route-step').length,12);assert.equal(h.visible(h.routeRows).length,5);assert.equal(h.routeRows[0],h.routeHost.querySelector('.route-step'));h.routeRows[0].querySelector('button').click();assert.deepEqual(h.calls,[['route','0']]);assert.equal(h.warning.hidden,false);assert.equal(h.services.hidden,false);
});
check('page browsing survives unrelated view changes and automatically follows changed progress',()=>{
  const h=setup(),pager=h.page('route');pager.querySelector('[data-drawer-page="next"]').click();assert.deepEqual(h.visible(h.routeRows),h.routeRows.slice(5,10));h.fire('atlas-viewchange');assert.deepEqual(h.visible(h.routeRows),h.routeRows.slice(5,10));h.setStep(11);h.fire('atlas-viewchange');assert.deepEqual(h.visible(h.routeRows),h.routeRows.slice(10));assert.match(pager.querySelector('.drawer-page-status').textContent,/11–12 of 12/);
});
check('current-step jump reveals and focuses its original action without changing navigation',()=>{
  const h=setup();h.page('route').querySelector('[data-drawer-page="next"]').click();h.page('route').querySelector('[data-drawer-current]').click();assert.equal(h.document.activeElement,h.routeRows[0].querySelector('button'));assert.deepEqual(h.visible(h.routeRows),h.routeRows.slice(0,5));assert.equal(h.window.Atlas.getContext().step,0);
});
check('pager edge focus stays on an available control and destination is reachable',()=>{
  const h=setup(),pager=h.page('route'),next=pager.querySelector('[data-drawer-page="next"]'),previous=pager.querySelector('[data-drawer-page="previous"]');next.focus();next.click();next.click();assert.equal(next.disabled,true);assert.equal(h.document.activeElement,previous);assert.equal(h.routeRows.at(-1).hidden,false);previous.click();previous.click();assert.equal(previous.disabled,true);assert.equal(h.document.activeElement,next);
});
check('sharing preserves original IDs/listeners while warnings, detour status and reset stay visible',()=>{
  const h=setup(),options=h.routeHost.querySelector('.drawer-route-options');assert(options.contains(h.share));assert.equal(options.open,false);h.share.click();assert.deepEqual(h.calls,[['share']]);assert.equal(h.warning.parentElement,h.routeHost);assert.equal(h.status.parentElement,h.routeHost);assert.equal(h.document.getElementById('clearRouteAvoids').parentElement,h.routeHost);assert.equal(h.legacy.hidden,true);
});
check('route tools can add detour menus without creating an observer feedback loop or losing pages',()=>{
  const h=setup();h.page('route').querySelector('[data-drawer-page="next"]').click();for(const row of h.routeRows)h.node('details',{class:'route-detour'},row,'Detour');assert.equal(h.flush(),0);for(let i=0;i<15;i++)h.fire('atlas-viewchange');assert.equal(h.routeHost.querySelectorAll('.drawer-route-options').length,1);assert.equal(h.routeHost.querySelectorAll('[data-drawer-pager="route"]').length,1);assert.deepEqual(h.visible(h.routeRows),h.routeRows.slice(5,10));
});
check('a replanned route resets page and stale pager handlers use the new model',()=>{
  const h=setup();h.page('route').querySelector('[data-drawer-page="next"]').click();h.window.Atlas.currentRoute={steps:Array.from({length:11},()=>({}))};h.fire('atlas-viewchange');assert.equal(h.routeRows[0].hidden,false);h.page('route').querySelector('[data-drawer-page="next"]').click();assert.equal(h.routeRows[5].hidden,false);assert.equal(h.routeRows[0].hidden,true);
});
check('scene filters keep empty state and clear action usable without removing original rows',()=>{
  const h=setup(),pager=h.page('scene'),input=pager.querySelector('input');input.value='missing portal';input.fire('input');assert.equal(h.visible(h.sceneRows).length,0);assert.equal(pager.querySelector('.drawer-filter-empty').hidden,false);assert.equal(h.sceneHost.querySelectorAll('.portal-card').length,17);pager.querySelector('[data-drawer-clear]').click();assert.equal(h.visible(h.sceneRows).length,5);assert.equal(h.document.activeElement,input);
});
check('selecting a marker reveals its page and clears a conflicting search once',()=>{
  const h=setup(),pager=h.page('scene'),input=pager.querySelector('input');input.value='Portal 1';input.fire('input');h.sceneRows[16].classList.add('chosen');h.node('div',{},h.selectedHost,'Selected portal');h.flush();assert.equal(input.value,'');assert.equal(h.sceneRows[16].hidden,false);pager.querySelector('[data-drawer-page="previous"]').click();h.fire('atlas-viewchange');assert.equal(h.sceneRows[16].hidden,true);
});
check('map and scene changes clear stale filters with live controls still working',()=>{
  const h=setup();for(const key of ['scene','map-portals']){const input=h.page(key).querySelector('input');input.value='none';input.fire('input');}h.setScene(2);h.setMap(2);h.fire('atlas-viewchange');for(const key of ['scene','map-portals']){const input=h.page(key).querySelector('input');assert.equal(input.value,'');input.value='Portal 7';input.fire('input');assert.match(h.page(key).querySelector('.drawer-page-status').textContent,/1–1 of 1/);}
});
check('replaced occupant rows get paging and preserve exact entity action attributes',()=>{
  const h=setup();h.grid.replaceChildren();const rows=Array.from({length:8},(_,index)=>h.node('button',{class:'map-occupant','data-map-occupant':'npc','data-entity':index+100},h.grid,'NPC '+index));h.flush();assert.equal(h.visible(rows).length,5);h.page('map-monsters').querySelector('[data-drawer-page="next"]').click();assert.equal(h.visible(rows)[0].dataset.entity,'105');assert.equal(h.grid.querySelectorAll('.map-occupant').length,8);
});
check('preview starts compact and its original image button survives toggling',()=>{
  const h=setup(),disclosure=h.details.querySelector('.drawer-map-preview');assert.equal(disclosure.open,false);assert.equal(h.preview.parentElement,disclosure);disclosure.open=true;disclosure.fire('toggle');h.fire('atlas-viewchange');assert.equal(disclosure.open,true);assert.equal(h.details.querySelectorAll('.drawer-map-preview').length,1);
});
check('selected portal folds only source coordinates/name and leaves conditions and travel actions visible',()=>{
  const h=setup(),card=h.node('div',{class:'scene-selected'},h.selectedHost);h.node('span',{},card,'Portal 2');h.node('bdi',{},card,'Henesys');const coords=h.node('small',{},card,'Position in source image: x 12, y 10');h.node('small',{},card,'Portal name in the data');h.node('bdi',{},card,'east00');const condition=h.node('p',{},card,'Requires a quest'),travel=h.node('button',{'data-scene-travel':10},card,'Go to destination map');h.flush();const disclosure=card.querySelector('.drawer-selected-source');assert(disclosure.contains(coords));assert.equal(disclosure.open,false);assert.equal(condition.parentElement,card);assert.equal(travel.parentElement,card);assert.equal(card.querySelectorAll('.drawer-selected-source').length,1);
});
check('NPC source details stay available and identity/title is not hidden',()=>{
  const h=setup(),card=h.node('div',{class:'scene-selected entity-selected'},h.selectedHost);h.node('span',{},card,'NPC location 1');const name=h.node('bdi',{},card,'Grendel');h.node('small',{},card,'ID: 313');h.node('small',{},card,'Position in source image');const coords=h.node('bdi',{class:'entity-coordinates'},card,'x 2, y 3');const warning=h.node('p',{},card,'Recorded location, not live position.');h.flush();assert(card.querySelector('.drawer-selected-source').contains(coords));assert.equal(name.parentElement,card);assert.equal(warning.parentElement,card);
});
check('language changes keep user page and translate pager/search/disclosures',()=>{
  const h=setup();h.page('route').querySelector('[data-drawer-page="next"]').click();h.setLanguage('he');h.fire('atlas-languagechange');assert.match(h.page('route').querySelector('.drawer-page-status').textContent,/מתוך/);assert.equal(h.page('route').querySelector('[data-drawer-page="next"]').textContent,'הבא');assert.equal(h.routeRows[5].hidden,false);assert.match(h.page('scene').querySelector('input').getAttribute('aria-label'),/סינון/);assert.match(h.details.querySelector('.drawer-map-preview summary').textContent,/תצוגה/);
});
check('short and empty lists do not add unnecessary controls or mask existing empty states',()=>{
  const h=setup({routeCount:1,sceneCount:0,mapCount:0});assert.equal(h.page('route').hidden,true);assert.equal(h.page('scene'),null);assert.equal(h.page('map-portals'),null);assert.equal(h.routeRows[0].hidden,false);assert.equal(h.warning.hidden,false);
});
check('filter normalization supports Hebrew marks, multiword names and treats HTML as plain text',()=>{
  const h=setup(),items=['פטרייה כתומה','Grendel the Really Old','<img src=x onerror=alert(1)>'];assert.deepEqual(Array.from(h.core.page(items,{query:'פטרִייה כתומה'}).indices),[0]);assert.deepEqual(Array.from(h.core.page(items,{query:'really GRENDEL'}).indices),[1]);assert.deepEqual(Array.from(h.core.page(items,{query:'<img'}).indices),[2]);assert.equal(h.core.page(items,{page:999}).page,0);
});
const failed=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failed.length,failures:failed}));process.exitCode=failed.length?1:0;
