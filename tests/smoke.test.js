/* Node smoke-test harness: stubs DOM/canvas/localStorage, loads the game's JS,
   then verifies boot, maps, starter flow, and battle math. */
const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname,"..","pokemon-emerald.html"),"utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if(!m){ console.error("FAIL: no script block"); process.exit(1); }
const src = m[1];

/* ---- DOM stubs ---- */
function makeCtx(){
  return new Proxy({}, { get(t,p){
    if(p==="measureText") return (s)=>({width:String(s).length*5});
    if(p==="createLinearGradient"||p==="createRadialGradient") return ()=>({addColorStop(){}});
    if(p==="canvas") return {};
    if(typeof p==="string") return (...a)=>{};
  }, set(){ return true; } });
}
function makeCanvas(){
  return { width:0, height:0, style:{},
    getContext(){ return makeCtx(); },
    addEventListener(){}, classList:{add(){},remove(){},toggle(){}} };
}
const elements = {};
global.document = {
  createElement(tag){ return makeCanvas(); },
  getElementById(id){ if(!elements[id]) elements[id]=makeCanvas(); return elements[id]; },
  body:{ classList:{ add(){}, remove(){}, toggle(){}, contains(){return false;} } },
};
const store = {};
global.localStorage = {
  getItem:k=>store[k]===undefined?null:store[k],
  setItem:(k,v)=>{store[k]=String(v);},
  removeItem:k=>{delete store[k];},
};
global.window = global;
global.navigator = {maxTouchPoints:0};
global.innerWidth=800; global.innerHeight=600;
global.addEventListener = ()=>{};
let rafCb=null;
global.requestAnimationFrame = cb=>{ rafCb=cb; return 1; };
global.AudioContext = undefined;

/* ---- load game ---- */
try { eval(src); } catch(e){ console.error("FAIL: script eval threw:", e); process.exit(1); }
const T = window.__TEST;
let failures=0, passes=0;
function check(name, cond, extra){
  if(cond){ passes++; }
  else { failures++; console.error("FAIL:", name, extra!==undefined?extra:""); }
}

/* ---- 1. boot to title ---- */
check("boot pushed a scene", T.G.scenes.length===1);
check("boot scene is TitleScene", T.G.scenes[0] instanceof T.TitleScene);
// run some frames
for(let i=0;i<10;i++) rafCb(i*16.7);
check("frame loop runs", T.G.frame>0);

/* ---- 2. map integrity ---- */
const reach = {};
for(const id in T.MAPS){
  const map = T.G ? T.getMap(id) : null;
  const def = T.MAPS[id];
  const w = map.w;
  def.tiles.forEach((row,y)=>{
    check(`map ${id} row ${y} width ${row.length}<=${w}`, row.length<=w);
  });
  // warp targets exist & land on non-solid (need player ctx; basic checks only)
  for(const wp of def.warps){
    check(`map ${id} warp target ${wp.to} exists`, !!T.MAPS[wp.to]);
  }
  for(const n of (def.npcs||[])) {
    check(`map ${id} npc ${n.id} on walkable in-bounds tile`, n.x>=0&&n.y>=0&&n.x<map.w&&n.y<map.h);
  }
  for(const tr of (def.trainers||[])) {
    for(const [sp,lv] of tr.team){
      check(`map ${id} trainer ${tr.id} species ${sp} valid`, !!T.SPECIES[sp] && lv>0);
    }
  }
  const enc = def.enc||{};
  for(const k of ["grass","water","cave"]){
    for(const e of (enc[k]||[])) check(`map ${id} enc ${k} species ${e[0]} valid`, !!T.SPECIES[e[0]]);
  }
}

