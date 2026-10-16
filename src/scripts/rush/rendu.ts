// PORTAL RUSH — LE DESSIN (version 2)
//
// Une fausse 3D sur une toile 2D : la piste à trois voies part du bas de
// l'écran et file vers le portail, à l'horizon. Un objet à « z » mètres devant
// le vaisseau est dessiné à l'échelle F / (F + z) : il grandit en approchant.
// Mêmes matières que le site : verre bleu et blanc, contours lumineux, nuit.
//
// Chaque secteur a son environnement (ciel, piste, décor), et chaque action
// importante son retour visuel, déclenché par les vrais évènements du moteur :
// inclinaison et traînée au changement de voie, impulsion à la collecte, anneau
// au Perfect Dodge, gains affichés près du vaisseau, piste qui s'intensifie avec
// le combo, alerte rouge au choc, vaisseau et tunnel qui montent en puissance
// pendant l'Overdrive. Sans partie, la toile anime la scène du menu.

import { PIECES, type Equipement, type Theme } from './donnees';
import { apparition } from './equilibrage';
import { estObstacle, type Objet, type Partie } from './moteur';

export interface Vue {
  l: number;
  h: number;
  /** Mouvement réduit (système) ou effets réduits (réglage du jeu) : ni éclairs, ni grosses particules. */
  reduit: boolean;
  secousses: boolean;
  equipement: Equipement;
  theme: Theme;
  /** Visibilité dans la tempête (m), ou 0. */
  brume: number;
  /** Le temps écoulé depuis le dernier pas du moteur (s) : l'image montre l'instant exact. */
  avance?: number;
  /** La silhouette du vaisseau choisi (V4) : 0 Aube, 1 Faucon, 2 Bastion, 3 Spectre. */
  modele?: number;
}

type Decor = 'etoiles' | 'neon' | 'asteroides' | 'grille' | 'failles' | 'orage' | 'noyau' | 'trou';
interface Ambiance {
  ciel: [string, string, string, string];
  horizon: string; // « r, g, b »
  piste: string;
  accent: string;
  decor: Decor;
}
export const THEMES: Record<Theme, Ambiance> = {
  lancement: { ciel: ['#03050a', '#081122', '#0d1a33', '#04060b'], horizon: '140, 180, 255', piste: '200, 222, 255', accent: '150, 192, 255', decor: 'etoiles' },
  neon: { ciel: ['#05030c', '#140a2a', '#2a0f3a', '#06040c'], horizon: '255, 90, 200', piste: '120, 235, 255', accent: '255, 110, 210', decor: 'neon' },
  debris: { ciel: ['#040507', '#0d1016', '#1b1c22', '#050607'], horizon: '255, 190, 140', piste: '220, 225, 235', accent: '200, 180, 160', decor: 'asteroides' },
  laser: { ciel: ['#020407', '#06121a', '#0a2230', '#020406'], horizon: '80, 240, 255', piste: '120, 240, 255', accent: '255, 80, 90', decor: 'grille' },
  rift: { ciel: ['#04020a', '#110826', '#22104a', '#05030a'], horizon: '180, 120, 255', piste: '200, 170, 255', accent: '150, 90, 255', decor: 'failles' },
  tempete: { ciel: ['#020305', '#080b10', '#11151c', '#030406'], horizon: '170, 190, 220', piste: '190, 205, 230', accent: '220, 230, 255', decor: 'orage' },
  sentinelle: { ciel: ['#050302', '#140b06', '#2a1608', '#050302'], horizon: '255, 170, 90', piste: '255, 220, 185', accent: '255, 150, 80', decor: 'noyau' },
  singularite: { ciel: ['#000000', '#05030a', '#0c0718', '#000000'], horizon: '190, 150, 255', piste: '230, 220, 255', accent: '255, 255, 255', decor: 'trou' },
  infini: { ciel: ['#03050a', '#071020', '#0e1c38', '#04060b'], horizon: '120, 230, 255', piste: '200, 230, 255', accent: '120, 230, 255', decor: 'etoiles' },
  defi: { ciel: ['#04040a', '#0c0f22', '#161c3c', '#04050b'], horizon: '255, 214, 120', piste: '235, 230, 210', accent: '255, 214, 120', decor: 'etoiles' },
};

const F = 14; // la « focale » : plus elle est courte, plus la perspective est forte
const borne = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** La couleur d'une pièce équipée (« prisme » change avec le temps). */
export function couleurPiece(id: string, temps: number): string {
  const c = PIECES.find((p) => p.id === id)?.couleur ?? '236, 244, 255';
  if (c !== 'prisme') return c;
  const a = temps * 2;
  return `${Math.round(170 + 85 * Math.sin(a))}, ${Math.round(170 + 85 * Math.sin(a + 2.1))}, ${Math.round(170 + 85 * Math.sin(a + 4.2))}`;
}

