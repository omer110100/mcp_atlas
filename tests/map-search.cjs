'use strict';
// Shared matching and combobox DOM-contract tests; no browser/layout assertions.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'dist/map-search.js'),'utf8');
const atlas=JSON.parse(fs.readFileSync(path.join(root,'dist/atlas-data.json'),'utf8'));
const results=[],check=(name,passed)=>results.push({name,passed:!!passed});
class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.listeners={};this.value='';this.nodeType=1;this.parentElement=null;this.hidden=false;}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  append(...nodes){for(const n of nodes){if(n.parentElement){const i=n.parentElement.children.indexOf(n);if(i>=0)n.parentElement.children.splice(i,1);}this.children.push(n);n.parentElement=this;}}
  before(node){if(!this.parentElement)throw Error('input must be attached');const p=this.parentElement;p.children.splice(p.children.indexOf(this),0,node);node.parentElement=p;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(event){event.target=this;for(const fn of this.listeners[event.type]||[])fn(event);return !event.defaultPrevented;}
  querySelectorAll(selector){let found=[];for(const c of this.children){if(c.matches(selector))found.push(c);found.push(...c.querySelectorAll(selector));}return found;}
  matches(selector){return selector.split(',').some(s=>s.trim()==='#'+this.id);}
  closest(selector){if(selector==='[data-lookup-index]'&&this.dataset.lookupIndex!==undefined)return this;return this.parentElement?.closest(selector)||null;}
  scrollIntoView(){this.scrolled=true;}
}
class Event{
  constructor(type,options={}){this.type=type;Object.assign(this,options);}
  preventDefault(){this.defaultPrevented=true;}
  stopPropagation(){this.stopped=true;}
}
const document=new Element('document');document.body=new Element('body');document.append(document.body);document.createElement=tag=>new Element(tag);
const field=id=>{const input=new Element('input');input.id=id;input.setAttribute('list','mapOptions');document.body.append(input);return input;};
const from=field('routeFrom'),to=field('routeTo');let observer;
const languageListeners=[];
const ctx=vm.createContext({window:{addEventListener(type,fn){if(type==='atlas-languagechange')languageListeners.push(fn);}},document,Event,MutationObserver:class{constructor(fn){this.callback=fn;observer=this;}observe(target,options){this.target=target;this.options=options;}}});
vm.runInContext(fs.readFileSync(path.join(root,'dist/translations.js'),'utf8'),ctx);
vm.runInContext(source,ctx);const search=ctx.window.MapSearch;
const group=m=>{const he=atlas.groups.find(g=>g.id===m.group)?.he||'';return ctx.window.AtlasI18n?.language==='en'?ctx.window.AtlasTranslations[he]||he:he;};
search.init({maps:atlas.maps,groupLabel:group});
check('known ID selects exactly its record',search.resolve('10002000')?.name==='Ellinia');
check('selected label resolves by unique ID',search.resolve('Ellinia [10002000]')?.id===10002000);
check('unrecognized ID is rejected',search.resolve('999999999')===null);
check('unsafe numeric ID is rejected',search.resolve('9007199254740993')===null);
check('empty or whitespace value cannot select a default map',search.resolve('   ')===null);
check('partial English name requires an explicit suggestion selection',search.resolve('elli')===null);
for(const [text,id]of [['הנסיס',10001000],['אליניה',10002000],['קרנינג',10003000],['פריון',10004000],['סליפי ווד',10005000],['לית׳ הארבור',10000000],['חוף פלורינה',10007000],['החלל הנשכח',10006000],['אמהרסט',1010],['סאות פרי',60]]){
  check(`Hebrew alias ${text} resolves to expected map`,search.resolve(text)?.id===id);
  check(`Hebrew alias ${text} ranks town first in suggestions`,search.search(text)[0]?.id===id);
}
check('Hebrew alias of a duplicate map name remains ambiguous',search.resolve('עיר הפטריות')===null);
check('ambiguous Hebrew city alias still offers main town with ID',search.search('עיר הפטריות')[0]?.id===20);
check('English search is case-insensitive and trims whitespace',search.search(' ELLINIA ')[0]?.id===10002000);
check('selected label stays discoverable on focus',search.search('Ellinia [10002000]')[0]?.id===10002000);
check('Hebrew partial alias matches relevant map names',search.search('אליני',atlas.maps.length).some(m=>m.id===10002000));
check('Hebrew region labels are searchable',search.search('והיערות',atlas.maps.length).length>5);
check('default suggestions are bounded',search.search('').length===8);
check('full-list caller receives every map',search.search('',atlas.maps.length).length===atlas.maps.length);
check('explicit zero limit yields no suggestions',search.search('',0).length===0);
check('unknown text yields empty result',search.search('this map does not exist 999').length===0);
const names=new Map();for(const m of atlas.maps){const key=m.name.toLowerCase();names.set(key,[...(names.get(key)||[]),m]);}
const duplicate=[...names].find(([,list])=>list.length>1);
check('duplicate exact names remain ambiguous',!!duplicate&&search.resolve(duplicate[0])===null);
check('duplicate map identity can still be selected explicitly',!!duplicate&&search.resolve(`${duplicate[0]} [${duplicate[1][0].id}]`)?.id===duplicate[1][0].id);
check('init removes native datalist and establishes combobox semantics',from.getAttribute('list')===null&&from.getAttribute('role')==='combobox'&&from.getAttribute('aria-expanded')==='false');
check('Hebrew/English direction follows typed value',from.getAttribute('dir')==='auto');
const holder=from.parentElement,list=holder.children[1],note=holder.children[2];
from.value='עיר הפטריות';from.dispatchEvent(new Event('input'));const ambiguousEnter=new Event('keydown',{key:'Enter'});from.dispatchEvent(ambiguousEnter);
check('Enter cannot silently choose one of several exact-name maps',!ambiguousEnter.defaultPrevented&&from.value==='עיר הפטריות');
from.value='הנסיס';from.dispatchEvent(new Event('input'));
check('typing opens a labelled listbox',!list.hidden&&list.getAttribute('role')==='listbox'&&from.getAttribute('aria-controls')===list.id);
check('suggestions expose map IDs to disambiguate names',list.children[0].children[1].textContent.includes('10001000'));
const down=new Event('keydown',{key:'ArrowDown'});from.dispatchEvent(down);
check('arrow selects accessible active descendant without moving focus',down.defaultPrevented&&from.getAttribute('aria-activedescendant')===list.children[0].id&&list.children[0].getAttribute('aria-selected')==='true');
let changes=0;from.addEventListener('change',()=>changes++);const enter=new Event('keydown',{key:'Enter'});from.dispatchEvent(enter);
check('Enter chooses full name and ID and emits change',enter.defaultPrevented&&from.value==='Henesys [10001000]'&&changes===1&&list.hidden);
check('selection clears active descendant and closed state',from.getAttribute('aria-expanded')==='false'&&from.getAttribute('aria-activedescendant')===null);
from.value='אליניה';from.dispatchEvent(new Event('input'));const escape=new Event('keydown',{key:'Escape'});from.dispatchEvent(escape);
check('Escape closes suggestions without choosing a map',escape.stopped&&list.hidden&&from.value==='אליניה'&&changes===1);
from.value='unlikely unknown map 434';from.dispatchEvent(new Event('input'));const noMatchEnter=new Event('keydown',{key:'Enter'});from.dispatchEvent(noMatchEnter);
check('empty results provide instruction and cannot select stale option',note.textContent.includes('לא נמצאו')&&list.children[0].textContent.includes('לא נמצאה')&&!noMatchEnter.defaultPrevented&&changes===1);
from.value='הנסיס';from.dispatchEvent(new Event('input'));from.dispatchEvent(new Event('blur'));
check('blur closes popup',list.hidden);
from.dispatchEvent(new Event('focus'));const option=list.children[0],pointer=new Event('pointerdown',{target:option});
list.listeners.pointerdown[0](pointer);list.listeners.click[0](new Event('click',{target:option.children[0]}));
check('clicking nested option label preserves focus and selects map',pointer.defaultPrevented&&from.value==='Henesys [10001000]'&&changes===2&&list.hidden);
search.attach(from);check('repeated attach does not nest wrappers',from.parentElement===holder&&holder.parentElement===document.body);
const origin=field('huntOrigin');observer.callback([{addedNodes:[origin]}]);
check('dynamic hunt origin receives the same combobox',origin.parentElement.className==='map-lookup'&&origin.getAttribute('list')===null);
const oldHolder=origin.parentElement;observer.callback([{addedNodes:[oldHolder]}]);
check('observer can see its own wrapper mutation without duplicating attachment',origin.parentElement===oldHolder&&oldHolder.parentElement===document.body);
from.value='';from.dispatchEvent(new Event('input'));check('broad search announces truncation rather than implying complete results',note.textContent.includes('8 מתוך'));
from.dispatchEvent(new Event('keydown',{key:'ArrowUp'}));check('up arrow starts from last suggested option',from.getAttribute('aria-activedescendant')===list.children[7].id);
from.dispatchEvent(new Event('keydown',{key:'Tab'}));check('Tab closes list without trapping keyboard',list.hidden);
let current=origin;const detached=[];
for(let i=0;i<15;i++){
  current.value='unlikely unknown map';current.dispatchEvent(new Event('focus'));
  const removed=current.parentElement;detached.push(removed.children[1]);
  document.body.children.splice(document.body.children.indexOf(removed),1);removed.parentElement=null;
  current=field('huntOrigin');observer.callback([{addedNodes:[current]}]);
}
current.value='אליניה';current.dispatchEvent(new Event('input'));
ctx.window.AtlasI18n={language:'en'};languageListeners.forEach(fn=>fn());
const currentList=current.parentElement.children[1],currentNote=current.parentElement.children[2];
check('recreated hunt origins share one language listener',languageListeners.length===1);
check('language switch never touches detached comboboxes',detached.every(box=>box.getAttribute('aria-label')==='הצעות למפת משחק'&&box.children[0].textContent.includes('לא נמצאה')));
check('open combobox localizes suggestions while preserving the typed Hebrew query',current.value==='אליניה'&&currentList.getAttribute('aria-label')==='Game map suggestions'&&!/[\u0590-\u05ff]/.test(currentList.children[0].children[1].textContent)&&currentNote.textContent.includes('Showing 8 of'));
check('closed connected combobox labels also update on language change',list.hidden&&list.getAttribute('aria-label')==='Game map suggestions');
check('English region search remains available after language change',search.search('Forests',atlas.maps.length).length>5);
const failures=results.filter(r=>!r.passed);console.log(JSON.stringify({checks:results.length,failed:failures.length,failures}));process.exitCode=failures.length?1:0;
