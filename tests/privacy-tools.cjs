'use strict';
// Real standalone privacy/language controllers in a deterministic DOM/storage harness.
// No network, production access or real browser storage is used.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),privacySource=fs.readFileSync(path.join(root,'dist/privacy-tools.js'),'utf8'),legalSource=fs.readFileSync(path.join(root,'dist/legal.js'),'utf8');
const KEYS=['maple-atlas-language-v1','maple-atlas-appearance-v1','maple-atlas-experience-v1','maple-atlas-personal-v1','maple-atlas-library-v1','maple-atlas-location-v1','maple-atlas-world-view-v1'];
const SIGNAL='maple-atlas-reset-signal-v1',results=[];
const check=(name,passed,detail)=>results.push({name,passed:!!passed,...detail===undefined?{}:{detail}});

class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.attrs={};this.dataset={};this.children=[];this.listeners={};this.hidden=false;this.checked=false;this.disabled=false;this._text='';}
  setAttribute(key,value){this.attrs[key]=String(value);if(key==='id')this.id=String(value);if(key==='class')this.className=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this._text=String(value??'');this.children=[];}
  set innerHTML(_){throw Error('Privacy and language controllers must not parse dynamic HTML.');}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  after(node){const siblings=this.parentElement?.children;if(siblings){node.parentElement=this.parentElement;siblings.splice(siblings.indexOf(this)+1,0,node);}}
  addEventListener(name,handler){(this.listeners[name]??=[]).push(handler);}
  fire(name,event={}){for(const handler of this.listeners[name]||[])handler({target:this,...event});}
  matches(selector){if(selector.startsWith('.'))return (this.className||'').split(/\s+/).includes(selector.slice(1));if(selector.startsWith('[')){const attributes=[...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];return attributes.length&&attributes.every(([,key,value])=>this.getAttribute(key)!==null&&(value===undefined||this.getAttribute(key)===value));}return this.tagName.toLowerCase()===selector;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}

function setup({page='legal',language='en',search='',saved={},withLegal=false,blockedRead=[],blockedRemove=[],blockedWrite=[],stickyRemove=[]}={}){
  const html=new Element('html'),body=new Element('body');html.lang=language;html.dir=language==='en'?'ltr':'rtl';html.append(body);
  const add=(tag,id,parent=body)=>{const node=new Element(tag);node.id=id;parent.append(node);return node;};
  if(page==='legal')add('div','localDataTools');
  else{
    add('div','mapCanvas');add('section','aboutPanel-overview');add('div','aboutTools');add('a','experienceReport');
    const brand=add('a','brand'),name=add('span','brandName',brand);name.className='brand-en';
  }
  add('p','languageStatus');
  for(const locale of ['he','en']){const content=add('section','locale-'+locale);content.setAttribute('data-locale',locale);const button=add('button','language-'+locale);button.setAttribute('data-set-language',locale);}
  const nav=add('nav','informationNav');nav.setAttribute('data-aria-he','נושאי מידע');nav.setAttribute('data-aria-en','Information topics');
  const document={documentElement:html,body,createElement:tag=>new Element(tag),getElementById:id=>{const visit=node=>node.id===id?node:node.children.map(visit).find(Boolean);return visit(html)||null;},querySelector:selector=>html.querySelector(selector),querySelectorAll:selector=>html.querySelectorAll(selector)};
  const values=new Map(Object.entries(saved)),calls=[],listeners=new Map(),replaceCalls=[],networkCalls=[];
  const failures={read:new Set(blockedRead),remove:new Set(blockedRemove),write:new Set(blockedWrite),sticky:new Set(stickyRemove)};
  const storage={
    getItem(key){calls.push({op:'get',key});if(failures.read.has('*')||failures.read.has(key))throw Error('blocked read');return values.get(key)??null;},
    removeItem(key){calls.push({op:'remove',key});if(failures.remove.has('*')||failures.remove.has(key))throw Error('blocked remove');if(!failures.sticky.has(key))values.delete(key);},
    setItem(key,value){calls.push({op:'set',key,value:String(value)});if(failures.write.has('*')||failures.write.has(key))throw Error('blocked write');values.set(key,String(value));},
    clear(){throw Error('Unscoped origin deletion is forbidden.');}
  };
  const window={addEventListener(name,handler){const handlers=listeners.get(name)||[];handlers.push(handler);listeners.set(name,handlers);},dispatchEvent(event){for(const handler of listeners.get(event.type)||[])handler(event);}};
  const location={pathname:page==='legal'?'/legal.html':'/atlas/',search,hash:'#route=private-route',replace:value=>replaceCalls.push(value)};
  const context=vm.createContext({document,window,localStorage:storage,location,URLSearchParams,Event:class{constructor(type){this.type=type;}},Date,fetch:()=>{networkCalls.push('fetch');throw Error('Network is forbidden in this harness.');},XMLHttpRequest:class{constructor(){networkCalls.push('xhr');throw Error('Network is forbidden in this harness.');}}});
  if(withLegal)vm.runInContext(legalSource,context);
  vm.runInContext(privacySource,context);
  const controls=()=>{const target=document.getElementById('localDataTools');return {target,checkbox:document.getElementById('confirmLocalErase'),button:target?.querySelector('button'),status:target?.querySelector('[role="status"]')};};
  const confirm=()=>{const {checkbox}=controls();checkbox.checked=true;checkbox.fire('change');};
  return {document,window,values,calls,failures,replaceCalls,networkCalls,controls,confirm,storageEvent:event=>window.dispatchEvent({type:'storage',storageArea:storage,...event})};
}

