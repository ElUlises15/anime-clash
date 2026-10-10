import Phaser from 'phaser';
import type {CharacterDef} from '../characters/types';
import {FX,type FighterState,type MatchState,type PlayerIndex} from '../game/sim/types';
import {GROUND_Y} from '../ui/sceneData';
import {Rig} from './rig/Rig';
import {registerVisualDefinition} from './visualRegistry';
import {makePortraitTexture} from './portrait';
import {samplePose} from './rig/poses';
import {spriteSetFor,SPRITE_HEIGHT_MUL,type SpriteSet} from './sprites/sets';
import {ensureSpriteSet,ensureFormAtlas} from './sprites/loader';
import {SpriteBody} from './sprites/SpriteBody';
import {resolveClip,type MoveTiming} from './sprites/frameSelect';
import type {AnimKey} from '../game/sim/types';

const DASH_ANIMS=new Set<AnimKey>(['dash','backdash','teleport']);
const AURA_ANIMS=new Set<AnimKey>(['ultimate','transform','special1','special2','beam']);
const STUN_MODES=new Set(['hitstun','blockstun','knockback']);
/** Walk cycle: one drawn frame per this many world px travelled (feet stay planted). */
const WALK_STRIDE_PX=34;
const LAND_SQUASH_FRAMES=9,TAKEOFF_STRETCH_FRAMES=8;
const SMEAR_ALPHA=[.38,.24,.13];

/**
 * Fighter renderer. Uses the AI sprite atlas when the character has one (lazy-loaded on first use) and falls back to the
 * procedural cutout rig otherwise (or while/if the atlas fails to load). Same public interface either way.
 */
