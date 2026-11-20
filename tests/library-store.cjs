'use strict';
// Exercise the actual pure import contract with the actual journey normalizer.
// Rendering, file-size limits before parsing, and storage writes belong to library.js.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.join(__dirname,'../dist'),context=vm.createContext({});
for(const name of ['journey.js','library-store.js'])vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),context,{filename:name});
const atlas=JSON.parse(fs.readFileSync(path.join(base,'atlas-data.json'),'utf8'));
const maps=new Map(atlas.maps.map(map=>[map.id,map]));
const store=context.AtlasLibraryStore.create(maps,context.AtlasJourney.normalizeRecipe);
const limits=context.AtlasLibraryStore.LIMITS,results=[];
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=clone;
function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const reject=fn=>assert.throws(fn,/invalid-backup/);
const goal=()=>({kind:'hunt',targets:[{kind:'item',id:1092002},{kind:'monster',id:2}],monsterIds:[2,3]});
const recipe=()=>({from:10001000,to:10002000,stops:[10001005],services:true,step:2,goal:goal(),signature:'recorded-path-signature'});
const profile=()=>({version:1,origin:10001000,notes:[{mapId:10001005,text:'Check the upper portal.\nThen return.'}],collections:[{name:'Forest trip',maps:[10001000,10001005]}],routes:[{name:'Trip to Ellinia',recipe:recipe()}]});
const backup=()=>({format:'maple-atlas-backup',version:1,personal:{favorites:[10001000,10001005],recent:[10002000],journey:recipe()},library:profile()});

