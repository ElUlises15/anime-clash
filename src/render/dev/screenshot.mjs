import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(String(e))); 
for(const anim of ['idle','heavy','beam','knockdown','victory']){await page.goto(`http://localhost:5199/preview.html?anim=${anim}&frame=14`);await page.waitForTimeout(900);await page.screenshot({path:`/workspace/anime-clash/shots/render-dev/${anim}.png`});}
await page.keyboard.press('Space');await page.waitForTimeout(300);await page.screenshot({path:'/workspace/anime-clash/shots/render-dev/cinematic.png'});await browser.close();if(errors.length)throw new Error(errors.join('\n'));console.log('Captured 6 render previews without browser exceptions.');
