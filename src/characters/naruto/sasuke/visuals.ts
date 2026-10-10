// PLACEHOLDER copied from Goku — to be replaced by the render team.
import type { CharacterVisuals } from '../../../render/rig/types';
export const visuals: CharacterVisuals = {
 family: 'standard', heightPx: 242,
 palette: { skin:'#f7c69f',skinShade:'#cf8e72',hair:'#171d2b',hairShade:'#080d18',hairHighlight:'#354053',eyes:'#242938',top:'#f98527',topShade:'#bd431f',undershirt:'#172d58',belt:'#193b70',pants:'#ef7926',pantsShade:'#b84423',boots:'#244775',bootsShade:'#142541',wrist:'#294d86',accent:'#facc56',outline:'#151827',aura:'#ffe779' },
 hair: {locks:[[[-1,.15],[-1.95,-.75],[-1.05,-.8],[-1.85,-1.75],[-.75,-1.3],[-.85,-2.45],[-.15,-1.55],[.35,-2.75],[.65,-1.55],[1.65,-2.15],[1.2,-1.05],[2,-1.2],[1.5,-.3],[1,.25]]],bangs:[[[-1,-.8],[-.2,-.85],[-.55,.1]],[[-.2,-1],[.45,-.8],[.15,.05]],[[.4,-.8],[1,-.65],[.65,.05]]] },
 accessories: [{kind:'symbol',color:'#fff1cf'},{kind:'wristbands',color:'#294d86'}],
 forms:{ssj:{hair:{locks:[[[-1,.1],[-1.7,-1.2],[-.9,-1],[-1.1,-2.6],[-.3,-1.6],[.1,-3],[.55,-1.8],[1.1,-2.7],[1,-1.1],[1.7,-1.5],[1.2,.1]]],bangs:[[[-.9,-.8],[-.1,-.7],[-.5,0]],[[.1,-.7],[.8,-.9],[.5,0]]]},palette:{hair:'#ffe65c',hairShade:'#d99b27',hairHighlight:'#fff9bb',eyes:'#4ecbb9',aura:'#ffe66c'},aura:true}},
 animOverrides: {
  ultimate:{keys:[{f:0,pose:{rootY:15,torso:-12,armFrontUpper:35,armFrontLower:-115,armBackUpper:-20,armBackLower:-100,face:'angry'}},{f:10,pose:{rootY:8,torso:-18,head:18,armFrontUpper:45,armFrontLower:-110,armBackUpper:25,armBackLower:-100,handFront:'palm',handBack:'palm',face:'shout'}},{f:18,pose:{rootX:15,torso:20,head:-20,armFrontUpper:-110,armFrontLower:0,armBackUpper:-105,armBackLower:0,handFront:'palm',handBack:'palm',face:'shout'}},{f:35,pose: {}}]},
  victory:{loop:true,keys:[{f:0,pose:{armFrontUpper:-65,armFrontLower:-100,armBackUpper:15,armBackLower:-15,torso:-8,face:'smile'}},{f:40,pose:{rootY:3,armFrontUpper:-65,armFrontLower:-100,face:'smile'}}]},
  beam:{keys:[{f:0,pose:{torso:-15,head:15,armFrontUpper:45,armFrontLower:-120,armBackUpper:30,armBackLower:-100,handFront:'palm',handBack:'palm',face:'angry'}},{f:10,pose:{rootY:7,torso:-22,armFrontUpper:50,armFrontLower:-120,armBackUpper:40,armBackLower:-100,handFront:'palm',handBack:'palm',face:'angry'}},{f:14,pose:{rootX:13,torso:18,head:-15,armFrontUpper:-85,armFrontLower:-5,armBackUpper:-100,armBackLower:5,handFront:'palm',handBack:'palm',face:'shout'}},{f:25,pose:{rootX:13,torso:18,head:-15,armFrontUpper:-85,armFrontLower:-5,armBackUpper:-100,armBackLower:5,handFront:'palm',handBack:'palm',face:'shout'}},{f:35,pose:{}}]}
 },
 vfx: {hitSpark:'#fff0ad',trail:'#68dfff',projectile:'kiBlast',beam:'kamehameha',ultimateBg:'#152756',ultimateText:'SUPER KAMEHAMEHA!!'}
};
