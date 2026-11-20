'use strict';
// Bounded, allow-listed personal data. This module never renders or performs I/O.
(() => {
  const LIMITS={routes:50,collections:20,noteLength:2000,nameLength:60,bytes:4194304};
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function create(maps,normalizeRecipe){
    const validId=id=>Number.isSafeInteger(id)&&maps.has(id);
    const fail=()=>{throw new Error('invalid-backup');};
    function ids(value,limit=maps.size){if(!Array.isArray(value)||value.length>limit||value.some(id=>!validId(id)))return fail();return [...new Set(value)];}
    function name(value,max=LIMITS.nameLength){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))return fail();return value.trim();}
    function recipe(value){const r=normalizeRecipe(value,maps);if(!r||r.step>maps.size*(1+r.stops.length))return fail();return {...r,signature:typeof value.signature==='string'?value.signature.slice(0,30000):''};}
    function profile(value){
      if(!object(value)||value.version!==1)return fail();
      const origin=value.origin==null?null:value.origin;if(origin!==null&&!validId(origin))return fail();
      if(!Array.isArray(value.notes)||value.notes.length>maps.size||!Array.isArray(value.collections)||value.collections.length>LIMITS.collections||!Array.isArray(value.routes)||value.routes.length>LIMITS.routes)return fail();
      const noteIds=new Set(),collectionNames=new Set(),routeNames=new Set();
      const notes=value.notes.map(n=>{if(!object(n)||!validId(n.mapId)||noteIds.has(n.mapId)||typeof n.text!=='string'||n.text.length>LIMITS.noteLength||n.text.includes('\0'))return fail();noteIds.add(n.mapId);return {mapId:n.mapId,text:n.text};});
      const collections=value.collections.map(c=>{if(!object(c))return fail();const label=name(c.name,40);if(collectionNames.has(label.toLowerCase()))return fail();collectionNames.add(label.toLowerCase());return {name:label,maps:ids(c.maps)};});
      const routes=value.routes.map(r=>{if(!object(r))return fail();const label=name(r.name);if(routeNames.has(label.toLowerCase()))return fail();routeNames.add(label.toLowerCase());return {name:label,recipe:recipe(r.recipe)};});
      return {version:1,origin,notes,collections,routes};
    }
    function backup(value){
      if(!object(value)||value.format!=='maple-atlas-backup'||value.version!==1||!object(value.personal))return fail();
      return {format:'maple-atlas-backup',version:1,personal:{favorites:ids(value.personal.favorites),recent:ids(value.personal.recent,20),journey:value.personal.journey==null?null:recipe(value.personal.journey)},library:profile(value.library)};
    }
    function merge(current,incoming){
      const result=profile(current),other=profile(incoming),skipped={notes:0,routes:0,collections:0};
      if(result.origin===null)result.origin=other.origin;
      for(const note of other.notes){if(result.notes.some(n=>n.mapId===note.mapId)){skipped.notes++;continue;}result.notes.push(note);}
      for(const group of other.collections){const existing=result.collections.find(c=>c.name.toLowerCase()===group.name.toLowerCase());if(existing)existing.maps=[...new Set([...existing.maps,...group.maps])];else if(result.collections.length<LIMITS.collections)result.collections.push(group);else skipped.collections++;}
      for(const route of other.routes){if(result.routes.some(r=>r.name.toLowerCase()===route.name.toLowerCase())||result.routes.length>=LIMITS.routes){skipped.routes++;continue;}result.routes.push(route);}
      return {profile:result,skipped};
    }
    return {profile,backup,merge,recipe,validId};
  }
  globalThis.AtlasLibraryStore={LIMITS,create};
})();
