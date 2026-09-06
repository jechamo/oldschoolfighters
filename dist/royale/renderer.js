import {WORLD,RULES,CHARACTERS,PERKS,makePlatforms,clamp} from './world.js';
import {ATTACKS} from './engine.js';
import {locomotionPose} from './animation.js';
export class RoyaleRenderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.images=new Map();this.db=null;this.camera={x:450,y:910,zoom:1.15};this.positions=new Map();this.particles=[];this.seenEvent=0;this.shake=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;}
 async image(src){if(!this.images.has(src)){const im=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se ha podido cargar el escenario o un personaje.'));img.src=new URL('../assets/'+src,import.meta.url).href;});this.images.set(src,im);}return this.images.get(src);}
 async load(){const response=await fetch(new URL('../assets/royale-fighters.json',import.meta.url));if(!response.ok)throw Error('No se han podido cargar los personajes.');this.db=await response.json();await Promise.all([...new Set(Object.values(this.db.frames).map(f=>f.src)),'arena.webp','royale-city.webp','royale-metro.webp'].map(s=>this.image(s)));}
 resize(){const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.max(1,Math.round(rect.width*dpr));this.canvas.height=Math.max(1,Math.round(rect.height*dpr));}
 pose(f){
  const d=this.db.characters.find(d=>d.id===f.character),a=d.anims,guard=a.idle[0];
  if(!f.alive)return a.crouch.at(-1);
  if(f.action){const move=ATTACKS[f.action],t=f.actionTime;
   if(f.action==='heavy'){const p=t/move.duration;return p<.12?guard:p<.38?a.kick[0]:p<.48?a.kick[1]:p<.65?a.kick[2]:p<.86?a.kick[3]:guard;}
   const seq=f.action==='light2'?a.cross:f.action==='light3'||f.action==='launcher'||f.action==='rising'?a.hook:a.punch;
   return t<move.active*.4?seq[0]:t<move.active?seq[1]:t<move.end?seq[2]:seq[3];
  }
  return locomotionPose(f,a);
 }
 events(events){
  for(const e of events||[]){if(e.id<=this.seenEvent)continue;this.seenEvent=e.id;
   const color=e.type==='parry'?'#80eeff':e.type==='burst'||e.type==='super'?'#c59bff':e.type==='wallbreak'?'#c9a47c':'#ffeeab';
   if(['hit','parry','block','wallhit','wallbreak','elimination'].includes(e.type)){
    for(let i=0;i<(e.type==='wallbreak'?24:12);i++){const angle=i/12*6.28,speed=80+Math.random()*210;this.particles.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.38,max:.38,color});}
    if(!this.reduced)this.shake=e.type==='hit'?4:e.type==='wallbreak'?8:2;
   }
   if(['burst','super','wave'].includes(e.type)){this.particles.push({x:e.x,y:e.y,life:.48,max:.48,color,ring:true,radius:e.radius||200});if(!this.reduced)this.shake=9;}
   if(e.type==='dash'||e.type==='chase')this.particles.push({x:e.x,y:e.y,vx:0,vy:0,life:.24,max:.24,color:'#91d9ff',streak:true});
   if(e.type==='parry')this.particles.push({x:e.x,y:e.y-50,life:.7,max:.7,color,text:'PARRY'});
  }
 }
 drawFighter(f,position,time,localId){
  const c=this.ctx,key=this.pose(f),frame=this.db.frames[key],im=this.images.get(frame.src),scale=.5;
  c.save();c.translate(position.x,position.y);c.scale(f.facing*scale,scale);
  if(!f.alive)c.globalAlpha=.32;
  if(f.flash>0)c.filter='brightness(1.55)';c.drawImage(im,...frame.box,-256,-448,512,512);c.restore();
  if(!f.alive)return;
  const color=CHARACTERS[f.character].color;
  if(f.guarding){c.strokeStyle=f.guardTime<.18?'#b7f8ff':'#8cafbf';c.lineWidth=3;c.beginPath();c.arc(position.x+f.facing*10,position.y-75,85,-Math.PI/2*f.facing,Math.PI/2*f.facing,f.facing<0);c.stroke();}
  if(f.fury>0){c.strokeStyle='#ee94ff';c.globalAlpha=.4+.25*Math.sin(time*12);c.lineWidth=2;c.beginPath();c.ellipse(position.x,position.y-65,62,90,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
  if(f.burn>0){c.fillStyle='#ff964aaa';for(let n=0;n<4;n++){c.beginPath();c.arc(position.x-25+n*17,position.y-35-Math.sin(time*8+n)*15,6,0,6.28);c.fill();}}
  c.font='700 12px system-ui';c.textAlign='center';c.fillStyle=f.id===localId?'#d3ff8c':'#fff';c.shadowColor='#000';c.shadowBlur=4;
  c.fillText((f.id===localId?'TÚ · ':'')+f.name+(f.bot&&!f.name.startsWith('CPU')?' · CPU':''),position.x,position.y-172);c.shadowBlur=0;
  c.fillStyle='#10151adb';c.fillRect(position.x-34,position.y-163,68,5);c.fillStyle=color;c.fillRect(position.x-34,position.y-163,68*Math.max(0,f.hp)/100,5);
  if(f.id===localId){c.fillStyle=color;c.beginPath();c.moveTo(position.x,position.y-189);c.lineTo(position.x-5,position.y-198);c.lineTo(position.x+5,position.y-198);c.fill();}
 }
 draw(state,localId,dt,{remote=false}={}){
  if(!this.db||!state)return;const c=this.ctx,W=1280,H=720;c.setTransform(1,0,0,1,0,0);c.fillStyle='#0b101a';c.fillRect(0,0,this.canvas.width,this.canvas.height);const viewScale=Math.min(this.canvas.width/W,this.canvas.height/H);c.setTransform(viewScale,0,0,viewScale,(this.canvas.width-W*viewScale)/2,(this.canvas.height-H*viewScale)/2);
  const living=state.fighters.filter(f=>f.alive),self=state.fighters.find(f=>f.id===localId),focus=self?.alive?self:living[0]||self;if(!focus)return;
  this.events(state.events);
  let cx=focus.x,cy=focus.y-170,zoom=1.25;
  const nearby=living.filter(f=>f!==focus&&Math.abs(f.x-focus.x)<510&&Math.abs(f.y-focus.y)<230);
  if(nearby.length){const xs=[focus.x,...nearby.map(f=>f.x)],span=Math.max(...xs)-Math.min(...xs);cx=(Math.max(...xs)+Math.min(...xs))/2;zoom=clamp(1040/(span+420),.86,1.23);}
  if(state.phase==='final'||state.phase==='over'&&state.finalIds.length){cx=3100;cy=960;zoom=.87;}
  const ease=1-Math.exp(-dt*5);this.camera.x+=(cx-this.camera.x)*ease;this.camera.y+=(cy-this.camera.y)*ease;this.camera.zoom+=(zoom-this.camera.zoom)*ease;
  const cam=this.camera;cam.x=clamp(cam.x,640/cam.zoom,WORLD.width-640/cam.zoom);cam.y=clamp(cam.y,340/cam.zoom,WORLD.height-250/cam.zoom);
  this.shake*=Math.exp(-dt*18);const sx=this.reduced?0:(Math.random()-.5)*this.shake,sy=this.reduced?0:(Math.random()-.5)*this.shake;
  c.save();c.translate(640+sx,360+sy);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);
  const minX=cam.x-640/cam.zoom,maxX=cam.x+640/cam.zoom,minY=cam.y-360/cam.zoom,maxY=cam.y+360/cam.zoom;
  // Background bands scroll together with the collision map. Repeated art is clipped to each stratum.
  for(const [top,bottom,src] of [[-250,650,'arena.webp'],[650,1280,'royale-city.webp'],[1280,2020,'royale-metro.webp']]){
   if(maxY<top||minY>bottom)continue;const img=this.images.get(src);c.save();c.beginPath();c.rect(minX,top,maxX-minX,bottom-top);c.clip();
   const tileW=1440,tileH=bottom-top;for(let x=Math.floor(minX/tileW)*tileW;x<maxX;x+=tileW)c.drawImage(img,x,top,tileW,tileH);c.fillStyle='#08121b2b';c.fillRect(minX,top,maxX-minX,bottom-top);c.restore();
  }
  const platforms=state.phase==='final'||state.phase==='over'&&state.finalIds.length?[{id:'final',x:2420,y:1120,w:1360,kind:'floor'}]:makePlatforms();
  for(const p of platforms){if(p.x+p.w<minX||p.x>maxX||p.y<minY-30||p.y>maxY+50)continue;
   const gone=state.time>210&&p.y>state.zone.bottom+160||state.time>360&&p.y<state.zone.top-150;if(gone&&state.phase==='battle')continue;
   c.fillStyle=p.kind==='step'?'#37424e':'#242932';c.fillRect(p.x,p.y,p.w,p.kind==='step'?12:22);c.fillStyle=p.kind==='step'?'#dcad67':'#adb2b2';c.fillRect(p.x,p.y,p.w,3);
   if(p.kind==='step'){c.fillStyle='#121b25';for(let x=p.x+5;x<p.x+p.w;x+=28)c.fillRect(x,p.y+4,15,4);}
  }
  for(const w of state.walls){if(w.hp<=0)continue;c.fillStyle='#3b4350';c.fillRect(w.x,w.y-w.h,w.w,w.h);c.strokeStyle='#9a8582';c.lineWidth=2;c.strokeRect(w.x,w.y-w.h,w.w,w.h);c.fillStyle='#e9b674';c.fillRect(w.x+4,w.y-w.h+7,(w.w-8)*Math.max(0,w.hp)/65,3);if(w.hp<30){c.strokeStyle='#e6a573';c.beginPath();c.moveTo(w.x+9,w.y-w.h);c.lineTo(w.x+25,w.y-w.h*.5);c.lineTo(w.x+4,w.y);c.stroke();}}
  for(const l of state.loot){if(Math.abs(l.x-cam.x)>900||Math.abs(l.y-cam.y)>500)continue;const y=l.y-25+Math.sin(state.time*3+l.x)*5;c.shadowColor='#b597ff';c.shadowBlur=14;c.fillStyle='#d9c5ff';c.save();c.translate(l.x,y);c.rotate(Math.PI/4);c.fillRect(-9,-9,18,18);c.restore();c.shadowBlur=0;
   if(self?.alive&&Math.abs(self.x-l.x)<125&&Math.abs(self.y-l.y)<80){c.fillStyle='#f3e9ff';c.font='700 12px system-ui';c.textAlign='center';c.fillText('E · '+PERKS[l.perk].name,l.x,y-24);}
  }
  for(const f of state.fighters){
   const old=this.positions.get(f.id)||{x:f.x,y:f.y};const amount=remote?Math.min(1,dt*22):1;
   old.x+= (f.x-old.x)*amount;old.y+=(f.y-old.y)*amount;if(Math.hypot(old.x-f.x,old.y-f.y)>650){old.x=f.x;old.y=f.y;}this.positions.set(f.id,old);
   if(Math.abs(old.x-cam.x)>900||Math.abs(old.y-cam.y)>650)continue;
   if(f.onGround){c.fillStyle='#0006';c.beginPath();c.ellipse(old.x,old.y+2,38,5,0,0,6.28);c.fill();}
   this.drawFighter(f,old,state.time,localId);
  }
  for(const p of state.projectiles){const grad=c.createRadialGradient(p.x,p.y,0,p.x,p.y,24);grad.addColorStop(0,'#f3f5ff');grad.addColorStop(.3,'#90eaff');grad.addColorStop(1,'#48aaff00');c.fillStyle=grad;c.beginPath();c.arc(p.x,p.y,24,0,6.28);c.fill();c.strokeStyle='#70c7ff88';c.lineWidth=8;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-Math.sign(p.vx)*50,p.y);c.stroke();}
  for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;c.globalAlpha=p.life/p.max;c.strokeStyle=p.color;c.fillStyle=p.color;
   if(p.ring){c.lineWidth=6*p.life/p.max;c.beginPath();c.arc(p.x,p.y,p.radius*(1-p.life/p.max),0,6.28);c.stroke();}
   else if(p.text){c.font='900 22px system-ui';c.textAlign='center';c.fillText(p.text,p.x,p.y-(1-p.life/p.max)*30);}
   else if(p.streak)c.fillRect(p.x-70,p.y-10,140,4);
   else c.fillRect(p.x,p.y,4,4);
  }c.globalAlpha=1;
  if(state.phase==='battle'){
   const z=state.zone;c.fillStyle='#230c486e';c.fillRect(minX,minY,Math.max(0,z.left-minX),maxY-minY);c.fillRect(z.right,minY,Math.max(0,maxX-z.right),maxY-minY);c.fillRect(Math.max(minX,z.left),minY,Math.min(maxX,z.right)-Math.max(minX,z.left),Math.max(0,z.top-minY));c.fillRect(Math.max(minX,z.left),z.bottom,Math.min(maxX,z.right)-Math.max(minX,z.left),Math.max(0,maxY-z.bottom));
   c.strokeStyle='#bb83ffa0';c.lineWidth=3;for(const x of [z.left,z.right]){c.beginPath();c.moveTo(x,minY);for(let y=minY;y<maxY;y+=25)c.lineTo(x+Math.sin(y*.04+state.time*6)*7,y);c.stroke();}
  }
  c.restore();
  const shade=c.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#05081166');shade.addColorStop(.25,'#05081100');shade.addColorStop(.8,'#05081100');shade.addColorStop(1,'#05081188');c.fillStyle=shade;c.fillRect(0,0,W,H);
 }
 drawMinimap(canvas,state,localId){const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.fillStyle='#0e1421';c.fillRect(0,0,w,h);c.strokeStyle='#ffffff24';for(const y of [520,1120,1740]){c.beginPath();c.moveTo(0,y/WORLD.height*h);c.lineTo(w,y/WORLD.height*h);c.stroke();}const z=state.zone;c.strokeStyle='#bb9bf9';c.strokeRect(z.left/WORLD.width*w,z.top/WORLD.height*h,(z.right-z.left)/WORLD.width*w,(z.bottom-z.top)/WORLD.height*h);for(const f of state.fighters)if(f.alive){c.fillStyle=f.id===localId?'#c5ff7f':'#faaa85';c.beginPath();c.arc(f.x/WORLD.width*w,f.y/WORLD.height*h,f.id===localId?3.5:2,0,6.28);c.fill();}}
}
