export const WORLD={width:6200,height:1920,roof:520,street:1120,metro:1740,duration:480};
export const RULES={slots:8,hz:60,gravity:1680,jump:730,body:146,width:46,finalSeconds:75};
export const CHARACTERS={
 chamo:{name:'Chamo',style:'Equilibrado',passive:'Recupera Ki con más rapidez.',speed:310,power:1,kiRate:12,color:'#b9fa63'},
 nacho:{name:'Nacho',style:'Acróbata',passive:'Doble salto y mayor velocidad.',speed:347,power:.94,kiRate:9,doubleJump:true,color:'#79d9fa'},
 pablo:{name:'Pablo',style:'Energía',passive:'Proyectiles más veloces; especiales eficientes.',speed:300,power:1,kiRate:11,specialCost:.82,color:'#efae72'},
 ruffo:{name:'Ruffo',style:'Impacto',passive:'Más empuje y resistencia al retroceso.',speed:278,power:1.08,kiRate:9,weight:1.2,color:'#bdabff'},
 ortega:{name:'Ortega',style:'Contraataque',passive:'Ventana de parry más amplia.',speed:296,power:1,kiRate:10,parry:.07,color:'#ff8c83'},
 luna:{name:'Luna',style:'Aérea',passive:'Dash aéreo de 6 Ki y más control en el aire.',speed:326,power:.95,kiRate:10,airControl:6.5,airDashCost:6,color:'#78e9cf'},
 titan:{name:'Titán',style:'Coloso',passive:'Resiste mejor el retroceso y recupera guardia más rápido.',speed:266,power:1.12,kiRate:8,weight:1.4,guardRate:25,runStride:174,color:'#f9a566'}
};
export const PERKS={
 fire:{name:'Puño incendiario',icon:'🔥',text:'El tercer puño causa quemadura durante 2 s.'},
 electric:{name:'Dash eléctrico',icon:'⚡',text:'Atraviesa rivales y prolonga la invulnerabilidad del dash.'},
 impact:{name:'Impacto',icon:'💥',text:'Los golpes fuertes empujan un 25 % más.'},
 vampire:{name:'Vampirismo',icon:'🩸',text:'Recuperas el 5 % del daño que causas.'},
 parry:{name:'Guardia perfecta',icon:'🛡',text:'Amplía 60 ms la ventana de parry.'},
 charge:{name:'Supercarga',icon:'✦',text:'Generas un 20 % más de Ki.'}
};
export const INPUT_KEYS=['left','right','up','down','jump','light','heavy','special','guard','dash','burst','super','interact','choice1','choice2','choice3'];
export const inputEmpty=()=>Object.fromEntries(INPUT_KEYS.map(k=>[k,false]));
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*.8);
export const zoneName=y=>y<750?'AZOTEAS':y<1370?'LA CALLE':'METRO';
export function makePlatforms(){
 const platforms=[];const add=(id,x,y,w,kind='floor')=>platforms.push({id,x,y,w,kind});
 add('metro',0,1740,6200);
 for(const [i,[x,w]] of [[0,1450],[1680,1500],[3400,1280],[4900,1300]].entries())add('street'+i,x,1120,w);
 for(const [i,[x,w]] of [[160,1250],[1750,1250],[3360,1250],[4920,1100]].entries())add('roof'+i,x,520,w,'roof');
 // Four stairwells connect every stratum; intermediate ledges are one-way.
 for(let j=0;j<4;j++)for(let k=0;k<8;k++)add('stairs'+j+'-'+k,430+j*1510+(k%2)*125,1590-k*145,220,'step');
 return platforms;
}
export function makeWalls(){return [
 {id:'w1',x:1200,y:1120,w:36,h:165,hp:55}, {id:'w2',x:2880,y:1120,w:38,h:170,hp:65},
 {id:'w3',x:4140,y:1120,w:40,h:175,hp:65}, {id:'w4',x:5300,y:1740,w:42,h:165,hp:55},
 {id:'w5',x:2390,y:520,w:36,h:165,hp:55}, {id:'w6',x:3850,y:1740,w:40,h:165,hp:55}
];}
export const SPAWNS=[{x:450,y:1120},{x:5720,y:1120},{x:2110,y:520},{x:3680,y:1740},{x:1000,y:1740},{x:5340,y:520},{x:4050,y:1120},{x:2750,y:1740}];
export const LOOT_SPOTS=[{x:840,y:1120},{x:2180,y:1120},{x:3830,y:1120},{x:5480,y:1120},{x:1070,y:520},{x:2630,y:520},{x:4150,y:520},{x:5600,y:520},{x:570,y:1740},{x:2420,y:1740},{x:4600,y:1740},{x:5770,y:1740}];
export function getZone(time){
 const phase=Math.min(5,Math.floor(Math.max(0,time-45)/75)),t=clamp((time-45)/390,0,1),half=(3100-2850*t)*(1-clamp((time-480)/60,0,1));
 return {left:3100-half,right:3100+half,top:time<330?0:Math.min(890,(time-330)*15),bottom:time<180?1900:Math.max(1240,1900-(time-180)*9),phase,next:time<45?45:45+(phase+1)*75};
}
