// Select complete drawings. No frame crossfades or deformation of individual limbs.
export const wrapCycle=t=>(t%1+1)%1;
export function sequenceFrame(frames,progress){return frames[Math.min(frames.length-1,Math.max(0,Math.floor(progress*frames.length)))];}
export function locomotionPose(f,anims){
 const idle=anims.idle||[];
 if(!f.alive)return anims.crouch.at(-1);
 if(f.dashTime>0&&anims.dash?.length){
  // The impulse finishes on the low gliding pose; recovery has its own drawings.
  const t=f.dashElapsed||0,index=t<.027?0:t<.069?1:t<.132?2:3;return anims.dash[index];
 }
 if(!f.onGround)return anims.jump[f.vy< -360?1:f.vy<180?2:3];
 if(f.dashRecovery>0&&anims.stop?.length)return sequenceFrame(anims.stop,1-f.dashRecovery/.14);
 if(f.land>0)return anims.crouch[1];
 if(f.state==='crouch')return anims.crouch.at(-1);
 if(f.stopTime>0&&anims.stop?.length)return sequenceFrame(anims.stop,1-f.stopTime/.16);
 if(f.state==='run'&&anims.run?.length)return sequenceFrame(anims.run,wrapCycle(f.runPhase||0));
 if(f.state==='walk')return sequenceFrame(anims.walk||anims.run,wrapCycle((f.walkPhase||0)/6.283));
 return sequenceFrame(idle,wrapCycle((f.stateTime||0)*1.25));
}
