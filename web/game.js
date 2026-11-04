(()=>{
'use strict';
const W=420,LEFT=43,RIGHT=377,BY=285,R=16,DT=1/120,ARCADE_PHYSICS=false;
let H=760;
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false});
// Render at screen density when practical, but cap framebuffer area to protect
// mobile WebView GPUs from filling multi-million-pixel canvases 60-120 times/sec.
let canvasScale=1, renderAccumulator=0, lastDpr=0, renderQuality=1;
let qualityWindow=0, qualityFrames=0, qualityRecovery=0;
const CANVAS_PIXEL_BUDGET=2900000;
function fitCanvas(){
 const rect=canvas.getBoundingClientRect();
 const cssWidth=Math.max(1,rect.width), cssHeight=Math.max(1,rect.height);
 const nativeDpr=Math.max(1,window.devicePixelRatio||1);
 const pixelLimitedDpr=Math.min(nativeDpr,Math.sqrt(CANVAS_PIXEL_BUDGET/(cssWidth*cssHeight)));
 const renderDpr=Math.max(.8,pixelLimitedDpr*renderQuality);
 const targetW=Math.max(1,Math.round(cssWidth*renderDpr));
 const targetH=Math.max(1,Math.round(cssHeight*renderDpr));
 if(canvas.width!==targetW||canvas.height!==targetH||lastDpr!==renderDpr){
  canvas.width=targetW;canvas.height=targetH;lastDpr=renderDpr;
 }
 canvasScale=targetW/W;
 H=targetH/canvasScale;
 ctx.setTransform(canvasScale,0,0,canvasScale,0,0);
 ctx.imageSmoothingEnabled=true;
}
function lowFx(){return renderQuality<.88 || meta.reducedEffects===true}
window.addEventListener('resize',fitCanvas);
if(window.visualViewport)window.visualViewport.addEventListener('resize',fitCanvas);
fitCanvas();
const status=document.getElementById('status');
const C={bg:'#070C1D',cyan:'#4BDFFE',pink:'#FF6388',gold:'#FFD37A',white:'#F2F7FF',muted:'#8DA4C3',green:'#8CF7C1'};
let seed=92371,fxSeed=8536421,globalTime=0,rafLast=0,accum=0,audio=null,manualFrames=false;
let sfxBus=null,settingsDrag=null;
const clamp01=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const skins=[{id:'chrome',name:'CHROME',cost:0,light:'#FFFFFF',dark:'#71C0DE'},{id:'plasma',name:'PLASMA',cost:120,light:'#E5FCFF',dark:'#18E9F6'},{id:'ember',name:'EMBER',cost:300,light:'#FFF3D9',dark:'#FF884D'},{id:'gold',name:'GOLD',cost:620,light:'#FFF6C9',dark:'#E7B441'},
 {id:'aurora',name:'AURORA',cost:-1,light:'#E3FFF4',dark:'#8B67FF'},
 {id:'frost',name:'FROST',cost:270,light:'#F3FFFF',dark:'#70BCE7'}];
const magnetStyles=[
 {id:'classic',name:'CLASSIC',cost:0,accent:'#6DD9F9'},
 {id:'cyber',name:'CYBER RING',cost:280,accent:'#BE80FF'},
 {id:'frost',name:'ICE CRYSTAL',cost:330,accent:'#ABEDFF'}
];
const backgroundStyles=[
 {id:'reactor',name:'REACTOR',cost:0,accent:'#3A779B'},
 {id:'cyber',name:'NEON GRID',cost:390,accent:'#BA74F4'},
 {id:'frost',name:'FROZEN CORE',cost:450,accent:'#9AE9FC'}
];
const cosmeticSets=[
 {id:'reactor',name:'REACTOR',cost:0,ball:'chrome',magnet:'classic',background:'reactor',accent:'#65D7F5'},
 {id:'cyber',name:'CYBER PULSE',cost:650,ball:'plasma',magnet:'cyber',background:'cyber',accent:'#BF7BFF'},
 {id:'frost',name:'FROZEN CORE',cost:850,ball:'frost',magnet:'frost',background:'frost',accent:'#9CE7FF'}
];
const cosmeticTabs=['ball','magnets','backgrounds','sets'];
const cosmeticCatalog={ball:skins,magnets:magnetStyles,backgrounds:backgroundStyles,sets:cosmeticSets};
// Daily, weekly and lifetime goals all progress through real game events.
const careerTasks=[
 {id:'meters_250',name:'TRAVEL 250 METERS',goal:250,key:'meters',reward:75},
 {id:'near_6',name:'6 CLOSE CALLS',goal:6,key:'near',reward:85},
 {id:'gems_12',name:'COLLECT 12 CRYSTALS',goal:12,key:'gems',reward:90},
 {id:'boosts_10',name:'10 SLINGSHOTS',goal:10,key:'boosts',reward:120},
 {id:'meters_1200',name:'TRAVEL 1 200 METERS',goal:1200,key:'meters',reward:160},
 {id:'runs_12',name:'PLAY 12 RUNS',goal:12,key:'runs',reward:135},
 {id:'combo_5',name:'REACH COMBO x5',goal:5,key:'bestCombo',reward:140},
 {id:'gems_40',name:'COLLECT 40 CRYSTALS',goal:40,key:'gems',reward:200},
 {id:'meters_4500',name:'TRAVEL 4 500 METERS',goal:4500,key:'meters',reward:300},
 {id:'dailywins_5',name:'CLEAR 5 DAILY CIRCUITS',goal:5,key:'dailyWins',reward:220}
];
const dailyPools=[
 [{id:'flip_8',name:'SWITCH POLARITY 8 TIMES',goal:8,key:'flips',reward:30},{id:'boost_2',name:'MAKE 2 SLINGSHOTS',goal:2,key:'boosts',reward:45},{id:'near_2',name:'GET 2 CLOSE CALLS',goal:2,key:'near',reward:45}],
 [{id:'gems_3',name:'COLLECT 3 CRYSTALS',goal:3,key:'gems',reward:45},{id:'meters_180',name:'TRAVEL 180 METERS',goal:180,key:'meters',reward:40},{id:'combo_3',name:'GET COMBO x3',goal:3,key:'bestCombo',reward:55}],
 [{id:'runs_2',name:'PLAY 2 RUNS',goal:2,key:'runs',reward:35},{id:'flips_16',name:'SWITCH 16 TIMES',goal:16,key:'flips',reward:45},{id:'meters_350',name:'TRAVEL 350 METERS',goal:350,key:'meters',reward:65}]
];
const weeklyTasks=[
 {id:'meters_700',name:'TRAVEL 700 METERS',goal:700,key:'meters',reward:110},
 {id:'gems_14',name:'COLLECT 14 CRYSTALS',goal:14,key:'gems',reward:120},
 {id:'boosts_10',name:'MAKE 10 SLINGSHOTS',goal:10,key:'boosts',reward:130}
];
const STAT_KEYS=['meters','gems','near','boosts','flips','runs','bestCombo','dailyWins'];
let simulatedNow=null; // Test-only clock override, never used by the released game.
const currentDate=()=>simulatedNow===null?new Date():new Date(simulatedNow);
const localDayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function weekStart(d){const day=new Date(d.getFullYear(),d.getMonth(),d.getDate());day.setDate(day.getDate()-(day.getDay()+6)%7);return localDayKey(day)}
function keyHash(s){let h=2166136261>>>0;for(const c of s){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0}return h}
function dayMissions(key){const h=keyHash(key),used=new Set();return dailyPools.map((pool,i)=>{let j=(h+i*7)%pool.length;while(used.has(pool[j].key))j=(j+1)%pool.length;used.add(pool[j].key);return pool[j]})}
function blankStats(){return Object.fromEntries(STAT_KEYS.map(k=>[k,0]));}
function safeStats(src){const x=blankStats();for(const k of STAT_KEYS)x[k]=Math.max(0,Number(src?.[k])||0);return x}
function newPeriod(key){return {key,progress:blankStats(),done:[],bestScore:0,circuitClaimed:false}}
function dateUntilReset(which){const n=currentDate(),end=new Date(n.getFullYear(),n.getMonth(),n.getDate());end.setDate(end.getDate()+(which==='weekly'?(7-(n.getDay()+6)%7):1));const delta=Math.max(0,end-n),hours=Math.floor(delta/3600000),minutes=Math.floor(delta%3600000/60000);return `${hours}h ${String(minutes).padStart(2,'0')}m`}

function load(){try{return JSON.parse(localStorage.getItem('magnet_madness_v3')||'{}')}catch{return {}}}
let stored=load();
let panelReturn='ready';
const meta={best:Math.max(0,stored.best||0),bestDepth:Math.max(0,stored.bestDepth||0),coins:Math.max(0,stored.coins||0),owned:new Set(Array.isArray(stored.owned)?stored.owned:['chrome']),skin:stored.skin||'chrome',done:new Set(Array.isArray(stored.done)?stored.done:[]),runs:stored.runs||0,sound:stored.sound!==false,haptics:stored.haptics===true,
 sfxVolume:typeof stored.sfxVolume==='number'?clamp01(stored.sfxVolume):(stored.sound===false?0:.7),
 musicVolume:typeof stored.musicVolume==='number'?clamp01(stored.musicVolume):.35,
 screenShake:stored.screenShake!==false,reducedEffects:stored.reducedEffects===true,
 stats:safeStats(stored.stats),daily:stored.daily&&typeof stored.daily==='object'?stored.daily:newPeriod(localDayKey(currentDate())),weekly:stored.weekly&&typeof stored.weekly==='object'?stored.weekly:newPeriod(weekStart(currentDate())),daysPlayed:Array.isArray(stored.daysPlayed)?stored.daysPlayed.slice(-60):[],
 magnetSkin:magnetStyles.some(i=>i.id===stored.magnetSkin)?stored.magnetSkin:'classic',
 backgroundSkin:backgroundStyles.some(i=>i.id===stored.backgroundSkin)?stored.backgroundSkin:'reactor',
 ownedMagnets:new Set(Array.isArray(stored.ownedMagnets)?stored.ownedMagnets:['classic']),
 ownedBackgrounds:new Set(Array.isArray(stored.ownedBackgrounds)?stored.ownedBackgrounds:['reactor']),
 ownedSets:new Set(Array.isArray(stored.ownedSets)?stored.ownedSets:['reactor'])};
meta.owned.add('chrome');meta.ownedMagnets.add('classic');meta.ownedBackgrounds.add('reactor');meta.ownedSets.add('reactor');
if(!skins.some(i=>i.id===meta.skin) || !meta.owned.has(meta.skin))meta.skin='chrome';
if(!meta.ownedMagnets.has(meta.magnetSkin))meta.magnetSkin='classic';
if(!meta.ownedBackgrounds.has(meta.backgroundSkin))meta.backgroundSkin='reactor';
let missionTab='daily',lastPeriodPoll=-1,lastProgressSave=0,cosmeticTab='ball';
const cosmeticSelection={ball:'chrome',magnets:'classic',backgrounds:'reactor',sets:'reactor'};
function previewSelection(){
 const item=cosmeticSelection[cosmeticTab],look={ball:meta.skin,magnet:meta.magnetSkin,background:meta.backgroundSkin};
 if(cosmeticTab==='ball')look.ball=item;
 else if(cosmeticTab==='magnets')look.magnet=item;
 else if(cosmeticTab==='backgrounds')look.background=item;
 else {const set=cosmeticSets.find(x=>x.id===item);if(set)Object.assign(look,{ball:set.ball,magnet:set.magnet,background:set.background})}
 return look;
}
function ownedCosmetic(tab,id){if(tab==='ball')return meta.owned.has(id);
 if(tab==='magnets')return meta.ownedMagnets.has(id);
 if(tab==='backgrounds')return meta.ownedBackgrounds.has(id);
 if(tab==='sets'){const set=cosmeticSets.find(s=>s.id===id);return !!set && meta.owned.has(set.ball)&&meta.ownedMagnets.has(set.magnet)&&meta.ownedBackgrounds.has(set.background)}
 return false;
}
function cosmeticPrice(tab,id){const v=cosmeticCatalog[tab].find(s=>s.id===id);if(!v)return Infinity;
 if(ownedCosmetic(tab,id))return 0;
 if(tab==='sets')return Math.min(v.cost,[['ball',v.ball],['magnets',v.magnet],['backgrounds',v.background]].reduce((n,[t,i])=>n+cosmeticPrice(t,i),0));
 return v.cost;
}
function equipSelected(){
 const tab=cosmeticTab,id=cosmeticSelection[tab],item=cosmeticCatalog[tab].find(i=>i.id===id);if(!item)return false;
 const price=cosmeticPrice(tab,id);
 if(price<0){toast('UNLOCK VIA DAILY CIRCUIT',C.gold);return false}
 if(price>meta.coins){toast(`NEED ${price-meta.coins} ⚡`,C.pink);return false}
 if(price>0)meta.coins-=price;
 if(tab==='ball'){meta.owned.add(id);meta.skin=id}
 else if(tab==='magnets'){meta.ownedMagnets.add(id);meta.magnetSkin=id}
 else if(tab==='backgrounds'){meta.ownedBackgrounds.add(id);meta.backgroundSkin=id}
 else if(tab==='sets'){meta.owned.add(item.ball);meta.ownedMagnets.add(item.magnet);meta.ownedBackgrounds.add(item.background);meta.ownedSets.add(id);meta.skin=item.ball;meta.magnetSkin=item.magnet;meta.backgroundSkin=item.background;}
 save();chord(580,.8);toast(`${item.name} ${price?'UNLOCKED':'EQUIPPED'}`,C.green);return true;
}
function setCosmeticTab(tab){if(cosmeticTabs.includes(tab)){cosmeticTab=tab;const list=cosmeticCatalog[tab];if(!list.some(i=>i.id===cosmeticSelection[tab]))cosmeticSelection[tab]=list[0].id;}}
function save(){try{localStorage.setItem('magnet_madness_v3',JSON.stringify({best:meta.best,bestDepth:meta.bestDepth,coins:meta.coins,owned:[...meta.owned],skin:meta.skin,done:[...meta.done],runs:meta.runs,sound:meta.sfxVolume>0,haptics:meta.haptics,sfxVolume:meta.sfxVolume,musicVolume:meta.musicVolume,screenShake:meta.screenShake,reducedEffects:meta.reducedEffects,
 stats:meta.stats,daily:meta.daily,weekly:meta.weekly,daysPlayed:meta.daysPlayed,
 magnetSkin:meta.magnetSkin,backgroundSkin:meta.backgroundSkin,ownedMagnets:[...meta.ownedMagnets],ownedBackgrounds:[...meta.ownedBackgrounds],ownedSets:[...meta.ownedSets]}))}catch{}}
