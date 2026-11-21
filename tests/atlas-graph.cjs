'use strict';
// Logic/DOM-contract audit only. This is not a browser or visual test.
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const root=require('node:path').resolve(__dirname,'..');
const atlas=JSON.parse(fs.readFileSync(root+'/dist/atlas-data.json','utf8'));
const hunt=JSON.parse(fs.readFileSync(root+'/dist/hunt-data.json','utf8'));
const source=fs.readFileSync(root+'/dist/app.js','utf8');
const elements=new Map(),windowListeners=new Map();
class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.attrs={};this.dataset={};this.children=[];this.listeners={};this.style={setProperty(key,value){this[key]=String(value);}};this.value='';this.hidden=false;this.open=false;this.innerHTML='';this.textContent='';this.classes=new Set();this.classList={add:(...s)=>s.forEach(x=>this.classes.add(x)),remove:(...s)=>s.forEach(x=>this.classes.delete(x)),contains:s=>this.classes.has(s),toggle:(s,b)=>{const yes=b??!this.classes.has(s);yes?this.classes.add(s):this.classes.delete(s);return yes;}};}
  get innerHTML(){return this._innerHTML||'';}
  set innerHTML(value){this._innerHTML=String(value);this.children=[];}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.classes=new Set(String(v).split(/\s+/));}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  scrollIntoView(){}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  append(...nodes){for(const node of nodes)node.parentElement=this;this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  querySelector(q){return this.querySelectorAll(q)[0]||new Element(q.startsWith('.')?'div':q);}
  querySelectorAll(q){const found=[],attribute=q.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);for(const child of this.children){const matches=q.startsWith('.')?child.classList.contains(q.slice(1)):attribute?child.getAttribute(attribute[1])!==null&&(attribute[2]===undefined||child.getAttribute(attribute[1])===attribute[2]):child.tagName?.toLowerCase()===q;if(matches)found.push(child);found.push(...child.querySelectorAll(q));}return found;}
  getBoundingClientRect(){return this.bounds||{width:1000,height:700,left:0,top:0,right:1000,bottom:700};}
  getBBox(){const size=Number(this.attrs['font-size'])||14,width=this.textContent.length*size*.65;return {x:-width/2,y:(Number(this.attrs.y)||0)-size*.85,width,height:size*1.15};}
  scrollTo(){} focus(){document.activeElement=this;} blur(){document.activeElement=new Element('body');}
  showModal(){this.open=true;} close(){this.open=false;} insertAdjacentHTML(){} insertAdjacentElement(){}
}
const get=id=>{if(!elements.has(id))elements.set(id,new Element(id==='search'?'input':'div'));return elements.get(id);};
const document={getElementById:get,createElementNS:(ns,tag)=>new Element(tag),createElement:tag=>new Element(tag),querySelector:q=>get(q),querySelectorAll:()=>[],addEventListener(){},activeElement:new Element('body'),body:new Element('body')};
const entities=[...hunt.items.map(x=>({...x,kind:'item'})),...hunt.monsters.map(x=>({...x,kind:x.isBoss?'boss':'monster'})),...hunt.npcs.map(x=>({...x,kind:'npc'}))];
const window={HuntData:hunt,Hunt:{searchAll:q=>entities.filter(x=>`${x.name} ${x.id}`.toLowerCase().includes(q)).sort((a,b)=>Number(String(b.id)===q)-Number(String(a.id)===q)),close(){},open(){}},addEventListener:(k,f)=>{(windowListeners.get(k)||windowListeners.set(k,[]).get(k)).push(f);},dispatchEvent:e=>{for(const fn of windowListeners.get(e.type)||[])fn(e);}};
const ctx=vm.createContext({console,document,window,ATLAS:atlas,HUNT:hunt,location:{hash:'',href:'https://example.test/'},history:{replaceState(){}},requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){},Event:class{constructor(type){this.type=type;}}});
for(const file of ['journey','world-views','world-map-art','world-art-layout','world-presentation','world-clusters'])vm.runInContext(fs.readFileSync(root+'/dist/'+file+'.js','utf8'),ctx);
vm.runInContext(source.replace(/\ninit\(\);\s*$/,'\n'),ctx);
vm.runInContext(`atlas=ATLAS;maps=atlas.maps;groups=atlas.groups;byId=new Map(maps.map(m=>[m.id,m]));incoming=new Map();adjacency=new Map();for(const m of maps){const out=[];for(const p of m.portals)if(p.kind==='cross'&&byId.has(p.to)){out.push({to:p.to,p});if(!incoming.has(p.to))incoming.set(p.to,[]);incoming.get(p.to).push({from:m,p});}adjacency.set(m.id,out);}activeId=10001000;bindEvents();`,ctx);
const run=s=>vm.runInContext(s,ctx),results=[];
const check=(name,passed,detail)=>results.push({name,passed:!!passed,...detail!==undefined?{detail}: {}});
const fire=(id,type,event={})=>{for(const fn of get(id).listeners[type]||[])fn({preventDefault(){},stopPropagation(){},...event});};


