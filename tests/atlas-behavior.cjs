'use strict';
// Logic/DOM-contract audit only. This is not a browser or visual test.
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const root=require('node:path').resolve(__dirname,'..');
const atlas=JSON.parse(fs.readFileSync(root+'/dist/atlas-data.json','utf8'));
const hunt=JSON.parse(fs.readFileSync(root+'/dist/hunt-data.json','utf8'));
const source=fs.readFileSync(root+'/dist/app.js','utf8');
const elements=new Map(),windowListeners=new Map();
class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.attrs={};this.dataset={};this.children=[];this.listeners={};this.style={};this.value='';this.hidden=false;this.open=false;this.innerHTML='';this.textContent='';this.classes=new Set();this.classList={add:(...s)=>s.forEach(x=>this.classes.add(x)),remove:(...s)=>s.forEach(x=>this.classes.delete(x)),contains:s=>this.classes.has(s),toggle:(s,b)=>{const yes=b??!this.classes.has(s);yes?this.classes.add(s):this.classes.delete(s);return yes;}};}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=String(v);if(k==='class')this.classes=new Set(String(v).split(/\s+/));}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  scrollIntoView(){}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  querySelector(q){return this.children.find(c=>c.tagName?.toLowerCase()===q)||new Element(q.startsWith('.')?'div':q);}
  querySelectorAll(q){
    if(q!=='[role="option"]')return [];
    if(this._optionSource!==this.innerHTML){
      this._optionSource=this.innerHTML;this._options=[];
      for(const m of this.innerHTML.matchAll(/<button\b([^>]*)>/g)){
        if(!/role="option"/.test(m[1]))continue;
        const el=new Element('button');
        for(const attr of m[1].matchAll(/([\w-]+)="([^"]*)"/g))el.setAttribute(attr[1],attr[2]);
        this._options.push(el);
      }
    }
    return this._options||[];
  }
  getBoundingClientRect(){return {width:1000,height:700,left:0,top:0,right:1000,bottom:700};}
  scrollTo(options){this.lastScrollOptions=options;} focus(){document.activeElement=this;} blur(){document.activeElement=new Element('body');}
  showModal(){this.open=true;} close(){this.open=false;} insertAdjacentHTML(){} insertAdjacentElement(){}
}
const get=id=>{if(!elements.has(id))elements.set(id,new Element(id==='search'?'input':'div'));return elements.get(id);};
const document={getElementById:get,createElementNS:(ns,tag)=>new Element(tag),createElement:tag=>new Element(tag),querySelector:q=>get(q),querySelectorAll:()=>[],addEventListener(){},activeElement:new Element('body')};
const entities=[...hunt.items.map(x=>({...x,kind:'item'})),...hunt.monsters.map(x=>({...x,kind:x.isBoss?'boss':'monster'})),...hunt.npcs.map(x=>({...x,kind:'npc'}))];
const window={HuntData:hunt,Hunt:{searchAll:q=>entities.filter(x=>`${x.name} ${x.id}`.toLowerCase().includes(q)).sort((a,b)=>Number(String(b.id)===q)-Number(String(a.id)===q)),close(){},open(){}},addEventListener:(k,f)=>{(windowListeners.get(k)||windowListeners.set(k,[]).get(k)).push(f);},dispatchEvent:e=>{for(const fn of windowListeners.get(e.type)||[])fn(e);}};
const ctx=vm.createContext({console,document,window,ATLAS:atlas,HUNT:hunt,location:{hash:'',href:'https://example.test/'},history:{replaceState(){}},requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){},Event:class{constructor(type){this.type=type;}}});
vm.runInContext(fs.readFileSync(root+'/dist/journey.js','utf8'),ctx);
vm.runInContext(source.replace(/\ninit\(\);\s*$/,'\n'),ctx);
vm.runInContext(`atlas=ATLAS;maps=atlas.maps;groups=atlas.groups;byId=new Map(maps.map(m=>[m.id,m]));incoming=new Map();adjacency=new Map();for(const m of maps){const out=[];for(const p of m.portals)if(p.kind==='cross'&&byId.has(p.to)){out.push({to:p.to,p});if(!incoming.has(p.to))incoming.set(p.to,[]);incoming.get(p.to).push({from:m,p});}adjacency.set(m.id,out);}activeId=10001000;bindEvents();`,ctx);
const run=s=>vm.runInContext(s,ctx),results=[];
const check=(name,passed,detail)=>results.push({name,passed:!!passed,...detail!==undefined?{detail}: {}});
const fire=(id,type,event={})=>{for(const fn of get(id).listeners[type]||[])fn({preventDefault(){},stopPropagation(){},...event});};