function syncPeriods(){
 const day=localDayKey(currentDate()),week=weekStart(currentDate());let changed=false;
 if(meta.daily.key!==day){meta.daily=newPeriod(day);changed=true}
 if(meta.weekly.key!==week){meta.weekly=newPeriod(week);changed=true}
 for(const scope of ['daily','weekly']){
  const p=meta[scope];if(!p.progress||typeof p.progress!=='object'){p.progress=blankStats();changed=true}
  p.progress=safeStats(p.progress);if(!Array.isArray(p.done)){p.done=[];changed=true}
 }
 if(changed)save();return changed;
}
function valueFor(key,scope){return Number((scope==='career'?meta.stats:meta[scope].progress)[key])||0}
function track(key,count=1){
 if(!STAT_KEYS.includes(key)||!Number.isFinite(count)||count<=0)return;
 syncPeriods();
 for(const o of [meta.stats,meta.daily.progress,meta.weekly.progress]){
  if(key==='bestCombo')o[key]=Math.max(o[key]||0,count);else o[key]=(o[key]||0)+count;
 }
 checkMissions();
}
function checkMissions(){
 let changed=false;
 for(const [scope,list] of [['daily',dayMissions(meta.daily.key)],['weekly',weeklyTasks],['career',careerTasks]]){
  const done=scope==='career'?meta.done:new Set(meta[scope].done);
  for(const m of list){if(done.has(m.id)||valueFor(m.key,scope)<m.goal)continue;
   done.add(m.id);meta.coins+=m.reward;changed=true;
   if(state.mode==='play')toast(`MISSION +${m.reward} ⚡`,C.green);
  }
  if(scope!=='career')meta[scope].done=[...done];
 }
 if(meta.stats.dailyWins>=5&&!meta.owned.has('aurora')){meta.owned.add('aurora');changed=true;if(state.mode==='play')toast('AURORA SKIN UNLOCKED',C.green)}
 if(changed)save();
}
// A run-scoped baseline prevents showing old lifetime achievements as new.
// It also lets the game rank quests by actual percentage gained in this run.
let runQuestBaseline=null, deathQuestResults=[];
function captureRunQuestBaseline(){
 return {dayKey:meta.daily.key,weekKey:meta.weekly.key,
  daily:{...meta.daily.progress},weekly:{...meta.weekly.progress},career:{...meta.stats},
  doneDaily:new Set(meta.daily.done),doneWeekly:new Set(meta.weekly.done),doneCareer:new Set(meta.done)};
}
function rankDeathQuests(){
 if(!runQuestBaseline)return [];
 const scopes=[
  {scope:'daily',tasks:dayMissions(meta.daily.key),before:runQuestBaseline.daily,
   doneBefore:runQuestBaseline.doneDaily,doneNow:new Set(meta.daily.done),valid:runQuestBaseline.dayKey===meta.daily.key},
  {scope:'weekly',tasks:weeklyTasks,before:runQuestBaseline.weekly,
   doneBefore:runQuestBaseline.doneWeekly,doneNow:new Set(meta.weekly.done),valid:runQuestBaseline.weekKey===meta.weekly.key},
  {scope:'career',tasks:careerTasks,before:runQuestBaseline.career,
   doneBefore:runQuestBaseline.doneCareer,doneNow:meta.done,valid:true}
 ];
 const results=[];
 for(const group of scopes){
  if(!group.valid)continue; // Do not compare across daily/weekly resets.
  for(const task of group.tasks){
   if(group.doneBefore.has(task.id))continue;
   const start=Math.max(0,Number(group.before[task.key])||0);
   const end=Math.max(0,valueFor(task.key,group.scope));
   const oldPct=Math.min(1,start/task.goal),newPct=Math.min(1,end/task.goal);
   const gainPct=Math.max(0,newPct-oldPct);
   const completed=group.doneNow.has(task.id);
   if(!completed&&gainPct<.00001)continue;
   results.push({id:group.scope+':'+task.id,scope:group.scope,name:task.name,
    goal:task.goal,start,end,oldPct,newPct,gainPct,completed,reward:task.reward});
  }
 }
 // New completions are always first; otherwise show the largest increase,
 // measured as a fraction of each quest goal rather than raw event counts.
 results.sort((a,b)=>Number(b.completed)-Number(a.completed)||b.gainPct-a.gainPct||b.newPct-a.newPct||
  ({daily:0,weekly:1,career:2}[a.scope]-{daily:0,weekly:1,career:2}[b.scope])||a.name.localeCompare(b.name));
 return results.slice(0,3);
}
function claimCircuit(){
 if(state.runMode!=='daily'||state.mode!=='play'||state.circuitDay!==meta.daily.key||meta.daily.circuitClaimed||Math.floor(state.dist/10)<250)return;
 meta.daily.circuitClaimed=true;meta.coins+=85;track('dailyWins');
 toast('DAILY CIRCUIT +85 ⚡',C.green);chord(760,1.15);save();
}
syncPeriods();
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function rnd(a,b){return a+(b-a)*rand()}
function fxRand(){fxSeed=(Math.imul(fxSeed,22695477)+1)>>>0;return fxSeed/4294967296}
function fxRnd(a,b){return a+(b-a)*fxRand()}
const world={magnets:[],hazards:[],gems:[],patterns:[],checks:[],validated:0,failed:0,solvable:false};
const state={mode:'ready',x:210,vx:0,dist:0,polarity:1,speed:156,boost:0,boostTime:0,flipPulse:0,score:0,gems:0,near:0,boosts:0,combo:0,comboTime:0,bonus:0,flips:0,time:0,shake:0,reason:'',effects:[],trail:[],messages:[],claimed:new Set(),awarded:new Set(),closest:new Map(),lastAuto:0,skinIndex:0,uiSlide:0,simT:0,slingCooldown:0,rings:[],pulseHit:0,runMode:'normal',progressMeters:0,circuitDay:null,reviveUsed:false,invuln:0,adPending:false,adError:'',runPaid:0,overdriveCharge:0,overdriveTime:0,orbit:null,shatters:0,resumeTimer:0,resumeFlash:0};
// True single-input steering: polarity changes horizontal forces, while falling is automatic.
// A smooth finite-range force avoids inverse-square singularity and frustrating snap-to-core.
// Magnet behavior is consistent between game simulation and procedural route solver.
// SURGE has a wider field, PULSE periodically weakens, and ordinary magnets retain a soft falloff.
function magnetGain(m,t){
 if(m.kind==='surge')return 1.52;
 if(m.kind==='pulse')return .18+.82*Math.pow(.5+.5*Math.sin(t*2.9+(m.phase||0)),2);
 if(m.kind==='orbit')return 1.18;
 return 1;
}
function force(m,x,y,pole,t=0){
 const dx=m.x-x,dy=m.y-y,d2=dx*dx+dy*dy;
 const reach=m.kind==='surge'?340:315;
 if(d2>reach*reach)return 0;
 const d=Math.max(37,Math.sqrt(d2));
 const falloff=Math.pow(Math.max(0,1-d/reach),1.42);
 return (m.pole===pole?-1:1)*1650*magnetGain(m,t)*falloff*dx/d;
}
function obstacleX(h,t){return h.kind==='slider'?h.x+Math.sin(t*2.5+h.phase)*h.amp:h.x}
function baseFall(distance){return Math.min(233,152+distance*.0035)}
// All procedurally appended magnets, hazards and gems are in ascending Y order.
// Binary search makes physics and rendering near-constant cost in long runs.
function fromY(list,y){let lo=0,hi=list.length;while(lo<hi){const m=(lo+hi)>>>1;if(list[m].y<y)lo=m+1;else hi=m}return lo}
function liveMagnet(id,objects=world){return objects.magnets.find(m=>m.id===id && !m.broken)}
function ballY(s=state,objects=world){if(s.orbit){const m=liveMagnet(s.orbit.id,objects);if(m)return m.y-s.dist+Math.sin(s.orbit.angle)*s.orbit.radius;}return BY}
function ballWorldY(s=state,objects=world){return s.dist+ballY(s,objects)}
function canBreakCrystal(s,h){return h.kind==='crystal' && ((s.overdriveTime||0)>0 || (s.speed||0)+Math.min(60,s.boost||0)>214 || Math.abs(s.vx||0)>185)}
function activateOverdrive(){state.overdriveCharge=0;state.overdriveTime=6.2;state.boost=Math.max(state.boost,48);state.shake=4.2;burst(state.x,ballY(),C.gold,24,1.15);shockwave(state.x,ballY(),C.gold,1.35);toast('OVERDRIVE!',C.gold);chord(700,1.1)}
function addOverdrive(amount){if(state.mode!=='play')return; if(state.overdriveTime>0){state.overdriveCharge=Math.min(100,state.overdriveCharge+amount*.22);return;} state.overdriveCharge=Math.min(100,state.overdriveCharge+amount); if(state.overdriveCharge>=100)activateOverdrive()}
function orbitLaunch(auto=false){
 if(!state.orbit)return false;
 const o=state.orbit,m=liveMagnet(o.id);
 const dir=Math.sign(o.omega)||1;
 const tx=-Math.sin(o.angle)*dir, ty=Math.cos(o.angle)*dir;
 if(m)state.x=m.x+Math.cos(o.angle)*o.radius;
 state.vx=Math.max(-308,Math.min(308,state.vx+tx*(auto?160:248)));
 state.boost=Math.min(92,state.boost+(auto?20:36)+Math.max(0,ty)*28+((state.overdriveTime||0)>0?16:0));
 state.speed=Math.max(state.speed,172+Math.max(0,ty)*56+((state.overdriveTime||0)>0?18:0));
 state.slingCooldown=.28;
 state.orbit=null;
 burst(state.x,ballY(),auto?C.cyan:C.gold,auto?12:18,auto?0.7:1.05);
 shockwave(state.x,ballY(),auto?C.cyan:C.gold,auto?0.7:1.12);
 if(!auto){state.boosts++;track('boosts');reward(95,'ORBIT LAUNCH');addOverdrive(26);chord(760,1.0)}
 return true;
}
function tryStartOrbit(){
 if(state.orbit||state.invuln>0)return false;
 const y=ballWorldY();
 for(let i=fromY(world.magnets,y-86);i<world.magnets.length;i++){
  const m=world.magnets[i];if(m.y>y+86)break;
  if(m.kind!=='orbit' || m.broken)continue;
  const dx=state.x-m.x,dy=y-m.y,d=Math.hypot(dx,dy);
  if(d<86&&d>44&&m.pole!==state.polarity && !state.awarded.has('orbitCap'+m.id)){
   state.orbit={id:m.id,angle:Math.atan2(dy,dx),radius:Math.max(58,Math.min(78,d)),omega:dx<0?2.9:-2.9,time:0};
   state.vx=0;state.slingCooldown=.5;state.awarded.add('orbitCap'+m.id);toast('ORBIT LOCK',C.cyan);burst(state.x,ballY(),C.cyan,10,.7);addOverdrive(10);return true;
  }
 }
 return false;
}
function updateOrbit(dt){
 const o=state.orbit,m=liveMagnet(o.id);
 if(!m){state.orbit=null;return true;}
 o.time+=dt;
 state.simT+=dt;
 state.speed=Math.max(96,baseFall(state.dist)*.46);
 state.boost=Math.max(0,(state.boost||0)-dt*18);
 o.angle+=o.omega*dt*(1+Math.min(.55,o.time*.8));
 state.x=m.x+Math.cos(o.angle)*o.radius;
 state.dist+=state.speed*dt*.36;
 if(state.x<LEFT+R+4)state.x=LEFT+R+4;
 if(state.x>RIGHT-R-4)state.x=RIGHT-R-4;
 const y=ballWorldY();
 for(let i=fromY(world.hazards,y-70);i<world.hazards.length;i++){
  const h=world.hazards[i];if(h.y>y+70)break;
  if(h.broken)continue;
  const dyy=h.y-y;
  const gap=Math.hypot(obstacleX(h,state.simT)-state.x,dyy)-(h.r+R+3);
  if(gap<0){ if(canBreakCrystal(state,h)){h.broken=true; state.shatters++; burst(obstacleX(h,state.simT),h.y-state.dist,C.gold,22,1.1); shockwave(obstacleX(h,state.simT),h.y-state.dist,C.gold,1); reward(80,'SHATTER'); addOverdrive(18); } else return false; }
 }
 if(o.time>1.35)orbitLaunch(true);
 return true;
}
function physics(s,dt,objects=world,collide=true,applyEffects=false){
 s.simT=(s.simT||0)+dt;
 s.slingCooldown=Math.max(0,(s.slingCooldown||0)-dt);
 const target=baseFall(s.dist)+Math.min(65,s.boost||0)+((s.overdriveTime||0)>0?44:0);
 s.speed+=(target-s.speed)*Math.min(1,dt*2.2);
 s.speed=Math.max(112,Math.min((s.overdriveTime||0)>0?340:296,s.speed));
 s.boost=Math.max(0,(s.boost||0)-dt*25);
 s.dist+=s.speed*dt;
 let ax=(210-s.x)*.1;
 const y=ballWorldY(s,objects);
 for(let i=fromY(objects.magnets,y-345);i<objects.magnets.length;i++){const m=objects.magnets[i];if(m.y>y+345)break;if(m.broken)continue;ax+=force(m,s.x,y,s.polarity,s.simT)}
 // A soft horizontal cap and continuous damping make the ball predictable.
 s.vx=(s.vx+Math.max(-2000,Math.min(2000,ax))*dt)*Math.exp(-.99*dt);
 s.vx=Math.max(-266,Math.min(266,s.vx));
 s.x+=s.vx*dt;
 if(s.x<LEFT+R+4){s.x=LEFT+R+4;s.vx=Math.max(0,s.vx)*.25}
 if(s.x>RIGHT-R-4){s.x=RIGHT-R-4;s.vx=Math.min(0,s.vx)*.25}
 if(collide){
  for(let i=fromY(objects.magnets,y-62);i<objects.magnets.length;i++){
   const m=objects.magnets[i];if(m.y>y+62)break;if(m.broken)continue;
   const dyy=m.y-y;
   const gap=Math.hypot(m.x-s.x,dyy)-(34+R-3);
   if(s.minGap!==undefined)s.minGap=Math.min(s.minGap,gap);
   if(gap<0)return false;
  }
  for(let i=fromY(objects.hazards,y-60);i<objects.hazards.length;i++){
   const h=objects.hazards[i];if(h.y>y+60)break;if(h.broken)continue;
   const dyy=h.y-y;
   const gap=Math.hypot(obstacleX(h,s.simT)-s.x,dyy)-(h.r+R+3);
   if(s.minGap!==undefined)s.minGap=Math.min(s.minGap,gap);
   if(gap<0){
    if(canBreakCrystal(s,h)){ if(applyEffects && !h.broken){ h.broken=true; state.shatters++; burst(obstacleX(h,state.simT),h.y-state.dist,C.gold,22,1.1); shockwave(obstacleX(h,state.simT),h.y-state.dist,C.gold,1); reward(80,'SHATTER'); addOverdrive(18);} continue; }
    return false;
   }
  }
 }
 return true;
}
function sling(s,objects=world){
 if((s.slingCooldown||0)>0)return null;
 let impulse=0,source=null;
 const y=ballWorldY(s,objects);
 for(let i=fromY(objects.magnets,y-162);i<objects.magnets.length;i++){
  const m=objects.magnets[i];if(m.y>y+162)break;
  const dx=s.x-m.x,dy=y-m.y,d=Math.hypot(dx,dy);
  if(d<162&&d>48&&s.polarity===m.pole){
   const p=Math.pow(Math.max(0,1-d/174),1.15)*184*magnetGain(m,s.simT||0)*Math.sign(dx||1);
   if(Math.abs(p)>Math.abs(impulse)){impulse=p;source=m}
  }
 }
 if(source&&Math.abs(impulse)>29){
  s.vx=Math.max(-266,Math.min(266,s.vx+impulse));
  s.boost=Math.min(70,(s.boost||0)+30);
  s.slingCooldown=.34;
  s.lastSling=source.id;
  return source;
 }
 return null;
}
function solverStep(nodes,objs,steps=1){
 let beam=nodes;
 for(let k=0;k<steps;k++){
  const next=new Map();
  for(const n of beam){for(let choice=0;choice<2;choice++){
   const s={...n};if(choice){s.polarity*=-1;sling(s,objs)}
   // match actual 120 Hz integration for validating movement through obstacles
   let alive=true;
   for(let j=0;j<14;j++){if(!physics(s,DT,objs)){alive=false;break}}
   if(!alive)continue;
   const key=`${Math.round(s.x/13)}:${Math.round(s.vx/40)}:${s.polarity}:${Math.round(s.dist/62)}`;
   const old=next.get(key);
   if(!old || (s.minGap||0)>(old.minGap||0)+3 || Math.abs(s.vx)<Math.abs(old.vx)*.8)next.set(key,s);
  }}
  beam=[...next.values()].sort((a,b)=>b.dist-a.dist||Math.abs(a.vx)-Math.abs(b.vx)).slice(0,95);
  if(!beam.length)break;
 }
 return beam;
}
// Geometry safety: the centre of the ball stays between PLAYER_LEFT and
// PLAYER_RIGHT, while a magnet blocks MAGNET_CLEARANCE around its centre.
// The old generator put magnets at x=77..155 (and their right-hand mirrors).
// This left *almost* passable wall pockets; inside them, attraction pulled the
// ball into the magnet while repulsion pinned it against the wall.
//
// Two valid layouts only:
//   1. Wall-mounted magnet: its centre is BEHIND the playable ball-centre edge.
//      The repelling polarity therefore pushes an edge-trapped ball INWARDS.
//   2. Free-standing magnet: allow >= 56 units of ball-centre travel beside it.
//      The player can stay on the outside and fall safely past the obstacle.
const PLAYER_LEFT=LEFT+R+4,PLAYER_RIGHT=RIGHT-R-4;
const MAGNET_CLEARANCE=34+R-3, MIN_SIDE_LANE=56;
const FREE_LEFT=PLAYER_LEFT+MAGNET_CLEARANCE+MIN_SIDE_LANE;
const FREE_RIGHT=PLAYER_RIGHT-MAGNET_CLEARANCE-MIN_SIDE_LANE;
const WALL_MAGNET_LEFT=LEFT+8,WALL_MAGNET_RIGHT=RIGHT-8;
function safeMagnetX(x,kind='normal'){
 // Orbit capture needs an unobstructed circular path, never wall mounting.
 if(kind==='orbit')return Math.max(185,Math.min(235,x));
 if(x<FREE_LEFT)return x<=134?WALL_MAGNET_LEFT:FREE_LEFT;
 if(x>FREE_RIGHT)return x>=286?WALL_MAGNET_RIGHT:FREE_RIGHT;
 return x;
}
function addMag(x,y,pole,chunk,pattern,kind='normal'){
 x=safeMagnetX(x,kind);
 world.magnets.push({id:'m'+world.magnets.length,x,y,pole,chunk,pattern,kind,
  phase:rand()*6.283,side:x<101?'left':x>320?'right':'float'});
}
const STAGE_START_Y=1020; // Keep the first generated magnet below the idle viewport.
function candidates(i){
 const y=STAGE_START_Y+i*305,pole=rand()<.5?1:-1,sw=rand()<.5?1:-1;
 const level=i<3?0:i<7?1:i<13?2:3;
 const patterns=level===0?['edge','center','gate']:
  level===1?['edge','center','gate','slalom','offset']:
  ['edge','center','gate','slalom','offset','split','pulse','surge','pinch','orbit','orbitpair'];
 const pattern=i===0?'edge':patterns[Math.floor(rand()*patterns.length)];
 const mk=(x,off=0,p=pole,kind='normal')=>addMag(x,y+off,p,i,pattern,kind);
 if(pattern==='edge')mk(sw>0?77:343);
 else if(pattern==='center')mk(sw>0?181:239);
 else if(pattern==='gate'){mk(117);mk(303,0,-pole)}
 else if(pattern==='slalom'){mk(sw>0?148:272);mk(sw>0?292:128,137,-pole)}
 else if(pattern==='offset'){mk(sw>0?85:335);mk(sw>0?266:154,138,-pole)}
 else if(pattern==='split'){mk(sw>0?155:267);mk(sw>0?292:126,125,-pole)}
 else if(pattern==='pulse')mk(sw>0?175:245,0,pole,'pulse');
 else if(pattern==='surge')mk(sw>0?92:328,0,pole,'surge');
 else if(pattern==='orbit')mk(sw>0?165:255,0,pole,'orbit');
 else if(pattern==='orbitpair'){mk(sw>0?148:272,0,pole,'orbit');mk(sw>0?286:134,148,-pole)}
 else if(pattern==='pinch'){mk(sw>0?134:286,0,pole,'pulse');mk(sw>0?292:128,142,-pole)}
 // Gameplay breathers: the first two sections have no hazard; advanced sections
 // are harder because of decisions, not simply unbounded acceleration.
 const hazardChance=level===0?0:level===1?.25:level===2?.40:.52;
 if(rand()<hazardChance){
  const hy=y+171,hx=[185,210,235][Math.floor(rand()*3)];
  if(world.magnets.every(m=>Math.hypot(m.x-hx,m.y-hy)>103)){
   const roll=rand();
   const crystal=level>=1&&roll<.26;
   const moving=!crystal&&level>=2&&roll<.62;
   // Even at the extreme slider position, leave a real side passage.
   // Previous x=111/309 rotors created dead-end pockets near the rails.
   world.hazards.push({id:'h'+i+'-'+world.hazards.length,x:hx,y:hy,r:crystal?(level<3?17:19):(level<2?14:16),
    kind:crystal?'crystal':(moving?'slider':'rotor'),amp:moving?(hx===210?25:12):0,phase:rand()*6.283,broken:false});
  }
 }
 world.patterns.push({i,pattern,level,passes:false});
}
function safeFallback(i){
 const y=STAGE_START_Y+i*305;
 addMag(i%2?76:344,y,i%2?1:-1,i,'fallback');
 world.patterns.push({i,pattern:'fallback',level:0,passes:false});
}
function appendStage(chunks=20){
 // Grow the endless shaft in verified blocks. Each candidate is accepted only
 // when a physical single-tap route remains reachable from the previous block.
 let beam=world.beam,start=world.nextChunk;
 for(let i=start;i<start+chunks;i++){
  let passed=false;
  for(let attempt=0;attempt<7;attempt++){
   const ml=world.magnets.length,hl=world.hazards.length,pl=world.patterns.length;
   if(attempt===6)safeFallback(i);else candidates(i);
   let probe=beam.map(s=>({...s,minGap:999})),steps=0,target=STAGE_START_Y+i*305+205;
   while(probe.length&&Math.max(...probe.map(s=>s.dist))<target&&steps++<96)probe=solverStep(probe,world,1);
   const viable=probe.filter(s=>s.minGap>=5 && s.dist>=target-16);
   if(viable.length>=2){
    const hi=Math.max(...viable.map(s=>s.dist));beam=viable.filter(s=>s.dist>hi-135).slice(0,95);
    world.patterns.at(-1).passes=true;
    world.checks.push({chunk:i,pattern:world.patterns.at(-1).pattern,attempt,reachable:beam.length,minClearance:Math.round(Math.min(...beam.map(s=>s.minGap)))});
    world.validated++;passed=true;break;
   }
   world.magnets.length=ml;world.hazards.length=hl;world.patterns.length=pl;world.failed++;
  }
  if(!passed){
   // Last resort is an empty corridor, preserving the run instead of a trap.
   const target=STAGE_START_Y+i*305+205;let probe=beam.map(s=>({...s,minGap:999})),steps=0;
   while(probe.length&&Math.max(...probe.map(s=>s.dist))<target&&steps++<96)probe=solverStep(probe,world,1);
   if(!probe.length){world.solvable=false;break}
   beam=probe.filter(s=>s.minGap>0).slice(0,95);world.validated++;world.checks.push({chunk:i,pattern:'clear',attempt:8,reachable:beam.length,minClearance:beam.length?Math.round(Math.min(...beam.map(s=>s.minGap))):0});
  }
 }
 world.nextChunk=world.validated;world.beam=beam;world.solvable=world.validated===start+chunks;
 // Generate collectible gems alongside the ever-extending obstacle field.
 const endY=STAGE_START_Y+world.nextChunk*305+280;
 // Keep pickups out of the idle/start viewport. The first one arrives only
 // after the player has spent several seconds steering the ball.
 const FIRST_GEM_Y=1330;
 while(FIRST_GEM_Y+world.gemCursor*148 < endY){
  const i=world.gemCursor++,y=FIRST_GEM_Y+i*148;
  const x=[132,210,288,170,250][i%5]+rnd(-12,12);
  if(world.magnets.some(m=>Math.hypot(m.x-x,m.y-y)<61)||world.hazards.some(h=>Math.hypot(h.x-x,h.y-y)<46))continue;
  world.gems.push({id:'g'+i,x,y});
 }
 return world.solvable;
}
function stage(){
 seed=state.runMode==='daily'?keyHash(meta.daily.key+'-circuit'):(92371+(meta.runs+1)*7559)>>>0;
 Object.assign(world,{magnets:[],hazards:[],gems:[],patterns:[],checks:[],validated:0,failed:0,solvable:false,nextChunk:0,gemCursor:0,beam:[{x:210,vx:0,dist:0,polarity:1,speed:152,boost:0,simT:0,slingCooldown:0,minGap:999}]});
 appendStage(20);
}
function burst(x,y,color,n=12,mul=1){if(meta.reducedEffects)n=Math.ceil(n*.38);n=Math.min(n,lowFx()?10:26);for(let i=0;i<n;i++){
 let a=fxRand()*6.283,spd=fxRnd(38,170)*mul;state.effects.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:fxRnd(1.2,3.6),life:fxRnd(.22,.72),max:.72,color});}}
