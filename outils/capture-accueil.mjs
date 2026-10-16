// Capture réelle du premier écran, pour la vignette du portfolio. Aucune image source modifiée.
import { chromium } from 'playwright';
const browser = await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
try {
  const page = await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'no-preference'});
  await page.goto(process.env.SITE || 'http://127.0.0.1:4321/');
  await page.waitForFunction(()=>!document.documentElement.classList.contains('intro'),null,{timeout:15000});
  await page.mouse.move(50,500);
  await page.waitForTimeout(1300);
  await page.screenshot({path:'src/assets/projets/portfolio-accueil.jpg',type:'jpeg',quality:92});
  console.log('Capture réelle : src/assets/projets/portfolio-accueil.jpg');
  await page.locator('[data-portail]').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.explorateur.est-formee');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  console.log('Retour clavier :',await page.evaluate(()=>({opacity:getComputedStyle(document.querySelector('.hero__portail-symbole')).opacity,focus:document.activeElement?.className,hover:document.querySelector('.hero__portail').matches(':hover')})));
} finally {await browser.close();}