// Real search renderer and registered key handler, with a deterministic
// candidate provider matching the hunt module's public result contract.
get('search').value='henesys';run('renderSearch()');
check('search finds Henesys',run('activeSearchResults.some(x=>x.kind==="map"&&x.id===10001000)'));
get('search').value='';run('renderSearch()');
run('globalThis.selectionCalls=[];globalThis.originalChooseSearch=chooseSearch;chooseSearch=(id,kind)=>selectionCalls.push({id,kind});');
fire('search','keydown',{key:'Enter'});
check('empty search Enter does not select stale result',run('selectionCalls.length===0'),run('selectionCalls'));
run('chooseSearch=originalChooseSearch;');
for(const [q,kind,id] of [['2','monster',2],['100','npc',100]]){
  get('search').value=q;run('renderSearch()');
  check(`exact numeric ${kind} ID ${id} appears in global first16`,run(`activeSearchResults.some(x=>x.kind===${JSON.stringify(kind)}&&x.id===${id})`),run('activeSearchResults.map(x=>({kind:x.kind,id:x.id,name:x.name}))'));
}
get('search').value='henesys';run('renderSearch()');fire('search','keydown',{key:'Escape'});
check('Escape updates search expanded state',get('search').getAttribute('aria-expanded')==='false',{expanded:get('search').getAttribute('aria-expanded'),hidden:get('searchResults').hidden});
get('search').value='henesys';run('renderSearch()');fire('search','keydown',{key:'ArrowDown'});
check('search keyboard can advance active option',run('searchIndex>=0'),{searchIndex:run('searchIndex')});

run(`currentRegion='maple';selectMap(10001000,{focus:true});`);
check('selecting map outside region filter reveals selected map',run('visibleMap(byId.get(activeId))'),run('({currentRegion,activeId})'));
run("currentRegion='world';");

// Verify every displayed entity point remains a distinct source point.
let monsterMismatch=[],npcMismatch=[];
for(const m of atlas.maps){
  run(`sceneId=${m.id};setSceneLayer('monsters',[]);`);
  const actual=run('sceneEntityPoints.map(p=>({mobId:p.entityId,x:p.x,y:p.y}))');
  const expected=hunt.mapSpawns[m.id]?.points||[];
  if(JSON.stringify(actual)!==JSON.stringify(expected))monsterMismatch.push(m.id);
  run(`setSceneLayer('npcs',[]);`);
  const npc=run('sceneEntityPoints.map(p=>({id:p.entityId,x:p.x,y:p.y}))');
  if(JSON.stringify(npc)!==JSON.stringify(m.npcs.map(p=>({id:p.id,x:p.x,y:p.y}))))npcMismatch.push(m.id);
}
check('all8623 monster points preserved by scene layer',monsterMismatch.length===0,monsterMismatch);
check('all270 NPC points preserved by scene layer',npcMismatch.length===0,npcMismatch);
run("openSpawns(10001005,[700000]);");
check('Mushmom exact ID filter shows correct point',run('sceneEntityPoints.length===1&&sceneEntityPoints[0].x===833&&sceneEntityPoints[0].y===1070'));
run("openSpawns(10001005,[810002]);");
check('same-named boss copy gains no fabricated point',run('sceneEntityPoints.length===0'));
run("openNpcs(10000000,[112]);");
check('NPC exact ID filter shows Pason at source coordinates',run('sceneEntityPoints.length===1&&sceneEntityPoints[0].x===2750&&sceneEntityPoints[0].y===1888'));
run("sceneId=10001005;window.HuntData=undefined;setSceneLayer('monsters',[]);");
window.HuntData=hunt;window.dispatchEvent({type:'hunt-ready'});
check('open monster layer refreshes after delayed catalogue arrival',run('sceneEntityPoints.length===HUNT.mapSpawns[10001005].points.length'),run('({displayed:sceneEntityPoints.length,expected:HUNT.mapSpawns[10001005].points.length})'));

