'use strict';
(() => {
  const KEY='maple-atlas-language-v1',languages=['he','en'];
  let language='he',storageOk=true;
  try{const saved=localStorage.getItem(KEY);if(languages.includes(saved))language=saved;}catch{storageOk=false;}
  const requested=new URLSearchParams(location.search).get('lang');
  if(languages.includes(requested))language=requested;
  function render(announce=false){
    document.documentElement.lang=language;
    document.documentElement.dir=language==='he'?'rtl':'ltr';
    document.title=language==='he'?'פרטיות, שימוש ונגישות · Maple Atlas':'Privacy, use & accessibility · Maple Atlas';
    for(const element of document.querySelectorAll('[data-locale]'))element.hidden=element.dataset.locale!==language;
    for(const button of document.querySelectorAll('[data-set-language]'))button.setAttribute('aria-pressed',String(button.dataset.setLanguage===language));
    for(const element of document.querySelectorAll('[data-aria-he][data-aria-en]'))element.setAttribute('aria-label',language==='he'?element.dataset.ariaHe:element.dataset.ariaEn);
    if(announce)document.getElementById('languageStatus').textContent=language==='he'?(storageOk?'השפה שונתה לעברית.':'השפה שונתה לעברית. השמירה בדפדפן אינה זמינה.'):(storageOk?'Language changed to English.':'Language changed to English. Browser storage is unavailable.');
    window.dispatchEvent(new Event('legal-languagechange'));
  }
  for(const button of document.querySelectorAll('[data-set-language]'))button.addEventListener('click',()=>{
    if(!languages.includes(button.dataset.setLanguage))return;
    language=button.dataset.setLanguage;
    try{localStorage.setItem(KEY,language);storageOk=true;}catch{storageOk=false;}
    render(true);
  });
  render();
})();
