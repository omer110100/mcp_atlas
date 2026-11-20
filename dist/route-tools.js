'use strict';
// Contextual route tools. Recipes remain in Journey; no player position is inferred.
(() => {
  const $=id=>document.getElementById(id);
  const L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAYPAL='https://paypal.me/omerLabinsky',COFFEE='https://buymeacoffee.com/omerlabinsky';
  let generation=0,lastPrefetch=null,ready=false;
  const cached=new Set(),activeImages=new Set();
  function prefetch(route){
    if(route===lastPrefetch)return;
    lastPrefetch=route;const token=++generation;
    for(const request of activeImages){clearTimeout(request.timeout);request.image.onload=request.image.onerror=null;request.image.removeAttribute('src');}
    activeImages.clear();
    if(!route)return;
    const maps=new Map(window.Atlas.data.maps.map(map=>[map.id,map]));
    // These bundled images are byte-identical copies of the original map images.
    const queue=[...new Set([route.from,...route.steps.map(step=>step.to)].map(id=>maps.get(id)?.image).filter(Boolean))].filter(src=>!cached.has(src));
    const workers=navigator.connection?.saveData?1:3;
    function next(){
      if(token!==generation||!queue.length)return;
      const src=queue.shift();const image=new Image();let finished=false;
      const request={image,timeout:null};activeImages.add(request);
      const done=ok=>{if(finished)return;finished=true;clearTimeout(request.timeout);image.onload=image.onerror=null;activeImages.delete(request);if(ok)cached.add(src);else image.removeAttribute('src');next();};
      // A missing/slow image must not stall the entire queue.
      request.timeout=setTimeout(()=>done(false),15000);
      image.decoding='async';image.fetchPriority='low';image.onload=()=>done(true);image.onerror=()=>done(false);image.src=src;
    }
    for(let i=0;i<workers;i++)next();
  }
  function estimateText(route){return L(`~${Math.max(1,Math.ceil(route.estimatedMinutes||0))} דקות הליכה`,`~${Math.max(1,Math.ceil(route.estimatedMinutes||0))} min walking`);}
  function notice(message){const node=$('routeToolsStatus');if(node){node.textContent=message;node.scrollIntoView?.({block:'nearest',behavior:'auto'});}}
  function avoid(index,kind){
    const route=window.Atlas.currentRoute,recipe=window.Atlas.getJourney();
    if(!route||!recipe||!Number.isInteger(index)||index<0||index>=route.steps.length)return false;
    const step=route.steps[index];
    const next={...recipe,step:0,avoidMaps:[...(recipe.avoidMaps||[])],avoidEdges:[...(recipe.avoidEdges||[])]};
    if(kind==='map'){
      if([recipe.from,recipe.to,...recipe.stops].includes(step.from))return false;
      next.avoidMaps.push(step.from);
    }else if(kind==='edge')next.avoidEdges.push(AtlasJourney.edgeKey(step));else return false;
    const normalized=AtlasJourney.normalizeRecipe(next,new Map(window.Atlas.data.maps.map(map=>[map.id,map])));
    if(!normalized){notice(L('הגעת למספר המעקפים המרבי. אפשר לנקות מעקפים ולנסות שוב.','The detour limit was reached. Clear detours and try again.'));return false;}
    const candidate=window.Atlas.findRoute(normalized.from,normalized.to,normalized.services,normalized.stops,normalized);
    if(!candidate){notice(L('לא נמצא מעקף עם העצירות ואפשרויות המעבר האלה. המסלול הקודם נשמר.','No detour is available with these stops and travel options. Your previous route is kept.'));return false;}
    window.Atlas.planJourney(normalized);
    window.AtlasShell?.showDrawer('route');
    notice(L('נמצא מעקף. המסלול חושב מחדש מהמוצא וההתקדמות אופסה.','Detour found. The route was recalculated from the start and progress reset.'));
    return true;
  }
  function discordText(){
    const route=window.Atlas.currentRoute;if(!route)return '';
    const names=new Map(window.Atlas.data.maps.map(map=>[map.id,map.name]));
    const clean=value=>String(value??'').replace(/[\r\n\t]/g,' ').replace(/@/g,'@\u200b');
    const lines=[`Maple Atlas · ${clean(names.get(route.from))} → ${clean(names.get(route.to))}`];
    route.steps.forEach((step,index)=>{
      const gate=step.p?L(`שער ${step.p.number}`,`Portal ${step.p.number}`):L('מעבר מתועד','Documented passage');
      const condition=step.service?window.AtlasI18n?.data(step.service.condition||step.service.requirements||'')||'':'';
      lines.push(`${index+1}. ${clean(names.get(step.from))} — ${gate} → ${clean(names.get(step.to))}${step.service&&!step.service.walkable?' ⚠ '+L('מעבר מותנה','Conditional entrance'):''}${condition?' · '+clean(condition):''}`);
    });
    lines.push(`${L('יעד','Destination')}: ${clean(names.get(route.to))}`);
    window.AtlasPersonal?.saveJourney();
    const url=new URL(location.href);url.search='';lines.push(url.href);
    return lines.join('\n');
  }
  async function copyDiscord(){
    const text=discordText();if(!text)return;
    try{await navigator.clipboard.writeText(text);notice(L('טקסט המסלול הועתק לדיסקורד.','Route text copied for Discord.'));}
    catch{const field=$('routeCopyFallback');if(!field)return;field.hidden=false;field.value=text;field.focus();field.select();notice(L('אפשר להעתיק את הטקסט מהשדה המסומן.','Copy the text from the selected field.'));}
  }
  function render(){
    const route=window.Atlas?.currentRoute,host=$('routeResult');if(!host||!route)return;
    const summary=host.querySelector('.route-summary');
    if(summary&&Number.isFinite(route.cost))summary.innerHTML=`<strong>${route.steps.length+1} ${L('מפות','maps')} · ${route.steps.length?estimateText(route):L('כבר ביעד','Already here')}</strong>${route.steps.some(step=>step.service&&!step.service.walkable)?`<span class="trip-condition">${L('כולל מעבר מותנה','Conditional entrance')}</span>`:''}`;
    if(!host.querySelector('.route-tools')){
      const tools=document.createElement('section');tools.className='route-tools';
      tools.innerHTML=`<details class="route-estimate"><summary>${L('איך חושב האומדן?','How is this estimated?')}</summary><p>${L('זהו אומדן השוואתי לפי מרחקי שערים בקו ישר: 100 יחידות תמונה לשנייה ו־3 שניות לכל יחידת עלות מעבר. הוא אינו כולל מכשולים, טיפוס, המתנה או תנאי משימות.','This comparative estimate uses straight-line portal distances: 100 image units per second and 3 seconds per passage cost unit. It excludes obstacles, climbing, queues and quest requirements.')}</p><p>${L('מרחק מתועד','Recorded distance')}: ${Math.round(route.walkingDistance||0).toLocaleString()} ${L('יחידות מקור','source units')} · ${route.unknownDistanceSegments||0} ${L('קטעים עם מרחק לא ידוע, מחושבים כ־1,000 יחידות כל אחד. מיקום ההתחלה בתוך המפה אינו ידוע.','segments with unknown distance, estimated at 1,000 units each. The starting position within the map is unknown.')}</p></details>`;
      summary?.insertAdjacentElement('afterend',tools);
    }
    const share=$('shareRoute');if(share)share.textContent=L('העתק קישור למסלול','Copy route link');
    if(!$('copyRouteDiscord')){
      const button=document.createElement('button');button.type='button';button.id='copyRouteDiscord';button.className='button quiet';button.textContent=L('העתק טקסט לדיסקורד','Copy for Discord');host.querySelector('.route-secondary-actions')?.append(button);
      const footer=document.createElement('div');footer.className='route-tools-footer';footer.innerHTML=`<p id="routeToolsStatus" role="status" aria-live="polite"></p><textarea id="routeCopyFallback" readonly hidden aria-label="${L('טקסט המסלול להעתקה','Route text to copy')}" dir="auto"></textarea><p class="route-support-note">${L('המסלול חסך לך זמן? אפשר לתמוך בפרויקט, לבחירתכם.','Did this route save you time? Supporting the project is optional.')}</p><div class="route-support-links"><a class="button primary" href="${PAYPAL}" target="_blank" rel="noopener noreferrer"><bdi dir="ltr">PayPal</bdi><span aria-hidden="true">↗</span></a><a href="${COFFEE}" target="_blank" rel="noopener noreferrer"><bdi dir="ltr">Buy Me a Coffee</bdi> <span aria-hidden="true">↗</span></a></div>`;host.append(footer);host.querySelector('.route-tools')?.append($('routeToolsStatus'));
    }
    const excluded=(route.avoidMaps?.length||0)+(route.avoidEdges?.length||0);
    if(excluded&&!$('clearRouteAvoids')){const button=document.createElement('button');button.id='clearRouteAvoids';button.type='button';button.className='button quiet';button.textContent=L(`ניקוי ${excluded} מעקפים`,`Clear ${excluded} detours`);host.querySelector('.route-tools')?.append(button);}
    for(const node of host.querySelectorAll('[data-step-index]')){
      const index=Number(node.dataset.stepIndex),step=route.steps[index];if(!step||node.querySelector('.route-detour'))continue;
      const menu=document.createElement('details');menu.className='route-detour';
      const required=[route.from,route.to,...(route.stops||[])].includes(step.from);
      menu.innerHTML=`<summary aria-label="${L('אפשרויות מעקף לשלב','Detour options for step')} ${index+1}">⋯</summary><div><button type="button" data-avoid-edge="${index}">${L('אני תקוע · עקוף שער','I’m stuck · avoid passage')}</button><button type="button" data-avoid-map="${index}" ${required?'disabled':''}>${L('עקוף מפה','Avoid map')}</button>${required?`<small>${L('מוצא, יעד ועצירות נבחרות נשמרים במסלול.','Start, destination and chosen stops are kept.')}</small>`:''}</div>`;
      node.append(menu);
    }
    const context=window.Atlas.getContext();
    if(context.sceneOpen&&context.route&&$('sceneDialog').classList.contains('compact-navigation')){
      $('sceneNavTarget').textContent=context.sceneMap.name;
      $('sceneNavLabel').textContent=L('המפה הנוכחית','Current map');
      $('sceneNavNext').textContent=L('הגעתי, לשלב הבא ➔','Arrived, next step ➔');
    }
  }
  function onReady(){
    if(ready)return;ready=true;
    $('routeResult').addEventListener('click',event=>{
      const edge=event.target.closest('[data-avoid-edge]'),map=event.target.closest('[data-avoid-map]');
      if(edge)avoid(Number(edge.dataset.avoidEdge),'edge');
      else if(map)avoid(Number(map.dataset.avoidMap),'map');
      else if(event.target.id==='copyRouteDiscord')copyDiscord();
      else if(event.target.id==='clearRouteAvoids'){const recipe=window.Atlas.getJourney();if(recipe)window.Atlas.planJourney({...recipe,avoidMaps:[],avoidEdges:[],step:0});}
    });
    render();if(window.Atlas.currentRoute)prefetch(window.Atlas.currentRoute);
  }
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
    if(!['ArrowLeft','ArrowRight'].includes(event.key)||!$('sceneDialog')?.open||$('sceneNavigation').hidden)return;
    if([...document.querySelectorAll('dialog[open]')].some(dialog=>dialog.id!=='sceneDialog'))return;
    const button=$(event.key==='ArrowRight'?'sceneNavNext':'sceneNavPrevious');
    if(button&&!button.disabled&&!button.hidden){event.preventDefault();button.click();}
  });
  window.addEventListener('atlas-ready',onReady,{once:true});
  window.addEventListener('atlas-viewchange',render);
  window.addEventListener('atlas-languagechange',render);
  window.AtlasRouteTools={prefetch,avoid,discordText};
  if(window.Atlas)onReady();
})();
