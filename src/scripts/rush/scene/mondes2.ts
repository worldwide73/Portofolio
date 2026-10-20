// PORTAL RUSH 3D — LES SEPT AUTRES MONDES
//
// Même principe que Launch Protocol (voir mondes.ts) : une palette, des tronçons
// de 48 m construits pièce par pièce, un lointain. Chaque monde a sa propre
// architecture, ses silhouettes et ses matières, en accord avec sa mécanique :
//   Neon Drift      couloirs cadrés de néons, rails latéraux, ville en contrebas
//   Shattered Belt  piste flottante à travers astéroïdes et épaves de station
//   Laser Matrix    tranchée sécurisée : portiques scanners, clôtures laser, miradors
//   Quantum Rift    arches de cristal, plateformes fracturées, anneaux, portail géant
//   Voidstorm       station éventrée dans une tempête : poutres à nu, débris, éclairs
//   Core Sentinel   arène monumentale : colonnes, contreforts, conduits d'énergie
//   Singularity     arches tordues, anneaux orbitaux, débris en spirale, trou noir

import { Assembleur, Halos, mat, type Matiere, type RGB } from './geometrie';
import { M } from './modeles';
import { TRONCON, lampadaire, pilier, piste, poserModule, rnd, type Kit, type Lointain, type Palette } from './mondes';
import { decor } from './assets';

const L = TRONCON;

/** Un rocher (astéroïde, fragment) à facettes : roche claire au soleil, sombre dessous, parfois glacée. */
function rocher(a: Assembleur, x: number, y: number, z: number, r: number, graine: number, q: Matiere = M.roche, q2: Matiere = M.rocheSombre, loin = false) {
  a.pousser().deplacer(x, y, z).tourner(graine * 2.1, graine * 3.7, graine * 1.3);
  // (V4-H7) Une roche fracturée modélisée dans Blender (decor.prm), recolorée pour le monde ; pas au lointain
  // (des centaines de roches : la sphère à relief, plus légère, y suffit).
  const modele = loin ? undefined : decor[`roche-${Math.abs(graine) % 4}`];
  if (modele) {
    a.echelle(r * 1.15).importer(modele, (n) => (n[1] > -0.1 ? q : q2)).retirer();
    return;
  }
  a.sphere(r, r > 3 ? 3 : 2, q, (v) => 0.72 + 0.4 * Math.abs(Math.sin(v[0] * 3.1 + graine * 5) * Math.cos(v[1] * 2.7 + graine) * Math.sin(v[2] * 3.9 + graine * 2)), false, (v) => (v[1] > -0.1 ? q : q2));
  a.retirer();
}

/** Un arc polygonal (segments biseautés) autour de la piste ; « torsion » le déforme segment après segment. */
function arc(a: Assembleur, h: Halos, z: number, rayon: number, cy: number, segments: number, q: Matiere, lueur: Matiere, torsion = 0, couleur: RGB = [0.7, 0.55, 1]) {
  for (let i = 0; i <= segments; i++) {
    const t = Math.PI * (i / segments);
    const x = Math.cos(t) * rayon,
      y = cy + Math.sin(t) * rayon;
    if (y < -0.5) continue;
    a.pousser().deplacer(x, y, z + Math.sin(i * 1.3) * torsion * 2).tourner(torsion * (i - segments / 2) * 0.12, 0, t + Math.PI / 2);
    a.boite(0, 0, 0, (Math.PI * rayon) / segments + 0.15, 0.9, 1.1, q, 0.22);
    a.boite(0, -0.46, 0, (Math.PI * rayon) / segments - 0.2, 0.04, 0.5, lueur);
    a.retirer();
    if (i % 2 === 0) h.ajouter(x * 0.93, y - 0.5, z + 0.6, 0.8, couleur, 0.35);
  }
}

