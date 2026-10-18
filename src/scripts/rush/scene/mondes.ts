// PORTAL RUSH 3D — LES MONDES
//
// Chaque monde est un « kit » : une palette (ciel, soleil, brouillard, lumières),
// des tronçons de 48 m construits pièce par pièce (la piste et tout ce qui
// l'entoure : structures, arches, plateformes), et un lointain (planètes,
// stations, anneaux) qui suit la caméra pour paraître immense.
//
// Les tronçons existent en plusieurs variantes, choisies d'après leur numéro :
// le décor ne se répète pas de façon visible, et il est le même à chaque partie
// (il ne dépend que de la position sur le parcours).

import { Assembleur, Halos, mat, type Matiere, type RGB, type V3 } from './geometrie';
import { M, VOIE } from './modeles';
import { decor } from './assets';

export const TRONCON = 48;
const SEG = 6;

export interface Palette {
  haut: string;
  horizon: string;
  bas: string;
  nebuleuse1: string;
  nebuleuse2: string;
  densite: number;
  etoiles: number;
  voile: number;
  soleilDir: V3;
  soleil: string;
  soleilForce: number;
  ciel: string;
  cielForce: number;
  sol: string;
  brouillard: string;
  brume: [number, number];
  accent: string;
  accent2: string;
  exposition: number;
  /** Éclairs dans le ciel (tempête). */
  eclairs?: boolean;
}

/** Ce qui compose le lointain d'un monde (placé autour de la caméra, en mètres). */
export interface Lointain {
  planetes: { genre: 0 | 1 | 2; rayon: number; pos: V3; a: string; b: string; atmosphere: string; graine: number; anneau?: { r0: number; r1: number; a: string; b: string; inclinaison: V3 } }[];
  disque?: { pos: V3; r0: number; r1: number; a: string; b: string; inclinaison: V3; trou: number };
  structures?: (a: Assembleur, h: Halos) => void;
}

export interface Kit {
  palette: Palette;
  variantes: number;
  troncon: (a: Assembleur, h: Halos, variante: number) => void;
  lointain: Lointain;
}

