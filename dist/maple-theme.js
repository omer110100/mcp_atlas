'use strict';
// Optional local artwork, loaded only when the MapleStory theme is first selected.
// This layer has no controls and never changes world positions or route state.
(() => {
  const root=document.documentElement;
  const art={
    mushroom:'assets/monsters/acd018a3a11f4390c1cf9fdad8f0b1e7.png',
    slime:'assets/monsters/f4672b8825109ad41b9cc2ab5df64909.png',
    snail:'assets/monsters/d8caace4e0f119f7a3f2b1fb450f7ed4.png',
    logo:'assets/maplestory/logo.webp',
    henesys:'assets/maplestory/henesys.webp',
  };
  let mounted=false;
  function sprite(name,className){
    const image=document.createElement('img');
    image.src=art[name];image.alt='';image.className=className;
    image.decoding='async';image.draggable=false;
    image.addEventListener('error',()=>{image.hidden=true;},{once:true});
    return image;
  }
  function mount(){
    if(mounted||root.dataset.theme!=='maplestory')return;
    const canvas=document.getElementById('mapCanvas'),brand=document.querySelector('.brand');
    if(!canvas)return;
    mounted=true;
    if(brand){
      const mascot=sprite('mushroom','maple-brand-mascot');
      mascot.setAttribute('aria-hidden','true');brand.prepend(mascot);
      const logo=sprite('logo','maple-brand-art');
      logo.width=160;logo.height=52;logo.setAttribute('aria-hidden','true');brand.prepend(logo);
    }
    const scene=document.createElement('div');
    scene.className='maple-theme-scene';scene.setAttribute('aria-hidden','true');
    const grove=document.createElement('div');grove.className='maple-grove';
    const portal=document.createElement('span');portal.className='maple-ambient-portal';
    grove.append(sprite('henesys','maple-grove-backdrop'),portal,sprite('mushroom','maple-creature maple-mushroom'),sprite('slime','maple-creature maple-slime'),sprite('snail','maple-creature maple-snail'));
    scene.append(grove);
    for(let i=0;i<4;i++){
      const leaf=document.createElement('span');leaf.className=`maple-floating-leaf maple-floating-leaf-${i+1}`;
      scene.append(leaf);
    }
    canvas.append(scene);
  }
  window.addEventListener('atlas-appearancechange',mount);
  mount();
})();
