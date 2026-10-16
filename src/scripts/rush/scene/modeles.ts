// PORTAL RUSH 3D — LES MODÈLES
//
// Le vaisseau, les obstacles, les collectibles, les portails et les boss,
// construits pièce par pièce (voir geometrie.ts). Unités : le mètre. La piste
// file vers -z ; une voie fait VOIE mètres de large ; y = 0 est le dessus des
// plaques. Chaque obstacle est centré sur sa voie, sa rangée en z = 0.
//
// Le vaisseau garde une seule forme (la même boîte de collision pour tous : les
// collisions sont décidées par le moteur, par voie) ; le garage ne change que
// ses couleurs, ce qui ne peut pas modifier la difficulté.

import { Assembleur, CANAL, Halos, mat, type Matiere, type V3 } from './geometrie';

export const VOIE = 2.6;
const HACHURE = mat('#f0b52a', 0.3, 0.5, 0.22);
export const HAUTEUR_VOL = 0.78;

/** La palette commune des matières. */
export const M = {
  coque: mat('#e9eef6', 0.35, 0.3, 0, CANAL.peinture),
  coqueSombre: mat('#1b212c', 0.85, 0.36),
  alliage: mat('#a5b1c2', 0.95, 0.24),
  metalSombre: mat('#262d39', 0.82, 0.48),
  metalMoyen: mat('#485366', 0.86, 0.4),
  acier: mat('#6c7789', 0.9, 0.5),
  plaque: mat('#5a6576', 0.78, 0.36),
  plaqueClaire: mat('#8592a6', 0.7, 0.34),
  joint: mat('#0b0e13', 0.2, 0.92),
  caoutchouc: mat('#14171d', 0.05, 0.85),
  verre: mat('#0c1a2e', 0.6, 0.05),
  cockpit: mat('#1d4468', 0.75, 0.03, 0.12),
  accent: mat('#ffffff', 0, 0.5, 1, CANAL.accent),
  accentDoux: mat('#ffffff', 0, 0.5, 0.35, CANAL.accent),
  ligne: mat('#0e1622', 0.3, 0.55, 1, CANAL.ligne),
  fissure: mat('#1b0f0d', 0.45, 0.75, 1.3, CANAL.fissure),
  accent2: mat('#ffffff', 0, 0.5, 1, CANAL.accent2),
  coeur: mat('#ffffff', 0, 0.3, 1.2, CANAL.coeur),
  blanc: mat('#eaf3ff', 0, 0.5, 1),
  fenetre: mat('#cfe3ff', 0, 0.5, 0.45),
  danger: mat('#ff3a2e', 0, 0.5, 1, CANAL.danger),
  dangerDoux: mat('#ff3a2e', 0, 0.5, 0.35, CANAL.danger),
  jaune: mat('#e5a61c', 0.35, 0.52),
  noir: mat('#111216', 0.35, 0.6),
  orange: mat('#c97a24', 0.45, 0.48),
  roche: mat('#3d3936', 0.05, 0.92),
  rocheSombre: mat('#25221f', 0.05, 0.95),
  braise: mat('#ff6a2a', 0, 0.6, 1.4),
  or: mat('#ffcb5c', 1, 0.2, 0.45),
  cristal: mat('#9fe6ff', 0.3, 0.08, 0.95),
  navRouge: mat('#ff4a4a', 0, 0.5, 1.2),
  navVert: mat('#4dffa0', 0, 0.5, 1.2),
  /** Feux à éclats (blanc, rouge) : ils clignotent (voir le canal « clignote »). */
  eclatBlanc: mat('#f4f8ff', 0, 0.5, 1.4, CANAL.clignote),
  eclatRouge: mat('#ff3b30', 0, 0.5, 1.4, CANAL.clignote),
  /** La seconde peinture du vaisseau : la couleur d'Overdrive choisie au garage, sans lumière. */
  peinture2: mat('#ffffff', 0.4, 0.32, 0, CANAL.peinture2),
  verrerie: mat('#0a1d33', 0.9, 0.02, 0.06),
  carbone: mat('#15181e', 0.55, 0.42),
};

// ==========================================================================
// LE VAISSEAU : un chasseur profilé, détaillé pièce par pièce
// Fuselage à arêtes vives, lignes de panneaux, bandes de course (couleur d'Overdrive), verrière à arceaux,
// nez à capteurs, ailes à ailerons et nacelles, deux dérives, moteurs à entrées d'air à aubes et tuyères à
// volets, grilles, antennes, trappes, feux à éclats. Toujours la même taille : la collision est celle du moteur.
// ==========================================================================
const section = (w: number, h: number, y = 0): [number, number][] => [
  [0, y + h],
  [w * 0.62, y + h * 0.72],
  [w, y + h * 0.04],
  [w * 0.74, y - h * 0.52],
  [0, y - h * 0.68],
  [-w * 0.74, y - h * 0.52],
  [-w, y + h * 0.04],
  [-w * 0.62, y + h * 0.72],
];
/** Les sections du fuselage (z, demi-largeur, demi-hauteur, hauteur du centre). */
const FUSELAGE: [number, number, number, number][] = [
  [-1.8, 0.01, 0.01, 0.02],
  [-1.58, 0.065, 0.05, 0.02],
  [-1.32, 0.13, 0.1, 0.02],
  [-1.02, 0.2, 0.155, 0.025],
  [-0.66, 0.28, 0.215, 0.03],
  [-0.3, 0.36, 0.27, 0.04],
  [0.1, 0.415, 0.292, 0.035],
  [0.55, 0.44, 0.3, 0.03],
  [0.95, 0.4, 0.262, 0.02],
  [1.28, 0.33, 0.21, 0.02],
  [1.42, 0.285, 0.175, 0.02],
];
/** La hauteur du dos du fuselage en (x, z) : on y pose lignes de panneaux et bandes, juste au-dessus. */
function dos(x: number, z: number): number {
  let i = 0;
  while (i < FUSELAGE.length - 2 && FUSELAGE[i + 1][0] < z) i++;
  const [z0, w0, h0, y0] = FUSELAGE[i],
    [z1, w1, h1, y1] = FUSELAGE[i + 1];
  const t = Math.min(1, Math.max(0, (z - z0) / (z1 - z0)));
  const w = w0 + (w1 - w0) * t,
    h = h0 + (h1 - h0) * t,
    y = y0 + (y1 - y0) * t;
  return y + h - (Math.min(Math.abs(x), w * 0.62) / (w * 0.62)) * h * 0.28;
}
/** Une bande posée sur le dos, de (x0, z0) à (x1, z1), de largeur « l » (le long de x). */
function bandeDos(a: Assembleur, x: number, z0: number, z1: number, l: number, q: Matiere, haut = 0.004) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const za = z0 + ((z1 - z0) * i) / n,
      zb = z0 + ((z1 - z0) * (i + 1)) / n;
    const ya = (xx: number) => dos(xx, za) + haut,
      yb = (xx: number) => dos(xx, zb) + haut;
    a.quad([x - l / 2, ya(x - l / 2), za], [x + l / 2, ya(x + l / 2), za], [x + l / 2, yb(x + l / 2), zb], [x - l / 2, yb(x - l / 2), zb], q);
  }
}
/** Une ligne de panneau en travers du dos, à la profondeur z. */
function ligneTravers(a: Assembleur, z: number, demi: number, q: Matiere = M.joint) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = -demi + (2 * demi * i) / n,
      x1 = -demi + (2 * demi * (i + 1)) / n;
    a.quad([x0, dos(x0, z) + 0.003, z - 0.006], [x1, dos(x1, z) + 0.003, z - 0.006], [x1, dos(x1, z) + 0.003, z + 0.006], [x0, dos(x0, z) + 0.003, z + 0.006], q);
  }
}