export const rnd = (graine: number) => {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ==========================================================================
// LA PISTE : trois voies de plaques, joints, rainures, séparateurs lumineux,
// bordures, poutres porteuses. Commune à tous les mondes, matières au choix.
// ==========================================================================
type Bord = 'ouvert' | 'tunnel' | null;
interface StylePiste {
  plaque: Matiere;
  plaque2?: Matiere;
  bord: Matiere;
  dessous?: boolean;
  /** Plaques manquantes ou fendues sur les bords (piste abîmée). */
  abime?: number;
  graine?: number;
  /** (V4-H7) Le bord de la route modélisée : en demi-tube ouvert (défaut) ou mur de tunnel ; par module de 6 m. */
  bords?: Bord | ((i: number, sx: number) => Bord);
  /** (V4-H7) La voûte du tunnel, par module de 6 m. */
  voute?: (i: number) => boolean;
  /** (V4-H7) Mâts à chevrons sur les bords ouverts (défaut : oui). */
  chevrons?: boolean;
}
/** (V4-H7) Le bord de la chaussée (x) et le haut du couronnement des bords ouverts, pour poser le décor. */
export const BORD_ROUTE = 4.8;
export const BORD_EXTERIEUR = 6.7;

/**
 * (V4-H7) La route modélisée dans Blender (piste.prm) : chaussée continue, bords relevés en demi-tube aux rails
 * lumineux, ou murs de tunnel et voûte. Modules de 6 m, découpés tous les 1,5 m (le pli reste lisse).
 */
function routeModulaire(a: Assembleur, s: StylePiste) {
  const r = rnd(s.graine ?? 7);
  const M6 = 6;
  for (let i = 0; i < TRONCON / M6; i++) {
    const z = -i * M6 - M6 / 2;
    a.pousser().deplacer(0, 0, z).importer(decor.chaussee).retirer();
    for (const sx of [-1, 1]) {
      const genre = typeof s.bords === 'function' ? s.bords(i, sx) : s.bords === undefined ? 'ouvert' : s.bords;
      if (!genre) continue;
      const m = decor[`bord-${genre}`] ?? decor['bord-ouvert'];
      if (s.abime && r() < s.abime) {
        // Un bord arraché : le module, affaissé et basculé vers l'extérieur, parfois manquant.
        if (r() < 0.35) continue;
        a.pousser().deplacer(sx * BORD_ROUTE, -0.35 - r() * 0.4, z).tourner(0, (r() - 0.5) * 0.12, sx * -(0.12 + r() * 0.2)).deplacer(-sx * BORD_ROUTE, 0, 0).echelle(sx, 1, 1).importer(m).retirer();
        continue;
      }
      a.pousser().deplacer(0, 0, z).echelle(sx, 1, 1).importer(m);
      // Le mât à chevrons, posé sur le couronnement, tous les 12 m.
      if (genre === 'ouvert' && s.chevrons !== false && decor.chevron && i % 2 === 0) a.deplacer(2.05, 1.06, 0).importer(decor.chevron);
      a.retirer();
    }
    if (s.voute?.(i) && decor.voute) a.pousser().deplacer(0, 0, z).importer(decor.voute).retirer();
  }
}

export function piste(a: Assembleur, s: StylePiste) {
  if (decor.chaussee && decor['bord-ouvert']) {
    routeModulaire(a, s);
    return;
  }
  const r = rnd(s.graine ?? 7);
  for (let i = 0; i < TRONCON / SEG; i++) {
    const z = -i * SEG - SEG / 2;
    for (const v of [-1, 0, 1]) {
      const x = v * VOIE;
      const q = s.plaque2 && (i + v + 3) % 3 === 0 ? s.plaque2 : s.plaque;
      a.boite(x, -0.11, z, 2.46, 0.22, SEG - 0.12, q, 0.035);
      // Deux rainures, des plots aux coins, une plaque de service.
      a.boite(x - 0.72, 0.004, z, 0.05, 0.01, SEG - 0.9, M.joint);
      a.boite(x + 0.72, 0.004, z, 0.05, 0.01, SEG - 0.9, M.joint);
      for (const cx of [-1.08, 1.08]) for (const cz of [-2.6, 2.6]) a.boite(x + cx, 0.01, z + cz, 0.09, 0.02, 0.09, M.acier);
      if ((i + v) % 4 === 0) a.boite(x, 0.006, z + 1.2, 0.9, 0.012, 0.5, M.metalSombre);
      // Un renfort en travers, au début de chaque plaque : il passe sous le vaisseau et rend la vitesse lisible.
      a.boite(x, 0.014, z + 2.72, 2.1, 0.028, 0.14, M.metalMoyen, 0.01);
    }
    // Le joint entre deux tronçons de plaques, avec un fil de lumière encastré.
    a.boite(0, -0.05, z - SEG / 2, 7.9, 0.08, 0.1, M.joint);
    a.boite(0, 0.004, z - SEG / 2, 7.6, 0.01, 0.035, M.accentDoux);
  }
  // La sous-couche, visible entre les plaques.
  a.boite(0, -0.33, -TRONCON / 2, 8.0, 0.2, TRONCON, M.metalSombre);
  // Les séparateurs de voies : une gorge sombre, une ligne lumineuse encastrée.
  for (const sx of [-1, 1]) {
    a.boite(sx * VOIE * 0.5, -0.015, -TRONCON / 2, 0.15, 0.04, TRONCON, M.joint);
    a.boite(sx * VOIE * 0.5, 0.004, -TRONCON / 2, 0.05, 0.012, TRONCON, M.ligne);
  }
  // (V4-H7) Les marquages au sol : un peigne de hachures jaunes le long des bords de la chaussée.
  for (const sx of [-1, 1])
    for (let zz = 0.3; zz < TRONCON; zz += 0.5) {
      const xa = sx > 0 ? 3.44 : -3.76,
        xb = xa + 0.32;
      a.quad([xa, 0.006, -zz], [xb, 0.006, -zz - 0.14 * sx], [xb, 0.006, -zz - 0.14 * sx - 0.13], [xa, 0.006, -zz - 0.13], M.jaune);
    }
  // Les bordures. (V4-H7) Le module modélisé dans Blender (bordure basse, muret incliné à gorge lumineuse,
  // liseré blanc, chemin de câbles, poutre), avec un mât à chevrons tous les 12 m ; sinon les murets d'origine.
  const mod = decor.bordure;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < TRONCON / SEG; i++) {
      const z = -i * SEG - SEG / 2;
      if (s.abime && r() < s.abime) {
        const pente = sx * (0.15 + r() * 0.3),
          long = 0.4 + r() * 0.4;
        a.pousser().deplacer(sx * 4.25, 0.05, z).tourner(0, 0, pente);
        if (mod) a.deplacer(-sx * 4.25, 0, 0).echelle(sx, 1, long).importer(mod);
        else a.boite(0, 0, 0, 0.5, 0.4, SEG * long, s.bord, 0.06);
        a.retirer();
        continue;
      }
      if (mod) {
        a.pousser().deplacer(0, 0, z).echelle(sx, 1, 1).importer(mod);
        if (decor.chevron && i % 2 === 0) a.importer(decor.chevron);
        a.retirer();
        continue;
      }
      a.boite(sx * 4.22, 0.13, z, 0.5, 0.56, SEG - 0.06, s.bord, 0.09);
      a.boite(sx * 3.99, 0.3, z, 0.025, 0.07, SEG - 0.3, M.ligne);
      // Des plots sur la bordure, tous les trois mètres : les repères proches défilent vite.
      for (const dz of [-1.5, 1.5]) {
        a.boite(sx * 4.32, 0.47, z + dz, 0.12, 0.12, 0.12, M.acier, 0.02);
        a.boite(sx * 4.32, 0.535, z + dz, 0.07, 0.012, 0.07, M.accent2);
      }
      a.boite(sx * 4.48, 0.1, z, 0.02, 0.3, SEG - 1.4, M.metalMoyen);
      a.boite(sx * 4.49, 0.1, z + 1.8, 0.02, 0.1, 0.5, M.accent2);
    }
  }
  // Les poutres porteuses et leurs traverses.
  if (s.dessous !== false) {
    for (const sx of [-1, 1]) {
      a.boite(sx * 2.7, -0.9, -TRONCON / 2, 0.26, 0.9, TRONCON, M.metalMoyen, 0.04);
      a.boite(sx * 2.7, -0.42, -TRONCON / 2, 0.7, 0.07, TRONCON, M.metalSombre);
      a.boite(sx * 2.7, -1.38, -TRONCON / 2, 0.7, 0.07, TRONCON, M.metalSombre);
    }
    for (let i = 0; i < TRONCON / SEG; i++) a.boite(0, -0.75, -i * SEG - SEG / 2, 7.2, 0.28, 0.32, M.metalSombre, 0.04);
  }
}

