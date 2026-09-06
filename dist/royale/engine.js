import {WORLD,RULES,CHARACTERS,PERKS,SPAWNS,LOOT_SPOTS,INPUT_KEYS,inputEmpty,clamp,distance,makePlatforms,makeWalls,getZone} from './world.js';
export const ATTACKS={
 light:{duration:.34,active:.11,end:.18,damage:7,reach:100,stun:.16,push:105,chain:.25},
 light2:{duration:.36,active:.12,end:.20,damage:7,reach:110,stun:.19,push:120,chain:.26},
 light3:{duration:.43,active:.16,end:.23,damage:10,reach:115,stun:.22,push:365},
 heavy:{duration:.57,active:.24,end:.34,damage:13,reach:126,stun:.26,push:540},
 launcher:{duration:.53,active:.19,end:.28,damage:10,reach:126,stun:.27,push:210,launch:670},
 special:{duration:.53,active:.20,end:.25,damage:12,reach:110,stun:.23,push:340},
 rising:{duration:.55,active:.13,end:.28,damage:14,reach:120,stun:.26,push:170,launch:620},
 wave:{duration:.60,active:.23,end:.29,damage:13,reach:170,stun:.25,push:560,radial:true},
 super:{duration:.95,active:.32,end:.43,damage:27,reach:270,stun:.36,push:820,radial:true}
};
const lite=a=>a?.startsWith('light');
export function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
export class RoyaleMatch {
 constructor(members,{seed=Date.now(),bots=true,duration=480}={}){
  this.seed=seed;this.random=seeded(seed);this.duration=duration;this.time=0;this.phase='countdown';this.phaseTime=0;this.tick=0;this.eventId=0;this.events=[];this.history=[];
  this.platforms=makePlatforms();this.walls=makeWalls();this.projectiles=[];this.loot=[];this.nextLoot=20;this.zone=getZone(0);this.finalIds=[];this.winner=null;this.killFeed=[];
  const roster=members.slice(0,8).map(m=>({...m,bot:!!m.bot}));
  if(bots)while(roster.length<8){const n=roster.length;roster.push({id:'cpu'+n,name:'CPU '+(n+1),character:Object.keys(CHARACTERS)[n%Object.keys(CHARACTERS).length],bot:true});}
  if(roster.length<2)throw Error('La partida necesita al menos dos luchadores.');
  this.fighters=roster.map((m,i)=>this.createFighter(m,i));
  this.spawnLoot();
 }
 createFighter(m,i){const d=CHARACTERS[m.character]||CHARACTERS.chamo,s=SPAWNS[i];return{
  id:m.id,name:String(m.name||d.name).slice(0,18),character:CHARACTERS[m.character]?m.character:'chamo',bot:!!m.bot,
  x:s.x,y:s.y,vx:0,vy:0,facing:i%2?-1:1,hp:100,guard:100,ki:35,burst:100,alive:true,kills:0,place:null,
  onGround:true,jumps:0,drop:0,dropY:0,wallSide:0,land:0,state:'idle',stateTime:0,walkPhase:0,runPhase:0,stopTime:0,dashElapsed:0,dashRecovery:0,action:null,actionTime:0,hitIds:[],spawned:false,
  stun:0,invuln:0,flash:0,dashTime:0,dashCD:0,burstCD:0,guardTime:99,guarding:false,guardBroken:0,combo:0,comboGrace:0,queue:[],
  chaseTarget:null,chaseTime:0,attackers:{},fury:0,lastHitBy:null,lastHitTime:-99,burn:0,burnSource:null,
  perks:[],xp:0,level:1,offers:[],reward:null,lootOffer:null,aiClock:0,aiInput:inputEmpty(),prev:inputEmpty(),respawnLock:0
 };}
 emit(type,data={}){const e={id:++this.eventId,type,time:this.time,...data};this.events.push(e);this.history.push(e);if(this.history.length>48)this.history.shift();}
 drain(){const e=this.events;this.events=[];return e;}
 fighter(id){return this.fighters.find(f=>f.id===id);}
 spawnLoot(){for(const [i,p] of LOOT_SPOTS.entries())if(!this.loot.some(l=>l.spot===i)){const perk=Object.keys(PERKS)[Math.floor(this.random()*6)];this.loot.push({id:'loot'+this.tick+'-'+i,spot:i,...p,perk});}}
 setState(f,s){if(f.state!==s){f.state=s;f.stateTime=0;}}
 outside(f){return f.x<this.zone.left||f.x>this.zone.right||f.y-60<this.zone.top||f.y>this.zone.bottom;}
 isPlatformSafe(p){return this.phase==='final'?p.id==='final':!(this.time>210&&p.y>this.zone.bottom+160)&&!(this.time>360&&p.y<this.zone.top-150);}
 startAttack(f,name){
  if(f.stun>0||!f.alive)return false;
  const cost={special:23,rising:26,wave:29,super:80}[name]||0,required=cost*(name==='super'?1:(CHARACTERS[f.character].specialCost||1));
  if(f.ki<required)return false;f.ki-=required;
  f.action=name;f.actionTime=0;f.hitIds=[];f.spawned=false;f.guarding=false;
  if(name==='rising'){f.vy=-590;f.onGround=false;}
  this.setState(f,name);this.emit('swing',{actor:f.id,attack:name,x:f.x,y:f.y-90});return true;
 }
 updateChoice(f,input,press){
  let choice=-1;for(let i=1;i<=3;i++)if(press('choice'+i))choice=i-1;
  if(choice<0)return;
  if(f.reward){const reward=f.reward;f.reward=null;
   if(choice===0)f.hp=Math.min(100,f.hp+32);
   else if(choice===2)f.ki=Math.min(100,f.ki+48);
   else this.givePerk(f,reward.perk);
   this.emit('reward',{actor:f.id,choice});return;
  }
  if(f.lootOffer){f.perks[choice]=f.lootOffer;f.lootOffer=null;this.emit('perk',{actor:f.id,perk:f.perks[choice]});return;}
  if(f.offers.length){const offer=f.offers.shift();this.givePerk(f,offer[choice]);}
 }
 givePerk(f,perk){if(!PERKS[perk]||f.perks.includes(perk))return;if(f.perks.length<3){f.perks.push(perk);this.emit('perk',{actor:f.id,perk});}else f.lootOffer=perk;}
 awardXP(f,amount){f.xp+=amount;const levels=[0,40,95,170,260];while(f.level<5&&f.xp>=levels[f.level]){f.level++;const pool=Object.keys(PERKS).filter(p=>!f.perks.includes(p));for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}f.offers.push(pool.slice(0,3));this.emit('level',{actor:f.id,level:f.level});}}
 updateFighter(f,input,dt){
  const d=CHARACTERS[f.character],previousX=f.x,wasDashing=f.dashTime>0,wasRunning=f.state==='run',press=k=>input.pressed?.includes(k)||(input[k]&&!f.prev[k]);
  f.stateTime+=dt;for(const k of ['stun','invuln','flash','dashTime','dashCD','burstCD','drop','land','comboGrace','chaseTime','guardBroken','respawnLock','stopTime','dashRecovery'])f[k]=Math.max(0,f[k]-dt);
  if(wasDashing){f.dashElapsed+=dt;if(f.dashTime===0)f.dashRecovery=.14;}
  for(const [id,t] of Object.entries(f.attackers))if(this.time-t>4)delete f.attackers[id];
  f.fury=Math.max(0,Object.keys(f.attackers).length-1);
  f.burst=Math.min(100,f.burst+dt*4.2*(1+Math.min(2,f.fury)*.25));
  f.ki=Math.min(100,f.ki+dt*d.kiRate*(f.perks.includes('charge')?1.2:1));
  if(!f.guarding&&f.guardBroken===0)f.guard=Math.min(100,f.guard+dt*(d.guardRate||19));
  if(f.burn>0){f.burn-=dt;this.damage(f,3*dt,this.fighter(f.burnSource),{burn:true});}
  if(!f.alive)return;
  this.updateChoice(f,input,press);
  if(f.reward&&this.time>f.reward.until){f.hp=Math.min(100,f.hp+32);f.reward=null;}
  if(press('burst')&&f.burst>=99&&f.burstCD===0){
   f.burst=0;f.burstCD=1;f.stun=0;f.action=null;f.queue=[];f.invuln=.5;
   for(const o of this.fighters)if(o!==f&&o.alive&&distance(f,o)<200){o.vx=Math.sign(o.x-f.x||1)*720;o.vy=-230;o.stun=.22;o.action=null;o.onGround=false;}
   this.emit('burst',{actor:f.id,x:f.x,y:f.y-70});
  }
  if(f.stun===0){
   if(press('guard'))f.guardTime=0;else f.guardTime+=dt;
   f.guarding=!!input.guard&&!f.action&&!f.dashTime&&f.guardBroken===0&&f.guard>0;
   if(f.guarding)f.guard=Math.max(0,f.guard-dt*3);
   const dashCost=!f.onGround?(d.airDashCost||10):10;
   if(press('dash')&&f.dashCD===0&&f.ki>=dashCost){
    f.ki-=dashCost;f.dashElapsed=0;f.dashRecovery=0;f.stopTime=0;f.dashCD=.56;f.dashTime=.17;f.invuln=f.perks.includes('electric')?.19:.085;f.action=null;f.queue=[];
    const target=f.chaseTime>0&&this.fighter(f.chaseTarget);
    if(target?.alive&&distance(f,target)<1000){const dx=target.x-f.x,dy=target.y-f.y,len=Math.hypot(dx,dy)||1;f.vx=dx/len*1130;f.vy=dy/len*1130;f.onGround=false;f.facing=dx>=0?1:-1;this.emit('chase',{actor:f.id,x:f.x,y:f.y-70,toX:target.x,toY:target.y-70});}
    else{f.facing=input.left?-1:input.right?1:f.facing;f.vx=f.facing*920;f.vy=f.onGround?0:Math.min(40,f.vy);this.emit('dash',{actor:f.id,x:f.x,y:f.y-70});}
   }
   if(!f.dashTime){
    const request=press('super')||(input.heavy&&press('special'))||(input.special&&press('heavy'))?'super':press('special')?(input.down?'wave':input.up?'rising':'special'):press('heavy')?(input.up||f.combo===2&&f.comboGrace>0?'launcher':'heavy'):press('light')?'light':null;
    if(f.action){if(request&&f.queue.length<2&&lite(f.action)&&f.action!=='light3')f.queue.push(request);}
    else if(request){const next=request==='light'&&f.comboGrace>0&&f.combo<3?'light'+(f.combo+1):request;this.startAttack(f,next==='light1'?'light':next);}
    if(press('jump')&&!f.action){
     if(input.down&&f.onGround&&this.phase!=='final'&&f.y<1735){f.drop=.3;f.dropY=f.y;f.onGround=false;f.y+=8;}
     else if(f.onGround||f.wallSide||d.doubleJump&&f.jumps<2){f.vy=-RULES.jump;f.onGround=false;f.jumps++;if(f.wallSide){f.vx=-f.wallSide*510;f.facing=-f.wallSide;}this.emit('jump',{actor:f.id,x:f.x,y:f.y});}
    }
    const direction=(input.right?1:0)-(input.left?1:0);
    if(direction&&!f.action&&!f.guarding)f.facing=direction;
    let target=direction*d.speed*(input.down&&f.onGround?.38:1);
    if(f.guarding||f.action&&f.onGround)target=0;
    f.vx+=(target-f.vx)*Math.min(1,dt*(f.onGround?17:(d.airControl||3.8)));
   }
  }else{f.guarding=false;f.vx*=Math.exp(-dt*2.8);}
  if(f.action){
   f.actionTime+=dt;const move=ATTACKS[f.action];
   if(move.chain&&f.actionTime>=move.chain&&f.queue.length){const request=f.queue.shift(),index=f.action==='light'?2:3;f.action=null;this.startAttack(f,request==='light'?'light'+index:request==='heavy'&&index===3?'launcher':request);}
   else if(f.actionTime>=move.duration){f.action=null;f.queue=[];}
  }
  if(!f.comboGrace&&!f.action)f.combo=0;
  this.physics(f,input,dt);
  if(wasRunning&&!input.left&&!input.right&&f.onGround&&!f.action&&!f.dashTime&&!f.dashRecovery)f.stopTime=.16;
  if(input.left||input.right)f.stopTime=0;
  if(!f.action)this.setState(f,f.stun>0?'hit':f.dashTime?'dash':!f.onGround?'jump':f.guarding?'guard':input.down?'crouch':f.dashRecovery?'recover':f.stopTime?'stop':Math.abs(f.vx)>28?'run':'idle');
  if(f.state==='run')f.runPhase=(f.runPhase+Math.abs(f.x-previousX)/(d.runStride||156))%1;
  if(press('interact')&&this.phase!=='final'){
   const loot=this.loot.find(l=>Math.abs(l.x-f.x)<105&&Math.abs(l.y-f.y)<80);
   if(loot){this.givePerk(f,loot.perk);this.loot=this.loot.filter(l=>l!==loot);}
  }
  f.prev={...input,pressed:undefined};
 }
 physics(f,input,dt){
  const oldX=f.x,oldY=f.y;f.wallSide=0;
  if(!f.onGround&&!f.dashTime)f.vy+=RULES.gravity*dt*(input.down?1.8:1);
  f.x+=f.vx*dt;f.y+=f.vy*dt;f.onGround=false;
  const left=this.phase==='final'?this.zone.left+35:30,right=this.phase==='final'?this.zone.right-35:WORLD.width-30;
  if(f.x<left||f.x>right){const side=f.x<left?-1:1;f.x=clamp(f.x,left,right);f.wallSide=side;if(f.stun>0&&Math.abs(f.vx)>350){f.vx=-f.vx*.4;f.vy=-200;this.emit('wallhit',{x:f.x,y:f.y-70});}else f.vx=0;}
  for(const w of this.walls){
   if(w.hp<=0||f.y<=w.y-w.h+10||f.y-RULES.body>=w.y)continue;
   const overlap=f.x+RULES.width/2>w.x&&f.x-RULES.width/2<w.x+w.w;
   if(!overlap)continue;const side=oldX<w.x?1:-1;f.wallSide=side;f.x=side===1?w.x-RULES.width/2:w.x+w.w+RULES.width/2;
   if(f.stun>0&&Math.abs(f.vx)>320){w.hp-=35;this.damage(f,7,this.fighter(f.lastHitBy),{wall:true});f.vx=-f.vx*.36;f.vy=-220;this.emit(w.hp<=0?'wallbreak':'wallhit',{x:w.x,y:w.y-80,wall:w.id});}
   else f.vx=0;
  }
  if(f.vy>=0){
   for(const p of this.platforms){
    if(f.drop>0&&p.y<=f.dropY+8||!this.isPlatformSafe(p)||f.x<p.x-10||f.x>p.x+p.w+10||oldY>p.y+8||f.y<p.y)continue;
    f.y=p.y;if(f.vy>160){f.land=.13;this.emit('land',{x:f.x,y:f.y});}f.vy=0;f.onGround=true;f.jumps=0;break;
   }
  }
  if(f.y>WORLD.height+100)this.damage(f,1000,this.time-f.lastHitTime<8?this.fighter(f.lastHitBy):null,{fall:true});
 }
 hit(attacker,target,move,attack){
  if(!target.alive||target.invuln>0)return;
  target.attackers[attacker.id]=this.time;target.fury=Math.max(0,Object.keys(target.attackers).length-1);
  const facing=(attacker.x-target.x)*target.facing>=-10;
  const window=.14+(CHARACTERS[target.character].parry||0)+(target.perks.includes('parry')?.06:0);
  if(target.guarding&&facing&&target.guardTime<=window){
   attacker.stun=.35;attacker.action=null;attacker.queue=[];attacker.vx=-attacker.facing*240;target.ki=Math.min(100,target.ki+16);target.burst=Math.min(100,target.burst+15);
   this.emit('parry',{actor:target.id,x:target.x,y:target.y-95});return;
  }
  if(target.guarding&&facing){
   target.guard-=move.damage*2;target.ki=Math.min(100,target.ki+3);this.damage(target,move.damage*.08,attacker);target.vx=attacker.facing*move.push*.28;
   if(target.guard<=0){target.guard=0;target.guardBroken=.85;target.guarding=false;target.stun=.7;this.emit('guardbreak',{actor:target.id,x:target.x,y:target.y-80});}
   else this.emit('block',{x:target.x,y:target.y-95});return;
  }
  const damage=move.damage*CHARACTERS[attacker.character].power*(target.fury>=2?.9:1);
  this.damage(target,damage,attacker);if(!target.alive)return;
  target.flash=.10;target.stun=move.stun/(1+Math.min(2,target.fury)*.12);target.action=null;target.queue=[];
  const weight=CHARACTERS[target.character].weight||1,boost=(attacker.perks.includes('impact')&&!lite(attack)?1.25:1)*(attacker.character==='ruffo'?1.1:1);
  target.vx=Math.sign(target.x-attacker.x||attacker.facing)*move.push*boost/weight;
  if(move.launch){target.vy=-move.launch;target.onGround=false;}else if(!target.onGround)target.vy=Math.min(target.vy,-130);
  if(lite(attack)){attacker.combo=attack==='light'?1:attack==='light2'?2:3;attacker.comboGrace=.55;if(attack==='light3'&&attacker.perks.includes('fire')){target.burn=2;target.burnSource=attacker.id;}}
  if(!lite(attack)){attacker.chaseTarget=target.id;attacker.chaseTime=.55;}
  attacker.ki=Math.min(100,attacker.ki+5);target.burst=Math.min(100,target.burst+damage*.9*(1+Math.min(2,target.fury)*.25));
  this.emit('hit',{actor:attacker.id,target:target.id,x:target.x,y:target.y-80,damage:Math.round(damage),attack,combo:attacker.combo});
 }
 damage(f,value,source,kind={}){
  if(!f.alive)return;const amount=Math.min(f.hp,value);f.hp=Math.max(0,f.hp-value);
  if(source&&source!==f){f.lastHitBy=source.id;f.lastHitTime=this.time;if(!kind.burn){this.awardXP(source,amount*.3);if(source.perks.includes('vampire'))source.hp=Math.min(100,source.hp+amount*.05);}}
  if(f.hp<=0){f.alive=false;f.action=null;f.vx=0;f.place=this.fighters.filter(a=>a.alive).length+1;
   const killer=source?.alive?source:this.time-f.lastHitTime<8?this.fighter(f.lastHitBy):null;
   if(killer&&killer!==f){killer.kills++;killer.hp=Math.min(100,killer.hp+10);killer.burst=Math.min(100,killer.burst+20);killer.reward={perk:f.perks[0]||Object.keys(PERKS)[Math.floor(this.random()*6)],until:this.time+12};this.awardXP(killer,55);}
   const record={victim:f.name,killer:killer?.name||'La tormenta',time:this.time};this.killFeed.unshift(record);this.killFeed=this.killFeed.slice(0,4);this.emit('elimination',{actor:killer?.id,target:f.id,x:f.x,y:f.y,place:f.place});
  }
 }
 attacks(){
  const pending=[];
  for(const f of this.fighters){
   if(!f.alive||!f.action)continue;const m=ATTACKS[f.action];if(f.actionTime<m.active||f.actionTime>m.end)continue;
   if(f.action==='special'&&!f.spawned){f.spawned=true;this.projectiles.push({id:'shot'+this.tick+'-'+f.id,owner:f.id,x:f.x+f.facing*55,y:f.y-92,vx:f.facing*(f.character==='pablo'?830:620),life:1.5});this.emit('projectile',{actor:f.id,x:f.x,y:f.y-92});continue;}
   if(f.action==='special')continue;
   const reach=m.reach*(f.action==='super'&&f.level>=5?1.25:1);
   for(const o of this.fighters){if(o===f||!o.alive||f.hitIds.includes(o.id)||Math.abs(o.y-f.y)>135)continue;
    const dx=(o.x-f.x)*f.facing;if(m.radial?Math.abs(dx)>reach:dx< -12||dx>reach)continue;
    f.hitIds.push(o.id);pending.push([f,o,m,f.action]);
   }
   for(const w of this.walls)if(w.hp>0&&!f.hitIds.includes(w.id)&&Math.abs(w.y-f.y)<150&&(w.x-f.x)*f.facing>0&&Math.abs(w.x-f.x)<reach+30){f.hitIds.push(w.id);w.hp-=m.damage*(lite(f.action)?1:2.5);this.emit(w.hp<=0?'wallbreak':'wallhit',{x:w.x,y:w.y-75,wall:w.id});}
   if(m.radial&&!f.spawned){f.spawned=true;this.emit(f.action==='super'?'super':'wave',{actor:f.id,x:f.x,y:f.y-70,radius:reach});}
  }
  for(const args of pending)this.hit(...args);
 }
 ai(f,dt){
  f.aiClock-=dt;if(f.aiClock>0)return f.aiInput;
  f.aiClock=.09+this.random()*.12;const i=inputEmpty();
  if(f.reward||f.lootOffer||f.offers.length){i['choice'+(f.hp<55?1:Math.ceil(this.random()*3))]=true;}
  const enemies=this.fighters.filter(o=>o.alive&&o!==f);let target=enemies.sort((a,b)=>distance(f,a)-distance(f,b))[0];if(!target)return i;
  let goal=target;
  if(this.outside(f)||f.x<this.zone.left+160||f.x>this.zone.right-160)goal={x:clamp(f.x,this.zone.left+240,this.zone.right-240),y:1120};
  const dx=goal.x-f.x,dy=goal.y-f.y;
  if(Math.abs(dy)>220&&goal===target){const shaft=clamp(Math.round((f.x-500)/1510),0,3)*1510+550;goal={x:shaft+(Math.floor((1740-f.y)/145)%2)*110,y:target.y};}
  const moveX=goal.x-f.x;const near=goal===target&&Math.abs(dx)<105&&Math.abs(dy)<110;
  if(!near){i.left=moveX< -22;i.right=moveX>22;}
  if(goal.y<f.y-90&&Math.abs(moveX)<240||f.wallSide||f.onGround&&Math.abs(dx)>140&&this.random()<.10)i.jump=true;
  if(goal.y>f.y+200&&f.onGround){i.down=true;i.jump=true;}
  if(Math.abs(target.x-f.x)<150&&Math.abs(target.y-f.y)<130){
   if(target.action&&this.random()<.34)i.guard=true;
   else if(this.random()<.62){i.light=this.random()<.64;i.heavy=!i.light;if(i.heavy&&this.random()<.25)i.up=true;}
   if(f.stun>0&&f.burst>99&&this.random()<.5)i.burst=true;
   if(f.ki>82&&this.random()<.12)i.super=true;
  }else if(Math.abs(target.y-f.y)<120&&Math.abs(dx)<650&&this.random()<.22)i.special=true;
  if(f.chaseTime>0&&this.random()<.55||Math.abs(moveX)>380&&f.ki>35&&this.random()<.12)i.dash=true;
  if(this.loot.some(l=>Math.abs(l.x-f.x)<100&&Math.abs(l.y-f.y)<80)&&this.random()<.75)i.interact=true;
  f.aiInput=i;return i;
 }
 beginFinal(){
  const alive=this.fighters.filter(f=>f.alive);this.phase='final';this.phaseTime=0;this.finalIds=alive.map(f=>f.id);this.zone={left:2420,right:3780,top:0,bottom:1920,phase:6,next:0};
  this.platforms=[{id:'final',x:2420,y:1120,w:1360,kind:'floor'}];this.walls=[];this.loot=[];this.projectiles=[];
  alive.forEach((f,i)=>{f.x=i===0?2770:3430;f.y=1120;f.vx=f.vy=0;f.hp=Math.max(55,f.hp);f.guard=100;f.ki=Math.max(40,f.ki);f.stun=0;f.action=null;f.queue=[];f.onGround=true;f.jumps=0;f.drop=0;f.dashTime=0;f.dashRecovery=0;f.dashElapsed=0;f.stopTime=0;f.runPhase=0;f.state='idle';f.stateTime=0;f.invuln=2.4;f.reward=null;f.lootOffer=null;f.offers=[];f.prev=inputEmpty();f.burn=0;f.attackers={};});
  this.emit('final',{ids:this.finalIds});
 }
 step(dt,inputs={}){
  dt=clamp(dt,0,1/30);if(this.phase==='over')return;this.tick++;this.phaseTime+=dt;
  if(this.phase==='countdown'){if(this.phaseTime>=3){this.phase='battle';this.phaseTime=0;this.emit('fight');}return;}
  if(this.phase==='final'&&this.phaseTime<2.4)return;
  this.time+=dt;if(this.phase!=='final')this.zone=getZone(this.time*480/this.duration);
  for(const f of this.fighters)if(f.alive)this.updateFighter(f,f.bot?this.ai(f,dt):inputs[f.id]||inputEmpty(),dt);
  // Only bodies on the same level collide; dashes with the electric perk pass through.
  for(let i=0;i<this.fighters.length;i++)for(let j=i+1;j<this.fighters.length;j++){
   const a=this.fighters[i],b=this.fighters[j];if(!a.alive||!b.alive||Math.abs(a.y-b.y)>95||a.dashTime&&a.perks.includes('electric')||b.dashTime&&b.perks.includes('electric'))continue;
   const dx=b.x-a.x;if(Math.abs(dx)<78){const push=(78-Math.abs(dx))/2,sign=dx>=0?1:-1;a.x-=sign*push;b.x+=sign*push;}
  }
  this.attacks();
  for(const p of this.projectiles){p.x+=p.vx*dt;p.life-=dt;const owner=this.fighter(p.owner);if(!owner)continue;
   for(const f of this.fighters)if(f.alive&&f!==owner&&Math.abs(f.x-p.x)<40&&p.y>f.y-RULES.body&&p.y<f.y){this.hit(owner,f,ATTACKS.special,'special');p.life=0;break;}
   for(const w of this.walls)if(w.hp>0&&p.x>=w.x&&p.x<=w.x+w.w&&p.y>w.y-w.h&&p.y<w.y){w.hp-=12;p.life=0;}
  }
  this.projectiles=this.projectiles.filter(p=>p.life>0);
  if(this.phase==='battle'){
   for(const f of this.fighters){if(this.fighters.filter(o=>o.alive).length<=2)break;if(f.alive&&this.outside(f))this.damage(f,dt*(4+Math.min(24,this.time/22)),null,{storm:true});}
   this.nextLoot-=dt;if(this.nextLoot<=0){this.nextLoot=30;this.spawnLoot();}
  }
  const alive=this.fighters.filter(f=>f.alive);
  if(alive.length===2&&this.phase==='battle')this.beginFinal();
  else if(alive.length<=1){this.winner=alive[0]?.id||null;this.phase='over';this.phaseTime=0;if(alive[0])alive[0].place=1;this.emit('victory',{actor:this.winner});}
  else if(this.phase==='final'&&this.phaseTime>RULES.finalSeconds+2.4){
   const ranked=[...alive].sort((a,b)=>b.hp-a.hp||b.kills-a.kills||b.ki-a.ki||a.id.localeCompare(b.id));
   this.damage(ranked[1],1000,ranked[0],{timeout:true});this.winner=ranked[0].id;ranked[0].place=1;this.phase='over';this.phaseTime=0;this.emit('victory',{actor:this.winner});
  }
 }
 snapshot(){return {seed:this.seed,time:this.time,phase:this.phase,phaseTime:this.phaseTime,tick:this.tick,zone:this.zone,finalIds:this.finalIds,winner:this.winner,fighters:this.fighters.map(f=>{const {prev,aiInput,aiClock,queue,hitIds,...data}=f;return data;}),walls:this.walls,loot:this.loot,projectiles:this.projectiles,killFeed:this.killFeed,events:this.history.slice(-24)};}
}