/** Une aile (côté s = 1 à droite, -1 à gauche) : dessus peint, ailerons, liseré lumineux, nacelle, feux. */
function aile(a: Assembleur, s: 1 | -1) {
  const X = (x: number) => x * s;
  // Les quatre coins de l'aile (x, z), son épaisseur à l'emplanture et au saumon.
  const rf: [number, number] = [0.3, -0.42],
    tf: [number, number] = [1.18, 0.5],
    tb: [number, number] = [1.26, 0.82],
    rb: [number, number] = [0.36, 0.98];
  const e0 = 0.07,
    e1 = 0.025,
    y = -0.04;
  const P = (p: [number, number], e: number, haut: boolean): V3 => [X(p[0]), y + (haut ? e : -e * 0.6), p[1]];
  const ep = (p: [number, number]) => e0 + (e1 - e0) * Math.min(1, Math.max(0, (p[0] - 0.3) / 0.96));
  const lerp = (p: [number, number], q: [number, number], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  // L'aile est coupée en deux le long de l'envergure : la partie fixe (peinte) et l'aileron (alliage), séparés d'un joint.
  const coupeA = lerp(rb, rf, 0.26),
    coupeB = lerp(tb, tf, 0.3);
  a.quad(P(rf, ep(rf), true), P(tf, ep(tf), true), P(coupeB, ep(coupeB), true), P(coupeA, ep(coupeA), true), M.coque);
  a.quad(P(coupeA, ep(coupeA), true), P(coupeB, ep(coupeB), true), P(tb, ep(tb), true), P(rb, ep(rb), true), M.alliage);
  // Le joint de l'aileron, et la séparation entre volet et aileron.
  const j = (p: [number, number], e: number): V3 => [X(p[0]), y + e + 0.003, p[1]];
  a.quad(j(coupeA, ep(coupeA)), j(coupeB, ep(coupeB)), j([coupeB[0], coupeB[1] + 0.014], ep(coupeB)), j([coupeA[0], coupeA[1] + 0.014], ep(coupeA)), M.joint);
  const mi = lerp(coupeA, coupeB, 0.55),
    miB = lerp(rb, tb, 0.55);
  a.quad(j(mi, ep(mi)), j([mi[0] + 0.012, mi[1]], ep(mi)), j([miB[0] + 0.012, miB[1]], ep(miB)), j(miB, ep(miB)), M.joint);
  // Le dessous, les tranches.
  a.quad(P(rf, ep(rf), false), P(rb, ep(rb), false), P(tb, ep(tb), false), P(tf, ep(tf), false), M.coqueSombre);
  const tranche = (p: [number, number], q: [number, number], m: Matiere) => a.quad(P(p, ep(p), true), P(p, ep(p), false), P(q, ep(q), false), P(q, ep(q), true), m);
  tranche(rf, tf, M.alliage);
  tranche(tf, tb, M.metalSombre);
  tranche(tb, rb, M.metalSombre);
  // Le liseré lumineux le long du bord d'attaque.
  const k = 0.05;
  a.quad([X(rf[0] + 0.04), y + e0 + 0.004, rf[1] + k], [X(tf[0] - 0.02), y + e1 + 0.004, tf[1] + k], [X(tf[0] - 0.03), y + e1 + 0.004, tf[1] + k + 0.05], [X(rf[0] + 0.05), y + e0 + 0.004, rf[1] + k + 0.07], M.accent);
  // Le chevron peint (couleur d'Overdrive) près de l'emplanture, et deux lignes de panneaux.
  const yc = (xx: number) => y + ep([xx, 0]) + 0.005;
  a.quad([X(0.44), yc(0.44), 0.02], [X(0.7), yc(0.7), 0.3], [X(0.66), yc(0.66), 0.38], [X(0.42), yc(0.42), 0.12], M.peinture2);
  a.quad([X(0.5), yc(0.5), 0.26], [X(0.8), yc(0.8), 0.6], [X(0.76), yc(0.76), 0.66], [X(0.48), yc(0.48), 0.34], M.peinture2);
  for (const t of [0.35, 0.62]) {
    const p0 = lerp(rf, rb, t),
      p1 = lerp(tf, tb, t);
    a.quad([X(p0[0]), yc(p0[0]) - 0.001, p0[1]], [X(p1[0]), yc(p1[0]) - 0.001, p1[1]], [X(p1[0]), yc(p1[0]) - 0.001, p1[1] + 0.01], [X(p0[0]), yc(p0[0]) - 0.001, p0[1] + 0.01], M.joint);
  }
  // Les petits propulseurs de manœuvre au saumon.
  a.boite(X(1.22), y + 0.005, 0.66, 0.05, 0.03, 0.07, M.carbone);
  // La nacelle sous l'aile : un conteneur profilé, sa pointe lumineuse.
  a.pousser().deplacer(X(0.82), y - 0.075, 0.42).tourner(Math.PI / 2);
  a.cylindre(0.045, 0.05, -0.32, 0.26, 10, M.metalSombre, true, true);
  a.cylindre(0.051, 0.051, -0.1, -0.06, 10, M.alliage, false, true);
  a.cylindre(0.0, 0.045, -0.44, -0.32, 10, M.alliage, false, true);
  a.cylindre(0.03, 0.03, 0.26, 0.29, 10, M.accentDoux, true, true);
  a.retirer();
  a.boite(X(0.82), y - 0.035, 0.4, 0.012, 0.04, 0.34, M.metalSombre);
  // La dérive au saumon, inclinée vers l'extérieur ; son feu de navigation fixe et son feu à éclats.
  a.pousser().deplacer(X(1.2), y, 0.62).tourner(0, 0, -0.32 * s);
  a.prisme([[-0.02, 0], [0.02, 0], [0.015, 0.34], [-0.015, 0.34]], -0.1, 0.24, M.metalSombre);
  a.quad([-0.022, 0.05, 0.25], [0.022, 0.05, 0.25], [0.017, 0.3, 0.12], [-0.017, 0.3, 0.12], M.alliage);
  a.boite(0, 0.36, 0.0, 0.05, 0.05, 0.12, s > 0 ? M.navVert : M.navRouge);
  a.boite(0, 0.355, 0.1, 0.03, 0.03, 0.04, M.eclatBlanc);
  a.retirer();
}

/** Un moteur (côté s) : nacelle, entrée d'air à aubes, bagues, tuyère à volets, cône et anneau lumineux. */
function moteur(a: Assembleur, s: 1 | -1) {
  a.pousser().deplacer(0.27 * s, -0.04, 0).tourner(Math.PI / 2);
  a.cylindre(0.15, 0.16, 0.45, 1.36, 20, M.metalSombre, false);
  // L'entrée d'air : une lèvre d'alliage, la soufflante (aubes) et son moyeu.
  a.cylindre(0.158, 0.15, 0.4, 0.45, 20, M.alliage, false);
  a.cylindre(0.13, 0.13, 0.42, 0.425, 20, M.joint, true, true);
  for (let i = 0; i < 12; i++) {
    a.pousser().tourner(0, (i / 12) * Math.PI * 2);
    a.boite(0.07, 0.43, 0, 0.11, 0.006, 0.022, M.acier);
    a.retirer();
  }
  a.cylindre(0.035, 0.012, 0.42, 0.46, 12, M.alliage, true, true);
  // Les bagues et les rivets.
  a.cylindre(0.165, 0.165, 0.62, 0.7, 20, M.alliage, false);
  a.cylindre(0.163, 0.163, 0.9, 0.92, 20, M.joint, false);
  a.cylindre(0.17, 0.17, 1.18, 1.28, 20, M.alliage, false);
  // La tuyère : des volets en couronne, alternés.
  for (let i = 0; i < 14; i++) {
    a.pousser().tourner(0, (i / 14) * Math.PI * 2);
    a.quad([0.165, 1.36, -0.036], [0.165, 1.36, 0.036], [0.142, 1.52, 0.03], [0.142, 1.52, -0.03], i % 2 ? M.acier : M.metalSombre);
    a.retirer();
  }
  a.cylindre(0.14, 0.14, 1.36, 1.5, 20, M.carbone, false);
  // Au fond : l'anneau lumineux et le cône central.
  a.cylindre(0.12, 0.12, 1.43, 1.47, 16, M.accent, true, true);
  a.cylindre(0.06, 0.0, 1.38, 1.5, 12, M.accentDoux, false, true);
  a.retirer();
  // La poutre qui relie le moteur au fuselage, et une grille de refroidissement sur le dessus.
  a.boite(0.2 * s, 0.07, 0.85, 0.1, 0.05, 0.62, M.metalMoyen, 0.015);
  for (let i = 0; i < 5; i++) a.boite(0.27 * s, 0.128, 0.72 + i * 0.07, 0.11, 0.008, 0.025, M.joint);
}

/** Le vaisseau complet. Les couleurs viennent du garage : coque (peinture), traînée (accent), Overdrive (accent 2 et peinture 2), noyau (coeur). */
export function vaisseau(): Assembleur {
  const a = new Assembleur();
  // Le fuselage, du nez (-z) à la poupe.
  const sections = FUSELAGE.map(([z, w, h, y]) => ({ z, pts: section(w, h, y) }));
  a.coque(sections, M.coqueSombre, true, (i, j) => {
    if (i <= 1) return M.alliage; // la pointe
    if (j === 0 || j === 7) return M.coque; // le dos
    if (j === 1 || j === 6) return i === 5 ? M.alliage : M.coque;
    if (j === 2 || j === 5) return i >= 8 ? M.carbone : M.metalMoyen;
    return M.coqueSombre;
  });
  // Le nez : une arête lumineuse discrète, la sonde et les capteurs.
  a.quad([-0.01, 0.12, -1.33], [0.01, 0.12, -1.33], [0.012, 0.215, -0.86], [-0.012, 0.215, -0.86], M.accentDoux);
  a.pousser().deplacer(0, 0.025, -1.8).tourner(Math.PI / 2);
  a.cylindre(0.006, 0.004, -0.22, 0, 6, M.acier, true, true);
  a.retirer();
  for (const s of [1, -1]) {
    a.boite(0.1 * s, 0.03, -1.22, 0.02, 0.03, 0.08, M.carbone); // propulseurs de manœuvre
    a.boite(0.075 * s, 0.085, -1.36, 0.03, 0.012, 0.05, M.fenetre); // capteurs
  }
  // Les bandes de course (couleur d'Overdrive), du nez à la verrière, puis derrière elle jusqu'à la poupe.
  for (const s of [1, -1]) {
    bandeDos(a, 0.05 * s, -1.3, -0.92, 0.035, M.peinture2);
    bandeDos(a, 0.075 * s, 0.2, 1.3, 0.03, M.peinture2);
  }
  // Les lignes de panneaux.
  for (const z of [-1.1, -0.95, 0.24, 0.72, 1.05]) ligneTravers(a, z, 0.24);
  // Le cockpit : une verrière de verre teinté, ses arceaux, son cadre.
  const dome = (l: number, h: number, y: number): [number, number][] => [
    [-l, y],
    [-l * 0.92, y + h * 0.38],
    [-l * 0.7, y + h * 0.74],
    [-l * 0.32, y + h],
    [l * 0.32, y + h],
    [l * 0.7, y + h * 0.74],
    [l * 0.92, y + h * 0.38],
    [l, y],
  ];
  a.coque(
    [
      { z: -0.94, pts: dome(0.03, 0.015, 0.185) },
      { z: -0.8, pts: dome(0.12, 0.08, 0.2) },
      { z: -0.62, pts: dome(0.175, 0.135, 0.215) },
      { z: -0.36, pts: dome(0.205, 0.165, 0.235) },
      { z: -0.12, pts: dome(0.19, 0.14, 0.255) },
      { z: 0.12, pts: dome(0.13, 0.075, 0.27) },
    ],
    M.verrerie,
  );
  // Les arceaux : l'arête centrale et deux arcs en travers.
  a.boite(0, 0.405, -0.36, 0.022, 0.012, 0.5, M.alliage);
  for (const [z, l, hh, yy] of [[-0.6, 0.178, 0.135, 0.215], [-0.2, 0.198, 0.155, 0.248]] as const) {
    const d = dome(l + 0.006, hh + 0.006, yy);
    for (let i = 0; i < d.length - 1; i++) a.quad([d[i][0], d[i][1], z - 0.014], [d[i + 1][0], d[i + 1][1], z - 0.014], [d[i + 1][0], d[i + 1][1], z + 0.014], [d[i][0], d[i][1], z + 0.014], M.alliage);
  }
  // Le cadre de la verrière, posé sur le fuselage.
  a.boite(0.2, 0.235, -0.38, 0.025, 0.02, 0.9, M.carbone);
  a.boite(-0.2, 0.235, -0.38, 0.025, 0.02, 0.9, M.carbone);
  // Derrière la verrière : le dôme du capteur, l'antenne, le noyau d'énergie et ses flancs.
  a.pousser().deplacer(0, 0.31, 0.2);
  a.sphere(0.06, 2, M.verrerie);
  a.retirer();
  a.poutre([0, 0.32, 0.95], [0, 0.5, 1.12], 0.008, M.acier);
  a.boite(0, 0.505, 1.13, 0.012, 0.012, 0.012, M.eclatRouge);
  a.boite(0, 0.322, 0.56, 0.07, 0.02, 0.62, M.coeur);
  a.boite(-0.12, 0.31, 0.56, 0.03, 0.02, 0.5, M.metalSombre);
  a.boite(0.12, 0.31, 0.56, 0.03, 0.02, 0.5, M.metalSombre);
  // Les prises d'air latérales, leur grille, et des ouïes de ventilation derrière.
  for (const s of [1, -1]) {
    a.pousser().deplacer(0.36 * s, 0.02, -0.15);
    a.prisme([[-0.06, -0.08], [0.06, -0.08], [0.07, 0.08], [-0.05, 0.08]], -0.25, 0.25, M.metalSombre);
    a.panneau(0, 0, -0.252, 0.1, 0.13, M.joint);
    for (let i = 0; i < 4; i++) a.boite(0, -0.05 + i * 0.033, -0.255, 0.1, 0.006, 0.01, M.acier);
    a.retirer();
    for (let i = 0; i < 4; i++) a.boite(0.43 * s, 0.07 - i * 0.035, 0.28, 0.012, 0.012, 0.16, M.joint);
  }
  aile(a, 1);
  aile(a, -1);
  // Les deux dérives, sur la poupe, inclinées vers l'extérieur : gouvernail, liseré, feu à éclats.
  for (const s of [1, -1]) {
    a.pousser().deplacer(0.2 * s, 0.24, 1.0).tourner(0, 0, -0.38 * s);
    a.prisme([[-0.018, 0], [0.018, 0], [0.012, 0.36], [-0.012, 0.36]], -0.18, 0.26, M.coque);
    a.quad([-0.02, 0.02, 0.27], [0.02, 0.02, 0.27], [0.014, 0.34, 0.27], [-0.014, 0.34, 0.27], M.metalSombre);
    a.quad([0.0195, 0.05, 0.1], [0.0195, 0.05, 0.12], [0.014, 0.33, 0.12], [0.014, 0.33, 0.1], M.joint);
    a.quad([-0.0195, 0.05, 0.1], [-0.0195, 0.05, 0.12], [-0.014, 0.33, 0.12], [-0.014, 0.33, 0.1], M.joint);
    a.quad([0.0125, 0.36, -0.16], [-0.0125, 0.36, -0.16], [-0.0125, 0.36, 0.24], [0.0125, 0.36, 0.24], M.peinture2);
    a.boite(0, 0.37, 0.22, 0.02, 0.02, 0.03, M.eclatBlanc);
    a.retirer();
  }
  // Les deux moteurs.
  moteur(a, 1);
  moteur(a, -1);
  // Le carénage ventral, la quille, les trappes du train et les phares d'atterrissage.
  a.boite(0, -0.2, 0.3, 0.3, 0.06, 1.2, M.metalSombre, 0.02);
  a.prisme([[-0.015, -0.2], [0.015, -0.2], [0.01, -0.3], [-0.01, -0.3]], 0.2, 0.8, M.alliage);
  for (const s of [1, -1]) a.boite(0.09 * s, -0.232, -0.1, 0.07, 0.004, 0.32, M.joint);
  a.boite(0, -0.18, -0.95, 0.06, 0.004, 0.2, M.joint);
  for (const s of [1, -1]) a.boite(0.05 * s, -0.12, -1.0, 0.025, 0.02, 0.02, M.fenetre);
  a.boite(0, -0.235, 0.5, 0.025, 0.02, 0.025, M.eclatRouge);
  return a;
}

// ==========================================================================
// LA PORTE D'ARRIVÉE (séquence de victoire) : deux pylônes, un anneau, un bandeau à damier
// ==========================================================================
export function porteArrivee(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  for (const s of [-1, 1]) {
    const x = s * 8.2;
    a.boite(x, 6.5, 0, 1.8, 13, 2.6, M.metalSombre, 0.25);
    a.boite(x - s * 0.92, 6.5, 0, 0.06, 11.5, 1.2, M.accent);
    a.boite(x, 0.4, 0, 3, 0.8, 4, M.metalMoyen, 0.2);
    for (let i = 0; i < 6; i++) a.boite(x, 1.6 + i * 1.9, 1.32, 1.2, 0.12, 0.04, M.joint);
    a.boite(x, 13.2, 0, 0.5, 0.5, 0.5, M.eclatRouge);
    h.ajouter(x - s * 0.95, 6.5, 0.4, 2.6, [0.6, 0.85, 1], 0.6, 0.35);
  }
  // L'anneau, ses segments, sa lumière intérieure.
  a.pousser().deplacer(0, 6.8, 0);
  a.tore(7.6, 0.42, 72, 10, M.alliage);
  a.tore(7.1, 0.12, 72, 6, M.accent);
  for (let i = 0; i < 16; i++) {
    a.pousser().tourner(0, 0, (i / 16) * Math.PI * 2).deplacer(7.7, 0, 0);
    a.boite(0, 0, 0, 0.7, 0.9, 1.3, M.metalSombre, 0.08);
    a.boite(-0.36, 0, 0, 0.04, 0.5, 0.8, M.accent);
    a.retirer();
  }
  a.retirer();
  // Le bandeau du haut, à damier (la ligne d'arrivée).
  a.boite(0, 14.4, 0, 18, 1.6, 1, M.metalSombre, 0.1);
  for (let i = 0; i < 24; i++)
    for (let j = 0; j < 2; j++) a.panneau(-8.25 + i * 0.72, 13.95 + j * 0.72, 0.52, 0.72, 0.72, (i + j) % 2 ? M.blanc : M.noir);
  h.ajouter(0, 6.8, -0.2, 10, [0.6, 0.85, 1], 0.5);
  return { solide: a, halos: h };
}

// ==========================================================================
// LE TRAFIC LOINTAIN : des navires qui traversent le ciel (ils avancent le long de leur axe x)
// ==========================================================================
/** Un cargo d'une soixantaine de mètres : une épine, des conteneurs, une passerelle, trois moteurs. */
export function cargoLointain(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  a.boite(0, 0, 0, 58, 2.6, 2.6, M.plaque, 0.4);
  const couleurs = [M.orange, M.plaqueClaire, M.jaune, M.metalMoyen, mat('#2f5d7c', 0.4, 0.5), M.orange, mat('#7a2f2a', 0.4, 0.5), M.plaqueClaire];
  couleurs.forEach((q, i) => {
    const x = -20 + i * 5.6;
    a.boite(x, 3.2, 0, 5, 3.6, 4.2, q, 0.1);
    a.boite(x, -3.1, 0, 5, 3.4, 4.2, couleurs[(i + 3) % couleurs.length], 0.1);
    a.boite(x, 3.2, 2.12, 4.6, 0.12, 0.05, M.joint);
  });
  // La passerelle, ses baies vitrées, ses antennes.
  a.boite(27, 3.5, 0, 6, 6, 5.5, M.plaqueClaire, 0.4);
  a.boite(29.6, 5.2, 0, 1.2, 1.1, 4.8, M.fenetre);
  a.poutre([26, 6.5, 0], [26, 11, 0], 0.25, M.acier);
  a.boite(26, 11.2, 0, 0.5, 0.5, 0.5, M.eclatRouge);
  // Les moteurs, à l'arrière (−x).
  for (const z of [-1.8, 1.8, 0]) {
    const y = z === 0 ? 2.4 : -0.6;
    a.pousser().deplacer(-31, y, z).tourner(0, 0, Math.PI / 2);
    a.cylindre(1.2, 1.4, -3, 3, 14, M.metalMoyen, true);
    a.cylindre(1.05, 1.05, -3.05, -2.9, 14, M.accent, true);
    a.retirer();
    h.ajouter(-34.5, y, z, 4.2, [0.55, 0.78, 1], 1.4, 1.6);
  }
  // Les feux : à éclats aux extrémités, de position sur les flancs.
  a.boite(30.5, 0, 0, 0.5, 0.5, 0.5, M.eclatBlanc);
  a.boite(-29, 5.4, 0, 0.5, 0.5, 0.5, M.eclatRouge);
  a.boite(0, 0, 2.4, 0.5, 0.5, 0.3, M.navVert);
  a.boite(0, 0, -2.4, 0.5, 0.5, 0.3, M.navRouge);
  h.ajouter(30.5, 0, 0.5, 2, [1, 1, 1], 0.5);
  return { solide: a, halos: h };
}

/** Un vaisseau amiral (plus de 300 m) : une coque en flèche, une tour, des rangées de hublots, une batterie de moteurs. */
export function amiral(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  // La coque : un prisme en flèche, la pointe vers +x.
  a.pousser().tourner(0, Math.PI / 2);
  a.prisme([[-60, -14], [60, -14], [42, 14], [-42, 14]], -150, 120, M.plaque, true, M.plaqueClaire);
  a.prisme([[-8, -14], [8, -14], [4, 14], [-4, 14]], 120, 175, M.metalMoyen);
  a.retirer();
  // Les terrasses du dessus et la tour de commandement.
  for (let i = 0; i < 6; i++) a.boite(-110 + i * 38, 17 + (i % 2) * 2, 0, 30, 6 + (i % 2) * 4, 60 - i * 6, i % 2 ? M.plaque : M.metalMoyen, 1);
  a.boite(-70, 34, 0, 26, 30, 18, M.plaqueClaire, 1.5);
  a.boite(-70, 50, 0, 34, 4, 22, M.metalMoyen, 1);
  a.boite(-60, 46, 0, 2, 3, 19, M.fenetre);
  a.poutre([-75, 52, 0], [-75, 78, 0], 1, M.acier);
  a.boite(-75, 79, 0, 2, 2, 2, M.eclatRouge);
  // Des rangées de hublots sur les flancs.
  for (const s of [1, -1])
    for (let rang = 0; rang < 4; rang++)
      for (let i = 0; i < 26; i++) {
        if ((i * 7 + rang * 3) % 5 === 0) continue;
        const x = -140 + i * 10 + rang * 3;
        const z = s * (58 - (x + 150) * 0.065 - rang * 1.2);
        a.boite(x, -8 + rang * 6, z, 3.4, 1.2, 0.4, M.fenetre);
      }
  // La batterie de moteurs, à l'arrière.
  for (let i = 0; i < 5; i++) {
    const z = -44 + i * 22;
    a.pousser().deplacer(-152, 0, z).tourner(0, 0, Math.PI / 2);
    a.cylindre(9, 10, -6, 6, 18, M.metalMoyen, true);
    a.cylindre(8, 8, -6.2, -5.9, 18, M.accent, true);
    a.retirer();
    h.ajouter(-160, 0, z, 26, [0.5, 0.72, 1], 1.5, 1.5);
  }
  for (const [x, z] of [[176, 0], [-150, 62], [-150, -62]] as const) a.boite(x, 0, z, 2.4, 2.4, 2.4, M.eclatBlanc);
  return { solide: a, halos: h };
}

/** Les émetteurs du bouclier (un par bouclier restant), sur l'emplanture des ailes. */
export const EMETTEURS: V3[] = [
  [0.55, 0.035, 0.42],
  [-0.55, 0.035, 0.42],
  [0.78, 0.02, 0.58],
  [-0.78, 0.02, 0.58],
];
export function emetteur(): Assembleur {
  return new Assembleur().boite(0, 0, 0, 0.09, 0.025, 0.09, M.coeur);
}

/** La flamme d'un moteur : un cône le long de +z (énergie). */
export function flamme(): Assembleur {
  const a = new Assembleur();
  a.pousser().tourner(Math.PI / 2).cylindre(0.12, 0.01, 0, 1, 10, M.blanc, false).retirer();
  return a;
}

// ==========================================================================
// LES OBSTACLES
// ==========================================================================
/** La barrière de sécurité (bloc) : un module lourd, hachuré, une rampe rouge au sommet. */
export function barriere(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  a.boite(0, 0.12, 0, 2.15, 0.24, 1.15, M.metalMoyen, 0.05);
  a.boite(0, 0.82, 0, 1.92, 1.2, 0.86, mat('#5b2420', 0.55, 0.4), 0.14);
  // Les hachures de la face avant (tournée vers le vaisseau, +z).
  const z = 0.432;
  for (let i = -4; i < 4; i++) {
    const x0 = i * 0.24;
    a.quad([x0, 0.3, z], [x0 + 0.12, 0.3, z], [x0 + 0.38, 1.3, z], [x0 + 0.26, 1.3, z], i % 2 ? HACHURE : M.noir);
  }
  a.boite(0, 0.8, 0.437, 1.94, 0.06, 0.02, M.metalMoyen);
  // Les montants, la rampe lumineuse, les feux.
  for (const s of [-1, 1]) {
    a.boite(s * 0.98, 0.85, 0, 0.16, 1.5, 1.0, M.acier, 0.03);
    a.boite(s * 0.98, 1.64, 0, 0.12, 0.08, 0.12, M.danger);
    h.ajouter(s * 0.98, 1.64, 0.1, 0.35, [1, 0.25, 0.2], 0.7);
  }
  a.boite(0, 1.47, 0.1, 1.6, 0.1, 0.14, M.danger);
  a.boite(0, 0.27, 0.45, 1.9, 0.05, 0.04, M.danger);
  h.ajouter(0, 1.47, 0.25, 0.9, [1, 0.25, 0.2], 0.7, 1.8);
  h.ajouter(0, 0.3, 0.6, 1.3, [1, 0.2, 0.15], 0.45, 1.6);
  // L'arrière : panneaux et ventilation.
  for (let i = -2; i <= 2; i++) a.boite(i * 0.34, 0.9, -0.44, 0.22, 0.7, 0.02, M.joint);
  return { solide: a, halos: h };
}

/** Un petit astéroïde (débris) : roche sombre, fissures rougeoyantes. */
export function rochers(graine: number): Assembleur {
  const a = new Assembleur();
  const r = (n: number) => {
    const x = Math.sin(n * 127.1 + graine * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const places: [number, number, number, number][] = [
    [-0.45, 0.62, 0.1, 0.62],
    [0.5, 0.7, -0.15, 0.55],
    [0.05, 1.18, 0.05, 0.42],
  ];
  places.forEach(([x, y, z, taille], k) => {
    a.pousser().deplacer(x, y, z).tourner(r(k) * 3, r(k + 4) * 3, r(k + 8) * 3);
    a.sphere(
      taille,
      1,
      M.roche,
      (v) => 0.78 + 0.32 * Math.abs(Math.sin(v[0] * 4.1 + graine) * Math.cos(v[1] * 3.3 + k) * Math.sin(v[2] * 5.2)),
      true,
      (v) => (Math.sin(v[0] * 9 + v[1] * 7 + graine * 3) > 0.82 ? M.braise : v[1] > 0.2 ? M.roche : M.rocheSombre),
    );
    a.retirer();
  });
  return a;
}

/** Les deux pylônes d'une porte laser (le faisceau est dessiné à part). */
export function pylones(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  for (const s of [-1, 1]) {
    const x = s * 1.18;
    a.boite(x, 0.08, 0, 0.5, 0.16, 0.6, M.metalMoyen, 0.04);
    a.boite(x, 0.85, 0, 0.24, 1.55, 0.34, M.metalSombre, 0.06);
    a.boite(x, 0.85, 0.172, 0.08, 1.3, 0.01, M.acier);
    a.boite(x - s * 0.09, 0.78, 0, 0.12, 0.2, 0.22, M.danger);
    a.boite(x, 1.66, 0, 0.3, 0.1, 0.4, M.acier, 0.03);
    h.ajouter(x - s * 0.12, 0.78, 0.15, 0.32, [1, 0.25, 0.2], 0.8);
  }
  return { solide: a, halos: h };
}
/** Le faisceau d'une porte laser (énergie, forme « faisceau »). */
export function faisceau(): Assembleur {
  return new Assembleur().boite(0, 0.78, 0, 2.3, 0.07, 0.07, M.blanc).boite(0, 0.78, 0, 2.3, 0.24, 0.02, M.blanc);
}

/** Le drone-cargo (obstacle mobile) : un conteneur sur propulseurs, qui glisse d'une voie à l'autre. */
export function cargo(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  a.boite(0, 0.95, 0, 1.86, 1.0, 1.25, M.orange, 0.08);
  // Le cadre et les nervures du conteneur.
  for (const x of [-0.95, 0.95]) for (const y of [0.45, 1.45]) a.boite(x, y, 0, 0.1, 0.1, 1.32, M.metalSombre);
  for (const z of [-0.63, 0.63]) {
    a.boite(0, 0.45, z, 2.0, 0.1, 0.1, M.metalSombre);
    a.boite(0, 1.45, z, 2.0, 0.1, 0.1, M.metalSombre);
  }
  for (let i = -3; i <= 3; i++) a.boite(i * 0.26, 0.95, 0.632, 0.06, 0.86, 0.02, M.metalMoyen);
  a.panneau(0, 0.95, 0.645, 0.7, 0.18, M.noir);
  // Les propulseurs dessous, le gyrophare au-dessus.
  for (const s of [-1, 1]) {
    a.pousser().deplacer(s * 0.62, 0.32, 0);
    a.cylindre(0.2, 0.24, -0.12, 0.12, 10, M.metalSombre);
    a.cylindre(0.15, 0.15, -0.13, -0.11, 10, M.accent2);
    a.retirer();
    h.ajouter(s * 0.62, 0.12, 0, 0.45, [1, 0.6, 0.2], 0.6);
  }
  a.boite(0, 1.53, 0, 0.24, 0.1, 0.24, M.accent2);
  h.ajouter(0, 1.6, 0.1, 0.5, [1, 0.6, 0.2], 0.7);
  return { solide: a, halos: h };
}

/** La frappe d'un boss : une lance de cristal brûlant plantée dans la piste. */
export function lance(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  a.pousser().deplacer(0, 1.35, 0).echelle(0.55, 1.5, 0.55);
  a.sphere(1, 0, M.braise, undefined, true);
  a.retirer();
  a.cylindre(0.95, 1.05, 0, 0.12, 14, M.metalSombre);
  a.cylindre(0.75, 0.75, 0.12, 0.16, 14, M.danger, true);
  h.ajouter(0, 1.3, 0.3, 1.4, [1, 0.45, 0.2], 0.8);
  return { solide: a, halos: h };
}

/**
 * Un tronçon de piste effondrée (une voie, sur « longueur » mètres) : la piste est arrachée ; on voit
 * sa structure (parois nervurées, poutres transversales), des plaques brisées qui pendent, et au fond,
 * un plancher sombre traversé de fissures rougeoyantes qui défilent avec la piste (canal « fissure »).
 */
export function faille(longueur: number, graine: number): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  const r = (n: number) => {
    const x = Math.sin(n * 91.7 + graine * 47.3) * 43758.5453;
    return x - Math.floor(x);
  };
  // Le fond du gouffre : un plancher sombre fissuré.
  a.boite(0, -1.25, -longueur / 2, 2.32, 0.1, longueur, M.fissure);
  // Les parois : métal sombre, une nervure par mètre, un liseré d'alerte en haut.
  for (const s of [-1, 1]) {
    a.boite(s * 1.19, -0.62, -longueur / 2, 0.1, 1.2, longueur, M.metalSombre);
    for (let z = 0.5; z < longueur; z += 1) a.boite(s * 1.12, -0.62, -z, 0.06, 1.1, 0.12, M.metalMoyen);
    a.boite(s * 1.15, -0.06, -longueur / 2, 0.04, 0.03, longueur, M.dangerDoux);
  }
  // La structure à nu : une poutre transversale tous les deux mètres.
  for (let z = 1; z < longueur; z += 2) {
    a.boite(0, -0.45, -z, 2.3, 0.14, 0.18, M.acier, 0.03);
    a.boite(0, -0.85, -z, 0.16, 0.7, 0.16, M.metalMoyen);
  }
  // Des plaques brisées, inclinées, qui pendent sur les bords.
  for (let z = 0.6; z < longueur - 0.5; z += 1.7) {
    if (r(z) < 0.35) continue;
    const cote = r(z + 11) > 0.5 ? 1 : -1;
    a.pousser().deplacer(cote * (0.55 + r(z + 1) * 0.35), -0.18 - r(z + 2) * 0.3, -z).tourner((r(z + 3) - 0.5) * 0.5, (r(z + 4) - 0.5) * 0.4, cote * (0.35 + r(z + 5) * 0.5));
    a.boite(0, 0, 0, 0.5 + r(z + 6) * 0.6, 0.08, 0.7 + r(z + 7) * 0.7, M.plaque, 0.02);
    a.retirer();
  }
  // La chaleur qui monte du fond, et des étincelles.
  for (let z = 1.5; z < longueur; z += 3.5) h.ajouter((r(z + 9) - 0.5) * 1.4, -0.75, -z, 1.1, [1, 0.3, 0.15], 0.38);
  // Le bord d'entrée : une lèvre hachurée, pour lire le danger de loin.
  for (let i = -4; i < 4; i++) a.boite(i * 0.29 + 0.145, 0.03, 0.05, 0.27, 0.06, 0.12, i % 2 ? M.jaune : M.noir);
  return { solide: a, halos: h };
}

// ==========================================================================
// LES PORTAILS ET LES COLLECTIBLES
// ==========================================================================
/** Le cadre d'un portail : un anneau d'alliage, six émetteurs, deux bras d'ancrage. Les chevrons montrent la voie d'arrivée. */
export function portail(sens: -1 | 0 | 1): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  a.pousser().deplacer(0, 1.25, 0);
  a.tore(1.08, 0.1, 48, 8, M.alliage);
  a.tore(0.98, 0.035, 48, 6, M.coeur);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + Math.PI / 6;
    a.pousser().tourner(0, 0, t).deplacer(1.12, 0, 0);
    a.boite(0, 0, 0, 0.18, 0.26, 0.3, M.metalSombre, 0.04);
    a.boite(-0.1, 0, 0, 0.02, 0.14, 0.2, M.coeur);
    a.retirer();
  }
  // Les chevrons lumineux, au centre, qui pointent vers la voie d'arrivée.
  if (sens)
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.3 * sens;
      a.quad([x - 0.08 * sens, 0.3, 0.02], [x + 0.06 * sens, 0, 0.02], [x + 0.14 * sens, 0, 0.02], [x, 0.3, 0.02], M.blanc);
      a.quad([x + 0.06 * sens, 0, 0.02], [x - 0.08 * sens, -0.3, 0.02], [x, -0.3, 0.02], [x + 0.14 * sens, 0, 0.02], M.blanc);
    }
  a.retirer();
  // Le socle.
  a.boite(0, 0.06, 0, 1.4, 0.12, 0.5, M.metalMoyen, 0.04);
  a.boite(0, 0.13, 0.26, 1.0, 0.02, 0.02, M.coeur);
  h.ajouter(0, 1.25, -0.05, 1.7, [1, 1, 1], 0.35);
  return { solide: a, halos: h };
}
/** Le voile d'énergie d'un portail (disque, forme « voile tournant »). */
export function voile(): Assembleur {
  const a = new Assembleur();
  const n = 40;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2,
      t1 = ((i + 1) / n) * Math.PI * 2;
    a.quad([0, 0, 0], [0, 0, 0], [Math.cos(t1) * 1.0, Math.sin(t1) * 1.0, 0], [Math.cos(t0) * 1.0, Math.sin(t0) * 1.0, 0], M.blanc);
  }
  return a;
}