// Offline, original soundtrack. Stream compressed MP3 instead of creating WebAudio
// oscillators for every music note during the game's 120Hz physics loop.
const MENU_MUSIC={id:'menu-aurora',url:'audio/menu-aurora.mp3'};
const RUN_MUSIC=[
 {id:'magnetic-pulse',url:'audio/magnetic-pulse.mp3'},
 {id:'polarity-shift',url:'audio/polarity-shift.mp3'},
 {id:'deep-current',url:'audio/deep-current.mp3'},
 {id:'overcharge',url:'audio/overcharge.mp3'}
];
const FADE_TIME_MS=1500;
let musicUnlocked=false,musicCurrent=null,musicOutgoing=null,musicScene=null;
let musicBag=[],lastGameTrack=null,lastMusicUpdate=0;
function nextGameTrack(){
 if(!musicBag.length){
  musicBag=RUN_MUSIC.slice();
  // Shuffle-bag avoids repetition until every track has played.
  for(let i=musicBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[musicBag[i],musicBag[j]]=[musicBag[j],musicBag[i]]}
  if(musicBag.length>1&&musicBag[musicBag.length-1].id===lastGameTrack){
   [musicBag[0],musicBag[musicBag.length-1]]=[musicBag[musicBag.length-1],musicBag[0]];
  }
 }
 const t=musicBag.pop();lastGameTrack=t.id;return t;
}
function desiredMusicScene(){
 const mode=['skins','missions','settings','records'].includes(state.mode)?panelReturn:state.mode;
 return mode==='ready'?'menu':'run';
}
function stopAudio(entry){if(!entry)return;entry.element.pause();entry.element.removeAttribute('src');entry.element.load()}
function switchSoundtrack(scene,force=false){
 if(!musicUnlocked||typeof Audio==='undefined')return;
 if(!force && musicScene===scene&&musicCurrent)return;
 const track=scene==='menu'?MENU_MUSIC:nextGameTrack();
 if(musicOutgoing){stopAudio(musicOutgoing);musicOutgoing=null}
 musicOutgoing=musicCurrent;
 if(musicOutgoing)musicOutgoing.fadeAt=performance.now();
 musicScene=scene;
 const element=new Audio(track.url);element.preload='auto';element.loop=scene==='menu';element.volume=0;
 const entry={element,id:track.id,scene,fadeAt:performance.now()};
 musicCurrent=entry;
 element.addEventListener('ended',()=>{
  if(musicCurrent===entry&&entry.scene==='run')switchSoundtrack('run',true)
 });
 element.play().catch(()=>{}); // No playback until a user gesture unlocks audio.
 updateSoundtrack(true);
}
function updateSoundtrack(force=false){
 if(!musicUnlocked)return;
 const now=performance.now();
 if(!force && now-lastMusicUpdate<85)return;
 lastMusicUpdate=now;
 const scene=desiredMusicScene();
 if(scene!==musicScene||!musicCurrent){switchSoundtrack(scene,true);return}
 // Start next composition before the current one ends for a gentle crossfade.
 const e=musicCurrent.element;
 if(scene==='run'&&Number.isFinite(e.duration)&&e.duration>2&&e.currentTime>e.duration-1.55){
  switchSoundtrack('run',true);return;
 }
 const mode=state.mode;
 const attenuation=document.hidden||mode==='ad'?0:mode==='pause'?.12:mode==='resume'?.24:mode==='over'?.35:1;
 const targetVolume=Math.min(1,Math.max(0,meta.musicVolume*attenuation*.86));
 const fadeIn=Math.max(0,Math.min(1,(now-musicCurrent.fadeAt)/FADE_TIME_MS));
 e.volume=targetVolume*fadeIn;
 if(musicOutgoing){
  const fadeOut=Math.max(0,1-(now-musicOutgoing.fadeAt)/FADE_TIME_MS);
  musicOutgoing.element.volume=targetVolume*fadeOut;
  if(fadeOut<=0){stopAudio(musicOutgoing);musicOutgoing=null}
 }
 // A fully muted soundtrack consumes no decoding time; user input resumes it.
 if(targetVolume<.001){
  if(!e.paused)e.pause();
  if(musicOutgoing&&!musicOutgoing.element.paused)musicOutgoing.element.pause();
 }else{
  if(e.paused)e.play().catch(()=>{});
  if(musicOutgoing&&musicOutgoing.element.paused)musicOutgoing.element.play().catch(()=>{});
 }
}
function initAudio(){
 try{
  if(!audio){const AC=window.AudioContext||window.webkitAudioContext;
   if(AC){audio=new AC();sfxBus=audio.createGain();sfxBus.connect(audio.destination)}
  }
  if(audio&&audio.state==='suspended')audio.resume().catch(()=>{});
  musicUnlocked=true;setAudioMix();return true;
 }catch{return false}
}
function setAudioMix(){
 if(audio&&sfxBus)sfxBus.gain.setTargetAtTime(meta.sfxVolume,audio.currentTime,.025);
 if(musicUnlocked)updateSoundtrack(true);
}
function blip(freq=420,dur=.08,type='sine',gain=.05){if(meta.sfxVolume<=0)return;try{
 if(!initAudio()||!audio||!sfxBus)return;
 const osc=audio.createOscillator(),vol=audio.createGain(),t=audio.currentTime;
 osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(65,freq*.65),t+dur);
 vol.gain.setValueAtTime(gain,t);vol.gain.exponentialRampToValueAtTime(.001,t+dur);
 osc.connect(vol);vol.connect(sfxBus);osc.start(t);osc.stop(t+dur+.01);
 }catch{}
}
function chord(freq=520,energy=1){
 blip(freq,.11,'triangle',.035*energy);
 blip(freq*1.48,.17,'sine',.020*energy);
}
function shockwave(x,y,color,power=1){
 state.rings.push({x,y,r:21,life:.58,max:.58,color,power});
 if(state.rings.length>28)state.rings.shift();
}
function toast(message,color=C.gold){state.messages=[{text:message,color,life:.88}]}
function reward(points,why,skill=true){
 if(skill){state.combo=state.comboTime>0?Math.min(8,state.combo+1):1;state.comboTime=4.3;track('bestCombo',state.combo);}
 const mul=state.combo>0?state.combo:1, over=(state.overdriveTime||0)>0?1.35:1;
 const plus=Math.round(points*mul*over);state.bonus+=plus;state.score+=plus;
 toast(why+'  +'+plus+(mul>1?'  x'+mul:'')+((state.overdriveTime||0)>0?'  OD':''),C.gold);
 if(skill&&mul>1){blip(440+mul*68,.11,'triangle',.035);state.rings.push({x:state.x,y:ballY(),r:19,life:.44,max:.44,color:C.gold});}
}

