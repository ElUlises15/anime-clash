import Phaser from 'phaser';
import {visuals as goku} from '../../characters/dragonball/goku/visuals';
import {visuals as naruto} from '../../characters/naruto/naruto/visuals';
import type {CharacterDef} from '../../characters/types';
import type {AnimKey,FighterState,MatchState,EntityState} from '../../game/sim/types';
import {ANIM_KEYS} from '../rig/families/standard';
import {FighterView} from '../FighterView';
import {StageView} from '../StageView';
import {CameraRig} from '../CameraRig';
import {EntityView} from '../EntityView';
import {VfxSystem} from '../VfxSystem';
const defs=[{id:'goku',name:'Goku',visuals:goku,moves:{}},{id:'naruto',name:'Naruto',visuals:naruto,moves:{}}] as CharacterDef[];
const stats={damageDealt:0,hitsLanded:0,maxCombo:0,blocks:0,specialsUsed:0,ultimatesUsed:0,roundsWon:0};
function fighter(index:0|1):FighterState{return {index,charId:defs[index].id,x:(index?1430:970)*100,y:0,vx:0,vy:0,facing:index?-1:1,grounded:true,hp:1000,maxHp:1000,energy:1000,ult:1000,mode:'idle',modeFrame:0,anim:'idle',animFrame:0,moveId:null,moveFrame:0,moveHit:false,stunFrames:0,invulnFrames:0,armorFrames:0,airActions:0,cooldowns:{},statuses:[],form:null,comboTaken:0,comboDamage:0,prevInput:0,lastDirTap:0,stats:{...stats},bufInput:0,bufAge:0,juggle:0,moveHits:0,moveConnect:0,knockdownOnLand:false,lastHitFrame:-1};}
class Preview extends Phaser.Scene {
 private stage!:StageView;private rig!:CameraRig;private views!:FighterView[];private entities!:EntityView;private vfx!:VfxSystem;private label!:Phaser.GameObjects.Text;private elapsed=0;
 private state:MatchState={frame:0,rng:1,config:{p1:'goku',p2:'naruto',seed:1,mode:'versus'},phase:'fight',phaseFrame:0,round:1,roundWins:[0,0],roundWinners:[],timerFrames:4500,hitstop:0,cinematic:{active:false,owner:0,framesLeft:0,total:180,moveId:'ultimate'},fighters:[fighter(0),fighter(1)],entities:[],nextEntityId:1,events:[],winner:null};
 create(){this.stage=new StageView(this);this.rig=new CameraRig(this);this.views=defs.map((d,i)=>new FighterView(this,d,i as 0|1));this.entities=new EntityView(this,defs);this.vfx=new VfxSystem(this,this.rig);this.label=this.add.text(50,55,'',{fontFamily:'Arial',fontSize:'29px',color:'#ffe1aa'}).setScrollFactor(0).setDepth(100);this.add.text(50,100,'PROCEDURAL ART LAB  /  ← → pose   ·   SPACE cinematic   ·   T golden form',{fontSize:'19px',color:'#aebcd6'}).setScrollFactor(0).setDepth(100);this.input.keyboard!.on('keydown-SPACE',()=>{this.state.cinematic.active=true;this.state.cinematic.framesLeft=180;});this.input.keyboard!.on('keydown-H',()=>this.vfx.handleEvents([{type:'hit',frame:this.state.frame,player:0,x:125000,y:11000,strength:'heavy'}],this.state));this.input.keyboard!.on('keydown-T',()=>{this.state.fighters[0].form=this.state.fighters[0].form?null:'ssj';});this.input.keyboard!.on('keydown-RIGHT',()=>this.elapsed+=1500);this.input.keyboard!.on('keydown-LEFT',()=>this.elapsed=Math.max(0,this.elapsed-1500));
 const hints=['kiBlast','rasengan','kunai','rasenshuriken','shield','trap'];this.state.entities=hints.map((visual,i)=>({id:i+1,kind:visual==='shield'?'shield':visual==='trap'?'trap':'projectile',owner:i%2 as 0|1,abilityType:'preview',moveId:'preview',visual,x:(770+i*170)*100,y:35000,vx:0,vy:0,facing:1,w:visual==='rasenshuriken'?75:35,h:35,life:999,age:0,hitsLeft:1,hitCooldown:0,power:1,data:{}} as EntityState));
 }
 update(_time:number,dt:number){this.elapsed+=dt;const params=new URLSearchParams(location.search);const requested=params.get('anim');const anim=(requested&&ANIM_KEYS.includes(requested as AnimKey)?requested:ANIM_KEYS[Math.floor(this.elapsed/1500)%ANIM_KEYS.length]) as AnimKey;const frame=params.has('frame')?Number(params.get('frame')):Math.floor(this.elapsed/16.666)%90;this.state.frame++;for(const f of this.state.fighters){f.anim=anim;f.animFrame=frame;f.y=['jump','fall','airLight','airHeavy','hitAir'].includes(anim)?12000:0;}for(const e of this.state.entities)e.age++;const beam=this.state.entities.find(e=>e.id===99);if(anim==='beam'&&!beam)this.state.entities.push({id:99,kind:'beam',owner:0,abilityType:'beam',moveId:'preview',visual:'kamehameha',x:105000,y:11000,vx:0,vy:0,facing:1,w:300,h:40,life:999,age:0,hitsLeft:1,hitCooldown:0,power:1,data:{length:300}});if(anim!=='beam'&&beam)this.state.entities.splice(this.state.entities.indexOf(beam),1);if(this.state.cinematic.active&&--this.state.cinematic.framesLeft<=0)this.state.cinematic.active=false;
 this.rig.update(this.state,dt);this.stage.update(dt,this.cameras.main);this.views.forEach((v,i)=>v.update(this.state.fighters[i],this.state));this.entities.update(this.state);this.vfx.update(dt,this.state);this.label.setText(`ANIME CLASH  /  ${anim.toUpperCase()}  /  FRAME ${frame}  /  GOKU × NARUTO`);
 }
}
new Phaser.Game({type:Phaser.AUTO,width:1920,height:1080,backgroundColor:'#101626',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Preview});
