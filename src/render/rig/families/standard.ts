import type { AnimKey } from '../../../game/sim/types';
import type { AnimClip, Pose } from '../types';
export const ANIM_KEYS: AnimKey[] = ['idle','walkFwd','walkBack','jump','fall','crouch','light','light2','heavy','crouchLight','crouchHeavy','airLight','airHeavy','hit','hitAir','block','crouchBlock','knockback','knockdown','getup','special1','special2','ultimate','victory','ko','dash','backdash','teleport','transform','summon','projectile','beam','counter','intro'];
export const neutral: Pose = {rootY:6,torso:-5,head:5,armBackUpper:-35,armBackLower:-75,armFrontUpper:-30,armFrontLower:-115,legBackUpper:35,legBackLower:-20,legFrontUpper:-35,legFrontLower:25,face:'neutral',squash:1};
const guard: Pose={armFrontUpper:-65,armFrontLower:-100,armBackUpper:-110,armBackLower:-95,rootY:8,face:'angry'};
const wind: Pose={torso:-18,armFrontUpper:60,armFrontLower:-100,armBackUpper:-65,armBackLower:-65,rootY:6,face:'angry'};
const punch: Pose={torso:18,head:-15,armFrontUpper:-85,armFrontLower:0,armBackUpper:-55,armBackLower:-100,rootX:12,face:'shout'};
const beam: Pose={torso:15,head:-15,armFrontUpper:-90,armFrontLower:0,armBackUpper:-85,armBackLower:0,handFront:'palm',handBack:'palm',face:'shout'};
export const clips={} as Record<AnimKey,AnimClip>;
for(const k of ANIM_KEYS) clips[k]={keys:[{f:0,pose:neutral},{f:30,pose:{rootY:-2,torso:-3}},{f:60,pose:neutral}],loop:true};
for(const k of ['light','light2','heavy','crouchLight','crouchHeavy','airLight','airHeavy','special1','special2','ultimate','projectile','beam','counter','summon'] as AnimKey[]) {
 const strike = ['beam','ultimate','projectile'].includes(k)?beam:k.includes('Heavy')||k==='heavy'?{...punch,legFrontUpper:-120,legFrontLower:0,armFrontUpper:-45,armFrontLower:-90}:punch;
 const low=k.startsWith('crouch')?{rootY:40,legFrontUpper:55,legFrontLower:-65,legBackUpper:-55,legBackLower:85}:{};
 clips[k]={keys:[{f:0,pose:{...wind,...low}},{f:9,pose:{...wind,torso:-25,...low}},{f:12,pose:{...strike,...low}},{f:18,pose:{...strike,...low}},{f:30,pose:neutral}]};
}
for(const k of ['walkFwd','walkBack'] as AnimKey[]) clips[k]={loop:true,keys:[{f:0,pose:{legFrontUpper:30,legFrontLower:-20,legBackUpper:-30,legBackLower:25,armFrontUpper:-20}},{f:12,pose:{legFrontUpper:-30,legFrontLower:25,legBackUpper:30,legBackLower:-20,armFrontUpper:35}},{f:24,pose:{legFrontUpper:30,legFrontLower:-20,legBackUpper:-30,legBackLower:25,armFrontUpper:-20}}]};
for(const k of ['block','crouchBlock'] as AnimKey[]) clips[k]={keys:[{f:0,pose:{...guard,rootY:k==='crouchBlock'?40:4,legFrontUpper:-25,legFrontLower:20}}]};
clips.crouch={keys:[{f:0,pose:{...guard,rootY:45,torso:15,legFrontUpper:65,legFrontLower:-85,legBackUpper:-55,legBackLower:90}}]};
for(const k of ['jump','fall','airLight','airHeavy'] as AnimKey[]) if(k==='jump'||k==='fall') clips[k]={keys:[{f:0,pose:{rootY:6,legFrontUpper:-45,legFrontLower:85,legBackUpper:35,legBackLower:45,armFrontUpper:-120,armFrontLower:-40}}]};
for(const k of ['hit','hitAir','knockback'] as AnimKey[]) clips[k]={keys:[{f:0,pose:{torso:-35,head:-20,armFrontUpper:65,armFrontLower:20,armBackUpper:-85,rootX:-8,face:'hurt'}},{f:20,pose:neutral}]};
for(const k of ['knockdown','ko'] as AnimKey[]) clips[k]={keys:[{f:0,pose:{torso:-90,head:10,rootY:107,rootX:30,legFrontUpper:-80,legFrontLower:-10,legBackUpper:-100,legBackLower:20,armFrontUpper:10,armFrontLower:5,armBackUpper:15,armBackLower:-20,face:'ko'}}]};
clips.getup={keys:[{f:0,pose:clips.knockdown.keys[0].pose},{f:18,pose:clips.crouch.keys[0].pose},{f:35,pose:neutral}]};
for(const k of ['dash','backdash','teleport'] as AnimKey[]) clips[k]={keys:[{f:0,pose:{torso:40,head:-30,rootY:20,armFrontUpper:95,armFrontLower:20,armBackUpper:80,legFrontUpper:-45,legFrontLower:40,legBackUpper:65,legBackLower:-40}}]};
for(const k of ['victory','transform','intro'] as AnimKey[]) clips[k]={loop:true,keys:[{f:0,pose:{armFrontUpper:k==='victory'?-155:25,armFrontLower:-20,armBackUpper:-20,armBackLower:-25,face:k==='victory'?'smile':'shout'}},{f:30,pose:{rootY:-3,armFrontUpper:k==='victory'?-160:30,armFrontLower:-25,face:k==='victory'?'smile':'shout'}}]};
export const proportions={torso:48,upperArm:29,lowerArm:27,upperLeg:39,lowerLeg:37,width:1};

// Silhouette-led strikes: upper angles are local to the torso; lower angles are relative.
clips.crouchHeavy={keys:[{f:0,pose:{rootY:38,torso:-18,legFrontUpper:60,legFrontLower:-70}},{f:10,pose:{rootY:45,torso:25,head:-25,legFrontUpper:-85,legFrontLower:0,legBackUpper:65,legBackLower:-95,armFrontUpper:-55,armFrontLower:-85}},{f:19,pose:{rootY:45,torso:25,head:-25,legFrontUpper:-85,legFrontLower:0,legBackUpper:65,legBackLower:-95}},{f:32,pose:neutral}]};
for(const key of ['airLight','airHeavy'] as AnimKey[])clips[key]={keys:[{f:0,pose:{torso:-20,legFrontUpper:-45,legFrontLower:80,legBackUpper:60,legBackLower:50}},{f:10,pose:{torso:25,head:-25,legFrontUpper:-115,legFrontLower:0,legBackUpper:60,legBackLower:70,armFrontUpper:55,armFrontLower:-95,face:'shout'}},{f:20,pose:{torso:25,head:-25,legFrontUpper:-115,legFrontLower:0,legBackUpper:60,legBackLower:70}},{f:32,pose:neutral}]};
clips.special1=clips.projectile={keys:[{f:0,pose:wind},{f:8,pose:{...wind,torso:-25}},{f:12,pose:{...punch,handFront:'palm'}},{f:23,pose:{...punch,handFront:'palm'}},{f:34,pose:neutral}]};
