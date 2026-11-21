'use strict';
(() => {
  // Explicit allowlist: other apps on this origin must never be erased.
  const KEYS=Object.freeze(['maple-atlas-language-v1','maple-atlas-appearance-v1','maple-atlas-experience-v1','maple-atlas-personal-v1','maple-atlas-library-v1','maple-atlas-location-v1','maple-atlas-world-view-v1']);
  const SIGNAL='maple-atlas-reset-signal-v1';
  const L=(he,en)=>document.documentElement.lang==='en'?en:he;
  function erase(){const failed=[];for(const key of KEYS){try{localStorage.removeItem(key);if(localStorage.getItem(key)!==null)failed.push(key);}catch{failed.push(key);}}return failed;}
  function signal(){try{localStorage.setItem(SIGNAL,String(Date.now()));localStorage.removeItem(SIGNAL);}catch{/* The visible notice also asks users to close other atlas tabs. */}}
  window.addEventListener('storage',event=>{if(event.key!==SIGNAL||!event.newValue)return;if(document.getElementById('mapCanvas')){erase();location.replace(location.pathname);}else render();});
  function node(tag,text,className){const element=document.createElement(tag);if(text)element.textContent=text;if(className)element.className=className;return element;}
  function render(){
    const target=document.getElementById('localDataTools');if(!target)return;
    target.replaceChildren();
    const title=node('h3',L('המידע ששמור בדפדפן','Data saved in this browser'));
    const intro=node('p',L('אפשר למחוק מועדפים, מפות אחרונות, מסלולים, הערות, אוספים והעדפות של האטלס בדפדפן הזה. גיבויים שהורדתם, דיווחים ב־GitHub ורשומות אצל ספקי תשלום או אחסון אינם נמחקים כאן.','You can erase atlas favorites, recent maps, routes, notes, collections and preferences in this browser. Downloaded backups, GitHub reports and records held by payment or hosting providers are not erased here.'));
    const prepare=node('p',L('לגיבוי, חזרו לאטלס ← המקומות שלי ← גיבוי. סגרו לשוניות נוספות של האטלס לפני המחיקה; גרסה ישנה שפתוחה בלשונית אחרת עלולה לשמור את המידע מחדש.','To export first, open Atlas → My places → Backup. Close other atlas tabs before erasing; an older version still open in another tab could save its state again.'));
    const checkbox=node('input');checkbox.type='checkbox';checkbox.id='confirmLocalErase';
    const label=node('label',null,'privacy-erase-confirm');label.append(checkbox,node('span',L('אני מבין/ה שהמידע המקומי יימחק ושצריך גיבוי כדי לשחזר אותו.','I understand that local data will be erased and a backup is needed to restore it.')));
    const button=node('button',L('מחיקת המידע המקומי של האטלס','Erase this atlas’s local data'),'privacy-erase-button');button.type='button';button.disabled=true;
    const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    checkbox.addEventListener('change',()=>{button.disabled=!checkbox.checked;});
    button.addEventListener('click',()=>{if(!checkbox.checked)return;const failed=erase();if(failed.length){status.textContent=L('חלק מהמידע לא נמחק: הגישה לאחסון חסומה. אפשר לנסות שוב או למחוק את נתוני האתר דרך הגדרות הדפדפן.','Some data could not be erased because storage is blocked. Retry or clear this site’s data in browser settings.');return;}signal();checkbox.checked=false;button.disabled=true;status.textContent=L('המידע של האטלס נמחק מהדפדפן הזה. בפתיחה הבאה האטלס יתחיל ללא ההעדפות והמסלולים שנשמרו.','Atlas data has been erased from this browser. The next visit starts without saved preferences or routes.');});
    target.append(title,intro,prepare,label,button,status);
  }
  function appLinks(){
    const about=document.getElementById('aboutPanel-overview');if(!about)return;
    let note=document.getElementById('ownerNotice');if(!note){note=node('div',null,'owner-notice');note.id='ownerNotice';about.append(note);}
    note.replaceChildren(node('p',L('אטלס מעריצים עצמאי של עומר לבינסקי. אינו אתר רשמי של Nexon ואינו מופעל או מאושר על ידה.','An independent fan atlas by Omer Labinsky. This is not an official Nexon site and is not operated or endorsed by Nexon.')));
    const link=node('a',L('פרטיות, תנאי שימוש, נגישות וזכויות','Privacy, terms, accessibility & credits'),'button quiet');link.href='legal.html';link.target='_blank';link.rel='noopener noreferrer';note.append(link);
    let badge=document.querySelector('.owner-fan-badge');if(!badge){badge=node('small',null,'owner-fan-badge');document.querySelector('.brand-en')?.parentElement.append(badge);}badge.textContent=L('אטלס מעריצים עצמאי','INDEPENDENT FAN ATLAS');
    const report=document.getElementById('experienceReport');if(report){let warning=document.getElementById('reportPrivacyNotice');if(!warning){warning=node('p',null,'report-privacy-notice');warning.id='reportPrivacyNotice';report.after(warning);}warning.textContent=L('דיווח ב־GitHub: פתיחת הטיוטה מעבירה ל־GitHub את המפה, המסלול והעדפות התצוגה. הדיווח נשלח רק לאחר פרסום, והוא ציבורי. לפנייה פרטית או לפרצת אבטחה: labinskyomer@gmail.com.','GitHub report: opening the draft sends the map, route and display preferences to GitHub. A report is submitted only when you publish it and is public. For private matters or security issues: labinskyomer@gmail.com.');report.setAttribute('aria-describedby','reportPrivacyNotice');}
    const tools=document.getElementById('aboutTools');if(tools){let support=document.getElementById('supportTermsNote');if(!support){support=node('p',null,'support-terms-note');support.id='supportTermsNote';tools.append(support);}support.textContent=L('התמיכה בפרויקט היא לבחירתכם ואינה רכישה של שירות, הטבה במשחק או הבטחה לפיתוח עתידי. התשלום נעשה אצל הספק החיצוני; אין כאן התחייבות לזיכוי מס.','Supporting this project is optional and does not purchase a service, in-game benefit or promised future feature. Payment is handled by the external provider; no tax deduction is promised.');}
  }
  window.addEventListener('atlas-languagechange',()=>{appLinks();render();});window.addEventListener('legal-languagechange',render);
  appLinks();render();
})();