run('buildWorld()');
check('all364 world nodes built with distinct map IDs',run('nodeElements.size===maps.length&&maps.every(m=>nodeElements.get(m.id)?.getAttribute("data-map")===String(m.id))'));
const rawPairs=new Set(atlas.maps.flatMap(m=>m.portals.filter(p=>p.kind==='cross').map(p=>[m.id,p.to].sort((a,b)=>a-b).join(':'))));
check('all328 undirected raw connection pairs built',run('edgeElements.length')===rawPairs.size&&run('edgeElements.every(e=>maps.some(m=>m.id===e.a)&&maps.some(m=>m.id===e.b))'),{expected:rawPairs.size,actual:run('edgeElements.length')});
const fixedServices=atlas.services.filter(s=>s.to!=null);
check('all19 fixed supplementary connections built',run('serviceElements.length')===fixedServices.length,{expected:fixedServices.length,actual:run('serviceElements.length')});
check('dynamic service returns create no visual destination edges',run('serviceElements.every(e=>e.a!=null&&e.b!=null&&byId.has(e.a)&&byId.has(e.b))'));
check('all364 atlas map positions unique',new Set(atlas.maps.map(m=>`${m.x}:${m.y}`)).size===atlas.maps.length);
let filterFailures=[];
for(const region of ['world','victoria','maple','hollow','special','archive']){
 run(`currentRegion=${JSON.stringify(region)};updateVisibleNodes();`);
 const ok=run('maps.every(m=>nodeElements.get(m.id).classList.contains("dimmed")===!visibleMap(m))&&[...edgeElements,...serviceElements].every(e=>e.element.classList.contains("dimmed")===!(visibleMap(byId.get(e.a))&&visibleMap(byId.get(e.b))))');
 if(!ok)filterFailures.push(region);
}
check('all6 region filters dim exact expected nodes and edges',filterFailures.length===0,filterFailures);
let selectionFails=[];
for(const m of atlas.maps){
 const handlers=run(`nodeElements.get(${m.id}).listeners.keydown`);
 for(const fn of handlers||[])fn({key:'Enter',preventDefault(){}});
 if(run('activeId')!==m.id||!run(`nodeElements.get(${m.id}).classList.contains('selected')`))selectionFails.push(m.id);
}
check('all364 graph node keyboard activations select exact map',selectionFails.length===0,selectionFails);
let revealFailures=[];
for(const [region,id]of [['maple',10001000],['world',80003100],['archive',10002000],['hollow',80002000]]){
 run(`currentRegion=${JSON.stringify(region)};selectMap(${id},{focus:true});`);
 if(!run('visibleMap(byId.get(activeId))')||run(`nodeElements.get(${id}).classList.contains('dimmed')`))revealFailures.push({region,id,currentRegion:run('currentRegion')});
}
check('cross-region selection reveals ordinary and archive maps',revealFailures.length===0,revealFailures);
run("currentRegion='world';updateVisibleNodes();selectMap(10004000)");
check('selected node highlights adjacent supplementary service line',run('serviceElements.filter(e=>e.a===activeId||e.b===activeId).every(e=>e.element.classList.contains("highlighted"))'),{adjacent:run('serviceElements.filter(e=>e.a===activeId||e.b===activeId).length')});
const links=[];
for(const s of atlas.sources||[])if(s.url)links.push(s.url);
for(const s of atlas.services||[])links.push(...s.sourceUrls||s.source_urls||[]);
let linkInvalid=[];for(const u of links){try{const p=new URL(u);if(p.protocol!=='https:')linkInvalid.push(u);}catch{linkInvalid.push(u);}}
check('all source links use valid HTTPS URLs',linkInvalid.length===0,{checked:links.length,invalid:linkInvalid});
const pointIssues=[];
for(const m of atlas.maps){for(const p of [...m.portals,...m.npcs,...hunt.mapSpawns[m.id]?.points||[]])if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>m.width||p.y>m.height)pointIssues.push({id:m.id,x:p.x,y:p.y,width:m.width,height:m.height});}
check('all entity coordinates fit source image; one known raw event anchor remains exact',pointIssues.length===1&&pointIssues[0].id===90040003&&pointIssues[0].x===2370&&pointIssues[0].y===-63,{outOfBounds:pointIssues.length,examples:pointIssues.slice(0,10),classification:'Preserved source coordinate, not corrected or invented'});
run('route=findRoute(10002000,10006000,false);globalThis.zoomPositions=JSON.stringify([...nodeElements].map(([id,node])=>[id,node.attrs.transform]));world.k=.15;showAllLabels=false;applyWorld()');
check('overview zoom hides minor visual targets while retaining major maps',run('maps.filter(m=>m.major).every(m=>nodeElements.get(m.id).style.display!=="none")&&maps.some(m=>nodeElements.get(m.id).style.display==="none")'));
check('every route map remains visible at overview zoom',run('[route.from,...route.steps.map(s=>s.to)].every(id=>nodeElements.get(id).style.display!=="none")'));
run('globalThis.minor=maps.find(m=>!m.major&&nodeElements.get(m.id).style.display==="none");selectMap(minor.id,{focus:false});');
check('selecting a hidden minor map immediately reveals its target',run('nodeElements.get(activeId).style.display!=="none"'));
run('showAllLabels=true;applyWorld()');
check('show all labels also restores all minor map hit targets',run('[...nodeElements.values()].every(node=>node.style.display!=="none")'));
run('showAllLabels=false;world.k=1;applyWorld()');
check('detail zoom restores every node without modifying any map geometry',run('[...nodeElements.values()].every(node=>node.style.display!=="none")&&zoomPositions===JSON.stringify([...nodeElements].map(([id,node])=>[id,node.attrs.transform]))'));
run('world.k=.15;currentRegion="archive";applyWorld()');
check('regional views retain their maps even when no major town represents the region',run('maps.filter(visibleMap).every(map=>nodeElements.get(map.id).style.display!=="none")'));
get('mapCanvas').bounds={width:320,height:700,left:0,top:0,right:320,bottom:700};
run('currentRegion="world";world.k=.1;world.x=0;world.y=0;activeId=10001000;showAllLabels=false;applyWorld();globalThis.narrowGeometry=JSON.stringify([...nodeElements].map(([id,node])=>[id,node.attrs.transform]));globalThis.visibleLabelIds=[...nodeElements].filter(([id,node])=>(byId.get(id).major||id===activeId)&&node.querySelector("text").style.visibility!=="hidden").map(([id])=>id)');
check('narrow overview reduces town-label collisions while retaining multiple places',run('visibleLabelIds.includes(activeId)&&visibleLabelIds.length>=3&&visibleLabelIds.length<maps.filter(map=>map.major).length'));
check('every visible overview label has a non-overlapping measured screen box',run('(()=>{const boxes=visibleLabelIds.map(id=>worldLabelBox(byId.get(id),nodeElements.get(id).querySelector("text")));return boxes.every((box,index)=>boxes.slice(index+1).every(other=>!(box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top)));})()'));
check('label density never removes major click targets, route nodes, or map geometry',run('maps.filter(map=>map.major).every(map=>nodeElements.get(map.id).style.display!=="none")&&[route.from,...route.steps.map(step=>step.to)].every(id=>nodeElements.get(id).style.display!=="none")&&narrowGeometry===JSON.stringify([...nodeElements].map(([id,node])=>[id,node.attrs.transform]))'));
run('applyWorld();globalThis.again=[...nodeElements].filter(([id,node])=>(byId.get(id).major||id===activeId)&&node.querySelector("text").style.visibility!=="hidden").map(([id])=>id)');
check('label choices are deterministic for unchanged view and selection',run('JSON.stringify(again)===JSON.stringify(visibleLabelIds)'));
run('activeId=10006000;highlightGraph();');
check('selected town takes priority over an overlapping major label',run('nodeElements.get(10006000).querySelector("text").style.visibility!=="hidden"&&nodeElements.get(10001000).querySelector("text").style.visibility==="hidden"'));
run('globalThis.nearbyMinor=maps.find(map=>!map.major&&map.region==="Victoria Island");activeId=nearbyMinor.id;highlightGraph();');
check('selected minor map retains its label and hit target at overview scale',run('nodeElements.get(activeId).querySelector("text").style.visibility!=="hidden"&&nodeElements.get(activeId).style.display!=="none"'));
run('showAllLabels=true;applyWorld();');
check('explicit all-labels mode restores every suppressed town label',run('[...nodeElements.values()].every(node=>node.querySelector("text").style.visibility!=="hidden")'));
run('showAllLabels=false;world.k=.31;applyWorld();');
check('closer zoom restores every label suppressed for overview density',run('[...nodeElements.values()].every(node=>node.querySelector("text").style.visibility!=="hidden")'));
run('world.k=.1;currentRegion="maple";applyWorld();');
check('explicit region view is not subjected to world overview label suppression',run('[...nodeElements.values()].every(node=>node.querySelector("text").style.visibility!=="hidden")'));
get('mapCanvas').bounds={width:1000,height:700,left:0,top:0,right:1000,bottom:700};
run('currentRegion="world";applyWorld();');
check('wide distant overviews also suppress collisions while retaining selected map and hit targets',run('nodeElements.get(activeId).querySelector("text").style.visibility!=="hidden"&&maps.filter(map=>map.major).every(map=>nodeElements.get(map.id).style.display!=="none")&&[...nodeElements.values()].some(node=>node.querySelector("text").style.visibility==="hidden")'));
check('unavailable SVG metrics fall back to finite conservative label bounds',run('(()=>{const map=byId.get(activeId),box=worldLabelBox(map,{textContent:map.name,getBBox(){throw new Error("metrics unavailable")}});return Object.values(box).every(Number.isFinite)&&box.right>box.left&&box.bottom>box.top;})()'));
check('map type summaries distinguish source-backed town hunting and archive records',run('describeMap(10001000).category==="town"&&describeMap(10001005).category==="hunting"&&describeMap(90040003).category==="archive"&&describeMap(-1)===null'));

