import type { CharacterVisuals } from '../../../render/rig/types';
export const visuals: CharacterVisuals = {
 family: 'standard', heightPx: 210,
 palette: { skin:'#f7c69f',skinShade:'#cf8e72',hair:'#171d2b',hairShade:'#080d18',hairHighlight:'#354053',eyes:'#242938',top:'#f98527',topShade:'#bd431f',undershirt:'#172d58',belt:'#193b70',pants:'#ef7926',pantsShade:'#b84423',boots:'#244775',bootsShade:'#142541',wrist:'#294d86',accent:'#facc56',outline:'#151827',aura:'#ffe779' },
 hair: {locks:[[[-1,.1],[-1.7,-.6],[-.7,-.65],[-1.25,-1.5],[-.25,-1.05],[.1,-2.05],[.5,-1.2],[1.35,-1.65],[1,-.65],[1.65,-.7],[1,.3]]],bangs:[[[-.8,-.6],[-.15,-.65],[-.42,-.08]],[[.05,-.7],[.7,-.55],[.45,-.05]]] },
 accessories: [{kind:'symbol',color:'#fff1cf'},{kind:'wristbands',color:'#294d86'}],
 forms:{ssj:{palette:{hair:'#ffe65c',hairShade:'#d99b27',hairHighlight:'#fff9bb',eyes:'#4ecbb9',aura:'#ffe66c'},aura:true}},
 animOverrides: {
  beam:{keys:[{f:0,pose:{torso:-15,head:15,armFrontUpper:45,armFrontLower:-120,armBackUpper:30,armBackLower:-100,handFront:'palm',handBack:'palm',face:'angry'}},{f:10,pose:{rootY:7,torso:-22,armFrontUpper:50,armFrontLower:-120,armBackUpper:40,armBackLower:-100,handFront:'palm',handBack:'palm',face:'angry'}},{f:14,pose:{rootX:13,torso:18,head:-15,armFrontUpper:-85,armFrontLower:-5,armBackUpper:-100,armBackLower:5,handFront:'palm',handBack:'palm',face:'shout'}},{f:25,pose:{rootX:13,torso:18,head:-15,armFrontUpper:-85,armFrontLower:-5,armBackUpper:-100,armBackLower:5,handFront:'palm',handBack:'palm',face:'shout'}},{f:35,pose:{}}]}
 },
 vfx: {hitSpark:'#fff0ad',trail:'#68dfff',projectile:'kiBlast',beam:'kamehameha',ultimateBg:'#152756',ultimateText:'SUPER KAMEHAMEHA!!'}
};
