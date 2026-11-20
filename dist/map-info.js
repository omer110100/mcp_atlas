'use strict';
// Source-backed map occupants and consistent place categories. No inferred positions.
(() => {
  const L=(he,en)=>window.AtlasI18n.text(he,en),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const symbols={town:'⌂',hunting:'⚔',special:'✧',archive:'▣',field:'♧'};
  let monsters=new Map(),npcs=new Map();
  function refreshCatalog(){monsters=new Map((window.Hunt?.data?.monsters||[]).map(m=>[m.id,m]));npcs=new Map((window.Hunt?.data?.npcs||[]).map(n=>[n.id,n]));render();annotate();}
  function facts(id){return window.Atlas?.describeMap?.(id);}
  function badge(id){const info=facts(id);return info?`<span class="place-category" data-category="${info.category}"><i aria-hidden="true">${symbols[info.category]||symbols.field}</i>${esc(info.label)}</span>`:'';}
  function occupant(entry,count,type,mapId){
    const image=entry.icon?`<img src="${esc(entry.icon)}" alt="" loading="lazy">`:`<span aria-hidden="true">${type==='npc'?'◇':'⚔'}</span>`;
    return `<button type="button" class="map-occupant" data-map-occupant="${type}" data-entity="${entry.id}" data-map="${mapId}" aria-label="${esc(L(`הצגת ${entry.name} במפה`,`Highlight ${entry.name} on the map`))}">${image}<span><bdi>${esc(entry.name)}</bdi><small>${type==='monster'?L(`רמה ${entry.level??'?'} · ${count} נקודות`,`Level ${entry.level??'?'} · ${count} points`):L(`${count} מיקומים`,`${count} locations`)}</small></span><span class="occupant-arrow" aria-hidden="true">↗</span></button>`;
  }
  function render(){
    const atlas=window.Atlas;if(!atlas)return;
    const map=atlas.data.maps.find(m=>m.id===atlas.activeMap),root=document.getElementById('mapDetails');if(!map||!root)return;
    let section=root.querySelector('.map-population');if(!section){section=document.createElement('section');section.className='map-population';const actions=root.querySelector('.detail-actions');if(actions)actions.after(section);else root.append(section);}
    const expanded=[...section.querySelectorAll('.map-occupants')].map(node=>node.open);
    const raw=window.Hunt?.data?.mapSpawns?.[map.id]?.points||[],mobCounts=new Map(),npcCounts=new Map();
    for(const point of raw)mobCounts.set(point.mobId,(mobCounts.get(point.mobId)||0)+1);
    for(const point of map.npcs||[])npcCounts.set(point.id,(npcCounts.get(point.id)||0)+1);
    const info=facts(map.id),services=atlas.data.services?.filter(s=>s.from===map.id)||[];
    section.innerHTML=`<div class="map-quick-facts">${badge(map.id)}<span>${L(`${info?.exits||0} יציאות`,`${info?.exits||0} exits`)}</span>${services.length?`<span>${L(`${services.length} מעברים מיוחדים`,`${services.length} special connections`)}</span>`:''}</div><details class="map-occupants" open><summary>${L('מפלצות במפה','Monsters here')} <small>${mobCounts.size}</small></summary><div class="map-occupant-grid">${[...mobCounts].map(([id,count])=>occupant(monsters.get(id)||{id,name:String(id)},count,'monster',map.id)).join('')||`<p class="occupant-empty">${window.Hunt?.catalogStatus==='loading'?L('טוענים את קטלוג המפלצות…','Loading monster catalogue…'):L('אין נקודות הופעה מתועדות למפלצות במפה הזאת.','No monster spawn points are documented on this map.')}</p>`}</div></details><details class="map-occupants" open><summary>${L('דמויות במפה','NPCs here')} <small>${npcCounts.size}</small></summary><div class="map-occupant-grid">${[...npcCounts].map(([id,count])=>occupant(npcs.get(id)||{id,name:map.npcs.find(n=>n.id===id)?.name||String(id)},count,'npc',map.id)).join('')||`<p class="occupant-empty">${L('אין מיקומי דמויות מתועדים במפה הזאת.','No NPC locations are documented on this map.')}</p>`}</div></details>`;
    const sections=section.querySelectorAll('.map-occupants');
    sections.forEach((node,index)=>{if(expanded[index]!==undefined)node.open=expanded[index];});
    if(window.Hunt?.catalogStatus!=='ready'){
      sections[0].querySelector('summary small').textContent='…';
      if(window.Hunt?.catalogStatus==='unavailable')sections[0].querySelector('.map-occupant-grid').innerHTML=`<p class="occupant-empty" role="status">${L('קטלוג המפלצות לא נטען. אפשר לפתוח אותו ולנסות שוב.','The monster catalogue could not load. Open it to retry.')}</p><button type="button" class="button quiet" data-open-catalogue>${L('פתיחת הקטלוג','Open catalogue')}</button>`;
    }
    const technical=root.querySelector('.map-id');if(technical&&!technical.parentElement.classList.contains('map-technical')){const wrapper=document.createElement('details');wrapper.className='map-technical';const summary=document.createElement('summary');summary.textContent=L('מזהים ונתוני מקור','IDs & source records');technical.before(wrapper);wrapper.append(summary,technical);}
    const technicalLabel=root.querySelector('.map-technical > summary');if(technicalLabel)technicalLabel.textContent=L('מזהים ונתוני מקור','IDs & source records');
  }
  function annotate(){
    if(!window.Atlas)return;
    for(const card of document.querySelectorAll('.directory-card,.search-result-mixed[data-kind="map"]')){
      const id=Number(card.dataset.id),info=facts(id);if(!info)continue;
      card.dataset.mapCategory=info.category;
      let label=card.querySelector('.place-category');const content=badge(id);
      if(!label){const holder=card.querySelector('.card-info,.search-result-copy');if(holder)holder.insertAdjacentHTML('beforeend',content);}
      else if(label.dataset.category!==info.category||!label.textContent.includes(info.label)){label.outerHTML=content;}
      for(const detail of card.querySelectorAll('.card-info > small'))detail.hidden=detail.textContent.trim()===info.label;
    }
    for(const node of document.querySelectorAll('.world-node[data-map]')){const info=facts(Number(node.dataset.map));if(info)node.dataset.mapCategory=info.category;}
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-open-catalogue]')){window.Hunt?.open('monster');return;}const button=event.target.closest('[data-map-occupant]');if(!button)return;const id=Number(button.dataset.entity),map=Number(button.dataset.map);if(button.dataset.mapOccupant==='npc')window.Atlas?.openNpcs(map,[id]);else window.Atlas?.openSpawns(map,[id]);});
  window.addEventListener('atlas-ready',()=>{render();annotate();});window.addEventListener('atlas-viewchange',()=>{render();annotate();});window.addEventListener('hunt-ready',refreshCatalog);window.addEventListener('atlas-languagechange',()=>{render();annotate();});
  window.addEventListener('hunt-unavailable',refreshCatalog);
  const observer=new MutationObserver(()=>annotate());for(const id of ['directoryGrid','searchResults']){const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true});}
  if(window.Atlas)refreshCatalog();
})();