// ==========================================================================
// NEON DRIFT
// ==========================================================================
function tronconNeon(a: Assembleur, h: Halos, v: number) {
  const r = rnd(200 + v);
  piste(a, { plaque: mat('#363149', 0.8, 0.32), plaque2: mat('#46405f', 0.75, 0.3), bord: M.metalSombre, graine: v });
  const cyan: RGB = [0.37, 0.94, 1],
    rose: RGB = [1, 0.31, 0.85];
  for (let i = 0; i < L / 6; i++) {
    const z = -i * 6;
    // Le cadre du couloir : montants, linteau, néons intérieurs (cyan et magenta en alternance).
    const lueur = i % 2 ? M.accent : M.accent2;
    for (const s of [-1, 1]) {
      a.boite(s * 5.6, 3.2, z, 0.55, 7.4, 0.55, M.metalSombre, 0.1);
      a.boite(s * 5.31, 3.2, z, 0.04, 6.6, 0.16, lueur);
      // Les murs bas, leur ligne de néon, les vérins.
      a.boite(s * 5.7, 0.9, z - 3, 0.2, 2.2, 5.4, mat('#24202f', 0.7, 0.45), 0.04);
      a.boite(s * 5.58, 1.25, z - 3, 0.03, 0.06, 5.2, i % 3 ? M.accent2 : M.accent);
      if ((i + v) % 3 === 0) {
        a.pousser().deplacer(s * 5.45, 0.55, z - 3).tourner(Math.PI / 2);
        a.cylindre(0.14, 0.14, -1.6, 1.6, 10, M.alliage, true).cylindre(0.2, 0.2, -0.3, 0.3, 10, M.metalMoyen);
        a.retirer();
      }
      // Les rails latéraux, portés par des consoles.
      a.boite(s * 6.6, 3.6, z, 1.6, 0.18, 0.3, M.metalMoyen);
      a.boite(s * 6.6, 5.8, z, 1.6, 0.18, 0.3, M.metalMoyen);
    }
    a.boite(0, 7.05, z, 11.8, 0.5, 0.6, M.metalSombre, 0.1);
    a.boite(0, 6.77, z, 10.2, 0.04, 0.14, lueur);
    h.ajouter(0, 6.6, z + 0.3, 1.1, i % 2 ? cyan : rose, 0.28, 4);
    // Le plafond : poutres et câbles, panneaux holographiques suspendus.
    if (i % 2 === 0) {
      a.boite(-2.6, 7.4, z - 3, 0.18, 0.18, 6, M.metalMoyen);
      a.boite(2.6, 7.4, z - 3, 0.18, 0.18, 6, M.metalMoyen);
    }
    if ((i + v) % 4 === 1) {
      a.boite(0, 5.5, z - 3, 3.4, 0.9, 0.06, M.verre);
      a.boite(0, 5.5, z - 2.96, 2.8, 0.06, 0.02, M.accent2);
      a.boite(0, 5.2, z - 2.96, 1.8, 0.04, 0.02, M.accent);
      a.boite(-1.2, 6.4, z - 3, 0.03, 1.0, 0.03, M.acier);
      a.boite(1.2, 6.4, z - 3, 0.03, 1.0, 0.03, M.acier);
    }
  }
  for (const s of [-1, 1])
    for (const y of [3.75, 5.95]) {
      a.pousser().deplacer(s * 7.3, y, 0).tourner(Math.PI / 2);
      a.cylindre(0.13, 0.13, 0, L, 8, M.alliage, false);
      a.retirer();
    }
  // Une nacelle arrêtée sur un rail.
  const sn = v % 2 ? 1 : -1;
  a.boite(sn * 7.3, 4.4, -20 - r() * 10, 1.1, 1.1, 3.4, M.coqueSombre, 0.25);
  a.boite(sn * 6.76, 4.5, -22, 0.02, 0.3, 2.6, M.accent);
  // Dehors : les tours de la ville, en contrebas et alentour.
  for (let k = 0; k < 7; k++) {
    const s = k % 2 ? 1 : -1;
    const x = s * (16 + r() * 50);
    const z = -r() * L;
    const hh = 20 + r() * 60;
    const base = -40;
    // (V4-H7) Les trois premières : des tours modélisées dans Blender (façade tournée vers la piste).
    if (k < 3 && poserModule(a, h, (k + v) % 2 ? 'tour-neon-a' : 'tour-neon-b', x, base + (k === 1 ? -8 : 0), z, s)) continue;
    a.boite(x, base + hh / 2, z, 6 + r() * 8, hh, 6 + r() * 8, mat('#1d1a2a', 0.7, 0.45), 0.6);
    for (let y = base + 4; y < base + hh - 2; y += 2.2 + r() * 2) a.boite(x - s * 4.2, y, z, 0.05, 0.18, 4 + r() * 3, r() > 0.5 ? M.fenetre : r() > 0.5 ? M.accent2 : M.accent);
    h.ajouter(x, base + hh + 1, z, 2.2, r() > 0.5 ? cyan : rose, 0.6);
  }
}
const lointainNeon: Lointain = {
  planetes: [{ genre: 0, rayon: 380, pos: [-900, 380, -2400], a: '#3a1a5a', b: '#a04a9a', atmosphere: '#ff6ad8', graine: 4 }],
  structures: (a, h) => {
    const r = rnd(77);
    for (let k = 0; k < 90; k++) {
      const ang = (k / 90) * Math.PI * 2;
      const d = 500 + r() * 1100;
      const x = Math.sin(ang) * d,
        z = -Math.cos(ang) * d;
      const hh = 80 + r() * 520;
      a.boite(x, hh / 2 - 260, z, 30 + r() * 50, hh, 30 + r() * 50, mat('#140f20', 0.6, 0.5), 4);
      for (let y = -240; y < hh - 270; y += 26 + r() * 30) a.boite(x, y, z, 32 + r() * 48, 2.5, 32 + r() * 48, r() > 0.6 ? M.accent2 : M.fenetre);
      h.ajouter(x, hh - 250, z, 16, r() > 0.5 ? [0.37, 0.94, 1] : [1, 0.31, 0.85], 0.7);
    }
  },
};

