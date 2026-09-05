import { Match, Fighter, emptyInput } from './engine.js';
import { SpriteLibrary, FighterRenderer } from './sprites.js';
import { FightMusic } from './music.js';
import { mountTouch } from './touch.js';

const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const scene=$('arena').getContext('2d'),effects=$('effects').getContext('2d');
const keys=new Set(),touch=new Set(),particles=[];
const keymap=[{left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',punch:'KeyF',kick:'KeyG',block:'KeyH'},
 {left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',punch:'KeyK',kick:'KeyL',block:'KeyO'}];
let lib,renderer,db,background,match,previews=[],screen='loading',mode='cpu',selected=[0,3],target=0;
let paused=false,starting=false,frameTime=0,last=performance.now(),accumulator=0,shake=0,hudTime=0,dpr=1;
let muted=false,audioContext,music,resetStick=()=>{};
try{muted=localStorage.getItem('oldschoolfighters-muted')==='true';}catch{}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

function audioReady(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;try{if(!audioContext){audioContext=new Audio();music=new FightMusic(audioContext);}audioContext.resume().catch(()=>{});}catch{}}
function sound(type){
 if(muted||!audioContext)return;
 const now=audioContext.currentTime,gain=audioContext.createGain();gain.connect(audioContext.destination);
 const osc=audioContext.createOscillator();osc.connect(gain);
 const tone={select:[560,830,.055,.025],swing:[330,80,.09,.025],hit:[120,34,.12,.11],block:[600,260,.075,.045],land:[65,30,.09,.035],jump:[140,300,.10,.018],fight:[420,840,.18,.055],roundover:[90,180,.35,.065],matchover:[360,720,.40,.05]}[type]||[220,100,.08,.03];
 osc.type=type==='hit'||type==='land'?'triangle':'sine';osc.frequency.setValueAtTime(tone[0],now);osc.frequency.exponentialRampToValueAtTime(tone[1],now+tone[2]);
 gain.gain.setValueAtTime(tone[3],now);gain.gain.exponentialRampToValueAtTime(.001,now+tone[2]);osc.start(now);osc.stop(now+tone[2]);
 if(type==='hit'||type==='block'){
  const n=audioContext.createBuffer(1,Math.floor(audioContext.sampleRate*.065),audioContext.sampleRate),v=n.getChannelData(0);
  for(let i=0;i<v.length;i++)v[i]=(Math.random()*2-1)*Math.pow(1-i/v.length,2);
  const source=audioContext.createBufferSource(),g=audioContext.createGain();g.gain.value=type==='hit'?.10:.035;source.buffer=n;source.connect(g);g.connect(audioContext.destination);source.start();
 }
}
function soundButton(){ $('sound').textContent=muted?'♪̸':'♪';$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'Activar sonido':'Silenciar sonido');}
soundButton();
function clearInput(){keys.clear();touch.clear();resetStick();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));if(match)for(const f of match.fighters){f.prev=emptyInput();f.buffer=null;f.bufferTime=0;f.chainQueued=false;}}
function getInput(n){const input=emptyInput();for(const [name,key] of Object.entries(keymap[n]))input[name]=keys.has(key)||(n===0&&touch.has(name));return input;}
function announce(text){$('live').textContent=text;}
function showError(e){
 screen='error';$('loading').hidden=false;$('loading-text').textContent=e.message||'No se ha podido cargar el juego.';$('load-progress').hidden=true;
 const retry=document.createElement('button');retry.className='primary';retry.textContent='Volver a cargar';retry.onclick=()=>location.reload();$('loading').append(retry);$('start').disabled=true;
}
function resize(){
 const rect=$('stage').getBoundingClientRect();dpr=clamp(rect.width*(window.devicePixelRatio||1)/1280,1,2);
 for(const id of ['arena','fighters','effects']){const c=$(id),w=Math.round(1280*dpr),h=Math.round(720*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}}
 scene.setTransform(dpr,0,0,dpr,0,0);effects.setTransform(dpr,0,0,dpr,0,0);
}
new ResizeObserver(resize).observe($('stage'));

