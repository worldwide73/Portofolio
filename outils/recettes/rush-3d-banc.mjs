// RECETTE V4-H : le banc d'essai des modèles 3D (vaisseaux, mécanismes, obstacles), rendus seuls avec les vraies matières,
// textures et halo. Utilisation : node outils/recettes/rush-3d-banc.mjs (serveur local lancé). Réglages : SITE, CHROMIUM,
// SORTIE (captures/v4h), MODELES (liste JSON), DEGATS (0 à 1).
// Banc d'essai : chaque modèle rendu seul, avec les vraies matières (materiaux.ts), les textures procédurales
// (textures.ts), le halo (post.ts) ; caméra en trois-quarts. Pour juger les modèles de près.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
const SORTIE = process.env.SORTIE || 'captures/v4h';
mkdirSync(SORTIE, { recursive: true });
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const p = await nav.newPage({ viewport: { width: 900, height: 600 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => ['warning', 'error'].includes(m.type()) && !/GPU stall|GL Driver|Failed to load/.test(m.text()) && console.log('C', m.text().slice(0, 500)));
await p.goto((process.env.SITE || 'http://127.0.0.1:4321') + '/404');
const liste = JSON.parse(process.env.MODELES || '[["vaisseau",0,4.2,[0,0.1,0]],["vaisseau",3,4.2,[0,0.1,0]],["turbine",0,11,[0,2.6,0]],["radar",0,11,[0,2.5,0]],["presse",0,10,[0,1.8,0]],["balise",0,5,[0,1.5,0]],["rochers",3,3.5,[0,0.6,0]],["drone",0,3.5,[0,0.8,0]]]');
const images = await p.evaluate(async ({ liste, degats }) => {
  const { Renderer, Camera, Transform, Mesh, Texture } = await import('/node_modules/.vite/deps/ogl.js');
  const Mo = await import('/src/scripts/rush/scene/modeles.ts');
  const { surface, halo, uniformesMonde } = await import('/src/scripts/rush/scene/materiaux.ts');
  const { creerTextures } = await import('/src/scripts/rush/scene/textures.ts');
  const { Post } = await import('/src/scripts/rush/scene/post.ts');
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:900px;height:600px;z-index:99999';
  document.body.append(c);
  const r = new Renderer({ canvas: c, width: 900, height: 600, dpr: 1, antialias: true });
  const gl = r.gl;
  gl.clearColor(0.03, 0.05, 0.09, 1);
  const monde = uniformesMonde();
  const t = creerTextures(gl, 1024);
  monde.tPlaques.value = t.plaques;
  monde.tBrut.value = t.brut;
  monde.tNormales.value = t.normales;
  monde.tOmbre.value = new Texture(gl, { image: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1, generateMipmaps: false, flipY: false });
  monde.uTextures.value = 1;
  monde.uSoleilDir.value = [-0.5, 0.6, 0.55];
  monde.uSoleil.value = [2.4, 2.25, 2.1];
  monde.uCiel.value = [0.12, 0.18, 0.3];
  monde.uSol.value = [0.03, 0.035, 0.05];
  monde.uBrume.value = [400, 900];
  monde.uAccent.value = [0.3, 0.75, 1];
  monde.uAccent2.value = [1, 0.55, 0.2];
  monde.uNbLum.value = 1;
  monde.uLumPos.value = [3, 2, 4, 14, ...new Array(28).fill(0)];
  monde.uLumCoul.value = [0.6, 1.2, 2.2, ...new Array(21).fill(0)];
  const pS = surface(gl, { ...monde, uPlie: { value: 0 } }, { echelle: 0.7 });
  pS.uniforms.uDegats.value = degats;
  const pH = halo(gl, { ...monde, uPlie: { value: 0 } });
  const post = new Post(gl);
  post.dimensionner(900, 600);
  monde.uHdr.value = post.hdr ? 1 : 0;
  console.warn('HDR ' + post.hdr);
  const camera = new Camera(gl, { fov: 35, near: 0.1, far: 500, aspect: 1.5 });
  const sortie = {};
  for (const [nom, arg, dist, cible] of liste) {
    const scene = new Transform();
    const ajouter = (a, parent = scene) => { const g = a?.geometrie?.(gl); if (g) new Mesh(gl, { geometry: g, program: a.constructor.name === 'Halos' ? pH : pS, frustumCulled: false }).setParent(parent); };
    const double = (d, parent) => { ajouter(d.solide, parent); ajouter(d.halos, parent); };
    if (nom === 'vaisseau') ajouter(Mo.vaisseau(arg));
    else if (nom === 'turbine') { double(Mo.turbineCadre()); const m = new Transform(); m.position.set(0, 2.6, 0.1); m.rotation.z = 0.4; m.setParent(scene); ajouter(Mo.turbineRotor(), m); }
    else if (nom === 'radar') { double(Mo.radarTour()); const m = new Transform(); m.position.set(0, 3.9, 0); m.rotation.y = 0.8; m.setParent(scene); ajouter(Mo.radarAntenne(), m); }
    else if (nom === 'presse') { double(Mo.presseCadre()); const m = new Transform(); m.position.set(0, 2.2, 0); m.setParent(scene); ajouter(Mo.presseTete(), m); }
    else if (nom === 'balise') { ajouter(Mo.baliseMat()); const m = new Transform(); m.position.set(0, 2.5, 0); m.setParent(scene); ajouter(Mo.baliseTete(), m); }
    else if (nom === 'rochers') ajouter(Mo.rochers(arg));
    else if (nom === 'drone') double(Mo.drone());
    else if (nom === 'plateforme') double(Mo.plateformeMeca());
    const a = 0.75;
    camera.position.set(cible[0] + Math.sin(a) * dist, cible[1] + dist * 0.35, cible[2] + Math.cos(a) * dist);
    camera.lookAt(cible);
    r.render({ scene, camera, target: post.cible });
    post.composer({ halo: 0.9, flou: 0, aberration: 0, vignette: 0.3, grain: 0.02, temps: 1 });
    sortie[`${nom}-${arg}`] = c.toDataURL('image/png');
  }
  return sortie;
}, { liste, degats: Number(process.env.DEGATS || 0) });
for (const [n, d] of Object.entries(images)) writeFileSync(`${SORTIE}/banc-${n}${process.env.DEGATS ? '-degats' : ''}.png`, Buffer.from(d.split(',')[1], 'base64'));
console.log(Object.keys(images).join(', '));
await nav.close();