// Activate real event handlers for each category of portal interaction.
function detailsAction(mapId,action,gateKey){run(`activeId=${mapId};`);const b={dataset:{action,gate:gateKey}};fire('mapDetails','click',{target:{closest:q=>q==='[data-action]'?b:null}});}
const rawCross=atlas.maps.flatMap(m=>m.portals.filter(p=>p.kind==='cross').map(p=>({m,p})));
let crossFailures=[];
for(const {m,p}of rawCross){detailsAction(m.id,'portal-go',p.key);if(run('activeId')!==p.to)crossFailures.push(p.key);}
check('all694 fixed portal card clicks select exact destination',crossFailures.length===0,crossFailures);
const internal=atlas.maps.flatMap(m=>m.portals.filter(p=>p.kind==='internal').map(p=>({m,p})));
let internalFailures=[];
for(const {m,p}of internal){detailsAction(m.id,'portal-go',p.key);if(run('sceneId')!==m.id||run('selectedGate')!==p.key)internalFailures.push(p.key);}
check('all357 internal portal clicks stay on source map and select gate',internalFailures.length===0,internalFailures);
detailsAction(10002071,'portal-go','10002071:9');
check('documented Hollow script card exposes its verified target',get('sceneSelected').innerHTML.includes('data-scene-travel="10006060"'));
fire('sceneSelected','click',{target:{closest:()=>({dataset:{sceneTravel:'10006060',travelGate:'10002071:9'}})}});
check('documented Hollow destination button opens correct map',run('activeId===10006060&&sceneId===10006060'));
const unknown=atlas.maps.flatMap(m=>m.portals.filter(p=>p.kind==='unknown').map(p=>({m,p}))).find(({m,p})=>m.id===10000000&&p.name==='in03');
detailsAction(unknown.m.id,'portal-go',unknown.p.key);
check('unresolved gate has no fabricated travel button',!get('sceneSelected').innerHTML.includes('data-scene-travel='));


// Focused regressions for the newly repaired keyboard accessibility and the
// newly added route-pin and image-state features. Browser rendering is not simulated.
get('search').value='henesys';run('renderSearch()');fire('search','keydown',{key:'ArrowDown'});
let options=get('searchResults').querySelectorAll('[role="option"]');
check('keyboard active descendant identifies exactly one selected option',get('search').getAttribute('aria-activedescendant')===options[0]?.id&&options.filter(x=>x.getAttribute('aria-selected')==='true').length===1);
fire('search','keydown',{key:'ArrowUp'});
check('keyboard navigation wraps safely through result options',run('searchIndex===activeSearchResults.length-1')&&get('search').getAttribute('aria-activedescendant')===options.at(-1)?.id);
fire('search','keydown',{key:'Escape'});
check('closing search clears active descendant and selected options',get('search').getAttribute('aria-activedescendant')===null&&options.every(x=>x.getAttribute('aria-selected')==='false'));
get('routeFrom').value='Ellinia [10002000]';get('routeTo').value='Forgotten Hollow [10006000]';get('useServices').checked=false;run('submitRoute()');
const routePins=[...get('routeResult').innerHTML.matchAll(/data-route-scene="(\d+)" data-route-gate="([^"]+)"/g)].map(m=>({mapId:Number(m[1]),key:m[2]}));
const expectedPins=run('route.steps.map(s=>({mapId:s.from,key:s.p?.key||byId.get(s.from).portals.find(p=>supplementForGate(p,byId.get(s.from))?.id===s.service?.id)?.key}))');
check('all11 route departure buttons identify exact source gates including Hollow script',JSON.stringify(routePins)===JSON.stringify(expectedPins),routePins);
let routePinFails=[];
for(const p of routePins){fire('routeResult','click',{target:{closest:q=>q==='[data-route-scene]'?{dataset:{routeScene:String(p.mapId),routeGate:p.key}}:null}});if(run('sceneId')!==p.mapId||run('selectedGate')!==p.key)routePinFails.push(p);}
check('all11 route departure button handlers open exact map and gate',routePinFails.length===0,routePinFails);
get('sceneNavigation').scrollTop=210;
run('openScene(10001000)');
check('opening a scene starts its navigation summary at the top',get('sceneNavigation').scrollTop===0);
check('map image pending load has explicit loading and busy state',!get('sceneImageStatus').hidden&&get('sceneImageStatus').dataset.state==='loading'&&get('sceneCanvas').getAttribute('aria-busy')==='true');
get('sceneImage').onerror();
check('map image error exposes retry without inventing map content',get('sceneImageStatus').dataset.state==='error'&&!get('sceneImageRetry').hidden&&get('sceneCanvas').getAttribute('aria-busy')==='false');
fire('sceneImageRetry','click');
check('map image retry requests same map with cache-busting URL',get('sceneImage').getAttribute('href').startsWith(atlas.maps.find(m=>m.id===10001000).image+'?retry=')&&get('sceneImageStatus').dataset.state==='loading');
get('sceneImage').onload();
check('map image successful retry clears busy and error state',get('sceneImageStatus').hidden&&get('sceneImage').style.visibility===''&&get('sceneCanvas').getAttribute('aria-busy')==='false');
run('openScene(-999)');
check('invalid scene ID cannot corrupt current scene state',run('sceneId===10001000'));


