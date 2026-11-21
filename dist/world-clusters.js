'use strict';
// A game world-map spot may represent a town and many interiors. Choose explicitly.
(() => {
  const L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  let dialog=null,opener=null;
  function open(anchor,node){
    const atlas=window.Atlas;if(!atlas)return;
    if(!dialog){dialog=document.createElement('dialog');dialog.id='worldClusterDialog';dialog.className='world-cluster-dialog';dialog.setAttribute('aria-labelledby','worldClusterTitle');document.body.append(dialog);dialog.addEventListener('close',()=>opener?.isConnected&&opener.focus());}
    opener=node;dialog.replaceChildren();
    const header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');header.className='world-cluster-heading';title.id='worldClusterTitle';title.textContent=anchor.name;title.dir='auto';close.type='button';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label',L('סגירת בחירת מפה','Close map chooser'));close.addEventListener('click',()=>dialog.close());header.append(title,close);
    const explanation=document.createElement('p');explanation.textContent=L('בנקודה הזאת נמצאות המפות הבאות. בחרו מפה כדי לראות את הפרטים שלה.','This spot contains the following maps. Choose one to see its details.');
    const list=document.createElement('div');list.className='world-cluster-list';
    for(const id of anchor.mapIds){
      const map=atlas.data.maps.find(entry=>entry.id===id);if(!map)continue;
      const button=document.createElement('button');button.type='button';button.dataset.clusterMap=String(id);button.setAttribute('aria-pressed',String(id===atlas.activeMap));
      const image=document.createElement('img');image.src=map.minimap||map.image;image.alt='';image.loading='lazy';image.addEventListener('error',()=>{image.hidden=true;},{once:true});
      const copy=document.createElement('span'),name=document.createElement('bdi'),detail=document.createElement('small');name.textContent=map.name;detail.textContent=`${map.portals.filter(portal=>portal.kind==='cross').length} ${L('יציאות','exits')} · ${map.id}`;copy.append(name,detail);button.append(image,copy);
      button.addEventListener('click',()=>{dialog.close();atlas.selectMap(id,{focus:true});});list.append(button);
    }
    dialog.append(header,explanation,list);dialog.showModal();
  }
  function render(layer,layout,{svgEl,canActivate=()=>true}){
    for(const anchor of layout?.anchors||[]){
      const group=svgEl('g',{class:'world-anchor',transform:`translate(${anchor.x},${anchor.y})`,role:'button',tabindex:0,'data-anchor':anchor.id,'data-map-ids':anchor.mapIds.join(','),'aria-label':`${anchor.name} · ${anchor.mapIds.length} ${L('מפות, לפתיחת הבחירה','maps, open chooser')}`});
      group.append(svgEl('circle',{class:'world-anchor-hit',r:28}),svgEl('circle',{class:'world-anchor-ring',r:20}),svgEl('text',{class:'world-anchor-count','text-anchor':'middle','dominant-baseline':'central'},anchor.mapIds.length));
      group.addEventListener('click',event=>{event.stopPropagation();if(canActivate())open(anchor,group);});
      group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(anchor,group);}});
      layer.append(group);
    }
  }
  function sync(layer,layout,{scale,activeId,journeyMaps,visibleIds,reachableIds=new Set(),reachOrigins=new Set()}){
    for(const node of layer.querySelectorAll('[data-anchor]')){
      const anchor=layout.anchors.find(entry=>entry.id===node.getAttribute('data-anchor'));if(!anchor)continue;
      const visible=anchor.mapIds.some(id=>visibleIds.has(id));node.style.display=visible?'':'none';node.setAttribute('tabindex',visible?'0':'-1');
      node.classList.toggle('reachable-map',anchor.mapIds.some(id=>reachableIds.has(id)));node.classList.toggle('reachability-origin',anchor.mapIds.some(id=>reachOrigins.has(id)));node.classList.toggle('selected',anchor.mapIds.includes(activeId));node.classList.toggle('on-route',anchor.mapIds.some(id=>journeyMaps.has(id)));
      node.querySelector('.world-anchor-ring').setAttribute('r',Math.max(17,6/scale));node.querySelector('.world-anchor-hit').setAttribute('r',Math.max(23,10/scale));node.querySelector('text').setAttribute('font-size',Math.max(14,9/scale));
    }
  }
  window.AtlasWorldClusters={render,sync};
})();
