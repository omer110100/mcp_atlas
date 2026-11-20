'use strict';
// Real modules with controllable image, keyboard and storage boundaries.
// Browser layout, network timing and game movement are tested separately.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,'dist',name),'utf8'),results=[];
const plain=value=>JSON.parse(JSON.stringify(value));
const check=(name,run)=>{try{run();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}};
function setup({saveData=false,candidate=true}={}){
  const documentEvents=new Map(),events=new Map(),nodes=new Map(),images=[],timers=new Map(),requests=[],planned=[],calls=[];
  let timerId=0,peakActive=0;
  const el=id=>{if(!nodes.has(id))nodes.set(id,{id,textContent:'',hidden:false,open:false,disabled:false,click(){calls.push(id);}});return nodes.get(id);};
  const document={getElementById:el,addEventListener:(name,fn)=>documentEvents.set(name,fn),querySelectorAll:()=>[...nodes.values()].filter(node=>node.open)};
  const window={AtlasI18n:{text:(he,en)=>en,data:text=>text},addEventListener:(name,fn)=>events.set(name,fn),AtlasShell:{showDrawer:name=>calls.push(name)}};
  const location=new URL('https://atlas.example/?private=hidden#route=1,3&engine=3');
  class FakeImage{
    constructor(){this.active=false;images.push(this);}
    set src(value){this._src=value;this.active=!!value;requests.push(value);peakActive=Math.max(peakActive,images.filter(image=>image.active).length);}
    get src(){return this._src;}
    removeAttribute(name){if(name==='src'){this._src='';this.active=false;}}
    complete(ok=true){this.active=false;const handler=ok?this.onload:this.onerror;if(handler)handler();}
  }
  const context=vm.createContext({window,document,location,URL,navigator:{connection:{saveData}},Image:FakeImage,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(read('journey.js'),context);vm.runInContext(read('route-tools.js'),context);
  const maps=Array.from({length:12},(_,index)=>({id:index+1,name:`Map ${index+1}`,image:`assets/maps/${index+1}.webp`}));
  const route={from:1,to:4,stops:[],steps:[{from:1,to:2,p:{key:'1:exit',number:1}},{from:2,to:3,p:{key:'2:exit',number:2}},{from:3,to:4,p:{key:'3:exit',number:3}}]};
  const recipe={from:1,to:4,stops:[],services:false,step:1};
  window.Atlas={data:{maps},currentRoute:route,getJourney:()=>recipe,findRoute:(...args)=>{calls.push(['findRoute',...plain(args)]);return candidate?{}:null;},planJourney:value=>{planned.push(plain(value));return true;}};
  const key=(key,extra={})=>{const event={key,target:{closest:()=>null},preventDefault(){this.defaultPrevented=true;},...extra};documentEvents.get('keydown')(event);return event;};
  const expire=()=>{const first=timers.entries().next().value;if(first){timers.delete(first[0]);first[1]();}};
  return {tools:window.AtlasRouteTools,window,route,recipe,maps,images,timers,requests,planned,calls,el,key,expire,location,get peakActive(){return peakActive;},get active(){return images.filter(image=>image.active);}};
}
const imageRoute=ids=>({from:ids[0],steps:ids.slice(1).map(to=>({to}))});
check('prefetch starts at most three original-image requests and deduplicates repeated route maps',()=>{
  const h=setup();h.tools.prefetch(imageRoute([1,2,3,2,4,5]));assert.equal(h.active.length,3);assert.equal(h.requests.length,3);
  while(h.active.length)h.active[0].complete();assert.equal(h.requests.length,5);assert.equal(new Set(h.requests).size,5);assert.equal(h.peakActive,3);
});
check('prefetch yields one request at a time with data-saving enabled',()=>{
  const h=setup({saveData:true});h.tools.prefetch(imageRoute([1,2,3]));assert.equal(h.active.length,1);h.active[0].complete();assert.equal(h.active.length,1);assert.equal(h.peakActive,1);
});
check('successful prefetched images are reused for a later route',()=>{
  const h=setup();h.tools.prefetch(imageRoute([1,2,3]));while(h.active.length)h.active[0].complete();h.tools.prefetch(imageRoute([3,2,4]));assert.deepEqual(h.requests,['assets/maps/1.webp','assets/maps/2.webp','assets/maps/3.webp','assets/maps/4.webp']);
});
check('an image error advances the queue and does not poison later retries',()=>{
  const h=setup({saveData:true});h.tools.prefetch(imageRoute([1,2]));h.active[0].complete(false);assert.equal(h.active[0].src,'assets/maps/2.webp');h.active[0].complete();h.tools.prefetch(imageRoute([1,2]));assert.equal(h.active[0].src,'assets/maps/1.webp');
});
check('a slow-image timeout cancels that request before starting another',()=>{
  const h=setup();h.tools.prefetch(imageRoute([1,2,3,4,5]));const timedOut=h.images[0];h.expire();assert.equal(timedOut.active,false);assert.equal(timedOut.onload,null);assert.equal(h.active.length,3);assert.equal(h.peakActive,3);
});
check('replacing a route cancels pending old requests and keeps global concurrency bounded',()=>{
  const h=setup();h.tools.prefetch(imageRoute([1,2,3,4,5]));const stale=[...h.active];h.tools.prefetch(imageRoute([6,7,8,9]));assert.ok(stale.every(image=>!image.active&&image.onload===null));assert.equal(h.active.length,3);assert.equal(h.peakActive,3);assert.equal(h.timers.size,3);
  for(const image of stale)image.complete();assert.equal(h.requests.length,6);h.active[0].complete();assert.equal(h.requests.at(-1),'assets/maps/9.webp');
});
check('repeated view updates for one route do not restart prefetching',()=>{
  const h=setup(),route=imageRoute([1,2,3,4]);h.tools.prefetch(route);h.tools.prefetch(route);assert.equal(h.requests.length,3);assert.equal(h.active.length,3);
});
check('an unavailable detour keeps the active recipe and route unchanged with a visible explanation',()=>{
  const h=setup({candidate:false}),before=JSON.stringify(h.recipe),route=h.window.Atlas.currentRoute;assert.equal(h.tools.avoid(1,'edge'),false);assert.equal(h.planned.length,0);assert.equal(h.window.Atlas.currentRoute,route);assert.equal(JSON.stringify(h.recipe),before);assert.match(h.el('routeToolsStatus').textContent,/previous route is kept/);
});
check('avoiding a gate preserves stops, goal and old exclusions while explicitly resetting progress',()=>{
  const h=setup();h.recipe.stops=[3];h.recipe.goal={kind:'hunt',targets:[{kind:'monster',id:2}],monsterIds:[2]};h.recipe.avoidMaps=[5];h.recipe.avoidEdges=['s:old'];
  assert.equal(h.tools.avoid(1,'edge'),true);assert.equal(h.planned.length,1);assert.deepEqual(h.planned[0].stops,[3]);assert.deepEqual(h.planned[0].goal,h.recipe.goal);assert.deepEqual(h.planned[0].avoidMaps,[5]);assert.deepEqual(h.planned[0].avoidEdges,['s:old','p:2:2:exit']);assert.equal(h.planned[0].step,0);assert.equal(h.recipe.step,1);
});
check('map avoidance cannot silently remove start, destination or chosen stops',()=>{
  const h=setup();h.recipe.stops=[2];assert.equal(h.tools.avoid(0,'map'),false);assert.equal(h.tools.avoid(1,'map'),false);assert.equal(h.planned.length,0);assert.equal(h.tools.avoid(2,'map'),true);assert.deepEqual(h.planned[0].avoidMaps,[3]);
});
check('invalid detour selections and exclusion overflow never alter the journey',()=>{
  const h=setup();for(const index of [-1,3,1.5,'1'])assert.equal(h.tools.avoid(index,'edge'),false);assert.equal(h.tools.avoid(1,'other'),false);h.recipe.avoidEdges=Array.from({length:32},(_,index)=>`s:old-${index}`);assert.equal(h.tools.avoid(1,'edge'),false);assert.equal(h.planned.length,0);assert.match(h.el('routeToolsStatus').textContent,/limit/);
});
check('arrow keys activate next and previous only while the guide is visible',()=>{
  const h=setup();h.el('sceneDialog').open=true;h.el('sceneNavigation').hidden=false;assert.equal(h.key('ArrowRight').defaultPrevented,true);assert.equal(h.key('ArrowLeft').defaultPrevented,true);assert.deepEqual(h.calls,['sceneNavNext','sceneNavPrevious']);h.el('sceneNavigation').hidden=true;h.key('ArrowRight');assert.equal(h.calls.length,2);
});
check('navigation arrows do not steal text editing, composition, modified shortcuts or another dialog',()=>{
  const h=setup();h.el('sceneDialog').open=true;
  for(const extra of [{defaultPrevented:true},{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{target:{closest:()=>({tagName:'INPUT'})}}])h.key('ArrowRight',extra);
  h.el('appearanceDialog').open=true;h.key('ArrowRight');h.el('appearanceDialog').open=false;h.el('sceneNavNext').disabled=true;h.key('ArrowRight');h.el('sceneNavPrevious').hidden=true;h.key('ArrowLeft');assert.equal(h.calls.length,0);
});
check('Discord copy includes exact gates and conditions without private query strings or mass mentions',()=>{
  const h=setup();h.maps[0].name='Map\n@everyone';h.route.steps[1]={from:2,to:3,service:{id:'quest',condition:'Speak\nto the NPC'}};
  const text=h.tools.discordText();assert.match(text,/Portal 1/);assert.match(text,/Conditional entrance/);assert.match(text,/Speak to the NPC/);assert.ok(!text.includes('private=')&&!text.includes('@everyone'));assert.ok(text.includes('@\u200beveryone'));assert.match(text,/https:\/\/atlas\.example\/#route=/);
});

function personalSetup({hash='',route,step=1}={}){
  const nodes=new Map(),storage=new Map(),resumed=[],restored=[];
  const el=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='personalFilter'?'favorites':'',textContent:'',addEventListener(){},focus(){},select(){},showModal(){},close(){}});return nodes.get(id);};
  const window={addEventListener(){},AtlasI18n:{language:'en'}},location=new URL('https://atlas.example/?private=hidden'+hash);
  const document={getElementById:el,querySelector:()=>null},context=vm.createContext({window,document,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},location,history:{replaceState:(a,b,url)=>{location.href=new URL(url,location.href).href;}},URL,URLSearchParams,navigator:{clipboard:{writeText:async()=>{}}}});
  vm.runInContext(read('journey.js'),context);vm.runInContext(read('personal.js'),context);
  let current=route||{from:1,to:3,stops:[],avoidMaps:[4],avoidEdges:['s:closed'],steps:[{from:1,to:2,p:{key:'1:exit'}},{from:2,to:3,p:{key:'2:exit'}}]};
  const maps=new Map(Array.from({length:40},(_,index)=>[index+1,{id:index+1,name:`Map ${index+1}`}]));
  window.AtlasPersonal.init({maps,version:'2.0.0',getRoute:()=>current,getStep:()=>step,getServices:()=>false,escape:String,notice(){},refresh(){},select(){},restore(recipe){restored.push(plain(recipe));current={...current,...recipe};return true;},resume(value){step=value;resumed.push(value);}});
  return {personal:window.AtlasPersonal,location,el,resumed,restored,get current(){return current;}};
}
check('deep links round-trip weighted engine, both avoidance types and the exact step',()=>{
  const h=personalSetup();h.personal.saveJourney();const parsed=h.personal.parseLink(h.location.hash);assert.deepEqual(plain(parsed.avoidMaps),[4]);assert.deepEqual(plain(parsed.avoidEdges),['s:closed']);assert.equal(parsed.step,1);assert.equal(parsed.engine,'3');
  const reopened=personalSetup({hash:h.location.hash});assert.equal(reopened.resumed[0],1);assert.deepEqual(reopened.restored[0].avoidMaps,[4]);assert.deepEqual(reopened.restored[0].avoidEdges,['s:closed']);
});
check('pre-Dijkstra links and foreign engine versions cannot silently resume a different route step',()=>{
  const legacy=personalSetup({hash:'#route=1,3&services=0&step=1&data=2.0.0'});assert.equal(legacy.resumed[0],0);
  const h=personalSetup();assert.equal(h.personal.parseLink('#route=1,3&engine=4'),null);assert.equal(h.personal.parseLink('#route=1,3&engine=3&engine=3'),null);
});
check('shared exclusion parameters reject malformed JSON, wrong types, excessive counts and unknown maps',()=>{
  const h=personalSetup();for(const query of ['avoidMaps=null','avoidMaps=%7B%7D','avoidEdges=%22s%3Atest%22','avoidEdges=%5B','avoidMaps=%5B999%5D',`avoidMaps=${encodeURIComponent(JSON.stringify(Array(33).fill(4)))}`,`avoidEdges=${encodeURIComponent(JSON.stringify(Array(33).fill('s:closed')))}`,`avoidEdges=${encodeURIComponent(JSON.stringify(['<script>']))}`])assert.equal(h.personal.parseLink('#route=1,3&engine=3&'+query),null);
});
check('maximum bounded exclusion lists fit their own share-link parser',()=>{
  const route={from:1,to:3,stops:[],avoidMaps:Array.from({length:32},(_,index)=>index+4),avoidEdges:Array.from({length:32},(_,index)=>'s:'+String(index).padStart(3,'0')+'x'.repeat(123)),steps:[{from:1,to:3,p:{key:'1:exit'}}]};
  const h=personalSetup({route,step:0});h.personal.saveJourney();assert.ok(h.location.hash.length<=8192);const parsed=h.personal.parseLink(h.location.hash);assert.equal(parsed.avoidEdges.length,32);assert.equal(parsed.avoidMaps.length,32);
});
const failures=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
