'use strict';
(() => {
  const L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  function render(land,layout,{svgEl,groupName,groupId,canActivate=()=>true}){
    for(const panel of layout.panels){
      const group=svgEl('g',{class:`world-panel world-panel-${panel.shape}`,'data-group':panel.groupId||panel.id,'data-panel':panel.id});
      if(panel.color)group.style.setProperty('--world-region-color',panel.color);
      if(panel.shape==='orbit'){
        group.append(svgEl('ellipse',{class:'world-panel-surface',cx:panel.cx,cy:panel.cy,rx:panel.rx,ry:panel.ry}));
        for(const radius of panel.orbitRadii||[])group.append(svgEl('circle',{class:'world-panel-orbit',cx:panel.cx,cy:panel.cy,r:radius}));
      }else group.append(svgEl('rect',{class:'world-panel-surface',x:panel.x,y:panel.y,width:panel.width,height:panel.height,rx:panel.shape==='game'?18:28}));
      if(panel.shape==='game'){
        const picture=svgEl('image',{class:'world-game-image',href:panel.image,x:panel.x,y:panel.y,width:panel.width,height:panel.height,preserveAspectRatio:'xMidYMid meet'});
        const status=svgEl('text',{class:'world-image-status',x:panel.x+panel.width/2,y:panel.y+panel.height/2},L('טוענים את מפת המשחק…','Loading game map…'));
        picture.addEventListener('load',()=>status.remove());
        picture.addEventListener('error',()=>{status.textContent=L('התמונה לא נטענה — הנקודות זמינות. רעננו כדי לנסות שוב.','Image unavailable — points still work. Refresh to retry.');});
        group.append(picture,status);
      }
      if(panel.shape==='card'&&panel.thumbnail){
        group.append(svgEl('image',{class:'world-panel-image',href:panel.thumbnail,x:panel.x+18,y:panel.y+16,width:panel.width-36,height:78,preserveAspectRatio:'xMidYMid slice'}));
        group.append(svgEl('rect',{class:'world-panel-image-shade',x:panel.x+18,y:panel.y+16,width:panel.width-36,height:78,rx:12}));
      }
      for(const track of panel.tracks||[])group.append(svgEl('line',{class:'world-panel-track',...track}));
      const title=panel.name||groupName(groupId(panel.groupId))||L('מפות נוספות','Additional maps');
      const anchor=['orbit','card'].includes(panel.shape)?'middle':'start';
      const heading=svgEl('text',{class:'world-panel-title',x:panel.titleX,y:panel.titleY,'text-anchor':anchor,direction:'ltr',role:'button',tabindex:0,'data-focus-panel':panel.id,'aria-label':`${L('מיקוד באזור','Focus region')}: ${title}`},title);
      heading.addEventListener('click',event=>{event.stopPropagation();if(canActivate())window.Atlas?.focusWorldPanel(panel.id);});
      heading.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();window.Atlas?.focusWorldPanel(panel.id);}});
      group.append(heading);
      if(panel.count!=null)group.append(svgEl('text',{class:'world-panel-count',x:panel.titleX,y:panel.titleY+30,'text-anchor':anchor,direction:L('rtl','ltr')},`${panel.count} ${L('מפות','maps')}${panel.shape==='extension'?L(' · מחוץ לאיור המקורי',' · outside the original artwork'):''}`));
      land.append(group);
    }
  }
  function filter(land,layout,visibleIds){
    for(const node of land.querySelectorAll('[data-panel]')){const panel=layout.panels.find(entry=>entry.id===node.getAttribute('data-panel'));node.style.display=panel?.mapIds.some(id=>visibleIds.has(id))?'':'none';}
  }
  function scale(land,layout,zoom){
    for(const node of land.querySelectorAll('[data-panel]')){
      const title=node.querySelector('.world-panel-title'),count=node.querySelector('.world-panel-count');
      if(title)title.style.fontSize=`${Math.max(27,12/zoom)}px`;
      if(count)count.style.visibility=zoom<.4?'hidden':'';
    }
  }
  window.AtlasWorldPresentation={render,filter,scale};
})();
