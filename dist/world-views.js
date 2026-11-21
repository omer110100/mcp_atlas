'use strict';
// Presentation coordinates only. Source map, portal and spawn coordinates stay untouched.
(() => {
  /** @typedef {{x:number,y:number}} Point */
  const modes=Object.freeze(['atlas','metro','celestial','board']);
  const GAP=64, MARGIN=96, MAX_ROW=3080;
  const round=value=>Math.round(value*100)/100;
  const idOrder=(a,b)=>Number(Boolean(b.major))-Number(Boolean(a.major))||Number(Boolean(b.isTown))-Number(Boolean(a.isTown))||a.id-b.id;

  function records(atlas){
    if(!atlas||!Array.isArray(atlas.maps)||!Array.isArray(atlas.groups))throw new TypeError('Atlas maps and groups are required.');
    const ids=new Set();
    for(const map of atlas.maps){
      if(!Number.isSafeInteger(map.id)||map.id<0||ids.has(map.id)||typeof map.group!=='string')throw new TypeError('Every map needs a unique numeric ID and a group.');
      ids.add(map.id);
    }
    const groups=new Map();
    for(const group of atlas.groups){
      if(group&&typeof group.id==='string'&&!groups.has(group.id))groups.set(group.id,group);
    }
    // Keep new source regions visible even before they receive a designed arrangement.
    for(const id of [...new Set(atlas.maps.map(map=>map.group))].sort())if(!groups.has(id))groups.set(id,{id,color:'#9fbab4'});
    return [...groups.values()].map(group=>({group,maps:atlas.maps.filter(map=>map.group===group.id).sort(idOrder)})).filter(entry=>entry.maps.length);
  }

  function orderedMaps(maps){
    // Undirected breadth-first order is a visual aid only, never a routing graph.
    const byId=new Map(maps.map(map=>[map.id,map])),neighbors=new Map(maps.map(map=>[map.id,new Set()]));
    for(const map of maps)for(const portal of map.portals||[]){
      if(portal.kind!=='cross'||portal.to===map.id||!byId.has(portal.to))continue;
      neighbors.get(map.id).add(portal.to);neighbors.get(portal.to).add(map.id);
    }
    const visited=new Set(),ordered=[];
    for(const start of maps){
      if(visited.has(start.id))continue;
      const queue=[start];visited.add(start.id);
      for(let index=0;index<queue.length;index++){
        const map=queue[index];ordered.push(map);
        const next=[...neighbors.get(map.id)].map(id=>byId.get(id)).sort(idOrder);
        for(const neighbor of next)if(!visited.has(neighbor.id)){visited.add(neighbor.id);queue.push(neighbor);}
      }
    }
    return ordered;
  }

  function localPanel(mode,group,maps){
    const ordered=orderedMaps(maps),count=ordered.length,points=new Map();
    const cover=maps.find(map=>map.major&&(map.minimap||map.image))||maps.find(map=>map.minimap||map.image);
    const panel={id:group.id,groupId:group.id,color:group.color||'#9fbab4',count,mapIds:ordered.map(map=>map.id),thumbnail:cover?.minimap||cover?.image||null,thumbnailMapId:cover?.id??null};
    if(mode==='celestial'){
      panel.shape='orbit';panel.orbitRadii=[];
      const rings=[];let remaining=Math.max(0,count-1),radius=126;
      while(remaining){const capacity=Math.max(6,Math.floor(2*Math.PI*radius/84)),size=Math.min(remaining,capacity);rings.push({radius,size});panel.orbitRadii.push(radius);remaining-=size;radius+=112;}
      const extent=(rings.at(-1)?.radius||72)+76;
      panel.width=extent*2;panel.height=extent*2+80;panel.cx=extent;panel.cy=extent+56;panel.rx=extent;panel.ry=extent;
      points.set(ordered[0].id,{x:panel.cx,y:panel.cy});
      let index=1;
      rings.forEach((ring,ringIndex)=>{for(let slot=0;slot<ring.size;slot++){
        const angle=-Math.PI/2+(slot+.5*(ringIndex%2))*Math.PI*2/ring.size;
        points.set(ordered[index++].id,{x:round(panel.cx+Math.cos(angle)*ring.radius),y:round(panel.cy+Math.sin(angle)*ring.radius)});
      }});
      panel.titleX=panel.cx;panel.titleY=32;
    }else{
      const metro=mode==='metro',columns=Math.min(metro?8:7,Math.max(3,Math.ceil(Math.sqrt(count*(metro?1.6:1.1))))),rows=Math.ceil(count/columns);
      const spacingX=metro?108:112,spacingY=metro?112:120,header=metro?130:138,padding=66;
      panel.shape=metro?'lane':'card';panel.width=padding*2+(columns-1)*spacingX;panel.height=header+(rows-1)*spacingY+94;
      panel.cx=panel.width/2;panel.cy=panel.height/2;panel.rx=panel.width/2;panel.ry=panel.height/2;
      panel.titleX=metro?padding:panel.width/2;panel.titleY=metro?36:48;panel.headerHeight=metro?64:96;
      panel.tracks=[];
      ordered.forEach((map,index)=>{
        const row=Math.floor(index/columns),slot=index%columns,column=metro&&row%2?columns-1-slot:slot;
        points.set(map.id,{x:padding+column*spacingX,y:header+row*spacingY});
      });
      if(metro)for(let row=0;row<rows;row++){
        const size=Math.min(columns,count-row*columns),left=padding+(row%2?columns-size:0)*spacingX,right=left+(size-1)*spacingX,y=header+row*spacingY;
        panel.tracks.push({x1:left,y1:y,x2:right,y2:y});
        if(row<rows-1){const end=row%2?left:right;panel.tracks.push({x1:end,y1:y,x2:end,y2:y+spacingY});}
      }
    }
    return {panel,points};
  }

  function translatePanel(local,x,y){
    const panel={...local.panel,x,y,cx:round(local.panel.cx+x),cy:round(local.panel.cy+y),titleX:round(local.panel.titleX+x),titleY:round(local.panel.titleY+y)};
    if(panel.tracks)panel.tracks=panel.tracks.map(track=>({x1:track.x1+x,y1:track.y1+y,x2:track.x2+x,y2:track.y2+y}));
    return panel;
  }

  function getBounds(positions,panels){
    if(!positions.size)return {x:0,y:0,width:1,height:1,minX:0,minY:0,maxX:1,maxY:1};
    const points=[...positions.values()];
    const minX=Math.min(...points.map(point=>point.x-64),...panels.map(panel=>panel.x));
    const minY=Math.min(...points.map(point=>point.y-64),...panels.map(panel=>panel.y));
    const maxX=Math.max(...points.map(point=>point.x+64),...panels.map(panel=>panel.x+panel.width));
    const maxY=Math.max(...points.map(point=>point.y+84),...panels.map(panel=>panel.y+panel.height));
    return {x:minX,y:minY,width:maxX-minX,height:maxY-minY,minX,minY,maxX,maxY};
  }

  /** Derive a complete, deterministic view. Unknown preferences safely use the original atlas. */
  function createLayout(requestedMode,atlas,options={}){
    const mode=modes.includes(requestedMode)?requestedMode:'atlas',entries=records(atlas),positions=new Map(),panels=[];
    const aspectRatio=options?.aspectRatio;
    const rowWidth=Number.isFinite(aspectRatio)&&aspectRatio>0?(aspectRatio>=1.5?4600:aspectRatio<1?2500:MAX_ROW):MAX_ROW;
    if(mode==='atlas'){
      for(const map of atlas.maps){
        if(!Number.isFinite(map.x)||!Number.isFinite(map.y))throw new TypeError('Original atlas positions must be finite.');
        positions.set(map.id,{x:map.x,y:map.y});
      }
    }else{
      // Shelf packing keeps related maps together without runtime force simulations.
      let x=MARGIN,y=MARGIN,rowHeight=0;
      for(const entry of entries){
        const local=localPanel(mode,entry.group,entry.maps);
        if(x>MARGIN&&x+local.panel.width>rowWidth){x=MARGIN;y+=rowHeight+GAP;rowHeight=0;}
        const panel=translatePanel(local,x,y);panels.push(panel);
        for(const [id,point]of local.points)positions.set(id,{x:round(point.x+x),y:round(point.y+y)});
        x+=panel.width+GAP;rowHeight=Math.max(rowHeight,panel.height);
      }
    }
    return {mode,positions,panels,bounds:getBounds(positions,panels),edgeStyle:mode==='metro'?'orthogonal':mode==='board'?'straight':'curved'};
  }

  window.AtlasWorldViews=Object.freeze({modes,createLayout});
})();