check('valid backup round-trips exact map IDs, stops, hunting purpose and signature',()=>{
  const normalized=store.backup(backup());assert.deepEqual(plain(normalized),backup());assert.deepEqual(plain(store.backup(JSON.parse(JSON.stringify(normalized)))),plain(normalized));
});
check('normalization creates independent nested data without mutating the input',()=>{
  const input=backup(),before=clone(input),output=store.backup(input);output.library.notes[0].text='changed';output.library.collections[0].maps.push(10002000);output.personal.journey.goal.targets[0].id=2;
  assert.deepEqual(input,before);
});
check('only known numeric map IDs are accepted at every imported map location',()=>{
  const changes=[b=>b.personal.favorites.push(999999999),b=>b.personal.recent.push('10001000'),b=>b.library.origin=999999999,b=>b.library.notes[0].mapId=-1,b=>b.library.collections[0].maps.push(Number.MAX_SAFE_INTEGER+1),b=>b.library.routes[0].recipe.from=999999999,b=>b.personal.journey.to=null,b=>b.personal.journey.stops.push(999999999)];
  for(const change of changes){const value=backup();change(value);reject(()=>store.backup(value));}
});
check('backup format and version require exact allowed values and object shapes',()=>{
  for(const value of [null,[],{},'backup',{...backup(),format:'other'},{...backup(),version:'1'},{...backup(),version:2},{...backup(),personal:[]},{...backup(),library:null}])reject(()=>store.backup(value));
});
check('profile lists cannot be replaced by objects, strings or missing values',()=>{
  for(const key of ['notes','collections','routes'])for(const bad of [null,{},'[]',undefined]){const value=profile();value[key]=bad;reject(()=>store.profile(value));}
});
check('map lists deduplicate known IDs but reject excessive raw list sizes',()=>{
  const value=backup();value.personal.favorites.push(10001000);value.library.collections[0].maps.push(10001005);assert.equal(store.backup(value).personal.favorites.length,2);assert.equal(store.backup(value).library.collections[0].maps.length,2);
  value.personal.favorites=Array(maps.size+1).fill(10001000);reject(()=>store.backup(value));
  value.personal.favorites=[];value.personal.recent=Array(21).fill(10001000);reject(()=>store.backup(value));
});
check('note text accepts the maximum and rejects oversized, nontext, NUL and duplicate notes',()=>{
  const value=profile();value.notes[0].text='a'.repeat(limits.noteLength);assert.equal(store.profile(value).notes[0].text.length,limits.noteLength);
  for(const text of ['a'.repeat(limits.noteLength+1),null,42,'bad\0text']){value.notes[0].text=text;reject(()=>store.profile(value));}
  value.notes=[{mapId:10001000,text:'First'},{mapId:10001000,text:'Overwrite'}];reject(()=>store.profile(value));
  value.notes=Array(maps.size+1).fill({mapId:10001000,text:''});reject(()=>store.profile(value));
});
check('notes remain inert text and can contain newlines, tabs and markup for the renderer to escape',()=>{
  const value=profile();value.notes[0].text='<img src=x onerror=alert(1)>\n\t__proto__';assert.equal(store.profile(value).notes[0].text,value.notes[0].text);
});
check('route and collection names are trimmed, bounded and reject control characters',()=>{
  const value=profile();value.routes[0].name='  Route name  ';value.collections[0].name='  My maps  ';const parsed=store.profile(value);assert.equal(parsed.routes[0].name,'Route name');assert.equal(parsed.collections[0].name,'My maps');
  for(const name of ['', '  ','x'.repeat(61),'bad\nname','bad\u007fname',12]){const invalid=profile();invalid.routes[0].name=name;reject(()=>store.profile(invalid));}
  for(const name of ['x'.repeat(41),'bad\tname']){const invalid=profile();invalid.collections[0].name=name;reject(()=>store.profile(invalid));}
  value.routes[0].name='x'.repeat(60);value.collections[0].name='x'.repeat(40);store.profile(value);
});
check('duplicate names are rejected case-insensitively after trimming',()=>{
  const value=profile();value.routes.push({name:'  TRIP TO ELLINIA ',recipe:recipe()});reject(()=>store.profile(value));
  value.routes.pop();value.collections.push({name:' FOREST TRIP ',maps:[]});reject(()=>store.profile(value));
});
check('route and collection totals enforce the advertised bounds',()=>{
  const value=profile();value.routes=Array.from({length:50},(_,i)=>({name:'Route '+i,recipe:recipe()}));value.collections=Array.from({length:20},(_,i)=>({name:'Group '+i,maps:[]}));store.profile(value);
  value.routes.push({name:'Route 51',recipe:recipe()});reject(()=>store.profile(value));value.routes.pop();value.collections.push({name:'Group 21',maps:[]});reject(()=>store.profile(value));
});
check('journey contracts reject malformed stops, services and progress',()=>{
  const changes=[r=>r.stops=Array(9).fill(10001000),r=>r.stops='10001000',r=>r.services='true',r=>r.step=-1,r=>r.step=1.5,r=>r.step=10001,r=>r.from='10001000'];
  for(const change of changes){const value=recipe();change(value);reject(()=>store.recipe(value));}
  const value=recipe();value.stops=Array(8).fill(10001000);store.recipe(value);
});
check('backup progress obeys the same map-and-stop bound as personal journey restoration',()=>{
  const value=backup();value.personal.journey.step=10000;reject(()=>store.backup(value));
  value.personal.journey.step=maps.size*(1+value.personal.journey.stops.length);assert.equal(store.backup(value).personal.journey.step,value.personal.journey.step);
  value.personal.journey.step++;reject(()=>store.backup(value));
  value.personal.journey.step=0;value.library.routes[0].recipe.step=maps.size*(1+value.library.routes[0].recipe.stops.length)+1;reject(()=>store.backup(value));
});
check('hunting goals enforce types, eight targets, safe IDs and 128 monster IDs',()=>{
  const changes=[g=>g.kind='npc',g=>g.targets=[],g=>g.targets=Array(9).fill({kind:'item',id:1092002}),g=>g.targets[0].kind='script',g=>g.targets[0].id='1092002',g=>g.targets[0].id=-1,g=>g.targets[0].id=Infinity,g=>g.monsterIds=Array(129).fill(2),g=>g.monsterIds.push(Number.MAX_SAFE_INTEGER+1),g=>g.monsterIds=[2.5]];
  for(const change of changes){const value=recipe();change(value.goal);reject(()=>store.recipe(value));}
  const value=recipe();value.goal.targets=Array.from({length:8},(_,i)=>({kind:'monster',id:i+1}));value.goal.monsterIds=Array.from({length:128},(_,i)=>i+1);assert.equal(store.recipe(value).goal.targets.length,8);
});
check('hunting goal duplicate IDs are normalized without foreign fields',()=>{
  const value=recipe();value.goal.targets.push({...value.goal.targets[0],html:'<script>'});value.goal.monsterIds.push(2);value.goal.origin='untrusted';value.goal.targets[0].name='<img>';const parsed=store.recipe(value);
  assert.equal(parsed.goal.targets.length,2);assert.equal(parsed.goal.monsterIds.length,2);assert(!Object.hasOwn(parsed.goal,'origin'));assert(!Object.hasOwn(parsed.goal.targets[0],'name'));
});
check('unknown fields are discarded at every backup nesting level',()=>{
  const value=backup();value.token='secret';value.personal.url='https://attacker.test';value.library.html='<script>';value.library.notes[0].url='javascript:bad';value.library.collections[0].permission='admin';value.library.routes[0].execute='command';value.personal.journey.password='secret';value.personal.journey.goal.targets[0].link='javascript:bad';
  const parsed=store.backup(value);assert.deepEqual(plain(parsed),backup());
});
check('JSON prototype-pollution keys are ignored without affecting local or VM prototypes',()=>{
  const value=JSON.parse(JSON.stringify(backup()).replace('"format":','"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"format":'));
  Object.assign(value.library.notes[0],JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true}}'));
  const parsed=store.backup(value);assert(!Object.hasOwn(parsed,'__proto__'));assert(!Object.hasOwn(parsed,'constructor'));assert(!Object.hasOwn(parsed.library.notes[0],'constructor'));assert.equal({}.polluted,undefined);assert.equal(vm.runInContext('({}).polluted',context),undefined);
});
check('signature metadata remains bounded and cannot add recipe fields',()=>{
  const value=recipe();value.signature='x'.repeat(30001);assert.equal(store.recipe(value).signature.length,30000);value.signature={html:'bad'};assert.equal(store.recipe(value).signature,'');
  value.signature='opaque literal <script>';assert.equal(store.recipe(value).signature,value.signature);
});
check('merge preserves existing notes, named routes and chosen origin',()=>{
  const current=profile(),incoming=profile();incoming.origin=10002000;incoming.notes[0].text='Imported overwrite';incoming.routes[0].name='TRIP TO ELLINIA';incoming.routes[0].recipe.to=10003000;
  const result=store.merge(current,incoming);assert.deepEqual(plain(result.profile.notes),current.notes);assert.deepEqual(plain(result.profile.routes),current.routes);assert.equal(result.profile.origin,current.origin);assert.equal(result.skipped.notes,1);assert.equal(result.skipped.routes,1);
});
check('merge adds new records, unions collection IDs and fills only an unset origin',()=>{
  const current=profile(),incoming=profile();current.origin=null;incoming.notes.push({mapId:10002000,text:'New note'});incoming.collections[0].maps.push(10002000);incoming.routes.push({name:'New route',recipe:recipe()});
  const before=clone(current),result=store.merge(current,incoming);assert.equal(result.profile.origin,10001000);assert.equal(result.profile.notes.length,2);assert.equal(result.profile.routes.length,2);assert.deepEqual(plain(result.profile.collections[0].maps),[10001000,10001005,10002000]);assert.deepEqual(current,before);
});
check('merge respects full route and collection capacities and reports skipped imports',()=>{
  const current=profile(),incoming=profile();current.routes=Array.from({length:50},(_,i)=>({name:'Existing '+i,recipe:recipe()}));current.collections=Array.from({length:20},(_,i)=>({name:'Existing '+i,maps:[10001000]}));
  const result=store.merge(current,incoming);assert.equal(result.profile.routes.length,50);assert.equal(result.profile.collections.length,20);assert.equal(result.skipped.routes,1);assert.equal(result.skipped.collections,1);
});
check('invalid import fails before a partially merged profile can escape',()=>{
  const current=profile(),incoming=profile(),before=clone(current);incoming.notes.push({mapId:999999999,text:'Bad map'});reject(()=>store.merge(current,incoming));assert.deepEqual(current,before);
});
const failures=results.filter(result=>!result.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