/** Un fragment d'énergie : un cristal effilé. « dore » : plus gros, en or, cerclé. */
export function cristal(genre: 'fragment' | 'dore' | 'noyau'): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  if (genre === 'noyau') {
    a.sphere(0.32, 1, M.coeur);
    a.pousser().tourner(Math.PI / 2.4).tore(0.55, 0.03, 32, 5, M.alliage).retirer();
    h.ajouter(0, 0, 0.05, 1.2, [1, 0.6, 0.35], 0.9);
    return { solide: a, halos: h };
  }
  const w = genre === 'dore' ? 0.26 : 0.19,
    hh = genre === 'dore' ? 0.5 : 0.4;
  const q = genre === 'dore' ? M.or : M.cristal;
  const haut: V3 = [0, hh, 0],
    bas: V3 = [0, -hh, 0];
  const anneau: V3[] = [0, 1, 2, 3, 4, 5].map((i) => [Math.cos((i / 6) * Math.PI * 2) * w, 0, Math.sin((i / 6) * Math.PI * 2) * w]);
  for (let i = 0; i < 6; i++) {
    const p = anneau[i],
      s = anneau[(i + 1) % 6];
    a.tri(haut, s, p, q).tri(bas, p, s, q);
  }
  if (genre === 'dore') a.pousser().tourner(Math.PI / 2).tore(0.48, 0.025, 32, 5, M.or).retirer();
  h.ajouter(0, 0, 0.05, genre === 'dore' ? 1.1 : 0.8, genre === 'dore' ? [1, 0.8, 0.4] : [0.6, 0.9, 1], 0.7);
  return { solide: a, halos: h };
}

