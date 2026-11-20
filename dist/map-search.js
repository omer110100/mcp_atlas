'use strict';
// One matching/selection contract for every map field. No network or storage.
(() => {
  const L=(he,en)=>window.AtlasI18n?.language==='en'?en:he;
  const ALIASES={
    'הנסיס':'Henesys','אליניה':'Ellinia','אלינייה':'Ellinia',
    'פריון':'Perion','קרנינג':'Kerning City','קרנינג סיטי':'Kerning City',
    'סליפיווד':'Sleepywood','סליפי ווד':'Sleepywood','לית':'Lith Harbor',
    'לית הארבור':'Lith Harbor','לית הרבור':'Lith Harbor','פלורינה':'Florina Beach',
    'חוף פלורינה':'Florina Beach','אמהרסט':'Amherst',
    'סאותפרי':'Southperry','סאות פרי':'Southperry','משרום טאון':'Mushroom Town',
    'מושרום טאון':'Mushroom Town','עיר הפטריות':'Mushroom Town','החלל הנשכח':'Forgotten Hollow'
  };
  const TARGETS='#routeFrom,#routeTo,#huntOrigin';
  const norm=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\u0591-\u05c7]/g,'').replace(/[׳״'"’]/g,'').replace(/\s+/g,' ').trim();
  const aliasEntries=Object.entries(ALIASES).map(([he,en])=>[norm(he),norm(en)]);
  const aliases=new Map(aliasEntries), attached=new WeakMap();
  let maps=[],byId=new Map(),records=[],groupLabel=()=>'',observer,serial=0;
  function resolve(value){
    const q=norm(value);if(!q)return null;
    const bracket=q.match(/\[(\d+)\]\s*$/),numeric=/^\d+$/.test(q);
    if(bracket||numeric){const id=Number(bracket?bracket[1]:q);return Number.isSafeInteger(id)?byId.get(id)||null:null;}
    const name=aliases.get(q)||q, matches=maps.filter(m=>norm(m.name)===name);
    return matches.length===1?matches[0]:null;
  }
  function search(value,limit=8){
    const q=norm(value),translated=aliases.get(q)||q,exact=resolve(value);
    const tokens=translated.split(' ').filter(Boolean),max=Number.isSafeInteger(limit)&&limit>=0?Math.min(limit,maps.length):8;
    const matched=records.filter(r=>r.map.id===exact?.id||!q||tokens.every(token=>r.text.includes(token)));
    matched.sort((a,b)=>Number(b.map.id===exact?.id)-Number(a.map.id===exact?.id)||Number(b.name.startsWith(translated))-Number(a.name.startsWith(translated))||Number(!!b.map.major)-Number(!!a.map.major)||a.map.name.localeCompare(b.map.name)||a.map.id-b.map.id);
    return matched.slice(0,max).map(r=>r.map);
  }
  function attach(input){
    if(!input||attached.has(input))return;
    const holder=document.createElement('div'),list=document.createElement('div'),note=document.createElement('p');
    const id=`map-lookup-${++serial}`;
    holder.className='map-lookup';list.className='map-lookup-list';list.id=id;list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-label',L('הצעות למפת משחק','Game map suggestions'));
    note.className='map-lookup-status';note.id=id+'-status';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
    input.before(holder);holder.append(input,list,note);input.removeAttribute('list');input.setAttribute('dir','auto');input.setAttribute('autocomplete','off');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',id);input.setAttribute('aria-expanded','false');
    let results=[],index=-1;
    const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');index=-1;note.textContent='';};
    const highlight=()=>{[...list.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));if(index>=0){input.setAttribute('aria-activedescendant',`${id}-${index}`);list.children[index]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
    const choose=i=>{
      const map=results[i];if(!map)return;
      input.value=`${map.name} [${map.id}]`;input.removeAttribute('aria-invalid');close();
      input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();
    };
    const render=()=>{
      const all=search(input.value,maps.length);results=all.slice(0,8);index=-1;list.replaceChildren();
      for(const [i,map]of results.entries()){
        const option=document.createElement('div'),name=document.createElement('bdi'),meta=document.createElement('small');
        option.className='map-lookup-option';option.id=`${id}-${i}`;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.dataset.lookupIndex=String(i);
        name.textContent=map.name;meta.textContent=`${groupLabel(map)||map.street||''} · ${map.id}`;option.append(name,meta);list.append(option);
      }
      if(!results.length){const empty=document.createElement('p');empty.className='map-lookup-empty';empty.textContent=L('לא נמצאה מפה. נסו שם אחר בעברית, באנגלית או מזהה מפה.','No map found. Try another Hebrew or English name, or a map ID.');list.append(empty);}
      list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
      note.textContent=all.length>8?L(`מוצגות 8 מתוך ${all.length} התאמות. הוסיפו טקסט כדי לצמצם.`,`Showing 8 of ${all.length} matches. Type more to narrow the results.`):all.length?L(`${all.length} הצעות. בחרו מפה או השתמשו בחצים וב־Enter.`,`${all.length} suggestions. Select a map or use the arrow keys and Enter.`):L('לא נמצאו מפות מתאימות.','No matching maps.');
    };
    input.addEventListener('input',render);input.addEventListener('focus',render);input.addEventListener('blur',close);
    input.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();if(list.hidden)render();if(!results.length)return;
        index=event.key==='ArrowDown'?(index+1)%results.length:(index<0?results.length-1:(index-1+results.length)%results.length);highlight();
      }else if(event.key==='Enter'&&!list.hidden&&results.length){
        const selected=index>=0?index:results.findIndex(m=>m.id===resolve(input.value)?.id);
        if(selected>=0){event.preventDefault();event.stopPropagation();choose(selected);}
      }
      else if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();close();}
      else if(event.key==='Tab')close();
    });
    // Keep DOM focus in the combobox while clicking or tapping an option.
    list.addEventListener('pointerdown',e=>{if(e.target.closest('[data-lookup-index]'))e.preventDefault();});
    list.addEventListener('click',e=>{const option=e.target.closest('[data-lookup-index]');if(option)choose(Number(option.dataset.lookupIndex));});
    const refresh=()=>{list.setAttribute('aria-label',L('הצעות למפת משחק','Game map suggestions'));if(!list.hidden)render();};
    attached.set(input,{close,refresh});
  }
  function scan(root){if(root.matches?.(TARGETS))attach(root);root.querySelectorAll?.(TARGETS).forEach(attach);}
  function init(options){
    maps=Array.isArray(options.maps)?options.maps:[...options.maps.values()];byId=new Map(maps.map(m=>[m.id,m]));groupLabel=options.groupLabel||(()=> '');
    records=maps.map(map=>{const name=norm(map.name),localAliases=aliasEntries.filter(([,en])=>name.includes(en)).map(([he])=>he).join(' ');return {map,name,text:norm(`${map.name} ${map.id} ${map.street||''} ${groupLabel(map)} ${options.groupTerms?.(map)||''} ${window.AtlasTranslations?.[groupLabel(map)]||Object.entries(window.AtlasTranslations||{}).find(([,en])=>en===groupLabel(map))?.[0]||''} ${localAliases}`)};});
    scan(document);
    if(!observer&&typeof MutationObserver!=='undefined'){
      observer=new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1)scan(node);});
      observer.observe(document.body,{childList:true,subtree:true});
    }
  }
  window.addEventListener?.('atlas-languagechange',()=>{
    document.querySelectorAll(TARGETS).forEach(input=>attached.get(input)?.refresh());
  });
  window.MapSearch={init,resolve,search,attach};
})();
