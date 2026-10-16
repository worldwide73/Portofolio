import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch();const erreurs=[];
try {for(const reducedMotion of ['no-preference','reduce']) {const p=await b.newPage({reducedMotion});p.on('pageerror',e=>erreurs.push(e.message));await p.goto('http://127.0.0.1:4321');await p.waitForFunction(()=>!document.documentElement.classList.contains('intro'));
for(const atmosphere of ['', 'chill','espace','focus']) {await p.evaluate(async a=>(await import('/src/scripts/reglages.ts')).regler('atmosphere',a),atmosphere);assert.ok(await p.locator('.jeu-bouton').isVisible());await p.locator('.jeu-bouton').click();assert.ok(await p.locator('#hub').evaluate(e=>e.matches(':popover-open')));await p.locator('.hub__fermer').click();console.log('OK',reducedMotion,atmosphere||'origine')}
await p.reload();await p.waitForFunction(()=>!document.documentElement.classList.contains('intro'));assert.ok(await p.locator('.jeu-bouton').isVisible());await p.locator('.jeu-bouton').click();assert.ok(await p.locator('#hub').evaluate(e=>e.matches(':popover-open')));console.log('OK Focus mémorisé après reload');await p.close()}
assert.deepEqual(erreurs,[])}finally{await b.close()}