/**
 * (V4-H7) Pose un module importé (modèle Blender) en (x, y, z), éventuellement en miroir (sx = −1), avec ses
 * halos (points « halos » du modèle : [x, y, z, rayon, r, v, b, intensité]).
 */
export function poserModule(a: Assembleur, h: Halos, nom: string, x: number, y: number, z: number, sx = 1): boolean {
  const m = decor[nom];
  if (!m) return false;
  a.pousser().deplacer(x, y, z).echelle(sx, 1, 1).importer(m).retirer();
  for (const [hx, hy, hz, r, cr, cv, cb, i] of m.points.halos ?? []) h.ajouter(x + hx * sx, y + hy, z + hz, r, [cr, cv, cb], i ?? 1);
  return true;
}

// ---- Des pièces d'architecture réutilisées ----
/** Un pilier massif, biseauté, avec chapiteau et socle. */
export function pilier(a: Assembleur, x: number, z: number, y0: number, y1: number, l: number, q: Matiere) {
  a.boite(x, (y0 + y1) / 2, z, l, y1 - y0, l, q, l * 0.18);
  a.boite(x, y0 + 0.4, z, l * 1.35, 0.8, l * 1.35, M.metalMoyen, l * 0.2);
  a.boite(x, y1 - 0.3, z, l * 1.25, 0.6, l * 1.25, M.metalMoyen, l * 0.2);
}
/** Un lampadaire de bordure : mât, tête, halo. */
export function lampadaire(a: Assembleur, h: Halos, x: number, z: number, c: RGB) {
  const s = Math.sign(x);
  a.boite(x, 1.1, z, 0.1, 2.2, 0.1, M.metalSombre);
  a.boite(x - s * 0.3, 2.22, z, 0.75, 0.1, 0.16, M.metalMoyen);
  a.boite(x - s * 0.55, 2.16, z, 0.32, 0.03, 0.12, M.blanc);
  h.ajouter(x - s * 0.55, 2.1, z + 0.1, 0.55, c, 0.8);
}
/** Des tuyaux qui courent le long de la piste, avec leurs brides et colliers. */
export function tuyaux(a: Assembleur, x: number, y: number) {
  for (const [dx, r] of [
    [0, 0.2],
    [0.48, 0.13],
  ] as const) {
    a.pousser().deplacer(x + dx * Math.sign(x), y, 0).tourner(Math.PI / 2);
    a.cylindre(r, r, 0, TRONCON, 10, M.acier, false);
    for (let z = 3; z < TRONCON; z += 6) a.cylindre(r + 0.05, r + 0.05, z, z + 0.25, 10, M.metalMoyen, true);
    a.retirer();
  }
  for (let z = 3; z < TRONCON; z += 12) a.boite(x + 0.2 * Math.sign(x), y - 0.35, -z, 0.9, 0.12, 0.2, M.metalSombre);
}
/** Une tour de service : fût, bandeaux de fenêtres tournés vers la piste, antenne et feu. */
export function tour(a: Assembleur, h: Halos, x: number, z: number, haut: number, l: number) {
  const face = -Math.sign(x);
  a.boite(x, haut / 2 - 3, z, l, haut, l, M.metalMoyen, 0.35);
  for (let y = 0; y < haut - 5; y += 1.6) {
    a.boite(x + face * (l / 2 + 0.01), y, z, 0.02, 0.35, l * 0.8, M.fenetre);
    a.boite(x, y, z + l / 2 + 0.01, l * 0.8, 0.35, 0.02, M.fenetre);
  }
  a.boite(x, haut - 2.5, z, l * 1.2, 0.8, l * 1.2, M.metalSombre, 0.2);
  a.boite(x, haut + 1.5, z, 0.12, 7, 0.12, M.acier);
  a.boite(x, haut + 5, z, 0.25, 0.25, 0.25, M.navRouge);
  h.ajouter(x, haut + 5, z, 1.4, [1, 0.3, 0.25], 0.7);
}

