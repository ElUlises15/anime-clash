import Phaser from 'phaser';
import type {CharacterDef} from '../characters/types';
import {FX,type FighterState,type MatchState,type PlayerIndex} from '../game/sim/types';
import {GROUND_Y} from '../ui/sceneData';
import {Rig} from './rig/Rig';
import {registerVisualDefinition} from './visualRegistry';
import {makePortraitTexture} from './portrait';
import {samplePose} from './rig/poses';
export class FighterView {
 readonly rig:Rig;private shadow:Phaser.GameObjects.Ellipse;private aura:Phaser.GameObjects.Graphics;private lastHp=-1;private flash=0;private ghosts:Rig[]=[];
 constructor(private scene:Phaser.Scene,readonly def:CharacterDef,readonly index:PlayerIndex){this.shadow=scene.add.ellipse(0,GROUND_Y,92,18,0x101321,.35).setDepth(9);this.aura=scene.add.graphics().setDepth(10);this.rig=new Rig(scene,def.id,def.visuals);this.rig.container.setDepth(20+index);registerVisualDefinition(def);makePortraitTexture(scene,def,`cutin:${def.id}`,384);for(let i=0;i<3;i++){const ghost=new Rig(scene,def.id,def.visuals);ghost.container.setDepth(18).setVisible(false);this.ghosts.push(ghost);}}
 get container(){return this.rig.container;}
 setDepth(depth:number){this.container.setDepth(depth);return this;}
 update(f:FighterState,state:MatchState){const x=f.x/FX,y=GROUND_Y-f.y/FX;this.container.setPosition(x,y).setScale(f.facing*this.def.visuals.heightPx/210,this.def.visuals.heightPx/210);this.rig.setForm(f.form);
 const move=f.moveId?Object.values(this.def.moves).find(m=>m?.id===f.moveId):undefined;this.rig.pose(samplePose(this.def.visuals,f.anim,f.animFrame,move?move.startup+move.active+move.recovery:undefined));
 if(this.lastHp>=0&&f.hp<this.lastHp)this.flash=6;this.lastHp=f.hp;if(this.flash>0){this.rig.tint(0xffffff);this.container.setAlpha(.85+((this.flash--%2)*.15));}else {this.rig.clearTint();this.container.setAlpha(f.invulnFrames>0&&state.frame%6<2?.45:1);}
 this.shadow.setPosition(x,GROUND_Y+5).setScale(Math.max(.4,1-f.y/FX/600)).setAlpha(f.grounded?.35:.18);
 for(let i=0;i<this.ghosts.length;i++){const ghost=this.ghosts[i];const active=['dash','backdash','teleport'].includes(f.anim);ghost.container.setVisible(active);if(active){ghost.setForm(f.form);ghost.pose(samplePose(this.def.visuals,f.anim,f.animFrame));ghost.tint(Phaser.Display.Color.HexStringToColor(this.def.visuals.vfx.trail).color);ghost.container.setPosition(x-f.facing*(i+1)*22,y).setScale(f.facing*this.def.visuals.heightPx/210,this.def.visuals.heightPx/210).setAlpha(.18-i*.045);}}
 this.aura.clear();if(f.form||['ultimate','transform','special1','special2','beam'].includes(f.anim)){const color=Phaser.Display.Color.HexStringToColor(f.form?this.def.visuals.forms?.[f.form]?.palette?.aura??this.def.visuals.palette.aura:this.def.visuals.palette.aura).color;for(let layer=0;layer<3;layer++){this.aura.fillStyle(color,.045+layer*.025);this.aura.beginPath();this.aura.moveTo(x-55+layer*7,y);for(let i=0;i<=12;i++){const angle=Math.PI+i*Math.PI/12;const wobble=Math.sin(state.frame*.18+i*2)*12;this.aura.lineTo(x+Math.cos(angle)*(65-layer*9+wobble),y+Math.sin(angle)*(220-layer*18+wobble));}this.aura.closePath();this.aura.fillPath();}for(let i=0;i<8;i++){const t=(state.frame*3+i*31)%210;this.aura.fillStyle(color,1-t/210);this.aura.fillEllipse(x+Math.sin(i*7+state.frame*.04)*48,y-t,3,9);}}
 }
 destroy(){this.ghosts.forEach(g=>g.destroy());this.rig.destroy();this.shadow.destroy();this.aura.destroy();}
}