// Journey state, boundaries, detours and scripted transitions.
get('routeFrom').value='Ellinia [10002000]';get('routeTo').value='Forgotten Hollow [10006000]';run('submitRoute();openRouteStep(0)');
check('journey opens at first exit with previous disabled',run('navigationIndex===0&&selectedGate===route.steps[0].p.key')&&get('sceneNavPrevious').disabled);
fire('sceneNavNext','click');
check('next opens next source and highlights its exit',run('navigationIndex===1&&sceneId===route.steps[1].from&&selectedGate===navigationGate().key'));
fire('sceneNavPrevious','click');
check('previous restores exact step',run('navigationIndex===0&&sceneId===route.from'));
run('travelScenePortal(navigationGate().key)');
check('taking required portal advances route progress',run('navigationIndex===1&&navigationFollowing'));
run('openScene(10001000)');
check('free exploration preserves route position and offers return',run('navigationIndex===1&&!navigationFollowing')&&!get('sceneNavReturn').hidden);
fire('sceneNavReturn','click');
check('return restores saved exit without resetting journey',run('navigationIndex===1&&navigationFollowing&&selectedGate===navigationGate().key'));
run('openRouteStep(route.steps.findIndex(s=>s.service));travelScenePortal(navigationGate().key)');
check('documented scripted portal advances within guide',run('navigationFollowing&&sceneId===10006060'));
run('openRouteStep(route.steps.length)');
check('destination has completion state and no next step',get('sceneNavNext').disabled&&run('sceneId===route.to&&selectedGate===null'));
run('openRouteStep(999);openRouteStep(-1)');
check('invalid journey steps leave progress intact',run('navigationIndex===route.steps.length'));
get('routeTo').value='Ellinia [10002000]';run('submitRoute();openRouteStep(0)');
check('same-map route completes with both controls disabled',get('sceneNavNext').disabled&&get('sceneNavPrevious').disabled);
get('routeTo').value='Forgotten Hollow [10006000]';run('submitRoute()');
check('replacing route invalidates old guide',!run('navigationActive()')&&get('sceneNavigation').hidden);

