import {RoyaleMatch} from './engine.js';
import {RoyaleRenderer} from './renderer.js';
import {OnlineRoom,sanitizeMember} from './network.js';
import {CHARACTERS,PERKS,RULES,inputEmpty,clamp,zoneName} from './world.js';
import {FightMusic} from '../music.js';
import {mountTouch} from '../touch.js';

const $=id=>document.getElementById(id);
const renderer=new RoyaleRenderer($('world'));
let ready=false,selected='chamo',mode='setup',match=null,state=null,room=null,localId='p0';
let paused=false,remotePaused=false,menu=false,busy=false,lastFrame=performance.now(),accumulator=0;
let lastSend=0,lastStateSend=0,lastHud=0,lastPing=0,lastInput=inputEmpty(),lastGamepadPause=false;
let audio=null,music=null,muted=false,finalMusic=false,lastAudioEvent=0,choiceSignature='',perkSignature='',feedSignature='',resultShown=false;
let notice=null,onlinePing=null;
const keys=new Set(),touch=new Set(),pulses=new Set(),pendingEdges=new Set();
const keyMap={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyS:'down',ArrowDown:'down',KeyW:'up',ArrowUp:'up',Space:'jump',KeyF:'light',KeyG:'heavy',KeyH:'special',KeyJ:'guard',ShiftLeft:'dash',ShiftRight:'dash',KeyR:'burst',KeyQ:'super',KeyE:'interact',Digit1:'choice1',Digit2:'choice2',Digit3:'choice3'};
const clock=s=>{s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const say=text=>{$('live').textContent=text;};
function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function setStatus(text){$('connection-status').textContent=text;}
function setBusy(value){busy=value;for(const id of ['solo','create','join-open'])$(id).disabled=!ready||busy;}
function member(){return sanitizeMember({name:$('player-name').value,character:selected});}
function resetInputs(){keys.clear();touch.clear();pulses.clear();pendingEdges.clear();lastInput=inputEmpty();resetStick();for(const b of $('touch-controls').querySelectorAll('.pressed'))b.classList.remove('pressed');}
function showNotice(title,detail='',seconds=1.7){notice={title,detail,until:performance.now()+seconds*1000};say(title+' '+detail);}
function setTouch(){const coarse=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;$('touch-controls').hidden=!(mode==='match'&&coarse&&!menu&&!remotePaused&&state?.phase!=='over'&&state?.fighters.find(f=>f.id===localId)?.alive);}
function selectCharacter(id){selected=id;for(const b of $('roster').children)b.setAttribute('aria-pressed',String(b.dataset.character===id));const d=CHARACTERS[id];$('fighter-style').textContent=d.name+' · '+d.style;$('fighter-passive').textContent=d.passive;}
for(const [id,d] of Object.entries(CHARACTERS)){
 const b=element('button','fighter-choice');b.type='button';b.dataset.character=id;b.setAttribute('aria-label',d.name+', '+d.style);b.setAttribute('aria-pressed',String(id===selected));
 const img=element('img');img.src='assets/'+id+'-portrait.webp';img.alt='';b.append(img,element('span','',d.name));b.addEventListener('click',()=>selectCharacter(id));$('roster').append(b);
}
try{const saved=JSON.parse(localStorage.getItem('osf-royale')||'{}');if(saved.name)$('player-name').value=sanitizeMember(saved).name;if(CHARACTERS[saved.character])selectCharacter(saved.character);}catch{}
function savePreferences(){try{localStorage.setItem('osf-royale',JSON.stringify(member()));}catch{}}

async function unlockAudio(){
 if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio=new Audio();music=new FightMusic(audio);}
 try{await audio.resume();}catch{}updateMusic();
}
function tone(freq=.1,duration=.1,type='sine',volume=.04,end=freq){
 if(!audio||muted||audio.state!=='running')return;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();};
}
function updateMusic(){if(!music)return;music.setPlaying(!muted&&mode==='match'&&!!state&&!paused&&!remotePaused&&state.phase!=='over');if(music.source)music.source.playbackRate.value=finalMusic?1.16:1;}
function audioEvents(events){for(const e of events||[]){if(e.id<=lastAudioEvent)continue;lastAudioEvent=e.id;
 if(e.type==='hit')tone(125,.11,'triangle',.095,43);
 if(e.type==='block')tone(340,.08,'square',.025,120);
 if(e.type==='parry'){tone(1100,.18,'sine',.075,1900);if(e.actor===localId)showNotice('PARRY','Contraataca',.65);}
 if(e.type==='burst')tone(115,.38,'sawtooth',.04,620);
 if(e.type==='super')tone(310,.45,'sawtooth',.045,42);
 if(e.type==='wallbreak')tone(65,.25,'sawtooth',.06,24);
 if(e.type==='perk'&&e.actor===localId){tone(700,.2,'sine',.045,1100);say('Técnica equipada: '+PERKS[e.perk].name);}
 if(e.type==='level'&&e.actor===localId)tone(500,.3,'triangle',.045,1300);
 if(e.type==='final'){finalMusic=true;music?.reset();updateMusic();say('Duelo final. Quedan dos luchadores.');}
 if(e.type==='elimination'){tone(240,.3,'triangle',.055,70);if(e.target===localId)say('Eliminado. Puesto '+e.place+'. Puedes observar el resto de la partida.');}
}}
$('sound').addEventListener('click',()=>{muted=!muted;$('sound').textContent=muted?'♫̸':'♪';$('sound').setAttribute('aria-pressed',String(muted));$('sound').setAttribute('aria-label',muted?'Activar música y efectos':'Silenciar música y efectos');if(!muted)unlockAudio();updateMusic();});

