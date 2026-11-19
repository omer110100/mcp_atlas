'use strict';
// Small local-only library. Persist recipes, never stale copies of map data.
(() => {
  const KEY='maple-atlas-personal-v1', MAX_RECENT=20;
  let api, state={version:1,favorites:[],recent:[],journey:null}, storageOk=true;
  const validId=id=>Number.isSafeInteger(id)&&api.maps.has(id);
  function ids(value,limit){return Array.isArray(value)?[...new Set(value.filter(validId))].slice(0,limit):[];}
  function recipe(value){
    if(!value||!validId(value.from)||!validId(value.to)||typeof value.services!=='boolean'||!Number.isSafeInteger(value.step)||value.step<0||value.step>api.maps.size)return null;
    return {from:value.from,to:value.to,services:value.services,step:value.step,signature:typeof value.signature==='string'?value.signature.slice(0,30000):''};
  }
  function read(){
    try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw?.version===1)state={version:1,favorites:ids(raw.favorites,api.maps.size),recent:ids(raw.recent,MAX_RECENT),journey:recipe(raw.journey)};}
    catch{storageOk=false;}
  }
  function write(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}status();}
  function status(){const message=storageOk?'נשמר בדפדפן הזה בלבד · ללא חשבון וסנכרון':'השמירה בדפדפן אינה זמינה כרגע. אפשר להמשיך להשתמש ולשתף קישור למסלול.';for(const id of ['personalStorage','routeStorageStatus']){const el=document.getElementById(id);if(el)el.textContent=message;}}
  function routeSignature(route){return JSON.stringify([api.version,route.from,...route.steps.map(s=>[s.from,s.to,s.p?.key||s.service?.id||''])]);}
  function capture(){const route=api.getRoute();return route?{from:route.from,to:route.to,services:api.getServices(),step:api.getStep(),signature:routeSignature(route)}:null;}
  function parseLink(hash){
    const p=new URLSearchParams(hash.replace(/^#/,''));if(!p.has('route'))return undefined;
    if([...p.keys()].some(k=>p.getAll(k).length!==1))return null;
    const m=/^(\d+),(\d+)$/.exec(p.get('route')),step=p.get('step')||'0',services=p.get('services')||'0';
    if(!m||!/^\d+$/.test(step)||!['0','1'].includes(services))return null;
    const result=recipe({from:Number(m[1]),to:Number(m[2]),step:Number(step),services:services==='1'});
    if(result)result.data=p.get('data');return result;
  }
  function linkHash(journey){return '#'+new URLSearchParams({route:`${journey.from},${journey.to}`,services:journey.services?'1':'0',step:String(journey.step),data:api.version}).toString();}
  function saveJourney(){if(!api)return;if(storageOk)read();state.journey=capture();write();if(state.journey||new URLSearchParams(location.hash.slice(1)).has('route'))history.replaceState(null,'',state.journey?linkHash(state.journey):location.pathname+location.search);}
  function restore(journey,shared=false){
    if(!journey||!api.restore(journey)){if(!shared){state.journey=null;write();}api.notice(shared?'הקישור אינו מכיל מסלול זמין. אפשר לבחור מוצא ויעד מחדש.':'המסלול השמור אינו זמין בנתונים הנוכחיים.');return false;}
    const changed=shared?journey.data!==api.version:journey.signature!==routeSignature(api.getRoute());
    const invalidStep=journey.step>api.getRoute().steps.length;
    const step=changed||invalidStep?0:journey.step;
    api.resume(step,false);saveJourney();
    document.getElementById('routeRestoreNote').textContent=invalidStep?'השלב השמור אינו קיים במסלול הזה. המדריך נפתח מההתחלה.':changed?'נתוני המסלול השתנו; המסלול חושב מחדש וההתקדמות אופסה.':shared?'מסלול מקישור משותף · ניתן להמשיך מהמקום המסומן.':'המסלול והשלב האחרון שוחזרו מהדפדפן הזה.';
    return true;
  }
  function render(){
    const favorites=new Set(state.favorites),filter=document.getElementById('personalFilter').value;
    const list=filter==='recent'?state.recent:state.favorites;
    document.getElementById('personalList').innerHTML=list.map(id=>{const m=api.maps.get(id);return `<div class="saved-map"><button type="button" data-saved-map="${id}" class="saved-map-open"><bdi>${api.escape(m.name)}</bdi><small>${id}</small></button><button type="button" class="button quiet" data-saved-star="${id}" aria-pressed="${favorites.has(id)}" aria-label="${favorites.has(id)?'הסרת':'הוספת'} ${api.escape(m.name)} ${favorites.has(id)?'מהמועדפים':'למועדפים'}">${favorites.has(id)?'★':'☆'}</button></div>`;}).join('')||`<p class="empty-state">${filter==='recent'?'מפות שתפתחו יופיעו כאן.':'עדיין אין מועדפים. לחצו על הכוכב בפרטי מפה כדי לשמור אותה כאן.'}</p>`;
    status();
  }
  function visit(id){if(!api||!validId(id))return;if(storageOk)read();state.recent=[id,...state.recent.filter(x=>x!==id)].slice(0,MAX_RECENT);write();}
  function toggle(id){if(!validId(id))return;const focused=document.activeElement;const star=focused?.getAttribute?.('data-saved-star');const detail=focused?.getAttribute?.('data-action')==='favorite';if(storageOk)read();state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[id,...state.favorites];write();api.refresh();render();if(star)(document.querySelector(`[data-saved-star="${id}"]`)||document.getElementById("personalFilter")).focus();else if(detail)document.querySelector('[data-action="favorite"]')?.focus();}
  async function share(){
    const journey=capture();if(!journey)return;
    const url=new URL(location.href);url.hash=linkHash(journey);url.search='';
    const field=document.getElementById('routeShareUrl');field.value=url.href;document.getElementById('routeShareBox').hidden=false;
    try{await navigator.clipboard.writeText(url.href);api.notice('קישור המסלול הועתק, כולל השלב הנוכחי.');}
    catch{field.focus();field.select();api.notice('אפשר להעתיק את הקישור מהשדה המסומן.');}
  }
  function init(options){
    api=options;read();api.refresh();
    document.getElementById('personalToggle').addEventListener('click',()=>{render();document.getElementById('personalDialog').showModal();});
    document.getElementById('closePersonal').addEventListener('click',()=>document.getElementById('personalDialog').close());
    document.getElementById('personalFilter').addEventListener('change',render);
    document.getElementById('clearRecent').addEventListener('click',()=>{if(storageOk)read();state.recent=[];write();render();api.notice('רשימת המפות האחרונות נוקתה. המועדפים נשמרו.');});
    document.getElementById('personalList').addEventListener('click',e=>{const star=e.target.closest('[data-saved-star]');if(star){toggle(Number(star.dataset.savedStar));return;}const map=e.target.closest('[data-saved-map]');if(map){document.getElementById('personalDialog').close();api.select(Number(map.dataset.savedMap));}});
    const handleLink=()=>{const linked=parseLink(location.hash);if(linked===undefined)return false;if(linked===null){api.notice('קישור המסלול אינו תקין. בחרו מוצא ויעד כדי ליצור מסלול חדש.');return true;}restore(linked,true);return true;};
    if(!handleLink()&&!new URLSearchParams(location.hash.slice(1)).has('map')&&state.journey)restore(state.journey);
    window.addEventListener('storage',e=>{if(e.key===KEY){read();api.refresh();render();}});
    window.addEventListener('hashchange',handleLink);status();
  }
  function mapHash(id){const p=new URLSearchParams(location.hash.slice(1));if(p.has('route')){p.set('map',String(id));return '#'+p.toString();}return `#map=${id}`;}
  window.AtlasPersonal={init,visit,toggle,share,saveJourney,mapHash,isFavorite:id=>state.favorites.includes(id),parseLink,routeSignature};
})();
