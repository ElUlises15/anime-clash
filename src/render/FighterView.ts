import Phaser from 'phaser';
import type {CharacterDef} from '../characters/types';
import {FX,type FighterState,type MatchState,type PlayerIndex} from '../game/sim/types';
import {GROUND_Y} from '../ui/sceneData';
import {Rig} from './rig/Rig';
import {registerVisualDefinition} from './visualRegistry';
import {makePortraitTexture} from './portrait';
import {samplePose} from './rig/poses';
import {spriteSetFor,SPRITE_HEIGHT_MUL,type SpriteSet} from './sprites/sets';
import {ensureSpriteSet} from './sprites/loader';
import {SpriteBody} from './sprites/SpriteBody';
import type {MoveTiming} from './sprites/frameSelect';

/**
 * Fighter renderer. Uses the AI sprite atlas when the character has one (lazy-loaded on first use) and falls back to the
 * procedural cutout rig otherwise (or while/if the atlas fails to load). Same public interface either way.
 */
export class FighterView {
 readonly rig:Rig;private shadow:Phaser.GameObjects.Ellipse;private aura:Phaser.GameObjects.Graphics;private ghosts:Rig[]=[];
 private body:SpriteBody|null=null;private spriteGhosts:SpriteBody[]=[];private readonly spriteSet:SpriteSet|undefined;private destroyed=false;private depth:number;
 /** Last sprite frame shown (debug / tests). */
 lastFrame='';
 constructor(private scene:Phaser.Scene,readonly def:CharacterDef,readonly index:PlayerIndex){this.depth=20+index;this.shadow=scene.add.ellipse(0,GROUND_Y,92,18,0x101321,.35).setDepth(9);this.aura=scene.add.graphics().setDepth(10);this.rig=new Rig(scene,def.id,def.visuals);this.rig.container.setDepth(this.depth);registerVisualDefinition(def);makePortraitTexture(scene,def,`cutin:${def.id}`,384);for(let i=0;i<3;i++){const ghost=new Rig(scene,def.id,def.visuals);ghost.container.setDepth(18).setVisible(false);this.ghosts.push(ghost);}
  this.spriteSet=spriteSetFor(def.id);
  if(this.spriteSet){const set=this.spriteSet;if(!scene.textures.exists(set.atlas))this.rig.container.setVisible(false);ensureSpriteSet(scene,set,ok=>{if(this.destroyed)return;if(ok)this.enableSprites(set);else this.rig.container.setVisible(true);});}
 }
 /** True once the sprite atlas is active for this fighter. */
 get usingSprites(){return !!this.body;}
 private idleHeight(){return this.spriteSet?.idleHeightPx??Math.round(this.def.visuals.heightPx*SPRITE_HEIGHT_MUL);}
 private enableSprites(set:SpriteSet){
  this.body=new SpriteBody(this.scene,set,this.idleHeight());this.body.sprite.setDepth(this.depth);
  for(let i=0;i<3;i++){const g=new SpriteBody(this.scene,set,this.idleHeight());g.sprite.setDepth(18).setVisible(false);this.spriteGhosts.push(g);}
  this.rig.container.setVisible(false);this.ghosts.forEach(g=>g.container.setVisible(false));
  if(set.bust&&this.scene.textures.exists(set.bust)){const key=`cutin:${this.def.id}`;if(this.scene.textures.exists(key))this.scene.textures.remove(key);this.scene.textures.addImage(key,this.scene.textures.get(set.bust).getSourceImage() as HTMLImageElement);}
 }
 get container():Phaser.GameObjects.Components.Depth&Phaser.GameObjects.Components.Visible{return this.body?this.body.sprite:this.rig.container;}
 setDepth(depth:number){this.depth=depth;this.rig.container.setDepth(depth);this.body?.sprite.setDepth(depth);return this;}
 private timing(f:FighterState):{timing?:MoveTiming;duration?:number}{const move=f.moveId?Object.values(this.def.moves).find(m=>m?.id===f.moveId):undefined;return move?{timing:{startup:move.startup,active:move.active,recovery:move.recovery},duration:move.startup+move.active+move.recovery}:{};}
 update(f:FighterState,state:MatchState){const x=f.x/FX,y=GROUND_Y-f.y/FX;const {timing,duration}=this.timing(f);
 const hitAge=state.frame-f.lastHitFrame;const cinematicOwner=state.cinematic.active&&state.cinematic.owner===f.index;
 const flash=!cinematicOwner&&f.lastHitFrame>=0&&hitAge>=0&&hitAge<4;const alpha=flash?1:state.cinematic.active&&!cinematicOwner?.48:f.invulnFrames>0&&!cinematicOwner&&state.frame%6<2?.45:1;
 const ghostActive=['dash','backdash','teleport'].includes(f.anim);
 if(this.body){
  this.body.setForm(f.form);this.lastFrame=this.body.show(x,y,f.facing,f.anim,f.animFrame,timing);
  const spr=this.body.sprite;if(flash)spr.setTintFill(0xffffff);else spr.clearTint();spr.setAlpha(alpha);
  const trail=Phaser.Display.Color.HexStringToColor(this.def.visuals.vfx.trail).color;
  this.spriteGhosts.forEach((g,i)=>{g.sprite.setVisible(ghostActive);if(ghostActive){g.setForm(f.form);g.show(x-f.facing*(i+1)*26,y,f.facing,f.anim,f.animFrame,timing);g.sprite.setTintFill(trail).setAlpha(.3-i*.08);}});
 }else{
  this.rig.container.setPosition(x,y).setScale(f.facing*this.def.visuals.heightPx/190,this.def.visuals.heightPx/190);this.rig.setForm(f.form);
  this.rig.pose(samplePose(this.def.visuals,f.anim,f.animFrame,duration));
  if(flash)this.rig.tint(0xffffff);else this.rig.clearTint();this.rig.container.setAlpha(alpha);
  for(let i=0;i<this.ghosts.length;i++){const ghost=this.ghosts[i];ghost.container.setVisible(ghostActive);if(ghostActive){ghost.setForm(f.form);ghost.pose(samplePose(this.def.visuals,f.anim,f.animFrame));ghost.tint(Phaser.Display.Color.HexStringToColor(this.def.visuals.vfx.trail).color);ghost.container.setPosition(x-f.facing*(i+1)*22,y).setScale(f.facing*this.def.visuals.heightPx/190,this.def.visuals.heightPx/190).setAlpha(.18-i*.045);}}
 }
 this.shadow.setPosition(x,GROUND_Y+5).setScale(Math.max(.4,1-f.y/FX/600)*(this.body?1.25:1),Math.max(.4,1-f.y/FX/600)).setAlpha(f.grounded?.35:.18);
 const auraH=this.body?this.idleHeight()/0.85:285;
 this.aura.clear();if(cinematicOwner||f.form||['ultimate','transform','special1','special2','beam'].includes(f.anim)){const color=Phaser.Display.Color.HexStringToColor(f.form?this.def.visuals.forms?.[f.form]?.palette?.aura??this.def.visuals.palette.aura:this.def.visuals.palette.aura).color;const k=auraH/285;for(let layer=0;layer<3;layer++){this.aura.fillStyle(color,(cinematicOwner?.10:.045)+layer*.025);this.aura.beginPath();this.aura.moveTo(x-55*k+layer*7,y);for(let i=0;i<=24;i++){const angle=Math.PI+i*Math.PI/24;const wobble=Math.sin(state.frame*.18+i*2)*15+(i%2?15:-8);this.aura.lineTo(x+Math.cos(angle)*(65*k-layer*9+wobble),y+Math.sin(angle)*(auraH-layer*18+wobble));}this.aura.closePath();this.aura.fillPath();if(cinematicOwner){this.aura.lineStyle(1.5,0xfff5d4,.5);this.aura.strokePath();}}for(let i=0;i<8;i++){const t=(state.frame*3+i*31)%210;this.aura.fillStyle(color,1-t/210);this.aura.fillEllipse(x+Math.sin(i*7+state.frame*.04)*48*k,y-t*k,3,9);}if(cinematicOwner)for(let i=0;i<16;i++){const t=(state.frame*.015+i/16)%1,a=i*Math.PI*2/16,r=180*(1-t);this.aura.fillStyle(color,t);this.aura.fillCircle(x+Math.cos(a)*r,y-135*k+Math.sin(a)*r,2+t*2);}}
 }
 destroy(){this.destroyed=true;this.ghosts.forEach(g=>g.destroy());this.rig.destroy();this.body?.destroy();this.spriteGhosts.forEach(g=>g.destroy());this.shadow.destroy();this.aura.destroy();}
}
