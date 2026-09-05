import { activeMove, MOVES } from './engine.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mod=(v,n)=>((v%n)+n)%n;

export class SpriteLibrary {
 constructor(db){this.db=db;this.sources=new Map();this.frames=new Map();this.ready=new Map();}
 async source(src){
  if(!this.sources.has(src))this.sources.set(src,new Promise((resolve,reject)=>{
   const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('No se ha podido cargar un personaje.'));im.src='assets/'+src;
  }));return this.sources.get(src);
 }
 async frame(id){
  if(!this.frames.has(id))this.frames.set(id,(async()=>{
   const def=this.db.frames[id],im=await this.source(def.src);
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
   const ctx=canvas.getContext('2d');ctx.drawImage(im,...def.box,...(def.place||[0,0,512,512]));
   return {id,canvas};
  })());return this.frames.get(id);
 }
 async character(def){
  if(!this.ready.has(def.id))this.ready.set(def.id,Promise.all([...new Set(Object.values(def.anims).flat())].map(k=>this.frame(k))));
  return this.ready.get(def.id);
 }
 async resolve(){this.resolvedFrames=new Map(await Promise.all([...this.frames].map(async([k,v])=>[k,await v])));}
}

// Each frame is a complete drawing. Never blend silhouettes or warp one limb into another.
export function poseKey(f){
 const a=f.def.anims,guard=a.idle[0];
 if(f.action==='punch'){
  const seq=f.punchIndex===3?a.hook:f.punchIndex===2?a.cross:a.punch;
  const m=activeMove(f),t=f.actionTime;
  if(t<m.active*.35)return seq[0];
  if(t<m.active)return seq[1];
  if(t<m.end)return seq[2];
  if(t<m.duration-.045)return seq[3];
  return seq[0];
 }
 if(f.action==='kick'){
  const t=f.actionTime/MOVES.kick.duration,s=a.kick;
  if(t<.09)return guard;if(t<.25)return s[0];if(t<.41)return s[1];
  if(t<.57)return s[2];if(t<.72)return s[1];if(t<.87)return s[3];return guard;
 }
 if(f.jumpPrep>0)return a.jump[0];
 if(f.y>0)return f.jumpTime<.10?a.jump[1]:a.jump[2];
 if(f.land>0&&f.state!=='walk')return f.land>.075?a.jump[3]:guard;
 if(f.state==='ko')return a.crouch.at(-1);
 if(f.crouch>.12)return a.crouch[Math.min(a.crouch.length-1,Math.round(f.crouch*(a.crouch.length-1)))];
 if(f.state==='walk')return a.walk[Math.floor(mod(f.walkPhase/(Math.PI*2)*a.walk.length,a.walk.length))];
 return guard;
}

export class FighterRenderer {
 constructor(canvas,lib){this.canvas=canvas;this.lib=lib;this.ctx=canvas.getContext('2d');}
 clear(){const c=this.ctx;c.setTransform(this.canvas.width/1280,0,0,this.canvas.height/720,0,0);c.clearRect(0,0,1280,720);}
 pose(f){return poseKey(f);}
 draw(f,{x=f.x,y=598-f.y,scale=1,time=0,dim=1}={}){
  const key=poseKey(f),frame=this.lib.resolvedFrames.get(key);if(!frame)return;
  const bounds=this.lib.db.frames[key].bounds;
  if(f.y>0)y=Math.max(y,12-(bounds[1]-448)*scale);
  const c=this.ctx;c.save();c.translate(x,y);c.scale(f.facing*scale,scale);
  // Subtle breathing moves the whole torso uniformly with a fixed floor anchor.
  const breath=f.state==='idle'?1+Math.sin(time*2.6)*.003:1;c.scale(1,breath);
  if(f.state==='hit')c.rotate(-Math.sin(clamp(f.stateTime/.22,0,1)*Math.PI)*.045);
  c.globalAlpha=dim;if(f.flash>0)c.filter=`brightness(${1+Math.min(.45,f.flash*4)})`;c.drawImage(frame.canvas,-256,-448);
  c.restore();
 }
}
