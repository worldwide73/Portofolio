// LE BOUTON PORTAIL : rejoindre la carte du portail en une seule action, d'où que l'on soit.
//
// La carte du portail (explorateur.ts) reste la seule carte du site, et le grand portail de
// l'accueil son cœur : ce module ne la redessine pas, il l'ouvre. Il décide seulement comment :
//
//   - sur l'accueil, quand le grand portail est à l'écran : il s'ouvre comme d'habitude (ses
//     fissures, sa rupture, ses éclats qui forment la carte) ;
//   - « Rejoindre le portail » (la fin de l'accueil) : la page remonte jusqu'au grand portail,
//     qui s'ouvre aussitôt, sans second clic ;
//   - partout ailleurs (une autre destination, le bas de l'accueil) : c'est le bouton cliqué
//     qui devient un petit portail. Sa séquence, d'environ 0,8 seconde :
//
//   Départ   Temps            Ce qui se passe
//   0 ms     1. Activation    le contour du bouton s'intensifie, une impulsion traverse son
//                             verre, il commence à trembler
//   90       2. Fissuration   des fissures lumineuses partent du point touché et gagnent le bouton
//   270      3. Fragmentation le bouton se brise : ses éclats de verre s'écartent en tournant
//                             et viennent vers nous (profondeur)
//   240      4. Voyage        une ouverture s'agrandit là où était le bouton et glisse vers le
//                             centre ; des filets de lumière filent vers nous : on la traverse
//   360                       la carte du portail s'ouvre (sa propre animation, inchangée)
//   420      5. Arrivée       la traversée se dissipe sur la constellation qui se forme
//   820                       fin : tout est remis en place, la carte est utilisable
//
// Tout est dessiné sur une toile posée par-dessus la page (et par-dessus la carte, dans la
// « couche du dessus » du navigateur, grâce à l'attribut popover). Rien de la page n'est cassé
// pour de vrai. Les clics répétés ne relancent rien ; en mouvement réduit (ou animations
// coupées), la carte s'ouvre directement, dans sa version simple.
//
// Fermer la carte sans choisir ramène exactement où l'on était (même destination, même
// position de lecture) : la page n'a pas bougé pendant ce temps.

import gsap from 'gsap';
import { allerA, lenis } from './defilement';
import { ouvrirCarte } from './explorateur';
import { emprisePortail } from './gl/champ';
import { borner, mouvementReduit } from './outils';
import { reglages } from './reglages';
import { couperEffets, sonPortailBouton } from './sons';
import { destinationActive } from './voyage';

interface Point {
  x: number;
  y: number;
}
interface Fragment {
  forme: Point[]; // ses sommets, autour de son centre
  x: number;
  y: number;
  vx: number; // sa vitesse (pixels par seconde)
  vy: number;
  tour: number; // sa rotation (radians par seconde)
  profondeur: number; // ce qu'il grossit en venant vers nous
}

const html = document.documentElement;
let enCours = false;
let toile: HTMLCanvasElement | null = null;

const sortie = (t: number) => 1 - (1 - t) ** 3;
const entree = (t: number) => t * t * t;
const hasard = (min: number, max: number) => min + Math.random() * (max - min);

/** Ne garde d'un polygone que ce qui tient dans un rectangle (on coupe le long de chaque bord). */
function rogner(polygone: Point[], r: DOMRect): Point[] {
  const enX = (a: Point, b: Point, x: number): Point => ({ x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) });
  const enY = (a: Point, b: Point, y: number): Point => ({ x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y), y });
  const bords: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [(p) => p.x >= r.left, (a, b) => enX(a, b, r.left)],
    [(p) => p.x <= r.right, (a, b) => enX(a, b, r.right)],
    [(p) => p.y >= r.top, (a, b) => enY(a, b, r.top)],
    [(p) => p.y <= r.bottom, (a, b) => enY(a, b, r.bottom)],
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