/** Un anneau au sol (où un cargo va s'arrêter ; où une frappe va tomber). */
export function cible(): Assembleur {
  const a = new Assembleur();
  const n = 36;
  for (let i = 0; i < n; i++) {
    if (i % 3 === 2) continue;
    const t0 = (i / n) * Math.PI * 2,
      t1 = ((i + 1) / n) * Math.PI * 2;
    const r0 = 0.95,
      r1 = 1.08;
    a.quad([Math.cos(t0) * r0, 0, Math.sin(t0) * r0], [Math.cos(t0) * r1, 0, Math.sin(t0) * r1], [Math.cos(t1) * r1, 0, Math.sin(t1) * r1], [Math.cos(t1) * r0, 0, Math.sin(t1) * r0], M.blanc);
  }
  return a;
}

/** L'anneau du Perfect Dodge et la bulle du bouclier. */
export function bulle(): Assembleur {
  return new Assembleur().sphere(1, 2, M.blanc);
}
export function onde(): Assembleur {
  return new Assembleur().tore(1, 0.05, 48, 6, M.blanc);
}

// ==========================================================================
// LES BOSS
// ==========================================================================
/** Core Sentinel : un gardien mécanique autour d'un noyau d'énergie. Le noyau et la couronne sont dessinés à part (ils tournent). */
export function sentinelleCorps(): { solide: Assembleur; halos: Halos } {
  const a = new Assembleur();
  const h = new Halos();
  // Le bâti : quatre bras, une épine dorsale, des émetteurs.
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * Math.PI * 2 + Math.PI / 4;
    a.pousser().tourner(0, 0, t);
    a.boite(5.2, 0, 0, 4.4, 0.9, 1.4, M.metalSombre, 0.25);
    a.boite(7.6, 0, 0, 1.2, 1.6, 2.0, M.metalMoyen, 0.3);
    a.boite(8.25, 0, 0, 0.12, 0.8, 1.2, M.danger);
    a.boite(4.8, 0.48, 0, 3.6, 0.06, 0.4, M.accent2);
    a.retirer();
    h.ajouter(Math.cos(t) * 8.3, Math.sin(t) * 8.3, 1.2, 1.6, [1, 0.3, 0.2], 0.6);
  }
  a.boite(0, -6.5, 0, 1.2, 6, 1.2, M.metalSombre, 0.3);
  a.pousser().deplacer(0, -10, 0).echelle(0.8, 2, 0.8).sphere(1, 0, M.metalMoyen, undefined, true).retirer();
  a.tore(6.3, 0.35, 64, 8, M.metalSombre);
  a.tore(6.3, 0.12, 64, 6, M.accent2, 0, Math.PI * 2);
  return { solide: a, halos: h };
}
/** La couronne d'armure du Core Sentinel : huit plaques qui tournent autour du noyau. */
export function sentinelleCouronne(): Assembleur {
  const a = new Assembleur();
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    a.pousser().tourner(0, 0, t).deplacer(3.9, 0, 0).tourner(0, 0.35);
    a.boite(0, 0, 0, 0.8, 2.1, 2.4, M.metalSombre, 0.2);
    a.boite(0.41, 0, 0, 0.02, 1.6, 0.12, M.coeur);
    a.retirer();
  }
  return a;
}
/** Le gardien de la Singularité : une sphère noire et trois anneaux. Les anneaux tournent. */
export function gardienAnneau(r: number): Assembleur {
  const a = new Assembleur();
  a.tore(r, 0.22, 72, 8, M.metalSombre);
  a.tore(r, 0.08, 72, 6, M.coeur);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    a.pousser().tourner(0, 0, t).deplacer(r, 0, 0).boite(0, 0, 0, 0.7, 0.7, 0.9, M.metalMoyen, 0.15).retirer();
  }
  return a;
}
export function noyauBoss(): Assembleur {
  return new Assembleur().sphere(1, 3, M.coeur);
}
export function sphereNoire(): Assembleur {
  return new Assembleur().sphere(1, 3, mat('#05060a', 1, 0.08));
}
