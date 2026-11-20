'use strict';
// Actual map-info module with a small DOM harness; verifies data/actions, not layout.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'../dist'),source=fs.readFileSync(path.join(base,'map-info.js'),'utf8');
const rawAtlas=JSON.parse(fs.readFileSync(path.join(base,'atlas-data.json'),'utf8')),rawHunt=JSON.parse(fs.readFileSync(path.join(base,'hunt-data.json'),'utf8'));
const results=[],plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const decode=value=>String(value).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
class TextNode{constructor(text){this.nodeType=3;this.textContent=text;this.parentElement=null;}get outerHTML(){return esc(this.textContent);}}
class Element{
  constructor(tag='div'){this.nodeType=1;this.tagName=tag.toLowerCase();this.children=[];this.attrs={};this.dataset={};this.className='';this.id='';this.open=false;this.parentElement=null;this.listeners={};this.classList={contains:name=>this.className.split(/\s+/).includes(name)};}
  setAttribute(key,value){this.attrs[key]=String(value);if(key==='class')this.className=String(value);if(key==='id')this.id=String(value);if(key==='open')this.open=true;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);}
  getAttribute(key){return key==='class'?this.className:key==='id'?this.id:this.attrs[key]??null;}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.children.splice(node.parentElement.children.indexOf(node),1);node.parentElement=this;this.children.push(node);}}
  before(node){this.insertSibling(node,0);}
  after(node){this.insertSibling(node,1);}
  insertSibling(node,offset){const parent=this.parentElement,index=parent.children.indexOf(this);node.parentElement=parent;parent.children.splice(index+offset,0,node);}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  matchesSimple(selector){const tag=selector.match(/^[\w-]+/);if(tag&&this.tagName!==tag[0])return false;for(const cls of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(cls[1]))return false;for(const attr of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)){const value=this.getAttribute(attr[1]);if(value===null||attr[2]!==undefined&&value!==attr[2])return false;}return true;}
  matches(selector){return selector.split(',').some(part=>{const pieces=part.trim().split(/\s+/);if(!this.matchesSimple(pieces.pop()))return false;let parent=this.parentElement;while(pieces.length){const child=pieces.at(-1)==='>';if(child)pieces.pop();const required=pieces.pop();if(!child)while(parent&&!parent.matchesSimple(required))parent=parent.parentElement;if(!parent||!parent.matchesSimple(required))return false;parent=parent.parentElement;}return true;});}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  querySelectorAll(selector){return this.children.filter(node=>node.nodeType===1).flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  get textContent(){return this.children.map(node=>node.textContent).join('');}
  set textContent(value){this.children=[];this.append(new TextNode(String(value)));}
  get innerHTML(){return this.children.map(node=>node.outerHTML).join('');}
  set innerHTML(value){this.children=[];this.append(...parseHTML(value));}
  insertAdjacentHTML(where,value){assert.equal(where,'beforeend');this.append(...parseHTML(value));}
  get outerHTML(){const attrs={...this.attrs,...(this.className?{class:this.className}:{}),...(this.id?{id:this.id}:{})};for(const [name,value]of Object.entries(this.dataset))attrs['data-'+name.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())]=value;return `<${this.tagName}${Object.entries(attrs).map(([name,value])=>` ${name}="${esc(value)}"`).join('')}>${this.innerHTML}</${this.tagName}>`;}
  set outerHTML(value){const parent=this.parentElement,index=parent.children.indexOf(this),replacement=parseHTML(value);for(const node of replacement)node.parentElement=parent;parent.children.splice(index,1,...replacement);this.parentElement=null;}
}
function parseHTML(value){
  const root=new Element(),stack=[root];
  for(const token of String(value).match(/<[^>]*>|[^<]+/g)||[]){
    if(token.startsWith('</')){stack.pop();continue;}
    if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const node=new Element(tag);for(const attribute of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))node.setAttribute(attribute[1],decode(attribute[2]??''));stack.at(-1).append(node);if(!['img','br','input','hr','meta','link'].includes(tag))stack.push(node);}
    else stack.at(-1).append(new TextNode(decode(token)));
  }
  const nodes=[...root.children];for(const node of nodes)node.parentElement=null;return nodes;
}
function setup({status='ready',language='he',activeMap,noAtlas=false}={}){
  const atlas=structuredClone(rawAtlas),hunt=structuredClone(rawHunt),events=new Map(),calls=[],observed=[];
  const document=new Element('document'),body=new Element('body');document.append(body);document.body=body;document.createElement=tag=>new Element(tag);document.getElementById=id=>document.querySelector(`[id="${id}"]`);
  const node=(id,cls,tag='div',parent=body)=>{const result=new Element(tag);result.id=id||'';result.className=cls||'';parent.append(result);return result;};
  const details=node('mapDetails'),actions=node('', 'detail-actions','div',details),technical=node('', 'map-id','div',details);technical.textContent='Source map records';
  const directory=node('directoryGrid'),search=node('searchResults'),world=node('worldViewport');
  const categoryFacts=new Map(),i18n={get language(){return language;},text:(he,en)=>language==='en'?en:he};
  const api={data:atlas,activeMap:activeMap??atlas.maps.find(map=>(hunt.mapSpawns[map.id]?.points.length||0)>0&&(map.npcs||[]).length)?.id,describeMap(id){return categoryFacts.get(id)||{category:'field',label:language==='en'?'Field':'שדה',exits:atlas.maps.find(map=>map.id===id)?.portals.filter(portal=>portal.kind==='cross').length||0};},openSpawns:(...args)=>calls.push(['monster',...args]),openNpcs:(...args)=>calls.push(['npc',...args])};
  const window={Atlas:noAtlas?undefined:api,AtlasI18n:i18n,Hunt:{data:status==='ready'?hunt:null,catalogStatus:status,open:(...args)=>calls.push(['catalogue',...args])},addEventListener(name,fn){const list=events.get(name)||[];list.push(fn);events.set(name,list);}};
  const fire=name=>{for(const listener of events.get(name)||[])listener();};
  const ctx=vm.createContext({window,document,MutationObserver:class{constructor(fn){this.callback=fn;observed.push(this);}observe(target,options){(this.targets??=[]).push({target,options});}}});vm.runInContext(source,ctx,{filename:'map-info.js'});
  const click=target=>{for(const listener of document.listeners.click||[])listener({target});};
  const setMap=id=>{api.activeMap=id;fire('atlas-viewchange');};
  const setLanguage=next=>{language=next;fire('atlas-languagechange');};
  return {atlas,hunt,window,api,details,actions,technical,directory,search,world,events,calls,categoryFacts,observed,document,node,fire,click,setMap,setLanguage,population:()=>details.querySelector('.map-population')};
}
const h=setup(),occupants=()=>h.population().querySelectorAll('[data-map-occupant]');
check('per-map summaries count distinct monsters and NPCs across every real map',()=>{
  for(const map of h.atlas.maps){h.setMap(map.id);const groups=h.population().querySelectorAll('.map-occupants'),mobIds=new Set((h.hunt.mapSpawns[map.id]?.points||[]).map(point=>point.mobId)),npcIds=new Set((map.npcs||[]).map(point=>point.id));assert.equal(Number(groups[0].querySelector('summary small').textContent),mobIds.size,`monster count ${map.id}`);assert.equal(Number(groups[1].querySelector('summary small').textContent),npcIds.size,`NPC count ${map.id}`);assert.equal(occupants().length,mobIds.size+npcIds.size);}
});
check('individual monster cards show exact recorded point counts and source levels',()=>{
  const map=h.atlas.maps.find(map=>(h.hunt.mapSpawns[map.id]?.points.length||0)>5);h.setMap(map.id);
  for(const button of occupants().filter(node=>node.dataset.mapOccupant==='monster')){const id=Number(button.dataset.entity),entry=h.hunt.monsters.find(monster=>monster.id===id),count=h.hunt.mapSpawns[map.id].points.filter(point=>point.mobId===id).length;assert.equal(button.querySelector('bdi').textContent,entry.name);assert(button.textContent.includes(`${count} נקודות`));assert(button.textContent.includes(`רמה ${entry.level}`));}
});
check('NPC locations aggregate by exact ID without conflating same-name variants',()=>{
  const map=h.atlas.maps.find(map=>(map.npcs||[]).length>2);h.setMap(map.id);
  for(const button of occupants().filter(node=>node.dataset.mapOccupant==='npc')){const id=Number(button.dataset.entity),count=map.npcs.filter(point=>point.id===id).length;assert(button.textContent.includes(`${count} מיקומים`));assert.equal(Number(button.dataset.map),map.id);}
});
check('nested monster and NPC clicks send exact map and entity IDs',()=>{
  for(const type of ['monster','npc']){const map=h.atlas.maps.find(map=>type==='npc'?(map.npcs||[]).length:(h.hunt.mapSpawns[map.id]?.points.length||0)>0);h.setMap(map.id);const button=occupants().find(node=>node.dataset.mapOccupant===type);h.click(button.querySelector('bdi'));assert.deepEqual(plain(h.calls.at(-1)),[type,map.id,[Number(button.dataset.entity)]]);}
});
check('unrecorded catalogue entries never create map occupants or coordinates',()=>{
  const map=h.atlas.maps.find(map=>!(h.hunt.mapSpawns[map.id]?.points.length||0)&&!(map.npcs||[]).length);h.hunt.monsters.push({id:987654321,name:'No position'});h.hunt.npcs.push({id:987654322,name:'No position'});h.setMap(map.id);h.fire('hunt-ready');assert.equal(occupants().length,0);assert(!h.population().textContent.includes('No position'));
});
check('ready empty maps distinguish documented absence from loading or failure',()=>{
  const map=h.atlas.maps.find(map=>!(h.hunt.mapSpawns[map.id]?.points.length||0)&&!(map.npcs||[]).length);h.setMap(map.id);h.setLanguage('en');assert(h.population().textContent.includes('No monster spawn points are documented'));assert(h.population().textContent.includes('No NPC locations are documented'));assert(!h.population().querySelector('[data-open-catalogue]'));
});
check('loading catalogue shows unknown monster count while atlas NPC locations remain usable',()=>{
  const loading=setup({status:'loading',language:'en',activeMap:10002000}),groups=loading.population().querySelectorAll('.map-occupants');assert.equal(groups[0].querySelector('summary small').textContent,'…');assert(groups[0].textContent.includes('Loading monster catalogue'));assert(groups[1].querySelectorAll('[data-map-occupant="npc"]').length>0);assert(!groups[0].textContent.includes('No monster spawn points'));
});
check('catalogue failure is explicit, retry opens monsters and never claims an empty map',()=>{
  const failed=setup({status:'unavailable',language:'en',activeMap:10002000}),group=failed.population().querySelectorAll('.map-occupants')[0];assert.equal(group.querySelector('summary small').textContent,'…');assert(group.textContent.includes('could not load'));assert(!group.textContent.includes('No monster spawn points'));const retry=group.querySelector('[data-open-catalogue]');assert(retry);failed.click(retry);assert.deepEqual(plain(failed.calls.at(-1)),['catalogue','monster']);
});
check('late catalogue recovery replaces failure with real records and translated names',()=>{
  const map=rawAtlas.maps.find(map=>(rawHunt.mapSpawns[map.id]?.points.length||0)>0),recovered=setup({status:'unavailable',language:'en',activeMap:map.id});recovered.window.Hunt.data=recovered.hunt;recovered.window.Hunt.catalogStatus='ready';recovered.fire('hunt-ready');assert(recovered.population().querySelectorAll('[data-map-occupant="monster"]').length>0);assert(!recovered.population().textContent.includes('could not load'));assert(!recovered.population().textContent.includes('Loading monster'));
});
check('expanded occupant sections and technical details survive language updates',()=>{
  const local=setup(),groups=local.population().querySelectorAll('.map-occupants'),technical=local.details.querySelector('.map-technical');groups[0].open=false;groups[1].open=true;technical.open=true;local.setLanguage('en');const next=local.population().querySelectorAll('.map-occupants');assert.equal(next[0].open,false);assert.equal(next[1].open,true);assert.equal(technical.open,true);assert.equal(technical.querySelector('summary').textContent,'IDs & source records');assert(next[0].querySelector('summary').textContent.includes('Monsters here'));assert(next[1].querySelector('summary').textContent.includes('NPCs here'));assert(!/[\u0590-\u05ff]/.test(local.population().textContent));
});
check('source names and accessibility labels are escaped rather than interpreted as HTML',()=>{
  const local=setup({language:'en'}),map=local.atlas.maps.find(map=>(local.hunt.mapSpawns[map.id]?.points.length||0)>0),id=local.hunt.mapSpawns[map.id].points[0].mobId,name='<img src=x onerror="alert(1)">';local.hunt.monsters.find(monster=>monster.id===id).name=name;local.api.activeMap=map.id;local.fire('hunt-ready');const button=local.population().querySelector(`[data-entity="${id}"]`);assert.equal(button.querySelector('bdi').textContent,name);assert.equal(button.getAttribute('aria-label'),`Highlight ${name} on the map`);assert.equal(local.population().querySelectorAll('[onerror]').length,0);
});
check('missing catalogue metadata uses only IDs or names from actual map records',()=>{
  const local=setup({language:'en'}),map=local.atlas.maps.find(map=>(local.hunt.mapSpawns[map.id]?.points.length||0)>0),id=local.hunt.mapSpawns[map.id].points[0].mobId;local.hunt.monsters=local.hunt.monsters.filter(monster=>monster.id!==id);local.api.activeMap=map.id;local.fire('hunt-ready');const button=local.population().querySelector(`[data-entity="${id}"]`);assert.equal(button.querySelector('bdi').textContent,String(id));local.click(button);assert.deepEqual(plain(local.calls.at(-1)),['monster',map.id,[id]]);
});
check('place categories annotate directory search and world nodes without duplicate badges',()=>{
  const local=setup({language:'en'}),categories=['town','hunting','special','archive','field'];
  for(const [index,category]of categories.entries()){const id=local.atlas.maps[index].id;local.categoryFacts.set(id,{category,label:category+' place',exits:3});const card=local.node('', 'directory-card','button',local.directory);card.dataset.id=String(id);card.append(local.node('', 'card-info','span'));const result=local.node('', 'search-result-mixed','button',local.search);result.dataset.id=String(id);result.setAttribute('data-kind','map');result.append(local.node('', 'search-result-copy','span'));const world=local.node('', 'world-node','g',local.world);world.setAttribute('data-map',id);}
  local.fire('atlas-viewchange');local.fire('atlas-viewchange');for(const observer of local.observed)observer.callback();
  for(const card of local.document.querySelectorAll('.directory-card,.search-result-mixed')){assert.equal(card.querySelectorAll('.place-category').length,1);const expected=local.categoryFacts.get(Number(card.dataset.id));assert.equal(card.dataset.mapCategory,expected.category);assert(card.querySelector('.place-category').textContent.includes(expected.label));}
  for(const node of local.world.querySelectorAll('.world-node'))assert.equal(node.dataset.mapCategory,local.categoryFacts.get(Number(node.dataset.map)).category);
});
check('category labels can update while existing card contents and IDs remain intact',()=>{
  const local=setup({language:'en'}),id=local.api.activeMap,card=local.node('', 'directory-card','button',local.directory);card.dataset.id=String(id);const content=local.node('', 'card-info','span',card);content.textContent='Original map name';local.categoryFacts.set(id,{category:'field',label:'Field',exits:2});local.fire('atlas-viewchange');local.categoryFacts.set(id,{category:'hunting',label:'Hunting area',exits:2});local.fire('atlas-viewchange');assert.equal(card.querySelectorAll('.place-category').length,1);assert.equal(card.dataset.mapCategory,'hunting');assert(content.textContent.includes('Original map name'));assert(content.textContent.includes('Hunting area'));
});
check('map details render one population block and one technical wrapper after repeated events',()=>{
  const local=setup();for(let i=0;i<5;i++){local.fire('hunt-ready');local.fire('atlas-viewchange');}assert.equal(local.details.querySelectorAll('.map-population').length,1);assert.equal(local.details.querySelectorAll('.map-technical').length,1);assert.equal(local.technical.parentElement.className,'map-technical');assert.equal(local.details.children.indexOf(local.population()),local.details.children.indexOf(local.actions)+1);
});
check('module can start before the atlas and populate after atlas-ready',()=>{
  const local=setup({noAtlas:true});assert.equal(local.population(),null);local.window.Atlas=local.api;local.fire('atlas-ready');assert(local.population());assert.equal(local.observed[0].targets.length,2);
});
const failures=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
