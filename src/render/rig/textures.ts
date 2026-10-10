import Phaser from 'phaser';
import type {CharacterVisuals,Palette} from './types';
export type Part='torso'|'pelvis'|'upperArm'|'lowerArm'|'hand'|'openHand'|'upperLeg'|'lowerLeg'|'boot'|'head'|'hair'|'bangs'|'neck';
export const PARTS:Part[]=['torso','pelvis','upperArm','lowerArm','hand','openHand','upperLeg','lowerLeg','boot','head','hair','bangs','neck'];
export function textureParts(scene:Phaser.Scene,id:string,v:CharacterVisuals,form:string|null=null):Record<Part,string>{
 const p:Palette={...v.palette,...(form?v.forms?.[form]?.palette:{})}; const hair=(form?v.forms?.[form]?.hair:undefined)??v.hair;
 const result={} as Record<Part,string>;const ninja=v.accessories.some(a=>a.kind==='headband');
 for(const part of PARTS){const key=`rig:${id}:${form??'base'}:${part}`;result[part]=key;if(scene.textures.exists(key))continue;
 const tex=scene.textures.createCanvas(key,384,384)!;const c=tex.context;c.scale(3,3);c.translate(64,32);c.lineWidth=2.8;c.lineJoin='round';c.lineCap='round';c.strokeStyle=p.outline;
 const poly=(points:number[][],fill:string,stroke=true)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke)c.stroke();};
 const line=(pts:number[][],color=p.outline,width=1.5)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();c.strokeStyle=p.outline;c.lineWidth=2.8;};
 const ellipse=(x:number,y:number,rx:number,ry:number,fill:string)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();c.stroke();};
 if(part==='neck'){poly([[-7,-9],[7,-9],[8,5],[-8,5]],p.skin);poly([[-7,-9],[-1,-7],[2,4],[-7,4]],p.skinShade,false);}
 if(part==='torso'){
 poly([[-22,0],[-12,-7],[12,-7],[23,1],[18,24],[14,48],[-15,48],[-20,25]],ninja?'#232b39':p.top);
 poly([[-19,8],[-7,17],[-3,46],[-15,47]],p.topShade,false);poly([[7,8],[20,7],[16,46],[4,46]],p.top,false);
 if(ninja){poly([[-8,-4],[8,-4],[10,5],[-10,5]],'#343c4c');line([[0,7],[0,45]],'#d9d8cf',2);line([[3,14],[3,43]],p.topShade,1);ellipse(-13,17,5,5,p.accent);line([[-14,14],[-10,17],[-14,20]],'#6c252a',1);}
 else{poly([[-12,-5],[0,10],[12,-5],[7,17],[-4,17]],p.undershirt??p.boots);line([[-18,2],[-4,22],[6,12]],p.outline,2);ellipse(12,22,7,7,'#fff2dc');line([[9,19],[15,24],[9,24],[13,18]],p.outline,1.3);line([[-10,32],[-3,29],[-8,41]],p.topShade);}
 }
 if(part==='pelvis'){poly([[-16,0],[16,0],[20,18],[8,23],[0,16],[-9,24],[-20,18]],p.pants);poly([[-16,0],[16,0],[16,6],[-16,7]],p.belt??p.boots);if(!ninja)poly([[3,4],[10,4],[18,29],[8,22]],p.belt??p.boots);}
 if(part==='upperArm'){poly([[-10,0],[-6,-5],[7,-4],[12,7],[8,27],[2,32],[-7,28]],ninja?p.top:p.skin);poly([[-9,3],[-4,5],[-2,29],[-7,27]],ninja?p.topShade:p.skinShade,false);if(!ninja)poly([[-11,-2],[9,-3],[12,10],[5,14],[-10,10]],p.top);line([[5,15],[2,21],[4,27]],ninja?p.topShade:p.skinShade,1.4);}
 if(part==='lowerArm'){poly([[-7,0],[7,0],[8,10],[5,28],[-5,28],[-8,10]],ninja?p.top:p.skin);poly([[-7,2],[-3,3],[-2,26],[-5,27]],ninja?p.topShade:p.skinShade,false);poly([[-6,21],[6,21],[6,28],[-6,28]],p.wrist??p.boots);}
 if(part==='hand'||part==='openHand'){poly(part==='hand'?[[-5,0],[5,0],[8,5],[6,13],[-4,14],[-8,7]]:[[-5,0],[4,0],[9,-8],[12,-7],[10,4],[15,0],[17,2],[10,12],[0,16],[-7,8]],p.skin);line([[-4,5],[4,5],[4,10]],p.skinShade,1);}
 if(part==='upperLeg'){poly([[-11,0],[10,0],[13,12],[8,38],[-6,40],[-12,23]],p.pants);poly([[-10,2],[-5,10],[-2,37],[-6,38],[-11,22]],p.pantsShade,false);line([[7,9],[3,18],[7,28]],p.pantsShade);}
 if(part==='lowerLeg'){poly([[-8,0],[8,0],[10,12],[6,37],[-6,37],[-9,15]],p.pants);poly([[-8,5],[-2,14],[-2,36],[-6,36]],p.pantsShade,false);line([[6,12],[2,20],[5,24]],p.pantsShade);}
 if(part==='boot'){poly([[-7,-7],[7,-7],[8,8],[16,13],[19,19],[-9,19],[-10,11]],p.boots);poly([[-8,9],[8,13],[18,16],[18,19],[-9,19]],p.bootsShade??'#142541',false);line([[-6,-3],[6,-3]],ninja?p.skin:p.accent,2);if(ninja){poly([[8,12],[15,14],[17,17],[8,17]],p.skin);line([[11,14],[11,17]],p.skinShade,1);}else{line([[0,-1],[1,10],[9,13]],'#d85145',2);}}
 if(part==='head'){
 ellipse(0,2,18,23,p.skin);poly([[-17,2],[-11,16],[1,24],[-7,23],[-17,12]],p.skinShade,false);ellipse(-17,4,4,6,p.skin);
 c.lineWidth=1;poly([[-12,-1],[-1,1],[-2,7],[-11,6]],'#fff8ed');poly([[4,1],[15,-1],[14,6],[5,7]],'#fff8ed');c.lineWidth=.5;ellipse(-5,3,1.8,2.6,p.eyes);ellipse(9,3,1.8,2.6,p.eyes);c.lineWidth=2.8;c.fillStyle='#fff';c.fillRect(-5,1,1.4,1.4);c.fillRect(9,1,1.4,1.4);
 line([[-12,-4],[-2,-2]],p.outline,2.3);line([[4,-2],[14,-4]],p.outline,2.3);line([[3,6],[5,11],[2,12]],p.skinShade,1.3);line([[-2,17],[6,16]],p.outline,1.3);
 if(ninja){for(let i=0;i<3;i++){line([[-15,9+i*3],[-8,10+i*2]],'#815a52',1);line([[10,10+i*2],[16,8+i*3]],'#815a52',1);}poly([[-18,-11],[17,-11],[18,-4],[-18,-4]],p.belt??p.boots);poly([[-12,-11],[12,-11],[12,-4],[-12,-4]],'#c9d5dc');line([[-3,-8],[0,-10],[3,-7],[0,-5],[-3,-8],[5,-8]],'#53677c',1);}
 }
 if(part==='hair'||part==='bangs'){for(const lock of part==='hair'?hair.locks:hair.bangs??[]){poly(lock.map(([x,y])=>[x*20,y*20]),p.hair);if(part==='hair'){const a=lock[1]??lock[0];poly([[a[0]*20,a[1]*20],[0,-6],[-7,-2]],p.hairShade,false);line([[a[0]*14,a[1]*14],[0,-10]],p.hairHighlight??p.hairShade,1.1);}}}
 tex.refresh();
 }return result;
}