// Optional native AdMob bridge. A trusted Android wrapper should expose
// window.MagnetRewardedAds.showRewarded('revive'), resolving to {rewarded:true}
// ONLY from the SDK's onUserEarnedReward callback. No reward on dismissal/error.
// Test build: fake rewarded ad is enabled by default until the real SDK exists.
// This 3-second placeholder is NOT a paid ad and must be removed before release.
const demoAds=true;
let demoAdEndAt=0;
function canShowRewarded(){return !!(window.MagnetRewardedAds&&typeof window.MagnetRewardedAds.showRewarded==='function')||demoAds}
function commitEarnings(){
 // One lifetime of a run may end twice (before and after a rewarded continue).
 // Credit only the difference from previous settlement, not the full payout again.
 const earned=Math.floor(state.score/190)+state.gems*2;
 const delta=Math.max(0,earned-(state.runPaid||0));
 meta.coins+=delta;state.runPaid=Math.max(state.runPaid||0,earned);
 meta.best=Math.max(meta.best,state.score);
 meta.bestDepth=Math.max(meta.bestDepth,Math.floor(state.dist/10));
 if(state.runMode==='daily')meta.daily.bestScore=Math.max(meta.daily.bestScore||0,state.score);
 checkMissions();save();
}
function collisionClearance(x,dist){
 const y=dist+BY;
 let gap=999;
 for(let i=fromY(world.magnets,y-90);i<world.magnets.length;i++){const m=world.magnets[i];if(m.y>y+90)break;if(!m.broken)gap=Math.min(gap,Math.hypot(m.x-x,m.y-y)-(34+R-3));}
 for(let i=fromY(world.hazards,y-75);i<world.hazards.length;i++){const h=world.hazards[i];if(h.y>y+75)break;if(!h.broken)gap=Math.min(gap,Math.hypot(obstacleX(h,state.simT)-x,h.y-y)-(h.r+R+3));}
 return gap;
}
function reviveAfterReward(){
 if(state.mode!=='ad'||state.reviveUsed)return false;
 state.reviveUsed=true;state.adPending=false;state.adError='';state.mode='play';setAudioMix();
 // Go back half a second to give the player a readable restart, and give a
 // brief shield. Keeping claimed/awarded sets avoids replayed pickup rewards.
 state.dist=Math.max(0,state.dist-95);
 const xs=[state.x,210,90,330,140,280,185,235];
 let best=xs[0],quality=-Infinity;
 for(const x of xs){const cx=Math.max(LEFT+R+4,Math.min(RIGHT-R-4,x));
  const q=collisionClearance(cx,state.dist)-Math.abs(cx-state.x)*.07;
  if(q>quality){quality=q;best=cx}}
 state.x=best;state.vx=0;state.boost=0;state.slingCooldown=.5;
 state.speed=baseFall(state.dist);state.combo=0;state.comboTime=0;state.orbit=null;
 state.invuln=3.0;state.uiSlide=0;state.trail=[];state.effects=[];state.shake=0;state.overdriveTime=0;state.overdriveCharge=Math.min(40,state.overdriveCharge);
 burst(state.x,ballY(),C.green,28,1.1);shockwave(state.x,ballY(),C.green,1.15);
 chord(630,.9);status.textContent='Revived. Shield active for a short time.';
 toast('REVIVED • SHIELD ACTIVE',C.green);return true;
}
async function requestRevive(){
 if(state.mode!=='over'||state.reviveUsed||state.adPending)return false;
 if(!canShowRewarded()){state.adError='REWARDED ADS UNAVAILABLE';render();return false}
 state.adPending=true;state.adError='';state.mode='ad';demoAdEndAt=performance.now()+3000;setAudioMix();status.textContent='Test advertisement • 3 seconds';render();
 try{
  let result;
  if(window.MagnetRewardedAds&&typeof window.MagnetRewardedAds.showRewarded==='function'){
   result=await window.MagnetRewardedAds.showRewarded('revive');
  }else if(demoAds){
   // The player sees a plain fake ad screen for exactly three wall-clock seconds.
   await new Promise(resolve=>setTimeout(resolve,3000));result={rewarded:true,demo:true};
  }
  if(state.mode!=='ad')return false;
  if(result&&result.rewarded===true)return reviveAfterReward();
  state.adError='AD CLOSED • NO REVIVE';
 }catch(e){state.adError='AD NOT AVAILABLE • RETRY NORMALLY';}
 state.adPending=false;state.mode='over';setAudioMix();status.textContent=state.adError;render();return false;
}

function resetRun(soft=false,runMode='normal'){
 // The normal first run continues the ready-state shaft without reinitialization.
 syncPeriods();runQuestBaseline=captureRunQuestBaseline();deathQuestResults=[];meta.runs++;
 state.runMode=runMode;state.circuitDay=runMode==='daily'?meta.daily.key:null;
 if(!soft||runMode==='daily')stage();
 Object.assign(state,{mode:'play',x:210,vx:0,dist:0,polarity:1,speed:156,boost:0,flipPulse:0,
  score:0,gems:0,near:0,boosts:0,combo:0,comboTime:0,bonus:0,flips:0,time:0,shake:0,
  reason:'',effects:[],trail:[],messages:[],claimed:new Set(),awarded:new Set(),
  closest:new Map(),uiSlide:soft?1:0,simT:0,slingCooldown:0,rings:[],pulseHit:0,progressMeters:0,reviveUsed:false,invuln:0,adPending:false,adError:'',runPaid:0,overdriveCharge:0,overdriveTime:0,orbit:null,shatters:0,resumeTimer:0,resumeFlash:0});
 const today=localDayKey(currentDate());if(!meta.daysPlayed.includes(today))meta.daysPlayed=[...meta.daysPlayed,today].slice(-60);
 track('runs');save();status.textContent='Playing. Tap to switch polarity.';
 if(musicUnlocked)switchSoundtrack('run',true);
}
// RETRY goes to the same seamless tap-to-play home screen; it never starts a run.
function returnToHome(){
 syncPeriods();
 state.runMode='normal';state.circuitDay=null;runQuestBaseline=null;deathQuestResults=[];
 Object.assign(state,{mode:'ready',x:210,vx:0,dist:0,polarity:1,speed:156,boost:0,flipPulse:0,
  score:0,gems:0,near:0,boosts:0,combo:0,comboTime:0,bonus:0,flips:0,time:0,shake:0,
  reason:'',effects:[],trail:[],messages:[],claimed:new Set(),awarded:new Set(),
  closest:new Map(),uiSlide:0,simT:0,slingCooldown:0,rings:[],pulseHit:0,progressMeters:0,
  reviveUsed:false,invuln:0,adPending:false,adError:'',runPaid:0,overdriveCharge:0,overdriveTime:0,orbit:null,shatters:0,resumeTimer:0,resumeFlash:0});
 stage();
 status.textContent='Tap empty space to begin';
 setAudioMix();render();
}
function pauseRun(){
 if(state.mode!=='play')return false;
 state.mode='pause';state.resumeTimer=0;state.resumeFlash=0;setAudioMix();status.textContent='Paused';render();return true;
}
function beginResumeCountdown(){
 if(state.mode!=='pause')return false;
 state.mode='resume';state.resumeTimer=3;state.resumeFlash=0;setAudioMix();blip(520,.08,'triangle',.03);status.textContent='Resume in 3';render();return true;
}
function pauseContinueBounds(){return {x:64,y:334,w:292,h:62}}
function pauseSettingsBounds(){return {x:64,y:406,w:138,h:52}}
function pauseHomeBounds(){return {x:218,y:406,w:138,h:52}}
// Both game-over actions use exactly the same dimensions and stay aligned.
function reviveBounds(){return {x:48,y:552,w:155,h:68}}
function retryBounds(){return {x:217,y:552,w:155,h:68}}
function retryHit(x,y){const b=retryBounds();return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h}
function die(reason){if(state.mode!=='play')return;state.mode='over';state.reason=reason;state.shake=12;
 state.orbit=null;state.deathUiTime=0;burst(state.x,ballY(),C.pink,34,2);blip(170,.35,'sawtooth',.035);
 commitEarnings();deathQuestResults=rankDeathQuests();
 status.textContent='Game over '+reason+'. Score '+state.score+'. Choose revive or return to start.';
 setAudioMix();}
function flip(){if(state.mode!=='play')return;
 if(state.orbit){orbitLaunch(false);return}
 state.polarity*=-1;state.flips++;state.flipPulse=1;track('flips');
 let m=sling(state);
 if(m && !state.awarded.has('boost'+m.id)){
  state.awarded.add('boost'+m.id);state.boosts++;track('boosts');state.shake=3.5;addOverdrive(20);
  burst(state.x,ballY(),state.polarity===1?C.cyan:C.pink,22,1.8);shockwave(state.x,ballY(),C.gold,1.25);reward(75,'PERFECT FLIP');chord(640,1.2);
 }else{burst(state.x,ballY(),state.polarity===1?C.cyan:C.pink,7,.8);shockwave(state.x,ballY(),state.polarity===1?C.cyan:C.pink,.65);blip(state.polarity===1?520:350,.075,'sine',.030)}
 if(meta.haptics&&navigator.vibrate)try{navigator.vibrate(12)}catch{}
 status.textContent='Polarity '+(state.polarity===1?'N':'S');
}
function skinTap(px,py){
 // Four compact catalog tabs; selected cards update the live preview without charging.
 if(py>=218&&py<=258){const n=Math.floor((px-25)/92.5);if(n>=0&&n<4){setCosmeticTab(cosmeticTabs[n]);return true}}
 const items=cosmeticCatalog[cosmeticTab];
 if(py>=390&&py<607){const col=Math.floor((px-25)/123.5),row=Math.floor((py-390)/108),i=row*3+col;
  if(col>=0&&col<3&&row>=0&&row<2&&i<items.length){cosmeticSelection[cosmeticTab]=items[i].id;blip(390,.06,'sine',.014);return true}}
 if(py>=611&&py<=663&&px>=45&&px<=375){equipSelected();return true}
 return false;
}
// Non-blocking home screen: every point outside the 4 icon hit zones starts a run.
const homeButtons=[
 {id:'skins',x:87,y:414,label:'SKINS'},
 {id:'missions',x:87,y:512,label:'MISSIONS'},
 {id:'settings',x:333,y:414,label:'SETTINGS'},
 {id:'records',x:333,y:512,label:'RECORDS'}
];
function openPanel(which,from=state.mode){syncPeriods();panelReturn=['ready','play','over','pause'].includes(from)?from:'ready';state.mode=which;setAudioMix();if(which==='missions')missionTab='daily';if(which==='skins'){cosmeticTab='ball';cosmeticSelection.ball=meta.skin;cosmeticSelection.magnets=meta.magnetSkin;cosmeticSelection.backgrounds=meta.backgroundSkin;}status.textContent=which+' panel';}
function closePanel(){settingsDrag=null;state.mode=panelReturn;setAudioMix();status.textContent=state.mode==='ready'?'Tap empty space to begin':state.mode==='play'?'Playing. Tap to switch polarity.':state.mode==='pause'?'Paused':'Game over. Use Retry to return to start';}
function homeHit(px,py){for(const btn of homeButtons){if(Math.hypot(px-btn.x,py-btn.y-(H-760)*.48)<43){openPanel(btn.id,'ready');return true}}return false}
function inputPoint(e){
 if(!e)return {x:210,y:385};
 const b=canvas.getBoundingClientRect(), x=(e.clientX-b.left)*W/b.width;
 let y=(e.clientY-b.top)*H/b.height;
 if(['skins','missions','settings','records','over','pause','ad','resume'].includes(state.mode)) y-=(H-760)*.5;
 return {x,y};
}
function changeVolume(channel,x){
 const value=Math.round(clamp01((x-77)/266)*100)/100;
 if(channel==='sfx')meta.sfxVolume=value;
 else meta.musicVolume=value;
 meta.sound=meta.sfxVolume>0;
 setAudioMix();render();
}
function settingsPointer(px,py,e){
 const channel=(py>=288&&py<=338)?'sfx':(py>=409&&py<=458)?'music':null;
 if(channel&&px>=52&&px<=370){settingsDrag={channel,id:e.pointerId};
  if(canvas.setPointerCapture)try{canvas.setPointerCapture(e.pointerId)}catch{}
  changeVolume(channel,px);return true;
 }
 if(py>=476&&py<=562){
  if(px<210){meta.haptics=!meta.haptics;if(meta.haptics&&navigator.vibrate)try{navigator.vibrate(28)}catch{}}
  else meta.screenShake=!meta.screenShake;
  save();render();return true;
 }
 if(py>=573&&py<=646){meta.reducedEffects=!meta.reducedEffects;save();render();return true;}
 return false;
}
function onSettingsPointerMove(e){if(!settingsDrag)return;
 e.preventDefault();if(e.pointerId!==settingsDrag.id)return;
 changeVolume(settingsDrag.channel,inputPoint(e).x);
}
function onSettingsPointerUp(e){if(!settingsDrag||e.pointerId!==settingsDrag.id)return;
 const channel=settingsDrag.channel;settingsDrag=null;save();
 if(channel==='sfx')blip(600,.10,'sine',.045);
 if(canvas.releasePointerCapture)try{canvas.releasePointerCapture(e.pointerId)}catch{}
}
function onInput(e){
 if(e)e.preventDefault();if(e)initAudio();const p=inputPoint(e);
 if(state.mode==='ready'){if(homeHit(p.x,p.y))return;resetRun(true);return}
 if(['skins','missions','settings','records'].includes(state.mode)){
  if(state.mode==='missions'){
   if(p.y>=226&&p.y<=277&&p.x>=25&&p.x<=395){missionTab=['daily','weekly','career'][Math.min(2,Math.floor((p.x-25)/123.5))];render();return}
   if(missionTab==='daily'&&p.y>=592&&p.y<=653&&p.x>=50&&p.x<=370){resetRun(false,'daily');return}
  }
  if(state.mode==='skins'&&skinTap(p.x,p.y))return;
  if(state.mode==='settings'&&settingsPointer(p.x,p.y,e))return;
  if((p.y>658&&p.y<744)||(p.x>354&&p.y<130)){closePanel();return}
  return;
 }
 if(state.mode==='ad')return; // Prevent double taps while external ad UI is active.
 if(state.mode==='over'){
  const revive=reviveBounds();if(!state.reviveUsed&&p.x>=revive.x&&p.x<=revive.x+revive.w&&p.y>=revive.y&&p.y<=revive.y+revive.h){requestRevive();return}
  // Only the retry button can leave the death screen. Never start a run here.
  if(retryHit(p.x,p.y))returnToHome();
  return;
 }
 if(state.mode==='pause'){
  const cont=pauseContinueBounds(),setb=pauseSettingsBounds(),homeb=pauseHomeBounds();
  if(p.x>=cont.x&&p.x<=cont.x+cont.w&&p.y>=cont.y&&p.y<=cont.y+cont.h){beginResumeCountdown();return}
  if(p.x>=setb.x&&p.x<=setb.x+setb.w&&p.y>=setb.y&&p.y<=setb.y+setb.h){openPanel('settings','pause');return}
  if(p.x>=homeb.x&&p.x<=homeb.x+homeb.w&&p.y>=homeb.y&&p.y<=homeb.y+homeb.h){returnToHome();return}
  return
 }
 if(state.mode==='resume')return;
 if(state.mode==='play'&&p.y>=82&&p.y<=118){
  if(p.x>=329&&p.x<=366){pauseRun();return}
  if(p.x>=374&&p.x<=411){openPanel('settings','play');return}
 }
 flip();
}
canvas.addEventListener('pointerdown',onInput,{passive:false});
canvas.addEventListener('pointermove',onSettingsPointerMove,{passive:false});
canvas.addEventListener('pointerup',onSettingsPointerUp);
canvas.addEventListener('pointercancel',onSettingsPointerUp);
window.addEventListener('keydown',e=>{
 if(['Space','Enter','ArrowUp','KeyP','KeyM','KeyC'].includes(e.code))initAudio();
 if(['Space','Enter','ArrowUp'].includes(e.code)&&!e.repeat){e.preventDefault();if(state.mode==='ready')resetRun(true);else if(state.mode==='over')returnToHome();else if(state.mode==='play')flip();else if(state.mode==='pause')beginResumeCountdown();else if(state.mode==='resume')return;else closePanel()}
 if(e.code==='KeyP'){if(state.mode==='play')pauseRun();else if(state.mode==='pause')beginResumeCountdown();}
 if(e.code==='KeyM'||e.code==='KeyC'){e.preventDefault();if(['skins','missions','settings','records'].includes(state.mode))closePanel();else if(['play','ready'].includes(state.mode))openPanel('skins',state.mode)}
 if(e.code==='Escape'){if(['skins','missions','settings','records'].includes(state.mode))closePanel();else if(state.mode==='play')pauseRun();else if(state.mode==='pause')beginResumeCountdown()}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.mode==='play')pauseRun();save()}setAudioMix()});