function updateSelection(){
 const a=db.characters[selected[0]],b=db.characters[selected[1]];
 $('left-name').textContent=a.name.toUpperCase();$('right-name').textContent=b.name.toUpperCase();$('rival-kind').textContent=mode==='cpu'?'CPU':'JUGADOR 2';
 $('target-0').innerHTML='J1 <span>'+a.name.toUpperCase()+'</span>';$('target-1').innerHTML=(mode==='cpu'?'CPU':'J2')+' <span>'+b.name.toUpperCase()+'</span>';
 [0,1].forEach(n=>{$('target-'+n).classList.toggle('active',target===n);$('target-'+n).setAttribute('aria-pressed',String(target===n));});
 document.querySelectorAll('.fighter-card').forEach((card,i)=>{
  card.dataset.j1=String(selected[0]===i);card.dataset.j2=String(selected[1]===i);card.setAttribute('aria-pressed',String(selected[target]===i));
  const marker=card.querySelector('.marker');marker.textContent=selected[0]===i&&selected[1]===i?'J1 / '+(mode==='cpu'?'CPU':'J2'):selected[0]===i?'J1':mode==='cpu'?'CPU':'J2';marker.hidden=selected[0]!==i&&selected[1]!==i;
 });
 previews=[new Fighter(a,350,1),new Fighter(b,930,-1)];
}
function setMode(m){
 mode=m;for(const k of ['cpu','local']){$('mode-'+k).classList.toggle('active',m===k);$('mode-'+k).setAttribute('aria-pressed',String(m===k));}
 $('difficulty-label').hidden=m==='local';$('match-note').textContent=m==='local'?'2 jugadores · Un mismo teclado':'Gana 2 rondas · 60 segundos';updateSelection();
}
function lobby(){
 music?.reset();
 screen='lobby';match=null;paused=false;clearInput();particles.length=0;shake=0;document.body.classList.remove('playing');
 ['selection-title','versus','names','lobby'].forEach(id=>$(id).hidden=false);
 ['hud','announcement','pause-panel','result-panel','touch-controls'].forEach(id=>$(id).hidden=true);
 updateSelection();$('start').focus({preventScroll:true});resize();
}
async function start(){
 if(starting||screen==='loading'||screen==='error')return;
 starting=true;const a=db.characters[selected[0]],b=db.characters[selected[1]];
 $('start').disabled=true;$('loading').hidden=false;$('loading-text').textContent='Preparando el combate…';$('load-progress').removeAttribute('value');
 try{
  audioReady();music?.reset();await Promise.all([lib.character(a),lib.character(b)]);await lib.resolve();
  match=new Match(a,b,{mode,difficulty:$('difficulty').value});screen='fight';paused=false;accumulator=0;particles.length=0;shake=0;clearInput();
  ['selection-title','versus','names','lobby','pause-panel','result-panel','loading'].forEach(id=>$(id).hidden=true);$('hud').hidden=false;
  $('hud-name-0').textContent=a.name.toUpperCase();$('hud-name-1').textContent=b.name.toUpperCase();$('opponent-label').textContent=mode==='cpu'?'CPU':'J2';
  $('touch-controls').hidden=!(matchMedia('(any-pointer: coarse)').matches||navigator.maxTouchPoints>0);
  document.body.classList.add('playing');$('stage').focus({preventScroll:true});resize();updateHUD();announce(a.name+' contra '+b.name+'. Ronda 1.');
 }catch(e){showError(e);}finally{starting=false;$('start').disabled=false;}
}
function pause(value=true){if(screen!=='fight'||match.phase==='over')return;paused=value;if(value)music?.setPlaying(false);clearInput();accumulator=0;$('pause-panel').hidden=!value;if(value){$('resume').focus({preventScroll:true});announce('Combate en pausa.');}else{$('stage').focus({preventScroll:true});last=performance.now();}}
function updateHUD(){
 if(!match)return;
 match.fighters.forEach((f,n)=>{
  const health=$('health-'+n);health.querySelector('.hp').style.transform='scaleX('+f.hp/100+')';health.querySelector('.trail').style.transform='scaleX('+f.healthTrail/100+')';health.setAttribute('aria-valuenow',String(Math.round(f.hp)));
  if($('rounds-'+n).dataset.wins!==String(f.wins)){$('rounds-'+n).innerHTML=[0,1].map(i=>'<i class="'+(i<f.wins?'won':'')+'"></i>').join('');$('rounds-'+n).dataset.wins=String(f.wins);$('rounds-'+n).setAttribute('aria-label',f.wins+' rondas ganadas');}
 });
 $('round').textContent='RONDA '+match.round;$('timer').textContent=Math.ceil(match.timer).toString().padStart(2,'0');$('timer').parentElement.classList.toggle('low',match.timer<10);
 let html='';
 if(match.phase==='intro')html=match.phaseTime<1.2?'RONDA '+match.round+'<small>EL PRIMERO EN GANAR 2 RONDAS</small>':'¡LUCHA!';
 if(match.phase==='roundover')html=match.roundWinner===null?'EMPATE':match.fighters.some(f=>f.hp<=0)?'K. O.':'¡TIEMPO!';
 if($('announcement').innerHTML!==html)$('announcement').innerHTML=html;$('announcement').hidden=!html||paused;
}
function eventEffects(e){
 sound(e.type);
 if(e.type==='hit'||e.type==='block'){
  if(!reduced)shake=e.type==='hit'?4:1.5;
  const color=e.type==='block'?'#a6dbec':'#ffe8ad';
  for(let i=0;i<(e.type==='block'?9:16);i++){const angle=Math.PI*2*i/16+Math.random()*.2,speed=70+Math.random()*180;particles.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.2+Math.random()*.15,max:.35,color,type:'spark'});}
  particles.push({x:e.x,y:e.y,life:.20,max:.20,color,type:'ring'});
  if(e.combo>=2)particles.push({x:e.side===0?270:1010,y:180,life:.7,max:.7,color:'#f6f1d9',text:e.combo+' GOLPES',type:'text'});
 }
 if(e.type==='land')for(let i=0;i<6;i++)particles.push({x:e.x+(Math.random()-.5)*50,y:601,vx:(Math.random()-.5)*70,vy:-Math.random()*20,life:.28,max:.28,color:'#adb8b9',type:'dust'});
 if(e.type==='roundover')announce(e.winner===null?'Ronda empatada.':match.fighters[e.winner].def.name+' gana la ronda.');
 if(e.type==='matchover'){
  const win=match.fighters[e.winner];$('result-panel').hidden=false;$('winner-title').textContent=win.def.name.toUpperCase()+' GANA';$('score').textContent=match.fighters[0].wins+' — '+match.fighters[1].wins;$('rematch').focus({preventScroll:true});announce(win.def.name+' gana el combate.');clearInput();
 }
}

