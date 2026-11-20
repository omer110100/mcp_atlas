'use strict';
// Capture only the initial static shell. Feature modules translate their own dynamic views.
(() => {
  const KEY='maple-atlas-language-v1', catalog=window.AtlasTranslations||{};
  let language='he', storageOk=true;
  try { if(localStorage.getItem(KEY)==='en')language='en'; } catch { storageOk=false; }
  const records=[];
  const translate=he=>language==='en'?(catalog[he]??he):he;
  const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode, original=node.nodeValue, key=original.trim();
    if(Object.hasOwn(catalog,key))records.push({node,original,key});
  }
  const attributes=[];
  for(const node of document.querySelectorAll('[aria-label],[placeholder],[title],meta[name="description"]')){
    for(const name of ['aria-label','placeholder','title','content']){
      const original=node.getAttribute(name);
      if(original&&Object.hasOwn(catalog,original))attributes.push({node,name,original});
    }
  }
  function apply(){
    document.documentElement.lang=language;
    document.documentElement.dir=language==='en'?'ltr':'rtl';
    for(const {node,original,key}of records)if(node.isConnected)node.nodeValue=original.replace(key,translate(key));
    for(const {node,name,original}of attributes)if(node.isConnected)node.setAttribute(name,translate(original));
  }
  function setLanguage(value){
    if(!['he','en'].includes(value))return false;
    language=value;
    try {localStorage.setItem(KEY,value);storageOk=true;} catch {storageOk=false;}
    apply();
    window.dispatchEvent(new CustomEvent('atlas-languagechange',{detail:{language}}));
    return true;
  }
  window.AtlasI18n={get language(){return language;},get locale(){return language==='en'?'en-US':'he-IL';},get storageOk(){return storageOk;},text:(he,en)=>language==='en'?en:he,data:translate,setLanguage};
  apply();
})();