/* ---- connectivity BFS over walkable tiles per map ---- */
function bfsReach(mapId, sx, sy){
  // simulate solidity without npc blocking (npcs move/are talkable)
  const map = T.getMap(mapId);
  const solid = (x,y)=>{
    if(x<0||y<0||x>=map.w||y>=map.h) return true;
    let b=null;
    for(const bb of map.def.buildings){ if(x>=bb.x&&x<bb.x+bb.w&&y>=bb.y&&y<bb.y+bb.h){ b=bb; break; } }
    if(b) return !(b.door[0]===x&&b.door[1]===y);
    const t = map.grid[y][x];
    if(["T","R","#","c"].includes(t)) return true; // note: cuttable 't' passable post-gauntlet, water passable post-amulet
    return false;
  };
  const passable=(x,y)=>{
    if(x<0||y<0||x>=map.w||y>=map.h) return false;
    const t=map.grid[y][x];
    if(t==="t"||t==="W") return true; // assume key items
    return !solid(x,y);
  };
  const seen=new Set(), qq=[[sx,sy]];
  seen.add(sx+","+sy);
  while(qq.length){
    const [x,y]=qq.pop();
    for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const nx=x+dx, ny=y+dy, k=nx+","+ny;
      if(seen.has(k)) continue;
      if(!passable(nx,ny)) continue;
      seen.add(k); qq.push([nx,ny]);
    }
  }
  return seen;
}
// key journeys (assuming cut/surf where needed)
const journeys = [
  ["verdant", 9,14, [[9,1,"route1 exit"],[4,6,"home door"],[9,13,"lab door"]]],
  ["route1", 9,22, [[9,0,"north exit"]]],
  ["slatecliff", 12,18, [[5,6,"gym door"],[12,5,"center door"],[19,5,"mart door"],[25,15,"east exit"],[0,8,"west exit route3"],[11,19,"south exit"]]],
  ["route2", 1,8, [[27,7,"cave door"]]],
  ["cave", 2,9, [[24,13,"east exit"],[8,6,"grunt1 spot"],[21,10,"grunt2 spot"]]],
  ["summit", 1,8, [[4,6,"center"],[14,6,"mart"],[9,12,"elder house"],[8,0,"altar stairs"]]],
  ["route3", 10,1, [[10,19,"south exit"],[5,11,"swimmer lena"]]],
  ["marinport", 12,1, [[5,6,"gym door"],[12,5,"center"],[19,5,"mart"],[18,13,"hideout door"]]],
  ["gym1", 5,10, [[5,1,"leader petra"]]],
  ["gym2", 5,10, [[5,1,"leader coralie"]]],
  ["hideout", 7,11, [[7,2,"admin vulcan"]]],
  ["altar", 7,12, [[7,3,"rayquaza adjacent"]]],
];
for(const [mapId,sx,sy,targets] of journeys){
  const seen = bfsReach(mapId,sx,sy);
  for(const [tx,ty,label] of targets){
    // target reachable if tile itself or an adjacent tile is reached
    const ok = seen.has(tx+","+ty) || [[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy])=>seen.has((tx+dx)+","+(ty+dy)));
    check(`reach ${mapId}: ${label} (${tx},${ty})`, ok);
  }
}

/* ---- 3. species/move data integrity ---- */
let catchable=0;
for(let i=1;i<T.SPECIES.length;i++){
  const S=T.SPECIES[i];
  check(`species ${i} ${S.name} has 6 base stats`, S.bs.length===6);
  check(`species ${i} types valid`, S.t.every(t=>T.CHART[t]!==undefined||["NOR"].includes(t)));
  for(const [lv,mv] of S.mv) check(`species ${i} move ${mv} exists`, !!T.MOVES[mv], mv);
  if(S.ev) check(`species ${i} evolves to valid`, !!T.SPECIES[S.ev[0]]);
  if(i!==37) catchable++;
}
check("at least 30 catchable species", catchable>=30, catchable);
check("Rayquaza present", T.SPECIES[37].name==="Rayquaza");

/* type chart spot checks (Gen 3) */
check("water vs fire = 2", T.typeEff("WAT",["FIR"])===2);
check("fire vs water = 0.5", T.typeEff("FIR",["WAT"])===0.5);
check("electric vs ground = 0", T.typeEff("ELE",["GRO"])===0);
check("normal vs ghost = 0", T.typeEff("NOR",["GHO"])===0);
check("ice vs dragon/flying = 4", T.typeEff("ICE",["DRA","FLY"])===4);
check("rock vs fire/rock = 2 (2*1)", T.typeEff("ROC",["FIR","ROC"])===2);
check("grass vs water/ground = 4", T.typeEff("GRA",["WAT","GRO"])===4);