const stored=()=>Object.fromEntries([...KEYS.map((key,index)=>[key,`private-value-${index}`]),['another-app','keep-me'],['maple-atlas-unrelated-v1','keep-this-too']]);
const initial=setup({saved:stored()});
check('loading the privacy controls never deletes, overwrites or broadcasts data',initial.calls.every(call=>call.op==='get')&&initial.values.size===9&&initial.replaceCalls.length===0);
check('destructive control begins unchecked and disabled with an accessible status',!initial.controls().checkbox.checked&&initial.controls().button.disabled&&initial.controls().status.getAttribute('aria-live')==='polite');
initial.controls().button.fire('click');
check('a forged click without checkbox confirmation cannot erase anything',initial.values.size===9&&!initial.calls.some(call=>call.op==='remove'||call.op==='set'));
initial.confirm();
check('explicit confirmation enables deletion',!initial.controls().button.disabled);
initial.controls().checkbox.checked=false;initial.controls().checkbox.fire('change');initial.controls().button.fire('click');
check('revoking confirmation disables deletion and the click guard still applies',initial.controls().button.disabled&&initial.values.size===9);
initial.confirm();initial.controls().button.fire('click');
check('confirmed erasure removes exactly the seven atlas data keys',KEYS.every(key=>!initial.values.has(key))&&initial.calls.filter(call=>call.op==='remove'&&call.key!==SIGNAL).map(call=>call.key).sort().join('|')===[...KEYS].sort().join('|'));
check('unrelated origin storage survives including similarly prefixed keys',initial.values.get('another-app')==='keep-me'&&initial.values.get('maple-atlas-unrelated-v1')==='keep-this-too');
check('successful erasure requires a fresh confirmation for another attempt',!initial.controls().checkbox.checked&&initial.controls().button.disabled&&initial.controls().status.textContent.includes('has been erased'));
const signalWrite=initial.calls.findIndex(call=>call.op==='set'&&call.key===SIGNAL),lastDataRemoval=Math.max(...initial.calls.map((call,index)=>call.op==='remove'&&KEYS.includes(call.key)?index:-1));
check('reset signal is emitted only after all seven deletions succeed',signalWrite>lastDataRemoval&&initial.calls.filter(call=>call.op==='set').length===1&&/^\d+$/.test(initial.calls[signalWrite].value)&&!initial.values.has(SIGNAL));
check('privacy notices explain backups, external records and stale tabs',/Downloaded backups/.test(initial.controls().target.textContent)&&/not erased here/.test(initial.controls().target.textContent)&&/Close other atlas tabs/.test(initial.controls().target.textContent));