/** Le vaisseau seul, à une position et une taille : sert à la course, au menu et au garage. */
export function dessinerVaisseau(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, inclinaison: number, eq: Equipement, temps: number, puissance = 0): void {
  const coque = couleurPiece(eq.coque, temps);
  const trainee = couleurPiece(eq.trainee, temps);
  const aura = couleurPiece(eq.overdrive, temps);
  const noyau = couleurPiece(eq.noyau, temps);
  ctx.save();
  ctx.translate(x, y);
  // Le moteur : une flamme de lumière qui palpite sous la lame.
  const flamme = ctx.createLinearGradient(0, t * 0.5, 0, t * (1.9 + 0.25 * Math.sin(temps * 30) + puissance));
  flamme.addColorStop(0, `rgba(${trainee}, 0.75)`);
  flamme.addColorStop(1, `rgba(${trainee}, 0)`);
  ctx.fillStyle = flamme;
  ctx.beginPath();
  ctx.moveTo(-t * 0.22, t * 0.5);
  ctx.lineTo(t * 0.22, t * 0.5);
  ctx.lineTo(0, t * (2 + puissance));
  ctx.closePath();
  ctx.fill();
  ctx.rotate(inclinaison);
  if (puissance > 0) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, t * 2.8);
    g.addColorStop(0, `rgba(${aura}, ${0.5 * puissance})`);
    g.addColorStop(1, `rgba(${aura}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-t * 2.8, -t * 2.8, t * 5.6, t * 5.6);
  }
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, t * 1.8);
  halo.addColorStop(0, `rgba(${trainee}, 0.32)`);
  halo.addColorStop(1, `rgba(${trainee}, 0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(-t * 1.8, -t * 1.8, t * 3.6, t * 3.6);
  // La lame de verre (comme le portail du site), pointue vers l'avant : une flèche.
  ctx.beginPath();
  ctx.moveTo(0, -t * 1.15);
  ctx.lineTo(t * 0.34, -t * 0.55);
  ctx.lineTo(t * 0.3, t * 0.55);
  ctx.lineTo(-t * 0.3, t * 0.55);
  ctx.lineTo(-t * 0.34, -t * 0.55);
  ctx.closePath();
  const sombre = eq.coque === 'coque-eclipse';
  ctx.fillStyle = sombre ? 'rgba(10, 12, 18, 0.92)' : `rgba(${trainee}, 0.22)`;
  ctx.fill();
  ctx.strokeStyle = sombre ? 'rgba(235, 240, 255, 0.95)' : `rgb(${coque})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Les arêtes, et le noyau d'énergie.
  ctx.strokeStyle = `rgba(${coque}, 0.45)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -t * 1.05);
  ctx.lineTo(0, t * 0.5);
  ctx.stroke();
  ctx.fillStyle = `rgb(${noyau})`;
  ctx.shadowColor = `rgb(${noyau})`;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(0, -t * 0.15, t * 0.11 * (1 + 0.15 * Math.sin(temps * 6)), 0, 6.2832);
  ctx.fill();
  ctx.restore();
}