function update(dt){globalTime+=dt;state.time+=dt;
 if(state.mode==='over')state.deathUiTime=Math.min(9,(state.deathUiTime||0)+dt);
 state.flipPulse=Math.max(0,state.flipPulse-dt*2.65);state.uiSlide=Math.max(0,state.uiSlide-dt*2.35);if(state.mode==='resume'){state.resumeTimer=Math.max(0,state.resumeTimer-dt);state.resumeFlash=Math.max(0,(state.resumeFlash||0)-dt*2.2);const shown=Math.ceil(state.resumeTimer); if(shown>=1&&Math.abs(state.resumeTimer-(shown-1))<dt*.8){blip(430+shown*60,.055,'sine',.025);state.resumeFlash=1;} if(state.resumeTimer<=0){state.mode='play';setAudioMix();status.textContent='Playing. Tap to switch polarity.'; blip(760,.08,'triangle',.03);} } 
 if(Math.floor(globalTime)!==lastPeriodPoll){lastPeriodPoll=Math.floor(globalTime);syncPeriods()}
 if(globalTime-lastProgressSave>9){lastProgressSave=globalTime;save()}

 if(state.mode==='play'){
  if(state.dist>STAGE_START_Y+(world.nextChunk-11)*305)appendStage(20);
  if(state.overdriveTime>0)state.overdriveTime=Math.max(0,state.overdriveTime-dt);
  let alive=state.orbit?updateOrbit(dt):physics(state,dt,world,state.invuln<=0,true);
  if(!alive){die(state.orbit?'ORBIT CRASH':'MAGNET / SPINNER COLLISION');return}
  if(!state.orbit)tryStartOrbit();
  if(state.invuln>0){state.invuln=Math.max(.001,state.invuln-dt);
   if(state.invuln<=.002 && collisionClearance(state.x,state.dist)>12)state.invuln=0;
  }
  const meters=Math.floor(state.dist/10);
  if(meters>state.progressMeters){track('meters',meters-state.progressMeters);state.progressMeters=meters}
  claimCircuit();
  const y=ballWorldY(), sy=ballY();
  for(let i=fromY(world.magnets,y-90);i<world.magnets.length;i++){const m=world.magnets[i];if(m.y>y+90)break;if(m.broken)continue;
   let d=Math.hypot(m.x-state.x,m.y-y),key=m.id;
   if(d<82&&d>47&&!state.awarded.has('near'+key)){state.awarded.add('near'+key);state.near++;track('near');reward(40,'CLOSE CALL');burst(state.x,sy,C.gold,7,.65);addOverdrive(14)}
  }
  for(let i=fromY(world.hazards,y-65);i<world.hazards.length;i++){const h=world.hazards[i];if(h.y>y+65)break;if(h.broken)continue;
   let d=Math.hypot(obstacleX(h,state.simT)-state.x,h.y-y);
   if(d<h.r+R+28&&d>h.r+R+3&&!state.awarded.has('near'+h.id)){state.awarded.add('near'+h.id);state.near++;track('near');reward(55,h.kind==='crystal'?'THREAD THE SHARD':'NEAR MISS');burst(state.x,sy,C.gold,10,.8);addOverdrive(18)}
  }
  for(let i=fromY(world.gems,y-28);i<world.gems.length;i++){const g=world.gems[i];if(g.y>y+28)break;if(state.claimed.has(g.id))continue;
   if(Math.hypot(g.x-state.x,g.y-y)<R+14){state.claimed.add(g.id);state.gems++;track('gems');reward(25,'CRYSTAL',false);burst(g.x,g.y-state.dist,C.gold,14,.9);chord(740,.8);addOverdrive(5)}
  }
  if(state.comboTime>0)state.comboTime-=dt;else state.combo=0;
  state.score=Math.max(state.score,Math.floor(state.dist/7)+state.bonus+((state.overdriveTime||0)>0?Math.floor(dt*22):0));
  if(state.dist/10>meta.bestDepth+50)meta.bestDepth=Math.floor(state.dist/10);
  state.trail.push({x:state.x,y:sy,life:.42,pole:state.polarity});if(state.trail.length>(lowFx()?28:44))state.trail.shift();
 }
 if(state.mode!=='pause'&&state.mode!=='resume'){
  for(const p of state.trail){p.y+=state.speed*dt;p.life-=dt}state.trail=state.trail.filter(p=>p.life>0);
  for(const p of state.effects){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-2.3*dt);p.vy*=Math.exp(-2.3*dt);p.life-=dt}state.effects=state.effects.filter(p=>p.life>0);
  for(const m of state.messages)m.life-=dt;state.messages=state.messages.filter(m=>m.life>0);
  for(const ring of state.rings){ring.r+=dt*175*(ring.power||1);ring.life-=dt}state.rings=state.rings.filter(r=>r.life>0);
  state.shake=Math.max(0,state.shake-dt*22);
 }
}
function rr(x,y,w,h,r,fill,stroke,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
function flatButton(x,y,w,h,r,base,border){ctx.save();ctx.shadowBlur=0;rr(x,y,w,h,r,base,border,1.6);ctx.restore();}
function glossyButton(x,y,w,h,r,base,border,glow=0,glowColor=border){ctx.save();if(glow>0){ctx.shadowBlur=18+18*glow;ctx.shadowColor=glowColor;}rr(x,y,w,h,r,base,border,1.8);ctx.shadowBlur=0;ctx.beginPath();ctx.roundRect(x+3,y+3,w-6,h*.43,r-4);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill();ctx.globalAlpha=.18;ctx.beginPath();ctx.roundRect(x+2,y+h*.58,w-4,h*.18,r-5);ctx.fillStyle='#03111D';ctx.fill();ctx.restore()}
function accentBar(x,y,w,col,a=.85){ctx.save();ctx.globalAlpha=a;rr(x,y,w,4,3,col);ctx.restore()}
function circle(x,y,r,fill,stroke,lw=1){ctx.beginPath();ctx.arc(x,y,r,0,6.283);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
function line(x,y,X,Y,color,w=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke()}
function label(txt,x,y,size,color=C.white,weight='700',align='left'){ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.font=weight+' '+size+'px system-ui,Segoe UI,sans-serif';ctx.fillText(txt,x,y)}
const backgroundPalettes={
 reactor:{top:'#0B2138',mid:'#070F24',bottom:'#11122F',line:'#1B3250',cross:'#1C2F4E',wall:'#111F39',rail:'#335C7B'},
 cyber:{top:'#180E35',mid:'#090F29',bottom:'#201142',line:'#4B287C',cross:'#263469',wall:'#1C1640',rail:'#8A4EB7'},
 frost:{top:'#10283B',mid:'#081827',bottom:'#17364D',line:'#2C5770',cross:'#29475C',wall:'#17394B',rail:'#7BBCCF'}
};
const backgroundCache=new Map();
function background(){
 const theme=meta.backgroundSkin,colors=backgroundPalettes[theme]||backgroundPalettes.reactor;
 const gradKey=theme+':'+Math.round(H);
 let gr=backgroundCache.get(gradKey);
 if(!gr){gr=ctx.createLinearGradient(0,0,W,H);gr.addColorStop(0,colors.top);gr.addColorStop(.48,colors.mid);gr.addColorStop(1,colors.bottom);backgroundCache.clear();backgroundCache.set(gradKey,gr)}
 ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
 const dist=state.dist;
 if(theme==='cyber'){
  ctx.save();ctx.globalAlpha=.22;for(let i=0;i<18;i++){
   const sx=52+(i*71)%311,sy=((i*163-dist*.19+globalTime*8)%890+890)%890-65;
   circle(sx,sy,i%3===0?2:1.2,'#BD80FF');
  }ctx.restore();
 }else if(theme==='frost'){
  ctx.save();ctx.globalAlpha=.18;for(let i=0;i<7;i++){
   let y=((i*147-dist*.32)%900+900)%900-60;
   line(63+(i*73)%242,y,96+(i*61)%248,y+45,'#B0F4FF',1.1);
   line(96+(i*61)%248,y+45,70+(i*37)%244,y+68,'#B0F4FF',.8);
  }ctx.restore();
 }
 for(let x=LEFT;x<=RIGHT;x+=32)line(x,0,x,H,colors.line,theme==='cyber'?1.0:.7);
 for(let y=-(dist%40);y<H;y+=40)line(LEFT,y,RIGHT,y,colors.cross,.7);
 if(theme==='cyber')for(let y=-(dist%160);y<H;y+=160){ctx.save();ctx.globalAlpha=.42;line(LEFT+2,y,RIGHT-2,y,'#D17BFF',2);ctx.restore()}
 rr(20,0,22,H,0,colors.wall);rr(379,0,20,H,0,colors.wall);rr(40,0,4,H,0,colors.rail);rr(376,0,4,H,0,colors.rail);
 for(let y=-(dist%62);y<H;y+=62){rr(26,y,9,24,3,colors.rail);rr(385,y,9,24,3,colors.rail)}
}
// Interaction hue is intentionally separate from the fixed N/S pole colors.
// Mint means attraction; amber means repulsion, irrespective of whether the magnet is N or S.
const FLOW={pull:'#65FFE5',push:'#FFBE71'};
function activeFields(){
 if(state.mode!=='play'&&state.mode!=='over')return [];
 const by=ballY(),y=ballWorldY(),found=[];
 for(let i=fromY(world.magnets,state.dist+by-278);i<world.magnets.length;i++){
  const m=world.magnets[i];if(m.y>state.dist+by+278)break;
  if(m.broken)continue;
  const sy=m.y-state.dist,dx=m.x-state.x,dy=sy-by,d=Math.hypot(dx,dy);
  if(d>278||d<42||sy<-75||sy>H+65)continue;
  const f=Math.abs(force(m,state.x,y,state.polarity,state.simT));
  const strength=Math.min(1,f/520);
  if(strength<.105)continue;
  found.push({m,sy,d,strength,pull:m.pole!==state.polarity,dx,dy});
 }
 return found.sort((a,b)=>b.strength-a.strength).slice(0,3);
}
function curvePoint(x1,y1,cx,cy,x2,y2,t){const it=1-t;return {x:it*it*x1+2*it*t*cx+t*t*x2,y:it*it*y1+2*it*t*cy+t*t*y2}}
function drawArrow(x,y,ang,color,a=1,size=6){
 ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.globalAlpha*=a;
 ctx.beginPath();ctx.moveTo(size*.65,0);ctx.lineTo(-size*.55,-size*.58);ctx.moveTo(size*.65,0);ctx.lineTo(-size*.55,size*.58);
 ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=2.2;ctx.strokeStyle=color;ctx.stroke();ctx.restore();
}
function drawForceLinks(fields){
 ctx.save();ctx.beginPath();ctx.rect(LEFT+6,99,RIGHT-LEFT-12,H-184);ctx.clip();
 for(const f of (lowFx()?fields.slice(0,2):fields).slice().reverse()){
  const {m,sy,d,strength,pull,dx,dy}=f;
  const color=pull?FLOW.pull:FLOW.push;
  const k=Math.min(1,Math.max(0,(strength-.10)/.9));
  // Curved ribbon connects the ball and magnet, with a clear directional flow.
  // A moving particle travels BALL -> magnet while pulling and MAGNET -> ball while pushing.
  const bx=state.x,by=ballY(),mx=m.x,my=sy;
  const nx= -dy/Math.max(d,1),ny=dx/Math.max(d,1);
  const curvature=12+Math.min(19,d*.075);
  const centerX=(bx+mx)*.5+nx*curvature,centerY=(by+my)*.5+ny*curvature;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const side of [-1,0,1]){
   ctx.beginPath();ctx.moveTo(bx,by);
   const offset=side*10;
   ctx.quadraticCurveTo(centerX+nx*offset,centerY+ny*offset,mx,my);
   ctx.strokeStyle=color;ctx.globalAlpha=(side===0?.20:.065)*(.25+.75*k);
   ctx.lineWidth=side===0?2.2+2.5*k:1.1;
   if(side===0){ctx.shadowColor=color;ctx.shadowBlur=lowFx()?0:9+9*k}
   ctx.stroke();ctx.shadowBlur=0;
  }
  // Traveling directional chevrons, rather than a static rigid 'tail'.
  ctx.globalAlpha=1;
  const count=2+Math.round(k*2);
  for(let i=0;i<count;i++){
   let t=((globalTime*(.7+k*.65) + i/count)%1);
   if(!pull)t=1-t;
   const pt=curvePoint(bx,by,centerX,centerY,mx,my,t);
   const vx=2*((1-t)*(centerX-bx)+t*(mx-centerX));
   const vy=2*((1-t)*(centerY-by)+t*(my-centerY));
   drawArrow(pt.x,pt.y,Math.atan2(vy,vx)+(pull?0:Math.PI),color,(.3+.6*k)*Math.sin(Math.PI*t),5.5+1.8*k);
  }
  // Tiny motes travel with the field. Their number stays low for mobile GPUs.
  for(let i=0;i<(meta.reducedEffects?1:3);i++){
   let t=((globalTime*(.50+.32*k)+i/(meta.reducedEffects?1:3) + (m.x%17)/17)%1);if(!pull)t=1-t;
   const pt=curvePoint(bx,by,centerX,centerY,mx,my,t);
   ctx.globalAlpha=(.18+.58*k)*Math.sin(Math.PI*t);
   ctx.shadowBlur=lowFx()?0:8;ctx.shadowColor=color;circle(pt.x,pt.y,1.5+1.1*k,color);
  }
  ctx.restore();
 }
 ctx.restore();
}
function drawMagnet(m,fields){if(m.broken)return;const y=m.y-state.dist;if(y<-125||y>H+125)return;
 const col=m.pole===1?C.cyan:C.pink,active=fields.find(f=>f.m.id===m.id);
 ctx.save();
 // No hanging wall arm, hexagonal bracket, or permanent bottom stem.
 if(active){
  const hue=active.pull?FLOW.pull:FLOW.push;
  const intensity=active.strength;
  const phase=globalTime*2.5+(m.x*.013);
  for(let i=0;i<2;i++){
   let wave=(phase*.4+i*.50)%1;
   let r=active.pull?78-wave*30:46+wave*36;
   ctx.globalAlpha=(.13+intensity*.21)*(1-wave*.6);
   ctx.lineWidth=1+intensity*1.6;circle(m.x,y,r,undefined,hue,ctx.lineWidth);
  }
  ctx.globalAlpha=1;ctx.shadowColor=hue;ctx.shadowBlur=lowFx()?0:18+intensity*20;
 }else{ctx.shadowColor=col;ctx.shadowBlur=lowFx()?0:11}
 // Main N/S badge is rendered LAST; field effects never obscure the letter.
 circle(m.x,y,34,'#111E34',col,2.5);ctx.shadowBlur=0;
 circle(m.x,y,26,m.pole===1?'#17516B':'#622740',col,1.6);
 const ms=meta.magnetSkin;
 if(ms==='cyber'){
  ctx.save();ctx.shadowColor='#BF7BFF';ctx.shadowBlur=lowFx()?0:13;
  circle(m.x,y,31,undefined,'#BB84FF',2.2);ctx.shadowBlur=0;
  for(let j=0;j<4;j++){const a=globalTime*.16+j*Math.PI/2;circle(m.x+31*Math.cos(a),y+31*Math.sin(a),2.1,'#D0A8FF')}
  ctx.restore();
 }else if(ms==='frost'){
  ctx.save();ctx.globalAlpha=.85;
  ctx.beginPath();for(let j=0;j<8;j++){const a=(j/8)*Math.PI*2-Math.PI/8,rad=33;if(j)ctx.lineTo(m.x+Math.cos(a)*rad,y+Math.sin(a)*rad);else ctx.moveTo(m.x+Math.cos(a)*rad,y+Math.sin(a)*rad)}ctx.closePath();
  ctx.strokeStyle='#B7F2FF';ctx.lineWidth=2;ctx.stroke();
  for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4;const x=m.x+37*Math.cos(a),yy=y+37*Math.sin(a);line(x-3,yy,x+3,yy,'#E6FFFF',1.1)}
  ctx.restore();
 }

 if(m.kind==='surge'){
  ctx.globalAlpha=.85;circle(m.x,y,39,undefined,C.gold,2.5);
  for(let i=0;i<4;i++){let a=i*Math.PI/2+globalTime*.25;circle(m.x+39*Math.cos(a),y+39*Math.sin(a),2.5,C.gold)}
  ctx.globalAlpha=1;
 }else if(m.kind==='pulse'){
  const power=magnetGain(m,state.simT),r=38+power*5;
  ctx.globalAlpha=.23+.58*power;ctx.setLineDash([4,6]);circle(m.x,y,r,undefined,col,2.1);ctx.setLineDash([]);ctx.globalAlpha=1;
 }else if(m.kind==='orbit'){
  ctx.save();ctx.setLineDash([5,5]);ctx.globalAlpha=.8;circle(m.x,y,42,undefined,'#FFE6A3',2.1);ctx.setLineDash([]);
  for(let i=0;i<2;i++){const a=globalTime*1.1+i*Math.PI;circle(m.x+42*Math.cos(a),y+42*Math.sin(a),2.6,'#FFE6A3')}
  ctx.restore();
 }

 circle(m.x-11,y-13,3,'rgba(255,255,255,.28)');
 label(m.pole===1?'N':'S',m.x,y+1,25,'#FFFFFF','950','center');
 ctx.restore();
}
function drawBallForce(fields){
 const primary=fields[0];if(!primary)return;
 const col=primary.pull?FLOW.pull:FLOW.push;
 const magnitude=primary.strength;
 ctx.save();
 // Keep only a subtle reactive glow around the ball; the field ribbons already
 // communicate direction clearly enough without an extra arrow on the orb.
 ctx.shadowBlur=lowFx()?0:12;ctx.shadowColor=col;
 const by=ballY();
 circle(state.x,by,20+3*Math.sin(globalTime*7),undefined,col,.75+1.8*magnitude);
 ctx.shadowBlur=0;
 ctx.globalAlpha=.22+.18*magnitude;
 circle(state.x,by,13.5+Math.sin(globalTime*8)*.8,col);
 ctx.restore();
}
function drawHazard(h){if(h.broken)return;const y=h.y-state.dist;if(y<-65||y>H+65)return;ctx.save();ctx.translate(obstacleX(h,state.simT),y);
 if(h.kind==='crystal'){
  ctx.rotate(Math.PI/4+Math.sin(globalTime*3+h.phase)*.08);ctx.shadowBlur=lowFx()?0:20;ctx.shadowColor='#FFD989';
  let g=ctx.createLinearGradient(-h.r,-h.r,h.r,h.r);g.addColorStop(0,'#FFF8D1');g.addColorStop(.55,'#FFD46F');g.addColorStop(1,'#A66E1F');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-h.r-5);ctx.lineTo(h.r*.78,0);ctx.lineTo(0,h.r+5);ctx.lineTo(-h.r*.78,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#FFF0B2';ctx.lineWidth=1.6;ctx.stroke(); line(0,-h.r*.75,0,h.r*.72,'rgba(255,255,255,.55)',1.1);
 }else{
  ctx.rotate(state.time*(h.kind==='slider'?-2.75:2.1)+h.phase);
  ctx.shadowBlur=lowFx()?0:(h.kind==='slider'?19:12);ctx.shadowColor=h.kind==='slider'?C.gold:C.pink;ctx.fillStyle=h.kind==='slider'?'#FFAE72':'#FF6882';
  ctx.beginPath();for(let i=0;i<20;i++){let a=i*Math.PI/10,r=i%2===0?h.r+6:h.r-3;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  circle(0,0,h.r-6,'#652A47','#FFB4BB');circle(0,0,4,'#E9C6CE');
 }
 ctx.restore();}
function drawGem(g){if(state.claimed.has(g.id))return;let y=g.y-state.dist;if(y<-30||y>H+30)return;ctx.save();ctx.translate(g.x,y);ctx.rotate(Math.PI/4+state.time*.5);ctx.shadowBlur=lowFx()?0:19;ctx.shadowColor=C.gold;rr(-7,-7,14,14,2,C.gold);ctx.restore()}
function ball(x,y,rad=17,pole=state.polarity,skinId=meta.skin){const col=pole===1?C.cyan:C.pink,skin=skins.find(s=>s.id===skinId)||skins[0];ctx.save();ctx.shadowBlur=lowFx()?0:26;ctx.shadowColor=col;circle(x,y,rad+3,col);ctx.shadowBlur=0;
 const gr=ctx.createLinearGradient(x-rad,y-rad,x+rad,y+rad);gr.addColorStop(0,skin.light);gr.addColorStop(1,skin.dark);circle(x,y,rad,gr);
 line(x-rad*.40,y,x+rad*.40,y,pole===1?'#1C6586':'#883956',2.6);if(pole===1)line(x,y-rad*.4,x,y+rad*.4,'#1C6586',2.6);
 circle(x-rad*.3,y-rad*.36,2.8,'rgba(255,255,255,.85)');
 if(skinId==='frost'){
  ctx.save();ctx.globalAlpha=.85;line(x-rad*.68,y-rad*.08,x+rad*.30,y+rad*.60,'#DEFDFF',1.4);line(x,y-rad*.58,x-rad*.1,y+rad*.58,'#B9F5FF',1);ctx.restore();
 }ctx.restore();}
function drawBall(fields){
 // Replace the old dangling stack of solid trail circles with fine, short sparks.
 for(const t of state.trail){
  const a=Math.max(0,t.life/.42);
  if(a<.18)continue;
  ctx.globalAlpha=a*.12;
  circle(t.x,t.y,Math.max(1.2,2.8*a),t.pole===1?C.cyan:C.pink);
 }
 ctx.globalAlpha=1;
 const by=ballY();
 if(state.boost>5){ctx.save();ctx.shadowColor=C.gold;ctx.shadowBlur=lowFx()?0:16;circle(state.x,by,22+Math.sin(globalTime*20)*2,undefined,C.gold,1.5);ctx.restore()}
 if(state.overdriveTime>0){ctx.save();ctx.shadowColor=C.gold;ctx.shadowBlur=lowFx()?0:18;ctx.globalAlpha=.85;circle(state.x,by,25+Math.sin(globalTime*12)*1.6,undefined,C.gold,2.3);ctx.globalAlpha=.45;circle(state.x,by,34,undefined,C.gold,1.4);ctx.restore()}
 else if(state.overdriveCharge>0){ctx.save();ctx.globalAlpha=.88;ctx.lineWidth=2.5;ctx.strokeStyle='rgba(255,214,100,.85)';ctx.beginPath();ctx.arc(state.x,by,24,-Math.PI/2,-Math.PI/2+Math.PI*2*(state.overdriveCharge/100));ctx.stroke();ctx.restore()}
 ball(state.x,by,16);drawBallForce(fields);
 if(state.invuln>0&&state.mode==='play'){
  ctx.save();const pulse=.50+.27*Math.sin(globalTime*12);
  ctx.shadowBlur=lowFx()?0:18;ctx.shadowColor=C.green;ctx.globalAlpha=pulse;
  circle(state.x,by,27+2.5*Math.sin(globalTime*7),undefined,C.green,2.6);
  ctx.globalAlpha=pulse*.42;circle(state.x,by,35+2*Math.sin(globalTime*5),undefined,C.green,1.3);
  ctx.restore();
 }
 if(state.flipPulse>0)circle(state.x,by,24+(1-state.flipPulse)*64,undefined,`rgba(${state.polarity===1?'75,223,254':'255,99,136'},${state.flipPulse*.7})`,state.flipPulse*3);
 if(state.orbit){ctx.save();ctx.globalAlpha=.78;label('RELEASE',state.x,Math.max(118,by-52),11,C.gold,'900','center');ctx.restore();}
}
function hudStat(x,y,w,h,name,value,accent,large=false){
 ctx.save();
 rr(x,y,w,h,14,'rgba(16,33,56,.87)','rgba(71,111,145,.72)',1.3);
 const bar=ctx.createLinearGradient(x+12,y,x+w-12,y);
 bar.addColorStop(0,accent);bar.addColorStop(1,'rgba(149,197,231,.25)');
 rr(x+12,y+7,w-24,2.6,2,bar);
 label(name,x+w/2,y+(large?27:22),large?11:9,C.muted,'850','center');
 label(value,x+w/2,y+(large?55:44),large?27:20,C.white,'950','center');
 ctx.restore();
}
function hud(){
 ctx.save();
 const ready=state.mode==='ready';
 const shade=ctx.createLinearGradient(0,0,0,146);
 shade.addColorStop(0,'rgba(4,10,26,.96)');shade.addColorStop(1,'rgba(4,10,26,0)');
 ctx.fillStyle=shade;ctx.fillRect(0,0,W,146);
 if(ready){
  // A centered, two-column score panel replaces the old unbalanced text/header controls.
  ctx.save();ctx.shadowColor='rgba(67,157,205,.12)';ctx.shadowBlur=lowFx()?0:17;
  rr(49,18,322,84,18,'rgba(13,30,53,.94)','rgba(70,119,154,.77)',1.5);ctx.restore();
  const head=ctx.createLinearGradient(64,0,356,0);head.addColorStop(0,C.gold);head.addColorStop(.5,C.cyan);head.addColorStop(1,C.cyan);
  rr(66,26,288,3,2,head);
  line(210,40,210,89,'rgba(99,146,181,.42)',1.4);
  label('BEST',129,48,11,C.muted,'850','center');
  label(String(meta.best).padStart(4,'0'),129,79,29,C.white,'950','center');
  label('SCORE',291,48,11,C.muted,'850','center');
  label(String(state.score).padStart(4,'0'),291,79,29,C.white,'950','center');
 }else{
  hudStat(46,14,98,59,'DEPTH',Math.floor(state.dist/10)+' m','#A8D5FF');
  hudStat(161,14,98,59,'SCORE',String(state.score).padStart(4,'0'),C.cyan);
  hudStat(276,14,98,59,'BEST',String(meta.best).padStart(4,'0'),C.gold);
  const gemHudAlpha=state.mode==='play'?Math.max(0,Math.min(1,(state.time-.62)/.38)):1;
  if(gemHudAlpha>0){
   ctx.save();ctx.globalAlpha*=gemHudAlpha;
   rr(48,83,91,34,11,'rgba(20,37,58,.91)','rgba(81,113,147,.61)',1.1);
   label('⚡ '+state.gems,94,100,14,C.gold,'900','center');ctx.restore();
  }
  // The HUD is symmetrical on top; game actions live on a separate lower row.
  const hudAlpha=state.mode==='play'?1-state.uiSlide:1;
  ctx.save();ctx.globalAlpha*=hudAlpha;
  rr(329,82,37,36,10,'#203349','#4C7697',1.5);drawIcon('pause',347.5,100,12,C.white);
  rr(374,82,37,36,10,'#21354D','#4E7798',1.5);drawIcon('settings',392.5,100,12,C.white);
  ctx.restore();
  if(state.combo>1){rr(154,83,112,27,9,'#34305D','#8B78FB');label('COMBO ×'+state.combo,210,97,13,'#DCCEFF','900','center')}
  if(state.overdriveTime>0){rr(147,111,126,18,9,'#4E3815','#F5C96B');label('OVERDRIVE',210,120,10,'#FFF6D8','950','center')}
  else if(state.overdriveCharge>0){rr(145,114,130,11,6,'#152436','#34506B');rr(147,116,Math.max(8,126*state.overdriveCharge/100),7,4,'#FFD166')}
  if(state.runMode==='daily'&&state.mode==='play'){label('DAILY CIRCUIT',210,141,10,meta.daily.circuitClaimed?C.green:C.gold,'850','center')}
 }
 for(let i=0;i<state.messages.length;i++){
  const msg=state.messages[i];ctx.globalAlpha=Math.min(1,msg.life*2);
  label(msg.text,210,154+i*25,15,msg.color,'900','center');
 }
 ctx.globalAlpha=1;ctx.restore();
}

function miniatureSkinPreview(x,y,w,h){
 const look=previewSelection(),palette=backgroundPalettes[look.background]||backgroundPalettes.reactor;
 const oldMag=meta.magnetSkin;meta.magnetSkin=look.magnet;
 ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.clip();
 let g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,palette.top);g.addColorStop(1,palette.bottom);ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
 ctx.strokeStyle=palette.line;ctx.lineWidth=1;
 for(let i=0;i<14;i++){const gx=x+8+i*w/13;line(gx,y,gx,y+h,palette.line,.8)}
 for(let i=0;i<4;i++){const gy=y+((i*34+globalTime*6)%135);line(x,gy,x+w,gy,palette.cross,.9)}
 // Draw actual gameplay magnet art, scaled to the preview coordinate system.
 const scale=Math.min(w/420,h/145),offX=x+(w-420*scale)/2,offY=y+(h-145*scale)/2;
 ctx.translate(offX,offY);ctx.scale(scale,scale);
 drawMagnet({id:'preview-n',x:118,y:state.dist+72,pole:1,kind:'normal'},[]);
 drawMagnet({id:'preview-s',x:302,y:state.dist+72,pole:-1,kind:'surge'},[]);
 const wave=9*Math.sin(globalTime*1.2);ball(210+wave,72,19,1,look.ball);
 // Visual feedback is visual-only; this preview never steps the physics.
 ctx.restore();meta.magnetSkin=oldMag;
 rr(x,y,w,h,12,undefined,'#426B8B',1.1);
}
function skinCards(){
 const list=cosmeticCatalog[cosmeticTab];
 const tabs=[['ball','BALL'],['magnets','MAGNETS'],['backgrounds','BG'],['sets','SETS']];
 tabs.forEach(([id,title],i)=>{
  const x=25+i*92.5,active=cosmeticTab===id;
  rr(x,218,91,41,10,active?'#215977':'#132840',active?C.cyan:'#36516E',active?2:1);
  label(title,x+45.5,239,12,active?C.white:C.muted,'900','center');
 });
 miniatureSkinPreview(28,271,364,102);
 const cols=3;
 list.slice(0,6).forEach((item,i)=>{
  const col=i%cols,row=Math.floor(i/cols),x=25+col*123.5,y=390+row*108;
  const selected=cosmeticSelection[cosmeticTab]===item.id,owned=ownedCosmetic(cosmeticTab,item.id);
  rr(x,y,119,101,11,selected?'#1B4357':'#14243A',selected?C.cyan:'#35516C',selected?2:1);
  ctx.save();ctx.globalAlpha=owned?1:.92;
  if(cosmeticTab==='ball')ball(x+59,y+26,14,1,item.id);
  else if(cosmeticTab==='magnets'){
   const prev=meta.magnetSkin;meta.magnetSkin=item.id;
   ctx.save();ctx.translate(x+59,y+27);ctx.scale(.43,.43);drawMagnet({id:'small',x:0,y:state.dist,pole:1,kind:'normal'},[]);ctx.restore();meta.magnetSkin=prev;
  }else if(cosmeticTab==='backgrounds'){
   const pal=backgroundPalettes[item.id];rr(x+37,y+9,44,39,5,pal.mid,pal.rail,1.3);
   for(let j=0;j<3;j++)line(x+40,y+17+j*10,x+78,y+17+j*10,pal.line,1.5);
  }else{
   const old=meta.magnetSkin;meta.magnetSkin=item.magnet;
   ctx.save();ctx.translate(x+59,y+26);ctx.scale(.38,.38);drawMagnet({id:'set-icon',x:0,y:state.dist,pole:1,kind:'normal'},[]);ctx.restore();meta.magnetSkin=old;
  }
  ctx.restore();
  label(item.name,x+59,y+59,cosmeticTab==='sets'?10:11,selected?C.white:'#D5E8FA','850','center');
  const price=cosmeticPrice(cosmeticTab,item.id);
  label(owned?'OWNED':price<0?'CHALLENGE':`${price} ⚡`,x+59,y+82,10,owned?C.green:price<0?C.muted:C.gold,'850','center');
 });
 const id=cosmeticSelection[cosmeticTab],item=list.find(o=>o.id===id),cost=cosmeticPrice(cosmeticTab,id),owned=ownedCosmetic(cosmeticTab,id);
 const equipped=cosmeticTab==='ball'?meta.skin===id:cosmeticTab==='magnets'?meta.magnetSkin===id:cosmeticTab==='backgrounds'?meta.backgroundSkin===id:meta.skin===item.ball&&meta.magnetSkin===item.magnet&&meta.backgroundSkin===item.background;
 const caption=equipped?'EQUIPPED':owned?'EQUIP':cost<0?'DAILY CHALLENGE':cost>meta.coins?`NEED ${cost-meta.coins} MORE ⚡`:`UNLOCK FOR ${cost} ⚡`;
 const enabled=!equipped&&cost>=0&&cost<=meta.coins;
 rr(47,611,326,51,14,enabled?'#45D1EF':'#183A50',enabled?'#A5F4FF':'#47627C',1.3);
 label(caption,210,636,17,enabled?'#082538':'#BDD5EA','900','center');
}
function drawIcon(kind,x,y,size=19,col=C.white){
 // One consistent, gently rounded icon system for HUD, home, and pause actions.
 // No badges/backgrounds behind individual glyphs.
 ctx.save();ctx.translate(x,y);ctx.strokeStyle=col;ctx.fillStyle=col;
 const t=Math.max(1.8,size*.14);
 ctx.lineWidth=t;ctx.lineCap='round';ctx.lineJoin='round';
 if(kind==='settings'){
  // Rounded gear: short, round-ended teeth rather than pointed star spikes.
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;
   ctx.beginPath();ctx.moveTo(Math.cos(a)*size*.53,Math.sin(a)*size*.53);
   ctx.lineTo(Math.cos(a)*size*.76,Math.sin(a)*size*.76);ctx.stroke();
  }
  circle(0,0,size*.49,undefined,col,t);
  circle(0,0,size*.17,undefined,col,t);
 }else if(kind==='skins'){
  circle(0,0,size*.69,undefined,col,t);
  circle(-size*.18,-size*.2,size*.18,col);
  ctx.beginPath();ctx.moveTo(-size*.33,size*.33);ctx.quadraticCurveTo(0,size*.17,size*.34,size*.33);ctx.stroke();
 }else if(kind==='missions'){
  rr(-size*.68,-size*.68,size*1.36,size*1.36,size*.23,undefined,col,t);
  for(let i=0;i<3;i++){
   const yy=-size*.33+i*size*.39;
   ctx.beginPath();ctx.moveTo(-size*.46,yy);ctx.lineTo(-size*.28,yy+size*.12);
   ctx.lineTo(-size*.10,yy-size*.09);ctx.stroke();
   ctx.beginPath();ctx.moveTo(size*.10,yy);ctx.lineTo(size*.43,yy);ctx.stroke();
  }
 }else if(kind==='records'){
  // Trophy cup with rounded handles and bowl.
  ctx.beginPath();ctx.moveTo(-size*.49,-size*.57);ctx.lineTo(size*.49,-size*.57);
  ctx.lineTo(size*.37,-size*.08);ctx.quadraticCurveTo(size*.27,size*.33,0,size*.4);
  ctx.quadraticCurveTo(-size*.27,size*.33,-size*.37,-size*.08);ctx.closePath();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-size*.43,-size*.38);ctx.quadraticCurveTo(-size*.86,-size*.39,-size*.64,size*.04);
  ctx.quadraticCurveTo(-size*.48,size*.19,-size*.30,size*.10);ctx.stroke();
  ctx.beginPath();ctx.moveTo(size*.43,-size*.38);ctx.quadraticCurveTo(size*.86,-size*.39,size*.64,size*.04);
  ctx.quadraticCurveTo(size*.48,size*.19,size*.30,size*.10);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,size*.43);ctx.lineTo(0,size*.69);ctx.moveTo(-size*.34,size*.76);ctx.lineTo(size*.34,size*.76);ctx.stroke();
 }else if(kind==='pause'){
  const w=size*.3,h=size*1.34,y0=-h/2;
  rr(-size*.42,y0,w,h,size*.14,col);
  rr(size*.12,y0,w,h,size*.14,col);
 }else if(kind==='play'){
  // Round joins soften all three corners while preserving a crisp play silhouette.
  ctx.beginPath();ctx.moveTo(-size*.32,-size*.55);ctx.lineTo(size*.53,0);
  ctx.lineTo(-size*.32,size*.55);ctx.closePath();
  ctx.lineWidth=Math.max(1.9,size*.18);ctx.stroke();ctx.fill();
 }else if(kind==='home'){
  // Split roof and walls give the outline genuinely rounded corners.
  ctx.beginPath();ctx.moveTo(-size*.69,-size*.07);ctx.lineTo(-size*.07,-size*.62);
  ctx.quadraticCurveTo(0,-size*.69,size*.07,-size*.62);
  ctx.lineTo(size*.69,-size*.07);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-size*.55,-size*.10);ctx.lineTo(-size*.55,size*.59);
  ctx.quadraticCurveTo(-size*.55,size*.66,-size*.47,size*.66);
  ctx.lineTo(size*.47,size*.66);ctx.quadraticCurveTo(size*.55,size*.66,size*.55,size*.59);
  ctx.lineTo(size*.55,-size*.10);ctx.stroke();
  rr(-size*.18,size*.09,size*.36,size*.57,size*.12,undefined,col,t);
 }else if(kind==='retry'){
  ctx.beginPath();ctx.arc(0,0,size*.6,-Math.PI*.18,Math.PI*1.15);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-size*.1,-size*.66);ctx.lineTo(-size*.60,-size*.51);
  ctx.lineTo(-size*.31,-size*.11);ctx.closePath();ctx.lineWidth=t;ctx.stroke();ctx.fill();
 }else if(kind==='close'){
  ctx.beginPath();ctx.moveTo(-size*.5,-size*.5);ctx.lineTo(size*.5,size*.5);
  ctx.moveTo(size*.5,-size*.5);ctx.lineTo(-size*.5,size*.5);ctx.stroke();
 }
 ctx.restore();
}
function homeScreen(alpha=1){
 const t=Math.min(1,Math.max(0,alpha));
 // The home menu is strictly a ready-state overlay on the same game scene.
 // During play it is not rendered, including while the HUD crossfades in.
 const away=1-Math.pow(t,2);
 ctx.save();
 for(const b of homeButtons){
   const side=b.x<210?-1:1;
   const x=b.x+side*22*away,y=b.y-5*away+(H-760)*.48;
   ctx.globalAlpha=t;
   ctx.shadowBlur=13;ctx.shadowColor='rgba(63,162,233,.20)';
   rr(x-34,y-33,68,66,18,'rgba(16,32,55,.84)','#416785',1.5);
   ctx.shadowBlur=0;
   drawIcon(b.id,x,y,23,b.id==='skins'?C.cyan:b.id==='records'?C.gold:C.white);
   label(b.label,x,y+45,10,C.muted,'850','center');
 }
 // Keep the start instruction below the four menu buttons, in an empty part of the shaft.
 ctx.globalAlpha=t*(.85+.15*Math.sin(globalTime*3.2));
 label('TOUCH EMPTY SPACE TO PLAY',210,636+8*away+(H-760)*.48,12,C.cyan,'800','center');
 ctx.restore();
}
function missionRows(){
 syncPeriods();
 const scope=missionTab;
 const all=scope==='daily'?dayMissions(meta.daily.key):scope==='weekly'?weeklyTasks:careerTasks;
 const done=scope==='career'?meta.done:new Set(meta[scope].done);
 const selected=scope==='career'?[...all.filter(m=>!done.has(m.id)).slice(0,3),...all.filter(m=>done.has(m.id)).slice(0,3)].slice(0,3):all;
 const yBase=302;
 for(let i=0;i<selected.length;i++){
  const m=selected[i],y=yBase+i*87,finished=done.has(m.id);
  const raw=valueFor(m.key,scope),progress=finished?1:Math.min(1,raw/m.goal);
  rr(25,y,370,76,13,finished?'#163B37':'#15253F',finished?'#386A5A':'#34506B');
  label(m.name,41,y+19,13,finished?C.green:C.white,'850');
  label(finished?'✓':`+${m.reward} ⚡`,376,y+19,12,finished?C.green:C.gold,'850','right');
  label(finished?'COMPLETED':`${Math.min(Math.floor(raw),m.goal)} / ${m.goal}`,41,y+42,11,finished?C.green:C.muted,'700');
  rr(41,y+57,334,7,4,'#0A172B');if(progress>0)rr(41,y+57,334*progress,7,4,finished?C.green:C.cyan);
 }
 const note=scope==='daily'?`RESETS IN ${dateUntilReset('daily')}  •  ${meta.daily.done.length}/3 DONE`:
  scope==='weekly'?`RESETS IN ${dateUntilReset('weekly')}  •  ${meta.weekly.done.length}/3 DONE`:
  `${careerTasks.filter(m=>meta.done.has(m.id)).length}/${careerTasks.length} CAREER GOALS COMPLETE`;
 label(note,210,578,12,C.muted,'800','center');
 if(scope==='daily'){
  rr(53,595,314,56,14,meta.daily.circuitClaimed?'#254C43':'#1B5978',meta.daily.circuitClaimed?C.green:C.cyan,1.8);
  label(meta.daily.circuitClaimed?'DAILY BONUS CLAIMED':'PLAY TODAY’S CIRCUIT  +85 ⚡',210,613,15,C.white,'900','center');
  label(meta.daily.circuitClaimed?'PLAY AGAIN FOR A BETTER SCORE':'SAME MAGNETS ALL DAY  •  REACH 250m',210,635,10,C.muted,'800','center');
 }else if(scope==='weekly'){
  label('THREE OPTIONAL GOALS • RESET EVERY MONDAY',210,617,11,C.muted,'800','center');
 }else{
  label('LIFETIME MILESTONES • NEVER EXPIRE',210,617,11,C.muted,'800','center');
 }
}
function drawVolumeCard(name,value,y,accent){
 rr(28,y,364,105,16,'#12273F','#3B536F',1.25);
 label(name,48,y+24,14,C.white,'900');
 label(Math.round(value*100)+'%',369,y+24,14,accent,'900','right');
 const x=77,ty=y+73,w=266;
 rr(x,ty-5,w,10,5,'#061625','#31465E',1);
 if(value>0)rr(x,ty-5,w*value,10,5,accent);
 circle(x+w*value,ty,12,'#F1F8FF',accent,3);
 label('0',50,ty,10,C.muted,'750','center');label('100',370,ty,10,C.muted,'750','center');
}
function drawSettingToggle(x,y,w,h,title,note,enabled,accent,wide=false){
 rr(x,y,w,h,14,enabled?'#16394B':'#17263B',enabled?accent:'#415571',1.4);
 const ty=y+(wide?33:48),tx=x+w-47;
 rr(tx-18,ty-12,38,24,12,enabled?accent:'#42536B',enabled?undefined:'#61768D',1);
 circle(enabled?tx+8:tx-6,ty,8,enabled?'#FFFFFF':'#C0CDE0');
 label(title,x+15,y+(wide?22:24),wide?13:12,C.white,'900');
 label(note,x+15,y+(wide?43:43),wide?10:9,C.muted,'750');
}
function panelOverlay(){
 ctx.fillStyle='rgba(3,7,19,.88)';ctx.fillRect(0,0,W,H);
 const which=state.mode;const titles={skins:'CUSTOMIZE',missions:'MISSIONS',settings:'SETTINGS',records:'RECORDS'};
 label(titles[which],210,152,32,C.white,'950','center');
 if(which!=='skins')label('MAGNET MADNESS',210,192,12,C.muted,'800','center');
 rr(360,67,43,43,13,'#243C55','#54708C',1.5);label('×',381,88,29,C.white,'650','center');
 if(which==='skins'){
  label('⚡ '+meta.coins+'   •   MIX & MATCH YOUR STYLE',210,192,12,C.gold,'800','center');
  skinCards();
 }else if(which==='missions'){
  label('PLAY WHEN YOU WANT • NO LOGIN REWARD',210,212,11,C.muted,'750','center');
  for(let i=0;i<3;i++){
   const key=['daily','weekly','career'][i],x=25+i*123.5,active=missionTab===key;
   rr(x,230,122,42,10,active?'#185775':'#16273F',active?C.cyan:'#34526D',active?2:1);
   label(key.toUpperCase(),x+61,250,13,active?C.white:C.muted,'900','center');
  }
  missionRows();
 }else if(which==='settings'){
  label('AUDIO MIXER & FEEDBACK',210,218,11,C.muted,'850','center');
  drawVolumeCard('SOUND EFFECTS',meta.sfxVolume,242,C.cyan);
  drawVolumeCard('BACKGROUND MUSIC',meta.musicVolume,362,'#B79AFF');
  drawSettingToggle(28,477,174,84,'VIBRATION','HAPTIC FEEDBACK',meta.haptics,C.green);
  drawSettingToggle(218,477,174,84,'SCREEN SHAKE','CAMERA IMPACTS',meta.screenShake,C.cyan);
  drawSettingToggle(28,575,364,66,'REDUCED EFFECTS','LESS PARTICLES • SAME GAMEPLAY',meta.reducedEffects,'#B79AFF',true);
  label('AUTO-SAVED • DRAG SLIDERS TO ADJUST',210,655,10,C.muted,'700','center');
 }else if(which==='records'){
  const entries=[['BEST SCORE',String(meta.best)],['BEST DEPTH',meta.bestDepth+' m'],['RUNS',String(meta.runs)],['DAYS PLAYED',String(meta.daysPlayed.length)],['DAILY CLEARS',String(meta.stats.dailyWins)],['SKINS',meta.owned.size+' / '+skins.length]];
  entries.forEach((entry,i)=>{let y=270+i*53;rr(38,y,344,43,11,'#16263F','#334761');label(entry[0],54,y+21,13,C.muted,'850');label(entry[1],361,y+21,16,i===0?C.gold:C.white,'950','right')});
 }
 const bp=.5+.5*Math.sin(globalTime*2.8);flatButton(91,668,238,55,18,'#37C9EB','#9DF3FF');label('BACK',210,696,19,'#08283B','950','center');
}
// Death-screen recap: up to three quests actually advanced this run.
function drawDeathQuestResults(){
 const rows=deathQuestResults;
 label('QUEST PROGRESS',53,304,12,C.white,'900');
 label(rows.length?rows.length+' UPDATED':'THIS RUN',367,304,10,C.muted,'850','right');
 accentBar(52,315,314,'#2B5C6B',.8);
 if(!rows.length){
  rr(48,326,324,184,14,'rgba(15,29,47,.84)','#34485D',1);
  label('NO QUEST PROGRESS YET',210,402,14,C.muted,'850','center');
  label('KEEP PLAYING TO COMPLETE MISSIONS',210,430,10,C.muted,'750','center');
  return;
 }
 const time=state.deathUiTime||0;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
 rows.forEach((q,i)=>{
  const top=324+i*64,complete=q.completed;
  const appear=ease((time-.08-i*.16)/.38);
  if(appear<=0)return;
  const fg=complete?'#8CF7C1':'#FFE284';
  const back=complete?'rgba(21,66,53,.92)':'rgba(58,48,26,.87)';
  const border=complete?'#4EBA93':'#B89A4B';
  ctx.save();ctx.globalAlpha*=appear;ctx.translate(0,(1-appear)*9);
  rr(48,top,324,58,11,back,border,1.1);
  rr(48,top,3,58,2,fg);
  circle(64,top+18,8,complete?'#2F8767':'#68552B',fg,1);
  label(complete?'✓':'›',64,top+18,12,fg,'950','center');
  label(q.name,79,top+18,11.4,C.white,'850');
  label(complete?'100%':Math.round(q.newPct*100)+'%',355,top+18,12.5,fg,'950','right');
  const delta=Math.round(q.gainPct*100),goalText=`${Math.min(Math.floor(q.end),q.goal)} / ${q.goal}   •   +${delta}% THIS RUN`;
  label(goalText,79,top+36,10,complete?'#A4F1D2':'#F0D79F','750');
  const x=79,y=top+47,w=276,h=7;
  rr(x,y,w,h,3.5,complete?'#15382F':'#352E1C');
  const bar=ease((time-.35-i*.16)/.72)*q.newPct;
  if(bar>0)rr(x,y,Math.max(1,w*bar),h,3.5,fg);
  if(q.oldPct>.003&&bar>=q.oldPct){
   const bx=x+w*q.oldPct;line(bx,y-1,bx,y+h+1,complete?'#29654E':'#9A7D46',1.2);
  }
  ctx.restore();
 });
}
function overlay(){
 if(state.mode==='ready'){homeScreen(1);return}
 // Gameplay uses the same shaft, but home controls must never be drawn once
 // the run starts. uiSlide is retained exclusively for the HUD entrance.
 if(state.mode==='play')return;
 if(['skins','missions','settings','records'].includes(state.mode)){
  ctx.save();ctx.fillStyle='rgba(3,7,19,.88)';ctx.fillRect(0,0,W,H);
  ctx.translate(0,(H-760)*.5);panelOverlay();ctx.restore();return;
 }
 ctx.fillStyle='rgba(3,7,19,.85)';ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(0,(H-760)*.5);
 if(state.mode==='over'){
  const uiPulse=.5+.5*Math.sin(globalTime*3.3);
  ctx.save();
  rr(34,78,352,610,24,'rgba(16,29,47,.94)','rgba(94,160,195,.58)',2);
  accentBar(65,92,92,C.cyan,.9);accentBar(263,92,92,C.pink,.52+.2*uiPulse);
  ctx.restore();
  ball(210,127,27);
  label('POLARITY LOST',210,186,30,C.white,'950','center');
  label(state.reason,210,214,10,C.pink,'800','center');
  label('SCORE  '+state.score,210,254,27,C.gold,'950','center');
  label('DEPTH '+Math.floor(state.dist/10)+'m  •  BEST '+meta.best,210,281,12,C.muted,'800','center');
  drawDeathQuestResults();
  const revive=reviveBounds(),retry=retryBounds();
  if(!state.reviveUsed){
   const bg=ctx.createLinearGradient(revive.x,revive.y,revive.x+revive.w,revive.y+revive.h);
   bg.addColorStop(0,'#D9FF73');bg.addColorStop(.48,'#7AF8C7');bg.addColorStop(1,'#37DDF9');
   flatButton(revive.x,revive.y,revive.w,revive.h,15,bg,'#E6FFFF');
   rr(revive.x+revive.w-31,revive.y-9,33,19,8,'#FFD35F','#FFF3B9',1);
   label('AD',revive.x+revive.w-14.5,revive.y+1,10,'#372D03','950','center');
   label('▶ REVIVE',revive.x+revive.w*.5,revive.y+27,17,'#062738','950','center');
   label('3-SECOND TEST',revive.x+revive.w*.5,revive.y+49,9,'#164252','850','center');
  }else{
   flatButton(revive.x,revive.y,revive.w,revive.h,15,'#293747','#46576A');
   label('REVIVE USED',revive.x+revive.w*.5,revive.y+35,13,C.muted,'850','center');
  }
  flatButton(retry.x,retry.y,retry.w,retry.h,15,C.cyan,'#C9F8FF');
  label('RETRY  ↻',retry.x+retry.w*.5,retry.y+retry.h*.5,18,'#061B2F','950','center');
  if(state.adError)label(state.adError,210,672,11,C.pink,'800','center');
 }else if(state.mode==='ad'){
  // Full-screen placeholder, no native ad SDK and no ad network calls.
  const remaining=Math.max(0,Math.ceil((demoAdEndAt-performance.now())/1000));
  ctx.fillStyle='rgba(2,7,18,.96)';ctx.fillRect(0,-(H-760)*.5,W,H);
  label('РЕКЛАМА',210,330,38,C.white,'950','center');
  label('ТЕСТОВЫЙ ПОКАЗ',210,369,13,C.muted,'850','center');
  label(''+remaining,210,425,28,C.cyan,'900','center');
 }else if(state.mode==='pause'){
  const pulse=.5+.5*Math.sin(globalTime*2.8),cont=pauseContinueBounds(),setb=pauseSettingsBounds(),homeb=pauseHomeBounds();
  ctx.save();
  ctx.shadowBlur=28;ctx.shadowColor='rgba(81,213,255,.12)';
  rr(44,232,332,244,26,'rgba(11,20,37,.92)','rgba(85,130,163,.72)',2);
  ctx.shadowBlur=0;const pauseBar=ctx.createLinearGradient(73,246,347,246);pauseBar.addColorStop(0,C.cyan);pauseBar.addColorStop(1,'#8E94FF');rr(73,246,274,4,3,pauseBar);
  label('PAUSED',210,279,34,C.white,'950','center');
  label('TAKE A BREATHER • YOUR RUN IS SAFE',210,306,11,C.cyan,'800','center');
  ctx.save();ctx.shadowBlur=11;ctx.shadowColor='rgba(74,202,240,.20)';rr(cont.x,cont.y,cont.w,cont.h,20,'#3A95C0','#B5F6FF',1.8);ctx.restore();
  // Center the icon + text as ONE group, keeping an 8px visual gap.
  // Previous independent coordinates left conspicuous empty spaces.
  function alignedAction(r,iconKind,txt,y,fontSize,weight,iconSize,foreground,gap=8){
   ctx.save();ctx.font=weight+' '+fontSize+'px system-ui,Segoe UI,sans-serif';
   const textWidth=ctx.measureText(txt).width,iconWidth=iconSize*1.55;
   const groupLeft=r.x+(r.w-(iconWidth+gap+textWidth))*.5;
   drawIcon(iconKind,groupLeft+iconWidth*.5,y,iconSize,foreground);
   label(txt,groupLeft+iconWidth+gap,y,fontSize,foreground,weight,'left');
   ctx.restore();
  }
  alignedAction(cont,'play','CONTINUE',cont.y+25,23,'950',15,'#082538',9);
  label('3 SECOND COUNTDOWN ON RESUME',cont.x+cont.w*.5,cont.y+43,10,'#15425C','850','center');
  rr(setb.x,setb.y,setb.w,setb.h,16,'#1C3750','#83B9EC',1.8);
  alignedAction(setb,'settings','SETTINGS',setb.y+26,13,'900',11,C.white,8);
  rr(homeb.x,homeb.y,homeb.w,homeb.h,16,'#2B2946','#A8B0FF',1.8);
  alignedAction(homeb,'home','TO START',homeb.y+26,13,'900',11,C.white,8);
  ctx.restore();
 }else if(state.mode==='resume'){
  const sec=Math.max(1,Math.ceil(state.resumeTimer)),a=.84+.16*Math.sin(globalTime*9),pulse=(state.resumeFlash||0),frac=Math.max(0,Math.min(1,state.resumeTimer/3));
  ctx.save();ctx.globalAlpha=.88;ctx.shadowBlur=26;ctx.shadowColor='rgba(111,224,255,.34)';circle(210,332,68+6*pulse,'rgba(9,18,36,.92)','rgba(126,231,255,.95)',2.6);ctx.restore();
  ctx.save();ctx.lineWidth=5.5;ctx.lineCap='round';ctx.strokeStyle='rgba(126,231,255,.96)';ctx.shadowBlur=18;ctx.shadowColor='rgba(126,231,255,.28)';ctx.beginPath();ctx.arc(210,332,78,-Math.PI/2,-Math.PI/2+Math.PI*2*frac,false);ctx.stroke();ctx.restore();
  label('GET READY',210,242,19,C.cyan,'900','center');label(String(sec),210,332,58,C.white,'950','center');label('RESUMING…',210,418,14,`rgba(227,247,255,${a})`,'800','center');
 }
 ctx.restore();
}
function render(){ctx.save();if(meta.screenShake&&state.shake>0)ctx.translate(Math.sin(globalTime*92)*state.shake*.42,Math.cos(globalTime*100)*state.shake*.42);
 background();
 const fields=activeFields();if(state.mode!=='ready'){
  drawForceLinks(fields);
  for(let i=fromY(world.magnets,state.dist-125);i<world.magnets.length;i++){const m=world.magnets[i];if(m.y>state.dist+H+125)break;drawMagnet(m,fields)}
  for(let i=fromY(world.hazards,state.dist-65);i<world.hazards.length;i++){const h=world.hazards[i];if(h.y>state.dist+H+65)break;drawHazard(h)}
  for(let i=fromY(world.gems,state.dist-30);i<world.gems.length;i++){const g=world.gems[i];if(g.y>state.dist+H+30)break;drawGem(g)}
 }
 drawBall(fields);for(const ripple of state.rings){ctx.save();ctx.globalAlpha=Math.max(0,ripple.life/ripple.max)*.65;ctx.shadowColor=ripple.color;ctx.shadowBlur=lowFx()?0:12;circle(ripple.x,ripple.y,ripple.r,undefined,ripple.color,1.7);ctx.restore();}for(const p of state.effects){ctx.globalAlpha=Math.max(0,p.life/p.max);circle(p.x,p.y,p.r,p.color)}ctx.globalAlpha=1;if(['ready','play','over','pause','resume'].includes(state.mode))hud();
 // Rendering the home overlay in play mode left faded menu buttons on
 // top of the game during the opening transition (and in test captures).
 // Only ready/paused/game-over/modal modes can draw a full-screen overlay.
 if(state.mode!=='play')overlay();ctx.restore();}
