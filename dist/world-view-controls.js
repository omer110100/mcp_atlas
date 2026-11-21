'use strict';
(() => {
  const KEY='maple-atlas-world-view-v1',L=(he,en)=>window.AtlasI18n?.text(he,en)??he;
  const modes=[
    {id:'atlas',name:['האטלס הקלאסי','Original atlas'],description:['איים, יערות וכל הקשרים המוכרים','Islands, forests and familiar connections'],eyebrow:['המקור','THE ORIGINAL']},
    {id:'metro',name:['קווי מסע','Transit lines'],description:['תחנות וקווים מסודרים לפי אזור','Regional lines and neatly ordered stations'],eyebrow:['למצוא את הדרך','FIND YOUR WAY']},
    {id:'celestial',name:['שמיים של מייפל','Maple constellations'],description:['כל אזור הוא עולם קטן בין הכוכבים','Each region orbits its own little universe'],eyebrow:['מבט אחר','A DIFFERENT PERSPECTIVE']},
    {id:'board',name:['אוסף גלויות','Postcard collection'],description:['כל אזור בכרטיס משלו, כל מפה במקום','An organized card for every region'],eyebrow:['לעשות סדר','A PLACE FOR EVERYTHING']},
    {id:'storybook',name:['עולם מאויר','Storybook'],description:['כל קשרי האטלס, על רקע מאויר בהשראת מייפל','Every atlas connection, with a Maple-inspired illustrated backdrop'],eyebrow:['רוח של הרפתקה','A SENSE OF ADVENTURE']}
  ];
  let storageOk=true,ready=false,saved='atlas';
  try{const value=localStorage.getItem(KEY);if(value==='classic'){saved='storybook';localStorage.setItem(KEY,saved);}else if(modes.some(mode=>mode.id===value))saved=value;}catch{storageOk=false;}
  const button=document.createElement('button');button.id='worldViewToggle';button.type='button';button.className='world-view-toggle';button.disabled=true;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','worldViewDialog');
  const dialog=document.createElement('dialog');dialog.id='worldViewDialog';dialog.className='world-view-dialog';dialog.setAttribute('aria-labelledby','worldViewTitle');
  const caption=document.createElement('div');caption.className='world-view-caption';caption.id='worldViewCaption';
  document.body.append(button,dialog,caption);
  const graphic=mode=>{
    const shapes={
      atlas:'<path class="preview-land" d="M20 65Q8 29 48 24T90 16Q124 14 133 50T201 60Q219 91 180 106T126 94Q85 118 65 89T20 65Z"/><path d="M41 61 82 40 125 72 174 83M82 40 114 26"/><circle cx="41" cy="61" r="5"/><circle cx="82" cy="40" r="7"/><circle cx="125" cy="72" r="5"/><circle cx="174" cy="83" r="7"/>',
      metro:'<path d="M20 33H105V78H204M20 97H66V55H204"/><path class="preview-secondary" d="M20 62H146V25H204"/><circle cx="42" cy="33" r="5"/><circle cx="105" cy="55" r="7"/><circle cx="146" cy="62" r="7"/><circle cx="180" cy="78" r="5"/><circle cx="66" cy="97" r="5"/>',
      celestial:'<ellipse class="preview-orbit" cx="75" cy="63" rx="49" ry="40"/><ellipse class="preview-orbit" cx="171" cy="57" rx="33" ry="31"/><path d="m38 42 37 21 30-32M75 63l25 34 71-40 16-26"/><circle cx="75" cy="63" r="8"/><circle cx="38" cy="42" r="4"/><circle cx="105" cy="31" r="4"/><circle cx="100" cy="97" r="4"/><circle cx="171" cy="57" r="7"/><circle cx="187" cy="31" r="4"/>',
      board:'<rect class="preview-land" x="16" y="17" width="90" height="86" rx="8"/><rect class="preview-land" x="118" y="17" width="90" height="86" rx="8"/><path d="M28 38H94M130 38H196M34 61H87V86H34ZM136 61H189V86H136Z"/><circle cx="34" cy="61" r="5"/><circle cx="87" cy="86" r="5"/><circle cx="136" cy="86" r="5"/><circle cx="189" cy="61" r="5"/>'
    };return `<svg viewBox="0 0 224 120" aria-hidden="true">${shapes[mode==='storybook'?'atlas':mode]}</svg>`;
  };
  function render(){
    const mode=modes.find(entry=>entry.id===(window.Atlas?.worldView||saved))||modes[0];
    document.documentElement.dataset.worldView=mode.id;
    button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15m6-12v15"/></svg><span><small>${L('תצוגת מפה','Map view')}</small><strong>${L(...mode.name)}</strong></span><span class="world-view-chevron" aria-hidden="true">⌄</span>`;
    button.setAttribute('aria-label',`${L('שינוי תצוגת המפה','Change map view')}: ${L(...mode.name)}`);
    dialog.innerHTML=`<header class="world-view-heading"><div><span class="eyebrow">${L('עולם אחד. חמש דרכים לגלות.','One world. Five ways to explore.')}</span><h2 id="worldViewTitle">${L('איך נראה המסע שלך?','How does your journey look?')}</h2></div><button type="button" class="icon-button" id="closeWorldView" aria-label="${L('סגירת בחירת תצוגה','Close view picker')}">×</button></header><p class="world-view-intro">${L('אותן מפות, אותו מסלול — בחרו את המבט שלכם. ערכת הצבעים נבחרת בנפרד בעיצוב ושפה.','The same maps and journey, from your perspective. Color themes are set separately in Appearance & language.')}</p><div class="world-view-grid">${modes.map(entry=>`<button type="button" class="world-view-card" data-world-view-option="${entry.id}" aria-pressed="${entry.id===mode.id}"><span class="world-view-preview preview-${entry.id}" aria-hidden="true">${graphic(entry.id)}<span class="world-view-check">✓</span></span><span class="world-view-card-copy"><small>${L(...entry.eyebrow)}</small><strong>${L(...entry.name)}</strong><span>${L(...entry.description)}</span></span></button>`).join('')}</div><footer class="world-view-footer"><p>${L('עולם מאויר שומר על פריסת האטלס המלאה. האיור הוא רקע לאווירה — כל נקודה וחיבור נשארים חלק מהמפה.','Storybook keeps the complete atlas layout. The illustration sets the mood; every point and connection remains part of the map.')}</p><p class="world-view-storage">${storageOk?L('הבחירה נשמרת בדפדפן הזה.','Your choice is saved in this browser.'):L('השמירה אינה זמינה. הבחירה תקפה לביקור הנוכחי.','Storage is unavailable. Your choice applies to this visit.')}</p></footer>`;
    caption.textContent=mode.id==='storybook'?L('האטלס המלא · רקע מאויר · גרירה לתנועה וגלילה לקירוב','The complete atlas · illustrated backdrop · drag to pan and scroll to zoom'):L('פריסת קשרים סכמטית · גרירה לתנועה · גלילה לקירוב','Schematic connections · drag to pan · scroll to zoom');
    const help=document.querySelector('[data-shell-label="help"]');if(help)help.textContent=mode.id==='storybook'?L('כל מפות האטלס והקשרים נשמרים בפריסה המוכרת, על רקע מאויר בהשראת מייפל. הרקע אינו מפה גאוגרפית של המשחק.','All atlas maps and connections retain their familiar layout on a Maple-inspired illustrated backdrop. The background is not an in-game geographic map.'):L('מפת העולם סכמטית. מיקומי שערים בתמונה נשמרים לפי המקור.','The world map is schematic. Portal image positions follow the source data.');
  }
  function close(){dialog.close();button.focus();}
  button.addEventListener('click',()=>{if(!ready)return;render();dialog.showModal();dialog.querySelector('[aria-pressed="true"]')?.focus();});
  dialog.addEventListener('click',event=>{
    if(event.target.closest('#closeWorldView')){close();return;}
    const mode=event.target.closest('[data-world-view-option]')?.dataset.worldViewOption;
    if(!modes.some(entry=>entry.id===mode)||!window.Atlas?.setWorldView(mode))return;
    saved=mode;try{localStorage.setItem(KEY,mode);storageOk=true;}catch{storageOk=false;}
    render();close();
  });
  dialog.addEventListener('close',()=>button.focus());
  function init(){ready=true;button.disabled=false;if(saved!=='atlas'&&!window.Atlas.setWorldView(saved))saved='atlas';render();}
  window.addEventListener('atlas-ready',init);
  window.addEventListener('atlas-worldviewchange',render);
  window.addEventListener('atlas-languagechange',render);
  if(window.Atlas)init();else render();
})();
