import Phaser from 'phaser';
import type {CharacterDef} from '../characters/types';
import type {AnimKey} from '../game/sim/types';
import {textureParts} from './rig/textures';
import {Rig} from './rig/Rig';
import {samplePose} from './rig/poses';
export function makeFullBodyTexture(scene:Phaser.Scene,def:CharacterDef,key:string,heightPx:number,anim:AnimKey='idle',frame=0){if(scene.textures.exists(key))return key;const rig=new Rig(scene,def.id,def.visuals);rig.pose(samplePose(def.visuals,anim,frame));const rt=scene.add.renderTexture(-3000,-3000,heightPx,heightPx+24);rig.container.setScale(heightPx/225);rt.draw(rig.container,heightPx/2,heightPx);rt.saveTexture(key);rt.destroy();rig.destroy();return key;}
export function makePortraitTexture(scene:Phaser.Scene,def:CharacterDef,key:string,size=256){
 if(scene.textures.exists(key))return key;
 const v=def.visuals,p=v.palette,parts=textureParts(scene,def.id,v);const texture=scene.textures.createCanvas(key,size,size)!;const c=texture.context;const cutin=key.startsWith('cutin:');
 if(!cutin){const gradient=c.createLinearGradient(0,0,size,size);gradient.addColorStop(0,'#10152b');gradient.addColorStop(1,'#294566');c.fillStyle=gradient;c.fillRect(0,0,size,size);c.strokeStyle=p.accent;c.lineWidth=size*.016;c.beginPath();c.moveTo(0,size);c.lineTo(size,0);c.stroke();}
 c.save();c.scale(size,size);c.lineJoin='round';c.lineWidth=.018;c.strokeStyle=p.outline;
 const shape=(points:number[][],color:string)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();c.stroke();};
 const armor=v.accessories.some(a=>a.params?.armor),shirt=v.accessories.some(a=>a.params?.openShirt),ninja=v.accessories.some(a=>a.kind==='headband');
 c.beginPath();c.moveTo(.12,.98);c.quadraticCurveTo(.11,.77,.3,.72);c.lineTo(.42,.68);c.lineTo(.59,.68);c.quadraticCurveTo(.84,.71,.9,.95);c.lineTo(.8,1);c.lineTo(.21,1);c.closePath();c.fillStyle=ninja&&!shirt?p.undershirt??p.top:p.top;c.fill();c.stroke();
 shape([[.43,.63],[.57,.63],[.6,.74],[.5,.81],[.4,.74]],p.skin);
 if(shirt){shape([[.3,.71],[.38,.61],[.43,.67],[.47,.95],[.27,1]],p.top);shape([[.62,.61],[.7,.71],[.75,1],[.53,.95],[.57,.67]],p.top);}
 else if(armor){shape([[.27,.74],[.36,.71],[.42,.83],[.6,.83],[.65,.72],[.77,.77],[.75,.98],[.28,.98]],p.top);shape([[.31,.94],[.72,.94],[.73,1],[.3,1]],p.accent);}
 else if(!ninja){shape([[.36,.71],[.5,.83],[.65,.71],[.58,.94],[.44,.94]],p.undershirt??p.boots);}
 else {c.strokeStyle='#d5dfed';c.lineWidth=.012;c.beginPath();c.moveTo(.5,.81);c.lineTo(.5,1);c.stroke();c.strokeStyle=p.accent;c.lineWidth=.022;c.beginPath();c.arc(.73,.83,.047,0,Math.PI*3.3);c.stroke();}
 c.restore();const scale=size/(armor?145:115),cx=size*.5,cy=size*(armor?.53:.49);
 for(const part of ['hair','head','bangs'] as const){const source=scene.textures.get(parts[part]).getSourceImage() as HTMLCanvasElement;c.drawImage(source,cx-96*scale,cy-80*scale,192*scale,192*scale);}
 if(cutin){c.globalCompositeOperation='destination-in';c.beginPath();c.moveTo(0,0);c.lineTo(size,0);c.lineTo(size,size*.88);c.lineTo(0,size);c.closePath();c.fill();c.globalCompositeOperation='source-over';}
 texture.refresh();return key;
}
