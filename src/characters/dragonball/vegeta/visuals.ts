import type {CharacterVisuals} from '../../../render/rig/types';
const flame: CharacterVisuals['hair']={locks:[[[-1,.1],[-1.3,-1],[-1.1,-2.2],[-.6,-1.6],[-.65,-3.1],[-.15,-2.4],[.2,-3.5],[.55,-2.3],[1,-2.9],[1.1,-1.5],[1.4,-1.8],[1,.1],[.45,-.65],[0,-.2],[-.45,-.65]]],bangs:[[[-.95,-.9],[-.4,-.9],[0,-.35],[.4,-.9],[.95,-.9],[.7,-1.1],[-.7,-1.1]]]};
export const visuals:CharacterVisuals={family:'heavy',heightPx:228,
 palette:{skin:'#efbc95',skinShade:'#b87966',hair:'#101522',hairShade:'#030710',hairHighlight:'#30364a',eyes:'#202536',top:'#f1f3ed',topShade:'#adbccc',undershirt:'#192e6b',belt:'#d5ab4d',pants:'#1d347b',pantsShade:'#0c173e',boots:'#f4f6ed',bootsShade:'#bccbd9',wrist:'#f4f6ed',accent:'#e9c65f',outline:'#111625',aura:'#b46fff'},hair:flame,
 accessories:[{kind:'shoulderPad',color:'#e9c65f',params:{armor:true}},{kind:'custom',color:'#ffffff',params:{gloves:true}}],
 forms:{ssj:{hair:flame,palette:{hair:'#ffe664',hairShade:'#d59b23',hairHighlight:'#fff9c0',eyes:'#40cbbb',aura:'#ffe35b'},aura:true}},
 animOverrides:{idle:{loop:true,keys:[{f:0,pose:{face:'angry',torso:-3,armFrontUpper:-25,armFrontLower:-95}},{f:30,pose:{rootY:3,face:'angry'}}]},ultimate:{keys:[{f:0,pose:{face:'angry',armFrontUpper:70,armFrontLower:-100,armBackUpper:-65,armBackLower:90}},{f:18,pose:{face:'shout',torso:12,head:-12,armFrontUpper:-85,armFrontLower:0,armBackUpper:-85,armBackLower:0,handFront:'palm',handBack:'palm'}},{f:40,pose:{face:'angry'}}]}},
 vfx:{hitSpark:'#ead5ff',trail:'#b37cff',projectile:'kiBlastPurple',beam:'galickGun',ultimateBg:'#211036',ultimateText:'FINAL FLASH!!'}};
