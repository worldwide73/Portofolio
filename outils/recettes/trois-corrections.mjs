import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
const resultats=[],erreurs=[];
try {
for(const reducedMotion of ['no-preference','reduce']) {
 const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion});p.on('pageerror',e=>erreurs.push(e.message));
 await p.addInitScript(()=>{window.dureeIntro={};let t;new MutationObserver(()=>{const h=document.documentElement;if(!h)return;if(h.classList.contains('intro-longue')&&t===undefined)t=performance.now();if(t!==undefined&&!h.classList.contains('intro-longue')){window.dureeIntro.ms=performance.now()-t;t=undefined}}).observe(document,{subtree:true,attributes:true,attributeFilter:['class']})});
 await p.goto('http://127.0.0.1:4321');await p.waitForFunction(()=>!document.documentElement.classList.contains('intro'));await p.waitForTimeout(500);
 const intro=await p.evaluate(()=>window.dureeIntro.ms);if(reducedMotion==='no-preference')assert.ok(intro>3800&&intro<4600,`intro ${intro}`);resultats.push({reducedMotion,introMs:intro??null});
 const aller=async(id)=>{await p.evaluate(async id=>(await import('/src/scripts/voyage.ts')).voyager(id),id);await p.waitForTimeout(1900)};
 const verifier=async(scenario)=>{const e=await p.evaluate(async()=>{const {etat}=await import('/src/scripts/gl/champ.ts');return {x:etat.sourisX,y:etat.sourisY,zoom:etat.zoom,scroll:scrollY}});assert.ok(e.x>=0&&e.x<=1&&e.y>=0&&e.y<=1,JSON.stringify(e));assert.ok(e.scroll<3,JSON.stringify(e));assert.ok(Math.abs(e.zoom)<.01);resultats.push({scenario,reducedMotion,...e});};
 for(const id of ['realisations','competences','contact']){await aller(id);await p.mouse.move(700,600);await p.mouse.move(710,610);await aller('accueil');await verifier('retour '+id)}
 await aller('competences');await p.mouse.move(750,650);await p.keyboard.press('ArrowLeft');await p.waitForTimeout(1900);await verifier('fleche gauche');
 await p.locator('.jeu-bouton').click();await p.locator('[data-onglet="explorer"]').click();await p.locator('[data-parcours="rapide"]').click();await p.waitForTimeout(1500);await p.keyboard.press('ArrowRight');await p.waitForTimeout(1400);await p.mouse.move(720,620);await p.keyboard.press('ArrowLeft');await p.waitForTimeout(1600);await verifier('visite aller retour');await p.locator('[data-visite="quitter"]').click();
 await p.screenshot({path:`captures/ciblees/portail-retour-${reducedMotion}.png`});
 await p.locator('.jeu-bouton').click();await p.locator('[data-onglet="assistant"]').click();await p.waitForTimeout(400);
 const dimensions=await p.locator('#hub').boundingBox();assert.equal(dimensions.width,390);assert.equal(dimensions.height,560);const icone=await p.locator('.jeu-bouton').boundingBox();assert.equal(icone.width,40);assert.equal(icone.height,40);
 await p.locator('#hub-question').fill('Les réglages');await p.locator('#hub-question').press('Enter');await p.waitForTimeout(300);assert.ok(await p.locator('.hub__message--assistant').count());
 await p.screenshot({path:`captures/ciblees/hub-compact-${reducedMotion}.png`});resultats.push({reducedMotion,hub:dimensions,icone});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(350);const mobile=await p.locator('#hub').boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390&&mobile.y+mobile.height<=844);assert.ok(await p.locator('#hub-question').isVisible());resultats.push({reducedMotion,mobile});
 await p.close();
}
assert.deepEqual(erreurs,[]);console.log(JSON.stringify({resultats,erreurs},null,2));
}finally{await writeFile('captures/ciblees/trois-corrections.json',JSON.stringify({resultats,erreurs},null,2));await b.close()}