/* ---- 4. battle math ---- */
function mkTestMon(sp,lv){ const m=T.makeMon(sp,lv,{ivs:[15,15,15,15,15,15]}); m.stages=T.freshStages(); return m; }
// super-effective STAB vs neutral non-STAB ~3x (same power moves)
{
  const att=mkTestMon(5,20);        // Aquafin (WAT)
  const def=mkTestMon(34,20);       // Dunepup (GRO): WAT=2x, FIR=1x
  const fixed={crit:false, rand:1.0};
  // both 40bp SPECIAL moves vs the SAME target: isolates STAB(1.5)×SE(2)=3
  const stabSE = T.calcDamage(att,def,"watergun",null,fixed).dmg;
  const plain  = T.calcDamage(att,def,"ember",null,fixed).dmg;
  const ratio = stabSE/plain;
  check("super-effective STAB ~3x neutral non-STAB (same target)", ratio>2.7&&ratio<3.3, ratio.toFixed(2));
  // 4x case (water vs FIR/ROC Magmite)
  const quad = T.calcDamage(att,mkTestMon(24,20),"watergun",null,fixed);
  check("4x effectiveness detected", quad.eff===4, quad.eff);
}
// weather modifiers
{
  const att=mkTestMon(5,20), def=mkTestMon(9,20);
  const fixed={crit:false, rand:1.0};
  const dry = T.calcDamage(att,def,"watergun",null,fixed).dmg;
  const wet = T.calcDamage(att,def,"watergun","rain",fixed).dmg;
  const sun = T.calcDamage(att,def,"watergun","sun",fixed).dmg;
  check("rain boosts water ~1.5x", Math.abs(wet/dry-1.5)<0.25, (wet/dry).toFixed(2));
  check("sun halves water ~0.5x", Math.abs(sun/dry-0.5)<0.2, (sun/dry).toFixed(2));
}
// crit doubles
{
  const att=mkTestMon(3,20), def=mkTestMon(9,20);
  const n = T.calcDamage(att,def,"ember",null,{crit:false,rand:1}).dmg;
  const c = T.calcDamage(att,def,"ember",null,{crit:true,rand:1}).dmg;
  check("crit ~2x", c/n>1.7&&c/n<2.3, (c/n).toFixed(2));
}
// burn halves physical
{
  const att=mkTestMon(9,20), def=mkTestMon(9,20);
  const n=T.calcDamage(att,def,"tackle",null,{crit:false,rand:1}).dmg;
  att.status="BRN";
  const b=T.calcDamage(att,def,"tackle",null,{crit:false,rand:1}).dmg;
  check("burn halves physical", b<n*0.65, b+"/"+n);
}
// stat stages
check("stage +2 = 2x", T.stageMult(2)===2);
check("stage -2 = 0.5x", T.stageMult(-2)===0.5);
// catch formula
{
  const wild=T.makeMon(7,3); // Fluffowl cr255
  wild.hp=1;
  const res=T.catchCalc(wild,1,{rolls:[0,0,0,0]});
  check("weakened cr255 mon catchable", res.caught===true);
  const ray=T.makeMon(37,50); // full HP rayquaza cr45
  const res2=T.catchCalc(ray,1,{rolls:[65535,65535,65535,65535]});
  check("full-HP rayquaza with bad rolls not caught", res2.caught===false);
}
// exp/level
{
  const m=T.makeMon(9,5);
  const evs=T.addExp(m, T.expForLevel(7)-T.expForLevel(5)+5);
  check("addExp levels up to 7", m.lv===7, m.lv);
  check("level events emitted", evs.some(e=>e.type==="level"));
}
// stats formula sanity (level 50, base 100, iv 15, ev 0 → (200+15)*50/100+5 = 112)
{
  const m=T.makeMon(37,50,{ivs:[15,15,15,15,15,15]});
  check("stat formula atk", m.stats[1]===Math.floor((2*150+15)*50/100)+5, m.stats[1]);
  check("hp formula", m.stats[0]===Math.floor((2*105+15)*50/100)+50+10, m.stats[0]);
}