// ==========================================================================
// SHATTERED BELT
// ==========================================================================
function tronconDebris(a: Assembleur, h: Halos, v: number) {
  const r = rnd(300 + v);
  piste(a, { plaque: mat('#6a6560', 0.72, 0.42), plaque2: mat('#57534f', 0.75, 0.45), bord: mat('#3a3633', 0.8, 0.45), abime: 0.28, graine: 30 + v });
  // Les stabilisateurs : des propulseurs sous la piste flottante.
  for (const z of [-10, -34]) {
    for (const s of [-1, 1]) {
      a.pousser().deplacer(s * 3.4, -1.6, z);
      a.cylindre(0.5, 0.7, -0.8, 0.6, 12, M.metalSombre).cylindre(0.45, 0.45, -0.82, -0.78, 12, M.accent2);
      a.retirer();
      h.ajouter(s * 3.4, -2.6, z, 1.4, [1, 0.55, 0.25], 0.55);
    }
  }
  // Des astéroïdes de toutes tailles, proches et lointains.
  for (let k = 0; k < 16; k++) {
    const s = k % 2 ? 1 : -1;
    const proche = k < 4;
    const x = s * (proche ? 7.5 + r() * 4 : 14 + r() * 70);
    const y = proche ? -2 + r() * 6 : -30 + r() * 60;
    rocher(a, x, y, -r() * L, proche ? 0.6 + r() * 1.2 : 2 + r() * 9, k + v * 10);
  }
  // Une épave de station : un module éventré, ses côtes à nu, des poutres tordues.
  const s = v % 2 ? 1 : -1;
  const x = s * (18 + r() * 8),
    y = 2 + r() * 6,
    z = -16 - r() * 16;
  a.pousser().deplacer(x, y, z).tourner(0.3 * r(), 0.8, 0.4 * s);
  a.pousser().tourner(Math.PI / 2).cylindre(3, 3, -6, 2, 14, M.metalMoyen, false).retirer();
  for (let c = -5; c <= 5; c += 2.2) a.pousser().deplacer(0, 0, c).tore(3.05, 0.18, 14, 4, M.metalSombre, 0, Math.PI * (1.1 + r() * 0.8)).retirer();
  a.boite(0, 0, -2.5, 6.4, 0.25, 3, M.metalSombre);
  a.boite(1.5, 1.2, -1, 0.04, 0.5, 2.4, M.fenetre);
  a.retirer();
  for (let k = 0; k < 4; k++) a.poutre([x + (r() - 0.5) * 8, y + (r() - 0.5) * 6, z + r() * 6], [x + (r() - 0.5) * 14, y + (r() - 0.5) * 10, z - r() * 10], 0.35, M.metalMoyen);
  // Des plaques arrachées qui dérivent.
  for (let k = 0; k < 5; k++) {
    a.pousser().deplacer((r() - 0.5) * 40, 4 + r() * 12, -r() * L).tourner(r() * 3, r() * 3, r() * 3);
    a.boite(0, 0, 0, 1 + r() * 2.5, 0.12, 1 + r() * 2, M.plaque);
    a.retirer();
  }
  lampadaire(a, h, 4.62, -12, [1, 0.8, 0.55]);
  lampadaire(a, h, -4.62, -36, [1, 0.8, 0.55]);
}
const lointainDebris: Lointain = {
  planetes: [
    { genre: 0, rayon: 700, pos: [-1300, 140, -3000], a: '#6b4a2e', b: '#d9b48a', atmosphere: '#ffcf9a', graine: 2, anneau: { r0: 900, r1: 1500, a: '#d9c2a0', b: '#7a6650', inclinaison: [1.35, 0.2, 0.25] } },
    { genre: 2, rayon: 60, pos: [600, 320, -2200], a: '#5a554f', b: '#8a837a', atmosphere: '#998877', graine: 6 },
  ],
  structures: (a) => {
    const r = rnd(5);
    // La ceinture : des centaines de rochers sur un anneau lointain.
    for (let k = 0; k < 260; k++) {
      const ang = r() * Math.PI * 2;
      const d = 600 + r() * 900;
      rocher(a, Math.cos(ang) * d, -60 + Math.sin(ang * 3) * 80 + (r() - 0.5) * 60, -Math.abs(Math.sin(ang)) * d - 200, 6 + r() * 26, k, M.roche, M.rocheSombre, true);
    }
  },
};