export function creerRendu(ctx: CanvasRenderingContext2D) {
  const etoiles = Array.from({ length: 170 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  const rochers = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random() * 0.3, r: 4 + Math.random() * 18, v: 0.004 + Math.random() * 0.01, a: Math.random() * 6 }));
  const traces: number[] = [];
  const particules: { x: number; y: number; vx: number; vy: number; vie: number; couleur: string; taille: number }[] = [];
  const textes: { texte: string; x: number; y: number; vie: number; couleur: string }[] = [];
  const anneaux: { x: number; y: number; vie: number; couleur: string }[] = [];
  let secousse = 0;
  let flash = 0;
  let flashCouleur = '255, 255, 255';
  let alerte = 0;
  let impactBoss = 0;
  let eclair = 0;
  let cx = 0;
  let horizon = 0;
  let base = 0;
  let largeur = 0;
  const echelle = (z: number) => F / (F + Math.max(z, -F * 0.8));
  const yA = (z: number) => horizon + (base - horizon) * echelle(z);
  const demi = (z: number) => largeur * echelle(z);
  const voieX = (voie: number, z: number) => cx + (voie - 1) * demi(z) * 0.667;

  const eclater = (x: number, y: number, couleur: string, nombre: number, force = 170) => {
    for (let k = 0; k < nombre; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = force * (0.4 + Math.random() * 0.8);
      particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, vie: 1, couleur, taille: 1 + Math.random() * 2.2 });
    }
  };

  function fond(a: Ambiance, l: number, h: number, temps: number, vitesse: number, overdrive: boolean, dt: number, reduit: boolean) {
    const ciel = ctx.createLinearGradient(0, 0, 0, h);
    ciel.addColorStop(0, a.ciel[0]);
    ciel.addColorStop(0.3, a.ciel[1]);
    ciel.addColorStop(0.36, a.ciel[2]);
    ciel.addColorStop(1, a.ciel[3]);
    ctx.fillStyle = ciel;
    ctx.fillRect(0, 0, l, h);
    // Les étoiles s'écartent du point de fuite : la vitesse se sent.
    for (const e of etoiles) {
      e.z -= dt * (0.05 + vitesse * 0.006) * (overdrive ? 1.8 : 1);
      if (e.z <= 0.04) {
        e.z = 1;
        e.x = Math.random() * 2 - 1;
        e.y = Math.random() * 2 - 1;
      }
      const px = cx + (e.x / e.z) * l * 0.18;
      const py = horizon + (e.y / e.z) * h * 0.18;
      if (px < 0 || px > l || py < 0 || py > h) continue;
      const vif = (1 - e.z) * 0.85;
      ctx.fillStyle = `rgba(220, 232, 255, ${vif.toFixed(3)})`;
      if (overdrive) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + (px - cx) * 0.09, py + (py - horizon) * 0.09);
        ctx.stroke();
      } else ctx.fillRect(px, py, 1.4 * (1 - e.z) + 0.4, 1.4 * (1 - e.z) + 0.4);
    }
    decor(a, l, h, temps, dt, reduit);
    // La lueur de l'horizon.
    const lueur = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, l * 0.45);
    lueur.addColorStop(0, `rgba(${a.horizon}, 0.26)`);
    lueur.addColorStop(1, `rgba(${a.horizon}, 0)`);
    ctx.fillStyle = lueur;
    ctx.fillRect(0, horizon - l * 0.45, l, l * 0.9);
  }

  /** Le décor propre à chaque secteur : léger, il ne cache jamais la piste. */
  function decor(a: Ambiance, l: number, h: number, temps: number, dt: number, reduit: boolean) {
    switch (a.decor) {
      case 'neon': {
        for (let k = 0; k < 6; k++) {
          const y = horizon - 30 - k * 22;
          const avance = (temps * 60 + k * 130) % (l * 0.4);
          ctx.strokeStyle = `rgba(${k % 2 ? a.accent : a.piste}, ${0.18 - k * 0.02})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(avance - 120, y);
          ctx.lineTo(avance, y);
          ctx.moveTo(l - avance + 120, y + 8);
          ctx.lineTo(l - avance, y + 8);
          ctx.stroke();
        }
        break;
      }
      case 'asteroides':
        for (const r of rochers) {
          r.x = (r.x + r.v * dt) % 1.1;
          r.a += dt * 0.3;
          ctx.save();
          ctx.translate(r.x * l, horizon - 40 - r.y * h);
          ctx.rotate(r.a);
          ctx.fillStyle = 'rgba(30, 32, 40, 0.9)';
          ctx.strokeStyle = 'rgba(200, 190, 180, 0.25)';
          ctx.beginPath();
          ctx.moveTo(-r.r, 0);
          ctx.lineTo(-r.r * 0.3, -r.r * 0.8);
          ctx.lineTo(r.r * 0.8, -r.r * 0.4);
          ctx.lineTo(r.r * 0.6, r.r * 0.6);
          ctx.lineTo(-r.r * 0.4, r.r * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        break;
      case 'grille': {
        ctx.strokeStyle = `rgba(${a.horizon}, 0.08)`;
        ctx.lineWidth = 1;
        for (let k = -8; k <= 8; k++) {
          ctx.beginPath();
          ctx.moveTo(cx, horizon);
          ctx.lineTo(cx + k * l * 0.14, ctx.canvas.height);
          ctx.stroke();
        }
        for (let k = 1; k < 7; k++) {
          const y = horizon - k * k * 6;
          ctx.strokeStyle = `rgba(${a.accent}, ${0.08 - k * 0.008})`;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(l, y);
          ctx.stroke();
        }
        break;
      }
      case 'failles':
        for (let k = 0; k < 4; k++) {
          const x = l * (0.15 + k * 0.23) + Math.sin(temps * 0.4 + k) * 20;
          ctx.strokeStyle = `rgba(${a.accent}, ${0.25 + 0.15 * Math.sin(temps * 2 + k)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, horizon - 160);
          for (let s = 1; s <= 6; s++) ctx.lineTo(x + Math.sin(k * 3 + s * 1.7) * 14, horizon - 160 + s * 24);
          ctx.stroke();
        }
        break;
      case 'orage':
        if (!reduit) {
          eclair = Math.max(0, eclair - dt * 4);
          if (Math.random() < dt * 0.25) eclair = 1;
          if (eclair > 0.05) {
            ctx.fillStyle = `rgba(200, 215, 255, ${(eclair * 0.12).toFixed(3)})`;
            ctx.fillRect(0, 0, l, horizon + 40);
          }
        }
        break;
      case 'noyau': {
        const g = ctx.createRadialGradient(cx, horizon - 20, 0, cx, horizon - 20, l * 0.3);
        g.addColorStop(0, `rgba(${a.accent}, 0.12)`);
        g.addColorStop(1, `rgba(${a.accent}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, l, horizon + 60);
        break;
      }
      case 'trou': {
        const r = Math.max(30, l * 0.07);
        ctx.save();
        ctx.translate(cx, horizon - r * 1.6);
        ctx.rotate(temps * 0.15);
        ctx.strokeStyle = `rgba(${a.horizon}, 0.35)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 2.4, r * 0.55, 0.2, 0, 6.2832);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx, horizon - r * 1.6, r, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();
        break;
      }
    }
  }

  function piste(a: Ambiance, distance: number, intensite: number, loin: number) {
    ctx.beginPath();
    ctx.moveTo(voieX(-0.5, loin), yA(loin));
    ctx.lineTo(voieX(2.5, loin), yA(loin));
    ctx.lineTo(voieX(2.5, -3), yA(-3));
    ctx.lineTo(voieX(-0.5, -3), yA(-3));
    ctx.closePath();
    const sol = ctx.createLinearGradient(0, horizon, 0, base);
    sol.addColorStop(0, `rgba(${a.accent}, 0.02)`);
    sol.addColorStop(1, `rgba(${a.accent}, ${(0.07 + intensite * 0.08).toFixed(3)})`);
    ctx.fillStyle = sol;
    ctx.fill();
    // Les bords : ils s'intensifient avec le combo.
    ctx.lineWidth = 1.4 + intensite * 1.4;
    for (const bord of [-0.5, 2.5]) {
      const trait = ctx.createLinearGradient(0, horizon, 0, base);
      trait.addColorStop(0, `rgba(${a.piste}, 0.1)`);
      trait.addColorStop(1, `rgba(${a.piste}, ${(0.6 + intensite * 0.4).toFixed(3)})`);
      ctx.strokeStyle = trait;
      ctx.beginPath();
      ctx.moveTo(voieX(bord, loin), yA(loin));
      ctx.lineTo(voieX(bord, -3), yA(-3));
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    const pas = 9;
    for (let z = pas - (distance % pas); z < loin; z += pas) {
      const al = borne(1 - z / loin) * (0.4 + intensite * 0.3);
      ctx.strokeStyle = `rgba(${a.piste}, ${al.toFixed(3)})`;
      for (const s of [0.5, 1.5]) {
        ctx.beginPath();
        ctx.moveTo(voieX(s, z), yA(z));
        ctx.lineTo(voieX(s, z - 4), yA(z - 4));
        ctx.stroke();
      }
    }
    const pasLigne = 24;
    for (let z = pasLigne - (distance % pasLigne); z < loin; z += pasLigne) {
      ctx.strokeStyle = `rgba(${a.piste}, ${(borne(1 - z / loin) * 0.13).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(voieX(-0.5, z), yA(z));
      ctx.lineTo(voieX(2.5, z), yA(z));
      ctx.stroke();
    }
  }

  /** La voie affichée d'un obstacle mobile : il glisse d'une configuration à la suivante. */
  function voiesAffichees(p: Partie, o: Objet, z: number): number[] {
    if (o.type !== 'mobile' || !o.avant || z <= (o.fige ?? 0)) return p.voiesA(o, z);
    const etats = [...o.avant, { des: o.fige ?? 0, voies: o.voies }];
    let depuis = { des: apparition(p.vitesse), voies: etats[0].voies };
    for (const etat of etats) {
      if (z > etat.des) {
        const t = borne((depuis.des - z) / (depuis.des - etat.des));
        return etat.voies.map((v, i) => {
          const debut = depuis.voies[i] ?? depuis.voies[0];
          return debut + (v - debut) * (t * t * (3 - 2 * t));
        });
      }
      depuis = etat;
    }
    return o.voies;
  }

  function cristal(x: number, y: number, w: number, a: number, chaud: boolean, verrou = 1) {
    const hgt = w * 0.95;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w * 0.42, y - hgt * 0.78);
    ctx.lineTo(x - w * 0.08, y - hgt);
    ctx.lineTo(x + w * 0.44, y - hgt * 0.84);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fillStyle = chaud ? `rgba(255, 150, 100, ${(0.24 * a).toFixed(3)})` : `rgba(150, 192, 255, ${(0.2 * a).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = chaud ? `rgba(255, 215, 185, ${(0.92 * a * verrou).toFixed(3)})` : `rgba(236, 244, 255, ${(0.88 * a * verrou).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, w * 0.012);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(236, 244, 255, ${(0.35 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, y - hgt * 0.95);
    ctx.lineTo(x + w * 0.05, y - hgt * 0.45);
    ctx.lineTo(x - w * 0.18, y - hgt * 0.1);
    ctx.moveTo(x + w * 0.05, y - hgt * 0.45);
    ctx.lineTo(x + w * 0.3, y - hgt * 0.3);
    ctx.stroke();
  }

  /** Un couloir de piste instable : les voies effondrées, fissurées et rougeoyantes, sur toute leur longueur. */
  function couloir(p: Partie, o: Objet, temps: number, loin: number) {
    const z0 = Math.max(-3, o.pos - p.distance);
    const z1 = Math.min(loin, o.pos + (o.longueur ?? 0) - p.distance);
    if (z1 <= z0) return;
    const a = borne((loin - z0) / 22) * (o.detruit ? 0.25 : 1);
    for (const v of o.voies) {
      ctx.beginPath();
      ctx.moveTo(voieX(v - 0.47, z1), yA(z1));
      ctx.lineTo(voieX(v + 0.47, z1), yA(z1));
      ctx.lineTo(voieX(v + 0.47, z0), yA(z0));
      ctx.lineTo(voieX(v - 0.47, z0), yA(z0));
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 90, 70, ${(0.16 * a).toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 150, 120, ${(0.7 * a).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Les fissures, qui palpitent.
      ctx.strokeStyle = `rgba(255, 200, 170, ${(0.45 * a * (0.7 + 0.3 * Math.sin(temps * 8 + v))).toFixed(3)})`;
      ctx.beginPath();
      for (let z = z0; z < z1; z += 6) {
        const g = (o.graine * 13 + z * 0.37 + v) % 1;
        ctx.moveTo(voieX(v - 0.3 + g * 0.6, z), yA(z));
        ctx.lineTo(voieX(v - 0.2 + g * 0.3, Math.min(z1, z + 4)), yA(Math.min(z1, z + 4)));
      }
      ctx.stroke();
    }
  }

  function objets(p: Partie, temps: number, brume: number, loin: number) {
    const liste = p.objets.filter((o) => !o.detruit || o.type === 'faille').filter((o) => o.pos + (o.longueur ?? 0) - p.distance > -3).sort((a, b) => b.pos - a.pos);
    const parId = new Map(liste.map((o) => [o.id, o]));
    for (const o of liste) {
      if (o.type === 'faille') {
        couloir(p, o, temps, loin);
        continue;
      }
      const z = o.pos - p.distance;
      if (z > loin) continue;
      let a = borne((loin - z) / 22);
      if (brume) a *= borne((brume - z) / 18);
      if (a <= 0.01) continue;
      const w = demi(z) * 0.667 * 0.82;
      const y = yA(z);
      switch (o.type) {
        case 'fragment':
        case 'dore':
        case 'noyau': {
          const x = voieX(o.voies[0], z);
          const r = w * (o.type === 'noyau' ? 0.2 : o.type === 'dore' ? 0.16 : 0.13);
          const teinte = o.type === 'dore' ? '255, 214, 120' : o.type === 'noyau' ? '255, 190, 140' : '170, 225, 255';
          const yy = y - w * 0.45 - Math.sin(temps * 4 + o.graine * 6) * w * 0.05;
          const halo = ctx.createRadialGradient(x, yy, 0, x, yy, r * 3);
          halo.addColorStop(0, `rgba(${teinte}, ${(0.6 * a).toFixed(3)})`);
          halo.addColorStop(1, `rgba(${teinte}, 0)`);
          ctx.fillStyle = halo;
          ctx.fillRect(x - r * 3, yy - r * 3, r * 6, r * 6);
          ctx.save();
          ctx.translate(x, yy);
          ctx.rotate(temps * 2 + o.graine * 6);
          ctx.fillStyle = `rgba(255, 255, 255, ${(0.95 * a).toFixed(3)})`;
          ctx.beginPath();
          if (o.type === 'noyau') ctx.arc(0, 0, r * 0.6, 0, 6.2832);
          else {
            ctx.moveTo(0, -r);
            ctx.lineTo(r * 0.7, 0);
            ctx.lineTo(0, r);
            ctx.lineTo(-r * 0.7, 0);
            ctx.closePath();
          }
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'portail': {
          const x = voieX(o.voies[0], z);
          const couleur = o.vers === 0 ? '120, 230, 255' : o.vers === 2 ? '190, 150, 255' : '240, 246, 255';
          ctx.strokeStyle = `rgba(${couleur}, ${(0.9 * a).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.2, w * 0.03);
          ctx.beginPath();
          ctx.ellipse(x, y - w * 0.55, w * 0.36, w * 0.5, 0, 0, 6.2832);
          ctx.stroke();
          ctx.fillStyle = `rgba(${couleur}, ${(0.12 * a).toFixed(3)})`;
          ctx.fill();
          const sens = (o.vers ?? 1) - o.voies[0];
          ctx.beginPath();
          ctx.moveTo(x - sens * w * 0.12, y - w * 0.55);
          ctx.lineTo(x + sens * w * 0.16, y - w * 0.55);
          ctx.stroke();
          break;
        }
        case 'laser': {
          const voies = p.voiesA(o, z);
          const fige = z <= (o.fige ?? 0);
          const vacille = fige ? 1 : 0.45 + 0.25 * Math.sin(temps * 30 + o.graine * 10);
          for (const v of voies) {
            const x0 = voieX(v - 0.48, z);
            const x1 = voieX(v + 0.48, z);
            const yy = y - w * 0.42;
            ctx.strokeStyle = `rgba(255, 90, 100, ${(0.3 * a * vacille).toFixed(3)})`;
            ctx.lineWidth = Math.max(3, w * 0.09);
            ctx.beginPath();
            ctx.moveTo(x0, yy);
            ctx.lineTo(x1, yy);
            ctx.stroke();
            ctx.strokeStyle = `rgba(255, 235, 235, ${(0.95 * a * vacille).toFixed(3)})`;
            ctx.lineWidth = Math.max(1, w * 0.02);
            ctx.stroke();
            ctx.strokeStyle = `rgba(236, 244, 255, ${(0.6 * a).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x0, yy - w * 0.1);
            ctx.moveTo(x1, y);
            ctx.lineTo(x1, yy - w * 0.1);
            ctx.stroke();
          }
          break;
        }
        case 'debris': {
          for (const v of p.voiesA(o, z)) {
            for (let k = 0; k < 3; k++) {
              const x = voieX(v, z) + (k - 1) * w * 0.28;
              const r = w * (0.14 + ((o.graine * (k + 3)) % 0.08));
              ctx.save();
              ctx.translate(x, y - r * 1.2 - k * w * 0.05);
              ctx.rotate(temps * (1 + k) + o.graine * 9);
              ctx.beginPath();
              ctx.moveTo(0, -r);
              ctx.lineTo(r * 0.9, r * 0.6);
              ctx.lineTo(-r * 0.8, r * 0.7);
              ctx.closePath();
              ctx.fillStyle = `rgba(150, 192, 255, ${(0.22 * a).toFixed(3)})`;
              ctx.fill();
              ctx.strokeStyle = `rgba(236, 244, 255, ${(0.85 * a).toFixed(3)})`;
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.restore();
            }
          }
          break;
        }
        default: {
          const voies = voiesAffichees(p, o, z);
          const chaud = !!o.chaud;
          if (chaud && z > 30) {
            for (const v of voies) {
              ctx.fillStyle = `rgba(255, 150, 100, ${(0.06 * a).toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(voieX(v - 0.45, loin), yA(loin));
              ctx.lineTo(voieX(v + 0.45, loin), yA(loin));
              ctx.lineTo(voieX(v + 0.45, z), y);
              ctx.lineTo(voieX(v - 0.45, z), y);
              ctx.closePath();
              ctx.fill();
            }
          }
          if (o.type === 'mobile' && o.fige && z > o.fige) {
            for (const v of o.voies) {
              const zf = o.fige;
              ctx.strokeStyle = `rgba(236, 244, 255, ${(0.4 * a).toFixed(3)})`;
              ctx.setLineDash([3, 4]);
              ctx.beginPath();
              ctx.ellipse(voieX(v, zf), yA(zf), demi(zf) * 0.25, demi(zf) * 0.06, 0, 0, 6.2832);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
          for (const v of voies) cristal(voieX(v, z), y, w, a, chaud, o.type === 'mobile' && z > (o.fige ?? 0) ? 0.7 : 1);
          // (Plus de trait entre les voies libres : pas de tracé du chemin à suivre.)
        }
      }
    }
  }

  function boss(p: Partie, temps: number, h: number) {
    if (!p.boss) return;
    const taille = Math.max(46, h * 0.11);
    const y = horizon - taille * 1.25;
    const couleur = ['150, 192, 255', '190, 150, 255', '255, 170, 120', '255, 245, 235'][Math.min(3, p.boss.phase - 1)];
    const halo = ctx.createRadialGradient(cx, y, 0, cx, y, taille * 2.2);
    halo.addColorStop(0, `rgba(${couleur}, ${(0.35 + impactBoss * 0.4).toFixed(3)})`);
    halo.addColorStop(1, `rgba(${couleur}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(cx - taille * 2.2, y - taille * 2.2, taille * 4.4, taille * 4.4);
    ctx.save();
    ctx.translate(cx, y);
    const tour = temps * (0.6 + p.boss.phase * 0.35);
    for (let k = 0; k < 4; k++) {
      const a = tour + (k * Math.PI) / 4;
      const lx = Math.cos(a) * taille * 0.8;
      ctx.strokeStyle = `rgba(236, 244, 255, ${(0.35 + 0.4 * Math.abs(Math.cos(a))).toFixed(3)})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -taille);
      ctx.lineTo(lx, 0);
      ctx.lineTo(0, taille);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(${couleur}, 0.16)`;
    ctx.beginPath();
    ctx.moveTo(0, -taille);
    ctx.lineTo(taille * 0.8, 0);
    ctx.lineTo(0, taille);
    ctx.lineTo(-taille * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${couleur}, 0.6)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, taille * 1.45, taille * 0.32, Math.sin(temps) * 0.2, 0, 6.2832);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.7 + impactBoss * 0.3).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, taille * 0.12 * (1 + 0.2 * Math.sin(temps * 6)), 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function vaisseau(p: Partie, vue: Vue, temps: number, dt: number) {
    const x = voieX(p.x, 0);
    const y = base - 4;
    const t = Math.max(16, vue.l * 0.016);
    const trainee = couleurPiece(vue.equipement.trainee, temps);
    // La traînée : les dernières positions, qui s'étirent vers le bas (le changement de voie la courbe).
    traces.unshift(x);
    if (traces.length > 18) traces.pop();
    traces.forEach((tx, i) => {
      const a = borne(1 - i / traces.length) * 0.5;
      ctx.fillStyle = `rgba(${trainee}, ${a.toFixed(3)})`;
      ctx.fillRect(tx - t * 0.14 * (1 - i / 20), y + t * 0.8 + i * 3.4, t * 0.28 * (1 - i / 20), 3.6);
    });
    if (p.invincible > 0 && Math.floor(temps * 14) % 2 === 0) return;
    dessinerVaisseau(ctx, x, y, t, (p.voie - p.x) * 0.45, vue.equipement, temps, p.overdrive > 0 ? 1 : 0);
  }

  const api = {
    /** Une impulsion de particules à la place du vaisseau. */
    eclater: (voie: number, couleur: string, nombre = 12) => eclater(voieX(voie, 0), base - 12, couleur, nombre),
    /** Un gain affiché près du vaisseau (« +120 »). */
    flotter: (voie: number, texte: string, couleur = '236, 244, 255') => textes.push({ texte, x: voieX(voie, 0), y: base - 46, vie: 1, couleur }),
    /** L'anneau d'énergie du Perfect Dodge. */
    anneau: (voie: number, couleur = '170, 225, 255') => anneaux.push({ x: voieX(voie, 0), y: base - 10, vie: 1, couleur }),
    secouer: (force: number) => (secousse = Math.max(secousse, force)),
    flasher: (couleur: string, force = 0.35) => {
      flashCouleur = couleur;
      flash = Math.max(flash, force);
    },
    alerter: () => (alerte = 1),
    toucherBoss: () => (impactBoss = 1),

    /** Dessine une image. Sans partie : la scène du menu (le vaisseau, la piste, des portails au loin). */
    dessiner(p: Partie | null, vue: Vue, temps: number, dt: number) {
      const { l, h } = vue;
      const a = THEMES[vue.theme];
      cx = l / 2;
      horizon = h * (l < 700 ? 0.3 : 0.34);
      base = h * (l < 700 ? 0.8 : 0.86);
      largeur = l * (l < 700 ? 0.48 : 0.3);
      const loin = p ? p.apparition : 130;
      const distance = p ? p.distance : temps * 22;
      const intensite = p ? borne((p.multiplicateur - 1) / 9) : 0.2;
      ctx.save();
      if (secousse > 0 && vue.secousses && !vue.reduit) ctx.translate((Math.random() - 0.5) * secousse * 14, (Math.random() - 0.5) * secousse * 10);
      secousse = Math.max(0, secousse - dt * 3);
      fond(a, l, h, temps, p ? p.vitesse : 22, !!p && p.overdrive > 0, dt, vue.reduit);
      piste(a, distance, intensite, loin);
      if (p) {
        boss(p, temps, h);
        objets(p, temps, vue.brume, loin);
        if (vue.brume) {
          const voile = ctx.createLinearGradient(0, horizon - 40, 0, yA(vue.brume * 0.6));
          voile.addColorStop(0, 'rgba(6, 9, 16, 0.92)');
          voile.addColorStop(1, 'rgba(6, 9, 16, 0)');
          ctx.fillStyle = voile;
          ctx.fillRect(0, horizon - 40, l, yA(vue.brume * 0.6) - horizon + 40);
        }
        vaisseau(p, vue, temps, dt);
      } else {
        // Le menu : des portails approchent lentement, le vaisseau attend au centre, moteur allumé.
        for (let k = 0; k < 4; k++) {
          const z = 130 - ((temps * 22 + k * 32) % 130);
          const w = demi(z) * 1.1;
          ctx.strokeStyle = `rgba(${a.horizon}, ${(borne(1 - z / 130) * 0.55).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(cx, yA(z) - w * 0.55, w * 0.62, w * 0.62, 0, 0, 6.2832);
          ctx.stroke();
        }
        dessinerVaisseau(ctx, cx, base - 10, Math.max(20, l * 0.022), Math.sin(temps * 0.8) * 0.08, vue.equipement, temps, 0.25 + 0.15 * Math.sin(temps * 2));
      }
      // Les particules, les anneaux, les gains.
      for (const q of particules) {
        q.vie -= dt * 1.6;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 260 * dt;
        if (q.vie <= 0) continue;
        ctx.fillStyle = `rgba(${q.couleur}, ${q.vie.toFixed(3)})`;
        ctx.fillRect(q.x, q.y, q.taille, q.taille);
      }
      for (let i = particules.length - 1; i >= 0; i--) if (particules[i].vie <= 0) particules.splice(i, 1);
      for (const an of anneaux) {
        an.vie -= dt * 2.2;
        if (an.vie <= 0) continue;
        ctx.strokeStyle = `rgba(${an.couleur}, ${(an.vie * 0.9).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(an.x, an.y, (1 - an.vie) * 90 + 10, ((1 - an.vie) * 90 + 10) * 0.35, 0, 0, 6.2832);
        ctx.stroke();
      }
      for (let i = anneaux.length - 1; i >= 0; i--) if (anneaux[i].vie <= 0) anneaux.splice(i, 1);
      ctx.font = `600 ${Math.max(13, l * 0.011)}px Geist Variable, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (const tx of textes) {
        tx.vie -= dt * 1.4;
        tx.y -= dt * 46;
        if (tx.vie <= 0) continue;
        ctx.fillStyle = `rgba(${tx.couleur}, ${borne(tx.vie * 1.4).toFixed(3)})`;
        ctx.fillText(tx.texte, tx.x, tx.y);
      }
      for (let i = textes.length - 1; i >= 0; i--) if (textes[i].vie <= 0) textes.splice(i, 1);
      ctx.restore();
      // L'éclair, l'alerte rouge (bords), le vignettage.
      if (flash > 0.01 && !vue.reduit) {
        ctx.fillStyle = `rgba(${flashCouleur}, ${(flash * 0.45).toFixed(3)})`;
        ctx.fillRect(0, 0, l, h);
      }
      flash = Math.max(0, flash - dt * 2.5);
      if (alerte > 0.01) {
        const rouge = ctx.createRadialGradient(cx, h * 0.55, h * 0.35, cx, h * 0.55, h * 0.9);
        rouge.addColorStop(0, 'rgba(255, 40, 40, 0)');
        rouge.addColorStop(1, `rgba(255, 40, 40, ${(alerte * 0.45).toFixed(3)})`);
        ctx.fillStyle = rouge;
        ctx.fillRect(0, 0, l, h);
      }
      alerte = Math.max(0, alerte - dt * 1.8);
      impactBoss = Math.max(0, impactBoss - dt * 3);
      const vignette = ctx.createRadialGradient(cx, h * 0.55, h * 0.3, cx, h * 0.55, h * 0.95);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, l, h);
    },
  };
  return api;
}