for(const [label,options]of [['blocked deletion',{blockedRemove:[KEYS[3]]}],['blocked verification',{blockedRead:[KEYS[3]]}],['silent failed deletion',{stickyRemove:[KEYS[3]]}]]){
  const instance=setup({saved:stored(),...options});instance.confirm();instance.controls().button.fire('click');
  check(`${label}: partial erasure never claims success or sends a reset signal`,instance.controls().status.textContent.includes('Some data could not be erased')&&!instance.controls().status.textContent.includes('has been erased')&&!instance.calls.some(call=>call.op==='set'&&call.key===SIGNAL));
  check(`${label}: unrelated storage survives and retry remains possible`,instance.values.get('another-app')==='keep-me'&&!instance.controls().button.disabled&&instance.controls().checkbox.checked);
}
const blocked=setup({saved:stored(),blockedRemove:['*']});blocked.confirm();blocked.controls().button.fire('click');
check('fully blocked storage leaves all records intact and reports the failure',blocked.values.size===9&&blocked.controls().status.textContent.includes('storage is blocked')&&!blocked.calls.some(call=>call.op==='set'));
blocked.failures.remove.clear();blocked.controls().button.fire('click');
check('retry succeeds after storage becomes available without clearing other apps',blocked.values.size===2&&blocked.controls().status.textContent.includes('has been erased')&&blocked.calls.filter(call=>call.op==='set'&&call.key===SIGNAL).length===1);
const signalBlocked=setup({saved:stored(),blockedWrite:[SIGNAL]});signalBlocked.confirm();signalBlocked.controls().button.fire('click');
check('signal failure does not throw or restore erased data and the close-tabs warning remains',KEYS.every(key=>!signalBlocked.values.has(key))&&signalBlocked.controls().target.textContent.includes('Close other atlas tabs')&&signalBlocked.values.get('another-app')==='keep-me');

