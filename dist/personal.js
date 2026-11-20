'use strict';
// Small local-only library. Persist recipes, never stale copies of map data.
(() => {
  const L=(he,en)=>window.AtlasI18n?.language==='en'?en:he;
  let restoreNote=()=>'';
  const KEY='maple-atlas-personal-v1', MAX_RECENT=20;
  let api, state={version:1,favorites:[],recent:[],journey:null}, storageOk=true;
  const validId=id=>Number.isSafeInteger(id)&&api.maps.has(id);
  function ids(value,limit){return Array.isArray(value)?[...new Set(value.filter(validId))].slice(0,limit):[];}
  function recipe(value){
    if(!value||!validId(value.from)||!validId(value.to)||typeof value.services!=='boolean'||!Number.isSafeInteger(value.step)||value.step<0||value.step>api.maps.size*(1+(Array.isArray(value.stops)?value.stops.length:0)))return null;
    const normalized=typeof AtlasJourney!=='undefined'?AtlasJourney.normalizeRecipe(value,api.maps):{from:value.from,to:value.to,services:value.services,step:value.step};
    return normalized?{...normalized,signature:typeof value.signature==='string'?value.signature.slice(0,30000):''}:null;
  }
  function read(){
    try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw?.version===1)state={version:1,favorites:ids(raw.favorites,api.maps.size),recent:ids(raw.recent,MAX_RECENT),journey:recipe(raw.journey)};}
    catch{storageOk=false;}
  }
  function write(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}status();}
  function status(){const message=storageOk?L("נשמר בדפדפן הזה בלבד · ללא חשבון וסנכרון","Saved only in this browser \u00b7 No account or sync"):L("השמירה בדפדפן אינה זמינה כרגע. אפשר להמשיך להשתמש ולשתף קישור למסלול.","Browser storage is unavailable. You can still use the atlas and share route links.");for(const id of ['personalStorage','routeStorageStatus']){const el=document.getElementById(id);if(el)el.textContent=message;}}
  function routeSignature(route){return JSON.stringify([api.version,route.from,...route.steps.map(s=>[s.from,s.to,s.p?.key||s.service?.id||''])]);}
  function capture(){const route=api.getRoute();return route?{from:route.from,to:route.to,stops:[...(route.stops||[])],...(route.goal?{goal:route.goal}:{}),services:api.getServices(),step:api.getStep(),signature:routeSignature(route)}:null;}
  function parseLink(hash){
    if(typeof hash!=='string'||hash.length>8192)return null;
    const p=new URLSearchParams(hash.replace(/^#/,''));if(!p.has('route'))return undefined;
    const allowed=new Set(['route','services','step','data','map','stops','goal']),seen=new Set();
    for(const key of p.keys()){if(!allowed.has(key)||seen.has(key))return null;seen.add(key);}
    const m=/^(\d+),(\d+)$/.exec(p.get('route')),step=p.get('step')||'0',services=p.get('services')||'0';
    if(!m||!/^\d+$/.test(step)||!['0','1'].includes(services))return null;
    let goal;try{goal=p.has('goal')?JSON.parse(p.get('goal')):undefined;}catch{return null;}
    if(p.has('goal')&&(!goal||typeof goal!=='object'||Array.isArray(goal)))return null;
    const stopText=p.get('stops')||'';if(stopText&&!/^\d+(,\d+){0,7}$/.test(stopText))return null;
    const result=recipe({from:Number(m[1]),to:Number(m[2]),stops:stopText?stopText.split(',').map(Number):[],...(goal?{goal}:{}),step:Number(step),services:services==='1'});
    if(result)result.data=p.get('data');return result;
  }
  function linkHash(journey){return '#'+new URLSearchParams({route:`${journey.from},${journey.to}`,services:journey.services?'1':'0',step:String(journey.step),data:api.version,...(journey.stops?.length?{stops:journey.stops.join(',')}:{}),...(journey.goal?{goal:JSON.stringify(journey.goal)}:{})}).toString();}
  function saveJourney(){if(!api)return;if(storageOk)read();state.journey=capture();write();if(state.journey||new URLSearchParams(location.hash.slice(1)).has('route'))history.replaceState(null,'',state.journey?linkHash(state.journey):location.pathname+location.search);}
  function restore(journey,shared=false){
    if(!journey||!api.restore(journey)){if(!shared){state.journey=null;write();}api.notice(shared?L("הקישור אינו מכיל מסלול זמין. אפשר לבחור מוצא ויעד מחדש.","This link does not contain an available route. Choose a new start and destination."):L("המסלול השמור אינו זמין בנתונים הנוכחיים.","The saved route is unavailable in the current data."));return false;}
    const changed=shared?journey.data!==api.version:journey.signature!==routeSignature(api.getRoute());
    const invalidStep=journey.step>api.getRoute().steps.length;
    const step=changed||invalidStep?0:journey.step;
    api.resume(step,false);saveJourney();
    restoreNote=()=>invalidStep?L("השלב השמור אינו קיים במסלול הזה. המדריך נפתח מההתחלה.","The saved step does not exist on this route. Navigation starts from the beginning."):changed?L("נתוני המסלול השתנו; המסלול חושב מחדש וההתקדמות אופסה.","The route data changed; the route was recalculated and progress reset."):shared?L("מסלול מקישור משותף · ניתן להמשיך מהמקום המסומן.","Shared route \u00b7 Continue from the marked step."):L("המסלול והשלב האחרון שוחזרו מהדפדפן הזה.","Your route and last step were restored from this browser.");
    document.getElementById('routeRestoreNote').textContent=restoreNote();
    return true;
  }
  function render(){
    const favorites=new Set(state.favorites),filter=document.getElementById('personalFilter').value;
    const list=filter==='recent'?state.recent:state.favorites;
    document.getElementById('personalList').innerHTML=list.map(id=>{const m=api.maps.get(id);return `<div class="saved-map"><button type="button" data-saved-map="${id}" class="saved-map-open"><bdi>${api.escape(m.name)}</bdi><small>${id}</small></button><button type="button" class="button quiet" data-saved-star="${id}" aria-pressed="${favorites.has(id)}" aria-label="${favorites.has(id)?L("הסרת","Remove"):L("הוספת","Add")} ${api.escape(m.name)} ${favorites.has(id)?L("מהמועדפים","from favorites"):L("למועדפים","to favorites")}">${favorites.has(id)?'★':'☆'}</button></div>`;}).join('')||`<p class="empty-state">${filter==='recent'?L("מפות שתפתחו יופיעו כאן.","Maps you open will appear here."):L("עדיין אין מועדפים. לחצו על הכוכב בפרטי מפה כדי לשמור אותה כאן.","No favorites yet. Select the star in a map's details to save it here.")}</p>`;
    status();
  }
  function visit(id){if(!api||!validId(id))return;if(storageOk)read();state.recent=[id,...state.recent.filter(x=>x!==id)].slice(0,MAX_RECENT);write();}
  function toggle(id){if(!validId(id))return;const focused=document.activeElement;const star=focused?.getAttribute?.('data-saved-star');const detail=focused?.getAttribute?.('data-action')==='favorite';if(storageOk)read();state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[id,...state.favorites];write();api.refresh();render();if(star)(document.querySelector(`[data-saved-star="${id}"]`)||document.getElementById("personalFilter")).focus();else if(detail)document.querySelector('[data-action="favorite"]')?.focus();}
  async function share(){
    const journey=capture();if(!journey)return;
    const url=new URL(location.href);url.hash=linkHash(journey);url.search='';
    const field=document.getElementById('routeShareUrl');field.value=url.href;document.getElementById('routeShareBox').hidden=false;
    try{await navigator.clipboard.writeText(url.href);api.notice(L("קישור המסלול הועתק, כולל השלב הנוכחי.","Route link copied, including the current step."));}
    catch{field.focus();field.select();api.notice(L("אפשר להעתיק את הקישור מהשדה המסומן.","Copy the link from the selected field."));}
  }
  function init(options){
    api=options;read();api.refresh();window.AtlasLibrary?.init({maps:api.maps,escape:api.escape,notice:api.notice,refresh:api.refresh,select:api.select});
    document.getElementById('personalToggle').addEventListener('click',()=>{render();document.getElementById('personalDialog').showModal();});
    document.getElementById('closePersonal').addEventListener('click',()=>document.getElementById('personalDialog').close());
    document.getElementById('personalFilter').addEventListener('change',render);
    document.getElementById('clearRecent').addEventListener('click',()=>{if(storageOk)read();state.recent=[];write();render();api.notice(L("רשימת המפות האחרונות נוקתה. המועדפים נשמרו.","Recent maps cleared. Your favorites are kept."));});
    document.getElementById('personalList').addEventListener('click',e=>{const star=e.target.closest('[data-saved-star]');if(star){toggle(Number(star.dataset.savedStar));return;}const map=e.target.closest('[data-saved-map]');if(map){document.getElementById('personalDialog').close();api.select(Number(map.dataset.savedMap));}});
    const handleLink=()=>{const linked=parseLink(location.hash);if(linked===undefined)return false;if(linked===null){api.notice(L("קישור המסלול אינו תקין. בחרו מוצא ויעד כדי ליצור מסלול חדש.","This route link is invalid. Choose a start and destination to create a new route."));return true;}restore(linked,true);return true;};
    if(!handleLink()&&!new URLSearchParams(location.hash.slice(1)).has('map')&&state.journey)restore(state.journey);
    window.addEventListener('storage',e=>{if(e.key===KEY&&storageOk){read();api.refresh();render();}});
    window.addEventListener('hashchange',handleLink);
    window.addEventListener('atlas-languagechange',()=>{render();const note=document.getElementById('routeRestoreNote');if(note.textContent)note.textContent=restoreNote();});status();
  }
  function mapHash(id){const p=new URLSearchParams(location.hash.slice(1));if(p.has('route')){p.set('map',String(id));return '#'+p.toString();}return `#map=${id}`;}
  window.AtlasPersonal={init,visit,toggle,share,saveJourney,mapHash,isFavorite:id=>state.favorites.includes(id),parseLink,routeSignature,captureJourney:capture,validateJourney:recipe,restoreJourney:journey=>restore(recipe(journey)),get storageOk(){return storageOk&&window.AtlasLibrary?.storageOk!==false;},getOrigin:()=>window.AtlasLibrary?.getOrigin()??null,setOrigin:id=>window.AtlasLibrary?.setOrigin(id)??false,snapshot:()=>JSON.parse(JSON.stringify(state)),mergeSnapshot:incoming=>{if(storageOk)read();state.favorites=ids([...state.favorites,...ids(incoming.favorites,api.maps.size)],api.maps.size);state.recent=ids([...state.recent,...ids(incoming.recent,MAX_RECENT)],MAX_RECENT);if(!state.journey&&incoming.journey)state.journey=recipe(incoming.journey);write();api.refresh();render();}};
})();
