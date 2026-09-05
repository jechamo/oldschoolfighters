export const ARENA = { width:1280, height:720, ground:598, left:138, right:1142 };
export const MOVES = {
  punch:{duration:.44,active:.15,end:.23,damage:7,reach:160,stun:.23,push:12,chainAt:.32},
  cross:{duration:.48,active:.18,end:.26,damage:8,reach:177,stun:.26,push:16,chainAt:.36},
  hook:{duration:.56,active:.22,end:.31,damage:11,reach:185,stun:.34,push:38},
  kick:{duration:.70,active:.29,end:.39,damage:12,reach:203,stun:.30,push:42}
};
export const punchMove=f=>f.punchIndex===3?MOVES.hook:f.punchIndex===2?MOVES.cross:MOVES.punch;
export const activeMove=f=>f.action==='punch'?punchMove(f):MOVES[f.action];
export const JUMP={velocity:1080,gravity:1800};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const emptyInput=()=>({left:false,right:false,up:false,down:false,punch:false,kick:false,block:false});

export class Fighter {
 constructor(def,x,facing){
  this.def=def;this.x=x;this.px=x;this.y=0;this.py=0;this.vx=0;this.vy=0;this.facing=facing;
  this.hp=100;this.healthTrail=100;this.state='idle';this.stateTime=0;this.action=null;this.actionTime=0;
  this.stun=0;this.attackHit=false;this.crouch=0;this.walkPhase=0;this.wins=0;this.land=0;
  this.buffer=null;this.bufferTime=0;this.prev=emptyInput();this.flash=0;this.combo=0;this.comboTime=0;
  this.punchIndex=0;this.chainQueued=false;this.attackCooldown=0;this.jumpPrep=0;this.jumpTime=0;
 }
}

