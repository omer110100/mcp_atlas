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
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.classes=new Set(String(v).split(/\s+/));}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  scrollIntoView(){}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  querySelector(q){return this.children.find(c=>c.tagName?.toLowerCase()===q)||new Element(q.startsWith('.')?'div':q);}
  querySelectorAll(){return [];}
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
const report={checkedAt:new Date().toISOString(),method:'Node VM with lightweight DOM contract stubs; no browser, no rendering, no network checks',appSha256:crypto.createHash('sha256').update(source).digest('hex'),results,failures:results.filter(r=>!r.passed)};
process.exitCode=report.failures.length?1:0;
console.log(JSON.stringify({checks:results.length,failed:report.failures.length,results}));