/** La toile de la séquence : créée au premier usage, dans la couche du dessus du navigateur. */
function preparerToile(): CanvasRenderingContext2D | null {
  if (!toile) {
    toile = document.createElement('canvas');
    toile.className = 'fracture';
    toile.setAttribute('aria-hidden', 'true');
    toile.setAttribute('popover', 'manual');
    document.body.append(toile);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  toile.width = Math.round(window.innerWidth * dpr);
  toile.height = Math.round(window.innerHeight * dpr);
  const ctx = toile.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Montre la toile au-dessus de tout, y compris d'une fenêtre ouverte juste avant (la carte). */
function remonterToile(): void {
  if (!toile || typeof toile.showPopover !== 'function') return;
  if (toile.matches(':popover-open')) toile.hidePopover();
  toile.showPopover();
}

/**
 * Le bouton se fissure, se brise, et nous aspire vers la carte du portail.
 * « source » : le bouton ; « point » : l'endroit touché (le centre du bouton, au clavier).
 */
function briserEtOuvrir(source: HTMLElement, point: Point | null): void {
  const r = source.getBoundingClientRect();
  const ctx = r.width > 0 ? preparerToile() : null;
  if (!ctx || !toile) {
    ouvrirCarte();
    return;
  }
  enCours = true;
  const l = window.innerWidth;
  const h = window.innerHeight;
  const allege = reglages.animations < 1;
  const centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const impact = point
    ? { x: borner(point.x, r.left + 4, r.right - 4), y: borner(point.y, r.top + 3, r.bottom - 3) }
    : centre;
  const groupe = source.closest<HTMLElement>('.nav__liste');

  // ---- Les fissures : des lignes brisées qui rayonnent depuis le point touché ----
  const portee = Math.hypot(r.width, r.height);
  const fissures = Array.from({ length: allege ? 6 : 9 }, (_, k) => {
    const angle = (k / (allege ? 6 : 9)) * Math.PI * 2 + hasard(-0.25, 0.25);
    const pas = 5;
    const points: Point[] = [impact];
    let a = angle;
    for (let i = 1; i <= pas; i++) {
      a += hasard(-0.35, 0.35);
      const d = (i / pas) * portee * hasard(0.45, 0.75);
      points.push({ x: impact.x + Math.cos(a) * d, y: impact.y + Math.sin(a) * d });
    }
    return { points, delai: hasard(0, 0.35) };
  });

  // ---- Les éclats : la surface du bouton découpée en rayons et en anneaux autour du point touché ----
  const rayons = allege ? 7 : 11;
  const angles = Array.from({ length: rayons }, (_, k) => (k / rayons) * Math.PI * 2 + hasard(-0.2, 0.2));
  const anneaux = [0, portee * 0.22, portee * 0.55, portee * 1.2];
  const sommet = (j: number, k: number): Point =>
    j === 0 ? impact : { x: impact.x + Math.cos(angles[k]) * anneaux[j] * hasard(0.88, 1.12), y: impact.y + Math.sin(angles[k]) * anneaux[j] * hasard(0.88, 1.12) };
  const grille = anneaux.map((_, j) => angles.map((__, k) => sommet(j, k)));
  const fragments: Fragment[] = [];
  for (let j = 0; j < anneaux.length - 1; j++) {
    for (let k = 0; k < rayons; k++) {
      const k2 = (k + 1) % rayons;
      const brut = j === 0 ? [impact, grille[1][k], grille[1][k2]] : [grille[j][k], grille[j + 1][k], grille[j + 1][k2], grille[j][k2]];
      const forme = rogner(brut, r);
      if (forme.length < 3) continue;
      const mx = forme.reduce((s, p) => s + p.x, 0) / forme.length;
      const my = forme.reduce((s, p) => s + p.y, 0) / forme.length;
      // Il s'écarte du point touché, et dérive vers le centre de l'écran : la caméra est attirée par là.
      const direction = Math.atan2(my - impact.y, mx - impact.x) + hasard(-0.3, 0.3);
      const vitesse = hasard(140, 420);
      fragments.push({
        forme: forme.map((p) => ({ x: p.x - mx, y: p.y - my })),
        x: mx,
        y: my,
        vx: Math.cos(direction) * vitesse + (l / 2 - mx) * 0.35,
        vy: Math.sin(direction) * vitesse * 0.8 + (h / 2 - my) * 0.35,
        tour: hasard(-7, 7),
        profondeur: hasard(1.6, 4.2),
      });
    }
  }

  // ---- Les filets de lumière de la traversée ----
  const filets = Array.from({ length: allege ? 40 : 90 }, () => ({ angle: hasard(0, Math.PI * 2), loin: hasard(0.15, 1), vitesse: hasard(0.7, 1.4), epaisseur: hasard(0.6, 1.8) }));

  // Durées (secondes) ; allégées : un peu plus courtes, sans tremblement.
  const k = allege ? 0.75 : 1;
  const T = { charge: 0.11 * k, fissure: 0.27 * k, ouvre: 0.36 * k, arrivee: 0.42 * k, fin: 0.82 * k };
  const temps = { t: 0 };

  source.classList.add('est-charge');
  groupe?.classList.add('est-charge');
  sonPortailBouton();
  remonterToile();

  const dessiner = () => {
    const t = temps.t;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, l, h);

    // 4. Le voyage : l'ouverture part du bouton et glisse vers le centre de l'écran, où la carte naîtra.
    const voyage = borner((t - 0.24 * k) / (T.fin - 0.24 * k), 0, 1);
    const glisse = sortie(borner((t - 0.24 * k) / (T.arrivee - 0.24 * k + 0.1), 0, 1));
    const ox = centre.x + (l / 2 - centre.x) * glisse;
    const oy = centre.y + (h / 2 - centre.y) * glisse;
    const dissipe = 1 - borner((t - T.arrivee) / (T.fin - T.arrivee), 0, 1); // 1 → 0 pendant l'arrivée
    const monte = borner((t - 0.24 * k) / (T.ouvre - 0.24 * k), 0, 1);
    // Le décor s'assombrit autour de l'ouverture (c'est elle qu'on regarde), puis s'efface sur la carte.
    const voile = 0.82 * sortie(monte) * dissipe;
    if (voile > 0.003) {
      ctx.fillStyle = `rgba(4, 7, 14, ${voile.toFixed(3)})`;
      ctx.fillRect(0, 0, l, h);
    }
    ctx.globalCompositeOperation = 'lighter';
    if (voyage > 0) {
      const rayon = Math.hypot(l, h) * (0.04 + 0.5 * entree(borner(voyage * 1.3, 0, 1)));
      const lueur = ctx.createRadialGradient(ox, oy, 0, ox, oy, rayon);
      lueur.addColorStop(0, `rgba(226, 238, 255, ${(0.75 * dissipe * Math.min(1, monte * 2)).toFixed(3)})`);
      lueur.addColorStop(0.35, `rgba(140, 200, 255, ${(0.26 * dissipe).toFixed(3)})`);
      lueur.addColorStop(1, 'rgba(120, 165, 255, 0)');
      ctx.fillStyle = lueur;
      ctx.fillRect(0, 0, l, h);
      // Les filets : ils naissent près de l'ouverture et filent vers nous, de plus en plus longs.
      const loinMax = Math.hypot(l, h) * 0.7;
      for (const f of filets) {
        const avance = (voyage * f.vitesse + f.loin) % 1;
        const d1 = loinMax * entree(avance);
        const d2 = loinMax * entree(Math.min(1, avance + 0.08 + voyage * 0.12));
        const alpha = Math.sin(Math.PI * avance) * 0.7 * dissipe * Math.min(1, monte * 3);
        if (alpha < 0.01) continue;
        ctx.strokeStyle = `rgba(206, 228, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = f.epaisseur;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(f.angle) * d1, oy + Math.sin(f.angle) * d1);
        ctx.lineTo(ox + Math.cos(f.angle) * d2, oy + Math.sin(f.angle) * d2);
        ctx.stroke();
      }
      // L'anneau de l'ouverture.
      ctx.strokeStyle = `rgba(240, 248, 255, ${(0.85 * dissipe).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ox, oy, 6 + rayon * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 1. L'activation : le contour du bouton s'allume, une impulsion traverse son verre.
    const avantBris = t < T.fissure;
    if (avantBris) {
      const charge = borner(t / T.charge, 0, 1);
      const rr = r.height / 2;
      ctx.strokeStyle = `rgba(214, 236, 255, ${(0.35 + 0.6 * charge).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = 'rgba(159, 230, 255, 0.9)';
      ctx.shadowBlur = 6 + 14 * charge;
      ctx.beginPath();
      ctx.roundRect(r.left, r.top, r.width, r.height, rr);
      ctx.stroke();
      const balaye = borner(t / (T.charge * 1.4), 0, 1);
      const bx = r.left + r.width * balaye;
      const bande = ctx.createLinearGradient(bx - 26, 0, bx + 26, 0);
      bande.addColorStop(0, 'rgba(255, 255, 255, 0)');
      bande.addColorStop(0.5, `rgba(255, 255, 255, ${(0.55 * (1 - balaye * 0.6)).toFixed(3)})`);
      bande.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(r.left, r.top, r.width, r.height, rr);
      ctx.clip();
      ctx.fillStyle = bande;
      ctx.fillRect(r.left, r.top, r.width, r.height);
      // 2. Les fissures gagnent le verre.
      const fissure = borner((t - 0.09 * k) / (T.fissure - 0.09 * k), 0, 1);
      if (fissure > 0) {
        for (const f of fissures) {
          const part = borner((fissure - f.delai * 0.5) / (1 - f.delai * 0.5), 0, 1);
          if (part <= 0) continue;
          const n = f.points.length - 1;
          const jusque = part * n;
          ctx.strokeStyle = `rgba(240, 250, 255, ${(0.95).toFixed(2)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(f.points[0].x, f.points[0].y);
          for (let i = 1; i <= Math.ceil(jusque); i++) {
            const a = f.points[i - 1];
            const b = f.points[i];
            const u = Math.min(1, jusque - (i - 1));
            ctx.lineTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
          }
          ctx.stroke();
        }
        // Le point d'impact brille.
        const eclat = ctx.createRadialGradient(impact.x, impact.y, 0, impact.x, impact.y, 14 + 10 * fissure);
        eclat.addColorStop(0, `rgba(255, 255, 255, ${(0.8 * fissure).toFixed(3)})`);
        eclat.addColorStop(1, 'rgba(159, 230, 255, 0)');
        ctx.fillStyle = eclat;
        ctx.fillRect(impact.x - 30, impact.y - 30, 60, 60);
      }
      ctx.restore();
      ctx.shadowBlur = 0;
    } else {
      // 3. Les éclats : ils s'écartent, tournent, viennent vers nous et s'éteignent.
      const vie = (t - T.fissure) / (T.fin - T.fissure);
      const visible = 1 - entree(borner(vie * 1.15, 0, 1));
      for (const f of fragments) {
        const dt = t - T.fissure;
        const x = f.x + f.vx * dt;
        const y = f.y + f.vy * dt;
        const ech = 1 + (f.profondeur - 1) * sortie(borner(vie, 0, 1));
        const rot = f.tour * dt;
        const cos = Math.cos(rot) * ech;
        const sin = Math.sin(rot) * ech;
        ctx.beginPath();
        f.forme.forEach((p, i) => {
          const sx = x + p.x * cos - p.y * sin;
          const sy = y + p.x * sin + p.y * cos;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fillStyle = `rgba(160, 200, 255, ${(0.2 * visible).toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(236, 246, 255, ${(0.85 * visible).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const finir = () => {
    sequence.kill();
    window.clearTimeout(garde);
    ctx.clearRect(0, 0, l, h);
    if (toile?.matches(':popover-open')) toile.hidePopover();
    source.classList.remove('est-charge', 'est-brise');
    groupe?.classList.remove('est-charge', 'est-brise');
    source.classList.add('est-reforme');
    window.setTimeout(() => source.classList.remove('est-reforme'), 600);
    enCours = false;
  };

  const sequence = gsap.timeline({ onComplete: finir });
  sequence.to(temps, { t: T.fin, duration: T.fin, ease: 'none', onUpdate: dessiner }, 0);
  sequence.call(
    () => {
      source.classList.add('est-brise');
      groupe?.classList.add('est-brise');
    },
    [],
    T.fissure,
  );
  // La carte s'ouvre sous la traversée ; la toile repasse au-dessus d'elle pour finir le voyage.
  sequence.call(() => ouvrirCarte(), [], T.ouvre);
  sequence.call(remonterToile, [], T.arrivee);
  // Garde-fou : si la séquence ne finissait pas (onglet en veille…), on remet tout en place.
  const garde = window.setTimeout(() => {
    if (!enCours) return;
    if (!document.querySelector('.explorateur[open]')) ouvrirCarte();
    couperEffets();
    finir();
  }, (T.fin / (gsap.globalTimeline.timeScale() || 1)) * 1000 + 1200);
}

/** Attend que le grand portail soit à l'écran (après la remontée), au plus « limite » millisecondes. */
function quandPortailVisible(fait: () => void, limite = 1600): void {
  const debut = performance.now();
  const guetter = () => {
    if (emprisePortail() || performance.now() - debut > limite) fait();
    else requestAnimationFrame(guetter);
  };
  requestAnimationFrame(guetter);
}

/**
 * Rejoint la carte du portail.
 * « source » : le bouton qui la demande (il se brise, s'il le faut) ; « point » : l'endroit cliqué ;
 * « grand » : on veut retrouver le grand portail de l'accueil (fin de l'accueil).
 */
export function ouvrirPortail(options: { source?: HTMLElement | null; point?: Point | null; grand?: boolean } = {}): void {
  const carte = document.querySelector<HTMLDialogElement>('.explorateur');
  // Sur une fiche (ou la page 404), la carte est sur l'accueil : on y va, et elle s'ouvrira à l'arrivée.
  if (!carte) {
    const accueil = document.querySelector<HTMLElement>('[data-outil="portail"]')?.dataset.accueil ?? '/';
    window.location.href = `${accueil}?portail`;
    return;
  }
  if (enCours || carte.open || html.classList.contains('intro') || html.classList.contains('carte-en-transition')) return;
  // Ce qui est ouvert par-dessus la page se range d'abord (menu du téléphone, panneaux).
  if (html.classList.contains('menu-ouvert')) document.querySelector<HTMLButtonElement>('.barre__menu')?.click();
  document.querySelectorAll<HTMLElement>('#acces:popover-open, #reglages:popover-open, #hub:popover-open').forEach((p) => p.hidePopover());
  document.querySelectorAll<HTMLDialogElement>('.recherche[open], .rapide[open], .raccourcis[open]').forEach((d) => d.close());

  const calme = mouvementReduit || reglages.animations === 0;
  const surAccueil = destinationActive() === 'accueil';

  // Le grand portail est à l'écran : c'est lui qui s'ouvre, comme toujours.
  if (surAccueil && emprisePortail()) {
    pulser(options.source);
    ouvrirCarte();
    return;
  }
  // « Rejoindre le portail » : on remonte jusqu'à lui, puis il s'ouvre, sans second clic.
  if (surAccueil && options.grand) {
    enCours = true;
    const ouvrir = () => {
      enCours = false;
      ouvrirCarte();
    };
    if (calme || !lenis) {
      allerA(0, true);
      quandPortailVisible(ouvrir, 400);
      return;
    }
    const distance = window.scrollY;
    lenis.scrollTo(0, {
      duration: borner(distance / 3200, 0.55, 1),
      easing: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
      onComplete: () => quandPortailVisible(ouvrir),
    });
    return;
  }
  if (calme || !options.source) {
    ouvrirCarte();
    return;
  }
  briserEtOuvrir(options.source, options.point ?? null);
}

/** Une simple impulsion sur le bouton, quand c'est le grand portail qui se brise. */
function pulser(source?: HTMLElement | null): void {
  if (!source) return;
  source.classList.add('est-impulsion');
  window.setTimeout(() => source.classList.remove('est-impulsion'), 500);
}

export function initPortail(): void {
  // Les boutons qui ouvrent le portail : celui de la barre (voir nav.ts) et ceux des fins de destination.
  document.addEventListener('click', (e) => {
    const bouton = (e.target as Element).closest<HTMLElement>('[data-portail-ouvrir]');
    if (!bouton) return;
    e.preventDefault();
    const point = e.detail > 0 ? { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY } : null;
    ouvrirPortail({ source: bouton, point, grand: bouton.dataset.portailOuvrir === 'grand' });
  });

  // La touche P : comme le bouton Portail de la barre. Pas pendant une saisie, une fenêtre ouverte, le jeu ou l'introduction.
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'p' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable], dialog, [popover], .terminal')) return;
    if (document.querySelector('dialog[open]') || document.querySelector('[popover]:popover-open') || html.classList.contains('intro')) return;
    const terminal = document.querySelector<HTMLElement>('.terminal');
    if (terminal && !terminal.hidden) return;
    e.preventDefault();
    ouvrirPortail({ source: document.querySelector<HTMLElement>('[data-outil="portail"]') });
  });

  // Arrivée depuis une fiche par le bouton Portail (« ?portail ») : la carte s'ouvre après l'entrée de page.
  const adresse = new URL(window.location.href);
  if (adresse.searchParams.has('portail') && document.querySelector('.explorateur')) {
    adresse.searchParams.delete('portail');
    history.replaceState(history.state, '', adresse.pathname + adresse.search + adresse.hash);
    const lancer = () => {
      if (html.classList.contains('intro')) return false;
      window.setTimeout(() => ouvrirPortail({ grand: true }), 250);
      return true;
    };
    if (!lancer()) {
      const guet = new MutationObserver(() => lancer() && guet.disconnect());
      guet.observe(html, { attributes: true, attributeFilter: ['class'] });
    }
  }
}
