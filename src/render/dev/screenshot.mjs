import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const output='/workspace/anime-clash/shots/render-dev';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const cases=['idle','walkFwd','light','heavy','crouchHeavy','airHeavy','hit','block','knockdown','special1','beam','dash','victory'].map(anim=>({name:anim==='walkFwd'?'walk':anim,query:`anim=${anim}&frame=${anim==='hit'?0:14}`}));
cases.push({name:'ssj-idle',query:'anim=idle&frame=14&form=ssj'},{name:'cinematic',query:'anim=ultimate&frame=14&cinematic=1'});
for(const effect of ['rasengan','rasenshuriken','clone'])cases.push({name:effect,query:`anim=special1&frame=14&effect=${effect}`});
try{for(const entry of cases){await page.goto(`http://localhost:5199/preview.html?${entry.query}`,{waitUntil:'domcontentloaded'});await page.locator('canvas').waitFor();await page.waitForTimeout(650);await page.screenshot({path:`${output}/${entry.name}.png`});}}finally{await browser.close();}
if(errors.length)throw new Error(errors.join('\n'));console.log(`Captured ${cases.length} previews at 1366×768 without browser exceptions.`);
