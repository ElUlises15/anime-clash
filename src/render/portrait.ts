import Phaser from 'phaser';
import type {CharacterDef} from '../characters/types';
import type {AnimKey} from '../game/sim/types';
import {Rig} from './rig/Rig';
import {samplePose} from './rig/poses';
export function makeFullBodyTexture(scene:Phaser.Scene,def:CharacterDef,key:string,heightPx:number,anim:AnimKey='idle',frame=0){if(scene.textures.exists(key))return key;const rig=new Rig(scene,def.id,def.visuals);rig.pose(samplePose(def.visuals,anim,frame));const rt=scene.add.renderTexture(-3000,-3000,heightPx,heightPx+24);rig.container.setScale(heightPx/225);rt.draw(rig.container,heightPx/2,heightPx);rt.saveTexture(key);rt.destroy();rig.destroy();return key;}
export function makePortraitTexture(scene:Phaser.Scene,def:CharacterDef,key:string,size=256){if(scene.textures.exists(key))return key;const bg=scene.add.graphics();bg.fillGradientStyle(0x10152b,0x17233b,0x243c60,0x11152a,1);bg.fillRect(0,0,size,size);bg.lineStyle(5,Phaser.Display.Color.HexStringToColor(def.visuals.palette.accent).color,.8);bg.lineBetween(0,size,size,0);const rig=new Rig(scene,def.id,def.visuals);rig.pose(samplePose(def.visuals,'idle',0));rig.container.setScale(size/115);const rt=scene.add.renderTexture(-3000,-3000,size,size);rt.draw(bg);rt.draw(rig.container,size*.5,size*1.73);rt.saveTexture(key);rt.destroy();rig.destroy();bg.destroy();return key;}
