import type { CharacterVisuals } from '../../../render/rig/types';
export const visuals: CharacterVisuals = {
 family: 'slim', heightPx: 200,
 palette: { skin:'#f7c69f',skinShade:'#cf8e72',hair:'#ffda46',hairShade:'#d79720',hairHighlight:'#fff58e',eyes:'#51a7df',top:'#f98527',topShade:'#bd431f',undershirt:'#172d58',belt:'#193b70',pants:'#ef7926',pantsShade:'#b84423',boots:'#244775',bootsShade:'#142541',wrist:'#294d86',accent:'#dc4d46',outline:'#151827',aura:'#5bd8ff' },
 hair: {locks:[[[-1,.1],[-1.3,-.65],[-.65,-.5],[-.8,-1.3],[-.2,-.95],[.1,-1.55],[.4,-.95],[.95,-1.3],[.85,-.55],[1.35,-.65],[1,.2]]],bangs:[[[-.8,-.6],[-.15,-.65],[-.42,-.08]],[[.05,-.7],[.7,-.55],[.45,-.05]]] },
 accessories: [{kind:'headband',color:'#263f65',color2:'#c9d7df'},{kind:'collar',color:'#222936'},{kind:'symbol',color:'#d84645',params:{swirl:true}},{kind:'custom',color:'#5b3540',params:{whiskers:true}}],
 
 animOverrides: {
  special2:{keys:[{f:0,pose:{armFrontUpper:-35,armFrontLower:-120,armBackUpper:-35,armBackLower:-120,face:'angry'}},{f:9,pose:{rootY:8,armFrontUpper:-45,armFrontLower:-115,armBackUpper:-45,armBackLower:-115,handFront:'point',handBack:'point'}},{f:22,pose:{rootY:4,armFrontUpper:-70,armFrontLower:-20,armBackUpper:-80,armBackLower:-20,handFront:'palm',handBack:'palm',face:'shout'}},{f:32,pose:{}}]},
  ultimate:{keys:[{f:0,pose:{rootY:12,torso:-15,armFrontUpper:30,armFrontLower:-100,face:'angry'}},{f:10,pose:{rootY:-6,torso:-5,armFrontUpper:-160,armFrontLower:-15,handFront:'palm',face:'shout'}},{f:20,pose:{rootX:20,torso:25,head:-20,armFrontUpper:-95,armFrontLower:0,handFront:'palm',face:'shout'}},{f:35,pose:{}}]}
 },
 vfx: {hitSpark:'#fff0ad',trail:'#68dfff',projectile:'rasengan',beam:'kamehameha',ultimateBg:'#14344b',ultimateText:'RASENSHURIKEN!!'}
};