// ==========================================================================
// LASER MATRIX
// ==========================================================================
function tronconLaser(a: Assembleur, h: Halos, v: number) {
  const r = rnd(400 + v);
  piste(a, { plaque: mat('#3c4a55', 0.8, 0.34), plaque2: mat('#2f3b45', 0.8, 0.36), bord: M.metalSombre, graine: 40 + v, dessous: false });
  const rouge: RGB = [1, 0.25, 0.25],
    cyan: RGB = [0.4, 0.95, 1];
  // La tranchée : murs latéraux, panneaux, feux d'alerte. (V4-H7) Le mur modélisé dans Blender s'il est chargé.
  for (const s of [-1, 1]) {
    if (decor['mur-tranchee']) for (let z = 3; z < L; z += 6) poserModule(a, h, 'mur-tranchee', 0, 0, -z, s);
    else {
      a.boite(s * 5.4, 0.7, -L / 2, 0.6, 3.2, L, mat('#26313a', 0.75, 0.45));
      for (let z = 3; z < L; z += 6) {
        a.boite(s * 5.09, 1.0, -z, 0.02, 1.8, 4.6, M.metalMoyen);
        a.boite(s * 5.08, 1.9, -z, 0.02, 0.08, 4.2, M.accent);
        a.boite(s * 5.08, 0.25, -z - 2.6, 0.03, 0.2, 0.2, M.danger);
      }
    }
    // Au-delà : les plateformes en grille et les clôtures laser.
    a.boite(s * 12, -0.9, -L / 2, 12, 0.15, L, M.metalSombre);
    for (let x = 7; x < 18; x += 1.5) a.boite(s * x, -0.8, -L / 2, 0.08, 0.06, L, M.metalMoyen);
    for (let z = 0; z < L; z += 1.5) a.boite(s * 12, -0.8, -z, 11, 0.06, 0.08, M.metalMoyen);
    for (let z = 0; z < L; z += 8) {
      a.boite(s * 9, 0.4, -z, 0.2, 2.6, 0.2, M.acier);
      if (z + 8 <= L) for (const y of [0.2, 0.8, 1.4]) a.boite(s * 9, y, -z - 4, 0.03, 0.03, 7.8, M.dangerDoux);
    }
  }
  // Le portique scanner, tous les 24 m : cadre carré, barre de balayage, projecteurs rouges.
  for (const z of [-6, -30]) {
    if (poserModule(a, h, 'scanner', 0, 0, z)) {
      h.ajouter(0, 6.7, z + 0.2, 1.4, cyan, 0.3, 5);
      continue;
    }
    for (const s of [-1, 1]) {
      a.boite(s * 5.9, 3.5, z, 0.8, 7.5, 1.0, M.metalMoyen, 0.15);
      a.boite(s * 5.48, 3.5, z, 0.03, 6.4, 0.5, M.accent);
      a.boite(s * 5.9, 7.4, z + 0.55, 0.4, 0.3, 0.2, M.danger);
      h.ajouter(s * 5.9, 7.4, z + 0.7, 0.9, rouge, 0.6);
    }
    a.boite(0, 7.3, z, 12.6, 0.9, 1.1, M.metalSombre, 0.15);
    a.boite(0, 6.83, z, 10.6, 0.05, 0.3, M.accent);
    h.ajouter(0, 6.7, z + 0.2, 1.4, cyan, 0.3, 5);
    for (let i = -3; i <= 3; i++) a.boite(i * 1.4, 7.79, z, 0.3, 0.06, 0.6, M.danger);
  }
  // Les miradors : un fût, une cabine vitrée, un projecteur.
  const s = v % 2 ? 1 : -1;
  for (const [x, z] of [
    [s * (16 + r() * 4), -18],
    [-s * (20 + r() * 6), -40],
  ] as const) {
    a.boite(x, 4, z, 1.4, 10, 1.4, M.metalSombre, 0.2);
    a.boite(x, 9.8, z, 4.2, 2.4, 4.2, M.verre, 0.4);
    a.boite(x, 9.8, z, 4.3, 0.08, 4.3, M.accent);
    a.boite(x, 11.2, z, 4.8, 0.4, 4.8, M.metalMoyen, 0.3);
    a.boite(x - Math.sign(x) * 2.2, 9.3, z, 0.4, 0.4, 0.6, M.blanc);
    h.ajouter(x - Math.sign(x) * 2.4, 9.3, z + 0.3, 2.2, [0.9, 0.95, 1], 0.55);
    h.ajouter(x, 11.8, z, 1, rouge, 0.7);
  }
  // Les blocs de l'installation, plus loin.
  for (let k = 0; k < 4; k++) {
    const sx = k % 2 ? 1 : -1;
    const x = sx * (28 + r() * 30),
      z = -r() * L,
      hh = 6 + r() * 16;
    a.boite(x, hh / 2 - 1, z, 8 + r() * 10, hh, 8 + r() * 10, mat('#1c252d', 0.7, 0.5), 0.4);
    a.boite(x - sx * 5, hh - 2, z, 0.05, 0.3, 6, M.accent);
    h.ajouter(x, hh, z, 1.2, rouge, 0.5);
  }
}
const lointainLaser: Lointain = {
  planetes: [{ genre: 2, rayon: 160, pos: [800, 520, -2600], a: '#7a8a96', b: '#c0ccd4', atmosphere: '#9fe8ff', graine: 9 }],
  structures: (a, h) => {
    const r = rnd(41);
    for (let k = 0; k < 14; k++) {
      const x = (k % 2 ? 1 : -1) * (300 + r() * 900),
        z = -800 - r() * 1600,
        hh = 120 + r() * 380;
      a.boite(x, hh / 2 - 200, z, 120 + r() * 160, hh, 120 + r() * 160, mat('#121a20', 0.6, 0.5), 8);
      for (let y = -180; y < hh - 210; y += 40) a.boite(x, y, z, 130, 3, 130, M.accent);
      h.ajouter(x, hh - 195, z, 18, [1, 0.25, 0.25], 0.8);
    }
  },
};

