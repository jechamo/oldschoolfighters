// Original eight-bar arcade loop. Synthesized locally; no music downloads or trackers.
export class FightMusic {
 constructor(context){this.context=context;this.output=context.createGain();this.output.gain.value=.19;this.output.connect(context.destination);this.source=null;this.offset=0;this.startedAt=0;this.buffer=null;}
 compose(){
  const c=this.context,rate=c.sampleRate,bpm=132,beat=60/bpm,bar=beat*4,length=bar*8;
  const buffer=c.createBuffer(1,Math.ceil(length*rate),rate),out=buffer.getChannelData(0);
  const add=(at,duration,frequency,volume,kind='bass')=>{
   const start=Math.floor(at*rate),count=Math.floor(duration*rate);
   let filter=0,seed=12345+start;
   for(let j=0;j<count&&start+j<out.length;j++){
    const t=j/rate,p=j/count,attack=Math.min(1,t/.008),release=Math.min(1,(duration-t)/.04);let wave;
    if(kind==='kick'){wave=Math.sin(2*Math.PI*(44*t+10*(1-Math.exp(-t*24))))*Math.exp(-t*17);}
    else if(kind==='snare'||kind==='hat'){
     seed=(seed*1664525+1013904223)>>>0;const noise=seed/2147483648-1;filter+=.18*(noise-filter);
     wave=(noise-filter)*Math.exp(-t*(kind==='hat'?65:22));if(kind==='snare')wave+=Math.sin(t*2*Math.PI*180)*Math.exp(-t*35)*.28;
    }else{
     const phase=t*frequency;
     if(kind==='bass')wave=(2*Math.abs(2*(phase%1)-1)-1)*.75+Math.sin(2*Math.PI*phase)*.25;
     else if(kind==='lead')wave=Math.sin(2*Math.PI*phase)*.7+Math.sin(4*Math.PI*phase)*.2+Math.sin(6*Math.PI*phase)*.1;
     else wave=Math.sin(2*Math.PI*phase)*.7+Math.sin(2*Math.PI*phase*1.003)*.3;
     wave*=attack*release*(kind==='pad'?.7:Math.exp(-p*2));
    }
    out[start+j]+=wave*volume;
   }
  };
  const hz=n=>440*2**((n-69)/12),roots=[40,40,36,38,40,43,36,38];
  const melody=[0,7,12,7,10,7,3,7,0,7,15,12,10,7,3,2];
  for(let b=0;b<8;b++){
   const root=roots[b],at=b*bar;
   for(let s=0;s<16;s++){
    const t=at+s*beat/4;
    if(s%4===0||s===10)add(t,.26,0,.78,'kick');
    if(s===4||s===12)add(t,.20,0,.31,'snare');
    if(s%2===0)add(t,.075,0,s%4===0?.12:.20,'hat');
    if(s%2===0)add(t,beat*.43,hz(root+(s===14?7:0)),.32,'bass');
    if(s%2===0){const n=root+24+melody[(s/2+(b%2)*8)%16];add(t,beat*.65,hz(n),.15,'lead');add(t+beat*.75,beat*.55,hz(n),.035,'lead');}
   }
   for(const n of [root+12,root+15,root+19])add(at,bar*.93,hz(n),.07,'pad');
  }
  for(let i=0;i<out.length;i++)out[i]=Math.tanh(out[i]*.85);
  return buffer;
 }
 setPlaying(playing){
  if(playing===!!this.source)return;
  const c=this.context;
  if(playing){
   this.buffer ||= this.compose();const source=c.createBufferSource();source.buffer=this.buffer;source.loop=true;source.connect(this.output);
   this.output.gain.cancelScheduledValues(c.currentTime);this.output.gain.setValueAtTime(0,c.currentTime);this.output.gain.linearRampToValueAtTime(.19,c.currentTime+.15);
   this.startedAt=c.currentTime;source.start(0,this.offset%this.buffer.duration);this.source=source;
  }else if(this.source){
   this.offset=(this.offset+c.currentTime-this.startedAt)%this.buffer.duration;
   this.output.gain.cancelScheduledValues(c.currentTime);this.output.gain.setTargetAtTime(0,c.currentTime,.025);
   const old=this.source;old.stop(c.currentTime+.12);old.onended=()=>old.disconnect();this.source=null;
  }
 }
 reset(){this.setPlaying(false);this.offset=0;}
}