// Compact navigation and explicit rerouting from a user-selected map.
get('routeFrom').value='Ellinia [10002000]';get('routeTo').value='Forgotten Hollow [10006000]';get('useServices').checked=false;run('submitRoute();openRouteStep(0)');
fire('sceneNavCompact','click');
check('compact mode exposes pressed control and removes sidebar layout',run('compactNavigation')&&get('sceneDialog').classList.contains('compact-navigation')&&get('sceneNavCompact').getAttribute('aria-pressed')==='true');
check('compact mode centers the required exit in the canvas',run('Math.abs(scene.x+navigationGate().x*scene.k-500)<.001&&Math.abs(scene.y+navigationGate().y*scene.k-350)<.001&&selectedGate===navigationGate().key'));
fire('sceneNavNext','click');
check('next compact step centers its own gate, not the previous map gate',run('navigationIndex===1&&sceneId===route.steps[1].from&&selectedGate===navigationGate().key&&Math.abs(scene.x+navigationGate().x*scene.k-500)<.001&&Math.abs(scene.y+navigationGate().y*scene.k-350)<.001'));
fire('sceneNavCompact','click');
check('leaving compact mode restores full layout and clears pressed state',!run('compactNavigation')&&!get('sceneDialog').classList.contains('compact-navigation')&&get('sceneNavCompact').getAttribute('aria-pressed')==='false');
run('setCompactNavigation(true);openScene(10001000)');
check('detour exposes full map and explicit reroute while retaining compact preference',run('compactNavigation&&!navigationFollowing')&&!get('sceneDialog').classList.contains('compact-navigation')&&!get('sceneNavReroute').hidden&&get('sceneNavCompact').hidden);
fire('sceneNavReturn','click');
check('return to saved route restores compact layout and current exit focus',get('sceneDialog').classList.contains('compact-navigation')&&run('navigationIndex===1&&selectedGate===navigationGate().key&&Math.abs(scene.x+navigationGate().x*scene.k-500)<.001'));
run('openRouteStep(route.steps.findIndex(s=>s.service))');
check('compact guide retains the documented conditional transition instructions',get('sceneNavInstruction').textContent===run('serviceCondition(route.steps[navigationIndex].service)')&&get('sceneNavInstruction').textContent.length>0);
run('openRouteStep(route.steps.length)');
check('compact destination handles absent exit and disables advancing',run('selectedGate===null')&&get('sceneNavNext').disabled&&get('sceneNavFocus').hidden);
run('openRouteStep(1);openScene(10001000);globalThis.previousDestination=route.to;');get('useServices').checked=true;
check('explicit reroute from detour succeeds',run('rerouteFromScene()')===true);
check('reroute uses displayed origin, same destination and restarts at its exact exit',run('route.from===10001000&&route.to===previousDestination&&navigationIndex===0&&navigationFollowing&&selectedGate===navigationGate().key'));
check('reroute retains planned service policy despite an edited form checkbox',run('routeUsesServices===false')&&get('useServices').checked===false);
run('openRouteStep(1);globalThis.beforeFailedRoute=route;globalThis.beforeFailedIndex=navigationIndex;openScene(10007000)');
check('unreachable detour reports failure instead of replacing the route',run('rerouteFromScene()')===false&&run('route===beforeFailedRoute&&navigationIndex===beforeFailedIndex&&routeUsesServices===false')&&get('sceneNavError').textContent.length>0);
fire('sceneNavReturn','click');
check('return remains usable after failed reroute',run('navigationFollowing&&navigationIndex===beforeFailedIndex&&route===beforeFailedRoute')&&get('sceneNavError').textContent==='');
get('routeFrom').value='Ellinia [10002000]';get('routeTo').value='Lith Harbor [10000000]';get('useServices').checked=true;run('submitRoute();openRouteStep(0);openScene(60)');get('useServices').checked=false;
check('enabled conditional-travel preference survives reroute and includes documented boat',run('rerouteFromScene()&&routeUsesServices&&route.from===60&&route.to===10000000&&route.steps.some(s=>s.service?.id==="ship-southperry-lith")')&&get('useServices').checked===true);
run('openScene(route.to)');
check('reroute from destination gives valid zero-step completion',run('rerouteFromScene()&&route.from===route.to&&route.steps.length===0&&navigationIndex===0')&&get('sceneNavNext').disabled&&get('sceneNavPrevious').disabled);
run('navigationRoute=null;renderSceneNavigation();globalThis.inactiveRoute=route');
check('inactive guide never forces compact layout or allows reroute',!get('sceneDialog').classList.contains('compact-navigation')&&run('rerouteFromScene()===false&&route===inactiveRoute'));

