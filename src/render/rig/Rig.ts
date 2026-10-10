import Phaser from 'phaser';
import type {CharacterVisuals,Pose} from './types';
import {textureParts,type Part} from './textures';
import {proportions} from './families/standard';
export class Rig {
 readonly container:Phaser.GameObjects.Container;
 private parts:Record<string,Phaser.GameObjects.Image>={};
 private form:string|null=null;private expression:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene,private id:string,readonly visuals:CharacterVisuals){
 this.container=scene.add.container(0,0);const textures=textureParts(scene,id,visuals);
 for(const [name,part] of [['legBackUpper','upperLeg'],['legBackLower','lowerLeg'],['bootBack','boot'],['armBackUpper','upperArm'],['armBackLower','lowerArm'],['handBack','hand'],['hair','hair'],['torso','torso'],['pelvis','pelvis'],['legFrontUpper','upperLeg'],['legFrontLower','lowerLeg'],['bootFront','boot'],['neck','neck'],['head','head'],['bangs','bangs'],['armFrontUpper','upperArm'],['armFrontLower','lowerArm'],['handFront','hand']] as [string,Part][]){const image=scene.add.image(0,0,textures[part]).setOrigin(.5,80/192).setScale(1/3);this.parts[name]=image;this.container.add(image);if(name.includes('Back'))image.setTint(0xb6b8c7);}
 this.expression=scene.add.graphics();this.container.add(this.expression);this.container.setScale(visuals.heightPx/190);
 }
 setForm(form:string|null){if(form===this.form)return;this.form=form;const keys=textureParts(this.scene,this.id,this.visuals,form);for(const name in this.parts){const part=name.startsWith('leg')?(name.endsWith('Upper')?'upperLeg':'lowerLeg'):name.startsWith('arm')?(name.endsWith('Upper')?'upperArm':'lowerArm'):name.startsWith('boot')?'boot':name.startsWith('hand')?'hand':name;this.parts[name].setTexture(keys[part as Part]);}}
 pose(p:Pose){const r=Math.PI/180;const torso=p.torso??0;const rx=p.rootX??0,ry=-137+(p.rootY??0);const width=this.visuals.family==='slim'?.88:this.visuals.family==='heavy'?1.22:this.visuals.family==='petite'?.8:1;
 const put=(key:string,x:number,y:number,angle:number)=>{this.parts[key].setPosition(x,y).setRotation(angle*r);};
 const end=(x:number,y:number,angle:number,len:number)=>[x-Math.sin(angle*r)*len,y+Math.cos(angle*r)*len];
 put('torso',rx,ry,torso);this.parts.torso.setScale(width/3,(p.squash??1)/3);let [hx,hy]=end(rx,ry,torso,47);put('pelvis',hx,hy,torso*.4);
 for(const side of ['Back','Front']){const front=side==='Front';let x=hx+(front?9:-9)*width,y=hy+13;let a=p[`leg${side}Upper` as keyof Pose] as number??0,b=a+(p[`leg${side}Lower` as keyof Pose] as number??0);put(`leg${side}Upper`,x,y,a);[x,y]=end(x,y,a,proportions.upperLeg);put(`leg${side}Lower`,x,y,b);[x,y]=end(x,y,b,proportions.lowerLeg);put(`boot${side}`,x,y,b*.3);
 [x,y]=end(rx,ry,torso,5);x+=(front?18:-18)*width;a=torso+(p[`arm${side}Upper` as keyof Pose] as number??0);b=a+(p[`arm${side}Lower` as keyof Pose] as number??0);put(`arm${side}Upper`,x,y,a);[x,y]=end(x,y,a,29);put(`arm${side}Lower`,x,y,b);[x,y]=end(x,y,b,27);put(`hand${side}`,x,y,b);const hand=p[`hand${side}` as keyof Pose];this.parts[`hand${side}`].setTexture(`rig:${this.id}:${this.form??'base'}:${hand&&hand!=='fist'?'openHand':'hand'}`);
 }
 const [nx,ny]=end(rx,ry,torso,-25);put('neck',nx,ny+22,torso);for(const key of ['head','hair','bangs'])put(key,nx,ny,torso+(p.head??0));
 const ink=Phaser.Display.Color.HexStringToColor(this.visuals.palette.outline).color;this.expression.clear().setPosition(nx,ny).setRotation((torso+(p.head??0))*r);const g=this.expression;
 if(p.face==='shout'||p.face==='hurt'){g.fillStyle(ink);g.fillEllipse(2,17,9,p.face==='shout'?9:5);g.fillStyle(0xffe9df);g.fillRect(-1,13,6,2);}
 if(p.face==='smile'){g.lineStyle(1.5,ink);g.beginPath();g.arc(2,14,5,0,Math.PI);g.strokePath();}
 if(p.face==='ko'){g.fillStyle(Phaser.Display.Color.HexStringToColor(this.visuals.palette.skin).color);g.fillRect(-12,-1,12,8);g.fillRect(3,-1,12,8);g.lineStyle(1.6,ink);g.lineBetween(-11,3,-2,4);g.lineBetween(5,4,13,3);}
 if(p.face==='angry'||p.face==='shout'){g.lineStyle(2.1,ink);g.lineBetween(-12,-4,-2,0);g.lineBetween(4,0,14,-4);}
 this.parts.head.setTint(p.face==='hurt'?0xffc4b0:0xffffff);
 }
 tint(color:number){for(const key in this.parts)this.parts[key].setTintFill(color);}
 clearTint(){for(const key in this.parts)this.parts[key].clearTint().setTint(key.includes('Back')?0xb6b8c7:0xffffff);}
 destroy(){this.container.destroy();}
}