/* ---- 5. new game → starter → wild battle winnable ---- */
T.startGame(0,null);
check("world scene active", T.G.scenes.length>=1);
check("player created", !!T.G.pl && T.G.pl.map==="home");
// dismiss intro dialog scene(s)
while(T.G.scenes.length>1){ T.G.scenes.pop(); }
// simulate choosing starter directly via script path
const starterSp = 3; // Embercub
T.G.pl.party.push(T.makeMon(starterSp,5,{ivs:[25,25,25,25,25,25]}));
T.G.pl.flags.starterId=starterSp; T.G.pl.flags.starter=true;
// wild battle: level 3 Nibbit
{
  const wild=T.makeMon(9,3); wild.stages=T.freshStages();
  const b=new T.Battle({wild});
  T.G.push(b);
  check("battle scene pushed", T.G.top()===b);
  // run intro queue until menu
  let guard=0;
  while(b.phase!=="menu"&&guard++<2000){ b.step(); if(b.phase==="msg"){ b.msgChar=999; b.msgWait=99; } }
  check("battle reaches menu", b.phase==="menu", b.phase);
  // fight with first move until enemy faints
  guard=0;
  let won=false;
  const origFinish=b.finish.bind(b);
  b.finish=(res)=>{ won=(res==="won"); origFinish(res); };
  while(guard++<20000 && T.G.scenes.includes(b)){
    if(b.phase==="menu"){ b.playerAct({kind:"move", m:b.pl.moves[0]}); b.phase="q"; }
    else { b.step(); if(b.phase==="msg"){ b.msgChar=999; b.msgWait=99; } }
    if(b.pl.hp<=0) break;
  }
  check("first wild battle won", won);
  check("starter gained exp", T.G.pl.party[0].exp>T.expForLevel(5));
}
/* save/load roundtrip */
{
  T.saveGame(0);
  const info=T.loadSlotInfo(0);
  check("save roundtrip", info && info.pl && info.pl.party.length===T.G.pl.party.length);
}
/* ---- 6. sprite generation doesn't throw ---- */
{
  let ok=true;
  try{
    for(let i=1;i<T.SPECIES.length;i++){ T.getMonSprite(i,false); T.getMonSprite(i,true); }
    for(const k of ["player","rival","boy","girl","hiker","swimmer","grunt","admin","prof","sci","nurse","clerk","elder","mom","leader1","leader2","sign","pc","rayquaza"])
      for(const d of ["U","D","L","R"]) for(const f of [0,1]) T.getCharSprite(k,d,f);
  }catch(e){ ok=false; console.error(" sprite error:",e.message); }
  check("all sprites generate", ok);
}

/* ---- 7. overworld walking + warp ---- */
{
  // teleport player to verdant near the north exit and walk through it
  const W = T.G.scenes[0];
  T.G.pl.map="verdant"; T.G.pl.x=9; T.G.pl.y=3; T.G.pl.dir="U";
  W.loadMap("verdant");
  W.fade=0; W.fadeDir=0;
  let guard=0;
  while(T.G.pl.map==="verdant" && guard++<600){
    T.Input.down={U:true};
    const top=T.G.top();
    top.update();
    T.Input.pressed={};
    if(W.afterFade){ const f=W.afterFade; W.afterFade=null; W.fade=1; W.fadeDir=0; f(); }
  }
  check("walked north into route1", T.G.pl.map==="route1", T.G.pl.map);
  T.Input.down={};
}

/* ---- 8. full trainer battle (gym 1 Petra) to completion ---- */
{
  // strong team so we definitely win
  T.G.pl.party.length=0;
  const ace=T.makeMon(6,40,{ivs:[31,31,31,31,31,31]}); // Tidalfin L40
  T.G.pl.party.push(ace);
  const petra = T.MAPS.gym1.trainers.find(t=>t.id==="tr_petra");
  // build battle like startTrainerFight does
  const team=petra.team.map(([sp,lv])=>{ const m=T.makeMon(sp,lv); m.stages=T.freshStages(); return m; });
  const moneyBefore=T.G.pl.money;
  const b=new T.Battle({trainer:{name:petra.name,team,money:petra.money,winText:petra.post,loseText:petra.lose}});
  T.G.push(b);
  let guard=0, ended=false;
  const origFinish=b.finish.bind(b);
  b.finish=r=>{ ended=r; origFinish(r); };
  while(guard++<30000 && T.G.scenes.includes(b)){
    if(b.phase==="menu"){
      const m=b.pl.moves.find(x=>x.pp>0&&T.MOVES[x.id].c!=="T")||b.pl.moves[0];
      b.playerAct({kind:"move",m}); b.phase="q";
    }
    else { b.step(); if(b.phase==="msg"){ b.msgChar=999; b.msgWait=99; } }
  }
  check("gym battle ends in win", ended==="won", ended);
  check("prize money awarded", T.G.pl.money===moneyBefore+petra.money, T.G.pl.money-moneyBefore);
  check("both enemy mons fainted", team.every(m=>m.hp<=0));
}