// ==========================================================================
// LAUNCH PROTOCOL : une station de lancement. La piste est un rail surélevé
// au-dessus des quais ; des portiques monumentaux l'enjambent, un anneau de
// propulsion sur deux ; tours de service, réservoirs, aires de lancement ;
// au loin, une planète bleue, sa lune et l'anneau d'une station orbitale.
// ==========================================================================
function portique(a: Assembleur, h: Halos, z: number, anneau: boolean, accent: RGB) {
  // (V4-H7) Le portique en treillis modélisé dans Blender, s'il est chargé.
  if (decor.portique) {
    a.pousser().deplacer(0, 0, z).importer(decor.portique).retirer();
    for (let i = -3; i <= 3; i++) h.ajouter(i * 1.8, 9.2, z + 0.1, 0.8, [0.85, 0.92, 1], 0.4);
    h.ajouter(0, 10.3, z + 0.9, 2.6, accent, 0.35);
  }
  for (const s of decor.portique ? [] : [-1, 1]) {
    pilier(a, s * 6.4, z, -3, 9.6, 1.05, M.metalSombre);
    // Les jambes de force vers la bordure, et le pied posé sur la poutre.
    a.poutre([s * 5.9, 1.6, z], [s * 4.5, -0.6, z], 0.3, M.metalMoyen);
    a.boite(s * 6.4, 4.5, z + 0.54, 0.4, 6, 0.04, M.metalMoyen);
    a.boite(s * 6.4, 4.5, z + 0.56, 0.06, 5.4, 0.02, M.accent);
  }
  // La traverse : caisson, lumières dessous, panneau signalétique.
  if (!decor.portique) portiqueTraverse(a, h, z);
  if (anneau) anneauPropulsion(a, h, z, accent);
}
function portiqueTraverse(a: Assembleur, h: Halos, z: number) {
  a.boite(0, 9.1, z, 14.4, 1.0, 1.3, M.metalMoyen, 0.25);
  a.boite(0, 9.75, z, 13, 0.3, 0.9, M.metalSombre, 0.1);
  for (let i = -2; i <= 2; i++) {
    a.boite(i * 2.4, 8.55, z, 0.9, 0.08, 0.5, M.blanc);
    h.ajouter(i * 2.4, 8.45, z + 0.3, 0.7, [0.85, 0.92, 1], 0.45);
  }
  a.boite(0, 9.1, z + 0.66, 3.6, 0.6, 0.02, M.verre);
  a.boite(0, 9.1, z + 0.68, 2.8, 0.06, 0.02, M.accent);
}
function anneauPropulsion(a: Assembleur, h: Halos, z: number, accent: RGB) {
  {
    // L'anneau de propulsion : la piste passe au travers.
    a.pousser().deplacer(0, 2.6, z - 3);
    a.tore(6.1, 0.3, 64, 8, M.metalSombre);
    a.tore(5.82, 0.07, 64, 6, M.accent);
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      a.pousser().tourner(0, 0, t).deplacer(6.1, 0, 0).boite(0, 0, 0, 0.7, 0.5, 0.9, M.metalMoyen, 0.1).boite(-0.36, 0, 0, 0.03, 0.3, 0.6, M.accent).retirer();
      if (Math.sin(t) > -0.3) h.ajouter(Math.cos(t) * 5.7, 2.6 + Math.sin(t) * 5.7, z - 2.8, 0.9, accent, 0.45);
    }
    a.retirer();
  }
}

