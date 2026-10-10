import type {AnimKey} from '../../game/sim/types';
import type {CharacterVisuals,Pose} from './types';
import {clips,neutral} from './families/standard';
export function samplePose(v:CharacterVisuals,anim:AnimKey,frame:number,duration?:number):Pose {
 const c=v.animOverrides?.[anim]??clips[anim];const end=c.keys[c.keys.length-1].f;
 let t=duration&&end?frame*end/duration:frame;if(c.loop&&end)t%=end;else t=Math.min(t,end);
 let a=c.keys[0],b=a;for(let i=1;i<c.keys.length;i++){b=c.keys[i];if(t<=b.f)break;a=b;}
 const u=b.f===a.f?0:Math.max(0,Math.min(1,(t-a.f)/(b.f-a.f)));const e=u*u*(3-2*u);const out:Pose={...neutral,...a.pose};
 for(const key of Object.keys({...neutral,...b.pose}) as (keyof Pose)[]){const x=a.pose[key]??neutral[key],y=b.pose[key]??neutral[key];if(typeof x==='number'&&typeof y==='number')(out as Record<string,unknown>)[key]=x+(y-x)*e;else if(u>.5)(out as Record<string,unknown>)[key]=y??x;}
 return out;
}
