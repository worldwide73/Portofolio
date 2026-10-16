// PORTAL RUSH 3D — LES VIRAGES ET LES RELIEFS DU PARCOURS
//
// Le moteur garde trois voies droites (la difficulté et les collisions ne changent pas) ;
// c'est l'image qui serpente. Le tracé est fait de grandes ondes le long du parcours :
//   virages : X(s) = Σ a·cos(k·s + φ)        reliefs : Y(s) = Σ A·cos(n·(q·s + ψ)), n = 1 à 4
// Chaque sommet du monde, à la distance r devant le vaisseau, est déplacé de
//   X(s0 + r) − X(s0) − X'(s0)·r   (même chose en hauteur)
// où s0 est la position du vaisseau : sous lui la piste est droite et plate, devant elle tourne,
// monte et descend, et ces virages défilent à mesure qu'il avance. Dans les virages, la piste
// s'incline (dévers, proportionnel à la courbure) et la caméra se penche avec elle. Le lointain
// (ciel, planètes, soleil) pivote du cap X'(s0) et de la pente Y'(s0) : le décor tourne autour de soi.
//
// L'équité d'abord : un obstacle doit rester visible dès sa distance d'apparition (95 à 140 m).
//   - Les reliefs sont asymétriques (quatre harmoniques, poids de Fejér) : des creux et des remontées
//     marqués, des sommets très doux (courbure ≥ −0,0003), si bien qu'un sommet ne cache jamais la
//     piste avant 140 m (caméra à 3,25 m de haut, 7,4 m en arrière ; calcul dans scratchpad/relief.mjs).
//   - Les virages restent assez larges (courbure ≤ 0,0026 environ) pour que, jusqu'à 100 m, la ligne
//     de vue passe au-dessus de la piste et non à travers le décor du bord intérieur.
// Le même calcul existe dans les shaders (materiaux.ts, PLIER) et ici, pour la caméra.

import type { Theme } from '../donnees';

const TAU = Math.PI * 2;
/** Les ondes des virages : amplitude (m), longueur d'onde (m), phase. */
const ONDES_X = [
  { a: 14.5, l: 640, p: 0.7 },
  { a: 33, l: 1040, p: 2.1 },
];
/** Les reliefs : longueur d'onde de la première harmonique, courbure de référence, poids des harmoniques. */
const RELIEF = { l: 760, p: 1.3, K: 0.00024, poids: [1.6, 1.2, 0.8, 0.4] };
/** Le dévers : inclinaison (rad) par unité de courbure. */
const DEVERS = 68;

/** Le caractère de chaque monde : virages, reliefs (1 = la référence ; reliefs ≤ 1,25 pour l'équité). */
const CARACTERE: Record<Theme | 'infini', [number, number]> = {
  lancement: [0.85, 0.8],
  neon: [1.15, 0.7],
  debris: [1, 1.25],
  laser: [0.75, 0.6],
  rift: [1.2, 1.15],
  tempete: [1.05, 1.2],
  sentinelle: [0.7, 0.6],
  singularite: [1.25, 1.1],
  infini: [1, 1],
};

export interface Pli {
  /** Pour les shaders : a1, k1, a2, k2 (virages) ; A1 à A4 (reliefs) ; θ1, θ2, θ du relief, q ; le dévers. */
  pliX: number[];
  pliY: number[];
  phase: number[];
  devers: number;
  /** Le cap et la pente sous le vaisseau (rad), son dévers. */
  cap: number;
  pente: number;
  inclinaison: number;
}

export function creerPli(): Pli {
  return { pliX: [0, 0, 0, 0], pliY: [0, 0, 0, 0], phase: [0, 0, 0, 0], devers: 0, cap: 0, pente: 0, inclinaison: 0 };
}

const caractere = { v: 1, r: 1 };

/** Met le pli à jour pour la distance s0. « force » : 0 = tout droit, 1 = parcours complet. */
export function majPli(pli: Pli, s0: number, theme: Theme | 'infini', force: number, dt: number): void {
  const [cv, cr] = CARACTERE[theme] ?? CARACTERE.infini;
  // Le caractère change en douceur d'un monde à l'autre (survie).
  const k = Math.min(1, dt * 0.6);
  caractere.v += (cv - caractere.v) * k;
  caractere.r += (cr - caractere.r) * k;
  const fv = force * caractere.v,
    fr = force * caractere.r;
  let cap = 0,
    courbure = 0;
  ONDES_X.forEach((o, i) => {
    const kk = TAU / o.l;
    const th = (kk * s0 + o.p) % TAU;
    pli.pliX[i * 2] = o.a * fv;
    pli.pliX[i * 2 + 1] = kk;
    pli.phase[i] = th;
    cap += -o.a * fv * kk * Math.sin(th);
    courbure += -o.a * fv * kk * kk * Math.cos(th);
  });
  const q = TAU / RELIEF.l;
  const th = (q * s0 + RELIEF.p) % TAU;
  let pente = 0;
  RELIEF.poids.forEach((w, i) => {
    const n = i + 1;
    // Y'' = K·Σ w·cos(n·u) : courbure de −K (sommets doux) à +4K (creux marqués).
    const A = (-RELIEF.K * w * fr) / (n * q) ** 2;
    pli.pliY[i] = A;
    pente += -A * n * q * Math.sin(n * th);
  });
  pli.phase[2] = th;
  pli.phase[3] = q;
  pli.devers = DEVERS;
  pli.cap = Math.atan(cap);
  pli.pente = Math.atan(pente);
  pli.inclinaison = courbure * DEVERS;
}

/** La position à l'image d'un point du monde (même calcul que le shader). */
export function plier(pli: Pli, x: number, y: number, z: number): [number, number, number] {
  const r = -z;
  let ox = 0,
    oy = 0,
    c = 0;
  for (let i = 0; i < 2; i++) {
    const a = pli.pliX[i * 2],
      k = pli.pliX[i * 2 + 1],
      th = pli.phase[i];
    ox += a * (Math.cos(th + k * r) - Math.cos(th) + k * r * Math.sin(th));
    c += -a * k * k * Math.cos(th + k * r);
  }
  const th = pli.phase[2],
    q = pli.phase[3];
  for (let i = 0; i < 4; i++) {
    const n = i + 1;
    oy += pli.pliY[i] * (Math.cos(n * th + n * q * r) - Math.cos(n * th) + n * q * r * Math.sin(n * th));
  }
  return [x + ox, y + oy + x * c * pli.devers, z];
}