function drawScene(dt){
 const isLobby=screen==='lobby'||screen==='loading'||screen==='error';
 const sx=reduced?0:(Math.random()-.5)*shake,sy=reduced?0:(Math.random()-.5)*shake*.4;
 scene.clearRect(0,0,1280,720);
 if(background){scene.drawImage(background,0,0,1280,isLobby?550:720);if(isLobby){scene.fillStyle='#141c22';scene.fillRect(0,550,1280,170);}}
 const shade=scene.createLinearGradient(0,0,0,720);shade.addColorStop(0,'#0d152977');shade.addColorStop(.38,'#09131d05');shade.addColorStop(1,'#08111755');scene.fillStyle=shade;scene.fillRect(0,0,1280,720);
 scene.fillStyle='#edc08144';for(let i=0;i<18;i++){const x=(i*97+frameTime*(7+i%4))%1280,y=250+((i*47)%230)+Math.sin(frameTime*.6+i)*12;scene.globalAlpha=.18+.15*Math.sin(frameTime+i);scene.beginPath();scene.arc(x,y,1.1,0,Math.PI*2);scene.fill();}scene.globalAlpha=1;
 const fs=isLobby?previews:match?.fighters||[];
 if(renderer)renderer.clear();
 fs.forEach((f,i)=>{
  const x=isLobby?f.x:f.px+(f.x-f.px)*clamp(accumulator/(1/120),0,1),y=isLobby?452:598-(f.py+(f.y-f.py)*clamp(accumulator/(1/120),0,1)),scale=isLobby?.91:1;
  if(isLobby){f.stateTime+=dt;scene.save();scene.translate(x,455);scene.scale(1,.23);const glow=scene.createRadialGradient(0,0,15,0,0,165);glow.addColorStop(0,i===0?'#b9fa634c':'#f2a96c45');glow.addColorStop(1,'#ffffff00');scene.fillStyle=glow;scene.beginPath();scene.arc(0,0,165,0,Math.PI*2);scene.fill();scene.restore();}
  scene.save();scene.fillStyle='#02080c';scene.globalAlpha=isLobby?.5:.32*(1-f.y/450);scene.beginPath();scene.ellipse(x+sx,isLobby?454:602+sy,(isLobby?65:63)*(1-f.y/560),8,0,0,Math.PI*2);scene.fill();scene.restore();
  renderer?.draw(f,{x:x+sx,y:y+sy,scale,time:isLobby?frameTime:match.elapsed,dim:f.hp<=0?.83:1});
 });
 effects.clearRect(0,0,1280,720);
 if(!paused)shake*=Math.exp(-dt*23);
 for(let i=particles.length-1;i>=0;i--){
  const p=particles[i];if(!paused){p.life-=dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;if(p.type==='spark')p.vy+=130*dt;}
  if(p.life<=0){particles.splice(i,1);continue;}
  effects.globalAlpha=clamp(p.life/p.max,0,1);effects.strokeStyle=p.color;effects.fillStyle=p.color;
  if(p.type==='ring'){effects.lineWidth=4*p.life/p.max;effects.beginPath();effects.arc(p.x,p.y,8+(1-p.life/p.max)*36,0,Math.PI*2);effects.stroke();}
  else if(p.type==='text'){effects.font='italic 25px Impact, sans-serif';effects.textAlign='center';effects.fillText(p.text,p.x,p.y-(1-p.life/p.max)*14);}
  else if(p.type==='dust'){effects.beginPath();effects.ellipse(p.x,p.y,8*(1-p.life/p.max),3,0,0,Math.PI*2);effects.fill();}
  else{effects.lineWidth=2.2;effects.beginPath();effects.moveTo(p.x,p.y);effects.lineTo(p.x-p.vx*.035,p.y-p.vy*.035);effects.stroke();}
 }
 effects.globalAlpha=1;
}
function tick(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;frameTime+=dt;
 music?.setPlaying(screen==='fight'&&match?.phase==='fight'&&!paused&&!muted&&!document.hidden);
 if(match&&!paused&&!$('help-dialog').open){
  accumulator+=dt;const inputs=[getInput(0),getInput(1)];
  while(accumulator>=1/120){match.step(1/120,inputs);accumulator-=1/120;}
  match.drain().forEach(eventEffects);hudTime+=dt;if(hudTime>.035){updateHUD();hudTime=0;}
 }else accumulator=0;
 drawScene(dt);requestAnimationFrame(tick);
}

