'use strict';
// Pure layout contracts. Browser rendering is checked separately.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),atlas=JSON.parse(fs.readFileSync(path.join(root,'dist/atlas-data.json'),'utf8'));
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'dist/world-views.js'),'utf8'),context);
const {createLayout,modes}=context.window.AtlasWorldViews,results=[];
const check=(name,passed)=>results.push({name,passed:!!passed});
const snapshot=JSON.stringify(atlas),freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
freeze(atlas);
const serial=layout=>JSON.stringify({...layout,positions:[...layout.positions].sort((a,b)=>a[0]-b[0])});
const layouts=new Map();
for(const mode of modes){
  const layout=createLayout(mode,atlas);layouts.set(mode,layout);
  const points=[...layout.positions.values()],ids=[...layout.positions.keys()];
  check(`${mode}: every map ID appears exactly once`,ids.length===atlas.maps.length&&atlas.maps.every(map=>layout.positions.has(map.id)));
  check(`${mode}: all coordinates are finite`,points.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
  check(`${mode}: no overlapping point coordinates`,new Set(points.map(point=>`${point.x}:${point.y}`)).size===points.length);
  check(`${mode}: repeat calls are deterministic`,serial(layout)===serial(createLayout(mode,atlas)));
  check(`${mode}: input remains immutable`,JSON.stringify(atlas)===snapshot);
  check(`${mode}: points fit the returned bounds`,points.every(point=>point.x>=layout.bounds.minX&&point.y>=layout.bounds.minY&&point.x<=layout.bounds.maxX&&point.y<=layout.bounds.maxY));
  check(`${mode}: designed extent remains manageable`,layout.bounds.width<4000&&layout.bounds.height<4500);
  if(mode==='atlas'||mode==='storybook'){
    check(`${mode}: preserves every stored original position`,atlas.maps.every(map=>layout.positions.get(map.id).x===map.x&&layout.positions.get(map.id).y===map.y));
    check(`${mode}: original landscape remains renderer-owned`,layout.panels.length===0&&layout.edgeStyle==='curved');
    continue;
  }
  check(`${mode}: source map order does not affect geometry`,serial(layout)===serial(createLayout(mode,{...atlas,maps:[...atlas.maps].reverse()})));
  check(`${mode}: all 13 source regions remain represented`,layout.panels.length===atlas.groups.length&&atlas.groups.every(group=>layout.panels.some(panel=>panel.groupId===group.id)));
  check(`${mode}: panel membership preserves source groups`,layout.panels.every(panel=>panel.mapIds.length===panel.count&&panel.mapIds.every(id=>atlas.maps.find(map=>map.id===id).group===panel.groupId)));
  check(`${mode}: every point belongs inside its panel`,layout.panels.every(panel=>panel.mapIds.every(id=>{const point=layout.positions.get(id);return point.x>=panel.x&&point.y>=panel.y&&point.x<=panel.x+panel.width&&point.y<=panel.y+panel.height;})));
  check(`${mode}: panels have no overlaps`,layout.panels.every((panel,index)=>layout.panels.slice(index+1).every(other=>panel.x+panel.width<=other.x||other.x+other.width<=panel.x||panel.y+panel.height<=other.y||other.y+other.height<=panel.y)));
  check(`${mode}: title positions stay inside region panels`,layout.panels.every(panel=>panel.titleX>=panel.x&&panel.titleX<=panel.x+panel.width&&panel.titleY>=panel.y&&panel.titleY<=panel.y+panel.height));
  check(`${mode}: all region thumbnails are actual bundled assets`,layout.panels.every(panel=>panel.thumbnail?.startsWith('assets/')&&fs.existsSync(path.join(root,'dist',panel.thumbnail))&&panel.mapIds.includes(panel.thumbnailMapId)));
  check(`${mode}: each point has enough space for its node marker`,points.every((point,index)=>points.slice(index+1).every(other=>Math.hypot(point.x-other.x,point.y-other.y)>70)));
}
check('the four graph arrangements remain distinct; storybook only changes the background',new Set([...layouts.values()].map(layout=>JSON.stringify([...layout.positions].sort((a,b)=>a[0]-b[0])))).size===4);
check('storybook: geometry exactly matches the complete atlas',JSON.stringify([...layouts.get('storybook').positions])===JSON.stringify([...layouts.get('atlas').positions]));
check('metro: every guide rail is orthogonal',layouts.get('metro').panels.every(panel=>panel.tracks.length&&panel.tracks.every(track=>track.x1===track.x2||track.y1===track.y2)));
check('celestial: every multi-map region has orbital guides',layouts.get('celestial').panels.every(panel=>panel.count===1||panel.orbitRadii.length>0));
check('board: postcard headers reserve room above every node',layouts.get('board').panels.every(panel=>panel.mapIds.every(id=>layouts.get('board').positions.get(id).y>panel.y+panel.headerHeight)));
check('unknown stored view falls back to original atlas',serial(createLayout('__unknown__',atlas))===serial(layouts.get('atlas')));
for(const mode of ['metro','celestial','board']){
  const standard=layouts.get(mode),wide=createLayout(mode,atlas,{aspectRatio:1.8}),portrait=createLayout(mode,atlas,{aspectRatio:.6});
  check(`${mode}: wide canvases produce a substantially wider arrangement`,wide.bounds.width/wide.bounds.height>standard.bounds.width/standard.bounds.height*1.3&&wide.bounds.height<standard.bounds.height);
  check(`${mode}: responsive packing retains every source map without collisions`,[wide,portrait].every(layout=>layout.positions.size===atlas.maps.length&&atlas.maps.every(map=>layout.positions.has(map.id))&&new Set([...layout.positions.values()].map(point=>`${point.x}:${point.y}`)).size===atlas.maps.length&&layout.panels.every((panel,index)=>layout.panels.slice(index+1).every(other=>panel.x+panel.width<=other.x||other.x+other.width<=panel.x||panel.y+panel.height<=other.y||other.y+other.height<=panel.y))));
  check(`${mode}: portrait packing stays narrower than the desktop arrangement`,portrait.bounds.width<=2500&&portrait.bounds.width<wide.bounds.width);
  check(`${mode}: responsive arrangements are deterministic without mutating source data`,serial(wide)===serial(createLayout(mode,atlas,{aspectRatio:1.8}))&&JSON.stringify(atlas)===snapshot);
  check(`${mode}: invalid aspect ratios preserve the existing default layout`,[null,{}, {aspectRatio:0},{aspectRatio:-1},{aspectRatio:NaN},{aspectRatio:Infinity},{aspectRatio:'1.8'}].every(options=>serial(createLayout(mode,atlas,options))===serial(standard)));
}
check('atlas: viewport shape never rewrites original source positions',serial(createLayout('atlas',atlas,{aspectRatio:1.8}))===serial(layouts.get('atlas')));
check('metro: the first station clears its title and map-count header',layouts.get('metro').panels.every(panel=>panel.mapIds.every(id=>layouts.get('metro').positions.get(id).y>=panel.titleY+94)));
const sparse={groups:[],maps:[{id:7,group:'future',x:10,y:20,portals:[]},{id:8,group:'future',x:30,y:40,portals:[]},{id:9,group:'isolated',x:50,y:60,portals:[]}]};
for(const mode of modes){
  const empty=createLayout(mode,{maps:[],groups:[]});
  check(`${mode}: empty data returns finite usable bounds`,empty.positions.size===0&&Number.isFinite(empty.bounds.width)&&empty.bounds.width>0);
  const layout=createLayout(mode,sparse);
  check(`${mode}: disconnected maps and unknown groups remain available`,layout.positions.size===3&&sparse.maps.every(map=>layout.positions.has(map.id)));
}
const invalid=[null,{}, {groups:[],maps:[{id:1,group:'a',x:0,y:0},{id:1,group:'a',x:1,y:1}]}, {groups:[],maps:[{id:'1',group:'a'}]}];
check('invalid atlas records fail explicitly',invalid.every(value=>{try{createLayout('board',value);return false;}catch{return true;}}));
check('invalid original coordinates fail explicitly',(()=>{try{createLayout('atlas',{groups:[],maps:[{id:1,group:'a',x:NaN,y:0}]});return false;}catch{return true;}})());

for(const file of ['world-map-art','world-art-layout'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file+'.js'),'utf8'),context);
const art=context.window.AtlasWorldMapArt,artSnapshot=JSON.stringify(art),artLayout=context.window.AtlasArtLayout.createLayout;
freeze(art);
const classic=artLayout(atlas,art),classicPoints=[...classic.positions.values()],knownIds=new Set(atlas.maps.map(map=>map.id));
const anchoredIds=new Set(art.maps.flatMap(sheet=>sheet.spots.flatMap(spot=>spot.mapIds.filter(id=>knownIds.has(id)))));
check('classic: all364 source maps remain individually addressable',classic.positions.size===364&&atlas.maps.every(map=>classic.positions.has(map.id)));
check('classic: all281 source-anchored maps and83 extensions are represented',classicPoints.filter(point=>point.source==='game').length===281&&classicPoints.filter(point=>point.source==='extension').length===83&&anchoredIds.size===281);
check('classic: every anchor assignment is backed by sheet membership',atlas.maps.every(map=>(classic.positions.get(map.id).source==='game')===anchoredIds.has(map.id)));
check('classic: every map has finite coordinates at76 source anchors or83 distinct extensions',classicPoints.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))&&new Set(classicPoints.filter(point=>point.source==='game').map(point=>`${point.x}:${point.y}`)).size===76&&new Set(classicPoints.filter(point=>point.source==='extension').map(point=>`${point.x}:${point.y}`)).size===83&&new Set(classicPoints.map(point=>`${point.x}:${point.y}`)).size===159);
check('classic: every map fits the supplied viewport bounds',classicPoints.every(point=>point.x>=classic.bounds.minX&&point.x<=classic.bounds.maxX&&point.y>=classic.bounds.minY&&point.y<=classic.bounds.maxY));
check('classic: every original source record remains unchanged',JSON.stringify(atlas)===snapshot&&JSON.stringify(art)===artSnapshot);
check('classic: repeated layout is deterministic',serial(classic)===serial(artLayout(atlas,art)));
check('classic: extension panels contain exactly their declared maps',classic.panels.filter(panel=>panel.shape==='extension').every(panel=>panel.mapIds.length===panel.count&&panel.mapIds.every(id=>{const point=classic.positions.get(id);return point.source==='extension'&&point.x>=panel.x&&point.x<=panel.x+panel.width&&point.y>=panel.y&&point.y<=panel.y+panel.height;})));
check('classic: shared map positions remain exactly on their original source anchors',art.maps.every(sheet=>{
  const panel=classic.panels.find(entry=>entry.id===sheet.id),scaleX=panel.width/sheet.width,scaleY=panel.height/sheet.height;
  return sheet.spots.every(spot=>spot.mapIds.filter(id=>knownIds.has(id)).every(id=>{
    const point=classic.positions.get(id);
    return point.anchorX===panel.x+spot.x*scaleX&&point.anchorY===panel.y+spot.y*scaleY&&point.x===point.anchorX&&point.y===point.anchorY;
  }));
}));
check('classic: each recorded spot is within its original image',art.maps.every(sheet=>sheet.spots.every(spot=>Number.isInteger(spot.x)&&Number.isInteger(spot.y)&&spot.x>=0&&spot.y>=0&&spot.x<sheet.width&&spot.y<sheet.height&&spot.mapIds.length>0&&spot.mapIds.every(id=>Number.isSafeInteger(id)&&id>=0))));
check('classic: all76 source spot keys are preserved distinctly',art.maps.reduce((count,sheet)=>count+sheet.spots.length,0)===76&&new Set(art.maps.flatMap(sheet=>sheet.spots.map(spot=>spot.id))).size===76);
check('classic: all76 source anchor clusters retain exact pixel positions and membership',classic.anchors.length===76&&art.maps.every(sheet=>{
  const panel=classic.panels.find(entry=>entry.id===sheet.id);
  return sheet.spots.every(spot=>{const anchor=classic.anchors.find(entry=>entry.id===spot.id),ids=spot.mapIds.filter(id=>knownIds.has(id));return anchor&&anchor.x===panel.x+spot.x*panel.width/sheet.width&&anchor.y===panel.y+spot.y*panel.height/sheet.height&&anchor.mapIds.length===ids.length&&ids.every(id=>anchor.mapIds.includes(id));});
}));
check('classic: provenance and original image links use HTTPS',art.sources.length>=2&&art.sources.every(source=>{try{return new URL(source.pageUrl).protocol==='https:';}catch{return false;}})&&art.maps.every(sheet=>{try{return new URL(sheet.sourceImageUrl).protocol==='https:';}catch{return false;}}));
for(const sheet of art.maps){
  const file=path.resolve(root,'dist',sheet.image),withinAssets=file.startsWith(path.resolve(root,'dist/assets/worldmaps')+path.sep),bytes=withinAssets&&fs.existsSync(file)?fs.readFileSync(file):Buffer.alloc(0);
  check(`classic: ${sheet.id} is a bundled PNG with matching dimensions`,bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)===sheet.width&&bytes.readUInt32BE(20)===sheet.height);
  check(`classic: ${sheet.id} image matches its source integrity hash`,crypto.createHash('sha256').update(bytes).digest('hex')===sheet.sha256);
}
check('classic: absent artwork returns a safe unavailable result',artLayout(atlas,null)===null&&artLayout(atlas,{maps:[]})===null);
const futureAtlas={...atlas,maps:[...atlas.maps,{id:123456789,group:'future-region',x:0,y:0,portals:[]}]};
const futureLayout=artLayout(futureAtlas,art);
check('classic: unknown future regions remain visible in extension panels',futureLayout.positions.get(123456789)?.source==='extension'&&futureLayout.panels.some(panel=>panel.mapIds.includes(123456789)));
// Saved preferences must survive the replacement of limited game-sheet placement.
function controlsSession(initial,{readBlocked=false,writeBlocked=false,ready=true}={}){
  const values=new Map(initial===undefined?[]:[['maple-atlas-world-view-v1',initial]]),listeners=new Map(),nodes=[];
  const makeElement=()=>({dataset:{},attributes:{},listeners:{},setAttribute(key,value){this.attributes[key]=String(value);},addEventListener(key,fn){this.listeners[key]=fn;},focus(){},querySelector(){return null;}});
  const html=makeElement(),help=makeElement(),window={AtlasI18n:{text:(he,en)=>en},addEventListener(key,fn){listeners.set(key,fn);}};
  const atlasApi={worldView:'atlas',setWorldView(mode){if(!modes.includes(mode))return false;this.worldView=mode;return true;}};
  if(ready)window.Atlas=atlasApi;
  const document={documentElement:html,body:{append(...elements){nodes.push(...elements);}},createElement:makeElement,querySelector:()=>help};
  const localStorage={getItem(key){if(readBlocked)throw Error('blocked');return values.get(key)??null;},setItem(key,value){if(writeBlocked)throw Error('quota');values.set(key,value);}};
  vm.runInContext(fs.readFileSync(path.join(root,'dist/world-view-controls.js'),'utf8'),vm.createContext({window,document,localStorage}));
  return {html,values,help,dialog:nodes.find(node=>node.id==='worldViewDialog'),api:atlasApi,finishLoading(){window.Atlas=atlasApi;listeners.get('atlas-ready')();}};
}
const legacy=controlsSession('classic');
check('stored classic choice migrates to storybook and persists',legacy.api.worldView==='storybook'&&legacy.html.dataset.worldView==='storybook'&&legacy.values.get('maple-atlas-world-view-v1')==='storybook');
check('replacement picker contains five modes and no game-sheet choice',(legacy.dialog.innerHTML.match(/data-world-view-option=/g)||[]).length===5&&legacy.dialog.innerHTML.includes('data-world-view-option="storybook"')&&!legacy.dialog.innerHTML.includes('data-world-view-option="classic"')&&!legacy.dialog.innerHTML.includes('assets/worldmaps/'));
check('storybook help distinguishes atmosphere from game geography',legacy.help.textContent.includes('not an in-game geographic map'));
check('existing nonclassic preferences remain unchanged',['atlas','metro','celestial','board','storybook'].every(mode=>{const session=controlsSession(mode);return session.api.worldView===mode&&session.values.get('maple-atlas-world-view-v1')===mode;}));
const quota=controlsSession('classic',{writeBlocked:true});
check('migration remains usable when storage cannot be written',quota.api.worldView==='storybook'&&quota.dialog.innerHTML.includes('Storage is unavailable'));
check('blocked reads and corrupt choices safely select atlas',controlsSession('classic',{readBlocked:true}).api.worldView==='atlas'&&controlsSession('__invalid__').api.worldView==='atlas');
const waiting=controlsSession('classic',{ready:false});waiting.finishLoading();
check('legacy migration applies when the atlas initializes after controls',waiting.api.worldView==='storybook'&&waiting.html.dataset.worldView==='storybook');
const failed=results.filter(result=>!result.passed);
process.stdout.write(JSON.stringify({suite:'world-views',checks:results.length,failed:failed.length,failures:failed}));
process.exitCode=failed.length?1:0;
