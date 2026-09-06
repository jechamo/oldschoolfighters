import {INPUT_KEYS,CHARACTERS,inputEmpty} from './world.js';
export const PROTOCOL=2;
export function sanitizeInput(data){const held=inputEmpty();for(const key of INPUT_KEYS)held[key]=data?.held?.[key]===true;return {held,pressed:Array.isArray(data?.pressed)?data.pressed.filter(k=>INPUT_KEYS.includes(k)).slice(0,8):[],seq:Number.isSafeInteger(data?.seq)?data.seq:0};}
export function sanitizeMember(m){return {name:String(m?.name||'Luchador').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,18)||'Luchador',character:CHARACTERS[m?.character]?m.character:'chamo'};}
let peerLibrary;
async function getPeer(){
 if(globalThis.Peer)return globalThis.Peer;
 if(!peerLibrary)peerLibrary=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';script.crossOrigin='anonymous';
  const timer=setTimeout(()=>{script.remove();peerLibrary=null;reject(Error('No se ha podido cargar la conexión online. Puedes jugar contra CPU.'));},14000);
  script.onload=()=>{clearTimeout(timer);if(globalThis.Peer)resolve(globalThis.Peer);else{peerLibrary=null;reject(Error('La conexión online no está disponible.'));}};
  script.onerror=()=>{clearTimeout(timer);peerLibrary=null;reject(Error('No se ha podido cargar la conexión online. Comprueba tu conexión.'));};document.head.append(script);
 });return peerLibrary;
}
const message=e=>({ 'peer-unavailable':'No se encuentra esa sala. Comprueba el código y que el anfitrión siga conectado.', 'unavailable-id':'Ese código ya está ocupado. Crea otra sala.', 'network':'No hay conexión con el servicio de salas.', 'browser-incompatible':'Este navegador no permite conexiones de juego. Prueba con Chrome o Firefox.', 'webrtc':'No se ha podido conectar con el otro dispositivo. Algunas redes bloquean estas conexiones.' }[e?.type]||'Se ha interrumpido la conexión online.');
export class OnlineRoom {
 constructor(callbacks={}){this.callbacks=callbacks;this.peer=null;this.connections=new Map();this.members=[];this.inputs=new Map();this.started=false;this.closed=false;this.host=false;this.id=null;this.code='';this.seq=0;this.lastState=performance.now();this.paused=false;this.pending=[];}
 async openPeer(id){
  const Peer=await getPeer();if(this.closed)throw Error('Conexión cancelada.');
  return new Promise((resolve,reject)=>{
   const peer=this.peer=id?new Peer(id,{debug:0}):new Peer({debug:0});let ready=false;
   const timeout=setTimeout(()=>{peer.destroy();reject(Error('La conexión tardó demasiado. Inténtalo de nuevo.'));},15000);
   peer.on('open',()=>{ready=true;clearTimeout(timeout);resolve(peer);});
   peer.on('error',e=>{clearTimeout(timeout);if(!ready)reject(Error(message(e)));else this.callbacks.error?.(message(e));});
   peer.on('disconnected',()=>{if(!this.closed&&!peer.destroyed)peer.reconnect();});
  });
 }
 async create(member){
  this.host=true;this.id='p0';const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',values=crypto.getRandomValues(new Uint8Array(8));this.code=[...values].map(n=>alphabet[n%alphabet.length]).join('');
  const peer=await this.openPeer('osfbr-'+PROTOCOL+'-'+this.code);this.members=[{id:this.id,...sanitizeMember(member),bot:false,host:true}];
  peer.on('connection',conn=>{
   let playerId=null;
   conn.on('open',()=>{
    if(this.started||this.members.length>=8||conn.metadata?.protocol!==PROTOCOL){conn.send({type:'rejected',message:this.started?'La partida ya ha empezado.':'La sala está llena o tiene otra versión.'});setTimeout(()=>conn.close(),200);return;}
    playerId='p'+crypto.getRandomValues(new Uint32Array(1))[0].toString(36);this.connections.set(playerId,conn);
    this.members.push({id:playerId,...sanitizeMember(conn.metadata),bot:false});conn.send({type:'welcome',id:playerId,code:this.code});this.broadcastLobby();
   });
   conn.on('data',data=>{
    if(!playerId||!data||typeof data!=='object')return;
    if(data.type==='input'){
     const clean=sanitizeInput(data),last=this.inputs.get(playerId);if(last&&clean.seq<=last.seq)return;
     this.inputs.set(playerId,{...clean,pressed:[...(last?.pressed||[]),...clean.pressed].slice(-16),at:performance.now()});
    }
    if(data.type==='ping'&&Number.isFinite(data.at))conn.send({type:'pong',at:data.at});
   });
   conn.on('close',()=>{if(!playerId)return;this.connections.delete(playerId);this.inputs.delete(playerId);if(!this.started){this.members=this.members.filter(m=>m.id!==playerId);this.broadcastLobby();}else this.callbacks.playerLeft?.(playerId);});
   conn.on('error',()=>conn.close());
  });
  this.broadcastLobby();return this;
 }
 async join(code,member){
  this.code=String(code).toUpperCase().replace(/[^A-Z2-9]/g,'');if(this.code.length!==8)throw Error('Introduce los 8 caracteres del código.');
  const peer=await this.openPeer();
  return new Promise((resolve,reject)=>{
   const conn=peer.connect('osfbr-'+PROTOCOL+'-'+this.code,{reliable:true,serialization:'json',metadata:{...sanitizeMember(member),protocol:PROTOCOL}});this.connection=conn;
   const timeout=setTimeout(()=>{conn.close();reject(Error('No se ha podido entrar. Comprueba el código o prueba otra red.'));},18000);
   conn.on('data',data=>{
    if(!data||typeof data!=='object')return;
    if(data.type==='welcome'){this.id=data.id;clearTimeout(timeout);resolve(this);}
    else if(data.type==='rejected'){clearTimeout(timeout);reject(Error(data.message));}
    else if(data.type==='lobby'){this.members=data.members;this.callbacks.lobby?.(this.members);}
    else if(data.type==='start'){this.started=true;this.callbacks.start?.(data);}
    else if(data.type==='state'){this.lastState=performance.now();this.paused=!!data.paused;this.callbacks.state?.(data.state,this.paused);}
    else if(data.type==='pong')this.callbacks.ping?.(Math.round(performance.now()-data.at));
   });
   conn.on('close',()=>{clearTimeout(timeout);if(!this.closed){if(!this.id)reject(Error('La sala se ha cerrado.'));else this.callbacks.error?.('El anfitrión ha cerrado la sala. La partida online ha terminado.');}});
   conn.on('error',e=>{clearTimeout(timeout);if(!this.id)reject(Error(message(e)));else this.callbacks.error?.(message(e));});
  });
 }
 broadcast(data){for(const conn of this.connections.values())if(conn.open&&conn.bufferSize<3)conn.send(data);}
 broadcastLobby(){this.broadcast({type:'lobby',members:this.members});this.callbacks.lobby?.(this.members);}
 start(config){if(!this.host||this.started)return;this.started=true;this.broadcast({type:'start',...config});}
 sendInput(input,pressed=[]){if(this.host||!this.connection?.open)return;this.connection.send({type:'input',held:input,pressed,seq:++this.seq});}
 consumeInputs(){const result={};for(const [id,data] of this.inputs){result[id]=performance.now()-data.at>500?inputEmpty():{...data.held,pressed:[...data.pressed]};data.pressed=[];}return result;}
 sendState(state,paused){this.broadcast({type:'state',state,paused});}
 ping(){if(this.connection?.open)this.connection.send({type:'ping',at:performance.now()});}
 close(){this.closed=true;for(const conn of this.connections.values())conn.close();this.connection?.close();this.peer?.destroy();this.connections.clear();}
}