const resetStick=mountTouch($('touch-controls'),touch,()=>mode==='match'&&!menu&&!remotePaused);
function acceptsInput(){return mode==='match'&&!menu&&!remotePaused&&!$('help-dialog').open&&state?.phase!=='over';}
window.addEventListener('keydown',e=>{
 if(e.target.closest?.('input,textarea'))return;
 if(e.code==='Escape'&&!e.repeat&&mode==='match'&&!$('help-dialog').open){e.preventDefault();toggleMenu();return;}
 const control=keyMap[e.code];if(!control||!acceptsInput())return;e.preventDefault();keys.add(e.code);if(!e.repeat)pulses.add(control);if(control==='up'&&!e.repeat)pulses.add('jump');
});
window.addEventListener('keyup',e=>{keys.delete(e.code);});
function readInput(){
 const i=inputEmpty();if(!acceptsInput())return i;
 for(const key of keys){const control=keyMap[key];if(control)i[control]=true;}for(const key of touch)i[key]=true;
 const pad=Array.from(navigator.getGamepads?.()||[]).find(g=>g?.connected&&g.mapping==='standard');
 if(pad){
  const b=n=>!!pad.buttons[n]?.pressed,ax=pad.axes[0]||0,ay=pad.axes[1]||0;
  i.left||=ax<-.3;i.right||=ax>.3;i.down||=ay>.5;i.up||=ay<-.5;
  for(const [key,n] of Object.entries({jump:0,special:1,light:2,heavy:3,guard:4,dash:5,burst:6,super:7,interact:13,choice1:14,choice2:12,choice3:15}))i[key]||=b(n);
 }
 i.jump||=i.up;return i;
}
function pollPause(){const pad=Array.from(navigator.getGamepads?.()||[]).find(g=>g?.connected&&g.mapping==='standard');const pressed=!!pad?.buttons[9]?.pressed;if(pressed&&!lastGamepadPause&&mode==='match')toggleMenu();lastGamepadPause=pressed;}
function toggleMenu(force){
 if(mode!=='match'||state?.phase==='over')return;menu=force===undefined?!menu:force;paused=menu&&(!room||room.host);$('pause-panel').hidden=!menu;
 $('pause-title').textContent=room&&!room.host?'MENÚ':'PAUSA';$('pause-note').textContent=room?(room.host?'La partida está pausada para toda la sala.':'El combate sigue en marcha mientras tienes abierto este menú.'):'Tómate un respiro. La CPU también está pausada.';
 $('quit').textContent=room?.host?'Cerrar sala y salir':'Salir de la partida';resetInputs();updateMusic();setTouch();if(room?.host&&state)room.sendState(state,paused);
 if(!menu){unlockAudio();$('stage').focus({preventScroll:true});}
}
$('pause').addEventListener('click',()=>toggleMenu());$('resume').addEventListener('click',()=>toggleMenu(false));$('quit').addEventListener('click',()=>goSetup());
window.addEventListener('blur',()=>{resetInputs();if(mode==='match'&&(!room||room.host)&&state?.phase!=='over')toggleMenu(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInputs();if(mode==='match'&&(!room||room.host))toggleMenu(true);}else lastFrame=performance.now();});
$('help').addEventListener('click',()=>{if(mode==='match')toggleMenu(true);$('help-dialog').showModal();});
for(const id of ['help-close','help-done'])$(id).addEventListener('click',()=>$('help-dialog').close());
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('br-game').requestFullscreen();}catch{showNotice('PANTALLA COMPLETA','Usa el menú de tu navegador.',2);}});
new ResizeObserver(()=>renderer.resize()).observe($('stage'));
window.addEventListener('resize',()=>{renderer.resize();setTouch();});

