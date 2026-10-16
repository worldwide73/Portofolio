// (16 octobre 2026 : les ambiances ont été retirées ; la recette ne teste plus que le site d'origine.)
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch();const erreurs=[];
try {for(const reducedMotion of ['no-preference','reduce']) {const p=await b.newPage({reducedMotion});p.on('pageerror',e=>erreurs.push(e.message));await p.goto('http://127.0.0.1:4321');await p.waitForFunction(()=>!document.documentElement.classList.contains('intro'));
for(const atmosphere of ['']) {assert.ok(await p.locator('.jeu-bouton').isVisible());await p.locator('.jeu-bouton').click();assert.ok(await p.locator('#hub').evaluate(e=>e.matches(':popover-open')));await p.locator('.hub__fermer').click();console.log('OK',reducedMotion,atmosphere||'origine')}
await p.reload();await p.waitForFunction(()=>!document.documentElement.classList.contains('intro'));assert.ok(await p.locator('.jeu-bouton').isVisible());await p.locator('.jeu-bouton').click();assert.ok(await p.locator('#hub').evaluate(e=>e.matches(':popover-open')));console.log('OK après rechargement');await p.close()}
assert.deepEqual(erreurs,[])}finally{await b.close()}