$('start').onclick=start;$('rematch').onclick=start;$('roster-return').onclick=lobby;$('quit').onclick=lobby;
$('target-0').onclick=()=>{if(starting)return;target=0;updateSelection();};$('target-1').onclick=()=>{if(starting)return;target=1;updateSelection();};
$('mode-cpu').onclick=()=>{if(!starting)setMode('cpu');};$('mode-local').onclick=()=>{if(!starting)setMode('local');};
$('pause').onclick=()=>pause(true);$('resume').onclick=()=>pause(false);
$('sound').onclick=()=>{try{audioReady();}catch{}muted=!muted;try{localStorage.setItem('oldschoolfighters-muted',String(muted));}catch{}soundButton();sound('select');};
$('help').onclick=()=>{if(match&&match.phase!=='over')pause(true);clearInput();$('help-dialog').showModal();};
$('close-help').onclick=$('help-done').onclick=()=>$('help-dialog').close();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('game').requestFullscreen)await $('game').requestFullscreen();else announce('Tu navegador no ofrece pantalla completa.');}catch{announce('No se ha podido activar la pantalla completa.');}};
window.addEventListener('keydown',e=>{
 if($('help-dialog').open)return;
 if(e.code==='Escape'&&screen==='fight'){e.preventDefault();if(!e.repeat)pause(!paused);return;}
 if(screen!=='fight'||paused||match?.phase==='over')return;
 if(Object.values(keymap[0]).includes(e.code)||Object.values(keymap[1]).includes(e.code)){e.preventDefault();keys.add(e.code);}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{clearInput();if(screen==='fight')pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){music?.setPlaying(false);clearInput();pause(true);}});
resetStick=mountTouch($('touch-controls'),touch,()=>screen==='fight'&&!paused&&match?.phase!=='over');

async function init(){
 try{
  const response=await fetch('assets/fighters.json');if(!response.ok)throw Error('No se han podido cargar los personajes.');db=await response.json();lib=new SpriteLibrary(db);
  background=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('No se ha podido cargar el escenario.'));im.src='assets/arena.webp';});
  let loaded=0;await Promise.all(db.characters.map(async(def,i)=>{
   const frame=await lib.frame(def.anims.idle[0]);
   const card=document.createElement('button');card.className='fighter-card';card.setAttribute('aria-label','Elegir a '+def.name);card.dataset.index=i;
   const canvas=document.createElement('canvas');canvas.width=280;canvas.height=224;canvas.setAttribute('aria-hidden','true');
   const ctx=canvas.getContext('2d');ctx.drawImage(frame.canvas,140,140,250,215,0,0,280,240);card.append(canvas);
   const name=document.createElement('span');name.className='card-name';name.textContent=def.name.toUpperCase();card.append(name);
   const marker=document.createElement('span');marker.className='marker';card.append(marker);
   card.onclick=()=>{if(starting)return;selected[target]=i;try{audioReady();sound('select');}catch{}updateSelection();announce(def.name+' seleccionado para '+(target===0?'jugador 1':'el rival'));};
   db.characters[i]._card=card;$('load-progress').value=++loaded;
  }));
  for(const def of db.characters)$('roster').append(def._card);
  await lib.resolve();renderer=new FighterRenderer($('fighters'),lib);screen='lobby';$('loading').hidden=true;$('start').disabled=false;updateSelection();resize();
  requestAnimationFrame(tick);
 }catch(e){showError(e);drawScene(0);}
}
init();
