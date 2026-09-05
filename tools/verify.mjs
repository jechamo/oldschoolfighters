import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Match,Fighter,emptyInput,ARENA} from '../dist/engine.js';
import {poseKey} from '../dist/sprites.js';
const root=new URL('../dist/',import.meta.url),db=JSON.parse(fs.readFileSync(new URL('assets/fighters.json',root)));
let checks=0;
const check=(v,m)=>{assert(v,m);checks++;};
const defs=db.characters;
function fixture(){const m=new Match(defs[0],defs[1],{mode:'local'});m.phase='fight';m.fighters[0].x=500;m.fighters[1].x=610;return m;}
function run(m,seconds,a={},b={}){for(let t=0;t<seconds;t+=1/120)m.step(1/120,[{...emptyInput(),...a},{...emptyInput(),...b}]);}
let m=fixture();run(m,.18,{punch:true});run(m,.01);run(m,.20,{punch:true});run(m,.01);run(m,.6,{punch:true});
check(m.fighters[1].hp===74,'Three deliberate presses chain jab, cross and hook with distinct damage.');
check(m.fighters[0].combo===3,'Combo count is capped at three.');
m=fixture();run(m,.7,{punch:true});check(m.fighters[0].punchIndex===1,'Holding punch cannot trigger automatic combos.');
m=fixture();let apex=0;for(let t=0;t<1.3;t+=1/120){m.step(1/120,[{...emptyInput(),up:t<.1},emptyInput()]);apex=Math.max(apex,m.fighters[0].y);}check(apex>315&&apex<327,'High jump clears opponent while staying inside screen.');
m=fixture();run(m,.65,{punch:true});check(m.fighters[1].hp===93,'A held punch must deal damage exactly once.');
m=fixture();run(m,.65,{punch:true},{block:true});check(m.fighters[1].hp===99,'Standing guard reduces high punch damage.');
for(const def of defs){m=fixture();m.fighters[1].def=def;run(m,.4,{}, {down:true});run(m,.65,{punch:true},{down:true});check(m.fighters[1].hp===100,def.id+' must duck high punches.');}
m=fixture();run(m,.4,{down:true},{block:true});run(m,.6,{down:true,punch:true},{block:true});check(m.fighters[1].hp===93,'A low punch bypasses standing guard.');
m=fixture();run(m,.4,{down:true},{block:true,down:true});run(m,.6,{down:true,punch:true},{block:true,down:true});check(m.fighters[1].hp===99,'Low guard blocks a low punch.');
m=fixture();m.fighters[1].x=695;run(m,.8,{kick:true});check(m.fighters[1].hp===88,'Kick reaches farther than punch.');
m=fixture();m.fighters[1].x=695;run(m,.65,{punch:true});check(m.fighters[1].hp===100,'Short punch cannot damage a distant fighter.');
m=fixture();run(m,.25,{up:true});check(m.fighters[0].y>100,'Jump must rise.');run(m,1.2);check(m.fighters[0].y===0,'Jump must return to the ground.');
m=fixture();run(m,1,{up:true,right:true});check(m.fighters[0].x>m.fighters[1].x,'A high jump can cross over an opponent.');
m=fixture();run(m,1,{right:true},{left:true});check(Math.abs(m.fighters[0].x-m.fighters[1].x)>=84.9,'Body collision must prevent fighters passing through each other.');
run(m,8,{left:true},{left:true});check(m.fighters.every(f=>f.x>=ARENA.left&&f.x<=ARENA.right),'Movement must respect arena edges.');
m=fixture();run(m,.6,{punch:true},{punch:true});check(m.fighters.every(f=>f.hp<100),'Simultaneous active attacks can trade.');
m=fixture();m.fighters[1].hp=7;run(m,.7,{punch:true});check(m.phase==='roundover'&&m.fighters[0].wins===1,'KO awards one round.');run(m,4.2);check(m.round===2&&m.fighters.every(f=>f.hp===100),'Next round resets health.');
run(m,1);m.fighters[0].x=500;m.fighters[1].x=610;m.fighters[1].hp=7;run(m,.6,{punch:true});run(m,3);check(m.phase==='over'&&m.winner===0,'Two round wins complete a match.');
m=fixture();m.timer=.05;m.fighters[0].hp=70;m.fighters[1].hp=60;run(m,.1);check(m.roundWinner===0,'Timeout awards the fighter with more health.');
let seed=321;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(const difficulty of ['easy','normal','hard']){m=new Match(defs[0],defs[3],{mode:'cpu',difficulty,random:rng});run(m,150);check(m.phase==='over'&&m.winner===1,'CPU must approach, attack and finish a match at '+difficulty+' difficulty.');}

// Assets must have a valid full drawing for every movement and keep visible pixels inside the arena.
for(const def of defs){
 for(const action of ['idle','walk','punch','cross','hook','kick','crouch','jump'])check(def.anims[action]?.length>0,def.id+' missing '+action);
 for(const key of new Set(Object.values(def.anims).flat())){
  const f=db.frames[key];check(!!f&&fs.existsSync(new URL('assets/'+f.src,root)),'Missing sprite '+key);
  const [x,y,w,h]=f.bounds;check(x>4&&y>4&&x+w<508&&y+h<508,'Transparent margin '+key);
 }
 const f=new Fighter(def,ARENA.left,1);for(const state of ['idle','walk','punch','kick','crouch','jump'])for(let t=0;t<.7;t+=.04){
  f.state=state;f.action=['punch','kick'].includes(state)?state:null;f.actionTime=t;f.punchIndex=1;f.walkPhase=t*7;f.crouch=state==='crouch'?1:0;f.y=state==='jump'?321:0;f.jumpTime=.4;
  const key=poseKey(f);check(!!db.frames[key],'Animation frame '+key);
  const [x,y,w,h]=db.frames[key].bounds;check(ARENA.left+x-256>=0&&ARENA.left+x+w-256<=1280&&598-f.y+y-448>=0,'Visible frame escapes arena '+key);
 }
}
console.log(JSON.stringify({checks,characters:defs.length,drawnFrames:Object.keys(db.frames).length}));