export class Match {
 constructor(a,b,{mode='cpu',difficulty='normal',random=Math.random}={}){
  this.defs=[a,b];this.mode=mode;this.difficulty=difficulty;this.random=random;this.events=[];
  this.fighters=[new Fighter(a,360,1),new Fighter(b,920,-1)];this.phase='intro';this.phaseTime=0;
  this.round=1;this.timer=60;this.elapsed=0;this.hitstop=0;this.winner=null;this.roundWinner=null;
  this.aiTime=0;this.aiInput=emptyInput();this.aiActionTime=0;
 }
 emit(type,data={}){this.events.push({type,...data});}
 drain(){const e=this.events;this.events=[];return e;}
 nextRound(){
  const scores=this.fighters.map(f=>f.wins);
  this.fighters=[new Fighter(this.defs[0],360,1),new Fighter(this.defs[1],920,-1)];
  this.fighters.forEach((f,i)=>f.wins=scores[i]);this.round++;this.timer=60;this.phase='intro';this.phaseTime=0;
  this.roundWinner=null;this.aiInput=emptyInput();this.aiTime=0;
 }
 ai(dt){
  this.aiTime-=dt;this.aiActionTime-=dt;
  if(this.aiTime>0)return this.aiInput;
  const f=this.fighters[1],o=this.fighters[0],d=o.x-f.x,dist=Math.abs(d);
  const level=this.difficulty==='easy'?.6:this.difficulty==='hard'?1.35:1;
  this.aiTime=(.12+this.random()*.13)/level;
  const i=emptyInput();
  if(dist>155){i.left=d<0;i.right=d>0;}
  else if(dist<100 && this.random()<.30){i.left=d>0;i.right=d<0;}
  if(o.action && dist<230 && this.random()<.35*level){i.block=true;i.left=false;i.right=false;i.down=o.crouch>.5;}
  else if(dist<205 && this.aiActionTime<=0 && this.random()<.72){
   i.kick=dist>158||this.random()<.38;i.punch=!i.kick;this.aiActionTime=(.45+this.random()*.6)/level;
  }
  if(dist>230 && dist<450 && this.random()<.05*level)i.up=true;
  if(dist<160 && !i.block && this.random()<.07)i.down=true;
  this.aiInput=i;return i;
 }
 setState(f,state){if(f.state!==state){f.state=state;f.stateTime=0;}}
 attack(f,move,chain=1){
  if(f.action||f.stun>0||f.hp<=0)return false;
  f.action=move;f.punchIndex=move==='punch'?chain:0;f.chainQueued=false;
  f.actionTime=0;f.attackHit=false;f.buffer=null;f.bufferTime=0;
  this.setState(f,move);this.emit('swing',{move,index:f.punchIndex,x:f.x,side:this.fighters.indexOf(f)});return true;
 }
 step(dt,inputs=[emptyInput(),emptyInput()]){
  dt=clamp(dt,0,1/30);this.elapsed+=dt;
  for(const f of this.fighters){f.px=f.x;f.py=f.y;f.flash=Math.max(0,f.flash-dt);f.land=Math.max(0,f.land-dt);f.healthTrail+=(f.hp-f.healthTrail)*Math.min(1,dt*4);}
  if(this.phase==='over')return;
  if(this.hitstop>0){
   // Read button edges during impact freeze so rapid combo taps are never lost.
   this.fighters.forEach((f,n)=>{const input=n===1&&this.mode==='cpu'?this.aiInput:(inputs[n]||emptyInput());this.captureAttack(f,input);f.prev={...input};});
   this.hitstop-=dt;return;
  }
  this.phaseTime+=dt;
  if(this.phase==='intro'){
   if(this.phaseTime>=2){this.phase='fight';this.phaseTime=0;this.emit('fight');}
   return;
  }
  if(this.phase==='roundover'){
   for(const f of this.fighters){f.stateTime+=dt;this.gravity(f,dt);}
   if(this.phaseTime>2.6){
    const winner=this.fighters.findIndex(f=>f.wins>=2);
    if(winner>=0){this.phase='over';this.winner=winner;this.emit('matchover',{winner});}
    else this.nextRound();
   }
   return;
  }
  this.timer=Math.max(0,this.timer-dt);
  const ins=[inputs[0]||emptyInput(),this.mode==='cpu'?this.ai(dt):(inputs[1]||emptyInput())];
  this.fighters.forEach((f,n)=>this.updateFighter(f,this.fighters[1-n],ins[n],dt));
  this.separate();
  // Resolve both active attacks from the same simulation instant, including trades.
  const pending=[];
  this.fighters.forEach((f,n)=>{
   if(!f.action||f.attackHit)return;
   const move=activeMove(f);if(f.actionTime<move.active||f.actionTime>move.end)return;
   const o=this.fighters[1-n],dx=(o.x-f.x)*f.facing;
   if(dx<0||dx>move.reach)return;
   const low=f.crouch>.55 && f.y===0;
   const strikeY=f.y+(low?104:f.action==='punch'?265:160);
   const top=o.y+(302-o.crouch*(302-(o.def.crouchHeight||248))),bottom=o.y+20;
   if(strikeY<bottom||strikeY>top)return;
   pending.push({f,o,move,moveName:f.action,low,side:n});
  });
  pending.forEach(x=>this.hit(x));
  if(this.fighters.some(f=>f.hp<=0)||this.timer<=0)this.finishRound();
 }
 gravity(f,dt){
  if(f.y>0||f.vy>0){f.jumpTime+=dt;f.vy-=JUMP.gravity*dt;f.y+=f.vy*dt;if(f.y<=0){f.y=0;f.vy=0;f.land=.14;f.jumpTime=0;this.emit('land',{x:f.x});}}
 }
 captureAttack(f,input){
  const punch=input.punch&&!f.prev.punch,kick=input.kick&&!f.prev.kick;
  if(punch&&f.action==='punch')f.chainQueued=Math.min(3-f.punchIndex,Number(f.chainQueued)+1);
  else if((punch||kick)&&f.attackCooldown===0){f.buffer=kick?'kick':'punch';f.bufferTime=.18;}
 }
 updateFighter(f,o,input,dt){
  f.stateTime+=dt;f.comboTime=Math.max(0,f.comboTime-dt);if(!f.comboTime)f.combo=0;
  this.gravity(f,dt);f.stun=Math.max(0,f.stun-dt);
  f.attackCooldown=Math.max(0,f.attackCooldown-dt);
  if(f.stun>0){f.x=clamp(f.x+f.vx*dt,ARENA.left,ARENA.right);f.vx*=Math.exp(-dt*12);this.setState(f,'hit');f.prev={...input};return;}
  const press=key=>input[key]&&!f.prev[key];
  this.captureAttack(f,input);
  if(f.bufferTime>0)f.bufferTime-=dt;else f.buffer=null;
  if(f.action){
   f.actionTime+=dt;
   const move=activeMove(f);
   if(f.action==='punch'&&f.chainQueued&&f.actionTime>=move.chainAt&&f.punchIndex<3){
    const next=f.punchIndex+1,queued=Number(f.chainQueued)-1;f.action=null;this.attack(f,'punch',next);f.chainQueued=queued;
   }else if(f.actionTime>=move.duration){
    if(f.punchIndex===3){f.attackCooldown=.16;f.buffer=null;f.bufferTime=0;}
    f.action=null;f.attackHit=false;f.chainQueued=false;
   }
  }
  if(!f.action){
   f.facing=o.x>=f.x?1:-1;
   if(press('up')&&f.y===0&&!input.down&&!f.jumpPrep)f.jumpPrep=.065;
   if(f.jumpPrep>0){f.jumpPrep=Math.max(0,f.jumpPrep-dt);if(f.jumpPrep===0){f.vy=JUMP.velocity;f.y=.01;f.jumpTime=0;this.emit('jump',{x:f.x});}}
   if(f.buffer&&!f.jumpPrep&&f.attackCooldown===0){this.attack(f,f.buffer);}
  }
  const crouchTarget=input.down&&f.y===0?1:0;
  f.crouch+=(crouchTarget-f.crouch)*Math.min(1,dt*18);
  if(Math.abs(f.crouch-crouchTarget)<.002)f.crouch=crouchTarget;
  const moveDir=(input.right?1:0)-(input.left?1:0);
  f.blocking=input.block&&!f.action&&f.y===0;
  let target=moveDir*f.def.speed*(f.y>0?.88:1);
  if((f.action&&f.y===0)||input.down||f.blocking||f.jumpPrep)target=0;
  f.vx+=(target-f.vx)*Math.min(1,dt*(f.y>0?5:20));
  f.x=clamp(f.x+f.vx*dt,ARENA.left,ARENA.right);
  if(Math.abs(f.vx)>15)f.walkPhase+=dt*f.vx*f.facing/200*6.5;
  if(f.action)this.setState(f,f.action);
  else this.setState(f,f.y>0||f.jumpPrep?'jump':f.blocking?'block':f.crouch>.05?'crouch':Math.abs(f.vx)>18?'walk':'idle');
  f.prev={...input};
 }
 separate(){
  const [a,b]=this.fighters;
  if(Math.abs(a.y-b.y)>104)return;
  const d=b.x-a.x,min=85;if(Math.abs(d)>=min)return;
  const sign=d>=0?1:-1,push=(min-Math.abs(d))/2;
  const ax=a.x,bx=b.x;a.x=clamp(a.x-push*sign,ARENA.left,ARENA.right);b.x=clamp(b.x+push*sign,ARENA.left,ARENA.right);
  if(Math.abs(b.x-a.x)<min){if(a.x===ax)a.x=clamp(b.x-min*sign,ARENA.left,ARENA.right);else b.x=clamp(a.x+min*sign,ARENA.left,ARENA.right);}
 }
 hit({f,o,move,moveName,low,side}){
  f.attackHit=true;
  const blocked=o.blocking&&o.facing!==f.facing&&(low?o.crouch>.55:o.crouch<.75);
  const damage=blocked?Math.ceil(move.damage*.12):Math.round(move.damage*f.def.power);
  o.hp=Math.max(0,o.hp-damage);o.flash=blocked?.05:.11;
  if(!blocked){o.stun=move.stun;o.vx=f.facing*move.push*9;o.action=null;o.buffer=null;o.chainQueued=false;o.jumpPrep=0;this.setState(o,'hit');f.combo=Math.min(3,f.combo+1);f.comboTime=.95;}
  else{o.vx=f.facing*move.push*3;o.stun=.075;}
  this.hitstop=blocked?.025:moveName==='kick'?.065:.045;
  this.emit(blocked?'block':'hit',{x:(f.x+o.x)/2,y:ARENA.ground-f.y-(low?104:moveName==='punch'?265:160),side,move:moveName,combo:f.combo});
 }
 finishRound(){
  const [a,b]=this.fighters;this.roundWinner=a.hp===b.hp?null:a.hp>b.hp?0:1;
  if(this.roundWinner!==null)this.fighters[this.roundWinner].wins++;
  this.phase='roundover';this.phaseTime=0;
  for(const f of this.fighters){f.action=null;f.vx=0;if(f.hp<=0)this.setState(f,'ko');else this.setState(f,'idle');}
  this.emit('roundover',{winner:this.roundWinner});
 }
}