function frame(t){
 if(manualFrames){rafLast=t;requestAnimationFrame(frame);return}
 updateSoundtrack();
 if(!rafLast)rafLast=t;
 const elapsed=Math.min(.06,(t-rafLast)/1000);rafLast=t;accum+=elapsed;
 let n=0;while(accum>=DT&&n++<8){update(DT);accum-=DT}
 // Preserve 120 FPS cap during active gameplay, use 30 FPS for stationary
 // menus and fake ads (no high-frequency simulation / GPU work needed).
 const drawStep=state.mode==='play'?DT:1/30;
 renderAccumulator+=elapsed;
 if(renderAccumulator>=drawStep-.00012){
  if(state.mode==='play')qualityFrames++;
  render();renderAccumulator=Math.max(0,renderAccumulator-drawStep);
  if(renderAccumulator>drawStep)renderAccumulator%=drawStep;
 }
 if(state.mode==='play'){
  qualityWindow+=elapsed;
  if(qualityWindow>=2.7){
   const measured=qualityFrames/Math.max(.001,qualityWindow);
   if(measured<46 && renderQuality>.65){renderQuality=Math.max(.65,+(renderQuality-.15).toFixed(2));qualityRecovery=0;fitCanvas()}
   else if(measured>57&&renderQuality<1){qualityRecovery++;if(qualityRecovery>=3){renderQuality=Math.min(1,+(renderQuality+.08).toFixed(2));qualityRecovery=0;fitCanvas()}}
   else qualityRecovery=0;
   qualityWindow=0;qualityFrames=0;
  }
 }else{qualityWindow=0;qualityFrames=0;qualityRecovery=0}
 requestAnimationFrame(frame);
}
// Plan a safe TOUCH sequence in tests using the same fixed-step physics as the player.
// This does not render a fake path: tests replay the taps in Chromium and record Canvas.
function planTouches(ticks=120){
 let beam=[{x:state.x,vx:state.vx,dist:state.dist,polarity:state.polarity,speed:state.speed,boost:state.boost,simT:state.simT,slingCooldown:state.slingCooldown||0,path:'',switches:0}];
 for(let k=0;k<ticks;k++){
  const next=new Map();
  for(const original of beam){for(let flipNow=0;flipNow<2;flipNow++){
   const s={...original,path:original.path+(flipNow?'1':'0')};
   if(flipNow){s.polarity*=-1;s.switches++;sling(s)}
   let alive=true;
   for(let i=0;i<14;i++){if(!physics(s,DT,world)){alive=false;break}}
   if(!alive)continue;
   const key=`${Math.round(s.x/14)}:${Math.round(s.vx/35)}:${s.polarity}:${Math.round(s.dist/60)}`;
   const old=next.get(key);
   if(!old||s.switches<old.switches||(s.switches===old.switches&&Math.abs(s.vx)<Math.abs(old.vx)))next.set(key,s);
  }}
  beam=[...next.values()].sort((a,b)=>(b.dist-a.dist)-(a.switches-b.switches)*2).slice(0,130);
  if(!beam.length)return {steps:k,path:'',reached:0,failed:true};
 }
 beam.sort((a,b)=>a.switches-b.switches||b.dist-a.dist);
 let top=beam[0];return {steps:ticks,path:top.path,reached:top.dist,failed:false,finalX:top.x,flips:top.switches};
}
// Debug API only: browser tests call actual game engine and take snapshots of the live Canvas.
window.__magnetDebug={physicsVariant:'classic',maxFps:120,renderQuality:()=>renderQuality,bufferSize:()=>({width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight}),music:()=>({scene:musicScene,current:musicCurrent?.id||null,outgoing:musicOutgoing?.id||null,bag:musicBag.map(t=>t.id),last:lastGameTrack,unlocked:musicUnlocked,volume:musicCurrent?.element.volume||0,paused:musicCurrent?.element.paused??true,trackTime:musicCurrent?.element.currentTime||0}),nextMusic:()=>switchSoundtrack('run',true),
 snapshot:()=>({mode:state.mode,reviveUsed:state.reviveUsed,invuln:state.invuln,adPending:state.adPending,adError:state.adError,runPaid:state.runPaid,runMode:state.runMode,uiSlide:state.uiSlide,polarity:state.polarity,x:state.x,vx:state.vx,dist:state.dist,speed:state.speed,boost:state.boost,simT:state.simT,score:state.score,gems:state.gems,near:state.near,boosts:state.boosts,combo:state.combo,flips:state.flips,reason:state.reason,best:meta.best,coins:meta.coins,skin:meta.skin,magnetSkin:meta.magnetSkin,backgroundSkin:meta.backgroundSkin,runs:meta.runs,overdriveCharge:state.overdriveCharge,overdriveTime:state.overdriveTime,orbit:state.orbit?{...state.orbit}:null,shatters:state.shatters,resumeTimer:state.resumeTimer,resumeFlash:state.resumeFlash,ballY:ballY(),ballWorldY:ballWorldY()}),
 start:resetRun,returnToHome,retryBounds,reviveBounds,flip,openPanel,closePanel,requestRevive,reviveAfterReward,die,canShowRewarded,collisionClearance,manual:(v=true)=>{manualFrames=v;accum=0;},step:seconds=>{for(let i=0,n=Math.ceil(seconds/DT);i<n;i++)update(seconds/n);render()},
 setState:changes=>{for(const [k,v] of Object.entries(changes))if(['x','vx','dist','polarity','mode','speed','boost','score','combo','comboTime','gems','near','boosts','simT','slingCooldown','overdriveCharge','overdriveTime','invuln','reviveUsed','orbit','shatters','resumeTimer','resumeFlash'].includes(k))state[k]=v;render()},
 stage:()=>({solvable:world.solvable,validated:world.validated,nextChunk:world.nextChunk,failed:world.failed,checks:world.checks.map(x=>({...x})),kinds:world.magnets.reduce((o,m)=>(o[m.kind]=(o[m.kind]||0)+1,o),{}),hazardKinds:world.hazards.reduce((o,h)=>(o[h.kind]=(o[h.kind]||0)+1,o),{})}),
 magnets:()=>world.magnets.map(m=>({...m})),hazards:()=>world.hazards.map(h=>({...h})),gems:()=>world.gems.map(g=>({...g})),
 slingshot:()=>sling(state),force:(m,x,y,p,t=0)=>force(m,x,y,p,t),magnetGain,obstacleX,planTouches,rebuild:stage,extend:(n=12)=>appendStage(n),meta:()=>({best:meta.best,coins:meta.coins,skin:meta.skin,owned:[...meta.owned],done:[...meta.done],daily:JSON.parse(JSON.stringify(meta.daily)),weekly:JSON.parse(JSON.stringify(meta.weekly)),stats:{...meta.stats},daysPlayed:[...meta.daysPlayed],missionTab,magnetSkin:meta.magnetSkin,backgroundSkin:meta.backgroundSkin,ownedMagnets:[...meta.ownedMagnets],ownedBackgrounds:[...meta.ownedBackgrounds],ownedSets:[...meta.ownedSets],cosmeticTab,cosmeticSelection:{...cosmeticSelection}}), ballY:()=>ballY(), ballWorldY:()=>ballWorldY(), orbitLaunch:(auto=false)=>orbitLaunch(auto), activateOverdrive, addOverdrive, tryStartOrbit, canBreakCrystal,
 cosmetics:()=>({tab:cosmeticTab,selected:{...cosmeticSelection},equipped:{ball:meta.skin,magnets:meta.magnetSkin,backgrounds:meta.backgroundSkin},prices:Object.fromEntries(cosmeticTabs.map(tab=>[tab,cosmeticCatalog[tab].map(i=>({id:i.id,cost:cosmeticPrice(tab,i.id),owned:ownedCosmetic(tab,i.id)}))]))}),
 cosmeticTab:setCosmeticTab,selectCosmetic:(tab,id)=>{setCosmeticTab(tab);if(cosmeticCatalog[tab]?.some(i=>i.id===id))cosmeticSelection[tab]=id;render()},equipCosmetic:equipSelected,
 missions:()=>({daily:dayMissions(meta.daily.key),weekly:weeklyTasks,career:careerTasks}),
 deathQuests:()=>deathQuestResults.map(q=>({...q})),runQuestStart:()=>runQuestBaseline?{...runQuestBaseline,doneDaily:[...runQuestBaseline.doneDaily],doneWeekly:[...runQuestBaseline.doneWeekly],doneCareer:[...runQuestBaseline.doneCareer]}:null,
 clock:(iso=null)=>{simulatedNow=iso;syncPeriods();render()},
 track,claimCircuit,checkMissions,selectTab:(tab)=>{if(['daily','weekly','career'].includes(tab))missionTab=tab;render()},
 dailyStart:()=>resetRun(false,'daily'),

 setCoins:n=>{meta.coins=n;save()},settings:()=>({sound:meta.sfxVolume>0,sfxVolume:meta.sfxVolume,musicVolume:meta.musicVolume,haptics:meta.haptics,screenShake:meta.screenShake,reducedEffects:meta.reducedEffects,audioReady:!!audio}),fields:()=>activeFields().map(f=>({id:f.m.id,pull:f.pull,strength:f.strength,mx:f.m.x,my:f.sy})),render
};
// The shaft appears instantly, but physics starts only when an empty area is tapped.
stage();status.textContent='Tap empty space to play';
requestAnimationFrame(frame);
})();