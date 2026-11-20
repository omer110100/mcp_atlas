'use strict';
// Execute the actual library controller with DOM/storage contracts. No browser rendering.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),KEY='maple-atlas-library-v1',results=[];
const check=(name,passed)=>results.push({name,passed:!!passed});
const empty=()=>({version:1,origin:null,notes:[],collections:[],routes:[]});
function setup(saved=empty()){
  const elements=new Map(),events=new Map(),documentEvents=new Map(),notices=[],blobs=[],merged=[];
  const data=new Map([[KEY,JSON.stringify(saved)]]);let blocked=false,writes=0,personalToggles=0;
  const unregister=node=>{for(const child of node.children)unregister(child);if(elements.get(node.id)===node)elements.delete(node.id);node.isConnected=false;};
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.listeners={};this.className='';this.value='';this.textContent='';this.hidden=false;this.open=false;this.checked=false;this.isConnected=false;this._html='';}
    set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
    set innerHTML(html){this._html=html;for(const child of this.children)unregister(child);this.children=[];
      for(const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)){const child=new Element(match[1]);for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g))child.setAttribute(attr[1],attr[2]);child.checked=/\bchecked(?:\s|$)/.test(match[2]);this.append(child);}}
    get innerHTML(){return this._html;}
    setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=String(value);if(name==='class')this.className=String(value);if(name==='value')this.value=String(value);if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    append(...children){for(const child of children){child.parentElement=this;child.isConnected=this.isConnected;this.children.push(child);}}
    after(child){const parent=this.parentElement;if(parent){child.parentElement=parent;child.isConnected=parent.isConnected;parent.children.splice(parent.children.indexOf(this)+1,0,child);}}
    matches(selector){return selector.split(',').some(piece=>{piece=piece.trim();if(piece.startsWith('.'))return this.className.split(' ').includes(piece.slice(1));const attr=/^\[([^\]]+)\](:checked)?$/.exec(piece);if(attr)return this.getAttribute(attr[1])!==null&&(!attr[2]||this.checked);return this.tagName.toLowerCase()===piece;});}
    querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    showModal(){this.open=true;}close(){this.open=false;}focus(){}click(){}remove(){unregister(this);}
  }
  const body=new Element('body');body.isConnected=true;
  const add=(id,tag='div',parent=body)=>{const element=new Element(tag);element.id=id;parent.append(element);return element;};
  const dialog=add('personalDialog','dialog'),heading=add('heading','div',dialog);heading.className='section-heading';
  for(const id of ['personalFilter','personalList','clearRecent','personalToggle'])add(id,id==='personalFilter'?'select':'div',dialog);
  const label=add('filterLabel','label',dialog),details=add('mapDetails'),sidebar=add('sceneSidebar');sidebar.className='scene-sidebar';
  const document={body,getElementById:id=>elements.get(id)||null,createElement:tag=>new Element(tag),querySelector:selector=>selector==='label[for="personalFilter"]'?label:selector==='.scene-sidebar'?sidebar:null,addEventListener:(type,fn)=>{const list=documentEvents.get(type)||[];list.push(fn);documentEvents.set(type,list);}};
  const maps=new Map([[1,{id:1,name:'First <map>'}],[2,{id:2,name:'Second map'}],[3,{id:3,name:'Third map'}]]);
  const recipe={from:1,to:3,stops:[2],services:false,step:1,signature:'same-route'};
  const personal={captureJourney:()=>recipe,snapshot:()=>({favorites:[1,2],recent:[],journey:recipe}),mergeSnapshot:value=>merged.push(value),isFavorite:()=>true,toggle(){personalToggles++;}};
  const window={Atlas:{activeMap:1,getContext:()=>({activeMap:{id:1,name:'First <map>'},sceneMap:{id:2,name:'Second map'}})},AtlasPersonal:personal,AtlasI18n:{text:(_he,en)=>en},addEventListener:(type,fn)=>{const list=events.get(type)||[];list.push(fn);events.set(type,list);},dispatchEvent:event=>{for(const fn of events.get(event.type)||[])fn(event);}};
  const context=vm.createContext({window,document,localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>{if(blocked)throw Error('quota');writes++;data.set(key,value);}},Event:class{constructor(type){this.type=type;}},Blob,URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:test';},revokeObjectURL(){}},setTimeout:fn=>{fn();return 1;},console});
  for(const file of ['journey.js','library-store.js','library.js'])vm.runInContext(fs.readFileSync(root+'/dist/'+file,'utf8'),context,{filename:file});
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.AtlasLibrary.init({maps,escape,notice:message=>notices.push(message),refresh(){},select(){}});
  const fire=(id,type,event={})=>{for(const fn of elements.get(id).listeners[type]||[])fn({preventDefault(){},...event});};
  const click=attributes=>{const target=new Element('button');for(const [key,value]of Object.entries(attributes))target.setAttribute(key,value);for(const fn of documentEvents.get('click')||[])fn({target});};
  return {el:id=>elements.get(id),window,details,sidebar,notices,blobs,merged,fire,click,stored:()=>JSON.parse(data.get(KEY)),writes:()=>writes,personalSnapshot:()=>JSON.stringify(personal.snapshot()),personalToggles:()=>personalToggles,setBlocked:value=>blocked=value,external:profile=>{data.set(KEY,JSON.stringify(profile));window.dispatchEvent({type:'storage',key:KEY});}};
}
(async()=>{
  const app=setup();
  check('library initialized before atlas-ready decorates both map-context objects',app.details.querySelector('.map-personal-tools')?.innerHTML.includes('data-library-note="1"')&&app.sidebar.querySelector('.map-personal-tools')?.innerHTML.includes('data-library-note="2"'));
  app.el('collectionName').value='Draft group';app.window.dispatchEvent({type:'atlas-languagechange'});
  check('language refresh preserves an unsaved collection name',app.el('collectionName').value==='Draft group');
  const external=empty();external.collections=[{name:'Other tab',maps:[2]}];app.external(external);
  check('cross-tab refresh updates groups without erasing local draft name',app.el('collectionName').value==='Draft group'&&app.el('libraryBody').innerHTML.includes('Other tab'));
  const before=JSON.stringify(app.stored());app.el('collectionName').value='Farm\tRoute';app.fire('personalDialog','submit',{target:app.el('collectionForm')});
  check('internal control characters cannot corrupt the stored profile',JSON.stringify(app.stored())===before&&app.notices.at(-1).startsWith('Change not saved')&&app.el('collectionName').value==='Farm\tRoute');
  app.el('collectionName').value='Valid group';app.fire('personalDialog','submit',{target:app.el('collectionForm')});
  check('successful group creation alone clears its draft',app.stored().collections.some(group=>group.name==='Valid group')&&app.el('collectionName').value==='');
  app.click({'data-library-tab':'routes'});app.el('savedRouteName').value='Route draft';app.window.dispatchEvent({type:'atlas-languagechange'});
  check('language refresh preserves an unsaved route name',app.el('savedRouteName').value==='Route draft');
  app.el('savedRouteName').value='x'.repeat(61);app.fire('personalDialog','submit',{target:app.el('saveRouteForm')});
  check('route-name limit is enforced independently of HTML maxlength',app.stored().routes.length===0&&app.el('savedRouteName').value.length===61&&app.notices.at(-1).startsWith('Change not saved'));
  app.el('savedRouteName').value='My trip';app.fire('personalDialog','submit',{target:app.el('saveRouteForm')});
  check('valid named route retains its stops and progress and clears draft',app.stored().routes[0].recipe.step===1&&app.stored().routes[0].recipe.stops[0]===2&&app.el('savedRouteName').value==='');
  app.click({'data-library-note':'1'});app.el('mapNoteText').value='invalid\0note';const notesBefore=JSON.stringify(app.stored());app.fire('mapNoteForm','submit');
  check('NUL note is rejected with dialog and user input retained',JSON.stringify(app.stored())===notesBefore&&app.el('mapNoteDialog').open&&app.el('mapNoteText').value==='invalid\0note'&&app.el('noteMessage').textContent.startsWith('Change not saved'));
  app.el('mapNoteText').value='a'.repeat(2001);app.fire('mapNoteForm','submit');
  check('oversized notes are rejected without silent truncation',app.el('mapNoteText').value.length===2001&&app.el('mapNoteDialog').open&&app.stored().notes.length===0);
  app.el('mapNoteText').value='<img src=x onerror=alert(1)>';app.fire('mapNoteForm','submit');
  check('saved notes are shown as escaped text in map decorations',app.details.querySelector('.map-personal-tools').innerHTML.includes('&lt;img')&&!app.details.querySelector('.map-personal-tools').innerHTML.includes('<img'));
  app.click({'data-library-note':'1'});app.el('mapNoteText').value='Unsaved after quota';app.setBlocked(true);app.fire('mapNoteForm','submit');
  const other=empty();other.notes=[{mapId:1,text:'Other tab value'}];app.external(other);app.click({'data-library-note':'1'});
  check('storage events cannot overwrite local note after failed persistence',!app.window.AtlasLibrary.storageOk&&app.el('mapNoteText').value==='Unsaved after quota');
  app.click({'data-library-action':'export'});const exported=JSON.parse(await app.blobs.at(-1).text());
  check('backup export preserves the in-memory note after quota failure',exported.library.notes.find(note=>note.mapId===1).text==='Unsaved after quota');
  const fresh=setup();fresh.click({'data-library-tab':'backup'});let readLarge=false;
  fresh.fire('personalDialog','change',{target:{id:'backupFile',files:[{size:4194305,text:async()=>{readLarge=true;return '{}';}}]}});await Promise.resolve();
  check('oversized backup is rejected before reading or modifying stored data',!readLarge&&fresh.writes()===0&&fresh.el('backupPreview').textContent.includes('exceeds 4MB'));
  const incoming={format:'maple-atlas-backup',version:1,personal:{favorites:[2],recent:[],journey:null},library:{...empty(),notes:[{mapId:2,text:'Imported note'}]}};
  fresh.fire('personalDialog','change',{target:{id:'backupFile',files:[{size:500,text:async()=>JSON.stringify(incoming)}]}});await new Promise(resolve=>setImmediate(resolve));
  check('valid backup preview does not mutate storage before explicit merge',fresh.writes()===0&&fresh.el('backupPreview').textContent.includes('1 notes'));
  fresh.click({'data-library-action':'import'});
  check('explicit backup merge imports validated notes and personal lists',fresh.stored().notes[0]?.mapId===2&&fresh.merged[0]?.favorites.includes(2));
  const stale=setup();stale.click({'data-library-tab':'backup'});let rejectOld;
  stale.fire('personalDialog','change',{target:{id:'backupFile',files:[{size:500,text:()=>new Promise((_,reject)=>{rejectOld=reject;})}]}});
  stale.fire('personalDialog','change',{target:{id:'backupFile',files:[{size:500,text:async()=>JSON.stringify(incoming)}]}});await new Promise(resolve=>setImmediate(resolve));
  rejectOld(Error('older file read failed'));await new Promise(resolve=>setImmediate(resolve));
  check('a stale rejected file read cannot replace a newer valid backup preview',stale.el('backupPreview').textContent.includes('1 notes')&&stale.writes()===0);
  stale.click({'data-library-action':'import'});
  check('the newer backup remains mergeable after an older file read rejects',stale.stored().notes[0]?.mapId===2&&stale.merged.length===1);
  const saved={...empty(),collections:[{name:'Field <trip>',maps:[1,2]}],notes:[{mapId:1,text:'Keep this note'}],routes:[{name:'Town loop',recipe:{from:1,to:3,stops:[2],services:false,step:1,signature:'same-route'}}]};
  const cleanup=setup(saved),journeyBefore=cleanup.personalSnapshot();
  check('group removal has an explicit escaped control',cleanup.el('libraryBody').innerHTML.includes('data-library-remove="collections" data-library-name="Field &lt;trip&gt;"'));
  cleanup.click({'data-library-remove':'collections','data-library-name':'Field <trip>'});
  check('removing a group preserves notes favorites and the active journey',cleanup.stored().collections.length===0&&JSON.stringify(cleanup.stored().notes)===JSON.stringify(saved.notes)&&cleanup.personalSnapshot()===journeyBefore&&cleanup.personalToggles()===0&&cleanup.merged.length===0);
  cleanup.el('collectionName').value='Keep draft';cleanup.window.AtlasI18n.text=(he)=>he;cleanup.window.dispatchEvent({type:'atlas-languagechange'});
  check('undo feedback is localized escaped and preserves draft input',cleanup.el('libraryRemoval').innerHTML.includes('ביטול ההסרה')&&cleanup.el('libraryRemoval').innerHTML.includes('Field &lt;trip&gt;')&&cleanup.el('collectionName').value==='Keep draft');
  cleanup.window.AtlasI18n.text=(_he,en)=>en;cleanup.click({'data-library-tab':'routes'});
  check('saved route removal is explicit and undo remains available across tabs',cleanup.el('libraryBody').innerHTML.includes('Remove saved route')&&cleanup.el('libraryUndoRemove'));
  cleanup.click({'data-library-action':'undo-remove'});
  check('undo restores the group and exact memberships without changing personal data',JSON.stringify(cleanup.stored().collections)===JSON.stringify(saved.collections)&&cleanup.personalSnapshot()===journeyBefore&&!cleanup.el('libraryUndoRemove')&&cleanup.el('libraryRemoval').innerHTML.includes('restored'));
  cleanup.click({'data-library-remove':'routes','data-library-name':'Town loop'});
  check('removing a named route preserves the active journey and map data',cleanup.stored().routes.length===0&&cleanup.personalSnapshot()===journeyBefore&&JSON.stringify(cleanup.stored().notes)===JSON.stringify(saved.notes)&&JSON.stringify(cleanup.stored().collections)===JSON.stringify(saved.collections));
  cleanup.click({'data-library-action':'undo-remove'});
  check('undo restores the exact route recipe and progress',JSON.stringify(cleanup.stored().routes)===JSON.stringify(saved.routes));
  cleanup.click({'data-library-remove':'routes','data-library-name':'Town loop'});cleanup.click({'data-library-remove':'collections','data-library-name':'Field <trip>'});cleanup.click({'data-library-action':'undo-remove'});
  check('one-step undo restores only the latest removed entry',cleanup.stored().routes.length===0&&cleanup.stored().collections.length===1);
  const limits=setup(saved);limits.click({'data-library-remove':'routes','data-library-name':'Town loop'});
  const full={...saved,routes:Array.from({length:50},(_,i)=>({name:'Route '+i,recipe:saved.routes[0].recipe}))};limits.external(full);const fullBefore=JSON.stringify(limits.stored()),fullWrites=limits.writes();limits.click({'data-library-action':'undo-remove'});
  check('undo respects the current route cap without writing or losing its action',JSON.stringify(limits.stored())===fullBefore&&limits.writes()===fullWrites&&limits.el('libraryRemoval').innerHTML.includes('50-route')&&limits.el('libraryUndoRemove'));
  full.routes.pop();limits.external(full);limits.click({'data-library-action':'undo-remove'});
  check('a blocked undo can be retried after another tab frees capacity',limits.stored().routes.length===50&&limits.stored().routes.some(route=>route.name==='Town loop'));
  const conflicts=setup(saved);conflicts.click({'data-library-remove':'collections','data-library-name':'Field <trip>'});const replacement={...saved,collections:[{name:'FIELD <TRIP>',maps:[3]}]};conflicts.external(replacement);const conflictWrites=conflicts.writes();conflicts.click({'data-library-action':'undo-remove'});
  check('undo preserves a case-insensitive conflicting group and its membership',JSON.stringify(conflicts.stored().collections)===JSON.stringify(replacement.collections)&&conflicts.writes()===conflictWrites&&conflicts.el('libraryRemoval').innerHTML.includes('already in use')&&conflicts.el('libraryUndoRemove'));
  const fullGroups={...saved,collections:Array.from({length:20},(_,i)=>({name:'Group '+i,maps:[]}))};conflicts.external(fullGroups);conflicts.click({'data-library-action':'undo-remove'});
  check('undo also respects the current group cap',conflicts.stored().collections.length===20&&conflicts.el('libraryRemoval').innerHTML.includes('20-group'));
  const routeConflict=setup(saved);routeConflict.click({'data-library-remove':'routes','data-library-name':'Town loop'});const replacementRoute={...saved,routes:[{name:'TOWN LOOP',recipe:{...saved.routes[0].recipe,step:0}}]};routeConflict.external(replacementRoute);routeConflict.click({'data-library-action':'undo-remove'});
  check('undo does not overwrite a newer saved route with a conflicting name',JSON.stringify(routeConflict.stored().routes)===JSON.stringify(replacementRoute.routes)&&routeConflict.el('libraryRemoval').innerHTML.includes('already in use'));
  limits.click({'data-library-remove':'routes','data-library-name':'Route 0'});limits.click({'data-library-tab':'routes'});limits.el('savedRouteName').value='Replacement route';limits.fire('personalDialog','submit',{target:limits.el('saveRouteForm')});
  check('removing a route at capacity permits saving a new route',limits.stored().routes.length===50&&limits.stored().routes.some(route=>route.name==='Replacement route')&&!limits.stored().routes.some(route=>route.name==='Route 0'));
  const reopened=setup(limits.stored());
  check('undo is session-local and never stored in the profile',reopened.el('libraryRemoval').hidden&&!reopened.el('libraryUndoRemove')&&!Object.hasOwn(limits.stored(),'undoRemoval'));
  const staleControl=setup(saved);staleControl.external({...saved,collections:[{name:'Different group',maps:[3]}]});const staleWrites=staleControl.writes();staleControl.click({'data-library-remove':'collections','data-library-name':'Field <trip>'});
  check('a stale remove control never deletes a different entry at its old index',staleControl.stored().collections[0].name==='Different group'&&staleControl.writes()===staleWrites);
  const quota=setup(saved);quota.setBlocked(true);quota.click({'data-library-remove':'routes','data-library-name':'Town loop'});quota.click({'data-library-action':'export'});const removedBackup=JSON.parse(await quota.blobs.at(-1).text());quota.click({'data-library-action':'undo-remove'});quota.click({'data-library-action':'export'});const undoneBackup=JSON.parse(await quota.blobs.at(-1).text());
  check('quota failure keeps removal and undo usable in memory with storage status visible',removedBackup.library.routes.length===0&&JSON.stringify(undoneBackup.library.routes)===JSON.stringify(saved.routes)&&quota.el('libraryStatus').textContent.includes('Storage is unavailable'));
  const failures=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
