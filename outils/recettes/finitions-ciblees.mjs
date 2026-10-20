import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
const base=process.env.SITE||'http://127.0.0.1:4321';const resultats=[],erreurs=[];
p.on('pageerror',e=>erreurs.push(e.message));
const pret=async()=>{await p.waitForFunction(()=>!document.documentElement.classList.contains('intro'));await p.waitForTimeout(500);};
await p.addInitScript(()=>{
 window.dureeIntro={};let t;
 new MutationObserver(()=>{const h=document.documentElement;if(!h)return;if(h.classList.contains('intro-longue')&&t===undefined)t=performance.now();if(t!==undefined&&!h.classList.contains('intro-longue')){window.dureeIntro.ms=performance.now()-t;t=undefined;}}).observe(document,{subtree:true,attributes:true,attributeFilter:['class']});
});
try{
 await p.goto(base);await pret();resultats.push({intro:await p.evaluate(()=>window.dureeIntro)});
 await p.evaluate(()=>{sessionStorage.setItem('position-avant-langue','.8');history.replaceState(null,'','#contact');scrollTo(0,document.body.scrollHeight);});
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.initialisation.est-active');await p.locator('.initialisation__passer').click();await pret();
 assert.ok(await p.evaluate(()=>scrollY)<2);assert.equal(await p.evaluate(()=>location.hash),'');resultats.push({refreshAvecAnciennePositionEtSkip:true});
 for(const id of ['competences','veille','contact']){
  await p.evaluate(async()=>{(await import('/src/scripts/voyage.ts')).voyager('accueil');});await p.waitForTimeout(1600);
  await p.locator('[data-portail]').focus();await p.keyboard.press('Enter');await p.waitForSelector('.explorateur.est-formee');await p.waitForTimeout(150);
  await p.locator(`[data-destination="${id}"]`).focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>!document.querySelector('.explorateur').open);await p.waitForTimeout(1500);
  assert.equal(await p.locator('.hero__portail-symbole').evaluate(e=>+getComputedStyle(e).opacity),0);
  assert.equal(await p.evaluate(()=>location.hash),'#'+id);resultats.push({destination:id,logoEteint:true});
 }
 await p.evaluate(async()=>{(await import('/src/scripts/voyage.ts')).voyager('realisations');});await p.waitForTimeout(1600);
 await p.locator('[data-galerie-pause]').click();
 for(let i=0;i<8;i++){if(await p.locator('.carte.est-centre a[href="/realisations/portfolio/"]').count())break;await p.locator('[data-galerie="1"]').click();await p.waitForTimeout(800);}
 assert.equal(await p.locator('.carte.est-centre a[href="/realisations/portfolio/"]').count(),1);
 await p.waitForTimeout(800);await p.screenshot({path:'captures/ciblees/galerie-portfolio.png'});resultats.push({vignetteCentrale:true});
 await p.locator('[data-constellation]').click();await p.locator('.constellation__etoile[data-projet="portfolio"]').click();
 await p.locator('[data-fiche="portfolio"] .constellation__connexes').scrollIntoViewIfNeeded();await p.waitForTimeout(400);await p.screenshot({path:'captures/ciblees/relations.png'});
 await p.keyboard.press('Escape');await p.locator('.jeu-bouton').click();await p.locator('#hub-question').fill('Présente le portfolio');await p.locator('#hub-question').press('Enter');
 await p.waitForTimeout(500);await p.screenshot({path:'captures/ciblees/orbit-final.png'});
 await p.locator('#hub-question').fill('Compare Forensics et Tools');await p.locator('#hub-question').press('Enter');const message=p.locator('.hub__messages .hub__message--assistant').last();assert.equal(await message.locator('a').count(),2);resultats.push({comparaisonDocumentee:true});
 await p.locator('[data-onglet="explorer"]').click();await p.locator('[data-parcours="rapide"]').click();await p.waitForTimeout(1600);await p.keyboard.press('ArrowRight');await p.waitForTimeout(600);assert.match(await p.locator('[data-visite="titre"]').innerText(),/réalisations/);await p.keyboard.press('ArrowLeft');await p.waitForTimeout(600);assert.match(await p.locator('[data-visite="titre"]').innerText(),/Qui/);resultats.push({visiteFleches:true});
 await p.locator('[data-visite="quitter"]').click();await p.locator('.jeu-bouton').click();await p.locator('[data-onglet="coulisses"]').click();await p.waitForSelector('#hub[data-vue="coulisses"]');await p.locator('[data-onglet="rush"]').click();await p.waitForSelector('.rush[open]',{timeout:30000});await p.waitForTimeout(1700);if(await p.locator('.tuto__passer:visible').count()){await p.locator('.tuto__passer').click();await p.waitForTimeout(500);}await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('.rush').open);resultats.push({hubCoulissesEtJeu:true});
 assert.deepEqual(erreurs,[]);resultats.push({exceptionsJS:0});
 console.log(JSON.stringify(resultats));
}finally{await writeFile('captures/ciblees/finitions.json',JSON.stringify({resultats,erreurs},null,2));await b.close();}