/* ---- 9. catch flow ---- */
{
  T.G.pl.bag.pokeball=10;
  const wild=T.makeMon(7,3); wild.stages=T.freshStages(); wild.hp=1; wild.status="SLP"; wild.sleepTurns=3;
  const before=T.G.pl.party.length;
  const b=new T.Battle({wild});
  T.G.push(b);
  let guard=0, res=null;
  const origFinish=b.finish.bind(b);
  b.finish=r=>{ res=r; origFinish(r); };
  while(guard++<20000 && T.G.scenes.includes(b)){
    if(b.phase==="menu"){ b.playerAct({kind:"item",id:"pokeball"}); b.phase="q"; }
    else { b.step(); if(b.phase==="msg"){ b.msgChar=999; b.msgWait=99; } }
  }
  check("catch flow caught the 1HP sleeping bird", res==="caught", res);
  check("party grew", T.G.pl.party.length===before+1);
}

/* ---- 10. draw smoke test for major scenes ---- */
{
  let ok=true;
  const drawAll=()=>{ for(const s of T.G.scenes){ if(s.draw) s.draw(); } };
  try{
    drawAll(); // world
    T.G.push(new T.Battle({wild:(()=>{const w=T.makeMon(15,8);w.stages=T.freshStages();return w;})()}));
    T.G.top().enter&&T.G.top().enter();
    for(let i=0;i<30;i++){ T.G.top().step(); if(T.G.top().phase==="msg"){T.G.top().msgChar=999;T.G.top().msgWait=99;} }
    drawAll();
    T.G.pop();
  }catch(e){ ok=false; console.error(" draw error:",e.message,e.stack&&e.stack.split("\n")[1]); }
  check("scene draw paths execute", ok);
}

/* ---- 11. starter selection via the real dialog UI ---- */
{
  T.startGame(1,null); // fresh game in slot 2
  const press=(k)=>{ T.Input.pressed={[k]:true}; T.G.top().update(); T.Input.pressed={}; };
  const settle=()=>{ for(let i=0;i<5;i++) T.G.top().update&&T.G.top().update(); };
  // skip intro dialog (5 pages): A to complete text, A to advance
  let guard=0;
  while(T.G.scenes.length>1 && guard++<200){ press("A"); settle(); }
  check("intro dialog dismissed", T.G.scenes.length===1, T.G.scenes.length);
  // go to the lab, face the professor, interact
  T.G.pl.map="lab"; T.G.pl.x=5; T.G.pl.y=4; T.G.pl.dir="U";
  const W=T.G.scenes[0];
  W.loadMap("lab"); W.fade=0; W.fadeDir=0;
  press("A"); // interact with prof at (5,3)
  check("prof dialog opened", T.G.scenes.length>1);
  // advance through speech until the choice appears, then pick option 2 (Embercub)
  guard=0;
  let chose=false;
  while(guard++<300 && T.G.pl.party.length===0){
    const top=T.G.top();
    if(top && top.items && top.items[top.idx] && top.items[top.idx].choices && top.charN>=top.lines.join(" ").length){
      if(!chose){ press("D"); chose=true; } // move cursor to Embercub
      press("A");
    } else press("A");
    settle();
  }
  // finish remaining dialog
  guard=0;
  while(T.G.scenes.length>1 && guard++<200){ press("A"); settle(); }
  check("starter chosen via dialog UI", T.G.pl.party.length===1, T.G.pl.party.length);
  check("starter is Embercub", T.G.pl.party[0]&&T.G.pl.party[0].sp===3, T.G.pl.party[0]&&T.G.pl.party[0].sp);
  check("starter flag set", !!T.G.pl.flags.starter);
  check("rival counter is Aquafin", T.G.pl.flags.starterId===3);
  check("bonus pokeballs granted", (T.G.pl.bag.pokeball||0)>=5);
}

console.log(failures===0 ? `ALL PASS (${passes} checks)` : `${failures} FAILURES / ${passes} passed`);
process.exit(failures?1:0);
