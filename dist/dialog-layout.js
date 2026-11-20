'use strict';
// Dialog composition only. Existing controls, form handlers and catalogue state stay attached.
(() => {
  const $=id=>document.getElementById(id);
  const L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  const labels={
    aboutTitle:['אודות האטלס','About the atlas'],aboutEyebrow:['המדריך לאטלס','Your atlas guide'],
    aboutSections:['נושאי המידע','Information sections'],overview:['בקצרה','Overview'],
    guide:['איך משתמשים','How to use'],sources:['נתונים ומקורות','Data & sources'],tools:['כלים ותמיכה','Tools & support'],
    toolsIntro:['עזרה, קיצורי דרך ותמיכה בפרויקט — במקום אחד.','Help, shortcuts and project support in one place.'],
    update:['מה חדש בנתונים?','What changed in the data?'],huntCoverage:['נתוני ציד ותצפיות נפילה','Hunting data & drop observations']
  };
  function translate(){
    for(const node of document.querySelectorAll('[data-popup-label]')){const value=labels[node.dataset.popupLabel];if(value)node.textContent=L(...value);}
    for(const node of document.querySelectorAll('[data-popup-aria]')){const value=labels[node.dataset.popupAria];if(value)node.setAttribute('aria-label',L(...value));}
  }
  function frameDialog(dialog,headingSelector,{pinned=[],footer=null}={}){
    if(!dialog||dialog.dataset.popupFramed)return;
    const heading=dialog.querySelector(headingSelector);if(!heading)return;
    const host=heading.parentElement,body=document.createElement('div');body.className='popup-body';
    const pins=pinned.map(selector=>dialog.querySelector(selector)).filter(Boolean),tail=footer?dialog.querySelector(footer):null;
    for(const node of [...host.childNodes])if(node!==heading&&!pins.includes(node)&&node!==tail)body.append(node);
    host.append(heading,...pins,body);if(tail)host.append(tail);
    heading.classList.add('popup-heading');dialog.classList.add('popup-frame');dialog.dataset.popupFramed='true';
    if(host!==dialog)host.classList.add('popup-frame-host');
  }
  function setAboutTab(key,focus=false){
    const tabs=[...document.querySelectorAll('[data-about-tab]')],selected=tabs.find(button=>button.dataset.aboutTab===key);
    if(!selected)return;
    for(const button of tabs){const active=button===selected;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;const panel=$(button.getAttribute('aria-controls'));if(panel)panel.hidden=!active;}
    const scroller=$('aboutDialog').querySelector('.popup-body');if(scroller)scroller.scrollTop=0;
    if(focus)selected.focus({preventScroll:true});
  }
  const aboutTabs=$('aboutTabs');
  aboutTabs?.addEventListener('click',event=>{const button=event.target.closest('[data-about-tab]');if(button)setAboutTab(button.dataset.aboutTab);});
  aboutTabs?.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const tabs=[...aboutTabs.querySelectorAll('[data-about-tab]')],current=tabs.indexOf(event.target);if(current<0)return;
    event.preventDefault();const rtl=document.documentElement.dir==='rtl',delta=(event.key==='ArrowRight'?1:-1)*(rtl?-1:1);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+delta+tabs.length)%tabs.length;
    setAboutTab(tabs[next].dataset.aboutTab,true);
  });
  function sourceDisclosure(){
    const coverage=$('huntingCoverage');if(!coverage||$('aboutHuntCoverage'))return;
    const details=document.createElement('details');details.id='aboutHuntCoverage';details.className='about-disclosure';
    const summary=document.createElement('summary');summary.dataset.popupLabel='huntCoverage';summary.textContent=L(...labels.huntCoverage);
    coverage.before(details);details.append(summary,coverage);
  }
  function prepare(){
    frameDialog($('appearanceDialog'),'.section-heading');
    // The library is installed after atlas data loads. Keep its navigation outside the scroll body.
    if($('libraryNav'))frameDialog($('personalDialog'),'.section-heading',{pinned:['#libraryNav']});
    frameDialog($('mapNoteDialog'),'.section-heading',{footer:'#saveMapNote'});
    for(const id of ['welcomeDialog','shortcutDialog','releaseDialog'])frameDialog($(id),'.experience-dialog-heading',{footer:'.button.full'});
    const tools=$('experienceTools'),target=$('aboutTools');if(tools&&target&&tools.parentElement!==target)target.append(tools);
    const edition=$('aboutDialog')?.querySelector('.shell-data-edition');if(edition&&edition.parentElement!==$('aboutPanel-overview'))$('aboutPanel-overview').append(edition);
    $('directory')?.classList.add('popup-catalog');
    sourceDisclosure();translate();
  }
  prepare();
  // Coverage can be inserted lazily the first time About opens after the catalog loads.
  document.addEventListener('click',event=>{if(event.target.closest('#aboutButton,#coverageButton'))queueMicrotask(sourceDisclosure);});
  window.addEventListener('atlas-ready',prepare);
  window.addEventListener('hunt-ready',()=>queueMicrotask(sourceDisclosure));
  window.addEventListener('hunt-unavailable',()=>queueMicrotask(sourceDisclosure));
  window.addEventListener('atlas-languagechange',()=>{translate();queueMicrotask(sourceDisclosure);});
})();
