'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'../dist'),ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(base,'explorer.js'),'utf8'),ctx,{filename:'explorer.js'});
vm.runInContext(fs.readFileSync(path.join(base,'journey.js'),'utf8'),ctx,{filename:'journey.js'});
const api=ctx.AtlasExplorerCore,journey=ctx.AtlasJourney,plain=value=>JSON.parse(JSON.stringify(value));
const atlas=JSON.parse(fs.readFileSync(path.join(base,'atlas-data.json'),'utf8')),catalog=JSON.parse(fs.readFileSync(path.join(base,'hunt-data.json'),'utf8'));
const maps=new Map(atlas.maps.map(map=>[map.id,map])),index=api.makeIndex(atlas.maps,catalog,atlas.groups),results=[];
const adjacency=new Map(atlas.maps.map(map=>[map.id,map.portals.filter(portal=>portal.kind==='cross'&&maps.has(portal.to)).map(p=>({p,to:p.to}))]));
const graph={maps,adjacency,services:atlas.services,asOf:atlas.meta.asOf},route=(from,to,services)=>journey.findRoute(graph,from,to,services);
function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const matches=query=>api.search(index,query),ids=query=>matches(query).map(result=>`${result.kind}:${result.id}`);
check('all original map and catalogue records remain searchable without mutation',()=>{
  const before=JSON.stringify([atlas,catalog]);
  assert.equal(index.length,atlas.maps.length+catalog.items.length+catalog.monsters.length+catalog.npcs.length+6);
  for(const record of [...atlas.maps,...catalog.monsters,...catalog.npcs])assert(matches(String(record.id)).some(result=>result.id===record.id));
  assert.equal(JSON.stringify([atlas,catalog]),before);
});
check('English and Hebrew Stumpy aliases select the same source-backed boss',()=>{
  for(const query of ['Stumpy','STUMPY','סטמפי','סטאמפי','סטַמפי','700007'])assert.equal(ids(query)[0],'boss:700007');
  const entry=matches('סטמפי')[0];assert.deepEqual(plain(api.entityMaps(entry.entry,entry.kind,maps)),[10004057]);
});
check('compound Hebrew monster aliases retain actual source names and category',()=>{
  for(const query of ['פטריה כתומה','פטרייה כתומה','orange mushroom'])assert(matches(query).some(record=>record.name==='Orange Mushroom'&&record.kind==='monster'));
  assert(matches('חלזון כחול').some(record=>record.name==='Blue Snail'));
  assert(matches('סליים').some(record=>record.name==='Slime'));
});
check('NPC aliases preserve exact recorded locations',()=>{
  const npc=matches('גרנדל הזקן').find(record=>record.kind==='npc');assert.equal(npc?.id,313);
  assert.deepEqual(plain(api.entityMaps(npc.entry,'npc',maps)),[10002003]);
  assert.deepEqual(plain(npc.entry.maps[0].points),[{x:583,y:540}]);
  assert(ids('Dark Lord').some(id=>ids('דארק לורד').includes(id)));
});
check('maps and regions support Hebrew and English independently',()=>{
  assert(matches('הנסיס').some(record=>record.name==='Henesys'&&record.kind==='map'));
  for(const query of ['ויקטוריה','Victoria'])assert(matches(query).some(record=>record.kind==='region'&&record.id==='victoria'));
  for(const query of ['החלל הנשכח','Forgotten Hollow'])assert(matches(query).some(record=>record.kind==='region'&&record.id==='hollow'));
});
check('item lookup remains available alongside maps and creatures',()=>{
  const sword=matches('חרב');assert(sword.some(record=>record.kind==='item'&&/sword/i.test(record.name)));
  assert(api.search(index,'sword',100).some(record=>record.kind==='item'));
});
check('queries, output limits and hostile text are bounded and handled as text',()=>{
  assert.equal(matches(' ').length,0);assert.equal(matches('<img src=x onerror=alert(1)>').length,0);
  assert.equal(api.search(index,'',100).length,0);assert(api.search(index,'a',10000).length<=100);assert(api.search(index,'a').length<=30);
  assert(api.queryTokens('a'.repeat(1000000))[0].length<=160);assert.equal(api.search(index,'a',0).length,0);
});
check('location storage strips unknown properties and unknown IDs',()=>{
  const result=api.normalizeLocation({version:1,current:10001000,recent:[10001000,10002000,10002000,-1,'10003000',10003000,10004000,10005000],secret:'ignore'},maps);
  assert.deepEqual(plain(result),{version:1,current:10001000,recent:[10001000,10002000,10003000,10004000]});
  assert.deepEqual(plain(api.normalizeLocation({version:1,current:'10001000',recent:[10002000]},maps)),{version:1,current:null,recent:[10002000]});
});
check('location storage rejects wrong versions and malformed shapes',()=>{
  for(const value of [null,[],true,1,'text',{version:2,current:10001000},{version:'1',current:10001000}])assert.deepEqual(plain(api.normalizeLocation(value,maps)),{version:1,current:null,recent:[]});
  assert.deepEqual(plain(api.normalizeLocation({version:1,current:999999999,recent:{}},maps)),{version:1,current:null,recent:[]});
  const zero=new Map([[0,{id:0}],[1,{id:1}]]);assert.deepEqual(plain(api.normalizeLocation({version:1,current:0,recent:[1]},zero)),{version:1,current:0,recent:[0,1]});
});
check('location normalization returns copies and preserves newest four distinct maps',()=>{
  const input={version:1,current:10004000,recent:[10001000,10002000,10003000,10005000]},before=JSON.stringify(input);
  const result=api.normalizeLocation(input,maps);assert.equal(result.recent.length,4);assert.equal(result.recent[0],10004000);result.recent.push(99);assert.equal(JSON.stringify(input),before);
});
check('missing or unmapped monster and NPC locations never become invented destinations',()=>{
  const test={spawns:[{mapId:10001000,count:2},{mapId:10001000,count:1},{mapId:999999999,count:4},{mapId:10002000,count:0},{mapId:'10003000',count:1}]};
  assert.deepEqual(plain(api.entityMaps(test,'monster',maps)),[10001000]);
  assert.deepEqual(plain(api.entityMaps({maps:[{mapId:10001000,points:[]},{mapId:10002000,points:[{x:0,y:0}]}]},'npc',maps)),[10002000]);
  assert.deepEqual(plain(api.entityMaps(null,'npc',maps)),[]);
});
check('nearest destination uses weighted route cost instead of fewest passages',()=>{
  const calls=[],fake=(from,to,services)=>{calls.push([from,to,services]);return to===2?{cost:8,steps:[{}]}:{cost:3,steps:[{},{},{}]};};
  const best=api.nearest(1,[2,3],fake,true);assert.equal(best.id,3);assert.deepEqual(calls,[[1,2,true],[1,3,true]]);
});
check('nearest rejects unreachable and invalid estimates and breaks ties deterministically',()=>{
  const fake=(_,to)=>to===8?null:to===7?{cost:NaN,steps:[]}:to===6?{cost:-1,steps:[]}:{cost:4,steps:to===5?[{},{}]:[{}]};
  assert.equal(api.nearest(1,[8,7,6,5,4,3,3],fake).id,3);
  assert.equal(api.nearest(1,[8,7,6],fake),null);assert.equal(api.nearest('1',[3],fake),null);assert.equal(api.nearest(1,[3],fake,'false'),null);
});
check('real Stumpy route retains explicit origin and reaches its documented spawn map',()=>{
  const boss=matches('סטמפי')[0],candidates=api.entityMaps(boss.entry,boss.kind,maps),best=api.nearest(10001000,candidates,route,false);
  assert.equal(best?.id,10004057);assert.equal(best.route.from,10001000);assert.equal(best.route.to,10004057);assert(best.route.steps.length>1);assert(best.route.cost>0);
  assert(best.route.steps.every(step=>!step.service||step.service.walkable));
});
check('real nearest Slime selection agrees with full weighted comparison',()=>{
  const creature=matches('Slime').find(record=>record.name==='Slime'),candidates=api.entityMaps(creature.entry,creature.kind,maps);
  const best=api.nearest(10001000,candidates,route,false);assert(best);
  for(const id of candidates){const alternative=route(10001000,id,false);if(alternative)assert(best.route.cost<=alternative.cost);}
});
check('nearby monster summary includes only documented positive spawns in reachable maps',()=>{
  const nearby=[{id:10004057,hops:1}],summary=api.summarizeMonsters(nearby,catalog),stumpy=summary.find(monster=>monster.id===700007);
  assert(stumpy);assert.deepEqual(plain(stumpy.maps),[10004057]);assert.equal(stumpy.points,1);
  for(const monster of summary)assert(monster.maps.every(id=>nearby.some(map=>map.id===id)));
  assert.deepEqual(plain(api.summarizeMonsters([],catalog)),[]);
});
const failures=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
