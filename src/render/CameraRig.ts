import Phaser from 'phaser';
import {FX,STAGE_WIDTH_PX,type MatchState,type PlayerIndex} from '../game/sim/types';
import {GAME_H,GROUND_Y} from '../ui/sceneData';
export class CameraRig {
 readonly camera:Phaser.Cameras.Scene2D.Camera;private focus:PlayerIndex|null=null;private punchLeft=0;private punchZoom=1;
 constructor(scene:Phaser.Scene){this.camera=scene.cameras.main;this.camera.setBounds(0,0,STAGE_WIDTH_PX,1200);this.camera.centerOn(1200,GAME_H/2);}
 shake(intensity=.006,ms=100){this.camera.shake(ms,Math.min(.018,intensity));}
 punch(zoom=1.08,ms=150){this.punchZoom=zoom;this.punchLeft=ms;}
 cinematicFocus(owner:PlayerIndex|null){this.focus=owner;}
 setCinematicFocus(owner:PlayerIndex|null){this.cinematicFocus(owner);}
 update(state:MatchState,dtMs:number){const [a,b]=state.fighters;const owner=this.focus??(state.cinematic.active?state.cinematic.owner:null);const distance=Math.abs(a.x-b.x)/FX;let zoom=Phaser.Math.Clamp(1.38-distance/3600,.95,1.25);let x=(a.x+b.x)/FX/2,y=GAME_H/2+70-Math.max(a.y,b.y)/FX*.16;
 if(owner!==null){x=state.fighters[owner].x/FX;zoom=1.48;y=GROUND_Y-state.fighters[owner].y/FX-(GAME_H*.73-GAME_H/2)/zoom;}if(this.punchLeft>0){this.punchLeft-=dtMs;zoom*=this.punchZoom;}
 const ease=1-Math.exp(-dtMs/180);this.camera.setZoom(Phaser.Math.Linear(this.camera.zoom,zoom,ease));const half=this.camera.width/this.camera.zoom/2;x=Phaser.Math.Clamp(x,half,STAGE_WIDTH_PX-half);this.camera.useBounds=owner===null;this.camera.centerOn(Phaser.Math.Linear(this.camera.midPoint.x,x,ease),Phaser.Math.Linear(this.camera.midPoint.y,y,ease));
 }
}
