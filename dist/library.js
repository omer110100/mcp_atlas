'use strict';
// Browser-local library UI. Backups are parsed and previewed locally, never uploaded.
(() => {
  const KEY='maple-atlas-library-v1',L=(he,en)=>window.AtlasI18n.text(he,en),$=id=>document.getElementById(id);
  let api,store,state={version:1,origin:null,notes:[],collections:[],routes:[]},storageOk=true,tab='maps',pending=null,editingMap=null,previewSequence=0,undoRemoval=null,removalFeedback=null;
  const draftNames={collectionName:'',savedRouteName:''};
  const esc=v=>api.escape(v),personal=()=>window.AtlasPersonal;
  function read(){try{const raw=localStorage.getItem(KEY);if(raw)state=store.profile(JSON.parse(raw));}catch{storageOk=false;}}
  function write(){state=store.profile(state);try{localStorage.setItem(KEY,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}status();}
  function status(){if($('libraryStatus'))$('libraryStatus').textContent=storageOk?L('המידע נשמר במכשיר הזה בלבד. אפשר להעביר אותו באמצעות גיבוי.','Saved on this device only. Use a backup to transfer it.'):L('השמירה אינה זמינה כרגע. השינויים נשארים בדף הזה בלבד; אפשר לייצא גיבוי.','Storage is unavailable. Changes stay in this page; you can export a backup.');}
  function mutate(fn){
    if(storageOk)read();const previous=state;state=JSON.parse(JSON.stringify(state));
    try{if(fn()===false){state=previous;return false;}write();}catch{
      state=previous;const message=L('השינוי לא נשמר. בדקו את אורך השם או ההערה; שמות אינם יכולים לכלול טאבים או מעברי שורה.','Change not saved. Check the name or note length; names cannot contain tabs or line breaks.');
      api.notice(message);if($('libraryStatus'))$('libraryStatus').textContent=message;if($('mapNoteDialog')?.open)$('noteMessage').textContent=message;return false;
    }
    render();decorate();return true;
  }
  function setOrigin(id){if(id!==null&&!store?.validId(id))return false;if(!mutate(()=>state.origin=id))return false;window.dispatchEvent(new Event('atlas-originchange'));return true;}
  function getOrigin(){return store?.validId(state.origin)?state.origin:null;}
  function mapButton(id){const map=api.maps.get(id);return `<button type="button" class="saved-map-open" data-library-map="${id}"><bdi>${esc(map.name)}</bdi><small>${id}</small></button>`;}
  function renderRemovalFeedback(){
    const box=$('libraryRemoval');if(!box)return;box.hidden=!removalFeedback;if(!removalFeedback){box.innerHTML='';return;}
    const {kind,name,status:result}=removalFeedback,group=kind==='collections';
    const message=result==='restored'?L(`${group?'הקבוצה':'המסלול השמור'} ״${name}״ ${group?'שוחזרה':'שוחזר'}.`,`${group?'Group':'Saved route'} “${name}” restored.`):result==='conflict'?L(`לא ניתן לבטל את ההסרה: השם ״${name}״ כבר נמצא בשימוש. הרשומה הקיימת נשמרה.`,`Cannot undo: “${name}” is already in use. The existing entry was kept.`):result==='full'?L(`לא ניתן לבטל כרגע: הגעת למגבלת ${group?20:50} ${group?'קבוצות':'מסלולים'}.`,`Cannot undo yet: the ${group?'20-group':'50-route'} limit has been reached.`):L(`${group?'הקבוצה':'המסלול השמור'} ״${name}״ ${group?'הוסרה':'הוסר'}. אפשר לבטל את ההסרה האחרונה כל עוד הדף פתוח.`,`${group?'Group':'Saved route'} “${name}” removed. You can undo the latest removal while this page stays open.`);
    box.innerHTML=`<p>${esc(message)}</p>${undoRemoval?`<button type="button" class="button quiet" id="libraryUndoRemove" data-library-action="undo-remove">${L('ביטול ההסרה','Undo removal')}</button>`:''}`;
  }
  function removeSaved(kind,name){
    if(!['collections','routes'].includes(kind)||typeof name!=='string')return;
    let removed=null;
    if(!mutate(()=>{const index=state[kind].findIndex(entry=>entry.name===name);if(index<0)return false;removed={kind,index,entry:state[kind][index]};state[kind].splice(index,1);}))return;
    undoRemoval=removed;removalFeedback={kind,name:removed.entry.name,status:'removed'};renderRemovalFeedback();$('libraryUndoRemove')?.focus();
  }
  function undoRemove(){
    if(!undoRemoval)return;
    const {kind,index,entry}=undoRemoval;let problem=null;
    const restored=mutate(()=>{
      if(state[kind].some(current=>current.name.toLowerCase()===entry.name.toLowerCase())){problem='conflict';return false;}
      if(state[kind].length>=AtlasLibraryStore.LIMITS[kind]){problem='full';return false;}
      state[kind].splice(Math.min(index,state[kind].length),0,entry);
    });
    if(restored)undoRemoval=null;
    if(restored||problem){removalFeedback={kind,name:entry.name,status:problem||'restored'};render();(problem?$('libraryUndoRemove'):[...$('libraryNav').querySelectorAll('[data-library-tab]')].find(button=>button.dataset.libraryTab===tab))?.focus();}
  }
  function render(){
    if(!api||!$('libraryBody'))return;
    for(const id of Object.keys(draftNames)){const input=$(id);if(input)draftNames[id]=input.value;}
    $('libraryNav').innerHTML=[['maps',L('מפות וקבוצות','Maps & groups')],['routes',L('מסלולים שמורים','Saved routes')],['notes',L('ההערות שלי','My notes')],['backup',L('גיבוי והעברה','Backup & transfer')]].map(([key,label])=>`<button type="button" class="button quiet" data-library-tab="${key}" aria-pressed="${tab===key}">${label}</button>`).join('');
    for(const id of ['personalFilter','personalList','clearRecent'])$(id).hidden=tab!=='maps';
    document.querySelector('label[for="personalFilter"]').hidden=tab!=='maps';
    let html='';
    if(tab==='maps')html=`<section class="library-section"><h3>${L('מוצא קבוע','Default starting map')}</h3><p>${L('מיקום שבחרת ידנית; האתר אינו מזהה את מיקומך במשחק.','Chosen manually; the site does not detect your in-game location.')}</p><strong><bdi>${esc(api.maps.get(getOrigin())?.name||L('טרם נבחר','Not selected'))}</bdi></strong><div class="library-actions"><button type="button" class="button quiet" data-library-action="origin-current">${L('שימוש במפה הנבחרת','Use selected map')}</button><button type="button" class="button quiet" data-library-action="origin-clear" ${getOrigin()===null?'disabled':''}>${L('ביטול המוצא הקבוע','Clear default')}</button></div></section><section class="library-section"><h3>${L('קבוצות מועדפים','Favorite groups')}</h3><form id="collectionForm" class="library-inline-form"><label for="collectionName">${L('שם הקבוצה','Group name')}</label><input id="collectionName" required maxlength="40" autocomplete="off"><button class="button quiet" type="submit">${L('יצירת קבוצה','Create group')}</button></form><p>${L('אפשר לשייך מפה לקבוצה דרך כפתור ההערה בפרטי המפה.','Assign a map to a group from its note button in map details.')}</p>${state.collections.map((group,i)=>`<details class="library-group"><summary>${esc(group.name)} <small>${group.maps.length}</small></summary>${group.maps.map(id=>`<div class="saved-map">${mapButton(id)}<button type="button" class="button quiet" data-library-group-remove="${i}" data-map="${id}" aria-label="${L('הסרת המפה מהקבוצה','Remove map from group')}">×</button></div>`).join('')||`<p>${L('הקבוצה עדיין ריקה.','This group is empty.')}</p>`}<div class="library-actions"><button type="button" class="button quiet library-remove" data-library-remove="collections" data-library-name="${esc(group.name)}">${L('הסרת הקבוצה','Remove group')}</button></div></details>`).join('')}</section>`;
    if(tab==='routes')html=`<section class="library-section"><h3>${L('שמירת המסלול הנוכחי','Save the current journey')}</h3><form id="saveRouteForm" class="library-inline-form"><label for="savedRouteName">${L('שם המסלול','Route name')}</label><input id="savedRouteName" required maxlength="60" autocomplete="off"><button class="button primary" type="submit" ${personal().captureJourney()?'':'disabled'}>${L('שמירת מסלול ושלב','Save route and step')}</button></form><p>${L('נשמרים התחנות, מטרת הציד והשלב הנוכחי. עד 50 מסלולים.','Keeps stops, hunting purpose and current step. Up to 50 routes.')}</p>${state.routes.map((r,i)=>`<article class="library-route"><h4>${esc(r.name)}</h4><p><bdi>${esc(api.maps.get(r.recipe.from).name)}</bdi> → <bdi>${esc(api.maps.get(r.recipe.to).name)}</bdi></p><small>${L(`${r.recipe.stops?.length||0} תחנות ביניים · שלב ${r.recipe.step+1}`,`${r.recipe.stops?.length||0} stops · Step ${r.recipe.step+1}`)}</small><div class="library-actions"><button type="button" class="button primary" data-library-route="${i}">${L('פתיחת המסלול','Open route')}</button><button type="button" class="button quiet" data-library-route-update="${i}" ${personal().captureJourney()?'':'disabled'}>${L('עדכון מהמסלול הנוכחי','Update from current route')}</button><button type="button" class="button quiet library-remove" data-library-remove="routes" data-library-name="${esc(r.name)}">${L('הסרת המסלול השמור','Remove saved route')}</button></div></article>`).join('')||`<p class="empty-state">${L('עוד אין מסלולים שמורים. תכננו מסלול ותנו לו שם כאן.','No saved routes yet. Plan a route and give it a name here.')}</p>`}</section>`;
    if(tab==='notes')html=`<section class="library-section"><h3>${L('הערות על מפות','Map notes')}</h3>${state.notes.filter(n=>n.text).map(n=>`<article class="library-note">${mapButton(n.mapId)}<p>${esc(n.text)}</p><button type="button" class="button quiet" data-library-note="${n.mapId}">${L('עריכת ההערה','Edit note')}</button></article>`).join('')||`<p class="empty-state">${L('שמרו רמזים אישיים דרך כפתור ההערה בפרטי כל מפה.','Save personal hints using the note button in any map’s details.')}</p>`}</section>`;
    if(tab==='backup')html=`<section class="library-section"><h3>${L('גיבוי מקומי','Local backup')}</h3><p>${L('הקובץ כולל מועדפים, קבוצות, מסלולים והערות. הוא נשאר אצלך ואינו נשלח לשרת.','The file contains favorites, groups, routes and notes. It stays with you and is never sent to a server.')}</p><button type="button" class="button primary" data-library-action="export">${L('הורדת גיבוי','Download backup')}</button><label for="backupFile">${L('בחירת קובץ גיבוי לייבוא','Choose a backup to import')}</label><input id="backupFile" type="file" accept="application/json,.json"><p>${L('הייבוא מוסיף מידע. הערות ומסלולים בעלי אותו שם שכבר קיימים נשמרים.','Import adds information. Existing notes and routes with matching names are kept.')}</p><div id="backupPreview" role="status"></div></section>`;
    $('libraryBody').innerHTML=html;for(const [id,value]of Object.entries(draftNames)){const input=$(id);if(input)input.value=value;}status();renderRemovalFeedback();
  }
  function openNote(id){
    if(!store.validId(id))return;editingMap=id;
    const note=state.notes.find(n=>n.mapId===id)?.text||'';
    $('noteTitle').textContent=L('הערה אישית: ','Personal note: ')+api.maps.get(id).name;
    $('mapNoteText').value=note;
    $('noteGroups').innerHTML=`<legend>${L('שיוך לקבוצות','Add to groups')}</legend>`+state.collections.map((group,i)=>`<label class="check-row"><input type="checkbox" data-note-group="${i}" value="${esc(group.name)}" ${group.maps.includes(id)?'checked':''}><span>${esc(group.name)}</span></label>`).join('')+(!state.collections.length?`<p>${L('אפשר ליצור קבוצות ב״המקומות שלי״.','Create groups in My places.')}</p>`:'');
    $('noteMessage').textContent='';$('mapNoteDialog').showModal();
  }
  function decorate(){
    if(!api||!window.Atlas)return;
    const context=window.Atlas.getContext?.()||{activeMap:window.Atlas.activeMap};
    for(const [container,id]of [[$('mapDetails'),context.activeMap?.id??context.activeMap], [document.querySelector('.scene-sidebar'),context.sceneMap?.id??context.sceneMap]]){
      if(!container||!store.validId(id))continue;
      let section=container.querySelector('.map-personal-tools');if(!section){section=document.createElement('section');section.className='map-personal-tools';container.append(section);}
      const note=state.notes.find(n=>n.mapId===id)?.text;
      section.innerHTML=`<button type="button" class="button quiet" data-library-note="${id}">${note?L('עריכת ההערה שלי','Edit my note'):L('הערה וקבוצות למפה','Map note & groups')}</button>${note?`<p class="map-personal-note">${esc(note)}</p>`:''}`;
    }
  }
  function exportBackup(){
    const backup=store.backup({format:'maple-atlas-backup',version:1,personal:personal().snapshot(),library:state});
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='maple-atlas-backup.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function previewFile(file){
    pending=null;const sequence=++previewSequence,box=$('backupPreview');if(!file||!box)return;
    try{
      if(file.size>AtlasLibraryStore.LIMITS.bytes)throw Error('size');
      const parsed=JSON.parse(await file.text());if(sequence!==previewSequence||!box.isConnected)return;pending=store.backup(parsed);
      box.textContent=L(`נמצאו ${pending.personal.favorites.length} מועדפים, ${pending.library.routes.length} מסלולים ו־${pending.library.notes.length} הערות.`,`Found ${pending.personal.favorites.length} favorites, ${pending.library.routes.length} routes and ${pending.library.notes.length} notes.`);
      const button=document.createElement('button');button.type='button';button.className='button primary';button.dataset.libraryAction='import';button.textContent=L('מיזוג המידע מהגיבוי','Merge backup data');box.append(button);
    }catch{if(sequence!==previewSequence||!box.isConnected)return;pending=null;box.textContent=L('הקובץ אינו גיבוי תקין לגרסת הנתונים הזאת, או גדול מ־4MB. לא שונה מידע.','This is not a valid backup for this dataset, or it exceeds 4MB. Nothing was changed.');}
  }
  function importPending(){
    if(!pending)return;if(storageOk)read();
    const merged=store.merge(state,pending.library);state=merged.profile;write();
    personal().mergeSnapshot({...pending.personal,favorites:[...new Set([...pending.personal.favorites,...pending.library.collections.flatMap(c=>c.maps)])]});
    pending=null;render();decorate();window.dispatchEvent(new Event('atlas-originchange'));
    const skipped=Object.values(merged.skipped).reduce((a,b)=>a+b,0);
    $('backupPreview').textContent=L(`המידע מוזג. ${skipped} רשומות קיימות או מעבר למגבלה נשמרו כפי שהן.`,`Backup merged. ${skipped} existing or over-limit records were left unchanged.`);
  }
  function init(options){
    if(api)return;api=options;store=AtlasLibraryStore.create(api.maps,(value,maps)=>AtlasJourney.normalizeRecipe(value,maps));read();
    const dialog=$('personalDialog'),nav=document.createElement('nav');nav.id='libraryNav';nav.className='library-nav';dialog.querySelector('.section-heading').after(nav);
    const body=document.createElement('div');body.id='libraryBody';dialog.append(body);const removal=document.createElement('section');removal.id='libraryRemoval';removal.className='library-removal';removal.setAttribute('aria-live','polite');removal.setAttribute('aria-atomic','true');removal.hidden=true;dialog.append(removal);const statusNode=document.createElement('p');statusNode.id='libraryStatus';statusNode.className='personal-storage';statusNode.setAttribute('role','status');dialog.append(statusNode);
    const note=document.createElement('dialog');note.id='mapNoteDialog';note.className='personal-dialog map-note-dialog';note.setAttribute('aria-labelledby','noteTitle');note.innerHTML=`<form id="mapNoteForm"><div class="section-heading"><h2 id="noteTitle"></h2><button type="button" class="icon-button" id="closeMapNote" aria-label="${L('סגירה','Close')}">×</button></div><label id="noteTextLabel" for="mapNoteText">${L('הרמז שלך למפה הזאת','Your hint for this map')}</label><textarea id="mapNoteText" rows="5" maxlength="2000"></textarea><fieldset id="noteGroups"></fieldset><p id="noteMessage" role="status"></p><button type="submit" id="saveMapNote" class="button primary">${L('שמירה','Save')}</button></form>`;document.body.append(note);
    $('personalToggle').addEventListener('click',()=>{if(storageOk)read();render();});
    $('closeMapNote').addEventListener('click',()=>note.close());
    $('mapNoteForm').addEventListener('submit',event=>{event.preventDefault();const text=$('mapNoteText').value,groups=[...note.querySelectorAll('[data-note-group]:checked')].map(el=>el.value);if(!mutate(()=>{state.notes=state.notes.filter(n=>n.mapId!==editingMap);if(text.trim())state.notes.push({mapId:editingMap,text});state.collections.forEach((group,i)=>{group.maps=group.maps.filter(id=>id!==editingMap);if(groups.includes(group.name))group.maps.push(editingMap);});}))return;if(groups.length&&!personal().isFavorite(editingMap))personal().toggle(editingMap);note.close();api.notice(storageOk?L('ההערה והקבוצות עודכנו.','Note and groups updated.'):L('ההערה נשמרת בדף הזה בלבד. השמירה במכשיר אינה זמינה; אפשר לייצא גיבוי מהמקומות שלי.','Your note is kept on this page only. Device storage is unavailable; export a backup from My places.'));});
    dialog.addEventListener('submit',event=>{
      if(event.target.id==='collectionForm'){event.preventDefault();const name=$('collectionName').value.trim();if(!name||name.length>40)return;if(state.collections.length>=20||state.collections.some(g=>g.name.toLowerCase()===name.toLowerCase())){api.notice(L('שם הקבוצה כבר קיים או שהגעת למגבלת 20 קבוצות.','That group exists, or the 20-group limit has been reached.'));return;}if(mutate(()=>state.collections.push({name,maps:[]}))){draftNames.collectionName='';$('collectionName').value='';}}
      if(event.target.id==='saveRouteForm'){event.preventDefault();const name=$('savedRouteName').value.trim(),recipe=personal().captureJourney();if(!name||!recipe)return;if(state.routes.length>=50||state.routes.some(r=>r.name.toLowerCase()===name.toLowerCase())){api.notice(L('השם כבר קיים או שהגעת למגבלת 50 מסלולים. אפשר לעדכן מסלול קיים.','That name exists, or the 50-route limit has been reached. You can update an existing route.'));return;}if(mutate(()=>state.routes.push({name,recipe:store.recipe(recipe)}))){draftNames.savedRouteName='';$('savedRouteName').value='';}}
    });
    dialog.addEventListener('change',event=>{if(event.target.id==='backupFile')previewFile(event.target.files?.[0]);});
    document.addEventListener('click',event=>{
      const noteButton=event.target.closest('[data-library-note]');if(noteButton){openNote(Number(noteButton.dataset.libraryNote));return;}
      const target=event.target.closest('[data-library-tab],[data-library-action],[data-library-route],[data-library-route-update],[data-library-map],[data-library-group-remove],[data-library-remove]');if(!target)return;
      if(target.dataset.libraryRemove){removeSaved(target.dataset.libraryRemove,target.dataset.libraryName);return;}
      if(target.dataset.libraryTab){tab=target.dataset.libraryTab;pending=null;previewSequence++;render();[...$('libraryNav').querySelectorAll('[data-library-tab]')].find(button=>button.dataset.libraryTab===tab)?.focus({preventScroll:true});}
      if(target.dataset.libraryMap){dialog.close();api.select(Number(target.dataset.libraryMap));}
      if(target.dataset.libraryRoute!==undefined){const route=state.routes[Number(target.dataset.libraryRoute)];if(route){dialog.close();personal().restoreJourney(route.recipe);}}
      if(target.dataset.libraryRouteUpdate!==undefined){const i=Number(target.dataset.libraryRouteUpdate),recipe=personal().captureJourney();if(state.routes[i]&&recipe)mutate(()=>state.routes[i].recipe=store.recipe(recipe));}
      if(target.dataset.libraryGroupRemove!==undefined){const i=Number(target.dataset.libraryGroupRemove),id=Number(target.dataset.map);if(state.collections[i])mutate(()=>state.collections[i].maps=state.collections[i].maps.filter(map=>map!==id));}
      switch(target.dataset.libraryAction){case'origin-current':setOrigin(window.Atlas.activeMap);break;case'origin-clear':setOrigin(null);break;case'export':exportBackup();break;case'import':importPending();break;case'undo-remove':undoRemove();break;}
    });
    window.addEventListener('atlas-viewchange',decorate);window.addEventListener('atlas-languagechange',()=>{render();decorate();$('noteTextLabel').textContent=L('הרמז שלך למפה הזאת','Your hint for this map');$('saveMapNote').textContent=L('שמירה','Save');$('closeMapNote').setAttribute('aria-label',L('סגירה','Close'));});
    window.addEventListener('storage',event=>{if(event.key===KEY){if(!storageOk){status();return;}read();render();decorate();window.dispatchEvent(new Event('atlas-originchange'));}});
    render();decorate();
  }
  window.AtlasLibrary={init,getOrigin,setOrigin,get storageOk(){return storageOk;}};
})();