const app=setup({page:'app',saved:stored()});
check('loading the app-side listener does not clear data or navigate',app.values.size===9&&app.replaceCalls.length===0&&!app.calls.some(call=>call.op==='remove'));
for(const event of [{key:'another-app',newValue:'changed'},{key:KEYS[3],newValue:'changed'},{key:null,newValue:null},{key:SIGNAL,newValue:null},{key:SIGNAL,newValue:''}])app.storageEvent(event);
check('unrelated storage changes and signal removal cannot trigger erasure or reload',app.values.size===9&&app.replaceCalls.length===0&&!app.calls.some(call=>call.op==='remove'));
app.storageEvent({key:SIGNAL,newValue:'123456'});
check('confirmed reset in another tab erases app keys and reloads the active app context',KEYS.every(key=>!app.values.has(key))&&app.replaceCalls.length===1&&app.replaceCalls[0]==='/atlas/');
check('cross-tab reset strips old route fragments and queries and preserves unrelated storage',!/[?#]/.test(app.replaceCalls[0])&&app.values.get('another-app')==='keep-me'&&app.values.get('maple-atlas-unrelated-v1')==='keep-this-too');
check('receiving a reset never re-broadcasts it into a reload loop',!app.calls.some(call=>call.op==='set'));
const appBlocked=setup({page:'app',saved:stored(),blockedRemove:['*']});appBlocked.storageEvent({key:SIGNAL,newValue:'123457'});
check('a receiving tab still reloads stale application memory when its storage access fails',appBlocked.replaceCalls.length===1&&appBlocked.replaceCalls[0]==='/atlas/'&&appBlocked.values.get('another-app')==='keep-me');
const notice=setup({saved:stored()});notice.confirm();notice.storageEvent({key:SIGNAL,newValue:'123458'});
check('a receiving legal page refreshes its controls without destructive second erasure',notice.replaceCalls.length===0&&!notice.calls.some(call=>call.op==='remove')&&!notice.controls().checkbox.checked&&notice.controls().button.disabled);
check('app owner links and public-report warning use safe external-opening attributes',app.document.getElementById('ownerNotice').querySelector('a').target==='_blank'&&app.document.getElementById('ownerNotice').querySelector('a').rel==='noopener noreferrer'&&app.document.getElementById('experienceReport').getAttribute('aria-describedby')==='reportPrivacyNotice');

const english=setup({saved:{[KEYS[0]]:'en'},withLegal:true});
check('legal language restores English and rerenders privacy controls consistently',english.document.documentElement.lang==='en'&&english.document.documentElement.dir==='ltr'&&english.controls().button.textContent.startsWith('Erase')&&english.document.getElementById('locale-he').hidden&&!english.document.getElementById('locale-en').hidden);
check('merely loading language or privacy controllers writes no preference or signal',!english.calls.some(call=>call.op==='set'||call.op==='remove'));
const override=setup({saved:{[KEYS[0]]:'en'},search:'?lang=he',withLegal:true});
check('only a recognized query language overrides the stored language',override.document.documentElement.lang==='he'&&override.document.documentElement.dir==='rtl'&&override.controls().button.textContent.includes('מחיקת'));
const malicious=setup({saved:{[KEYS[0]]:'en'},search:'?lang=%3Cimg%20src=x%20onerror=alert(1)%3E',withLegal:true});
check('untrusted language query values are ignored rather than rendered or parsed as HTML',malicious.document.documentElement.lang==='en'&&!malicious.document.body.textContent.includes('<img'));
const invalidSaved=setup({saved:{[KEYS[0]]:'<svg onload=alert(1)>'},withLegal:true});
check('untrusted stored language falls back to Hebrew without becoming markup',invalidSaved.document.documentElement.lang==='he'&&invalidSaved.document.documentElement.dir==='rtl'&&!invalidSaved.document.body.textContent.includes('<svg'));
english.confirm();english.document.getElementById('language-he').fire('click');
check('changing language updates document direction, labels and aria state and resets erasure confirmation',english.document.documentElement.lang==='he'&&english.document.documentElement.dir==='rtl'&&english.document.getElementById('informationNav').getAttribute('aria-label')==='נושאי מידע'&&english.document.getElementById('language-he').getAttribute('aria-pressed')==='true'&&!english.controls().checkbox.checked&&english.controls().button.disabled&&english.values.get(KEYS[0])==='he');
const invalidButton=english.document.getElementById('language-en');invalidButton.dataset.setLanguage='javascript:bad';const oldWrites=english.calls.filter(call=>call.op==='set').length;invalidButton.fire('click');
check('altered language-button data cannot overwrite a valid preference',english.document.documentElement.lang==='he'&&english.calls.filter(call=>call.op==='set').length===oldWrites);
const languageBlocked=setup({withLegal:true,blockedRead:['*'],blockedWrite:['*']});languageBlocked.document.getElementById('language-en').fire('click');
check('language remains usable when storage is blocked and announces the limitation',languageBlocked.document.documentElement.lang==='en'&&languageBlocked.document.getElementById('languageStatus').textContent.includes('storage is unavailable')&&languageBlocked.controls().button.textContent.startsWith('Erase'));

const legalHtml=fs.readFileSync(path.join(root,'dist/legal.html'),'utf8'),links=[...legalHtml.matchAll(/\bhref="([^"]+)"/g)].map(match=>match[1]);
check('standalone notice links allow only relative, HTTPS and email destinations',links.every(href=>{try{const url=new URL(href,'https://atlas.example/');return ['https:','mailto:'].includes(url.protocol);}catch{return false;}}));
check('standalone notice contains no inline scripts or event handlers',!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(legalHtml)&&!/\son[a-z]+\s*=/i.test(legalHtml));
check('standalone notice executes only bundled scripts',Array.from(legalHtml.matchAll(/<script\b[^>]*src="([^"]+)"/gi),match=>match[1]).every(src=>!src.includes(':')&&!src.startsWith('//')&&fs.existsSync(path.join(root,'dist',src.split('?')[0]))));
check('privacy controls do not initiate any network operations',initial.networkCalls.length===0&&app.networkCalls.length===0&&english.networkCalls.length===0&&malicious.networkCalls.length===0);
const existingKeys=new Set(fs.readdirSync(path.join(root,'dist')).filter(name=>name.endsWith('.js')&&name!=='privacy-tools.js').flatMap(name=>[...fs.readFileSync(path.join(root,'dist',name),'utf8').matchAll(/['"](maple-atlas-[a-z-]+-v\d+)['"]/g)].map(match=>match[1])));
check('the seven-key erasure list covers every actual atlas storage namespace',existingKeys.size===KEYS.length&&KEYS.every(key=>existingKeys.has(key)));
const failures=results.filter(result=>!result.passed);
process.stdout.write(JSON.stringify({checks:results.length,failed:failures.length,failures}));
process.exitCode=failures.length?1:0;