function tronconLancement(a: Assembleur, h: Halos, v: number) {
  const r = rnd(100 + v);
  const accent: RGB = [0.5, 0.88, 1];
  piste(a, { plaque: mat('#3f4754', 0.72, 0.42), plaque2: mat('#4b5464', 0.7, 0.4), bord: M.metalSombre, graine: v });
  // Les pylônes qui portent le rail, jusqu'aux quais tout en bas.
  for (const z of [-4, -28]) {
    for (const s of [-1, 1]) a.boite(s * 2.7, -15, z, 0.9, 27.5, 0.9, M.metalSombre, 0.16);
    a.poutre([-2.7, -4, z], [2.7, -12, z], 0.25, M.metalMoyen);
    a.poutre([2.7, -4, z], [-2.7, -12, z], 0.25, M.metalMoyen);
    a.boite(0, -14, z, 6.2, 0.5, 0.6, M.metalMoyen);
    h.ajouter(0, -14.6, z + 0.4, 1.2, [1, 0.7, 0.35], 0.5);
  }
  // Les quais, très bas : dalles, lignes lumineuses, blocs techniques.
  a.boite(0, -30.5, -TRONCON / 2, 70, 1, TRONCON, M.metalSombre);
  for (const sx of [-1, 1]) {
    a.boite(sx * 9, -29.98, -TRONCON / 2, 0.3, 0.02, TRONCON, M.accent2);
    for (let k = 0; k < 3; k++) {
      const x = sx * (14 + r() * 18),
        z = -r() * TRONCON;
      a.boite(x, -28.5 + 0, z, 3 + r() * 5, 3 + r() * 3, 3 + r() * 6, M.metalMoyen, 0.3);
      h.ajouter(x, -26, z, 1.5, [1, 0.7, 0.35], 0.4);
    }
  }
  // (V4-H7) La route modélisée est plus large : conduites, passerelle et lampadaires passent au-delà de ses bords.
  const ex = decor.chaussee ? BORD_EXTERIEUR + 0.6 : 4.4;
  tuyaux(a, -(ex + 0.65), -0.35);
  // La passerelle de service, à droite, et son garde-corps.
  a.boite(ex + 0.95, -0.42, -TRONCON / 2, 1.2, 0.08, TRONCON, M.metalMoyen);
  for (let z = 0; z < TRONCON; z += 2) a.boite(ex + 0.95, -0.38, -z - 1, 1.1, 0.02, 0.06, M.joint);
  a.boite(ex + 1.52, 0.55, -TRONCON / 2, 0.05, 0.05, TRONCON, M.acier);
  for (let z = 0; z < TRONCON; z += 3) a.boite(ex + 1.52, 0.08, -z, 0.05, 0.95, 0.05, M.acier);
  // Les lampadaires (sur le couronnement des bords, quand la route est modélisée).
  for (let z = 6; z < TRONCON; z += 12) {
    const sx = (z / 12) % 2 < 1 ? 1 : -1;
    if (decor.chaussee) {
      a.pousser().deplacer(0, 1.72, 0);
      lampadaire(a, h, sx * (BORD_EXTERIEUR - 0.3), -z, [0.85, 0.92, 1]);
      a.retirer();
    } else lampadaire(a, h, sx * 4.62, -z, [0.85, 0.92, 1]);
  }
  portique(a, h, -24, v % 2 === 0, accent);
  // Les côtés : tours, réservoirs, aire de lancement, selon la variante.
  const cote = v % 2 ? 1 : -1;
  tour(a, h, cote * (15 + r() * 4), -10 - r() * 8, 16 + r() * 10, 3.4);
  const dx = decor.chaussee ? 2.6 : 0;
  a.boite(cote * (9.9 + dx), 4.2, -14, 8.6 - dx * 0.5, 0.6, 1.4, M.metalMoyen, 0.15); // la passerelle tour ↔ piste
  a.boite(cote * (9.9 + dx), 4.52, -14, 8.6 - dx * 0.5, 0.04, 0.9, M.accent2);
  a.boite(cote * (5.5 + dx), 1.6, -14, 1.3, 6.4, 1.8, M.metalSombre, 0.12); // la cage d'ascenseur
  for (let y = -1; y < 4; y += 1.1) a.boite(cote * (4.84 + dx), y, -14, 0.02, 0.5, 1.2, M.fenetre);
  // Les réservoirs, de l'autre côté.
  for (let k = 0; k < 2; k++) {
    const x = -cote * (13 + k * 4.2);
    a.pousser().deplacer(x, -1.2, -30).tourner(Math.PI / 2);
    a.cylindre(1.7, 1.7, -7, 7, 18, M.alliage, false);
    a.cylindre(1.2, 1.7, 7, 8.2, 18, M.alliage, true);
    a.cylindre(1.2, 1.7, -7, -8.2, 18, M.alliage, true);
    for (const zz of [-4, 0, 4]) a.cylindre(1.78, 1.78, zz, zz + 0.4, 18, M.metalSombre, false);
    a.retirer();
    a.boite(x, -3, -30, 2.4, 0.8, 12, M.metalSombre);
  }
  if (v === 2) {
    // Une aire de lancement : plateforme ronde, cercle lumineux, mât.
    const x = -cote * 22;
    a.pousser().deplacer(x, -2, -12).cylindre(7, 7.4, -0.6, 0, 32, M.metalMoyen).cylindre(5.6, 5.6, 0, 0.03, 32, M.accent2).cylindre(5.3, 5.3, 0.03, 0.05, 32, M.metalSombre).retirer();
    a.boite(x + cote * 7, 6, -12, 0.8, 16, 0.8, M.metalSombre, 0.1);
    h.ajouter(x, -1.6, -12, 4, [1, 0.65, 0.3], 0.35);
  }
  // Des modules de station plus loin sur les côtés.
  for (const sx of [-1, 1]) {
    const x = sx * (34 + r() * 20);
    const z = -r() * TRONCON;
    a.boite(x, 2 + r() * 6, z, 6 + r() * 6, 4 + r() * 10, 6 + r() * 8, M.metalSombre, 0.5);
    a.boite(x - sx * 3.2, 4, z, 0.02, 0.4, 4, M.fenetre);
    h.ajouter(x, 12, z, 2, [0.6, 0.85, 1], 0.4);
  }
}