function prepareMatch(isRemote=false){
 mode='match';menu=false;paused=false;remotePaused=false;resultShown=false;accumulator=0;lastStateSend=0;lastSend=0;lastAudioEvent=0;finalMusic=false;notice=null;choiceSignature=perkSignature=feedSignature='';
 renderer.positions.clear();renderer.particles=[];renderer.seenEvent=0;renderer.shake=0;const f=state?.fighters.find(f=>f.id===localId);renderer.camera={x:f?.x||450,y:(f?.y||1120)-170,zoom:1.15};
 for(const id of ['setup','waiting','pause-panel','result','choices'])$(id).hidden=true;$('hud').hidden=false;$('stage').classList.add('playing');resetInputs();setTouch();renderer.resize();$('stage').focus({preventScroll:true});unlockAudio();updateHud();if(isRemote)room.lastState=performance.now();
}
function startSolo(){if(!ready)return;savePreferences();room?.close();room=null;localId='p0';match=new RoyaleMatch([{id:localId,...member()}],{bots:true});state=match.snapshot();prepareMatch();}
$('solo').addEventListener('click',startSolo);
function goSetup(message=''){
 room?.close();room=null;match=null;state=null;mode='setup';paused=remotePaused=menu=false;notice=null;resetInputs();setBusy(false);setStatus(message);music?.reset();
 for(const id of ['hud','waiting','pause-panel','result','choices','announcement','warning','spectating','touch-controls'])$(id).hidden=true;$('setup').hidden=false;$('stage').classList.remove('playing');renderer.ctx.clearRect(0,0,$('world').width,$('world').height);$('solo').focus({preventScroll:true});
}
function networkCallbacks(instance){return {
 lobby:()=>{if(room===instance)renderLobby();},
 error:message=>{if(room===instance)goSetup(message);},
 playerLeft:id=>{const f=match?.fighter(id);if(f){f.bot=true;f.name=f.name.slice(0,12)+' · CPU';match.emit('disconnect',{actor:id});showNotice('RIVAL DESCONECTADO','Su luchador pasa a CPU.',2);}},
 start:data=>{if(room!==instance)return;localId=instance.id;state=data.state;match=null;prepareMatch(true);},
 state:(next,hostPaused)=>{if(room!==instance)return;state=next;const changed=remotePaused!==hostPaused;remotePaused=hostPaused;if(changed){resetInputs();setTouch();updateMusic();}},
 ping:ms=>{onlinePing=ms;}
};}
async function createRoom(){
 savePreferences();setBusy(true);setStatus('Creando sala…');const instance=new OnlineRoom();room=instance;instance.callbacks=networkCallbacks(instance);
 try{await unlockAudio();await instance.create(member());if(room!==instance)return;localId=instance.id;showLobby();}
 catch(e){if(room===instance)goSetup(e.message);}
}
async function joinRoom(code){
 savePreferences();setBusy(true);setStatus('Conectando con la sala…');const instance=new OnlineRoom();room=instance;instance.callbacks=networkCallbacks(instance);
 try{await unlockAudio();await instance.join(code,member());if(room!==instance)return;localId=instance.id;showLobby();}
 catch(e){if(room===instance)goSetup(e.message);}
}
function showLobby(){mode='waiting';$('setup').hidden=true;$('waiting').hidden=false;setBusy(false);setStatus('');renderLobby();}
function renderLobby(){
 if(!room)return;$('room-code').textContent=room.code;$('members').replaceChildren();
 for(const m of room.members){const e=element('div','member'),img=element('img');img.src='assets/'+m.character+'-portrait.webp';img.alt='';const info=element('div');info.append(element('strong','',m.name+(m.id===room.id?' · TÚ':'')),element('small','',CHARACTERS[m.character].name+(m.host?' · ANFITRIÓN':'')));e.append(img,info);$('members').append(e);}
 $('fill-label').hidden=!room.host;$('start-room').hidden=!room.host;$('start-room').disabled=room.members.length<2&&!$('fill-bots').checked;
 $('waiting-note').textContent=room.host?room.members.length+' / 8 conectados. '+($('fill-bots').checked?'El resto de plazas serán CPU.':'Se necesitan al menos dos jugadores.'):'Esperando a que el anfitrión empiece. '+room.members.length+' / 8 conectados.';
}
$('create').addEventListener('click',createRoom);
$('join-open').addEventListener('click',()=>{$('join-dialog').showModal();$('join-code').focus();});
$('join-close').addEventListener('click',()=>$('join-dialog').close());
$('join-form').addEventListener('submit',e=>{e.preventDefault();const code=$('join-code').value;$('join-dialog').close();joinRoom(code);});
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(room.code);$('copy-code').textContent='Copiado';setTimeout(()=>{$('copy-code').textContent='Copiar';},1600);}catch{$('copy-code').textContent='Selecciona el código';}});
$('fill-bots').addEventListener('change',renderLobby);$('leave-room').addEventListener('click',()=>goSetup());
$('start-room').addEventListener('click',()=>{if(!room?.host)return;try{localId=room.id;match=new RoyaleMatch(room.members,{bots:$('fill-bots').checked});state=match.snapshot();room.start({state});prepareMatch();}catch(e){$('waiting-note').textContent=e.message;}});
$('again').addEventListener('click',()=>{if(room)goSetup('Crea una sala nueva para la revancha.');else startSolo();});
window.addEventListener('pagehide',()=>room?.close());