// ==========================================================================
// QUANTUM RIFT
// ==========================================================================
function tronconRift(a: Assembleur, h: Halos, v: number) {
  const r = rnd(500 + v);
  piste(a, { plaque: mat('#3a3354', 0.8, 0.3), plaque2: mat('#4d4573', 0.72, 0.26), bord: mat('#241e38', 0.8, 0.4), graine: 50 + v });
  const violet: RGB = [0.7, 0.55, 1],
    cyan: RGB = [0.37, 0.9, 1];
  const cristal = mat('#3b2c66', 0.6, 0.15);
  // Les arches de cristal : deux par tronçon, la seconde décalée. (V4-H7) Faites d'éclats modélisés dans
  // Blender (prismes à pointe lumineuse sur une âme de métal) si le monde est chargé.
  const arche = decor['arche-cristal'];
  const archeCristal = (z: number, rayon: number, cy: number, renverse = false) => {
    a.pousser().deplacer(0, cy, z);
    if (renverse) a.tourner(0, 0, Math.PI);
    a.echelle(rayon / 7, rayon / 7, 1).importer(arche!).retirer();
  };
  if (arche) {
    archeCristal(-10, 6.6, -0.6);
    archeCristal(-34, 7.4, -1.2);
    archeCristal(-22, 8, 26, true);
    for (const [x, y, z] of [[0, 6.0, -10], [0, 6.2, -34]] as const) h.ajouter(x, y, z + 0.3, 2.2, violet, 0.3, 4);
  } else {
    arc(a, h, -10, 6.6, -0.6, 9, cristal, M.accent, 0, violet);
    arc(a, h, -34, 7.4, -1.2, 11, cristal, M.accent2, 0.15, cyan);
    // Une arche renversée, en miroir, au-dessus (le passage dimensionnel).
    a.pousser().deplacer(0, 26, -22).tourner(0, 0, Math.PI);
    arc(a, new Halos(), 0, 8, 0, 10, cristal, M.accent, 0, violet);
    a.retirer();
  }
  // Des grappes de cristaux au bord de la piste, hors des voies.
  if (decor['grappe-cristaux'])
    for (let k = 0; k < 3; k++) {
      const s = (k + v) % 2 ? 1 : -1;
      a.pousser().deplacer(s * (6.5 + k * 2.2), -0.4, -8 - k * 14).tourner(0, k * 1.7, s * 0.15).echelle(0.8 + (k % 2) * 0.5).importer(decor['grappe-cristaux']).retirer();
    }
  h.ajouter(0, 18.5, -21.4, 2.4, violet, 0.35, 4);
  // Des plateformes fracturées qui flottent : roche dessous, plaque de métal dessus.
  for (let k = 0; k < 6; k++) {
    const s = k % 2 ? 1 : -1;
    const x = s * (10 + r() * 30),
      y = -4 + r() * 22,
      z = -r() * L;
    a.pousser().deplacer(x, y, z).tourner((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
    a.pousser().echelle(1, 0.55, 1);
    rocher(a, 0, -1, 0, 2 + r() * 3, k + v, mat('#2a2238', 0.1, 0.85), mat('#18131f', 0.1, 0.9));
    a.retirer();
    a.boite(0, 0.2, 0, 3.4 + r() * 2, 0.3, 3 + r() * 2, mat('#4a4466', 0.8, 0.3), 0.2);
    a.boite(0, 0.37, 0, 2.4, 0.03, 0.06, M.accent);
    if (k % 2 === 0 && decor['grappe-cristaux']) a.pousser().deplacer(0.6, 0.6, 0.4).echelle(0.7).importer(decor['grappe-cristaux']).retirer();
    a.retirer();
  }
  // Des anneaux suspendus, inclinés, dont l'intérieur luit.
  for (let k = 0; k < 2; k++) {
    const s = (k + v) % 2 ? 1 : -1;
    a.pousser().deplacer(s * (16 + r() * 10), 6 + r() * 8, -r() * L).tourner(r() * 1.2, r() * 2, r());
    a.tore(4 + r() * 3, 0.28, 48, 6, mat('#2b2245', 0.85, 0.25));
    a.tore(3.8 + r() * 0.1, 0.06, 48, 5, k ? M.accent2 : M.accent);
    a.retirer();
  }
  // Des flux d'énergie, étirés, entre les plateformes.
  for (let k = 0; k < 6; k++) h.ajouter((r() - 0.5) * 60, 4 + r() * 20, -r() * L, 1.2 + r(), r() > 0.5 ? violet : cyan, 0.4, 6 + r() * 6);
}
const lointainRift: Lointain = {
  planetes: [
    { genre: 2, rayon: 260, pos: [-900, 300, -2600], a: '#3a2a5a', b: '#7a6aa8', atmosphere: '#b48cff', graine: 12 },
    { genre: 2, rayon: 120, pos: [-640, 160, -2350], a: '#2a1e44', b: '#6a5a96', atmosphere: '#b48cff', graine: 13 },
  ],
  structures: (a, h) => {
    // Le portail géant, au bout du passage.
    a.pousser().deplacer(0, 240, -2600);
    a.tore(420, 18, 120, 8, mat('#2b2245', 0.85, 0.25));
    a.tore(400, 6, 120, 6, M.accent);
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      a.pousser().tourner(0, 0, t).deplacer(430, 0, 0).boite(0, 0, 0, 60, 40, 50, mat('#3b2c66', 0.6, 0.15), 8).retirer();
      h.ajouter(Math.cos(t) * 400, 240 + Math.sin(t) * 400, -2580, 30, [0.7, 0.55, 1], 0.5);
    }
    a.retirer();
  },
};

// ==========================================================================
// VOIDSTORM
// ==========================================================================
function tronconTempete(a: Assembleur, h: Halos, v: number) {
  const r = rnd(600 + v);
  piste(a, { plaque: mat('#4a505c', 0.72, 0.42), plaque2: mat('#30343c', 0.7, 0.5), bord: mat('#2a2e36', 0.8, 0.5), abime: 0.38, graine: 60 + v });
  const orange: RGB = [1, 0.7, 0.3];
  // La station éventrée : des cadres dont il manque des morceaux, des poutres à nu.
  for (let i = 0; i < L / 8; i++) {
    const z = -i * 8 - 2;
    const casse = r();
    // (V4-H7) Les cadres en poutres en I modélisés dans Blender, intacts ou brisés (tantôt d'un côté, tantôt de
    // l'autre), avec leurs câbles pendants ; les panneaux tordus restent.
    if (decor['cadre-station']) {
      poserModule(a, h, casse > 0.6 ? 'cadre-brise' : 'cadre-station', 0, 0, z, casse > 0.6 && i % 2 ? -1 : 1);
      for (const s of [-1, 1])
        if (r() > 0.35) {
          a.pousser().deplacer(s * 6.6, 2 + r() * 3, z - 4).tourner((r() - 0.5) * 0.5, s * (0.2 + r() * 0.4), (r() - 0.5) * 0.6);
          a.boite(0, 0, 0, 0.12, 2.4 + r() * 2, 3 + r() * 3, mat('#3a3f48', 0.75, 0.5), 0.05);
          a.retirer();
        }
      continue;
    }
    for (const s of [-1, 1]) {
      const hh = casse > 0.6 && s > 0 ? 2 + r() * 3 : 8;
      a.boite(s * 6.2, hh / 2 - 1, z, 0.6, hh, 0.6, M.metalSombre, 0.1);
      if (hh < 8) {
        // Le montant brisé : son sommet arraché, des étincelles.
        a.pousser().deplacer(s * 6.6, hh - 0.6, z + 0.8).tourner(0.6, 0, s * 0.9).boite(0, 0, 0, 0.5, 3, 0.5, M.metalSombre, 0.1).retirer();
        h.ajouter(s * 6.2, hh - 0.8, z + 0.4, 0.7, orange, 0.8);
      }
      // Des panneaux muraux tordus.
      if (r() > 0.35) {
        a.pousser().deplacer(s * 6.5, 2 + r() * 3, z - 4).tourner((r() - 0.5) * 0.5, s * (0.2 + r() * 0.4), (r() - 0.5) * 0.6);
        a.boite(0, 0, 0, 0.12, 2.4 + r() * 2, 3 + r() * 3, mat('#3a3f48', 0.75, 0.5), 0.05);
        a.retirer();
      }
    }
    if (casse < 0.6) {
      a.boite(0, 7.2, z, 13, 0.6, 0.7, M.metalSombre, 0.1);
      if (r() > 0.5) a.boite((r() - 0.5) * 6, 6.5, z, 2.4, 0.06, 0.3, M.blanc);
    } else a.poutre([-6.2, 7, z], [1.5 + r() * 2, 2 + r() * 2, z - 1.5], 0.45, M.metalSombre);
    // Des câbles qui pendent.
    if (r() > 0.4) a.boite((r() - 0.5) * 8, 5.2, z - 1, 0.04, 3.4, 0.04, M.caoutchouc);
  }
  // Des poutres flottantes et des débris dans la tempête.
  for (let k = 0; k < 10; k++) {
    const x = (r() > 0.5 ? 1 : -1) * (9 + r() * 40);
    a.poutre([x, -6 + r() * 20, -r() * L], [x + (r() - 0.5) * 10, -6 + r() * 20, -r() * L], 0.3 + r() * 0.4, M.metalMoyen);
  }
  for (let k = 0; k < 8; k++) rocher(a, (r() > 0.5 ? 1 : -1) * (10 + r() * 50), -8 + r() * 30, -r() * L, 0.8 + r() * 3, k + v * 7, mat('#3a3d44', 0.4, 0.7), mat('#202227', 0.4, 0.8));
  // (V4-H7) Un paratonnerre monumental par tronçon, d'un côté puis de l'autre : la tempête frappe dessus.
  if (decor.paratonnerre) poserModule(a, h, 'paratonnerre', (v % 2 ? 1 : -1) * (17 + r() * 8), -9, -10 - r() * 28);
  // Des feux de secours, orange, sur ce qui tient encore.
  for (let z = 4; z < L; z += 12) {
    a.boite(4.5, 0.6, -z, 0.15, 0.15, 0.15, M.accent2);
    h.ajouter(4.5, 0.6, -z + 0.2, 0.9, orange, 0.7);
  }
}
const lointainTempete: Lointain = {
  planetes: [],
  structures: (a, h) => {
    // La silhouette d'une station géante, à moitié détruite, dans les nuages.
    a.pousser().deplacer(500, 80, -1500).tourner(0.1, -0.5, 0.2);
    a.boite(0, 0, 0, 900, 60, 140, mat('#14171d', 0.7, 0.5), 10);
    for (let i = -4; i <= 4; i++) a.boite(i * 100, 80 + Math.abs(i) * 10, 0, 40, 160 - Math.abs(i) * 20, 40, mat('#14171d', 0.7, 0.5), 6);
    a.boite(-420, -80, 0, 80, 200, 80, mat('#14171d', 0.7, 0.5), 6);
    a.retirer();
    for (let i = 0; i < 10; i++) h.ajouter(150 + i * 70, 60 + (i % 3) * 20, -1440, 10, [1, 0.7, 0.3], 0.6);
  },
};

// ==========================================================================
// CORE SENTINEL
// ==========================================================================
function tronconSentinelle(a: Assembleur, h: Halos, v: number) {
  const r = rnd(700 + v);
  piste(a, { plaque: mat('#5a4a40', 0.78, 0.36), plaque2: mat('#4a3c33', 0.8, 0.38), bord: mat('#2e231c', 0.8, 0.42), graine: 70 + v });
  const braise: RGB = [1, 0.6, 0.3];
  const pierre = mat('#2b221c', 0.55, 0.55);
  // Le sol de l'arène, de part et d'autre de la piste.
  for (const s of [-1, 1]) {
    a.boite(s * 11, -0.45, -L / 2, 13, 0.5, L, pierre);
    for (let z = 0; z < L; z += 6) a.boite(s * 11, -0.19, -z, 12.6, 0.02, 0.1, M.accent2);
    a.boite(s * 4.95, -0.18, -L / 2, 0.05, 0.03, L, M.accent);
    // Les conduits d'énergie le long de la piste.
    a.pousser().deplacer(s * 6.2, 0.4, 0).tourner(Math.PI / 2);
    a.cylindre(0.35, 0.35, 0, L, 12, M.metalMoyen, false);
    for (let z = 2; z < L; z += 4) a.cylindre(0.37, 0.37, z, z + 0.7, 12, M.accent2, false);
    a.retirer();
  }
  // Les colonnes monumentales, leurs contreforts et leurs conduits verticaux.
  for (const z of [-12, -36]) {
    for (const s of [-1, 1]) {
      const x = s * 17;
      // (V4-H7) La colonne de forteresse modélisée dans Blender (fût octogonal à bandes blindées, contreforts,
      // canal d'énergie tourné vers la piste, chapiteau crénelé), s'il est chargé.
      if (poserModule(a, h, 'colonne-forteresse', x, 0, z, s)) continue;
      pilier(a, x, z, -1, 44, 3.4, pierre);
      a.boite(x - s * 1.72, 21, z, 0.06, 40, 0.5, M.accent2);
      a.poutre([x + s * 1.5, 6, z], [x + s * 9, -1, z], 1.4, pierre);
      a.poutre([x, 6, z + 1.5], [x, -1, z + 7], 1.2, pierre);
      h.ajouter(x - s * 1.9, 20, z + 0.4, 2.4, braise, 0.35, 0.5);
    }
  }
  // Les tourelles de défense, braquées sur la piste, sous l'arche.
  if (decor.tourelle) for (const s of [-1, 1]) poserModule(a, h, 'tourelle', s * (8.8 + (v % 2) * 1.5), -0.2, -24 + s * 3, s);
  // L'arche colossale, une fois par tronçon.
  a.boite(0, 42, -24, 40, 4, 5, pierre, 0.8);
  a.boite(0, 39.9, -24, 34, 0.1, 1.2, M.accent2);
  for (let i = -3; i <= 3; i++) h.ajouter(i * 5, 39.6, -23, 2, braise, 0.5);
  // Des blocs de l'installation, et la chaleur au sol.
  for (let k = 0; k < 3; k++) {
    const s = k % 2 ? 1 : -1;
    const x = s * (24 + r() * 16),
      z = -r() * L;
    a.boite(x, 3, z, 6 + r() * 6, 8 + r() * 10, 6 + r() * 6, pierre, 0.5);
    a.boite(x - s * 3.4, 4, z, 0.05, 6, 2, M.accent2);
  }
}
const lointainSentinelle: Lointain = {
  planetes: [],
  structures: (a, h) => {
    // Le noyau central de l'installation, au loin : une sphère cerclée, ses pylônes.
    a.pousser().deplacer(0, 260, -2800);
    a.sphere(240, 3, mat('#ffb066', 0, 0.5, 1.6, 0));
    a.pousser().tourner(1.3).tore(420, 22, 96, 8, mat('#2b221c', 0.6, 0.5)).tore(400, 6, 96, 6, M.accent2).retirer();
    a.pousser().tourner(0.3, 0.6).tore(520, 18, 96, 8, mat('#2b221c', 0.6, 0.5)).retirer();
    a.retirer();
    h.ajouter(0, 260, -2500, 600, [1, 0.6, 0.3], 0.5);
    for (const x of [-900, -500, 500, 900]) {
      a.boite(x, 0, -2200, 80, 900, 80, mat('#1c1511', 0.6, 0.5), 10);
      a.boite(x, 0, -2158, 6, 860, 4, M.accent2);
    }
  },
};

// ==========================================================================
// SINGULARITY
// ==========================================================================
function tronconSingularite(a: Assembleur, h: Halos, v: number) {
  const r = rnd(800 + v);
  piste(a, { plaque: mat('#2f2b3f', 0.85, 0.22), plaque2: mat('#3e3954', 0.82, 0.2), bord: mat('#1b1826', 0.85, 0.3), graine: 80 + v });
  const blanc: RGB = [0.92, 0.88, 1],
    violet: RGB = [0.7, 0.55, 1];
  const metal = mat('#2a2638', 0.9, 0.2);
  // Les arches tordues par la gravité : chaque segment pivote un peu plus.
  arc(a, h, -8, 7, -0.8, 12, metal, M.accent, 0.7 + v * 0.2, blanc);
  arc(a, h, -32, 8.2, -1.5, 14, metal, M.accent, -0.9, violet);
  // Des anneaux orbitaux autour de la piste, inclinés.
  a.pousser().deplacer(0, 3, -20).tourner(0.35 + r() * 0.2, 0, 0.2 * (v - 1));
  a.tore(11, 0.25, 72, 6, metal);
  a.tore(10.6, 0.06, 72, 5, M.accent);
  a.retirer();
  // Des débris en spirale, aspirés vers le trou noir.
  for (let k = 0; k < 26; k++) {
    const t = k * 0.55 + v;
    const d = 12 + k * 1.6;
    const x = Math.cos(t) * d,
      y = 4 + Math.sin(t) * d * 0.6,
      z = -(k / 26) * L;
    if (k % 3 === 0) rocher(a, x, y, z, 0.6 + r() * 1.8, k + v * 3, mat('#3a3548', 0.4, 0.6), mat('#1a1724', 0.4, 0.8));
    else if (k % 3 === 1 && decor['fragment-coque']) {
      // (V4-H7) Un fragment de coque arraché (modélisé dans Blender), qui tournoie vers le trou noir.
      a.pousser().deplacer(x, y, z).tourner(t, t * 1.3, t * 0.7).echelle(0.35 + r() * 0.4).importer(decor['fragment-coque']).retirer();
    } else {
      a.pousser().deplacer(x, y, z).tourner(t, t * 1.3, t * 0.7);
      a.boite(0, 0, 0, 1 + r() * 2, 0.1, 0.8 + r(), metal);
      a.retirer();
    }
    if (k % 4 === 0) h.ajouter(x, y, z, 0.8, violet, 0.4, 3);
  }
  // (V4-H7) Un tiers d'anneau d'habitat éventré, incliné au-dessus de la piste, d'un côté puis de l'autre.
  if (decor['anneau-brise']) {
    const s = v % 2 ? 1 : -1;
    a.pousser().deplacer(s * 9, 2, -24).tourner(0.5, s * 0.6, s * 0.4);
    poserModule(a, h, 'anneau-brise', 0, 0, 0, s);
    a.retirer();
  }
  // Des structures étirées, comme happées.
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    a.pousser().deplacer(s * (20 + r() * 10), 10, -r() * L).tourner(0.3, 0, s * 0.5).echelle(1, 3, 1);
    a.boite(0, 0, 0, 2.4, 6, 2.4, metal, 0.6);
    a.boite(s * -1.21, 0, 0, 0.03, 5, 0.2, M.accent);
    a.retirer();
  }
}
const lointainSingularite: Lointain = {
  planetes: [],
  disque: { pos: [0, 340, -3200], r0: 320, r1: 1400, a: '#fff1d8', b: '#5a2a8a', inclinaison: [1.32, 0, 0.18], trou: 290 },
  structures: (a, h) => {
    // Les anneaux orbitaux géants autour du trou noir, et le liseré de lumière.
    a.pousser().deplacer(0, 340, -3200).tourner(0.6, 0.4, 0.2);
    a.tore(1700, 14, 160, 6, mat('#2a2638', 0.9, 0.2));
    a.tore(1700, 4, 160, 5, M.accent);
    a.retirer();
    h.ajouter(0, 340, -3150, 330, [0.95, 0.9, 1], 0.6);
  },
};

