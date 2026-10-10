import Phaser from 'phaser';
import {FX,type EntityState,type MatchState} from '../game/sim/types';
import type {CharacterDef} from '../characters/types';
import {GROUND_Y} from '../ui/sceneData';
import {visualDefinition} from './visualRegistry';
import {Rig} from './rig/Rig';
import {samplePose} from './rig/poses';
import type {FighterView} from './FighterView';
interface Slot{ id:number;g:Phaser.GameObjects.Graphics;rig?:Rig;owner?:number;seen:boolean;smoke:number;isClone:boolean; }
export class EntityView {
 private pool:Slot[]=[];private defs:CharacterDef[];
 constructor(private scene:Phaser.Scene,defs:CharacterDef[]|FighterView[]=[]){this.defs=defs.map(d=>'def' in d?d.def:d);for(let i=0;i<32;i++)this.pool.push({id:-1,g:scene.add.graphics().setDepth(25).setVisible(false),seen:false,smoke:0,isClone:false});}
 update(entities:EntityState[]|MatchState,state?:MatchState){const list=Array.isArray(entities)?entities:entities.entities;state=Array.isArray(entities)?state:entities;for(const s of this.pool)s.seen=false;
 for(const e of list){let s=this.pool.find(s=>s.id===e.id)??this.pool.find(s=>s.id<0&&s.smoke<=0);if(!s)continue;s.id=e.id;s.seen=true;s.isClone=e.visual==='clone'||e.kind==='summon';const g=s.g;const attached=e.data.attached===true||e.data.attachToOwner===true;const owner=attached?state?.fighters[e.owner]:undefined;g.setAlpha(1).setVisible(true).clear().setPosition(owner?owner.x/FX+owner.facing*65:e.x/FX,owner?GROUND_Y-owner.y/FX-100:GROUND_Y-e.y/FX).setScale(e.facing,1);s.rig?.container.setVisible(false);
 const orb=(x:number,y:number,r:number,color=0x4ddaff)=>{for(let j=3;j>0;j--){g.fillStyle(color,.06*j);g.fillCircle(x,y,r+j*6);}g.fillStyle(color,.9);g.fillCircle(x,y,r);g.fillStyle(0xffffff,1);g.fillCircle(x-r*.15,y-r*.1,r*.55);};
 if(e.visual==='clone'||e.kind==='summon'){const def=this.defs[e.owner]??(state?visualDefinition(state.fighters[e.owner].charId):undefined);if(def){if(!s.rig||s.owner!==e.owner){s.rig?.destroy();s.rig=new Rig(this.scene,def.id,def.visuals);s.owner=e.owner;}s.rig.container.setPosition(e.x/FX,GROUND_Y-e.y/FX).setScale(e.facing*def.visuals.heightPx/190,def.visuals.heightPx/190).setAlpha(.52).setDepth(19).setVisible(true);s.rig.pose(samplePose(def.visuals,e.age%70<45?'walkFwd':'light',e.age));}else{g.fillStyle(0x8edcff,.3);g.fillEllipse(0,-95,60,150);}if(e.age<14||e.life<14)for(let i=0;i<7;i++){g.fillStyle(0xe5e9ef,.24);g.fillCircle(Math.sin(i*9)*35,-i*19,20+(e.age%14));}}
 else if(e.kind==='beam'||e.visual.toLowerCase().includes('kamehameha')){const len=Number(e.data.length??e.w);const h=Math.max(58,e.h);for(let i=3;i>0;i--){g.fillStyle(0x42bfff,.08*i);g.fillRect(0,-h*.5-i*8,len,h+i*16);}g.fillStyle(0x6bdfff,.85);g.beginPath();g.moveTo(0,-h/2);for(let x=0;x<=len;x+=20)g.lineTo(x,-h/2+Math.sin(x*.04+e.age*.6)*5);for(let x=len;x>=0;x-=20)g.lineTo(x,h/2+Math.sin(x*.04+e.age*.6)*5);g.closePath();g.fillPath();g.fillStyle(0xffffff,.95);g.fillRect(0,-h*.22,len,h*.44);orb(0,0,h*.65);orb(len,0,h*.7);}
 else if(e.visual==='kunai'){g.fillStyle(0xc9dfef);g.lineStyle(2,0x152137);g.fillTriangle(-18,0,10,-5,10,5);g.strokeTriangle(-18,0,10,-5,10,5);g.lineStyle(4,0x383447);g.lineBetween(10,0,24,0);g.strokeCircle(29,0,5);}
 else if(e.visual==='rasenshuriken'){const r=Math.max(55,e.w/2);g.lineStyle(3,0xa7f5ff,.8);g.strokeCircle(0,0,r*.8);for(let i=0;i<4;i++){const a=e.age*.4+i*Math.PI/2;const p=(a:number,r:number)=>({x:Math.cos(a)*r,y:Math.sin(a)*r});const a1=p(a,r*1.3),a2=p(a+.5,r*.3),a3=p(a-.5,r*.3);g.fillStyle(0xe9fdff,.9);g.fillTriangle(a1.x,a1.y,a2.x,a2.y,a3.x,a3.y);}orb(0,0,r*.38);}
 else if(e.visual==='rasengan'){orb(0,0,Math.max(28,e.w*.55));for(let i=0;i<4;i++){g.lineStyle(1.5,0xffffff,.7);g.beginPath();g.arc(0,0,10+i*4,e.age*.2+i,e.age*.2+i+Math.PI*1.4);g.strokePath();}}
 else if(e.kind==='shield'){g.lineStyle(3,0x8cecff,.7);g.fillStyle(0x43baff,.12);g.fillEllipse(0,-50,e.w,e.h);g.strokeEllipse(0,-50,e.w,e.h);}
 else if(e.kind==='aoe'||e.visual==='explosion'){orb(0,0,Math.max(e.w,e.h)*.4,0xffb464);g.lineStyle(4,0xffedaf,.7);g.strokeCircle(0,0,Math.max(e.w,e.h)*.55);}
 else if(e.kind==='trap'){g.lineStyle(2,0x9c82ff,.8);g.strokeEllipse(0,0,e.w,18);g.strokeTriangle(-15,0,0,-20,15,0);}
 else{for(let i=4;i>0;i--){g.fillStyle(0x50d8ff,.15/i);g.fillEllipse(-i*12,0,e.w*.7+i*6,e.h*.6);}orb(0,0,Math.max(8,Math.min(e.w,e.h)/2));}
 }
 for(const s of this.pool)if(!s.seen){if(s.id>=0&&s.isClone)s.smoke=18;s.id=-1;s.rig?.container.setVisible(false);if(s.smoke>0){const t=1-s.smoke--/18;s.g.clear().setVisible(true).setAlpha(1-t);for(let i=0;i<8;i++){s.g.fillStyle(0xe3edf5,.24);s.g.fillCircle(Math.sin(i*9)*(20+t*35),-i*18,15+t*20);}}else s.g.setVisible(false);} 
 }
 destroy(){for(const s of this.pool){s.g.destroy();s.rig?.destroy();}}
}