function renderChoices(f){
 let title='',options=[];
 if(f.reward){title='ELIMINACIÓN · ELIGE TU RECOMPENSA';options=[{name:'Absorber energía',text:'+32 de vida'},{name:'Robar técnica',text:PERKS[f.reward.perk].name},{name:'Cargar Ki',text:'+48 de Ki'}];}
 else if(f.lootOffer){title=PERKS[f.lootOffer].name.toUpperCase()+' · REEMPLAZA UNA TÉCNICA';options=f.perks.map(p=>PERKS[p]);}
 else if(f.offers.length){title='NIVEL '+f.level+' · ELIGE UNA TÉCNICA';options=f.offers[0].map(p=>PERKS[p]);}
 const signature=JSON.stringify([title,options]);$('choices').hidden=!options.length||!f.alive||state.phase==='over';if(signature===choiceSignature)return;choiceSignature=signature;$('choice-title').textContent=title;$('choice-options').replaceChildren();
 for(const [n,o] of options.entries()){const b=element('button','choice');const strong=element('strong');strong.append(element('kbd','',String(n+1)),document.createTextNode((o.icon?o.icon+' ':'')+o.name));b.append(strong,element('small','',o.text));b.addEventListener('click',()=>{if(!menu)pulses.add('choice'+(n+1));$('stage').focus({preventScroll:true});});$('choice-options').append(b);}
}
function showResult(){
 if(resultShown)return;resultShown=true;menu=false;paused=false;$('pause-panel').hidden=true;$('result').hidden=false;$('choices').hidden=true;const self=state.fighters.find(f=>f.id===localId),winner=state.fighters.find(f=>f.id===state.winner);
 $('result-eyebrow').textContent=winner?'ÚLTIMO EN PIE · '+winner.name:'FIN DEL COMBATE';$('result-title').textContent=state.winner===localId?'VICTORIA':state.winner?'FIN DE PARTIDA':'EMPATE';$('result-stats').textContent='Puesto '+(self?.place||'—')+' / '+state.fighters.length+' · '+(self?.kills||0)+' eliminaciones · '+clock(state.time);$('rankings').replaceChildren();
 for(const f of [...state.fighters].sort((a,b)=>(a.place||99)-(b.place||99))){const row=element('div','ranking'+(f.id===localId?' self':''));row.append(element('b','',String(f.place||'—')),element('span','',f.name),element('span','',f.kills+' KO'));$('rankings').append(row);}
 $('again').textContent=room?'VOLVER A LAS SALAS':'OTRA PARTIDA';say($('result-title').textContent+'. '+$('result-stats').textContent);setTouch();updateMusic();
}
function updateHud(){
 if(!state)return;const self=state.fighters.find(f=>f.id===localId);if(!self)return;
 $('self-name').textContent=self.name;$('self-level').textContent='NV. '+self.level;
 for(const key of ['hp','guard','ki','burst']){const value=clamp(self[key],0,100);$(key+'-meter').firstElementChild.style.width=value+'%';$(key+'-meter').setAttribute('aria-valuenow',String(Math.round(value)));$(key+'-value').textContent=Math.ceil(value);}
 const sig=self.perks.join(',');if(sig!==perkSignature||!$('perks').children.length){perkSignature=sig;$('perks').replaceChildren();for(let n=0;n<3;n++){const perk=PERKS[self.perks[n]],e=element('span','perk-slot'+(perk?'':' empty'),perk?.icon||'+');e.title=perk?perk.name+': '+perk.text:'Técnica disponible';e.setAttribute('aria-label',e.title);$('perks').append(e);}}
 $('fury').hidden=!self.fury;$('fury').textContent='FURY ×'+(self.fury+1);
 $('alive').textContent=state.fighters.filter(f=>f.alive).length;$('zone-name').textContent=state.phase==='final'?'FINAL DUEL':zoneName(self.y);$('time').textContent=clock(state.phase==='final'?RULES.finalSeconds-Math.max(0,state.phaseTime-2.4):state.time);
 $('zone-next').textContent=state.phase==='final'?'Arena final · Sin tormenta':state.time<45?'Tormenta en '+Math.ceil(45-state.time)+' s':state.time>=435?'Zona mínima · Busca el duelo':'Cierre '+(state.zone.phase+1)+' · '+Math.max(0,Math.ceil(state.zone.next-state.time))+' s';
 $('network-label').textContent=room?(room.host?'ONLINE · ANFITRIÓN':'ONLINE'+(onlinePing!==null?' · '+onlinePing+' MS':'')):'TÚ + 7 CPU';renderer.drawMinimap($('minimap'),state,localId);
 const newFeed=JSON.stringify(state.killFeed);if(feedSignature!==newFeed){feedSignature=newFeed;$('killfeed').replaceChildren();for(const kill of state.killFeed){const div=element('div');div.append(element('b','',kill.killer),document.createTextNode('  ›  '+kill.victim));$('killfeed').append(div);}}
 const outside=self.x<state.zone.left||self.x>state.zone.right||self.y-60<state.zone.top||self.y>state.zone.bottom;$('warning').hidden=!self.alive||!outside||state.phase!=='battle'||!!self.reward||!!self.offers.length;
 $('spectating').hidden=self.alive||state.phase==='over';$('spectating').textContent='PUESTO '+self.place+' · OBSERVANDO EL COMBATE';renderChoices(self);setTouch();
 if(state.phase==='over')showResult();
}
function renderAnnouncement(now){
 let title='',detail='';
 if(state?.phase==='countdown'){title=String(Math.max(1,Math.ceil(3-state.phaseTime)));detail='PREPÁRATE';}
 else if(remotePaused&&!menu){title='PAUSA';detail='El anfitrión ha pausado la partida.';}
 else if(state?.phase==='final'&&state.phaseTime<2.4){title='FINAL DUEL';detail=state.finalIds.map(id=>state.fighters.find(f=>f.id===id)?.name||'').join('  vs  ');}
 else if(state?.phase==='battle'&&state.time<1.2){title='¡LUCHA!';detail='Sobrevive a la ciudad';}
 else if(notice&&now<notice.until){({title,detail}=notice);}
 else {const self=state?.fighters.find(f=>f.id===localId);if(self?.alive&&self.chaseTime>0){title='CHASE';detail='SHIFT / DASH';}}
 const node=$('announcement');node.hidden=!title||menu||state?.phase==='over';if(node.dataset.title!==title||node.dataset.detail!==detail){node.dataset.title=title;node.dataset.detail=detail;node.replaceChildren(document.createTextNode(title));if(detail)node.append(element('small','',detail));}
}
function frame(now){
 const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;pollPause();
 if(mode==='match'&&state){
  const input=readInput();for(const [key,value] of Object.entries(input))if(value&&!lastInput[key])pendingEdges.add(key);for(const key of pulses)pendingEdges.add(key);pulses.clear();lastInput=input;
  if(room&&!room.host){
   if(now-lastSend>=50||pendingEdges.size){room.sendInput(input,[...pendingEdges]);pendingEdges.clear();lastSend=now;}
   if(now-lastPing>2000){room.ping();lastPing=now;}
   if(now-room.lastState>12000){goSetup('No llegan datos del anfitrión. La sala se ha desconectado.');requestAnimationFrame(frame);return;}
  }else if(match){
   if(!paused){accumulator+=dt;while(accumulator>=1/60){const inputs=room?.consumeInputs()||{};inputs[localId]={...input,pressed:[...pendingEdges]};pendingEdges.clear();match.step(1/60,inputs);match.drain();accumulator-=1/60;}state=match.snapshot();}
   else{accumulator=0;pendingEdges.clear();}
   if(room?.host&&(now-lastStateSend>=50)){room.sendState(state,paused);lastStateSend=now;}
  }
  renderer.draw(state,localId,paused||remotePaused?0:dt,{remote:!!room&&!room.host});audioEvents(state.events);renderAnnouncement(now);
  if(now-lastHud>80){updateHud();lastHud=now;}updateMusic();
 }
 requestAnimationFrame(frame);
}
renderer.load().then(()=>{ready=true;$('loading').textContent=Object.keys(CHARACTERS).length+' LUCHADORES';setBusy(false);renderer.resize();}).catch(e=>{$('loading').textContent='Error de carga';setStatus(e.message+' Recarga la página para intentarlo de nuevo.');});
requestAnimationFrame(frame);
