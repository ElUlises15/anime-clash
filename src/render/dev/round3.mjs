import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const out='/tmp/anime-clash-round3';await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
for(const [p1,p2] of [['goku','naruto'],['vegeta','sasuke']]){
 await page.goto('http://localhost:5402/');await page.waitForFunction(()=>window.__game?.scene.getScene('Title')?.sys.isActive());
 await page.evaluate(([p1,p2])=>{const g=window.__game;g.scene.getScenes(true).forEach(s=>s.scene.stop());g.scene.start('Fight',{mode:'versus',p1,p2,controllers:['cpu','cpu'],autoplay:true,seed:1234});},[p1,p2]);
 await page.waitForFunction(p1=>window.__ac?.getState().config.p1===p1,p1);await page.waitForTimeout(1200);
 const flashCheck=await page.evaluate(()=>{const s=window.__ac.scene,state=structuredClone(window.__ac.getState());state.cinematic.active=false;const f=state.fighters[0];f.lastHitFrame=state.frame;f.anim='hit';const results=[];for(const age of [0,3,4,12]){state.frame=f.lastHitFrame+age;s.views[0].update(f,state);results.push({age,fill:s.views[0].rig.parts.head.tintFill});}s.views[0].update(window.__ac.getState().fighters[0],window.__ac.getState());return results;});console.log('Hit flash',flashCheck);if(flashCheck.some(x=>x.fill!==(x.age<4)))throw Error('Hit flash regression');
 await page.evaluate(()=>window.__ac.fastForward(220));await page.waitForTimeout(250);await page.screenshot({path:`${out}/${p1}-fight.png`});
 for(let i=0;i<20;i++){const active=await page.evaluate(()=>{window.__ac.fastForward(600,'cinematic');return window.__ac.getState().cinematic.active;});if(active)break;}
 await page.waitForTimeout(200);
 await page.evaluate(()=>{const s=window.__ac.scene;s.paused=true;});await page.waitForTimeout(800);await page.screenshot({path:`${out}/${p1}-cinematic-default.png`});await page.evaluate(()=>{window.__ac.scene.camRig.update=()=>{};});
 for(const zoom of [.85,1.25,1.6]){
 const info=await page.evaluate(zoom=>{const s=window.__ac.scene,state=window.__ac.getState();s.camRig.camera.setZoom(zoom);s.vfx.update(0,state);return {active:state.cinematic.active,owner:state.cinematic.owner,zoom,scale:s.vfx.screen.scaleX,position:[s.vfx.screen.x,s.vfx.screen.y]};},zoom);
 console.log(p1,info);await page.waitForTimeout(100);await page.screenshot({path:`${out}/${p1}-cinematic-${zoom}.png`});}
}
for(const query of (process.env.REAL_ONLY?[]:['p1=vegeta&p2=sasuke&anim=idle&frame=0','p1=vegeta&p2=sasuke&anim=idle&form=ssj','p1=vegeta&p2=sasuke&anim=ultimate&cinematic=1',...['kiBlastPurple','galickGun','bigBang','barrier','finalFlash','fireball','chidori','shuriken','sharingan','wireTrap','kirin','unknown'].map(effect=>`p1=vegeta&p2=sasuke&effect=${effect}&anim=special1&frame=14`)])){
 await page.goto(`http://localhost:5403/preview.html?${query}`);await page.waitForTimeout(650);await page.screenshot({path:`${out}/preview-${query.includes('effect=')?new URLSearchParams(query).get('effect'):query.includes('form=')?'ssj':query.includes('cinematic=')?'cinematic':'roster'}.png`});
}
await browser.close();console.log('Browser errors:',errors);if(errors.length)process.exitCode=1;
