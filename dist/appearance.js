'use strict';
(() => {
  const KEY='maple-atlas-appearance-v1', themes=['midnight','parchment','aurora'];
  const colors={midnight:'#0b1727',parchment:'#f5efdf',aurora:'#19132e'};
  let state={theme:'midnight',motion:true},storageOk=true;
  try {
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved&&themes.includes(saved.theme)&&typeof saved.motion==='boolean')state={theme:saved.theme,motion:saved.motion};
  } catch {storageOk=false;}
  const dialog=document.getElementById('appearanceDialog'), motion=document.getElementById('motionToggle');
  const L=(he,en)=>window.AtlasI18n.text(he,en);
  function render(){
    document.documentElement.dataset.theme=state.theme;
    document.documentElement.dataset.motion=state.motion?'on':'off';
    document.querySelector('meta[name="theme-color"]').content=colors[state.theme];
    for(const button of document.querySelectorAll('[data-theme-option]'))button.setAttribute('aria-pressed',String(button.dataset.themeOption===state.theme));
    for(const button of document.querySelectorAll('[data-language-option]'))button.setAttribute('aria-pressed',String(button.dataset.languageOption===window.AtlasI18n.language));
    motion.checked=state.motion;
    document.getElementById('appearanceStorage').textContent=storageOk&&window.AtlasI18n.storageOk?L('ההעדפות נשמרות בדפדפן הזה.','Preferences are saved in this browser.'):L('השמירה אינה זמינה. ההעדפות יחולו עד לסגירת הדף.','Storage is unavailable. Preferences apply until this page is closed.');
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}render();}
  document.getElementById('appearanceToggle').addEventListener('click',()=>{render();dialog.showModal();});
  document.getElementById('closeAppearance').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    const theme=event.target.closest('[data-theme-option]')?.dataset.themeOption;
    const language=event.target.closest('[data-language-option]')?.dataset.languageOption;
    if(themes.includes(theme)){state.theme=theme;save();}
    if(language)window.AtlasI18n.setLanguage(language);
  });
  motion.addEventListener('change',()=>{state.motion=motion.checked;save();});
  window.addEventListener('atlas-languagechange',render);
  render();
})();
