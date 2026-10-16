// LE SAUT DANS LE TEMPS : entre l'accueil et Contact, les deux bouts du site.
// (C'est voyage.ts qui décide de le lancer ; tous les autres changements de
// section gardent le fondu court.)
//
// Deux sens, en miroir l'un de l'autre. Chacun dure un peu plus d'une seconde.
//
// « retour », de Contact à l'accueil :
//   0 ms    Activation     une impulsion de lumière part du centre ; le décor
//                          s'assombrit ; les lignes de Contact (ses filets, le bord
//                          de son panneau) se courbent et convergent vers ce centre
//   60      Fragmentation  des éclats de verre bleus et blancs se détachent, tournent,
//                          puis sont aspirés vers le centre avec une poussière de
//                          particules ; un anneau s'y ouvre
//   300     Traversée      le tunnel de lumière défile à rebours : la caméra recule
//   600                    à l'abri du tunnel, la page saute à l'accueil
//   600     Révélation     le tunnel se dissipe ; le paysage réapparaît ; le portail
//                          se redessine (contour, puis verre) pendant que la caméra
//                          finit de reculer ; une onde court sur les dunes
//   1150                   fin : tout est remis exactement en place
//
// « aller », de l'accueil à Contact :
//   0 ms    Activation     le portail s'illumine, la caméra plonge vers lui ; les
//                          lignes du texte de l'accueil convergent vers le portail
//   60      Fragmentation  les mêmes éclats, aspirés dans le portail
//   300     Traversée      le tunnel défile vers l'avant : la caméra avance
//   600                    la page saute à Contact
//   600     Révélation     le film repasse à l'envers : les éclats jaillissent du
//                          centre et regagnent leur place, les lignes de Contact se
//                          déploient, le panneau apparaît
//   1150                   fin
//
// Rien de la page n'est cassé pour de vrai : les éclats, les lignes et les
// particules sont dessinés sur une toile posée par-dessus (.retour). La
// traversée réutilise le tunnel du site (gl/tunnel.ts).
// La séquence peut être annulée à tout instant (autre destination demandée) ;
// et si elle ne se terminait pas d'elle-même, un garde-fou conduit quand même
// le visiteur à destination.

import gsap from 'gsap';
import { reglages } from './reglages';
import { emprisePortail, etat, onde } from './gl/champ';
import { fermerTunnel, ouvrirTunnel, tunnel } from './gl/tunnel';

export type Sens = 'aller' | 'retour';

const AVANT = 0.6; //  secondes avant le saut : activation, fragmentation, ouverture du passage
const APRES = 0.55; // secondes après le saut : fin de la traversée, révélation
/** La durée totale d'un saut, en secondes. */
export const DUREE_SAUT = AVANT + APRES;
/** Petit regain de vitesse en Chill, sans accélérer le reste du site. */
export const allureSaut = () => reglages.atmosphere === 'chill' ? 1.1 : 1;

interface Eclat {
  x: number;
  y: number;
  points: [number, number][]; // sa forme, autour de son centre
  angle: number; //             sa rotation de départ
  tour: number; //              ce qu'il tourne pendant l'aspiration
  delai: number; //             quand il se détache (0 à 1, sur la durée d'avant le saut)
  duree: number;
  ecart: number; //             le petit pas de côté qu'il fait en se détachant
  sens: number; //              la direction de ce pas
}

interface Decor {
  l: number;
  h: number;
  cx: number;
  cy: number;
  lignes: { x1: number; x2: number; y: number }[];
  eclats: Eclat[];
  poussieres: { x: number; y: number; delai: number; taille: number }[];
}

const borne = (v: number) => Math.min(1, Math.max(0, v));
const accelere = (t: number) => t * t * t;
const ralentit = (t: number) => 1 - (1 - t) ** 3;
const entre = (min: number, max: number) => min + Math.random() * (max - min);

let toile: HTMLCanvasElement | null = null;

