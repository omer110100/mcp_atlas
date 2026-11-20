'use strict';
// Execute the actual hunt module with the published local data and focused DOM stubs.
// These checks cover behavior contracts, not browser layout or live-game behavior.
// Route distances use a deterministic portal-only stub; atlas-routing.cjs tests the real router.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('node:path');
const base=path.resolve(__dirname,'..','dist')+path.sep;
const source=fs.readFileSync(base+'hunt.js','utf8').replace('window.Hunt={searchAll,open,close,','window.Hunt={_test:{state,boot,retryDrops,render,renderDetail,renderCatalog,buildCandidates,sortCandidates,npcLocations,onPanelChange,onPanelClick,parseOrigin,walkDistanceText,comparisonContent,comparisonAccess,toggleComparison},searchAll,open,close,');
const rawAtlas=JSON.parse(fs.readFileSync(base+'atlas-data.json'));
const rawHunt=JSON.parse(fs.readFileSync(base+'hunt-data.json'));
const rawDrops=JSON.parse(fs.readFileSync(base+'drop-data.json'));
const translationScope={window:{}};
vm.runInNewContext(fs.readFileSync(base+'translations.js','utf8'),translationScope);
const translations=translationScope.window.AtlasTranslations;
const decode=s=>String(s??'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function makeHarness(options={}){
  const nodes={},calls=[],events={},errors=[],readyStatuses=[],unavailableStatuses=[];
  let doc;
  class Element {
    constructor(tag='div',attrs='') {this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.dataset={};this.attrs={};this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.id='';this.className='';this.isConnected=true;this.scrollTop=0;this._html='';this.writes=0;this.textContent='';
      for(const m of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){const [_,key,value]=m;this.setAttribute(key,decode(value??''));}
      this.classList={toggle:(name,on)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));if(on)set.add(name);else set.delete(name);this.className=[...set].join(' ');},add:name=>this.classList.toggle(name,true)};
    }
    setAttribute(name,value){this.attrs[name]=String(value);if(name==='id'){this.id=String(value);nodes[this.id]=this;}if(name==='class')this.className=String(value);if(name==='value')this.value=String(value);if(name==='hidden')this.hidden=true;if(name==='disabled')this.disabled=true;if(name==='checked')this.checked=true;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(value);}
    getAttribute(name){return this.attrs[name]??null;}
    removeAttribute(name){delete this.attrs[name];if(name==='hidden')this.hidden=false;if(name==='disabled')this.disabled=false;}
    appendChild(child){return this.insertBefore(child,null);}
    insertBefore(child,ref){if(child.parentElement){const siblings=child.parentElement.children;siblings.splice(siblings.indexOf(child),1);}const at=ref?this.children.indexOf(ref):this.children.length;this.children.splice(at,0,child);child.parentElement=this;child.isConnected=true;return child;}
    contains(node){return !!node&&(node===this||this.children.some(child=>child.contains(node)));}
    matches(selector){if(selector==='[hidden]')return this.hidden;if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.className.split(/\s+/).includes(selector.slice(1));const m=selector.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);return !!m&&Object.hasOwn(this.attrs,m[1])&&(m[2]===undefined||this.attrs[m[1]]===m[2]);}
    closest(selector){for(let e=this;e;e=e.parentElement)if(e.matches(selector))return e;return null;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(){}
    focus(options={}){this.focusOptions=options;if(this.isConnected&&!this.disabled&&!this.closest('[hidden]'))doc.activeElement=this;}
    getBoundingClientRect(){return {top:this.id==='huntComparisonTitle'?180:20};}
    scrollTo(options){this.lastScroll=options;this.scrollTop=options.top;}
    get innerHTML(){return this._html;}
    set innerHTML(html){this._html=html;this.writes++;
      if(this.id!=='huntBody')return;
      if(this.contains(doc.activeElement))doc.activeElement=doc.body;
      const disconnect=e=>{e.isConnected=false;if(e.id&&nodes[e.id]===e)delete nodes[e.id];e.children.forEach(disconnect);};this.children.forEach(disconnect);this.children=[];
      for(const m of html.matchAll(/<(input|select|h3|h4|p|section)\b([^>]*\bid="[^"]+"[^>]*)>/g))this.appendChild(new Element(m[1],m[2]));
      for(const m of html.matchAll(/<(button|input)\b([^>]*\bdata-hunt-(?:target|action|open)="[^"]+"[^>]*)>/g))this.appendChild(new Element(m[1],m[2]));
      if(html.includes('class="hunt-candidates"')){const container=this.appendChild(new Element('div','class="hunt-candidates"'));for(const m of html.matchAll(/<article\b([^>]*\bdata-hunt-map="[^"]+"[^>]*)>([\s\S]*?)<\/article>/g)){const card=container.appendChild(new Element('article',m[1]));for(const cls of ['hunt-rank-number','hunt-distance','hunt-recommend-label']){const part=m[2].match(new RegExp('<(?:span|p)\\b([^>]*class="'+cls+'"[^>]*)>([^<]*)<'));if(part){const el=card.appendChild(new Element('span',part[1]));el.textContent=decode(part[2]);}}}}
    }
  }
  const root=new Element('body');doc={body:root,activeElement:root,getElementById:id=>nodes[id]||null,querySelector:()=>null,addEventListener(){},createElement:tag=>new Element(tag)};
  for(const id of ['huntToggle','routeTo'])root.appendChild(new Element('button',`id="${id}"`));
  const panel=root.appendChild(new Element('section','id="huntPanel" hidden'));
  for(const id of ['huntSearch','huntAnnouncement','huntBody'])panel.appendChild(new Element(id==='huntSearch'?'input':'div',`id="${id}"`));
  for(const id of ['huntEyebrow','huntTitle','huntSearchLabel'])panel.appendChild(new Element('span',`id="${id}"`));
  panel.appendChild(new Element('button','class="hunt-close"'));
  const tabs=panel.appendChild(new Element('nav','class="hunt-tabs"'));
  for(const tab of ['item','monster','boss','npc'])tabs.appendChild(new Element('button',`data-hunt-tab="${tab}"`));
  const atlas=structuredClone(rawAtlas),hunt=structuredClone(rawHunt),drops=structuredClone(rawDrops);
  const api={data:atlas,activeMap:10001000,findRoute(from,to,services){calls.push(['find',from,to,services]);if(from===to)return{steps:[]};const queue=[[from,0]],seen=new Set([from]);for(let i=0;i<queue.length;i++){const[id,n]=queue[i];const map=atlas.maps.find(m=>m.id===id);for(const p of map?.portals||[]){if(p.kind!=='cross'||seen.has(p.to))continue;if(p.to===to)return{steps:Array(n+1).fill({})};seen.add(p.to);queue.push([p.to,n+1]);}}return null;},selectMap(...a){calls.push(['map',...a]);},planTo(...a){calls.push(['route',...a]);},openSpawns(...a){calls.push(['spawn',...a]);},openNpcs(...a){calls.push(['npc',...a]);}};
  const window={Atlas:api,addEventListener(k,f){(events[k]||=[]).push(f);},dispatchEvent(e){if(e.type==='hunt-ready')readyStatuses.push(window.Hunt.dropStatus);if(e.type==='hunt-unavailable')unavailableStatuses.push(window.Hunt.catalogStatus);for(const f of events[e.type]||[])f(e);}};
  let language=options.language||'he';
  function enableI18n(){window.AtlasI18n={get language(){return language;},get locale(){return language==='en'?'en-US':'he-IL';},text:(he,en)=>language==='en'?en:he,data:he=>language==='en'?(translations[he]??he):he};}
  function setLanguage(next){language=next;enableI18n();window.dispatchEvent({type:'atlas-languagechange',detail:{language}});}
  if(options.language)enableI18n();
  const modes={hunt:options.hunt||'ready',drop:options.drop||'ready'};
  const fetch=async path=>{const mode=path==='hunt-data.json'?modes.hunt:modes.drop;if(mode==='throw')throw new Error('network');return{ok:mode!=='fail',json:async()=>mode==='invalid'?{}:path==='hunt-data.json'?hunt:drops};};
  vm.runInNewContext(source,{window,document:doc,URL,location:{href:'http://localhost/'},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},fetch,console:{error:(...a)=>errors.push(a)}},{filename:'hunt.js'});
  const action=(name,extra={})=>{const button=new Element('button',`data-hunt-action="${name}"`);for(const[k,v]of Object.entries(extra))button.dataset[k]=String(v);window.Hunt._test.onPanelClick({target:button});};
  return{window,H:window.Hunt,nodes,doc,calls,errors,modes,readyStatuses,unavailableStatuses,action,Element,hunt,drops,atlas,setLanguage,events};
}
function plain(x){return JSON.parse(JSON.stringify(x));}
const results=[];
async function check(name,fn){
  try{await fn();results.push({name,passed:true});}
  catch(error){results.push({name,passed:false,error:error.message});}
}
function report(){
  const failures=results.filter(x=>!x.passed);
  console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));
  process.exitCode=failures.length?1:0;
}
(async()=>{
  const h=makeHarness(),initialCatalogStatus=h.H.catalogStatus;
  await h.H._test.boot();
  const {H,nodes,doc}=h,T=H._test;
  let candidates,origin,writes,places;

  await check('catalogue status, exact entity IDs and unified search',()=>{
    assert.equal(initialCatalogStatus,'loading');assert.equal(H.catalogStatus,'ready');
    assert.equal(H.data.items.length,2353);assert.equal(H.data.monsters.length,128);assert.equal(H.data.npcs.length,311);assert.equal(H.drops.links.length,124);
    assert.equal(H.dropStatus,'ready');assert.deepEqual(h.readyStatuses,['ready']);
    assert(H.searchAll('grendel').some(x=>x.kind==='npc'&&x.id===313));assert(H.searchAll('mushmom').filter(x=>x.kind==='boss').length>=6);
  });
  await check('boss coordinates and same-name variants without recorded spawn',()=>{
    nodes.huntToggle.focus();nodes.huntBody.scrollTop=600;H.open('boss',700003);
    assert.equal(nodes.huntBody.scrollTop,0);assert.equal(doc.activeElement.id,'huntEntityTitle');
    assert(nodes.huntBody.innerHTML.includes('x 1167 · y 819'));assert(nodes.huntBody.innerHTML.includes('12.5%'));
    H.open('boss',810004);assert(nodes.huntBody.innerHTML.includes('אין במאגר מפת הופעה מתועדת'));assert(!nodes.huntBody.innerHTML.includes('אינו במשחק'));
  });
  await check('Pan Lid returns all 35 candidate maps with bounded point share',()=>{
    H.open('item',1092002);candidates=T.buildCandidates([...T.state.targets]);
    assert.equal(candidates.length,35);assert(candidates.every(c=>c.count<=c.total&&c.share<=100));
  });
  await check('duplicate target IDs cannot inflate recorded spawn counts',()=>{
    assert.deepEqual(plain(T.buildCandidates([...T.state.targets,...T.state.targets]).map(x=>x.count)),plain(candidates.map(x=>x.count)));
  });
  await check('points, share and walking-distance ordering use the documented tie rules',()=>{
    const tuples=[{map:{id:3,name:'C'},count:10,share:50,distance:3},{map:{id:2,name:'B'},count:10,share:50,distance:2},{map:{id:1,name:'A'},count:10,share:70,distance:6},{map:{id:4,name:'D'},count:11,share:20,distance:9}];
    assert.deepEqual(plain(T.sortCandidates(tuples).map(x=>x.map.id)),[4,1,2,3]);
    T.state.rank='share';assert.equal(T.sortCandidates(tuples)[0].map.id,1);
    T.state.rank='distance';assert.equal(T.sortCandidates(tuples)[0].map.id,2);T.state.rank='points';
  });
  await check('rank change preserves control nodes, focus and scroll',()=>{
    const rank=nodes.huntRank;origin=nodes.huntOrigin;rank.value='share';rank.focus();nodes.huntBody.scrollTop=380;writes=nodes.huntBody.writes;
    T.onPanelChange({target:rank});
    assert.equal(doc.activeElement,rank);assert.equal(nodes.huntBody.scrollTop,380);assert.equal(nodes.huntBody.writes,writes);assert.equal(nodes.huntOrigin,origin);
    assert.deepEqual(nodes.huntBody.querySelector('.hunt-candidates').children.map(x=>Number(x.dataset.huntMap)),plain(T.sortCandidates(candidates).map(x=>x.map.id)));
  });
  await check('invalid origin persists, blocks routing, and recovers without replacing controls',()=>{
    origin.value='not-a-map';origin.focus();T.onPanelChange({target:origin});
    assert.equal(T.state.originId,null);assert.equal(origin.value,'not-a-map');assert.equal(origin.getAttribute('aria-invalid'),'true');assert.equal(nodes.huntOriginNote.hidden,false);
    assert.equal(nodes.huntBody.writes,writes);assert.equal(nodes.huntBody.scrollTop,380);assert(nodes.huntBody.querySelector('.hunt-distance').textContent.includes('בחרו מפת מוצא'));
    h.action('route',{map:10001005});assert(!h.calls.some(c=>c[0]==='route'));assert.equal(doc.activeElement,origin);
    H.close();assert.equal(doc.activeElement,nodes.huntToggle);H.open('item',1092002);assert.equal(nodes.huntOrigin.value,'not-a-map');assert.equal(T.state.originId,null);
    nodes.huntOrigin.value='10001000';nodes.huntOrigin.focus();writes=nodes.huntBody.writes;T.onPanelChange({target:nodes.huntOrigin});
    assert.equal(T.state.originId,10001000);assert.equal(nodes.huntOrigin.getAttribute('aria-invalid'),'false');assert.equal(nodes.huntOrigin.getAttribute('aria-describedby'),null);assert.equal(nodes.huntOriginNote.hidden,true);assert.equal(nodes.huntBody.writes,writes);
  });
  await check('changing a monster checkbox preserves its focus and panel scroll',()=>{
    const target=nodes.huntBody.querySelector('[data-hunt-target]'),mid=Number(target.dataset.huntTarget);target.checked=false;target.focus();nodes.huntBody.scrollTop=410;
    T.onPanelChange({target});assert.equal(doc.activeElement.dataset.huntTarget,String(mid));assert.equal(nodes.huntBody.scrollTop,410);assert(!T.state.targets.has(mid));
  });
  await check('ambiguous Charm of the Undead report keeps attribution without invented navigation',()=>{
    H.open('item',4000020);assert(nodes.huntBody.innerHTML.includes('אין יעד ניווט מאומת'));assert(nodes.huntBody.innerHTML.includes('https://ms-classic.com/drops'));
    assert(!nodes.huntBody.innerHTML.includes('data-hunt-action="route"'));assert(!nodes.huntBody.innerHTML.includes('אין במקורות שנכללו תיעוד'));
  });
  await check('missing drop evidence and documented-only empty results remain distinguishable',()=>{
    const unrecorded=H.data.items.find(x=>!H.drops.links.some(l=>l.itemId===x.id)&&!H.drops.unresolved.some(l=>l.itemId===x.id));
    H.open('item',unrecorded.id);assert(nodes.huntBody.innerHTML.includes('אין במקורות שנכללו תיעוד נפילה'));
    H.open('item');T.state.query=String(unrecorded.id);T.state.documented=true;T.renderCatalog();
    assert(nodes.huntBody.innerHTML.includes('בין הפריטים עם תיעוד נפילה שנאסף'));assert(nodes.huntBody.innerHTML.includes('data-hunt-action="clear-filter"'));
    h.action('clear-filter');assert.equal(T.state.query,String(unrecorded.id));assert(nodes.huntBody.innerHTML.includes(unrecorded.name));assert.equal(doc.activeElement,nodes.huntSearch);
  });
  await check('NPC exact-ID locations preserve all 270 points and disclose missing locations',()=>{
    H.open('npc',113);assert(nodes.huntBody.innerHTML.includes('אין במאגר מפת מיקום מתועדת'));
    H.open('npc');T.state.query='113';T.renderCatalog();assert(nodes.huntBody.innerHTML.includes('ללא מיקום מתועד'));
    places=T.npcLocations(H.data.npcs.find(x=>x.id===313));assert(places.length);
    assert.equal(H.data.npcs.reduce((n,x)=>n+T.npcLocations(x).reduce((a,l)=>a+l.points.length,0),0),270);
  });
  await check('NPC and boss scene actions pass exact map and entity IDs',()=>{
    H.open('npc',313);h.action('npc-positions',{map:places[0].map.id,npc:313});assert.deepEqual(plain(h.calls.at(-1)),['npc',places[0].map.id,[313]]);
    H.open('boss',700000);h.action('positions',{map:10001005,mobs:'700000'});assert.deepEqual(plain(h.calls.at(-1)),['spawn',10001005,[700000]]);
  });
  await check('routing uses the selected origin and walking-only distance comparisons',()=>{
    h.action('route',{map:10001005});assert(h.calls.some(c=>c[0]==='route'&&c[1]===10001005&&c[2]===10001000));
    assert.equal(doc.activeElement.id,'routeTo');assert.equal(nodes.huntPanel.hidden,true);assert(h.calls.filter(c=>c[0]==='find').every(c=>c[3]===false));
  });
  await check('showing more results focuses the first newly displayed item',()=>{
    H.open('item');T.state.query='';T.state.documented=false;T.renderCatalog();h.action('more');
    assert.equal(T.state.limit,144);assert.equal(doc.activeElement.dataset.huntOpen,'item');
  });
  await check('drop-file failure is explicit and retry publishes ready metadata',async()=>{
    const f=makeHarness({drop:'fail'});await f.H._test.boot();assert.equal(f.H.dropStatus,'unavailable');assert.equal(f.H.data.npcs.length,311);
    f.H.open('item',1092002);assert(f.nodes.huntBody.innerHTML.includes('תיעוד נפילות הפריטים לא נטען'));assert(!f.nodes.huntBody.innerHTML.includes('אין במקורות שנכללו'));assert(!f.nodes.huntBody.innerHTML.includes('data-hunt-action="route"'));
    f.modes.drop='ready';await f.H._test.retryDrops();assert.equal(f.H.dropStatus,'ready');assert.equal(f.H.drops.links.length,124);assert.deepEqual(f.readyStatuses,['unavailable','ready']);assert(f.nodes.huntBody.innerHTML.includes('מפות עם נקודות יעד מתועדות'));
  });
  await check('malformed drop data leaves the entity catalogue usable',async()=>{
    const bad=makeHarness({drop:'invalid'});await bad.H._test.boot();assert.equal(bad.H.dropStatus,'unavailable');assert(bad.H.searchAll('Mushmom').length);
  });
  await check('catalogue failure emits unavailable status and can be retried',async()=>{
    const c=makeHarness({hunt:'fail'});c.H.open('item');await c.H._test.boot();
    assert.equal(c.H.data,null);assert.equal(c.H.catalogStatus,'unavailable');assert.deepEqual(c.unavailableStatuses,['unavailable']);assert(c.nodes.huntBody.innerHTML.includes('הקטלוג לא נטען'));assert.equal(c.nodes.huntBody.getAttribute('aria-busy'),'false');
    c.modes.hunt='ready';await c.H._test.boot();assert.equal(c.H.data.items.length,2353);assert.equal(c.H.catalogStatus,'ready');
  });
  await check('comparison starts empty and excludes invalid/noncandidate map IDs',()=>{
    H.open('item',1092002);assert.equal(T.state.compare.length,0);
    assert(nodes.huntBody.innerHTML.includes('בחרו עד 3 מפות להשוואה'));
    T.toggleComparison(-1);T.toggleComparison(10001000);assert.equal(T.state.compare.length,0);
  });
  await check('comparison holds three unique candidates and enforces limit',()=>{
    const list=T.buildCandidates([...T.state.targets]);
    for(const c of list.slice(0,3))T.toggleComparison(c.map.id);
    assert.equal(T.state.compare.length,3);assert.equal(new Set(T.state.compare).size,3);
    T.toggleComparison(list[3].map.id);assert.equal(T.state.compare.length,3);
    assert(nodes.huntAnnouncement.textContent.includes('עד 3 מפות'));
    assert(nodes.huntBody.innerHTML.includes('hunt-compare-toggle'));
    T.toggleComparison(list[0].map.id);assert.equal(T.state.compare.length,2);
    T.toggleComparison(list[3].map.id);assert.equal(T.state.compare.length,3);
  });
  await check('comparison table uses exact target metrics and real action IDs',()=>{
    const list=T.buildCandidates([...T.state.targets]);const rows=T.state.compare.map(id=>list.find(c=>c.map.id===id));
    const html=T.comparisonContent(list);
    assert(html.includes('<table>'));assert(html.includes('scope="col"'));assert(html.includes('scope="row"'));
    for(const c of rows){assert(html.includes(`data-map="${c.map.id}"`));assert(html.includes(`data-mobs="${c.ids.join(',')}"`));assert(html.includes(String(c.count)));}
    assert(html.includes('אינם תפוקת ציד או סיכויי נפילה'));assert(html.includes('תנאי כניסה ומגבלות'));
    nodes.huntBody.scrollTop=400;h.action('compare-open');assert.equal(T.state.compareOpen,true);assert.equal(doc.activeElement.id,'huntComparisonTitle');
    assert.equal(nodes.huntComparisonTitle.focusOptions.preventScroll,true);assert.equal(nodes.huntBody.scrollTop,548);assert.equal(nodes.huntBody.lastScroll.behavior,'auto');assert.equal(nodes.huntPanel.scrollTop,0);
  });
  await check('comparison updates distances on origin change without losing selection',()=>{
    const before=plain(T.state.compare),mapId=before[0];nodes.huntOrigin.value=String(mapId);T.onPanelChange({target:nodes.huntOrigin});
    assert.deepEqual(plain(T.state.compare),before);
    assert(nodes.huntComparison.innerHTML.includes('זו מפת המוצא'));
    nodes.huntOrigin.value='unknown';T.onPanelChange({target:nodes.huntOrigin});assert(nodes.huntComparison.innerHTML.includes('בחרו מפת מוצא'));
    nodes.huntOrigin.value='10001000';T.onPanelChange({target:nodes.huntOrigin});
  });
  await check('comparison retains same-entity context but resets on another entity',()=>{
    const before=plain(T.state.compare),targets=[...T.state.targets];H.close();H.open('item',1092002);
    assert.deepEqual(plain(T.state.compare),before);assert.deepEqual([...T.state.targets],targets);
    H.open('boss',700000);assert.equal(T.state.compare.length,0);assert.equal(T.state.compareOpen,false);
  });
  await check('changing target filters removes stale compared maps and closes an empty comparison',()=>{
    H.open('item',1092002);const list=T.buildCandidates([...T.state.targets]);T.toggleComparison(list[0].map.id);h.action('compare-open');
    T.state.targets.clear();T.renderDetail();assert.equal(T.state.compare.length,0);assert.equal(T.state.compareOpen,false);
    assert(!nodes.huntBody.innerHTML.includes('data-hunt-action="compare-toggle"'));assert(nodes.huntBody.innerHTML.includes('סמנו לפחות מפלצת אחת'));
  });
  await check('comparison clear is local to selection and conditional access text is escaped',()=>{
    const mob=H.data.monsters.find(m=>m.hasRecordedSpawn&&!m.isBoss);H.open('monster',mob.id);const list=T.buildCandidates([mob.id]);assert(list.length);T.toggleComparison(list[0].map.id);h.action('compare-clear');
    assert.equal(T.state.compare.length,0);assert.equal(T.state.selected.id,mob.id);
    const map=h.atlas.maps.find(m=>h.atlas.services.some(s=>s.to===m.id&&s.condition));assert(map);
    const html=T.comparisonAccess(map);assert(html.includes('כניסות מתועדות'));assert(html.includes('חלופיות'));
    const service=h.atlas.services.find(s=>s.to===map.id);const previous=service.condition;service.condition='<img src=x onerror=x>';assert(T.comparisonAccess(map).includes('&lt;img'));service.condition=previous;
  });
  await check('English catalogues, details and data caveats contain no untranslated Hebrew',async()=>{
    const english=makeHarness({language:'en'});await english.H._test.boot();
    const body=english.nodes.huntBody;
    for(const kind of ['item','monster','boss','npc']){
      english.H.open(kind);assert(!/[\u0590-\u05ff]/u.test(body.innerHTML),`${kind} catalogue includes Hebrew`);
      assert(english.nodes.huntSearch.placeholder.includes('name or ID'));
    }
    for(const [kind,id]of [['item',1092002],['item',4000020],['boss',700003],['monster',100100],['npc',313]]){
      english.H.open(kind,id);assert(!/[\u0590-\u05ff]/u.test(body.innerHTML),`${kind} ${id} detail includes Hebrew`);
    }
    english.H.open('item',1092002);
    const candidates=english.H._test.buildCandidates([...english.H._test.state.targets]);
    english.H._test.toggleComparison(candidates[0].map.id);english.action('compare-open');
    assert(body.innerHTML.includes('Compare hunting maps'));assert(body.innerHTML.includes('not hunting yield or drop chances'));
    assert(!/[\u0590-\u05ff]/u.test(body.innerHTML));
    assert.equal(english.nodes.huntTitle.textContent,'Set out to discover');
    assert.equal(english.nodes.huntPanel.querySelector('.hunt-close').getAttribute('aria-label'),'Close search');
    assert.equal(english.nodes.huntPanel.querySelector('[data-hunt-tab="npc"]').textContent,'NPCs');
    for(const map of english.atlas.maps.filter(m=>english.atlas.services.some(s=>s.to===m.id&&(s.condition||s.condition_he))))assert(!/[\u0590-\u05ff]/u.test(english.H._test.comparisonAccess(map)),`Map ${map.id} has untranslated entry conditions`);
  });
  await check('switching language preserves hunting context, comparison, focus and scroll',async()=>{
    const switched=makeHarness();await switched.H._test.boot();switched.H.open('item',1092002);
    const s=switched.H._test.state;s.query='Pan';s.documented=true;s.rank='share';
    const list=switched.H._test.buildCandidates([...s.targets]);
    switched.H._test.toggleComparison(list[0].map.id);switched.H._test.toggleComparison(list[1].map.id);switched.action('compare-open');
    switched.nodes.huntOrigin.value='10001005';switched.H._test.onPanelChange({target:switched.nodes.huntOrigin});
    const target=switched.nodes.huntBody.querySelector('[data-hunt-target]');target.checked=false;switched.H._test.onPanelChange({target});
    const snapshot={tab:s.tab,query:s.query,selected:plain(s.selected),originId:s.originId,originText:s.originText,rank:s.rank,targets:[...s.targets],compare:plain(s.compare),compareOpen:s.compareOpen,documented:s.documented};
    switched.nodes.huntRank.focus();switched.nodes.huntBody.scrollTop=312;
    switched.setLanguage('en');
    assert.equal(switched.nodes.huntBody.scrollTop,312);assert.equal(switched.doc.activeElement.id,'huntRank');
    assert.deepEqual({tab:s.tab,query:s.query,selected:plain(s.selected),originId:s.originId,originText:s.originText,rank:s.rank,targets:[...s.targets],compare:plain(s.compare),compareOpen:s.compareOpen,documented:s.documented},snapshot);
    assert(switched.nodes.huntBody.innerHTML.includes('Compare hunting maps'));assert(switched.nodes.huntBody.innerHTML.includes('Fewest map transitions'));
    switched.setLanguage('he');assert(switched.nodes.huntBody.innerHTML.includes('השוואת מפות ציד'));assert.equal(switched.doc.activeElement.id,'huntRank');
    switched.H.close();switched.setLanguage('en');assert.equal(switched.nodes.huntPanel.hidden,true);switched.H.open('item',1092002);
    assert.deepEqual(plain(s.compare),snapshot.compare);assert.equal(s.originId,snapshot.originId);
    assert.equal(switched.events['atlas-languagechange'].length,1);
  });
  await check('English missing records, invalid origins and loading failures stay actionable',async()=>{
    const english=makeHarness({language:'en'});await english.H._test.boot();
    english.H.open('npc',113);assert(english.nodes.huntBody.innerHTML.includes('No location map is recorded'));
    english.H.open('boss',810004);assert(english.nodes.huntBody.innerHTML.includes('No spawn map is recorded'));
    english.H.open('item',1092002);english.nodes.huntOrigin.value='unknown';english.H._test.onPanelChange({target:english.nodes.huntOrigin});english.action('route',{map:10001005});
    assert.equal(english.doc.activeElement.id,'huntOrigin');assert(english.nodes.huntAnnouncement.textContent.includes('No unique starting map'));
    assert(!english.calls.some(c=>c[0]==='route'));
    english.H.open('item');english.H._test.state.query='no-such-item';english.H._test.renderCatalog();assert(english.nodes.huntBody.innerHTML.includes('No matches.'));
    const failed=makeHarness({language:'en',drop:'fail'});await failed.H._test.boot();failed.H.open('item',1092002);
    assert(failed.nodes.huntBody.innerHTML.includes('Retry loading records'));assert(!/[\u0590-\u05ff]/u.test(failed.nodes.huntBody.innerHTML));
    failed.modes.drop='ready';await failed.H._test.retryDrops();assert(failed.nodes.huntBody.innerHTML.includes('recorded target spawn points'));
    const unavailable=makeHarness({language:'en',hunt:'fail'});unavailable.H.open('item');await unavailable.H._test.boot();
    assert(unavailable.nodes.huntBody.innerHTML.includes('The catalogue could not be loaded.'));assert(!/[\u0590-\u05ff]/u.test(unavailable.nodes.huntBody.innerHTML));
  });
  report();
})().catch(error=>{results.push({name:'hunt test setup',passed:false,error:error.stack||error.message});report();});
