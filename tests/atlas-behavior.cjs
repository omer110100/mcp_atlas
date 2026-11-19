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
  scrollTo(){} focus(){document.activeElement=this;} blur(){document.activeElement=new Element('body');}
  showModal(){this.open=true;} close(){this.open=false;} insertAdjacentHTML(){} insertAdjacentElement(){}
}
const get=id=>{if(!elements.has(id))elements.set(id,new Element(id==='search'?'input':'div'));return elements.get(id);};
const document={getElementById:get,createElementNS:(ns,tag)=>new Element(tag),createElement:tag=>new Element(tag),querySelector:q=>get(q),querySelectorAll:()=>[],addEventListener(){},activeElement:new Element('body')};
const entities=[...hunt.items.map(x=>({...x,kind:'item'})),...hunt.monsters.map(x=>({...x,kind:x.isBoss?'boss':'monster'})),...hunt.npcs.map(x=>({...x,kind:'npc'}))];
const window={HuntData:hunt,Hunt:{searchAll:q=>entities.filter(x=>`${x.name} ${x.id}`.toLowerCase().includes(q)).sort((a,b)=>Number(String(b.id)===q)-Number(String(a.id)===q)),close(){},open(){}},addEventListener:(k,f)=>{(windowListeners.get(k)||windowListeners.set(k,[]).get(k)).push(f);},dispatchEvent:e=>{for(const fn of windowListeners.get(e.type)||[])fn(e);}};
const ctx=vm.createContext({console,document,window,ATLAS:atlas,HUNT:hunt,location:{hash:'',href:'https://example.test/'},history:{replaceState(){}},requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){},Event:class{constructor(type){this.type=type;}}});
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
run('openScene(10001000)');
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

const report={checkedAt:new Date().toISOString(),method:'Node VM with lightweight DOM contract stubs; no browser, no rendering, no network checks',appSha256:crypto.createHash('sha256').update(source).digest('hex'),results,failures:results.filter(r=>!r.passed)};
process.exitCode=report.failures.length?1:0;
console.log(JSON.stringify({checks:results.length,failed:report.failures.length,failures:report.failures}));
