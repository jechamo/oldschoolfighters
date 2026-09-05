// Pointer capture supports a thumb on the stick and several action buttons at once.
export function joystickDirection(dx,dy,radius){
 const distance=Math.hypot(dx,dy),limit=Math.min(1,radius/Math.max(1,distance));
 return {x:dx*limit,y:dy*limit,left:dx< -radius*.28,right:dx>radius*.28,up:dy< -radius*.46,down:dy>radius*.46};
}
export function mountTouch(root,inputs,enabled){
 const stick=root.querySelector('.joystick'),knob=root.querySelector('.joystick-knob');let pointer=null;
 const resetStick=()=>{pointer=null;for(const key of ['left','right','up','down'])inputs.delete(key);knob.style.transform='translate(0px,0px)';stick.classList.remove('pressed');};
 const move=e=>{
  const rect=stick.getBoundingClientRect(),radius=rect.width*.36,d=joystickDirection(e.clientX-rect.left-rect.width/2,e.clientY-rect.top-rect.height/2,radius);
  knob.style.transform=`translate(${d.x}px,${d.y}px)`;
  for(const key of ['left','right','up','down']){if(d[key])inputs.add(key);else inputs.delete(key);}
 };
 stick.addEventListener('pointerdown',e=>{if(!enabled()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(pointer);stick.classList.add('pressed');move(e);});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();move(e);}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===pointer)resetStick();});
 for(const button of root.querySelectorAll('[data-control]')){
  const pointers=new Set();button.addEventListener('pointerdown',e=>{if(!enabled())return;e.preventDefault();pointers.add(e.pointerId);button.setPointerCapture(e.pointerId);inputs.add(button.dataset.control);button.classList.add('pressed');});
  const release=e=>{pointers.delete(e.pointerId);if(!pointers.size){inputs.delete(button.dataset.control);button.classList.remove('pressed');}};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
 }
 root.addEventListener('contextmenu',e=>e.preventDefault());
 return resetStick;
}
