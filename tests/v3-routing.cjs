'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'dist/journey.js'),'utf8'),context);
const journey=context.AtlasJourney,results=[];
const check=(name,run)=>{try{run();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const plain=value=>JSON.parse(JSON.stringify(value));
function graph(ids){return {maps:new Map(ids.map(id=>[id,{id,width:100,height:100,portals:[]}])),adjacency:new Map(ids.map(id=>[id,[]])),services:[],asOf:'2026-11-19'};}
function entry(g,id,name,x=0,y=0){const portal={key:`${id}:${name}`,name,x,y,kind:'unknown'};g.maps.get(id).portals.push(portal);return portal;}
function connect(g,from,to,key,target,x=0,y=0,extra={}){const p={key:`${from}:${key}`,name:key,kind:'cross',type:2,noEffect:false,to,toPortal:target,x,y,...extra};g.maps.get(from).portals.push(p);g.adjacency.get(from).push({to,p});return p;}
const route=(g,from,to,options={})=>journey.findRoute(g,from,to,options.services??false,options.stops??[],options);

const diamond=graph([1,2,3,4]);
entry(diamond,2,'left',0);entry(diamond,2,'right',10000);entry(diamond,3,'entry');entry(diamond,4,'entry');
connect(diamond,1,2,'direct','left');connect(diamond,1,3,'detour','entry');connect(diamond,3,2,'right-entry','right');connect(diamond,2,4,'finish','entry',10000);
check('Dijkstra keeps different arrival gates and chooses three cheap transitions over two expensive ones',()=>{
  const result=route(diamond,1,4);assert.deepEqual(plain(result.steps.map(step=>step.to)),[3,2,4]);close(result.cost,3);close(result.walkingDistance,0);
});
check('removing the cheap entry forces the valid longer intra-map walk',()=>{
  const result=route(diamond,1,4,{avoidMaps:[3]});assert.deepEqual(plain(result.steps.map(step=>step.to)),[2,4]);close(result.cost,12);close(result.walkingDistance,10000);
});
check('excluding one directed portal selects another path and retains the exclusion',()=>{
  const key=journey.edgeKey({from:1,p:diamond.maps.get(1).portals.find(p=>p.name==='detour')}),result=route(diamond,1,4,{avoidEdges:[key]});
  assert.ok(result.steps.every(step=>step.edgeKey!==key));assert.deepEqual(plain(result.avoidEdges),[key]);close(result.cost,12);
});
check('a map exclusion cannot silently remove an endpoint or ordered waypoint',()=>{
  assert.equal(route(diamond,1,4,{avoidMaps:[1]}),null);assert.equal(route(diamond,1,4,{avoidMaps:[4]}),null);assert.equal(route(diamond,1,4,{stops:[3],avoidMaps:[3]}),null);
});
check('weighted waypoints are visited in order while retaining arrival state',()=>{
  const result=route(diamond,1,4,{stops:[3,2]});assert.deepEqual(plain(result.waypointSteps),[1,2]);close(result.cost,3);
});

const measured=graph([1,2,3]);entry(measured,2,'entry',10,20);entry(measured,3,'entry');connect(measured,1,2,'start','entry');connect(measured,2,3,'end','entry',3010,4020);
check('distance uses original-coordinate Euclidean length on a shared scale',()=>{
  const result=route(measured,1,3);close(result.steps[1].distance,5000);close(result.steps[1].walkCost,5);close(result.cost,7);
  measured.maps.get(2).width=100000;measured.maps.get(2).height=100000;close(route(measured,1,3).cost,7);
});
check('route time states all assumptions and does not pretend to include initial positioning or queues',()=>{
  const result=route(measured,1,3);close(result.estimatedMinutes,56/60);assert.equal(result.knownDistanceSegments,1);assert.equal(result.unknownDistanceSegments,0);
  assert.deepEqual(plain(result.estimate),{kind:'heuristic',unitsPerSecond:100,baseSeconds:3,unknownDistance:1000,assumedWalkingDistance:5000,initialWalkExcluded:true,terrain:'straight-line',waitingTimeIncluded:false});
});
check('zero-hop journey has zero cost and no invented walking estimate',()=>{
  const result=route(measured,1,1);close(result.cost,0);close(result.estimatedMinutes,0);assert.equal(result.estimate.initialWalkExcluded,false);
});

const missing=graph([1,2,3]);connect(missing,1,2,'start','missing');connect(missing,2,3,'end','missing',100,100);
check('unknown arrival uses an explicit assumed segment without fabricating measured distance',()=>{
  const result=route(missing,1,3);assert.equal(result.walkingDistance,0);assert.equal(result.unknownDistanceSegments,1);assert.equal(result.knownDistanceSegments,0);assert.equal(result.steps[1].distance,null);close(result.cost,3);assert.equal(journey.arrivalInfo(result,1,missing.maps).portal,null);
});
check('ambiguous destination names remain unknown for cost and marker placement',()=>{
  entry(missing,2,'missing',0);entry(missing,2,'missing',1000);
  const result=route(missing,1,3);assert.equal(result.unknownDistanceSegments,1);assert.equal(journey.arrivalInfo(result,1,missing.maps).reason,'ambiguous');
});

const types=graph([1,2,3,4,5]);entry(types,2,'entry');entry(types,3,'entry');
connect(types,1,2,'normal','entry');connect(types,1,3,'door','entry',0,0,{type:1,noEffect:true});
types.services.push({id:'boat',from:1,to:4,routeAllowed:true},{id:'documented',from:1,to:5,routeAllowed:true,walkable:true,kind:'documented_portal',x:0,y:0});
check('base weights distinguish normal gates, doors, conditional services and documented hidden walking gates',()=>{
  close(route(types,1,2).cost,1);close(route(types,1,3).cost,1.4);close(route(types,1,4,{services:true}).cost,3.5);close(route(types,1,5).cost,1.4);assert.equal(route(types,1,4),null);
});
check('a specific conditional service can be avoided without mutating the source',()=>{
  assert.equal(route(types,1,4,{services:true,avoidEdges:['s:boat']}),null);assert.ok(route(types,1,4,{services:true}));assert.equal(types.services.length,2);
});
check('expired or malformed expiry services are excluded in routing and reachability',()=>{
  const g=graph([1,2,3]);g.services.push({id:'expired',from:1,to:2,routeAllowed:true,active_until_utc:'2026-11-18T23:59:00Z'},{id:'bad-date',from:1,to:3,routeAllowed:true,active_until_utc:'bad-date'});
  assert.equal(route(g,1,2,{services:true}),null);assert.equal(route(g,1,3,{services:true}),null);assert.deepEqual(plain(journey.reachable(g,1,3,true)),[]);
});
check('ties are deterministic even when source adjacency order changes',()=>{
  const g=graph([1,2,3,4]);for(const id of [2,3,4])entry(g,id,'entry');
  connect(g,1,2,'z','entry');connect(g,1,3,'a','entry');connect(g,2,4,'end','entry');connect(g,3,4,'end','entry');
  const first=journey.pathSignature(route(g,1,4));g.adjacency.get(1).reverse();assert.equal(journey.pathSignature(route(g,1,4)),first);
});
check('equal total cost prefers fewer map transitions',()=>{
  const g=graph([1,2,3,4,5]);for(const id of [2,3,4,5])entry(g,id,'entry');
  connect(g,1,3,'a-longer','entry');connect(g,3,4,'middle','entry');connect(g,4,5,'end','entry');
  connect(g,1,2,'z-shorter','entry');connect(g,2,5,'end','entry',1000);
  const result=route(g,1,5);close(result.cost,3);assert.equal(result.steps.length,2);
});

check('avoidance boundaries reject unknown maps, oversized inputs and noncanonical edge keys',()=>{
  for(const options of [{avoidMaps:null},{avoidEdges:null},{avoidMaps:[999]},{avoidMaps:['1']},{avoidMaps:Array(33).fill(2)},{avoidEdges:Array(33).fill('s:boat')},{avoidEdges:['<script>']},{avoidEdges:['p:1:bad key']},{avoidEdges:['s:'+'a'.repeat(127)]},{avoidEdges:[12]}])assert.equal(route(types,1,2,options),null);
});
check('valid exclusions are copied and deduplicated while arbitrary fields are discarded',()=>{
  const raw={from:1,to:2,avoidMaps:[3,3],avoidEdges:['s:boat','s:boat'],secret:'not retained'},normalized=journey.normalizeRecipe(raw,types.maps);
  raw.avoidMaps.push(4);assert.deepEqual(plain(normalized.avoidMaps),[3]);assert.deepEqual(plain(normalized.avoidEdges),['s:boat']);assert.equal(normalized.secret,undefined);
});
check('unknown but syntactically valid exclusions have no routing authority',()=>{
  assert.equal(journey.pathSignature(route(types,1,2,{avoidEdges:['s:no-such-service','p:1:no-such-portal']})),journey.pathSignature(route(types,1,2)));
});
check('reachability counts transitions rather than weighted cost and excludes the origin',()=>{
  assert.deepEqual(plain(journey.reachable(diamond,1,1)),[{id:2,hops:1},{id:3,hops:1}]);
  assert.deepEqual(plain(journey.reachable(diamond,1,2)),[{id:2,hops:1},{id:3,hops:1},{id:4,hops:2}]);
});
check('reachability honors exclusions, navigation policy and a strict one-to-three bound',()=>{
  assert.deepEqual(plain(journey.reachable(diamond,1,3,false,{avoidMaps:[2]})),[{id:3,hops:1}]);
  assert.ok(!journey.reachable(types,1,1).some(item=>item.id===4));assert.ok(journey.reachable(types,1,1,true).some(item=>item.id===4));
  for(const hops of [0,4,1.5,'2'])assert.deepEqual(plain(journey.reachable(types,1,hops)),[]);
});

const atlas=JSON.parse(fs.readFileSync(path.join(root,'dist/atlas-data.json'),'utf8')),maps=new Map(atlas.maps.map(map=>[map.id,map]));
const real={maps,adjacency:new Map(atlas.maps.map(map=>[map.id,map.portals.filter(p=>p.kind==='cross').map(p=>({to:p.to,p}))])),services:atlas.services,asOf:atlas.meta.asOf};
const snapshot=JSON.stringify(atlas),henesys=10001000,perion=10004000,ellinia=10002000;
const validate=result=>{
  assert.ok(result);let from=result.from;
  result.steps.forEach(step=>{assert.equal(step.from,from);assert.ok(maps.has(step.to));assert.ok(step.p?maps.get(from).portals.includes(step.p)&&step.p.to===step.to:atlas.services.includes(step.service));assert.ok(Number.isFinite(step.cost)&&step.cost>0);from=step.to;});assert.equal(from,result.to);
};
check('Henesys to Perion and Ellinia have valid weighted routes and finite explicit estimates under both policies',()=>{
  for(const to of [perion,ellinia])for(const services of [false,true]){const result=route(real,henesys,to,{services});validate(result);assert.ok(result.walkingDistance>0&&Number.isFinite(result.estimatedMinutes));assert.ok(result.knownDistanceSegments>0);}
});
check('real route distance equals an independent sum of confirmed source coordinate differences',()=>{
  const result=route(real,henesys,perion);let measured=0;
  for(let index=1;index<result.steps.length;index++){
    const incoming=result.steps[index-1],exit=result.steps[index],matches=maps.get(exit.from).portals.filter(portal=>portal.name===incoming.p?.toPortal);
    if(incoming.p&&matches.length===1&&exit.p)measured+=Math.hypot(exit.p.x-matches[0].x,exit.p.y-matches[0].y);
  }close(result.walkingDistance,measured);
});
check('bypassing an actual Henesys–Perion intermediate map finds a valid route excluding it',()=>{
  const first=route(real,henesys,perion),avoid=first.steps[0].to,replanned=route(real,henesys,perion,{avoidMaps:[avoid]});validate(replanned);assert.ok(!replanned.steps.some(step=>step.to===avoid||step.from===avoid));assert.notEqual(journey.pathSignature(first),journey.pathSignature(replanned));
});
check('bypassing an actual exit portal finds another valid directed route',()=>{
  const first=route(real,henesys,perion),avoid=journey.edgeKey(first.steps[0]),replanned=route(real,henesys,perion,{avoidEdges:[avoid]});validate(replanned);assert.ok(replanned.steps.every(step=>journey.edgeKey(step)!==avoid));
});
check('Florina service state survives ordered stops but is never fabricated at route start',()=>{
  const result=route(real,10000000,10000000,{services:true,stops:[10007000]});validate(result);assert.equal(result.steps[1].service.id,'boat-florina-lith');assert.equal(route(real,10007000,10000000,{services:true}),null);assert.ok(!journey.reachable(real,10007000,3,true).some(item=>item.id===10000000));
});
check('every real reachable result has an independently verifiable path within its hop bound',()=>{
  const found=journey.reachable(real,henesys,3),distances=new Map([[henesys,0]]),queue=[henesys];
  for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor],hops=distances.get(id);if(hops===3)continue;for(const edge of real.adjacency.get(id)){if(!distances.has(edge.to)){distances.set(edge.to,hops+1);queue.push(edge.to);}}}
  assert.equal(found.length,distances.size-1);for(const item of found)assert.equal(item.hops,distances.get(item.id));
});
check('routing and reachability leave all source maps, coordinates, gates and services unchanged',()=>assert.equal(JSON.stringify(atlas),snapshot));
check('bounded but heavily encoded exclusions cannot create an unshareable recipe',()=>{
  const avoidEdges=Array.from({length:32},(_,index)=>'s:'+':'.repeat(120)+index);
  assert.equal(journey.normalizeRecipe({from:henesys,to:perion,avoidEdges},real.maps),null);
});

const failures=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
