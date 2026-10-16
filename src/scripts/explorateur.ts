// LA CARTE DU PORTAIL : le cube se brise, et ses éclats forment une carte du site.
//
// Au clic sur le portail (la scène l'annonce par un évènement « portail » :
// voir gl/champ.ts), la séquence se joue toujours jusqu'au bout :
//
//   Départ   Ce qui se passe                                                   Durée
//   0 ms     une impulsion de lumière ; les contours s'intensifient ; des      550
//            fissures rayonnent depuis le point touché, le cube tremble
//   340      une onde court sur les dunes
//   550      RUPTURE : un éclair, le cube vole en éclats de verre. Les éclats  550
//            s'écartent en tournant, avec leurs traînées, sur tout l'écran
//   950      ils se regroupent en constellation : un noyau au centre, trois    750
//            orbites, et six amas autour des six destinations
//   1290     les destinations apparaissent, on peut choisir
//   1700     la carte est en place ; les destinations tournent lentement autour du noyau
//
// La carte occupe tout l'écran. Elle est dessinée sur une toile (les éclats,
// les orbites, la poussière) ; les six destinations, elles, sont de vrais liens
// posés par-dessus, utilisables au clavier et lisibles par un lecteur d'écran.
// Le paysage reste visible derrière, assombri.
//
// Choisir une destination : ses éclats filent vers elle, les autres s'effacent,
// et la page rejoint la section par la navigation habituelle (voyage.ts), sans
// temps mort. Refermer (bouton « Fermer », clic sur le noyau, ou touche Échap) :
// les éclats se rassemblent et le cube se reforme.
//
// L'orbite : les six destinations tournent autour du noyau, lentement (un tour en
// un peu moins d'une minute et demie), sur l'ellipse de la carte. Celles qui passent
// en bas sont « devant » : un peu plus grandes et plus vives ; en haut, « derrière ».
// Survoler une destination ralentit l'orbite sans l'arrêter. En mouvement réduit,
// elles restent immobiles.

import gsap from 'gsap';
import { clicPortail, emprisePortail, etat, impacter, onde } from './gl/champ';
import { apresPause, mouvementReduit } from './outils';
import { reglages } from './reglages';
import { TRAJET, focaliser, rangCourant, voyager } from './voyage';

interface Point {
  x: number;
  y: number;
}
/** Une destination à l'instant présent : sa place, sa direction depuis le noyau, et sa profondeur (0 derrière, 1 devant). */
interface Noeud extends Point {
  ox: number;
  oy: number;
  pres: number;
}
interface Cadre extends Point {
  l: number;
  h: number;
}
interface Eclat {
  forme: Point[]; //      ses sommets, autour de son centre
  depart: Point; //       sa place dans le cube, en fractions du cadre du cube (0 à 1)
  jet: Point; //          où l'explosion l'envoie, par rapport au point d'impact (pixels)
  role: 'astre' | 'orbite' | 'noyau';
  lieu: number; //        numéro de la destination, ou de l'orbite
  angle: number; //       sa place sur le cercle de son rôle
  rayon: number; //       la taille de ce cercle (en pixels pour un amas, en fraction pour une orbite)
  vitesse: number; //     sa lente dérive sur ce cercle, en radians par seconde
  profondeur: number; //  de 0.4 (loin) à 1.3 (près) : parallaxe et netteté
  taille: number; //      son échelle une fois dans la constellation
  ne: boolean; //         vrai pour un éclat de poussière de verre, né pendant la formation (il ne vient pas du cube)
  tour: number; //        ce qu'il tourne pendant l'explosion
  x: number; //           où il est en ce moment
  y: number;
  rot: number;
  ech: number;
  alpha: number;
  gel: { x: number; y: number; rot: number; ech: number }; // où il était quand on a refermé, ou choisi
}

const FISSURE = 0.55; //   secondes : les fissures gagnent le cube
const EXPLOSION = 0.55; // secondes : les éclats s'écartent
const FORMATION = 0.75; // secondes : ils forment la constellation
/** Les six destinations sont posées en rond, dans le sens des aiguilles d'une montre, la première en haut. */
const ANGLES = [-90, -30, 30, 90, 150, 210].map((degres) => (degres * Math.PI) / 180);
/** Les quatre orbites, en fractions de l'ellipse des destinations (la dernière déborde de l'écran et habite ses coins). */
const ORBITES = [0.44, 0.74, 1.2, 1.64];
const ORBITE = 0.075; //    vitesse de l'orbite des destinations, en radians par seconde (un tour en 84 s)
const AU_SURVOL = 0.12; //  part de cette vitesse gardée quand une destination est survolée : elle ralentit, sans s'arrêter

const borne = (v: number) => Math.min(1, Math.max(0, v));
const sortie = (t: number) => 1 - (1 - t) ** 3; //                              ralentit en arrivant
const entree = (t: number) => t * t * t; //                                     accélère en partant
const entreSortie = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const hasard = (min: number, max: number) => min + Math.random() * (max - min);

let ouvrirLaCarte: (() => void) | null = null;
/** Ouvre la carte du portail (sans effet sur les pages qui n'en ont pas). Renvoie false dans ce cas. */
export function ouvrirCarte(): boolean {
  ouvrirLaCarte?.();
  return ouvrirLaCarte !== null;
}