// Language refresh exercises the real registered renderer without re-planning.
// The translation provider follows the public API; shell direction is tested separately.
vm.runInContext(fs.readFileSync(root+'/dist/translations.js','utf8'),ctx);
run(`window.AtlasI18n={language:'he',data(value){return this.language==='en'?(window.AtlasTranslations[value]??value):value;}};`);
const changeLanguage=language=>{window.AtlasI18n.language=language;window.dispatchEvent({type:'atlas-languagechange'});};
const noHebrew=id=>!/[א-ת]/.test(get(id).innerHTML);
get('routeFrom').value='Ellinia [10002000]';get('routeTo').value='Forgotten Hollow [10006000]';get('useServices').checked=false;
run(`selectMap(10001000);submitRoute();openRouteStep(3);setCompactNavigation(true);sceneKind='all';setSceneLayer('portals',[]);detailsTab='incoming';currentRegion='maple';globalThis.languageRoute=route;globalThis.languageState=JSON.stringify({activeId,currentRegion,detailsTab,sceneId,sceneKind,selectedGate,navigationIndex,navigationFollowing,compactNavigation,routeUsesServices,world,scene});`);
get('directoryGroup').value='hollow';get('directorySearch').value='hollow';get('directory').hidden=false;
get('search').value='henesys';run('renderSearch();moveSearchSelection(1);moveSearchSelection(1);globalThis.languageSearchIndex=searchIndex;');
get('routeFrom').value='unsaved origin edit';get('useServices').checked=true;
changeLanguage('en');
check('English toggle preserves route identity and guide progress',run('route===languageRoute&&navigationRoute===route&&navigationIndex===3'));
check('English toggle preserves map selection, filters, compact preference and camera',run('languageState===JSON.stringify({activeId,currentRegion,detailsTab,sceneId,sceneKind,selectedGate,navigationIndex,navigationFollowing,compactNavigation,routeUsesServices,world,scene})'));
check('English toggle preserves unsaved route form values and planned travel policy',get('routeFrom').value==='unsaved origin edit'&&get('useServices').checked===true&&run('routeUsesServices===false'));
check('English toggle preserves directory group and query',get('directoryGroup').value==='hollow'&&get('directorySearch').value==='hollow'&&get('directoryCounter').textContent.includes('records'));
check('English toggle preserves active search option and query',get('search').value==='henesys'&&run('searchIndex===languageSearchIndex')&&get('search').getAttribute('aria-activedescendant')===`search-option-${run('searchIndex')}`);
check('English route retains exit buttons, translated conditions and saved resume step',noHebrew('routeResult')&&get('routeResult').innerHTML.includes('Show exit portal')&&get('routeResult').innerHTML.includes('Resume saved progress · Passage 4'));
check('English details, portals and source descriptions contain no untranslated Hebrew',['mapDetails','portalContent','scenePortalList','sceneSelected','coverageStats','sourcesList'].every(noHebrew));
check('English guide identifies current passage and highlighted portal',get('sceneNavStatus').textContent.startsWith('Passage 4 of ')&&get('sceneNavInstruction').textContent.startsWith('Portal '));
check('route progress styling distinguishes completed current and upcoming maps',run('routeStepState(2)==="completed"&&routeStepState(3)==="current"&&routeStepState(4)==="upcoming"')&&get('routeResult').innerHTML.includes('data-step-index="3" data-step-state="current"'));
check('directory cards provide region styling without changing map IDs',get('directoryGrid').innerHTML.includes('data-region="hollow"')&&get('directoryGrid').innerHTML.includes('data-id="10006000"'));
changeLanguage('he');
check('switching back to Hebrew preserves the same route and viewport',run('route===languageRoute&&languageState===JSON.stringify({activeId,currentRegion,detailsTab,sceneId,sceneKind,selectedGate,navigationIndex,navigationFollowing,compactNavigation,routeUsesServices,world,scene})')&&get('sceneNavStatus').textContent.startsWith('מעבר 4 מתוך '));
run(`openSpawns(10001005,[]);pickEntity(sceneEntityPoints[1].key,true);globalThis.languageEntity=selectedEntity;globalThis.entityView=JSON.stringify(scene);`);
changeLanguage('en');
check('language toggle preserves selected spawn point and zoom in a detour',run('sceneLayer==="monsters"&&selectedEntity===languageEntity&&entityView===JSON.stringify(scene)&&navigationIndex===3&&!navigationFollowing'));
check('English spawn summary and selected point render translated provenance',noHebrew('sceneEntitySummary')&&noHebrew('sceneSelected')&&get('sceneSelected').innerHTML.includes('possible spawn point'));
run('openScene(10007000);rerouteFromScene();');
changeLanguage('he');
changeLanguage('en');
check('failed reroute remains visible and translated without replacing the journey',get('sceneNavError').textContent.startsWith('No route was found')&&run('route===languageRoute&&navigationIndex===3'));
get('sceneImage').onerror();changeLanguage('he');changeLanguage('en');
check('image failure remains retryable after a language change',get('sceneImageMessage').textContent.startsWith('The map image could not load')&&!get('sceneImageRetry').hidden&&get('sceneImageStatus').dataset.state==='error');
get('routeFrom').value='unknown origin';get('routeTo').value='unknown destination';run('submitRoute()');changeLanguage('he');changeLanguage('en');
check('validation errors translate without erasing input or the existing route',get('routeFrom').value==='unknown origin'&&get('routeFromError').textContent.startsWith('Choose a map')&&get('routeToError').textContent.startsWith('Choose a map')&&run('route===languageRoute'));
fire('sceneNavReturn','click');fire('sceneNavNext','click');
check('English next-step handler still advances to the exact required portal',run('navigationIndex===4&&navigationFollowing&&selectedGate===navigationGate().key')&&get('sceneNavStatus').textContent.startsWith('Passage 5 of '));
run(`window.HuntData=undefined;window.Hunt.catalogStatus='unavailable';setSceneLayer('monsters',[]);`);
check('English unavailable spawn catalog provides a translated retry action',get('sceneEntitySummary').innerHTML.includes('Spawn point data could not load.')&&get('sceneEntitySummary').innerHTML.includes('Open catalog to retry')&&noHebrew('sceneEntitySummary'));
window.HuntData=hunt;changeLanguage('he');

document.documentElement={dataset:{motion:'off'}};
run('openRoute()');
check('disabling site motion prevents smooth route-panel scrolling',get('sidePanel').lastScrollOptions.behavior==='auto');
document.documentElement.dataset.motion='on';window.matchMedia=()=>({matches:true});
run('selectMap(10001000)');
check('system reduced-motion preference prevents smooth selected-map scrolling',get('sidePanel').lastScrollOptions.behavior==='auto');
window.matchMedia=()=>({matches:false});run('openRoute()');
check('smooth panel scrolling remains available when motion is allowed',get('sidePanel').lastScrollOptions.behavior==='smooth');

