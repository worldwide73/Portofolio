import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
const base=process.env.SITE || 'http://127.0.0.1:4321';
const results=[];
try {
  await page.goto(base);
  await page.waitForSelector('.initialisation.est-active');
  const start=Date.now();
  await page.waitForFunction(()=>!document.documentElement.classList.contains('intro'),null,{timeout:15000});
  results.push({introMs:Date.now()-start});
  // Reproduit le survol de la scène puis l'ouverture via le bouton accessible.
  await page.mouse.move(720,380);
  await page.waitForTimeout(1200);
  results.push({avant:await page.locator('.hero__cadre').getAttribute('class')});
  await page.locator('[data-portail]').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.explorateur.est-formee');
  await page.waitForTimeout(350);
  await page.locator('[data-destination="realisations"]').evaluate(el=>el.click());
  await page.waitForFunction(()=>!document.querySelector('.explorateur').open);
  await page.waitForTimeout(800);
  const stale=await page.locator('.hero__cadre').evaluate(el=>el.classList.contains('sur-portail'));
  results.push({survolPersistant:stale});
  // Retour à l'accueil avec le module de navigation, puis observe le symbole sans souris sur la lame.
  await page.evaluate(async()=>{const {voyager}=await import('/src/scripts/voyage.ts');voyager('accueil');});
  await page.waitForTimeout(1800);
  results.push({symboleOpacity:await page.locator('.hero__portail-symbole').evaluate(el=>getComputedStyle(el).opacity)});
  await mkdir('captures/recettes',{recursive:true});
  await page.screenshot({path:'captures/recettes/portail-retour.png'});
  console.log(JSON.stringify({results,errors},null,2));
  await writeFile('captures/recettes/portail.json',JSON.stringify({results,errors},null,2));
  if(process.env.VERIFIER){assert.equal(stale,false);assert.deepEqual(errors,[]);}
} finally {await browser.close();}