// Exercise the real presentation engines while a real multistop journey is active.
// These contracts deliberately inspect data/DOM geometry, not perceived visual quality.
const originalData=JSON.stringify(atlas),originalHuntData=JSON.stringify(hunt);
run(`globalThis.captureScene=()=>JSON.stringify({sceneId,sceneKind,sceneLayer,selectedGate,selectedEntity,sceneEntityIds,sceneEntityPoints,scene,open:$('sceneDialog').open,image:$('sceneImage').attrs,portals:[...portalPinElements].map(([key,node])=>[key,node.attrs.transform]),entities:[...entityPinElements].map(([key,node])=>[key,node.attrs.transform])});
globalThis.captureJourney=()=>JSON.stringify({recipe:getJourney(),route,navigationIndex,navigationFollowing,compactNavigation,active:navigationActive()});
currentRegion='world';activeId=10001000;showAllLabels=false;
globalThis.planned=planJourney({from:10002000,to:10006000,stops:[10001000],services:true,step:2,avoidMaps:[90040003]},{persist:false});`);
check('view fixture uses a real multistop route with saved progress and exclusions',run('planned&&route.steps.length>2&&getJourney().step===2&&getJourney().stops[0]===10001000&&getJourney().avoidMaps[0]===90040003'));
function endpoints(d){
  const commands=[...String(d).matchAll(/([MLQHV])([^MLQHV]*)/g)];let start=null,point={x:NaN,y:NaN};
  for(const [,command,raw]of commands){const values=raw.trim().split(/[ ,]+/).map(Number);if(command==='M'||command==='L')point={x:values[0],y:values[1]};else if(command==='Q')point={x:values[2],y:values[3]};else if(command==='H')point={...point,x:values[0]};else if(command==='V')point={...point,y:values[0]};if(command==='M'&&!start)start={...point};}
  return {start,end:point};
}
const matchingEnds=edge=>{const actual=endpoints(edge.d);return actual.start?.x===edge.from.x&&actual.start?.y===edge.from.y&&actual.end.x===edge.to.x&&actual.end.y===edge.to.y;};
const modes=['atlas','metro','celestial','board','classic'];
for(const mode of modes){
  run(`currentRegion='world';openRouteStep(2);compactNavigation=true;renderSceneNavigation();globalThis.routeReference=route;globalThis.beforeJourney=captureJourney();globalThis.beforeScene=captureScene();globalThis.beforeSelection=activeId;`);
  check(`${mode}: view activates without changing the route recipe or navigation progress`,run(`setWorldView(${JSON.stringify(mode)})&&worldView===${JSON.stringify(mode)}&&route===routeReference&&captureJourney()===beforeJourney`));
  check(`${mode}: the open scene and every source portal coordinate remain unchanged`,run('captureScene()===beforeScene&&portalPinElements.size>0&&[...portalPinElements].every(([key,node])=>{const portal=byId.get(sceneId).portals.find(p=>p.key===key);return node.attrs.transform===`translate(${portal.x},${portal.y})`;})'));
  check(`${mode}: selection and all364 node identities survive the switch`,run('activeId===beforeSelection&&nodeElements.get(activeId).classList.contains("selected")&&nodeElements.size===maps.length&&maps.every(map=>nodeElements.get(map.id).getAttribute("data-map")===String(map.id))'));
  check(`${mode}: node transforms use the active presentation coordinates`,run('maps.every(map=>{const point=worldPoint(map);return nodeElements.get(map.id).attrs.transform===`translate(${point.x},${point.y})`;})'));
  const edges=run('[...edgeElements,...serviceElements].map(edge=>({d:edge.element.getAttribute("d"),from:worldPoint(byId.get(edge.a)),to:worldPoint(byId.get(edge.b))}))');
  check(`${mode}: every raw and service connection reaches its displayed endpoints`,edges.length===rawPairs.size+fixedServices.length&&edges.every(matchingEnds));
  const routeEdges=run('$("routeLayer").children.filter(node=>node.tagName==="PATH").map((node,index)=>({d:node.getAttribute("d"),from:worldPoint(byId.get(route.steps[index].from)),to:worldPoint(byId.get(route.steps[index].to))}))');
  check(`${mode}: every route line and step number follows the displayed route`,routeEdges.length===run('route.steps.length')&&routeEdges.every(matchingEnds)&&run('(()=>{const ids=[route.from,...route.steps.map(step=>step.to)],dots=$("routeLayer").children.filter(node=>node.tagName==="G");return dots.length===ids.length&&dots.every((node,index)=>{const point=worldPoint(byId.get(ids[index]));return node.attrs.transform===`translate(${point.x+19},${point.y-20})`;});})()'));
  run('world.x=37;world.y=91;world.k=.8;applyWorld()');
  check(`${mode}: measured label bounds agree with actual node translations`,run('maps.every(map=>{const node=nodeElements.get(map.id),label=node.querySelector("text"),translation=node.attrs.transform.match(/-?\\d+(?:\\.\\d+)?/g).map(Number),bounds=label.getBBox(),box=worldLabelBox(map,label);return Math.abs(box.left-(world.x+(translation[0]+bounds.x)*world.k-5))<.001&&Math.abs(box.top-(world.y+(translation[1]+bounds.y)*world.k-5))<.001;})'));
  run('centerOnMap(byId.get(activeId))');
  check(`${mode}: focusing a map centers its displayed location`,run('(()=>{const point=worldPoint(byId.get(activeId)),rect=canvasView("mapCanvas");return Math.abs(world.x+point.x*world.k-(rect.left+rect.width/2))<.001&&Math.abs(world.y+point.y*world.k-(rect.top+rect.height/2))<.001;})()'));
  run('fitRoute([route.from,...route.steps.map(step=>step.to)])');
  check(`${mode}: route fitting includes every displayed route point`,run('(()=>{const rect=canvasView("mapCanvas");return [route.from,...route.steps.map(step=>step.to)].every(id=>{const point=worldPoint(byId.get(id)),x=world.x+point.x*world.k,y=world.y+point.y*world.k;return x>=rect.left&&x<=rect.left+rect.width&&y>=rect.top&&y<=rect.top+rect.height;});})()'));
  const failedFilters=[];
  for(const region of ['world','victoria','maple','hollow','special','archive']){
    const kept=run(`currentRegion=${JSON.stringify(region)};setWorldView(${JSON.stringify(mode)});currentRegion===${JSON.stringify(region)}&&maps.every(map=>nodeElements.get(map.id).classList.contains('dimmed')===!visibleMap(map))&&[...edgeElements,...serviceElements].every(edge=>edge.element.classList.contains('dimmed')===!(visibleMap(byId.get(edge.a))&&visibleMap(byId.get(edge.b))))`);
    if(!kept)failedFilters.push(region);
  }
  check(`${mode}: changing presentation preserves all6 exact region filters`,failedFilters.length===0,failedFilters);
  run('currentRegion="world";updateVisibleNodes();fitWorld();openNpcs(10001000,[byId.get(10001000).npcs[0].id]);pickEntity(sceneEntityPoints[0].key,true);globalThis.npcScene=captureScene();globalThis.npcJourney=captureJourney()');
  run(`setWorldView(${JSON.stringify(mode)})`);
  check(`${mode}: NPC focus and exact source markers survive a layout change`,run('sceneLayer==="npcs"&&entityPinElements.size>0&&captureScene()===npcScene&&captureJourney()===npcJourney&&sceneEntityPoints.every(point=>entityPinElements.get(point.key).attrs.transform===`translate(${point.x},${point.y})`)'));
  run('openSpawns(10001005);pickEntity(sceneEntityPoints[0].key,true);globalThis.monsterScene=captureScene();globalThis.monsterJourney=captureJourney()');
  run(`setWorldView(${JSON.stringify(mode)})`);
  check(`${mode}: monster focus and exact spawn markers survive a layout change`,run('sceneLayer==="monsters"&&entityPinElements.size>0&&captureScene()===monsterScene&&captureJourney()===monsterJourney&&sceneEntityPoints.every(point=>entityPinElements.get(point.key).attrs.transform===`translate(${point.x},${point.y})`)'));
  run('globalThis.weightedAfterView=findRoute(route.from,route.to,routeUsesServices,route.stops,routeExclusions)');
  check(`${mode}: derived geography never changes weighted route decisions`,run('AtlasJourney.pathSignature(weightedAfterView)===AtlasJourney.pathSignature(route)&&weightedAfterView.cost===route.cost'));
  check(`${mode}: original world, portal, NPC and spawn data stay untouched`,JSON.stringify(atlas)===originalData&&JSON.stringify(hunt)===originalHuntData);
}
run('globalThis.beforeInvalid={view:worldView,layout:worldLayout,journey:captureJourney(),scene:captureScene(),geometry:JSON.stringify([...nodeElements].map(([id,node])=>[id,node.attrs.transform])),world:JSON.stringify(world)}');
check('invalid layout choices are rejected without any state or geometry mutation',run('[null,undefined,"","invalid","__proto__",{},9].every(mode=>setWorldView(mode)===false)&&worldView===beforeInvalid.view&&worldLayout===beforeInvalid.layout&&captureJourney()===beforeInvalid.journey&&captureScene()===beforeInvalid.scene&&JSON.stringify([...nodeElements].map(([id,node])=>[id,node.attrs.transform]))===beforeInvalid.geometry&&JSON.stringify(world)===beforeInvalid.world'));
run('globalThis.savedArt=window.AtlasWorldMapArt;window.AtlasWorldMapArt=null');
check('unavailable game artwork leaves the current view and journey intact',run('setWorldView("classic")===false&&worldView===beforeInvalid.view&&worldLayout===beforeInvalid.layout&&captureJourney()===beforeInvalid.journey&&captureScene()===beforeInvalid.scene'));
run('window.AtlasWorldMapArt=savedArt;setWorldView("classic")');
check('original artwork uses both bundled source images with loading/error handlers',run('(()=>{const pictures=$("landLayer").children.flatMap(node=>node.children||[]).filter(node=>node.classList.contains("world-game-image"));return pictures.length===2&&pictures.every(picture=>savedArt.maps.some(sheet=>sheet.image===picture.getAttribute("href"))&&picture.listeners.load?.length&&picture.listeners.error?.length);})()'));
run('window.Atlas={data:atlas,selectMap,get activeMap(){return activeId}};currentRegion="world";openRouteStep(2);globalThis.clusterJourney=captureJourney();globalThis.clusterScene=captureScene();globalThis.clusterNodes=$("decorationLayer").querySelectorAll("[data-anchor]");');
check('classic: all76 source anchors expose their exact281 known map memberships',run('clusterNodes.length===76&&new Set(clusterNodes.flatMap(node=>node.getAttribute("data-map-ids").split(",").map(Number))).size===281&&clusterNodes.every(node=>{const anchor=worldLayout.anchors.find(entry=>entry.id===node.getAttribute("data-anchor")),ids=node.getAttribute("data-map-ids").split(",").map(Number);return anchor&&node.getAttribute("transform")===`translate(${anchor.x},${anchor.y})`&&ids.length===anchor.mapIds.length&&ids.every(id=>byId.has(id)&&anchor.mapIds.includes(id))&&node.getAttribute("role")==="button";})'));
check('classic: overlapping source maps use clusters while83 extension maps keep their own targets',run('maps.filter(map=>worldPoint(map).source==="game").every(map=>nodeElements.get(map.id).style.display==="none")&&maps.filter(map=>worldPoint(map).source==="extension").length===83&&maps.filter(map=>worldPoint(map).source==="extension").every(map=>nodeElements.get(map.id).style.display!=="none")'));
const clusterFilterFailures=[];
for(const region of ['world','victoria','maple','hollow','special','archive']){
  run(`currentRegion=${JSON.stringify(region)};updateVisibleNodes();applyWorld()`);
  if(!run('clusterNodes.every(node=>{const ids=node.getAttribute("data-map-ids").split(",").map(Number),visible=ids.some(id=>visibleMap(byId.get(id)));return (node.style.display!=="none")===visible&&node.getAttribute("tabindex")===(visible?"0":"-1");})'))clusterFilterFailures.push(region);
}
check('classic: cluster keyboard targets obey all6 region filters',clusterFilterFailures.length===0,clusterFilterFailures);
run('currentRegion="world";updateVisibleNodes();applyWorld()');
check('classic: source clusters identify selected and route maps',run('clusterNodes.every(node=>{const ids=node.getAttribute("data-map-ids").split(",").map(Number),routeIds=[route.from,...route.steps.map(step=>step.to)];return node.classList.contains("selected")===ids.includes(activeId)&&node.classList.contains("on-route")===ids.some(id=>routeIds.includes(id));})'));
run('for(const handler of clusterNodes[0].listeners.keydown||[])handler({key:"Enter",preventDefault(){}});globalThis.clusterDialog=document.body.children.find(node=>node.id==="worldClusterDialog");');
check('classic: Enter opens the map chooser without disturbing scene or journey',run('clusterDialog?.open&&captureJourney()===clusterJourney&&captureScene()===clusterScene'));
run('clusterDialog.close();for(const handler of clusterNodes[1].listeners.keydown||[])handler({key:" ",preventDefault(){}});');
check('classic: Space also opens a source cluster with only its actual map choices',run('clusterDialog.open&&(()=>{const expected=clusterNodes[1].getAttribute("data-map-ids").split(","),buttons=clusterDialog.querySelectorAll("button").filter(node=>node.dataset.clusterMap);return buttons.length===expected.length&&buttons.every(button=>expected.includes(button.dataset.clusterMap));})()'));
run(`globalThis.clusterChoiceFailures=[];globalThis.chosenClusterIds=new Set();
for(const node of clusterNodes){
  for(const handler of node.listeners.click||[])handler({stopPropagation(){}});
  const expected=node.getAttribute('data-map-ids').split(',').map(Number),buttons=clusterDialog.querySelectorAll('button').filter(button=>button.dataset.clusterMap);
  if(buttons.length!==expected.length||buttons.some(button=>!expected.includes(Number(button.dataset.clusterMap))))clusterChoiceFailures.push(node.getAttribute('data-anchor'));
  for(const button of buttons){const id=Number(button.dataset.clusterMap);for(const handler of button.listeners.click||[])handler({});chosenClusterIds.add(id);if(activeId!==id||!nodeElements.get(id).classList.contains('selected')||captureJourney()!==clusterJourney)clusterChoiceFailures.push(id);}
}`);
check('classic: all281 clustered map choices select their exact map and retain the journey',run('chosenClusterIds.size===281&&clusterChoiceFailures.length===0'),run('clusterChoiceFailures'));
run('for(const handler of clusterNodes[0].listeners.click||[])handler({stopPropagation(){}});globalThis.fixedChoice=clusterDialog.querySelectorAll("button").find(button=>button.dataset.clusterMap);globalThis.fixedChoiceId=Number(fixedChoice.dataset.clusterMap);fixedChoice.dataset.clusterMap="90040003";for(const handler of fixedChoice.listeners.click||[])handler({});');
check('classic: altered button data cannot select an unrelated arbitrary map',run('activeId===fixedChoiceId&&activeId!==90040003&&captureJourney()===clusterJourney'));
const report={checkedAt:new Date().toISOString(),method:'Node VM with lightweight DOM contract stubs; no browser, no rendering, no network checks',appSha256:crypto.createHash('sha256').update(source).digest('hex'),results,failures:results.filter(r=>!r.passed)};
process.exitCode=report.failures.length?1:0;
console.log(JSON.stringify({checks:results.length,failed:report.failures.length,results}));