// The itinerary controller keeps planned state separate from unsubmitted edits.
run(`window.Atlas={getContext};globalThis.viewEvents=0;window.addEventListener('atlas-viewchange',()=>viewEvents++);`);
check('multi-stop recipe plans and exposes its ordered source IDs',run(`planJourney({from:10002000,to:10000000,stops:[10001000,10004000],services:false,step:0})&&JSON.stringify(getJourney().stops)==='[10001000,10004000]'&&route.waypointSteps[0]<route.waypointSteps[1]`));
check('multi-stop inputs expose map IDs and accessible remove/reorder actions',get('routeStop0').value==='Henesys [10001000]'&&get('routeStops').innerHTML.includes('data-stop-remove="0"')&&get('routeStops').innerHTML.includes('data-stop-direction="-1"'));
run('globalThis.plannedItinerary=route');
fire('routeStops','click',{target:{closest:selector=>selector==='[data-stop-move]'?{dataset:{stopMove:'1',stopDirection:'-1'}}:null}});
check('moving a stop changes the draft order without replacing active navigation',get('routeStop0').value==='Perion [10004000]'&&run('route===plannedItinerary'));
fire('routeStops','click',{target:{closest:selector=>selector==='[data-stop-remove]'?{dataset:{stopRemove:'0'}}:null}});
check('removing a stop preserves the remaining draft input',run('routeStopValues.length===1')&&get('routeStop0').value==='Henesys [10001000]');
run('addStop()');run('submitRoute()');
check('blank stop has an explicit error and cannot erase an existing route',get('routeStop1').getAttribute('aria-invalid')==='true'&&get('routeStop1Error').textContent.length>0&&run('route===plannedItinerary'));
changeLanguage('en');
check('invalid waypoint and its typed neighbors survive language switching',get('routeStop1').getAttribute('aria-invalid')==='true'&&get('routeStop1Error').textContent.startsWith('Choose a map')&&get('routeStop0').value==='Henesys [10001000]');
get('routeStop1').value='Ellinia [10002000]';run('submitRoute()');
check('corrected waypoint computes a complete ordered route',run(`JSON.stringify(route.stops)==='[10001000,10002000]'&&route.to===10000000`));
run('globalThis.beforeSwap=route;swapRouteEnds()');
check('swap reverses draft endpoints and stops without assuming a reverse route',get('routeFrom').value==='Lith Harbor [10000000]'&&get('routeTo').value==='Ellinia [10002000]'&&get('routeStop0').value==='Ellinia [10002000]'&&run('route===beforeSwap'));
run('routeStopValues=[];renderRouteStops();for(let i=0;i<8;i++)addStop(10001000)');
check('add-stop UI enforces the eight-stop bound',get('routeAddStop').disabled&&run('addStop(10001000)===false&&routeStopValues.length===8'));
check('invalid externally supplied recipe leaves active route intact',run('planJourney({from:10002000,to:10000000,stops:Array(9).fill(10001000)})===false&&route===beforeSwap'));
run(`planJourney({from:10000000,to:10000000,stops:[10007000],services:false,step:0});`);
check('unavailable ordinary itinerary still offers explicit conditional alternative',run('route===null&&routeChoices.conditional.steps.length===2')&&get('routeAlternatives').innerHTML.includes('No complete route'));
fire('routeAlternatives','click',{target:{closest:()=>({dataset:{routePolicy:'conditional'}})}});
check('choosing conditional alternative replaces the entire itinerary explicitly',run(`route.steps.length===2&&routeUsesServices&&JSON.stringify(route.stops)==='[10007000]'`));
run(`planJourney({from:10002000,to:10001005,stops:[10001000],services:false,step:0,goal:{kind:'hunt',targets:[{kind:'boss',id:700000}],monsterIds:[700000,810002]}},{show:true});`);
check('hunting journey stores only validated goal IDs alongside itinerary',run('getJourney().goal.kind==="hunt"&&getJourney().goal.monsterIds.length===2&&navigationFollowing'));
run('openRouteStep(route.waypointSteps[0]);openScene(10000000);rerouteFromScene()');
check('rerouting drops visited stops while retaining destination and hunting goal',run('route.from===10000000&&route.to===10001005&&route.stops.length===0&&route.goal.targets[0].id===700000&&navigationIndex===0'));
get('sceneNavStep').value='1';fire('sceneNavStep','change',{target:get('sceneNavStep')});
check('all-steps picker opens exact selected route position',run('navigationIndex===1&&sceneId===route.steps[1].from&&selectedGate===navigationGate().key'));
check('breadcrumb identifies current map and adjacent navigable steps',get('sceneNavBreadcrumb').innerHTML.includes('aria-current="step"')&&get('sceneNavBreadcrumb').innerHTML.includes('data-route-jump="0"')&&get('sceneNavBreadcrumb').innerHTML.includes('data-route-jump="2"'));
check('incoming portal marker is matched only through the preceding source portal',run('navigationArrival().portal&&portalPinElements.get(navigationArrival().portal.key).classList.contains("route-arrival")'));
run('openRouteStep(route.steps.length)');
check('arrival exposes recorded spawn action for a hunting goal',get('sceneNavGoal').innerHTML.includes('id="sceneNavArrival"')&&!get('sceneNavGoal').innerHTML.includes('id="sceneNavArrival" disabled'));
fire('sceneNavGoal','click',{target:{id:'sceneNavArrival'}});
check('arrival action filters to actual destination spawn IDs and keeps completed guide',run('navigationFollowing&&navigationIndex===route.steps.length&&sceneLayer==="monsters"&&JSON.stringify(sceneEntityIds)==="[700000]"&&sceneEntityPoints.every(p=>p.entityId===700000)'));
fire('routeGoal','click',{target:{id:'routeClearGoal'}});
check('removing goal preserves route and clears persisted context',run('route&&!route.goal&&!getJourney().goal&&pendingRouteGoal===null')&&get('routeGoal').hidden);
check('public view context contains bounded route summary and scene state',run('getContext().route.total===route.steps.length&&getContext().step===navigationIndex&&getContext().sceneOpen&&getContext().sceneMap.id===sceneId&&viewEvents>0'));
changeLanguage('he');
window.AtlasPersonal={getOrigin:()=>10000000,isFavorite:()=>false,visit(){},saveJourney(){},mapHash:id=>'#map='+id};get('routeFrom').value='';run('activeId=10002000;openRoute()');
check('main planner defaults to the user-selected starting map',get('routeFrom').value==='Lith Harbor [10000000]');
get('routeFrom').value='unfinished origin draft';run('openRoute()');
check('opening route planner does not overwrite an existing origin draft',get('routeFrom').value==='unfinished origin draft');
get('routeFrom').value='';detailsAction(10001000,'route-to');
check('navigate-here action also honors saved origin instead of hardcoded Henesys',get('routeFrom').value==='Lith Harbor [10000000]');
check('planTo uses saved origin only when explicit origin is absent',run('planTo(10001000)&&route.from===10000000&&planTo(10001000,10002000)&&route.from===10002000'));
run('globalThis.beforeInvalidOrigin=route');
check('invalid explicit origin never silently falls back to a different starting map',run('planTo(10001000,999999999)===false&&route===beforeInvalidOrigin'));

