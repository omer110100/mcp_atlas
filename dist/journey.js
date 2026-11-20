'use strict';
// Pure journey contracts and directed routing. No DOM, storage or network access.
(() => {
  const MAX_STOPS=8,MAX_TARGETS=8,MAX_MONSTERS=128,MAX_STEP=10000;
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const validId=value=>Number.isSafeInteger(value)&&value>=0;
  function normalizeGoal(value){
    if(!object(value)||value.kind!=='hunt'||!Array.isArray(value.targets)||!value.targets.length||value.targets.length>MAX_TARGETS||!Array.isArray(value.monsterIds)||value.monsterIds.length>MAX_MONSTERS)return null;
    if(value.targets.some(target=>!object(target)||!['item','monster','boss'].includes(target.kind)||!validId(target.id))||value.monsterIds.some(id=>!validId(id)))return null;
    const seen=new Set(),targets=[];
    for(const target of value.targets){const key=`${target.kind}:${target.id}`;if(!seen.has(key)){seen.add(key);targets.push({kind:target.kind,id:target.id});}}
    return {kind:'hunt',targets,monsterIds:[...new Set(value.monsterIds)]};
  }
  function normalizeRecipe(value,maps){
    if(!object(value)||!validId(value.from)||!validId(value.to)||!maps.has(value.from)||!maps.has(value.to))return null;
    const stops=value.stops??[],services=value.services??false,step=value.step??0;
    if(!Array.isArray(stops)||stops.length>MAX_STOPS||stops.some(id=>!validId(id)||!maps.has(id))||typeof services!=='boolean'||!Number.isInteger(step)||step<0||step>MAX_STEP)return null;
    const goal=value.goal==null?null:normalizeGoal(value.goal);if(value.goal!=null&&!goal)return null;
    return {from:value.from,to:value.to,stops:[...stops],services,step,...(goal?{goal}:{})};
  }
  function findRoute(graph,from,to,services=false,stops=[]){
    const recipe=normalizeRecipe({from,to,services,stops},graph.maps);if(!recipe)return null;
    const waypoints=[...recipe.stops,to],servicesByMap=new Map();
    for(const service of graph.services||[]){const list=servicesByMap.get(service.from)||[];list.push(service);servicesByMap.set(service.from,list);}
    const advance=(id,index)=>{while(index<waypoints.length&&waypoints[index]===id)index++;return index;};
    const start={id:from,origin:null,next:advance(from,0)},keyOf=state=>`${state.id}:${state.origin}:${state.next}`;
    const queue=[start],seen=new Set([keyOf(start)]),previous=new Map();let found=null;
    const asOf=new Date(graph.asOf+'T00:00:00Z').getTime();
    for(let cursor=0;cursor<queue.length;cursor++){
      const item=queue[cursor],key=keyOf(item);if(item.next===waypoints.length){found=key;break;}
      const options=[...(graph.adjacency.get(item.id)||[])];
      for(const service of servicesByMap.get(item.id)||[])if((service.routeAllowed??service.route_allowed)&&service.to!=null&&(services||service.walkable===true))options.push({to:service.to,service});
      for(const option of options){
        if(!graph.maps.has(option.to))continue;
        const service=option.service;let origin=item.origin;
        if(service?.active_until_utc&&new Date(service.active_until_utc).getTime()<asOf)continue;
        if(service?.requires_state?.florina_origin&&origin!==service.requires_state.florina_origin)continue;
        if(service?.stores_state==='florina_origin')origin=service.from;
        const next={id:option.to,origin,next:advance(option.to,item.next)},nextKey=keyOf(next);
        if(seen.has(nextKey))continue;
        seen.add(nextKey);previous.set(nextKey,{key,from:item.id,to:option.to,p:option.p,service});queue.push(next);
      }
    }
    if(found===null)return null;
    const steps=[];while(previous.has(found)){const step=previous.get(found);steps.push(step);found=step.key;}steps.reverse();
    const path=[from,...steps.map(step=>step.to)],waypointSteps=[];let index=0;
    for(const stop of recipe.stops){while(path[index]!==stop)index++;waypointSteps.push(index);}
    return {from,to,stops:[...recipe.stops],steps,waypointSteps};
  }
  function arrivalInfo(route,index,maps){
    if(!route||!Number.isInteger(index)||index<=0||index>route.steps.length)return {portal:null,reason:'start'};
    const step=route.steps[index-1],map=maps.get(step.to),source=step.p;
    if(!map||!source||source.kind!=='cross'||source.to!==step.to||!source.toPortal)return {portal:null,reason:'unrecorded'};
    const matches=map.portals.filter(portal=>portal.name===source.toPortal);
    return matches.length===1?{portal:matches[0],reason:'confirmed'}:{portal:null,reason:matches.length?'ambiguous':'unrecorded'};
  }
  const remainingStops=(route,index)=>(route?.stops||[]).filter((_,i)=>(route.waypointSteps?.[i]??Infinity)>index);
  const pathSignature=route=>route?JSON.stringify(route.steps.map(step=>[step.from,step.to,step.p?.key||step.service?.id||''])):null;
  globalThis.AtlasJourney={MAX_STOPS,MAX_TARGETS,MAX_MONSTERS,normalizeGoal,normalizeRecipe,findRoute,arrivalInfo,remainingStops,pathSignature};
})();
