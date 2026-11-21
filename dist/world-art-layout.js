'use strict';
// World-sheet anchors are presentation coordinates, never scene/portal coordinates.
(() => {
  function createLayout(atlas, art) {
    if(!art?.maps?.length)return null;
    const positions=new Map(),panels=[],anchors=[],known=new Map(atlas.maps.map(map=>[map.id,map]));
    for(const [index,sheet] of art.maps.entries()){
      const scale=index===0?4:3,x=index===0?0:2720,y=90;
      const panel={id:sheet.id,shape:'game',x,y,width:sheet.width*scale,height:sheet.height*scale,titleX:x+24,titleY:y-28,name:sheet.name,image:sheet.image,source:sheet.sourceImageUrl,mapIds:[]};
      for(const spot of sheet.spots){
        const ids=spot.mapIds.filter(id=>known.has(id)&&!positions.has(id)).sort((a,b)=>Number(known.get(b).major)-Number(known.get(a).major)||a-b);
        if(!ids.length)continue;
        const anchor={id:spot.id,name:spot.name,x:x+spot.x*scale,y:y+spot.y*scale,mapIds:ids};anchors.push(anchor);
        ids.forEach(id=>{
          // Shared locations stay at the exact source spot. The chooser exposes
          // individual IDs without inventing geography for the town's interiors.
          positions.set(id,{x:anchor.x,y:anchor.y,anchorX:anchor.x,anchorY:anchor.y,shared:ids.length>1,source:'game'});panel.mapIds.push(id);
        });
      }
      panels.push(panel);
    }
    const groupOrder=new Map(atlas.groups.map((group,index)=>[group.id,index]));
    const remaining=atlas.maps.filter(map=>!positions.has(map.id)).sort((a,b)=>(groupOrder.get(a.group)??99)-(groupOrder.get(b.group)??99)||Number(b.major)-Number(a.major)||a.id-b.id);
    if(remaining.length){
      const x=2720,y=1590,columns=11,rows=Math.ceil(remaining.length/columns);
      remaining.forEach((map,i)=>positions.set(map.id,{x:x+100+i%columns*170,y:y+160+Math.floor(i/columns)*120,source:'extension'}));
      panels.push({id:'extension-other',shape:'extension',x,y,width:1902,height:230+rows*120,titleX:x+35,titleY:y+48,count:remaining.length,mapIds:remaining.map(map=>map.id)});
    }
    const minX=Math.min(...panels.map(p=>p.x))-40,minY=0,maxX=Math.max(...panels.map(p=>p.x+p.width))+40,maxY=Math.max(...panels.map(p=>p.y+p.height))+40;
    return {mode:'classic',positions,panels,anchors,edgeStyle:'curved',bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY,minX,minY,maxX,maxY}};
  }
  window.AtlasArtLayout={createLayout};
})();