run(`planJourney({from:10001000,to:10004000,stops:[],services:false,step:1,avoidMaps:[10001090]});globalThis.detourBeforeInvalidForm=route;globalThis.recipeBeforeInvalidForm=JSON.stringify(getJourney());`);
get('routeFrom').value='not a valid map';run('submitRoute({preventDefault(){}})');
check('invalid submitted form preserves active route, exclusions and navigation progress',run('route===detourBeforeInvalidForm&&JSON.stringify(getJourney())===recipeBeforeInvalidForm'));

// Deferred extension scripts can subscribe before the atlas finishes loading.
// Their view decorations must survive the core renderer's later language refresh.
run('sceneId=null;renderRouteResult()');
const decorateRouteForLanguage=()=>{get('routeResult').innerHTML+='<!-- contextual route controls -->';};
windowListeners.get('atlas-languagechange').unshift(decorateRouteForLanguage);
window.addEventListener('atlas-viewchange',decorateRouteForLanguage);
changeLanguage('en');
check('language refresh exposes the final rebuilt route to contextual modules before any scene is opened',get('routeResult').innerHTML.includes('contextual route controls')&&get('routeResult').innerHTML.includes('route-summary'));

const report={checkedAt:new Date().toISOString(),method:'Node VM with lightweight DOM contract stubs; no browser, no rendering, no network checks',appSha256:crypto.createHash('sha256').update(source).digest('hex'),results,failures:results.filter(r=>!r.passed)};
process.exitCode=report.failures.length?1:0;
console.log(JSON.stringify({checks:results.length,failed:report.failures.length,failures:report.failures}));