/** Ne garde d'un polygone que ce qui tient dans un cadre (on coupe le long de chaque bord). */
function rogner(polygone: Point[], c: Cadre): Point[] {
  const enX = (a: Point, b: Point, x: number): Point => ({ x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) });
  const enY = (a: Point, b: Point, y: number): Point => ({ x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y), y });
  const bords: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [(p) => p.x >= c.x, (a, b) => enX(a, b, c.x)],
    [(p) => p.x <= c.x + c.l, (a, b) => enX(a, b, c.x + c.l)],
    [(p) => p.y >= c.y, (a, b) => enY(a, b, c.y)],
    [(p) => p.y <= c.y + c.h, (a, b) => enY(a, b, c.y + c.h)],
  ];
  let reste = polygone;
  for (const [dedans, couper] of bords) {
    const avant = reste;
    reste = [];
    avant.forEach((p, i) => {
      const q = avant[(i + 1) % avant.length];
      if (dedans(p)) {
        reste.push(p);
        if (!dedans(q)) reste.push(couper(p, q));
      } else if (dedans(q)) reste.push(couper(p, q));
    });
    if (reste.length < 3) return [];
  }
  return reste;
}

export function initExplorateur(): void {
  const fenetre = document.querySelector<HTMLDialogElement>('.explorateur');
  const toile = fenetre?.querySelector<HTMLCanvasElement>('.explorateur__toile');
  const ctx = toile?.getContext('2d');
  if (!fenetre || !toile || !ctx) return;

  const html = document.documentElement;
  const astres = [...fenetre.querySelectorAll<HTMLAnchorElement>('.astre')];
  const zone = fenetre.querySelector<HTMLElement>('.explorateur__astres')!;
  const noyau = fenetre.querySelector<HTMLElement>('.explorateur__noyau');
  const annoncer = (moment: string) => window.dispatchEvent(new CustomEvent('portail', { detail: moment }));
  const calme = () => mouvementReduit || reglages.animations === 0;

  // ---- L'état de la carte ----
  let phase: 'fermee' | 'fissure' | 'ouvre' | 'ouverte' | 'choix' | 'referme' = 'fermee';
  let sequence: gsap.core.Timeline | null = null;
  /** Les quatre mouvements, chacun de 0 à 1. « orbites » : la part des lignes déjà tracée. */
  const a = { explose: 0, forme: 0, ferme: 0, choix: 0, orbites: 0 };
  let eclats: Eclat[] = [];
  let poussieres: { x: number; y: number; z: number; phase: number }[] = [];
  let etincelles: { dx: number; dy: number; taille: number }[] = [];
  let cadre: Cadre = { x: 0, y: 0, l: 1, h: 1 }; // le cube à l'écran
  let impact: Point = { x: 0, y: 0 }; //           le point touché
  let centre: Point = { x: 0, y: 0 }; //           le noyau de la carte
  let rx = 1; //                                   l'ellipse des destinations
  let ry = 1;
  let noeuds: Noeud[] = [];
  let tourne = 0; //       l'angle parcouru par l'orbite depuis l'ouverture (radians)
  let allureOrbite = 0; // sa vitesse en ce moment
  let dernier = 0; //      l'instant de l'image précédente
  let battement = 0;
  const auDessus = astres.map(() => 1); // (téléphone) le nom sous le point (1) ou au-dessus (−1), en douceur
  // La taille de chaque nom, mesurée une fois la carte affichée (et de nouveau après un changement de langue ou de taille d'écran).
  const noms = astres.map((astre) => astre.querySelector<HTMLElement>('.astre__texte')!);
  let tailles = astres.map(() => ({ l: 0, h: 0 }));
  let ici = 0; //      la section où l'on se trouve à l'ouverture
  let survole = -1; // la destination sous le curseur (ou atteinte au clavier)
  let elu = -1; //     la destination choisie
  let depuis = 0; //   l'instant de l'ouverture (secondes)
  let avecCube = false; // le cube était-il à l'écran à l'ouverture ?
  const souris = { x: 0, y: 0, vx: 0, vy: 0, cx: -1, cy: -1 }; // le curseur, de -1 à 1 depuis le centre, sa version lissée, et sa place en pixels

  /** Pose les six destinations sur leur orbite, à l'angle du moment, et les liens dessus. */
  const placer = () => {
    const etroit = window.innerWidth < 861;
    noeuds = ANGLES.map((angle, i) => {
      // Une destination sur deux est un peu plus loin du centre : la figure paraît moins tracée au compas.
      const k = i % 2 ? 1.06 : 0.94;
      const ox = Math.cos(angle + tourne);
      const oy = Math.sin(angle + tourne);
      return { x: centre.x + ox * rx * k, y: centre.y + oy * ry * k, ox, oy, pres: (oy + 1) / 2 };
    });
    astres.forEach((astre, i) => {
      const { x, y, ox, oy, pres } = noeuds[i];
      // (« translate » plutôt que left et top : le lien suit sans recalcul de la mise en page.)
      astre.style.translate = `calc(${x.toFixed(1)}px - 50%) calc(${y.toFixed(1)}px - 50%)`;
      // Le nom s'écrit du côté qui s'éloigne du noyau, et glisse autour de son point
      // en continu (--ax, --ay : voir explorateur.css). Sur téléphone, sous le point,
      // ou au-dessus pour celle qui passe tout en haut.
      let ax: number;
      let ay: number;
      if (etroit) {
        const voulu = oy < -0.75 ? -1 : oy > -0.55 ? 1 : Math.sign(auDessus[i]);
        auDessus[i] += (voulu - auDessus[i]) * 0.12;
        ax = 0;
        ay = auDessus[i];
      } else {
        ax = Math.sign(ox) * borne(Math.abs(ox) / 0.6);
        ay = Math.sign(oy) * borne((Math.abs(oy) - 0.5) / 0.4);
      }
      // Un nom qui toucherait le bord de l'écran glisse vers l'intérieur (--dx, --dy).
      if (!tailles[i].l && fenetre.open) tailles[i] = { l: noms[i].offsetWidth, h: noms[i].offsetHeight };
      const { l, h } = tailles[i];
      const gauche = x + (-0.5 + ax * 0.5) * l + ax * 40;
      const haut = y + (-0.5 + ay * 0.5) * h + ay * 38;
      const marge = 16;
      const dx = Math.min(0, window.innerWidth - marge - (gauche + l)) + Math.max(0, marge - gauche);
      const dy = Math.min(0, window.innerHeight - marge - (haut + h)) + Math.max(0, marge - haut);
      astre.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      astre.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      astre.style.setProperty('--ax', ax.toFixed(3));
      astre.style.setProperty('--ay', ay.toFixed(3));
      astre.style.setProperty('--pres', pres.toFixed(3));
      // L'alignement du texte suit le côté (avec une marge, pour ne pas hésiter entre deux).
      const cote = etroit ? (ay < 0 ? 'haut' : 'bas') : ay < -0.6 ? 'haut' : ay > 0.6 ? 'bas' : Math.abs(ay) < 0.4 ? (ax >= 0 ? 'droite' : 'gauche') : astre.dataset.cote;
      if (cote && cote !== astre.dataset.cote) astre.dataset.cote = cote;
      const plan = String(Math.round(pres * 10)); // devant, par-dessus
      if (astre.style.zIndex !== plan) astre.style.zIndex = plan;
    });
  };

  /** Calcule la place du noyau et des six destinations, et pose les liens dessus. */
  const disposer = () => {
    tailles = astres.map(() => ({ l: 0, h: 0 }));
    const l = window.innerWidth;
    const h = window.innerHeight;
    const etroit = l < 861;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    toile.width = Math.round(l * dpr);
    toile.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    centre = { x: l / 2, y: h * (etroit ? 0.5 : 0.52) };
    rx = etroit ? l * 0.33 : Math.min(l * 0.33, h * 0.7);
    ry = h * (etroit ? 0.32 : 0.33);
    placer();
    noyau?.style.setProperty('top', `${centre.y.toFixed(1)}px`);
  };

  /**
   * Brise le cube : des cassures rayonnent depuis le point d'impact, d'autres
   * les relient en arcs. Chaque case de cette toile devient un éclat.
   */
  const fracturer = () => {
    const etroit = window.innerWidth < 861;
    // (12 rayons sur ordinateur, au lieu de 14 : la carte garde moins d'éclats, mieux répartis.)
    const rayons = etroit ? 9 : 12;
    const coins = [cadre.x, cadre.x + cadre.l].flatMap((x) => [cadre.y, cadre.y + cadre.h].map((y) => Math.hypot(x - impact.x, y - impact.y)));
    const loin = Math.max(...coins) * 1.08;
    const anneaux = (etroit ? [0, 0.18, 0.4, 0.68, 1.05] : [0, 0.13, 0.28, 0.46, 0.7, 1.05]).map((part) => part * loin);
    const angles = Array.from({ length: rayons }, (_, k) => (k / rayons) * Math.PI * 2 + hasard(-0.17, 0.17));
    // Les sommets de la toile, légèrement déplacés : deux éclats voisins partagent les mêmes.
    const sommets = anneaux.map((r, j) =>
      angles.map((angle) => (j === 0 ? impact : { x: impact.x + Math.cos(angle + hasard(-0.04, 0.04)) * r * hasard(0.9, 1.1), y: impact.y + Math.sin(angle + hasard(-0.04, 0.04)) * r * hasard(0.9, 1.1) })),
    );
    const portee = Math.min(window.innerWidth, window.innerHeight * 1.25);
    const liste: Eclat[] = [];
    for (let j = 0; j < anneaux.length - 1; j++) {
      for (let k = 0; k < rayons; k++) {
        const k2 = (k + 1) % rayons;
        const brut = j === 0 ? [impact, sommets[1][k], sommets[1][k2]] : [sommets[j][k], sommets[j + 1][k], sommets[j + 1][k2], sommets[j][k2]];
        const polygone = rogner(brut, cadre);
        if (polygone.length < 3) continue;
        const milieu = { x: polygone.reduce((s, p) => s + p.x, 0) / polygone.length, y: polygone.reduce((s, p) => s + p.y, 0) / polygone.length };
        const envergure = Math.max(...polygone.map((p) => Math.hypot(p.x - milieu.x, p.y - milieu.y)));
        if (envergure < 5) continue;
        // L'explosion le pousse dans la direction qui l'éloigne de l'impact, plus ou moins loin.
        const direction = Math.atan2(milieu.y - impact.y, milieu.x - impact.x) + hasard(-0.4, 0.4);
        const distance = portee * hasard(0.2, 0.58);
        liste.push({
          forme: polygone.map((p) => ({ x: p.x - milieu.x, y: p.y - milieu.y })),
          depart: { x: (milieu.x - cadre.x) / cadre.l, y: (milieu.y - cadre.y) / cadre.h },
          jet: { x: Math.cos(direction) * distance, y: Math.sin(direction) * distance * 0.8 },
          role: 'orbite',
          lieu: 0,
          angle: 0,
          rayon: 0,
          vitesse: 0,
          profondeur: hasard(0.4, 1.3),
          taille: borne(hasard(12, 30) / envergure),
          ne: false,
          tour: hasard(-4, 4),
          x: milieu.x,
          y: milieu.y,
          rot: 0,
          ech: 1,
          alpha: 1,
          gel: { x: milieu.x, y: milieu.y, rot: 0, ech: 1 },
        });
      }
    }
    // Chacun reçoit son rôle dans la constellation, au hasard : un amas autour
    // de chaque destination, un anneau autour du noyau, le reste sur les orbites.
    liste.sort(() => Math.random() - 0.5);
    const parAstre = liste.length > 40 ? 3 : 2;
    // (Répartis partout, sans excès : quelques éclats autour du noyau, les autres sur toutes les orbites.)
    const auNoyau = liste.length > 40 ? 3 : 2;
    // Chaque orbite reçoit sa part, du milieu jusqu'aux coins de l'écran.
    const versExterieur = (poids: number[]) => {
      let x = Math.random() * poids.reduce((a, b) => a + b, 0);
      for (let i = 0; i < poids.length; i++) if ((x -= poids[i]) <= 0) return i;
      return poids.length - 1;
    };
    liste.forEach((e, n) => {
      if (n < astres.length * parAstre) {
        e.role = 'astre';
        e.lieu = n % astres.length;
        // (Son angle est compté depuis la direction du noyau : voir « emplacement ». L'amas se tient sur les
        // côtés de sa planète : ni vers le centre de la carte, ni sur le nom, écrit du côté opposé au noyau.)
        const k = Math.floor(n / astres.length);
        e.angle = (k % 2 ? 1 : -1) * (1.15 + (Math.floor(k / 2) / Math.max(1, Math.ceil(parAstre / 2) - 1)) * 0.7 + hasard(-0.12, 0.12));
        // (À distance de la planète : autour d'elle, dans l'espace, sans la toucher. Avant : 36 à 62 px.)
        e.rayon = hasard(80, 120);
        e.vitesse = hasard(0.1, 0.2) * (e.lieu % 2 ? 1 : -1);
      } else if (n < astres.length * parAstre + auNoyau) {
        e.role = 'noyau';
        e.angle = (n / auNoyau) * Math.PI * 2;
        e.rayon = hasard(52, 70);
        e.vitesse = 0.22;
        e.taille *= 0.8;
      } else {
        e.role = 'orbite';
        e.lieu = versExterieur([0.22, 0.26, 0.27, 0.25]);
        e.angle = hasard(0, Math.PI * 2);
        e.rayon = ORBITES[e.lieu] * hasard(0.97, 1.03);
        e.vitesse = hasard(0.012, 0.03) * (e.lieu % 2 ? -1 : 1);
      }
    });
    // De la poussière de verre, en plus : de petits éclats qui naissent pendant la
    // formation et peuplent les orbites, jusque dans les coins de l'écran.
    for (let k = 0; k < (etroit ? 8 : 16); k++) {
      const cotes = Math.random() < 0.7 ? 3 : 4;
      const envergure = hasard(5, 13);
      const lieu = versExterieur([0.2, 0.26, 0.28, 0.26]);
      liste.push({
        forme: Array.from({ length: cotes }, (_, m) => {
          const angle = (m / cotes) * Math.PI * 2 + hasard(-0.5, 0.5);
          return { x: Math.cos(angle) * envergure * hasard(0.5, 1), y: Math.sin(angle) * envergure * hasard(0.5, 1) };
        }),
        depart: { x: (impact.x - cadre.x) / cadre.l, y: (impact.y - cadre.y) / cadre.h },
        jet: { x: hasard(-0.5, 0.5) * portee, y: hasard(-0.4, 0.4) * portee },
        role: 'orbite',
        lieu,
        angle: hasard(0, Math.PI * 2),
        rayon: ORBITES[lieu] * hasard(0.94, 1.06),
        vitesse: hasard(0.012, 0.03) * (lieu % 2 ? -1 : 1),
        profondeur: hasard(0.4, 1.3),
        taille: 1,
        ne: true,
        tour: hasard(-4, 4),
        x: impact.x,
        y: impact.y,
        rot: 0,
        ech: 0,
        alpha: 0,
        gel: { x: impact.x, y: impact.y, rot: 0, ech: 0 },
      });
    }
    eclats = liste;
    poussieres = Array.from({ length: etroit ? 60 : 130 }, () => ({ x: Math.random(), y: Math.random(), z: hasard(0.3, 1.2), phase: hasard(0, 6.28) }));
    etincelles = Array.from({ length: etroit ? 40 : 80 }, () => {
      const direction = hasard(0, Math.PI * 2);
      const distance = portee * hasard(0.1, 0.7);
      return { dx: Math.cos(direction) * distance, dy: Math.sin(direction) * distance * 0.8, taille: hasard(0.8, 2) };
    });
  };

  /** La place d'un éclat dans la constellation, à l'instant « t » (elle dérive très lentement). */
  const emplacement = (e: Eclat, t: number): Point => {
    if (e.role === 'astre') {
      // L'amas d'une destination se tient du côté du noyau, et s'y balance à peine :
      // de l'autre côté, le nom de la destination reste dégagé.
      const noeud = noeuds[e.lieu];
      const versNoyau = Math.atan2(centre.y - noeud.y, centre.x - noeud.x);
      const autour = versNoyau + e.angle + 0.2 * Math.sin(t * e.vitesse * 4 + e.rayon);
      const gonfle = (e.lieu === survole ? 1.3 : 1) * (0.86 + 0.28 * noeud.pres); // (devant, l'amas est plus large)
      return { x: noeud.x + Math.cos(autour) * e.rayon * gonfle, y: noeud.y + Math.sin(autour) * e.rayon * gonfle };
    }
    const angle = e.angle + e.vitesse * t;
    if (e.role === 'noyau') return { x: centre.x + Math.cos(angle) * e.rayon, y: centre.y + Math.sin(angle) * e.rayon };
    return { x: centre.x + Math.cos(angle) * rx * e.rayon, y: centre.y + Math.sin(angle) * ry * e.rayon };
  };

  /** Une image de la carte. */
  const image = (temps: number) => {
    const l = window.innerWidth;
    const h = window.innerHeight;
    const t = temps - depuis;
    // L'orbite vise sa vitesse de croisière, une vitesse réduite quand une destination est
    // survolée, et zéro en mouvement réduit. La vitesse réelle rattrape cette cible en douceur.
    const dt = Math.min(0.1, Math.max(0, temps - dernier));
    dernier = temps;
    const voulue = calme() ? 0 : survole >= 0 ? ORBITE * AU_SURVOL : ORBITE;
    allureOrbite += (voulue - allureOrbite) * (1 - Math.exp(-dt * 1.8));
    if (allureOrbite > 0.0005) {
      tourne += allureOrbite * dt;
      placer();
    }
    // Une destination qui glisse sous le curseur immobile (ou le quitte) ne déclenche
    // aucun évènement : on regarde nous-mêmes ce qu'il y a sous le curseur.
    if (!auClavier && souris.cx >= 0 && phase === 'ouverte' && ++battement % 6 === 0) {
      const sous = document.elementFromPoint(souris.cx, souris.cy)?.closest('.astre');
      const rang = sous ? astres.indexOf(sous as HTMLAnchorElement) : -1;
      if (rang !== survole) survoler(rang);
    }
    souris.vx += (souris.x - souris.vx) * 0.06;
    souris.vy += (souris.y - souris.vy) * 0.06;
    // Tout se décale à peine avec le curseur, les éclats proches plus que les lointains : la profondeur.
    const px = -souris.vx * 14;
    const py = -souris.vy * 10;
    zone.style.translate = `${(px * 0.45).toFixed(2)}px ${(py * 0.45).toFixed(2)}px`;
    const n = (i: number): Point => ({ x: noeuds[i].x + px * 0.45, y: noeuds[i].y + py * 0.45 });
    const coeur: Point = { x: centre.x + px * 0.3, y: centre.y + py * 0.3 };

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, l, h);
    ctx.globalCompositeOperation = 'lighter'; // (les lumières s'additionnent)
    const forme = entreSortie(a.forme);
    const present = a.orbites * (1 - a.ferme); // ce qui reste des lignes

    // ---- La poussière d'étoiles ----
    for (const p of poussieres) {
      const eclat = forme * (1 - a.ferme) * (0.2 + 0.5 * Math.abs(Math.sin(t * 0.7 * p.z + p.phase)));
      if (eclat < 0.02) continue;
      ctx.fillStyle = `rgba(215, 230, 255, ${eclat.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x * l + px * p.z, p.y * h + py * p.z, 0.6 + p.z * 0.7, 0, 6.2832);
      ctx.fill();
    }

    // ---- Les orbites, et les lignes du noyau vers chaque destination ----
    if (present > 0.01) {
      ctx.lineWidth = 1;
      ORBITES.forEach((part, k) => {
        const tour = 6.2832 * Math.sqrt(((rx * part) ** 2 + (ry * part) ** 2) / 2);
        ctx.strokeStyle = `rgba(190, 215, 255, ${(0.2 - k * 0.04) * (1 - a.choix * 0.7)})`;
        ctx.setLineDash([tour * present, tour]); // (le trait se trace progressivement)
        ctx.beginPath();
        ctx.ellipse(coeur.x, coeur.y, rx * part, ry * part, 0, -1.2 + k * 0.9 + t * 0.012, 5.1 + k * 0.9 + t * 0.012);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      noeuds.forEach((_, i) => {
        const fin = n(i);
        const vif = i === survole || i === elu;
        const force = (vif ? 0.75 : 0.16) * present * (elu >= 0 && !vif ? 1 - a.choix : 1);
        if (force < 0.01) return;
        const trait = ctx.createLinearGradient(coeur.x, coeur.y, fin.x, fin.y);
        trait.addColorStop(0, `rgba(230, 240, 255, ${(force * 0.2).toFixed(3)})`);
        trait.addColorStop(1, `rgba(200, 222, 255, ${force.toFixed(3)})`);
        ctx.strokeStyle = trait;
        ctx.lineWidth = vif ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(coeur.x + (fin.x - coeur.x) * 0.1, coeur.y + (fin.y - coeur.y) * 0.1);
        ctx.lineTo(coeur.x + (fin.x - coeur.x) * (0.1 + 0.82 * present), coeur.y + (fin.y - coeur.y) * (0.1 + 0.82 * present));
        ctx.stroke();
        // Une perle de lumière file du noyau vers la destination survolée.
        if (vif && phase !== 'referme') {
          const ou = elu >= 0 ? a.choix : (t * 0.9) % 1;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.beginPath();
          ctx.arc(coeur.x + (fin.x - coeur.x) * (0.1 + 0.82 * ou), coeur.y + (fin.y - coeur.y) * (0.1 + 0.82 * ou), 2.4, 0, 6.2832);
          ctx.fill();
        }
      });
    }

    // ---- Le noyau : une lueur qui respire, et un anneau ----
    const coeurVu = forme * (1 - a.ferme) * (1 - a.choix);
    if (coeurVu > 0.01) {
      const souffle = 1 + 0.06 * Math.sin(t * 1.5);
      const lueur = ctx.createRadialGradient(coeur.x, coeur.y, 0, coeur.x, coeur.y, 130 * souffle);
      lueur.addColorStop(0, `rgba(214, 230, 255, ${(0.5 * coeurVu).toFixed(3)})`);
      lueur.addColorStop(0.35, `rgba(120, 165, 255, ${(0.2 * coeurVu).toFixed(3)})`);
      lueur.addColorStop(1, 'rgba(120, 165, 255, 0)');
      ctx.fillStyle = lueur;
      ctx.fillRect(coeur.x - 140, coeur.y - 140, 280, 280);
      ctx.strokeStyle = `rgba(236, 244, 255, ${(0.75 * coeurVu).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(coeur.x, coeur.y, 44 * souffle, 0, 6.2832);
      ctx.stroke();
    }

    // ---- Les étincelles de l'explosion ----
    if (a.explose > 0 && a.forme < 1 && phase !== 'referme') {
      const elan = sortie(a.explose);
      for (const e of etincelles) {
        const vie = (1 - a.forme) * Math.sin(Math.PI * borne(a.explose * 0.9 + 0.1));
        if (vie < 0.02) continue;
        ctx.strokeStyle = `rgba(232, 242, 255, ${(0.8 * vie).toFixed(3)})`;
        ctx.lineWidth = e.taille;
        ctx.beginPath();
        ctx.moveTo(impact.x + e.dx * elan, impact.y + e.dy * elan);
        ctx.lineTo(impact.x + e.dx * sortie(Math.max(0, a.explose - 0.12)), impact.y + e.dy * sortie(Math.max(0, a.explose - 0.12)));
        ctx.stroke();
      }
    }

    // ---- Les éclats de verre ----
    const elan = sortie(a.explose);
    for (const e of eclats) {
      const x0 = cadre.x + e.depart.x * cadre.l;
      const y0 = cadre.y + e.depart.y * cadre.h;
      let x: number;
      let y: number;
      let rot: number;
      let ech: number;
      let vu = 1;
      if (phase === 'referme') {
        // Il regagne sa place dans le cube, et reprend sa taille et son orientation.
        const retour = entree(a.ferme);
        x = e.gel.x + (x0 - e.gel.x) * retour;
        y = e.gel.y + (y0 - e.gel.y) * retour;
        rot = e.gel.rot * (1 - retour);
        ech = e.gel.ech + ((e.ne ? 0 : 1) - e.gel.ech) * retour;
      } else if (phase === 'choix') {
        // Il file vers la destination choisie, en rapetissant.
        const cible = n(elu);
        const file = entree(a.choix);
        x = e.gel.x + (cible.x - e.gel.x) * file;
        y = e.gel.y + (cible.y - e.gel.y) * file;
        rot = e.gel.rot + file * 2;
        ech = e.gel.ech * (1 - 0.8 * file);
        vu = 1 - a.choix * a.choix;
      } else {
        // L'explosion, puis la formation de la constellation.
        const place = emplacement(e, t);
        x = x0 + e.jet.x * elan + px * e.profondeur;
        y = y0 + e.jet.y * elan + py * e.profondeur;
        x += (place.x + px * e.profondeur - x) * forme;
        y += (place.y + py * e.profondeur - y) * forme;
        rot = e.tour * elan * (1 - forme * 0.7) + t * e.vitesse * 2 * forme;
        ech = e.ne ? sortie(a.forme) : 1 + (e.taille - 1) * forme;
        if (survole >= 0 && e.role === 'astre' && e.lieu !== survole) vu = 0.4;
      }
      const netete = 0.55 + 0.45 * borne(e.profondeur);
      // Il tourne sur lui-même pendant l'explosion : on l'écrase dans un sens, comme vu de biais.
      const biais = phase === 'ouvre' || phase === 'fissure' ? Math.cos(e.tour * 1.7 * elan * (1 - forme)) : 1;
      const c = Math.cos(rot) * ech;
      const s = Math.sin(rot) * ech;
      ctx.beginPath();
      e.forme.forEach((p, k) => {
        const fx = p.x * biais;
        const sx = x + fx * c - p.y * s;
        const sy = y + fx * s + p.y * c;
        if (k === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = `rgba(150, 192, 255, ${(0.2 * vu * netete).toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(236, 244, 255, ${(0.82 * vu * netete).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Sa traînée, tant qu'il se déplace vite.
      const course = Math.hypot(x - e.x, y - e.y);
      if (course > 3 && course < 400) {
        ctx.strokeStyle = `rgba(170, 205, 255, ${(0.4 * vu).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (x - e.x) * 2.6, y - (y - e.y) * 2.6);
        ctx.stroke();
      }
      Object.assign(e, { x, y, rot, ech, alpha: vu });
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  /** Garde la place de chaque éclat à cet instant : le mouvement suivant partira de là. */
  const figer = () => eclats.forEach((e) => (e.gel = { x: e.x, y: e.y, rot: e.rot, ech: e.ech }));

  /** La carte est refermée : on remet tout en place. */
  const terminer = (apres?: () => void) => {
    sequence?.kill();
    sequence = null;
    gsap.ticker.remove(image);
    const etait = phase;
    phase = 'fermee';
    if (fenetre.open) fenetre.close();
    fenetre.classList.remove('est-formee', 'se-ferme', 'a-choisi', 'a-survol');
    astres.forEach((astre) => astre.classList.remove('est-choisie', 'est-survole'));
    gsap.set(fenetre, { clearProps: 'opacity' });
    html.classList.remove('carte-ouverte');
    html.classList.remove('carte-en-transition');
    survole = -1;
    elu = -1;
    // Le cube reparaît, dans un dernier reflet.
    if (avecCube && !calme()) {
      etat.brise = 0;
      gsap.fromTo(etat, { eclat: 0.3 }, { eclat: 0, duration: 0.5, ease: 'power2.out' });
      gsap.to(etat, { energie: 0, fissure: 0, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
    }
    annoncer(etait === 'choix' ? 'carte-quittee' : 'carte-fermee');
    apres?.();
  };

  const ouvrir = () => {
    if (phase !== 'fermee') return;
    if (html.classList.contains('intro')) return;
    html.classList.add('carte-en-transition');
    html.classList.add('apercu-portail-suspendu');
    annoncer('carte-activation'); // Même nettoyage pour la souris, le clavier et le Hub.
    const portail = emprisePortail();
    const clic = clicPortail();
    avecCube = !!portail;
    cadre = portail ?? { x: window.innerWidth / 2 - 110, y: window.innerHeight / 2 - 180, l: 220, h: 360 };
    // Le point d'impact : là où l'on a cliqué, ramené à l'intérieur du cube ; sinon son centre.
    impact = clic && portail ? { x: cadre.x + cadre.l * borne((clic.x - cadre.x) / cadre.l) * 0.8 + cadre.l * 0.1, y: cadre.y + cadre.h * borne((clic.y - cadre.y) / cadre.h) * 0.8 + cadre.h * 0.1 } : { x: cadre.x + cadre.l / 2, y: cadre.y + cadre.h / 2 };
    tourne = 0;
    allureOrbite = 0;
    auDessus.fill(1);
    disposer();
    fracturer();
    Object.assign(a, { explose: 0, forme: 0, ferme: 0, choix: 0, orbites: 0 });
    Object.assign(souris, { x: 0, y: 0, vx: 0, vy: 0, cx: -1, cy: -1 });
    ici = rangCourant();
    astres.forEach((astre, i) => {
      if (i === ici) astre.setAttribute('aria-current', 'location');
      else astre.removeAttribute('aria-current');
    });
    depuis = gsap.ticker.time;
    dernier = depuis;
    fenetre.classList.toggle('sans-scene', !portail);

    const montrer = () => {
      fenetre.showModal();
      html.classList.add('carte-ouverte');
      gsap.ticker.add(image);
    };

    // Animations réduites : la carte apparaît toute formée, sans explosion.
    if (calme()) {
      phase = 'ouverte';
      avecCube = false;
      Object.assign(a, { explose: 1, forme: 1, orbites: 1 });
      montrer();
      fenetre.classList.add('est-formee');
      astres[ici]?.focus({ preventScroll: true });
      annoncer('carte');
      return;
    }

    phase = 'fissure';
    sequence = gsap.timeline();
    let rupture = 0.04;
    if (portail) {
      // 1 à 5 : l'impulsion, les contours, les fissures, le tremblement, l'onde.
      rupture = FISSURE;
      impacter(impact.x, impact.y);
      annoncer('charge');
      sequence.fromTo(etat, { eclat: 0.28 }, { eclat: 0, duration: 0.3, ease: 'power2.out' }, 0);
      sequence.to(etat, { energie: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }, 0);
      sequence.to(etat, { fissure: 1, duration: FISSURE, ease: 'power1.in', overwrite: 'auto' }, 0);
      sequence.call(() => onde(), [], FISSURE * 0.62);
    }
    // 6 : la rupture. Le cube disparaît dans un éclair, ses éclats prennent le relais.
    sequence.call(
      () => {
        phase = 'ouvre';
        annoncer('rupture');
        if (portail) etat.brise = 1;
        montrer();
      },
      [],
      rupture,
    );
    if (portail) {
      // (immediateRender: false : sans cela, GSAP poserait l'éclair dès la création de la séquence.)
      sequence.fromTo(etat, { eclat: 1 }, { eclat: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, rupture);
      sequence.set(etat, { fissure: 0, energie: 0.25 }, rupture + 0.05);
    }
    // 7 : les éclats s'écartent ; 8 et 9 : ils forment la constellation, les destinations apparaissent.
    sequence.to(a, { explose: 1, duration: EXPLOSION, ease: 'none' }, rupture);
    sequence.to(a, { forme: 1, duration: FORMATION, ease: 'none' }, rupture + EXPLOSION * 0.72);
    sequence.to(a, { orbites: 1, duration: FORMATION, ease: 'power2.out' }, rupture + EXPLOSION * 0.9);
    sequence.call(() => annoncer('carte'), [], rupture + EXPLOSION * 0.72);
    sequence.call(
      () => {
        phase = 'ouverte';
        fenetre.classList.add('est-formee');
        astres[ici]?.focus({ preventScroll: true });
      },
      [],
      rupture + EXPLOSION * 0.72 + FORMATION * 0.45,
    );
  };

  /** Referme la carte sans changer de section : les éclats se rassemblent, le cube se reforme. */
  const fermer = () => {
    if (phase !== 'ouverte' && phase !== 'ouvre') return;
    annoncer('carte-referme'); // (le son de la fermeture part avec le geste : voir sons.ts)
    sequence?.kill();
    if (calme()) return terminer();
    phase = 'referme';
    figer();
    cadre = emprisePortail() ?? cadre; // (le cube a pu bouger un peu depuis l'ouverture)
    fenetre.classList.remove('est-formee');
    fenetre.classList.add('se-ferme');
    sequence = gsap
      .timeline({ onComplete: () => terminer() })
      .to(a, { ferme: 1, duration: 0.45, ease: 'none' }, 0)
      .to(fenetre, { opacity: 0, duration: 0.16, ease: 'power1.in' }, 0.34);
  };

  /** Une destination est choisie. */
  const choisir = (rang: number, e: Event) => {
    const astre = astres[rang];
    const id = astre.dataset.destination ?? '';
    // Le CV est un vrai lien : il s'ouvre dans un nouvel onglet, la carte reste là.
    if (id === 'cv') return;
    e.preventDefault();
    if (phase !== 'ouverte') return;
    if (rang === ici) return fermer(); // on y est déjà : on referme simplement
    sequence?.kill(); // Une sélection précoce ne doit pas laisser la fin d'ouverture réactiver le panneau.
    const cible = document.getElementById(id);
    annoncer('destination');
    if (calme()) {
      phase = 'choix';
      voyager(id);
      return terminer(() => cible && focaliser(cible));
    }
    phase = 'choix';
    elu = rang;
    figer();
    fenetre.classList.add('a-choisi');
    astre.classList.add('est-choisie');
    // Les éclats filent vers la destination ; la page change de section pendant que la carte s'efface.
    sequence = gsap
      .timeline({ onComplete: () => terminer(() => cible && focaliser(cible)) })
      .to(a, { choix: 1, duration: 0.36, ease: 'none' }, 0)
      .call(() => voyager(id), [], 0.2)
      .to(fenetre, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 0.22);
  };

  ouvrirLaCarte = ouvrir;

  // ---- Ouvrir : le clic sur le portail (annoncé par la scène), ou son bouton au clavier ----
  window.addEventListener('portail', (e) => {
    if ((e as CustomEvent<string>).detail === 'ouvre') ouvrir();
  });
  document.querySelector<HTMLButtonElement>('[data-portail]')?.addEventListener('click', ouvrir);
  // Fermer un dialog restitue automatiquement le focus au bouton d'ouverture.
  // Cet ancien focus ne doit pas rallumer l'aperçu : attendre un nouveau geste.
  document.addEventListener('pointermove', (e) => {
    if (phase !== 'fermee' || (!e.movementX && !e.movementY)) return;
    const bouton = document.querySelector<HTMLElement>('[data-portail]');
    const r = bouton?.getBoundingClientRect();
    const dedans = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (dedans) html.classList.remove('apercu-portail-suspendu');
    // Un simple déplacement ailleurs ne transforme pas le focus restitué
    // par <dialog> en nouveau survol volontaire du portail.
    else if (document.activeElement === bouton) html.classList.add('apercu-portail-suspendu');
  }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (phase === 'fermee' && e.key === 'Tab') html.classList.remove('apercu-portail-suspendu');
  });

  // ---- Les destinations : survol, clavier, choix ----
  // (On retient si le visiteur se sert du clavier : le focus n'allume une destination que dans ce cas.)
  let auClavier = false;
  fenetre.addEventListener('keydown', () => (auClavier = true), true);
  fenetre.addEventListener('pointerdown', () => (auClavier = false), true);
  const survoler = (rang: number) => {
    survole = rang;
    fenetre.classList.toggle('a-survol', rang >= 0);
    astres.forEach((astre, i) => astre.classList.toggle('est-survole', i === rang));
    if (rang >= 0 && phase === 'ouverte') annoncer('survol');
  };
  astres.forEach((astre, rang) => {
    astre.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && survoler(rang));
    astre.addEventListener('pointerleave', () => survole === rang && survoler(-1));
    astre.addEventListener('focus', () => auClavier && survoler(rang));
    astre.addEventListener('blur', () => survole === rang && survoler(-1));
    astre.addEventListener('click', (e) => choisir(rang, e));
  });
  // Les flèches du clavier font le tour des destinations.
  fenetre.addEventListener('keydown', (e) => {
    const sens = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!sens) return;
    e.preventDefault();
    const actuel = astres.indexOf(document.activeElement as HTMLAnchorElement);
    astres[((actuel < 0 ? ici : actuel + sens) + astres.length) % astres.length]?.focus({ preventScroll: true });
  });
  fenetre.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      souris.x = (e.clientX / window.innerWidth) * 2 - 1;
      souris.y = (e.clientY / window.innerHeight) * 2 - 1;
      souris.cx = e.clientX;
      souris.cy = e.clientY;
    },
    { passive: true },
  );

  // ---- Refermer : le bouton « Fermer », le noyau (le symbole du centre), ou la touche Échap ----
  // (Un clic dans le vide ne referme pas : on peut viser une destination sans risque.)
  fenetre.querySelector('.explorateur__fermer')?.addEventListener('click', fermer);
  noyau?.addEventListener('click', fermer);
  fenetre.addEventListener('cancel', (e) => {
    e.preventDefault();
    fermer();
  });
  // (Sécurité : si le navigateur ferme la fenêtre de lui-même, on remet tout en place.)
  fenetre.addEventListener('close', () => phase !== 'fermee' && terminer());

  window.addEventListener(
    'resize',
    apresPause(() => fenetre.open && disposer(), 120),
  );
  // Les noms changent de longueur avec la langue : on les mesurera de nouveau.
  window.addEventListener('langue', () => (tailles = astres.map(() => ({ l: 0, h: 0 }))));
}