/** La toile des éclats : créée au premier saut, à la taille de l'écran. */
function preparerToile(): CanvasRenderingContext2D | null {
  if (!toile) {
    toile = document.createElement('canvas');
    toile.className = 'retour';
    toile.setAttribute('aria-hidden', 'true');
    document.body.append(toile);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  toile.width = Math.round(window.innerWidth * dpr);
  toile.height = Math.round(window.innerHeight * dpr);
  const ctx = toile.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Relève ce qui est à l'écran et prépare les éclats.
 * « lieu » : la section qu'on regarde, dont on prend les lignes.
 */
function composer(lieu: 'accueil' | 'contact'): Decor {
  const l = window.innerWidth;
  const h = window.innerHeight;
  // Le centre de la séquence : le portail s'il est à l'écran, sinon l'endroit où il se tient sur l'accueil.
  const portail = emprisePortail();
  const cx = portail ? portail.x + portail.l / 2 : l / 2;
  const cy = portail ? portail.y + portail.h / 2 : h * (l < 861 ? 0.36 : 0.45);

  const lignes: Decor['lignes'] = [];
  const relever = (selecteur: string, bas = false) =>
    document.querySelectorAll<HTMLElement>(selecteur).forEach((bloc) => {
      const cadre = bloc.getBoundingClientRect();
      if (cadre.bottom > 0 && cadre.top < h && cadre.width > 40 && lignes.length < 12) lignes.push({ x1: cadre.left, x2: cadre.right, y: bas ? cadre.bottom : cadre.top });
    });
  if (lieu === 'contact') {
    // Les lignes de Contact : le haut de chaque bloc séparé par un filet, et le bord du panneau.
    relever('#contact :is(.contact__liste li, .contact__canal, .contact__dispo)');
    const panneau = document.getElementById('contact')?.getBoundingClientRect();
    if (panneau) {
      lignes.push({ x1: panneau.left, x2: panneau.right, y: Math.max(panneau.top, 2) });
      lignes.push({ x1: panneau.left, x2: panneau.right, y: Math.min(panneau.bottom, h - 2) });
    }
  } else {
    // Les lignes de l'accueil : la ligne de base de chaque ligne de texte, et le bord du cadre.
    relever('.hero__surtitre, .hero__titre .ligne, .hero__accroche, .hero__actions', true);
    const cadre = document.querySelector('.hero__cadre')?.getBoundingClientRect();
    if (cadre && cadre.bottom > 0) {
      lignes.push({ x1: cadre.left, x2: cadre.right, y: Math.max(cadre.top, 2) });
      lignes.push({ x1: cadre.left, x2: cadre.right, y: Math.min(cadre.bottom, h - 2) });
    }
  }

  // Les éclats : semés sur une grille irrégulière, plus nombreux sur grand écran.
  const colonnes = l < 861 ? 5 : 9;
  const rangs = l < 861 ? 6 : 5;
  const eclats: Eclat[] = [];
  for (let i = 0; i < colonnes; i++) {
    for (let j = 0; j < rangs; j++) {
      const taille = entre(16, l < 861 ? 44 : 68);
      const cotes = Math.random() < 0.6 ? 3 : 4;
      // Une forme anguleuse : des sommets répartis autour du centre, à des distances inégales.
      const points = Array.from({ length: cotes }, (_, k): [number, number] => {
        const a = (k / cotes) * Math.PI * 2 + entre(-0.4, 0.4);
        const r = taille * entre(0.45, 1);
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
      eclats.push({
        x: ((i + entre(0.15, 0.85)) / colonnes) * l,
        y: ((j + entre(0.15, 0.85)) / rangs) * h,
        points,
        angle: entre(0, Math.PI * 2),
        tour: entre(-2.6, 2.6),
        delai: entre(0.08, 0.34),
        duree: entre(0.5, 0.66),
        ecart: entre(4, 14),
        sens: entre(0, Math.PI * 2),
      });
    }
  }
  const poussieres = Array.from({ length: l < 861 ? 46 : 96 }, () => ({ x: entre(0, l), y: entre(0, h), delai: entre(0.05, 0.5), taille: entre(0.8, 2.1) }));
  return { l, h, cx, cy, lignes, eclats, poussieres };
}

/**
 * Dessine une image de la séquence. « t » va de 0 (rien n'a bougé) à 1 (tout a
 * été aspiré, le passage est ouvert). Pour la révélation de Contact, on rejoue
 * les mêmes images à l'envers (« aLEnvers ») : sans l'impulsion du départ.
 */
function dessiner(ctx: CanvasRenderingContext2D, t: number, d: Decor, aLEnvers = false): void {
  const { l, h, cx, cy } = d;
  const rayon = Math.hypot(l, h) / 2;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, l, h);

  // Le décor s'assombrit : ce qui est lumineux s'en détache mieux.
  ctx.fillStyle = `rgba(4, 7, 14, ${(0.9 * ralentit(borne(t / 0.8))).toFixed(3)})`;
  ctx.fillRect(0, 0, l, h);
  ctx.globalCompositeOperation = 'lighter'; // (les lumières s'additionnent)

  // 1. L'impulsion : un halo qui part du centre et s'élargit en s'éteignant.
  const impulsion = aLEnvers ? 0 : 1 - borne(t / 0.42);
  if (impulsion > 0) {
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, rayon * (0.1 + 0.95 * ralentit(borne(t / 0.42))));
    halo.addColorStop(0, `rgba(214, 230, 255, ${(0.55 * impulsion).toFixed(3)})`);
    halo.addColorStop(0.5, `rgba(120, 165, 255, ${(0.18 * impulsion).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(120, 165, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, l, h);
  }

  // 2. Les lignes convergent. Leur milieu est attiré plus vite que leurs
  //    bouts : elles se courbent vers le centre avant de s'y engouffrer.
  const attire = accelere(borne(t / 0.74));
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = `rgba(206, 227, 255, ${(0.22 + 0.7 * Math.sin(Math.PI * borne(t / 0.74))).toFixed(3)})`;
  if (t > 0.005) {
    for (const ligne of d.lignes) {
      const y = ligne.y + (cy - ligne.y) * attire;
      const x1 = ligne.x1 + (cx - ligne.x1) * attire;
      const x2 = ligne.x2 + (cx - ligne.x2) * attire;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.quadraticCurveTo((x1 + x2) / 2, ligne.y + (cy - ligne.y) * Math.min(1, attire * 2.4 + t * 0.5), x2, y);
      ctx.stroke();
    }
  }

  // 3. Les éclats de verre : ils se détachent (un petit pas de côté), puis sont aspirés en tournant.
  ctx.lineWidth = 1;
  for (const e of d.eclats) {
    const vie = borne((t - e.delai) / e.duree);
    if (vie <= 0) continue;
    const apparu = borne(vie / 0.2);
    const aspire = accelere(borne((vie - 0.14) / 0.86));
    const x = e.x + (cx - e.x) * aspire + Math.cos(e.sens) * e.ecart * apparu * (1 - aspire);
    const y = e.y + (cy - e.y) * aspire + Math.sin(e.sens) * e.ecart * apparu * (1 - aspire);
    const echelle = 1 - 0.9 * aspire;
    const cosinus = Math.cos(e.angle + e.tour * aspire) * echelle;
    const sinus = Math.sin(e.angle + e.tour * aspire) * echelle;
    const visible = apparu * (1 - aspire * aspire);
    ctx.beginPath();
    e.points.forEach(([px, py], k) => {
      const sx = x + px * cosinus - py * sinus;
      const sy = y + px * sinus + py * cosinus;
      if (k === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = `rgba(150, 190, 255, ${(0.17 * visible).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(236, 244, 255, ${(0.8 * visible).toFixed(3)})`;
    ctx.stroke();
    // Sa traînée, quand il file vers le centre.
    if (aspire > 0.2) {
      const avant = accelere(borne((vie - 0.2) / 0.86));
      ctx.strokeStyle = `rgba(170, 205, 255, ${(0.34 * visible).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(e.x + (cx - e.x) * avant, e.y + (cy - e.y) * avant);
      ctx.stroke();
    }
  }

  // Les particules : la même aspiration, en plus fin.
  for (const p of d.poussieres) {
    const vie = borne((t - p.delai) / 0.5);
    if (vie <= 0) continue;
    const aspire = accelere(vie);
    const x = p.x + (cx - p.x) * aspire;
    const y = p.y + (cy - p.y) * aspire;
    const recul = accelere(Math.max(0, vie - 0.12));
    ctx.strokeStyle = `rgba(226, 238, 255, ${(0.7 * Math.sin(Math.PI * vie)).toFixed(3)})`;
    ctx.lineWidth = p.taille;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(p.x + (cx - p.x) * recul, p.y + (cy - p.y) * recul);
    ctx.stroke();
  }

  // 4. Le passage s'ouvre au centre : un anneau qui grandit, et sa lueur.
  const ouverture = borne((t - 0.4) / 0.6);
  if (ouverture > 0) {
    const r = rayon * (0.015 + 0.34 * accelere(ouverture));
    const lueur = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.9);
    lueur.addColorStop(0, `rgba(226, 238, 255, ${(0.7 * ouverture).toFixed(3)})`);
    lueur.addColorStop(0.55, `rgba(120, 165, 255, ${(0.28 * ouverture).toFixed(3)})`);
    lueur.addColorStop(1, 'rgba(120, 165, 255, 0)');
    ctx.fillStyle = lueur;
    ctx.fillRect(0, 0, l, h);
    ctx.strokeStyle = `rgba(240, 247, 255, ${(0.9 * ouverture).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Joue un saut dans le temps.
 * « surSaut » est appelé au milieu, à l'abri du tunnel : c'est le moment de placer la page à destination.
 * « surFin » est appelé quand tout est terminé et remis en place.
 * Renvoie la fonction qui annule la séquence (elle nettoie tout, sans appeler surFin).
 */
export function jouerSaut(sens: Sens, surSaut: () => void, surFin: () => void): () => void {
  const html = document.documentElement;
  const contenu = document.querySelector<HTMLElement>('main');
  const ctx = preparerToile();
  const depart = composer(sens === 'retour' ? 'contact' : 'accueil');
  let arrivee: Decor | null = null; // (aller) ce qu'on relève à Contact, une fois la page placée
  fermerTunnel();
  const avecTunnel = ouvrirTunnel();
  const classe = sens === 'retour' ? 'en-retour' : 'en-aller';
  let saute = false;
  let termine = false;

  html.classList.add(classe);
  if (toile) toile.style.display = 'block';
  Object.assign(tunnel, { force: 0, vitesse: 0.25, saut: 1 });

  const effacerToile = () => {
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, depart.l, depart.h);
  };

  /** Tout remettre exactement en place, que la séquence soit finie ou annulée. */
  const nettoyer = () => {
    if (termine) return;
    termine = true;
    window.clearTimeout(garde);
    sequence.kill();
    fermerTunnel();
    effacerToile();
    if (toile) toile.style.display = '';
    html.classList.remove(classe, 'saut-arrive');
    gsap.set(contenu, { clearProps: 'opacity' });
    Object.assign(etat, { construit: 1, zoom: 0, energie: 0, eclat: 0 });
  };

  const sauter = () => {
    if (saute) return;
    saute = true;
    surSaut();
    effacerToile();
    if (sens === 'retour') {
      // L'accueil est maintenant sous le tunnel : son portail attend d'être redessiné, caméra encore proche.
      Object.assign(etat, { construit: 0, zoom: 0.5, energie: 1 });
    } else {
      // Contact est sous le tunnel : la scène de l'accueil, hors de vue, retrouve son état normal.
      Object.assign(etat, { zoom: 0, energie: 0 });
      arrivee = composer('contact');
      html.classList.add('saut-arrive');
    }
  };

  const avance = { t: 0 };
  const allure = allureSaut();
  const sequence = gsap.timeline({
    onComplete: () => {
      nettoyer();
      surFin();
    },
  });

  // ---- Avant le saut : activation, fragmentation, ouverture du passage ----
  sequence.timeScale(allure);
  if (ctx) sequence.to(avance, { t: 1, duration: AVANT, ease: 'none', onUpdate: () => !saute && dessiner(ctx, avance.t, depart) }, 0);
  sequence.to(contenu, { opacity: 0, duration: AVANT * 0.6, ease: 'power1.in' }, AVANT * 0.3);
  // (aller) Le portail s'illumine et la caméra plonge vers lui.
  if (sens === 'aller') sequence.to(etat, { zoom: 0.85, energie: 1, duration: AVANT, ease: 'power2.in' }, 0);
  if (avecTunnel) {
    sequence.to(tunnel, { force: 1, duration: AVANT * 0.5, ease: 'power2.in' }, AVANT * 0.5);
    sequence.to(tunnel, { vitesse: 1, duration: AVANT * 0.6, ease: 'power2.in' }, AVANT * 0.4);
    // (La distance augmente à l'aller : la caméra avance. Elle diminue au retour : la caméra recule.)
    sequence.to(tunnel, { distance: sens === 'retour' ? '-=3.6' : '+=3.6', duration: AVANT * 0.5 + APRES, ease: 'power2.inOut' }, AVANT * 0.5);
  }
  sequence.call(sauter, [], AVANT);

  // ---- Après le saut : le passage se dissipe, la destination se révèle ----
  if (avecTunnel) sequence.to(tunnel, { force: 0, vitesse: 0, saut: 0, duration: APRES * 0.85, ease: 'power2.out' }, AVANT + 0.04);
  sequence.to(contenu, { opacity: 1, duration: APRES * 0.75, ease: 'power1.out' }, AVANT + 0.06);
  if (sens === 'retour') {
    sequence.to(etat, { construit: 1, duration: APRES * 0.9, ease: 'power2.out' }, AVANT + 0.04); // le portail se redessine
    sequence.to(etat, { zoom: 0, duration: APRES, ease: 'expo.out' }, AVANT); //                     la caméra finit de reculer
    sequence.to(etat, { energie: 0, duration: APRES * 0.7, ease: 'power2.in' }, AVANT + APRES * 0.3);
    // (immediateRender: false : sans cela, GSAP poserait l'éclair dès la création de la séquence.)
    sequence.fromTo(etat, { eclat: 0.45 }, { eclat: 0, duration: APRES * 0.8, ease: 'power2.out', immediateRender: false }, AVANT);
    sequence.call(() => onde(), [], AVANT + 0.08);
  } else if (ctx) {
    // Le film repasse à l'envers sur Contact : les éclats jaillissent du centre et regagnent leur place.
    sequence.fromTo(avance, { t: 1 }, { t: 0, duration: APRES, ease: 'power1.out', immediateRender: false, onUpdate: () => arrivee && dessiner(ctx, avance.t, arrivee, true) }, AVANT + 0.02);
  }

  // Garde-fou : si la séquence ne s'est pas terminée d'elle-même (onglet mis en
  // veille, erreur de dessin…), on conduit quand même le visiteur à destination.
  const garde = window.setTimeout(
    () => {
      if (termine) return;
      sauter();
      nettoyer();
      surFin();
    },
    (DUREE_SAUT / (gsap.globalTimeline.timeScale() || 1)) * 1000 + 1500,
  );

  return nettoyer;
}