// ==========================================================================
// LES PALETTES
// ==========================================================================
const P: Record<string, Palette> = {
  neon: { haut: '#05030d', horizon: '#2a0d3d', bas: '#030208', nebuleuse1: '#5a1a6e', nebuleuse2: '#0d4a6e', densite: 0.7, etoiles: 0.6, voile: 0.15, soleilDir: [0.3, 0.5, -0.8], soleil: '#ffd6f0', soleilForce: 1.4, ciel: '#7a4aa8', cielForce: 0.55, sol: '#140a1e', brouillard: '#120820', brume: [60, 400], accent: '#5ef0ff', accent2: '#ff4fd8', exposition: 1.25 },
  debris: { haut: '#040507', horizon: '#1c1a1e', bas: '#030304', nebuleuse1: '#3a2a1e', nebuleuse2: '#1e2a3a', densite: 0.45, etoiles: 1, voile: 0.1, soleilDir: [0.6, 0.35, -0.7], soleil: '#ffe2c0', soleilForce: 3, ciel: '#5a5560', cielForce: 0.45, sol: '#16130f', brouillard: '#0d0c0e', brume: [90, 560], accent: '#ffd9a8', accent2: '#ff8a3a', exposition: 1.15 },
  laser: { haut: '#020407', horizon: '#0a2230', bas: '#010204', nebuleuse1: '#0a3a4a', nebuleuse2: '#3a0a14', densite: 0.35, etoiles: 0.8, voile: 0.2, soleilDir: [-0.3, 0.6, -0.7], soleil: '#d8f4ff', soleilForce: 1.9, ciel: '#3a7a9a', cielForce: 0.55, sol: '#081014', brouillard: '#06141c', brume: [70, 440], accent: '#62f2ff', accent2: '#ff3b48', exposition: 1.18 },
  rift: { haut: '#04020a', horizon: '#22104a', bas: '#020106', nebuleuse1: '#5a2aa8', nebuleuse2: '#1a6aa8', densite: 0.7, etoiles: 1, voile: 0.1, soleilDir: [0.2, 0.7, -0.6], soleil: '#e6d8ff', soleilForce: 1.7, ciel: '#8a6ad8', cielForce: 0.6, sol: '#120a22', brouillard: '#100826', brume: [70, 480], accent: '#b48cff', accent2: '#5ee8ff', exposition: 1.22 },
  tempete: { haut: '#020305', horizon: '#151a22', bas: '#020203', nebuleuse1: '#2a3344', nebuleuse2: '#1a1e2a', densite: 1.3, etoiles: 0.2, voile: 0.5, soleilDir: [-0.2, 0.4, -0.9], soleil: '#c8d4ff', soleilForce: 1.3, ciel: '#56607a', cielForce: 0.5, sol: '#0c0e12', brouillard: '#11151c', brume: [25, 170], accent: '#cfe0ff', accent2: '#ffb347', exposition: 1.3, eclairs: true },
  sentinelle: { haut: '#050302', horizon: '#2a1608', bas: '#030201', nebuleuse1: '#5a2a0a', nebuleuse2: '#3a0a0a', densite: 0.6, etoiles: 0.5, voile: 0.25, soleilDir: [0, 0.45, -1], soleil: '#ffd2a0', soleilForce: 2.2, ciel: '#a8683a', cielForce: 0.5, sol: '#1a0e06', brouillard: '#1c0f07', brume: [80, 560], accent: '#ffb066', accent2: '#ff5a2a', exposition: 1.15 },
  singularite: { haut: '#000000', horizon: '#0c0718', bas: '#000000', nebuleuse1: '#3a1a6a', nebuleuse2: '#6a3a1a', densite: 0.8, etoiles: 1.2, voile: 0.05, soleilDir: [0, 0.25, -1], soleil: '#f0e6ff', soleilForce: 1.9, ciel: '#6a5aa8', cielForce: 0.5, sol: '#08060e', brouillard: '#06040c', brume: [70, 540], accent: '#e6dcff', accent2: '#ffffff', exposition: 1.22 },
};

export const NEON: Kit = { palette: P.neon, variantes: 3, troncon: tronconNeon, lointain: lointainNeon };
export const DEBRIS: Kit = { palette: P.debris, variantes: 3, troncon: tronconDebris, lointain: lointainDebris };
export const LASER: Kit = { palette: P.laser, variantes: 2, troncon: tronconLaser, lointain: lointainLaser };
export const RIFT: Kit = { palette: P.rift, variantes: 3, troncon: tronconRift, lointain: lointainRift };
export const TEMPETE: Kit = { palette: P.tempete, variantes: 3, troncon: tronconTempete, lointain: lointainTempete };
export const SENTINELLE: Kit = { palette: P.sentinelle, variantes: 2, troncon: tronconSentinelle, lointain: lointainSentinelle };
export const SINGULARITE: Kit = { palette: P.singularite, variantes: 3, troncon: tronconSingularite, lointain: lointainSingularite };
export { Halos };