const lointainLancement: Lointain = {
  planetes: [
    { genre: 1, rayon: 520, pos: [1050, 260, -2300], a: '#123a6e', b: '#3d6b46', atmosphere: '#6fb6ff', graine: 3 },
    { genre: 2, rayon: 90, pos: [-760, 430, -2500], a: '#6d6a66', b: '#a19c94', atmosphere: '#8899aa', graine: 8 },
  ],
  structures: (a, h) => {
    // L'anneau d'une station orbitale, ses rayons, son moyeu.
    a.pousser().deplacer(-520, 160, -1900).tourner(1.15, 0.5, 0.2);
    a.tore(380, 13, 96, 8, M.metalMoyen);
    a.tore(380, 4, 96, 6, M.accent);
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2;
      a.poutre([0, 0, 0], [Math.cos(t) * 380, Math.sin(t) * 380, 0], 8, M.metalSombre);
      a.pousser().tourner(0, 0, t).deplacer(380, 0, 0).boite(0, 0, 0, 40, 30, 40, M.metalSombre, 6).retirer();
    }
    a.sphere(45, 2, M.alliage);
    a.retirer();
    for (let i = 0; i < 18; i++) {
      const t = (i / 18) * Math.PI * 2;
      h.ajouter(-520 + Math.cos(t) * 300, 160 + Math.sin(t) * 120, -1700, 12, [0.6, 0.9, 1], 0.5);
    }
    // Les tours d'amarrage, à l'horizon.
    for (const [x, hh] of [
      [-420, 520],
      [380, 640],
      [700, 420],
    ] as const) {
      a.boite(x, hh / 2 - 300, -1500, 34, hh, 34, M.metalSombre, 6);
      a.boite(x, hh - 300, -1500, 60, 14, 60, M.metalMoyen, 4);
      h.ajouter(x, hh - 290, -1470, 14, [1, 0.35, 0.3], 0.8);
    }
  },
};

// ==========================================================================
// LES KITS
// ==========================================================================
const PALETTE_LANCEMENT: Palette = {
  haut: '#03070f',
  horizon: '#16314d',
  bas: '#02040a',
  nebuleuse1: '#1d3d70',
  nebuleuse2: '#3b1f5e',
  densite: 0.55,
  etoiles: 1,
  voile: 0.18,
  soleilDir: [-0.55, 0.42, -0.72],
  soleil: '#fff0d8',
  soleilForce: 2.6,
  ciel: '#5d86bd',
  cielForce: 0.55,
  sol: '#1a2232',
  brouillard: '#0d1a2c',
  brume: [80, 520],
  accent: '#7fe3ff',
  accent2: '#ffb04a',
  exposition: 1.15,
};

export const LANCEMENT: Kit = { palette: PALETTE_LANCEMENT, variantes: 3, troncon: tronconLancement, lointain: lointainLancement };
export { mat };
