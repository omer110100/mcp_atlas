'use strict';
// Executes experience.js against focused DOM contracts. No browser/layout assertions.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../dist/experience.js'),'utf8');
const KEY='maple-atlas-experience-v1',results=[];
function check(name,run){try{run();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
function setup(options={}){
  const nodes=new Map(),calls=[],network=[],windowEvents=new Map(),documentEvents=new Map();
  const data=new Map(options.saved===undefined?[]:[[KEY,typeof options.saved==='string'?options.saved:JSON.stringify(options.saved)]]);
  let language=options.language||'en',doc,storageBlocked=!!options.storageBlocked,writeBlocked=!!options.writeBlocked;
  const context=options.context||{activeMap:{id:100,name:'Henesys'},sceneMap:null,route:null};
  const add=(map,name,fn)=>{if(!map.has(name))map.set(name,[]);map.get(name).push(fn);};
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.attrs={};this.dataset={};this.children=[];this.parentElement=null;this.listeners=new Map();this.hidden=false;this.open=false;this.disabled=false;this.checked=false;this.value='';this.textContent='';this.id='';this._html='';this.capture=null;const properties=new Map();this.style={setProperty:(k,v)=>properties.set(k,String(v)),removeProperty:k=>properties.delete(k),getPropertyValue:k=>properties.get(k)||''};this.classList={add:(...names)=>{const all=new Set((this.attrs.class||'').split(/\s+/).filter(Boolean));names.forEach(n=>all.add(n));this.attrs.class=[...all].join(' ');},remove:(...names)=>{this.attrs.class=(this.attrs.class||'').split(/\s+/).filter(n=>!names.includes(n)).join(' ');},contains:name=>(this.attrs.class||'').split(/\s+/).includes(name)};}
    setAttribute(name,value){this.attrs[name]=String(value);if(name==='id'){this.id=String(value);nodes.set(this.id,this);}if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);if(name==='hidden')this.hidden=true;if(name==='open')this.open=true;if(name==='disabled')this.disabled=true;if(name==='checked')this.checked=true;}
    getAttribute(name){return this.attrs[name]??null;}
    removeAttribute(name){delete this.attrs[name];if(name==='hidden')this.hidden=false;if(name==='open')this.open=false;if(name==='disabled')this.disabled=false;}
    append(...children){children.forEach(child=>this.insertBefore(child,null));}
    insertBefore(child,reference){if(child.parentElement){const old=child.parentElement.children;old.splice(old.indexOf(child),1);}const index=reference?this.children.indexOf(reference):this.children.length;if(index<0)throw Error('Unknown insertion reference');this.children.splice(index,0,child);child.parentElement=this;return child;}
    matches(selector){
      if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));
      if(selector==='[contenteditable]:not([contenteditable="false"])')return Object.hasOwn(this.attrs,'contenteditable')&&this.attrs.contenteditable!=='false';
      const structural=selector.replace(/\[[^\]]*\]/g,'');
      const tag=structural.match(/^[a-z][\w-]*/i)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;
      const id=structural.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
      for(const [,name]of structural.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(name))return false;
      for(const [,name,value]of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){if(name==='open'){if(!this.open)return false;}else if(name==='hidden'){if(!this.hidden)return false;}else if(!Object.hasOwn(this.attrs,name)||(value!==undefined&&this.attrs[name]!==value))return false;}
      return true;
    }
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(name,fn){add(this.listeners,name,fn);}
    emit(name,event={},bubble=false){event.target??=this;for(const fn of this.listeners.get(name)||[])fn(event);if(bubble&&this.parentElement)this.parentElement.emit(name,event,true);}
    click(){if(!this.disabled)this.emit('click',{target:this},true);}
    focus(){doc.activeElement=this;this.emit('focus');}
    showModal(){this.open=true;calls.push(['dialog',this.id]);}
    close(){if(this.open){this.open=false;this.emit('close');}}
    getBoundingClientRect(){return {width:Math.max(300,Math.min(Number.parseFloat(doc.documentElement.style.getPropertyValue('--atlas-sidebar-width'))||370,window.innerWidth*.45)),top:0,right:window.innerWidth};}
    setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}
    set innerHTML(value){this._html=String(value);this.children=[];const stack=[this];for(const match of this._html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*?)\/?\s*>/gi)){const [markup,tag,attrs]=match;if(markup.startsWith('</')){if(stack.length>1)stack.pop();continue;}const child=new Element(tag);for(const [,key,val]of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g))child.setAttribute(key,val??'');stack.at(-1).append(child);if(!/\/>$/.test(markup)&&!['input','img','br','hr','meta','link'].includes(tag.toLowerCase()))stack.push(child);}}
    get innerHTML(){return this._html;}
  }
  const root=new Element('html'),body=new Element('body');root.append(body);
  doc={documentElement:root,body,activeElement:body,getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag),querySelector:selector=>root.querySelector(selector),querySelectorAll:selector=>root.querySelectorAll(selector),addEventListener:(name,fn)=>add(documentEvents,name,fn)};
  const base=(id,tag='div',parent=body,classes='')=>{const node=new Element(tag);if(id)node.setAttribute('id',id);if(classes)node.setAttribute('class',classes);parent.append(node);return node;};
  const workspace=base('', 'main',body,'workspace'),world=base('', 'section',workspace,'world-pane'),topbar=base('', 'div',world,'map-topbar');
  const side=base('sidePanel','aside',workspace);base('', 'footer',side,'panel-footer');
  base('search','input',topbar);base('directoryToggle','button',topbar);base('worldSvg','svg',world);
  base('directory','section',world).hidden=true;base('closeDirectory','button',nodes.get('directory'));
  base('routePanel','section',side).hidden=true;for(const id of ['routeFrom','routeTo'])base(id,'input',nodes.get('routePanel'));base('closeRoute','button',nodes.get('routePanel'));
  for(const id of ['appearanceDialog','personalDialog','sceneDialog','aboutDialog'])base(id,'dialog');
  base('appearanceStorage','p',nodes.get('appearanceDialog'));base('personalToggle','button');
  base('sceneNavigation','section',nodes.get('sceneDialog')).hidden=true;
  for(const id of ['sceneNavNext','sceneNavPrevious','sceneNavFocus']){const button=base(id,'button',nodes.get('sceneNavigation'));button.addEventListener('click',()=>calls.push(['scene-action',id]));}
  if(options.dialogOpen)nodes.get(options.dialogOpen).open=true;
  nodes.get('directoryToggle').addEventListener('click',()=>{nodes.get('directory').hidden=!nodes.get('directory').hidden;});
  nodes.get('closeDirectory').addEventListener('click',()=>{nodes.get('directory').hidden=true;});
  nodes.get('closeRoute').addEventListener('click',()=>{nodes.get('routePanel').hidden=true;});
  nodes.get('personalToggle').addEventListener('click',()=>nodes.get('personalDialog').showModal());
  const api={currentRoute:options.journey||null,getContext:()=>context,fitWorld:()=>calls.push(['fit']),openRoute:()=>{nodes.get('routePanel').hidden=false;calls.push(['route']);}};
  const window={innerWidth:options.width||1280,Atlas:options.ready===false?undefined:api,AtlasI18n:{get language(){return language;},text:(he,en)=>language==='en'?en:he},Hunt:{close:settings=>calls.push(['hunt-close',settings]),open:kind=>calls.push(['hunt-open',kind])},addEventListener:(name,fn)=>add(windowEvents,name,fn),dispatchEvent:event=>(windowEvents.get(event.type)||[]).forEach(fn=>fn(event)),open:()=>network.push('window.open')};
  const location=new URL('https://atlas.example/?private=DO_NOT_SHARE'+(options.hash||''));
  class Event {constructor(type){this.type=type;}}
  const sandbox={window,document:doc,localStorage:{getItem:key=>{if(storageBlocked)throw Error('storage denied');return data.get(key)||null;},setItem:(key,value)=>{if(storageBlocked||writeBlocked)throw Error('quota');data.set(key,value);}},location,URL,URLSearchParams,Event,MutationObserver:class{observe(){}},requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame:()=>{},queueMicrotask:fn=>fn(),fetch:()=>{network.push('fetch');throw Error('Unexpected network call');},XMLHttpRequest:class{constructor(){network.push('xhr');}},navigator:{sendBeacon:()=>network.push('beacon')},console};
  vm.runInNewContext(source,sandbox,{filename:'experience.js'});
  const key=(name,{target=doc.body,...more}={})=>{const event={key:name,target,defaultPrevented:false,altKey:false,ctrlKey:false,metaKey:false,preventDefault(){this.defaultPrevented=true;},...more};for(const fn of documentEvents.get('keydown')||[])fn(event);return event;};
  return {doc,window,calls,network,key,api,base,el:id=>nodes.get(id),get stored(){return JSON.parse(data.get(KEY)||'null');},get report(){return window.AtlasExperience.buildReportUrl();},changeLanguage:value=>{language=value;window.dispatchEvent(new Event('atlas-languagechange'));},ready:()=>{window.Atlas=api;window.dispatchEvent(new Event('atlas-ready'));},setWriteBlocked:value=>writeBlocked=value};
}
const returning={version:1,welcomeSeen:true};
check('first visit offers three functional starting actions and dismissal is remembered',()=>{
  const h=setup();assert(h.el('welcomeDialog').open);assert.equal(h.el('welcomeDialog').querySelectorAll('[data-xp-start]').length,3);
  h.el('welcomeDialog').querySelector('[data-xp-start="route"]').click();assert(!h.el('welcomeDialog').open);assert(h.stored.welcomeSeen);assert.equal(h.doc.activeElement.id,'routeFrom');assert(h.calls.some(c=>c[0]==='route'));
  assert(!setup({saved:h.stored}).el('welcomeDialog').open);
});
check('welcome never replaces a map link, route link, saved journey, or existing modal',()=>{
  for(const options of [{hash:'#map=100'},{hash:'#route=100,200'},{hash:'#route=invalid'},{journey:{from:100,to:200}},{dialogOpen:'personalDialog'},{saved:returning}])assert.equal(setup(options).el('welcomeDialog').open,false);
});
check('entry actions remain disabled until the atlas is ready',()=>{
  const h=setup({ready:false});assert(!h.el('welcomeDialog').open);assert(h.el('mobileNav').querySelectorAll('button').every(b=>b.disabled));
  h.ready();assert(h.el('welcomeDialog').open);assert(h.el('mobileNav').querySelectorAll('button').every(b=>!b.disabled));
});
check('valid reading, panel width, and map/list preferences survive a new page',()=>{
  const h=setup({saved:{...returning,readability:true,sidebarWidth:440,view:'list'}});
  assert.equal(h.doc.documentElement.dataset.readability,'comfortable');assert.equal(h.doc.documentElement.style.getPropertyValue('--atlas-sidebar-width'),'440px');assert(!h.el('directory').hidden);
  h.el('readabilityToggle').checked=false;h.el('readabilityToggle').emit('change');assert.equal(h.stored.readability,false);assert.equal(setup({saved:h.stored}).doc.documentElement.dataset.readability,'standard');
});
check('a saved postcard preference does not obscure explicit deep links or a restored journey',()=>{
  for(const options of [{hash:'#map=100'},{hash:'#route=100,200'},{journey:{from:100,to:200}}])assert(setup({...options,saved:{...returning,view:'list'}}).el('directory').hidden);
});
check('preference boundary rejects malformed versions, types, and out-of-range widths',()=>{
  for(const saved of ['{"broken',null,{version:2,readability:true,sidebarWidth:440},{...returning,readability:'true',sidebarWidth:'440'},{...returning,sidebarWidth:-1},{...returning,sidebarWidth:299},{...returning,sidebarWidth:521},{...returning,sidebarWidth:1e30}]){
    const h=setup({saved,hash:'#map=100'});assert.equal(h.doc.documentElement.dataset.readability,'standard');assert.equal(h.doc.documentElement.style.getPropertyValue('--atlas-sidebar-width'),'');
  }
  for(const width of [300,520])assert.equal(setup({saved:{...returning,sidebarWidth:width}}).doc.documentElement.style.getPropertyValue('--atlas-sidebar-width'),`${width}px`);
});
check('storage denial keeps session changes usable and reports the failure',()=>{
  const h=setup({storageBlocked:true,hash:'#map=100'});h.el('readabilityToggle').checked=true;h.el('readabilityToggle').emit('change');
  assert.equal(h.doc.documentElement.dataset.readability,'comfortable');assert.match(h.el('experienceStorage').textContent,/unavailable/);h.window.AtlasExperience.openWelcome();h.el('welcomeDialog').close();assert.equal(h.stored,null);
});
check('quota recovery preserves current-session preferences',()=>{
  const h=setup({saved:returning,writeBlocked:true});h.el('readabilityToggle').checked=true;h.el('readabilityToggle').emit('change');h.setWriteBlocked(false);h.el('sidePanelResizeHandle').emit('keydown',{key:'ArrowLeft',preventDefault(){}});
  assert.equal(h.stored.readability,true);assert.equal(h.stored.sidebarWidth,390);assert(!h.el('experienceStorage').textContent.includes('unavailable'));
});
check('splitter keyboard controls honor viewport bounds and reset removes saved width',()=>{
  const h=setup({saved:returning,width:800}),divider=h.el('sidePanelResizeHandle');
  divider.emit('keydown',{key:'End',preventDefault(){}});assert.equal(h.stored.sidebarWidth,360);
  divider.emit('keydown',{key:'Home',preventDefault(){}});assert.equal(h.stored.sidebarWidth,300);
  divider.emit('keydown',{key:'ArrowRight',preventDefault(){}});assert.equal(h.stored.sidebarWidth,300);
  h.el('resetSidebarWidth').click();assert.equal(h.stored.sidebarWidth,null);assert.equal(h.doc.documentElement.style.getPropertyValue('--atlas-sidebar-width'),'');
});
check('keyboard help respects typing, modifiers, default prevention, and open dialogs',()=>{
  const h=setup({saved:returning});
  for(const tag of ['input','textarea','select'])assert(!h.key('?',{target:h.base('',tag)}).defaultPrevented);
  const editor=h.base('','div');editor.setAttribute('contenteditable','true');const child=h.base('','span',editor);assert(!h.key('?',{target:child}).defaultPrevented);
  for(const modifier of ['altKey','ctrlKey','metaKey'])assert(!h.key('?',{[modifier]:true}).defaultPrevented);
  h.key('?',{defaultPrevented:true});assert(!h.el('shortcutDialog').open);
  h.el('personalDialog').open=true;assert(!h.key('?').defaultPrevented);assert(!h.el('shortcutDialog').open);h.el('personalDialog').open=false;
  assert(h.key('?').defaultPrevented);assert(h.el('shortcutDialog').open);
});
check('experience leaves existing slash and Escape handling alone',()=>{
  const h=setup({saved:returning});assert(!h.key('/').defaultPrevented);h.window.AtlasExperience.openShortcuts();assert(!h.key('Escape').defaultPrevented);
});
check('N P F operate only eligible buttons in the sole active navigation dialog',()=>{
  const h=setup({saved:returning});h.key('n');assert(!h.calls.some(c=>c[0]==='scene-action'));
  h.el('sceneDialog').open=true;h.el('sceneNavigation').hidden=false;
  for(const key of ['n','P','f'])assert(h.key(key).defaultPrevented);
  assert.deepEqual(h.calls.filter(c=>c[0]==='scene-action').map(c=>c[1]),['sceneNavNext','sceneNavPrevious','sceneNavFocus']);
  const before=h.calls.length;h.el('sceneNavNext').disabled=true;h.key('n');h.el('sceneNavFocus').hidden=true;h.key('f');h.key('p',{target:h.el('routeFrom')});assert.equal(h.calls.length,before);
  h.el('sceneNavNext').disabled=false;h.window.AtlasExperience.openShortcuts();assert(!h.key('n').defaultPrevented);assert.equal(h.calls.length,before+1);
  h.el('shortcutDialog').close();h.el('sceneNavigation').hidden=true;assert(!h.key('p').defaultPrevented);
});
check('mobile map closes overlays and planner without discarding route data',()=>{
  const journey={from:100,to:200},h=setup({saved:returning,journey});h.el('directory').hidden=false;h.el('routePanel').hidden=false;h.el('sceneDialog').open=true;
  h.el('mobileNav').querySelector('[data-xp-mobile="map"]').click();assert(h.el('directory').hidden);assert(h.el('routePanel').hidden);assert(!h.el('sceneDialog').open);assert.equal(h.api.currentRoute,journey);assert.equal(h.doc.activeElement.id,'worldSvg');assert.equal(h.stored.view,'map');
});
check('contextual issue draft includes only bounded public map and route context',()=>{
  const h=setup({saved:returning,hash:'#map=100',context:{activeMap:{id:100,name:'Private context ignored'},sceneMap:{id:200,name:'Portal & map <name>'},route:{from:100,to:200,stops:[101,102,'unsafe',NaN,...Array.from({length:20},(_,i)=>300+i)],index:2,total:9,services:true,goal:{note:'SECRET_GOAL'}},notes:'SECRET_NOTE',favorites:[999],recent:[888]}});
  const url=new URL(h.report),body=url.searchParams.get('body');assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/omer110100/mcp_atlas/issues/new');assert.match(url.searchParams.get('title'),/Portal & map <name> \[200\]/);assert.match(body,/stops: 101, 102, 300, 301, 302, 303, 304, 305;/);assert.match(body,/step 2\/9; services: true/);
  for(const secret of ['SECRET_GOAL','SECRET_NOTE','DO_NOT_SHARE','favorites','recent','unsafe'])assert(!url.href.includes(secret));assert.equal(h.network.length,0);
  h.el('experienceReport').click();assert.equal(h.el('experienceReport').href,h.report);assert.equal(h.network.length,0);
});
check('report formatter rejects malformed numeric context and bounds map name length',()=>{
  const h=setup({saved:returning,context:{activeMap:{id:'100',name:'x'.repeat(500)},route:{from:'100',to:200,stops:[1],index:1,total:2}}});
  const url=new URL(h.report);assert.equal(url.searchParams.get('title'),'Atlas report');assert.match(url.searchParams.get('body'),/Map: —\nRoute: —/);
  const bounded=new URL(setup({saved:returning,context:{activeMap:{id:100,name:'x'.repeat(500)}}}).report);assert.equal((bounded.searchParams.get('title').match(/x/g)||[]).length,160);
});
check('release badge is acknowledged only when notes are opened and stays dismissed on reload',()=>{
  const h=setup({saved:returning}),badge=h.doc.querySelector('.experience-new');assert(!badge.hidden);assert.equal(h.stored.lastSeenRelease,undefined);
  h.window.AtlasExperience.openRelease();assert(h.el('releaseDialog').open);assert(badge.hidden);assert.equal(h.stored.lastSeenRelease,'expedition-20261120');assert(setup({saved:h.stored}).doc.querySelector('.experience-new').hidden);
});
check('support is an optional direct link with safe external-link attributes and no network requests',()=>{
  const h=setup({saved:returning}),link=h.el('experienceTools').querySelector('a[href="https://buymeacoffee.com/omerlabinsky"]');
  assert(link);assert.equal(link.getAttribute('target'),'_blank');assert.equal(link.getAttribute('rel'),'noopener noreferrer');assert.match(h.el('experienceTools').querySelector('[data-xp-label="supportNote"]').textContent,/optional/);assert.equal(h.network.length,0);
});
check('language switching updates injected interface without losing reading mode or saved width',()=>{
  const h=setup({saved:{...returning,readability:true,sidebarWidth:420}});h.changeLanguage('he');assert.equal(h.el('welcomeTitle').textContent,'לאן יוצאים היום?');assert.equal(h.doc.documentElement.dataset.readability,'comfortable');assert.equal(h.doc.documentElement.style.getPropertyValue('--atlas-sidebar-width'),'420px');h.changeLanguage('en');assert.equal(h.el('welcomeTitle').textContent,'Where are we headed?');
});
const failures=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
