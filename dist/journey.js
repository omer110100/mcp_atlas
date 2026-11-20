'use strict';
// Pure journey contracts and directed routing. No DOM, storage or network access.
(() => {
  const MAX_STOPS=8,MAX_TARGETS=8,MAX_MONSTERS=128,MAX_STEP=10000,MAX_AVOID_MAPS=32,MAX_AVOID_EDGES=32;
  // Product assumptions, not measured game speeds. One common coordinate scale
  // preserves distance differences between small and large maps.
  const COST_MODEL=Object.freeze({distanceUnitsPerCost:1000,unknownDistance:1000,unitsPerSecond:100,baseSeconds:3,ordinary:1,hidden:1.4,conditional:3.5});
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const validId=value=>Number.isSafeInteger(value)&&value>=0;
  const validEdgeKey=value=>typeof value==='string'&&value.length<=128&&/^(?:p:\d+:[A-Za-z0-9:_-]+|s:[A-Za-z0-9:_-]+)$/.test(value);
  const point=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y);

  function normalizeGoal(value){
    if(!object(value)||value.kind!=='hunt'||!Array.isArray(value.targets)||!value.targets.length||value.targets.length>MAX_TARGETS||!Array.isArray(value.monsterIds)||value.monsterIds.length>MAX_MONSTERS)return null;
    if(value.targets.some(target=>!object(target)||!['item','monster','boss'].includes(target.kind)||!validId(target.id))||value.monsterIds.some(id=>!validId(id)))return null;
    const seen=new Set(),targets=[];
    for(const target of value.targets){const key=`${target.kind}:${target.id}`;if(!seen.has(key)){seen.add(key);targets.push({kind:target.kind,id:target.id});}}
    return {kind:'hunt',targets,monsterIds:[...new Set(value.monsterIds)]};
  }
  function normalizeAvoidance(value,maps){
    if(!object(value))return null;
    const avoidMaps=value.avoidMaps===undefined?[]:value.avoidMaps,avoidEdges=value.avoidEdges===undefined?[]:value.avoidEdges;
    if(!Array.isArray(avoidMaps)||avoidMaps.length>MAX_AVOID_MAPS||avoidMaps.some(id=>!validId(id)||!maps.has(id))||!Array.isArray(avoidEdges)||avoidEdges.length>MAX_AVOID_EDGES||avoidEdges.some(key=>!validEdgeKey(key)))return null;
    // Unknown but well-formed keys have no effect; they never become destinations.
    return {avoidMaps:[...new Set(avoidMaps)],avoidEdges:[...new Set(avoidEdges)]};
  }
  function normalizeRecipe(value,maps){
    if(!object(value)||!validId(value.from)||!validId(value.to)||!maps.has(value.from)||!maps.has(value.to))return null;
    const stops=value.stops??[],services=value.services??false,step=value.step??0;
    if(!Array.isArray(stops)||stops.length>MAX_STOPS||stops.some(id=>!validId(id)||!maps.has(id))||typeof services!=='boolean'||!Number.isInteger(step)||step<0||step>MAX_STEP)return null;
    const goal=value.goal==null?null:normalizeGoal(value.goal),avoidance=normalizeAvoidance(value,maps);
    if((value.goal!=null&&!goal)||!avoidance)return null;
    const recipe={from:value.from,to:value.to,stops:[...stops],services,step,...(goal?{goal}:{}),...(avoidance.avoidMaps.length?{avoidMaps:avoidance.avoidMaps}:{}),...(avoidance.avoidEdges.length?{avoidEdges:avoidance.avoidEdges}:{})};
    // Leave headroom for field names, dataset version and progress inside the
    // 8,192-character shared-link boundary, including percent expansion.
    if(encodeURIComponent(JSON.stringify(recipe)).length>7000)return null;
    return recipe;
  }
  function edgeKey(step){
    if(step?.p&&validId(step.from))return `p:${step.from}:${step.p.key}`;
    return step?.service?`s:${step.service.id}`:'';
  }
  function confirmedArrival(step,maps){
    const map=maps.get(step?.to),source=step?.p;
    if(!map||!source||source.kind!=='cross'||source.to!==step.to||!source.toPortal)return {portal:null,index:-1,reason:'unrecorded'};
    const matches=[];
    for(let i=0;i<(map.portals||[]).length;i++)if(map.portals[i].name===source.toPortal)matches.push(i);
    return matches.length===1?{portal:map.portals[matches[0]],index:matches[0],reason:'confirmed'}:{portal:null,index:-1,reason:matches.length?'ambiguous':'unrecorded'};
  }
  function routingContext(graph,services,avoidance){
    const options=new Map(),blockedMaps=new Set(avoidance.avoidMaps),blockedEdges=new Set(avoidance.avoidEdges);
    const asOf=new Date(`${graph.asOf}T00:00:00Z`).getTime();
    for(const [id,edges] of graph.adjacency)options.set(id,edges.filter(edge=>edge.p?.kind==='cross').map(edge=>({from:id,to:edge.to,p:edge.p})));
    for(const service of graph.services||[]){
      if(!(service.routeAllowed??service.route_allowed)||service.to==null||(!services&&service.walkable!==true))continue;
      if(service.active_until_utc){const expiry=new Date(service.active_until_utc).getTime();if(!Number.isFinite(expiry)||!Number.isFinite(asOf)||expiry<asOf)continue;}
      const list=options.get(service.from)||[];list.push({from:service.from,to:service.to,service});options.set(service.from,list);
    }
    for(const [id,edges] of options)options.set(id,edges.filter(edge=>graph.maps.has(edge.to)&&!blockedMaps.has(edge.to)&&!blockedEdges.has(edgeKey(edge))).sort((a,b)=>edgeKey(a).localeCompare(edgeKey(b),'en')));
    return {blockedMaps,options};
  }
  function nextOrigin(step,origin){
    const service=step.service;
    if(service?.requires_state?.florina_origin&&origin!==service.requires_state.florina_origin)return undefined;
    return service?.stores_state==='florina_origin'?service.from:origin;
  }
  function edgeCost(step,entry,isStart){
    const service=step.service,exit=step.p||service;
    const baseCost=service?(service.walkable===true?COST_MODEL.hidden:COST_MODEL.conditional):step.p.noEffect||[1,10].includes(step.p.type)?COST_MODEL.hidden:COST_MODEL.ordinary;
    const distance=point(entry)&&point(exit)?Math.hypot(exit.x-entry.x,exit.y-entry.y):null;
    const unknownDistance=distance===null&&!isStart;
    const walkCost=(distance??(unknownDistance?COST_MODEL.unknownDistance:0))/COST_MODEL.distanceUnitsPerCost;
    return {baseCost,walkCost,distance,unknownDistance,cost:baseCost+walkCost};
  }
  class MinHeap{
    constructor(){this.items=[];}
    before(a,b){return a.cost<b.cost||(a.cost===b.cost&&(a.hops<b.hops||(a.hops===b.hops&&a.order<b.order)));}
    push(item){const items=this.items;let index=items.length;items.push(item);while(index){const parent=(index-1)>>1;if(!this.before(item,items[parent]))break;items[index]=items[parent];index=parent;}items[index]=item;}
    pop(){const items=this.items,first=items[0],last=items.pop();if(items.length){let index=0;while(index*2+1<items.length){let child=index*2+1;if(child+1<items.length&&this.before(items[child+1],items[child]))child++;if(!this.before(items[child],last))break;items[index]=items[child];index=child;}items[index]=last;}return first;}
    get length(){return this.items.length;}
  }
  function routeMetrics(steps){
    const walkingDistance=steps.reduce((total,step)=>total+(step.distance??0),0);
    const unknownDistanceSegments=steps.filter(step=>step.unknownDistance).length;
    const knownDistanceSegments=steps.filter(step=>step.distance!==null).length;
    const assumedWalkingDistance=walkingDistance+unknownDistanceSegments*COST_MODEL.unknownDistance;
    const baseCost=steps.reduce((total,step)=>total+step.baseCost,0);
    const seconds=assumedWalkingDistance/COST_MODEL.unitsPerSecond+baseCost*COST_MODEL.baseSeconds;
    return {cost:steps.reduce((total,step)=>total+step.cost,0),walkingDistance,knownDistanceSegments,unknownDistanceSegments,estimatedMinutes:seconds/60,
      estimate:{kind:'heuristic',unitsPerSecond:COST_MODEL.unitsPerSecond,baseSeconds:COST_MODEL.baseSeconds,unknownDistance:COST_MODEL.unknownDistance,assumedWalkingDistance,initialWalkExcluded:steps.length>0,terrain:'straight-line',waitingTimeIncluded:false}};
  }
  function findRoute(graph,from,to,services=false,stops=[],options={}){
    if(!object(options))return null;
    const recipe=normalizeRecipe({...options,from,to,services,stops},graph.maps);if(!recipe)return null;
    const context=routingContext(graph,services,normalizeAvoidance(recipe,graph.maps));
    const waypoints=[...recipe.stops,to];if(context.blockedMaps.has(from)||waypoints.some(id=>context.blockedMaps.has(id)))return null;
    const advance=(id,index)=>{while(index<waypoints.length&&waypoints[index]===id)index++;return index;};
    const keyOf=state=>`${state.id}:${state.origin??''}:${state.next}:${state.entryIndex}`;
    let order=0;
    const start={id:from,origin:null,next:advance(from,0),entry:null,entryIndex:-1,cost:0,hops:0,order:order++,previous:null};start.key=keyOf(start);
    const queue=new MinHeap(),best=new Map([[start.key,start]]);queue.push(start);let found=null;
    while(queue.length){
      const item=queue.pop();if(best.get(item.key)!==item)continue;
      if(item.next===waypoints.length){found=item;break;}
      for(const step of context.options.get(item.id)||[]){
        const origin=nextOrigin(step,item.origin);if(origin===undefined)continue;
        const arrival=confirmedArrival(step,graph.maps),weight=edgeCost(step,item.entry,item.hops===0);
        const next={id:step.to,origin,next:advance(step.to,item.next),entry:arrival.portal,entryIndex:arrival.index,cost:item.cost+weight.cost,hops:item.hops+1,order:order++,previous:item,
          step:{...step,...weight,edgeKey:edgeKey(step)}};next.key=keyOf(next);
        const old=best.get(next.key);if(old&&(old.cost<next.cost||(old.cost===next.cost&&old.hops<=next.hops)))continue;
        best.set(next.key,next);queue.push(next);
      }
    }
    if(!found)return null;
    const steps=[];for(let node=found;node.previous;node=node.previous)steps.push(node.step);steps.reverse();
    const path=[from,...steps.map(step=>step.to)],waypointSteps=[];let index=0;
    for(const stop of recipe.stops){while(index<path.length&&path[index]!==stop)index++;waypointSteps.push(index);}
    return {from,to,stops:[...recipe.stops],steps,waypointSteps,...(recipe.avoidMaps?{avoidMaps:recipe.avoidMaps}:{}),...(recipe.avoidEdges?{avoidEdges:recipe.avoidEdges}:{}),...routeMetrics(steps)};
  }
  function reachable(graph,from,maxHops=3,services=false,options={}){
    if(!validId(from)||!graph.maps.has(from)||!Number.isInteger(maxHops)||maxHops<1||maxHops>3||typeof services!=='boolean')return [];
    const avoidance=normalizeAvoidance(options,graph.maps);if(!avoidance)return [];
    const context=routingContext(graph,services,avoidance);if(context.blockedMaps.has(from))return [];
    const queue=[{id:from,origin:null,hops:0}],seen=new Set([`${from}:`]),distances=new Map();
    for(let index=0;index<queue.length;index++){
      const item=queue[index];if(item.hops===maxHops)continue;
      for(const step of context.options.get(item.id)||[]){
        const origin=nextOrigin(step,item.origin);if(origin===undefined)continue;
        const key=`${step.to}:${origin??''}`,hops=item.hops+1;if(seen.has(key))continue;
        seen.add(key);queue.push({id:step.to,origin,hops});
        if(step.to!==from&&!distances.has(step.to))distances.set(step.to,hops);
      }
    }
    return [...distances].map(([id,hops])=>({id,hops})).sort((a,b)=>a.hops-b.hops||a.id-b.id);
  }
  function arrivalInfo(route,index,maps){
    if(!route||!Number.isInteger(index)||index<=0||index>route.steps.length)return {portal:null,reason:'start'};
    const result=confirmedArrival(route.steps[index-1],maps);return {portal:result.portal,reason:result.reason};
  }
  const remainingStops=(route,index)=>(route?.stops||[]).filter((_,i)=>(route.waypointSteps?.[i]??Infinity)>index);
  const pathSignature=route=>route?JSON.stringify(route.steps.map(step=>[step.from,step.to,step.p?.key||step.service?.id||''])):null;
  globalThis.AtlasJourney={MAX_STOPS,MAX_TARGETS,MAX_MONSTERS,MAX_AVOID_MAPS,MAX_AVOID_EDGES,COST_MODEL,normalizeGoal,normalizeRecipe,findRoute,reachable,edgeKey,arrivalInfo,remainingStops,pathSignature};
})();
