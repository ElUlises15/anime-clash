// Captures a real FightScene (versus, CPU vs CPU) with sprite fighters at 1366x768.
// usage: node src/render/dev/sprites.mjs [p1] [p2] [outDir] [baseUrl]   (needs `npx vite --port 5199` running)
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const [p1='goku',p2='naruto',out='/workspace/anime-clash/shots/sprites',base='http://localhost:5199/']=process.argv.slice(2);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.text().includes('[sprites]'))errors.push(m.text());});
const bytes={};page.on('response',async r=>{if(r.url().includes('/assets/sprites/')){try{bytes[r.url().split('/').pop()]=(await r.body()).length;}catch{}}});
const t0=Date.now();
try{
await page.goto(base,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__game?.scene.isActive('Title'),null,{timeout:60000});
const tTitle=Date.now()-t0;const atlasBeforeFight=Object.keys(bytes).length;
await page.evaluate(([p1,p2])=>{const g=window.__game;g.scene.getScenes(true).forEach(s=>g.scene.stop(s.scene.key));g.scene.start('Fight',{mode:'versus',p1,p2,controllers:['cpu','cpu'],seed:1234});},[p1,p2]);
await page.waitForFunction(()=>!!window.__ac&&window.__ac.getState().phase==='fight',null,{timeout:60000});
await page.waitForTimeout(500);
const sprites=await page.evaluate(()=>window.__ac.scene.views.map(v=>v.usingSprites));
const shot=async(name)=>{await page.screenshot({path:`${out}/${name}.png`});console.log('shot',name);};
await shot(`${p1}-${p2}-01-idle`);
async function grab(name,pred,timeout=25000,prep){
  if(prep)await page.evaluate(prep);
  try{await page.waitForFunction(new Function(`const ac=window.__ac;const s=ac.getState();const ok=(${pred})(s);if(ok){ac.scene.scene.pause();}return ok;`),null,{timeout,polling:'raf'});
   await page.waitForTimeout(80);await shot(name);}catch(e){console.log('MISS',name);}
  await page.evaluate(()=>window.__ac.scene.scene.resume());
}
const act=(anims,ph)=>`s=>s.fighters.some(f=>${JSON.stringify(anims)}.includes(f.anim)&&f.animFrame>=${ph??0})`;
await grab(`${p1}-${p2}-02-light`,act(['light','light2'],5));
await grab(`${p1}-${p2}-03-heavy`,act(['heavy'],11));
await grab(`${p1}-${p2}-04-walk`,act(['walkFwd','walkBack'],4));
await grab(`${p1}-${p2}-05-air`,`s=>s.fighters.some(f=>!f.grounded&&f.y>8000)`);
await grab(`${p1}-${p2}-06-special`,act(['projectile','beam','special1','special2','summon'],12));
await grab(`${p1}-${p2}-07-hit`,act(['hit','knockback','hitAir'],1));
await grab(`${p1}-${p2}-08-ultimate-cinematic`,`s=>s.cinematic.active&&s.cinematic.framesLeft<s.cinematic.total-30`,40000,()=>{const s=window.__ac.getState();s.fighters.forEach(f=>{f.ult=1000;f.energy=1000;});});
await grab(`${p1}-${p2}-09-ultimate-fire`,`s=>!s.cinematic.active&&s.fighters.some(f=>f.anim==='ultimate'&&f.animFrame>30)`,15000);
await grab(`${p1}-${p2}-10-ko`,`s=>s.fighters.some(f=>f.mode==='ko'&&f.grounded&&f.modeFrame>20)`,40000,()=>{const s=window.__ac.getState();s.fighters[1].hp=Math.min(s.fighters[1].hp,30);});
console.log(JSON.stringify({tTitleMs:tTitle,atlasBeforeFight,sprites,bytes,errors}));
}finally{await browser.close();}