export class FighterView {
 readonly rig:Rig;private shadow:Phaser.GameObjects.Ellipse;private aura:Phaser.GameObjects.Graphics;private ghosts:Rig[]=[];
 private body:SpriteBody|null=null;private spriteGhosts:SpriteBody[]=[];private readonly spriteSet:SpriteSet|undefined;private destroyed=false;private depth:number;private trailColor:number;
 // Render-only memory (never written back to the sim): landing/takeoff timestamps and the walk odometer.
 private prevGrounded=true;private landFrame=-999;private takeoffFrame=-999;private lastSimFrame=-1;private walkDist=0;
 /** Last sprite frame shown (debug / tests). */
 lastFrame='';
 constructor(private scene:Phaser.Scene,readonly def:CharacterDef,readonly index:PlayerIndex){this.depth=20+index;this.trailColor=Phaser.Display.Color.HexStringToColor(def.visuals.vfx.trail).color;this.shadow=scene.add.ellipse(0,GROUND_Y,92,18,0x101321,.35).setDepth(9);this.aura=scene.add.graphics().setDepth(10);this.rig=new Rig(scene,def.id,def.visuals);this.rig.container.setDepth(this.depth);registerVisualDefinition(def);makePortraitTexture(scene,def,`cutin:${def.id}`,384);for(let i=0;i<3;i++){const ghost=new Rig(scene,def.id,def.visuals);ghost.container.setDepth(18).setVisible(false);this.ghosts.push(ghost);}
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
 private timingFor='';private timingCache:{timing?:MoveTiming;duration?:number}={};
 /** Move timing for frame selection, cached per moveId (no per-frame allocations). */
 private timing(f:FighterState):{timing?:MoveTiming;duration?:number}{const id=f.moveId??'';if(id!==this.timingFor){this.timingFor=id;const move=id?Object.values(this.def.moves).find(m=>m?.id===id):undefined;this.timingCache=move?{timing:{startup:move.startup,active:move.active,recovery:move.recovery},duration:move.startup+move.active+move.recovery}:{};}return this.timingCache;}
 update(f:FighterState,state:MatchState){const x=f.x/FX,y=GROUND_Y-f.y/FX;const {timing,duration}=this.timing(f);
 const hitAge=state.frame-f.lastHitFrame;const cinematicOwner=state.cinematic.active&&state.cinematic.owner===f.index;
 const flash=!cinematicOwner&&f.lastHitFrame>=0&&hitAge>=0&&hitAge<4;const alpha=flash?1:state.cinematic.active&&!cinematicOwner?.48:f.invulnFrames>0&&!cinematicOwner&&state.frame%6<2?.45:1;
 const sf=state.frame,dt=this.lastSimFrame<0?0:Math.max(0,Math.min(4,sf-this.lastSimFrame));this.lastSimFrame=sf;
 if(f.grounded&&!this.prevGrounded)this.landFrame=sf;if(!f.grounded&&this.prevGrounded)this.takeoffFrame=sf;this.prevGrounded=f.grounded;
 // squash on landing / stretch on takeoff (view scale only)
 let sx=1,sy=1;const la=sf-this.landFrame,ta=sf-this.takeoffFrame;
 if(f.grounded&&la>=0&&la<LAND_SQUASH_FRAMES){const k=1-la/LAND_SQUASH_FRAMES;sx=1+.13*k;sy=1-.11*k;}
 else if(!f.grounded&&ta>=0&&ta<TAKEOFF_STRETCH_FRAMES){const k=1-ta/TAKEOFF_STRETCH_FRAMES;sx=1-.09*k;sy=1+.12*k;}
 // hitstop: the sim freezes both fighters; the defender's sprite shakes (render offset only)
 const shake=state.hitstop>0&&STUN_MODES.has(f.mode)?((sf&1)?1:-1)*Math.min(8,2+state.hitstop*.5):0;
 // walk playback follows real ground speed (no sliding feet); ~0 velocity shows idle
 let anim=f.anim,af=f.animFrame;
 if(anim==='walkFwd'||anim==='walkBack'){const sp=Math.abs(f.vx)/FX;if(sp<.5)anim='idle';else{this.walkDist+=sp*dt;const fps=(this.spriteSet&&resolveClip(this.spriteSet.clips,anim)?.fps)||8;af=Math.floor(this.walkDist/WALK_STRIDE_PX*60/fps);}}
 const dashing=DASH_ANIMS.has(f.anim);
 const smear=!dashing&&f.mode==='attack'&&!!timing&&f.animFrame>=timing.startup&&f.animFrame<timing.startup+timing.active+2;
 if(this.body){
  if(f.form&&this.spriteSet?.forms?.[f.form])ensureFormAtlas(this.scene,this.spriteSet.forms[f.form]);this.body.setForm(f.form);this.lastFrame=this.body.show(x+shake,y,f.facing,anim,af,timing);
  const spr=this.body.sprite;if(sx!==1||sy!==1)spr.setScale(spr.scaleX*sx,spr.scaleY*sy);if(flash)spr.setTintFill(0xffffff);else spr.clearTint();spr.setAlpha(alpha);
  for(let i=0;i<this.spriteGhosts.length;i++){const g=this.spriteGhosts[i];const on=dashing||smear;g.sprite.setVisible(on);if(!on)continue;g.setForm(f.form);
   // dash: afterimages trailing behind; attack: smear of the preceding poses along the swing
   if(dashing){g.show(x-f.facing*(i+1)*26,y,f.facing,anim,af,timing);g.sprite.setTintFill(this.trailColor).setAlpha(.3-i*.08);}
   else{g.show(x+shake-f.facing*(i+1)*13,y,f.facing,anim,Math.max(0,af-(i+1)*2),timing);g.sprite.setTintFill(this.trailColor).setAlpha(SMEAR_ALPHA[i]*alpha);}}
 }else{
  const hs=this.def.visuals.heightPx/190;this.rig.container.setPosition(x+shake,y).setScale(f.facing*hs*sx,hs*sy);this.rig.setForm(f.form);
  this.rig.pose(samplePose(this.def.visuals,anim,af,duration));
  if(flash)this.rig.tint(0xffffff);else this.rig.clearTint();this.rig.container.setAlpha(alpha);
  for(let i=0;i<this.ghosts.length;i++){const ghost=this.ghosts[i];const on=dashing||smear;ghost.container.setVisible(on);if(on){ghost.setForm(f.form);ghost.pose(samplePose(this.def.visuals,anim,dashing?af:Math.max(0,af-(i+1)*2),duration));ghost.tint(this.trailColor);ghost.container.setPosition(x-f.facing*(i+1)*(dashing?22:12),y).setScale(f.facing*hs,hs).setAlpha(dashing?.18-i*.045:SMEAR_ALPHA[i]*.6);}}
 }
 this.shadow.setPosition(x,GROUND_Y+5).setScale(Math.max(.4,1-f.y/FX/600)*(this.body?1.25:1),Math.max(.4,1-f.y/FX/600)).setAlpha(f.grounded?.35:.18);
 const auraH=this.body?this.idleHeight()/0.85:285;
 this.aura.clear();if(cinematicOwner||f.form||AURA_ANIMS.has(f.anim)){const color=Phaser.Display.Color.HexStringToColor(f.form?this.def.visuals.forms?.[f.form]?.palette?.aura??this.def.visuals.palette.aura:this.def.visuals.palette.aura).color;const k=auraH/285;for(let layer=0;layer<3;layer++){this.aura.fillStyle(color,(cinematicOwner?.10:.045)+layer*.025);this.aura.beginPath();this.aura.moveTo(x-55*k+layer*7,y);for(let i=0;i<=24;i++){const angle=Math.PI+i*Math.PI/24;const wobble=Math.sin(state.frame*.18+i*2)*15+(i%2?15:-8);this.aura.lineTo(x+Math.cos(angle)*(65*k-layer*9+wobble),y+Math.sin(angle)*(auraH-layer*18+wobble));}this.aura.closePath();this.aura.fillPath();if(cinematicOwner){this.aura.lineStyle(1.5,0xfff5d4,.5);this.aura.strokePath();}}for(let i=0;i<8;i++){const t=(state.frame*3+i*31)%210;this.aura.fillStyle(color,1-t/210);this.aura.fillEllipse(x+Math.sin(i*7+state.frame*.04)*48*k,y-t*k,3,9);}if(cinematicOwner)for(let i=0;i<16;i++){const t=(state.frame*.015+i/16)%1,a=i*Math.PI*2/16,r=180*(1-t);this.aura.fillStyle(color,t);this.aura.fillCircle(x+Math.cos(a)*r,y-135*k+Math.sin(a)*r,2+t*2);}}
 }
 destroy(){this.destroyed=true;this.ghosts.forEach(g=>g.destroy());this.rig.destroy();this.body?.destroy();this.spriteGhosts.forEach(g=>g.destroy());this.shadow.destroy();this.aura.destroy();}
}
