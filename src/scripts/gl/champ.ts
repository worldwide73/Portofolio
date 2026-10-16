// LA SCÈNE : le paysage animé du hero et sa lame de verre, en WebGL.
// Bibliothèque : OGL, une couche très fine au-dessus de WebGL.
//
// Ce fichier fait trois choses :
//   1. il crée la scène (un fond plein cadre + un parallélépipède de verre) ;
//   2. il envoie aux shaders, à chaque image, les valeurs qui changent
//      (temps, position de la souris, clic…) : ce sont les « uniforms » ;
//   3. il se replie proprement si WebGL 2 n'est pas disponible.
//
// La façon dont la photographie est rendue vivante est décrite dans communs.glsl.

import gsap from 'gsap';
import { Box, Camera, Mesh, Program, Renderer, Texture, Transform, Triangle } from 'ogl';
import { vitesse } from '../defilement';
import { ambiance } from '../ambiances';
import { reglages } from '../reglages';
import { apresPause, aUneSouris, borner, interpoler, mouvementReduit } from '../outils';
import communs from './communs.glsl?raw';
import fondFrag from './fond.frag.glsl?raw';
import verreFrag from './verre.frag.glsl?raw';
import verreVert from './verre.vert.glsl?raw';

const ENTETE = '#version 300 es\nprecision highp float;\n';
const FOND_VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const CHAMP_VISION = (35 * Math.PI) / 180; // angle de la caméra
const DISTANCE = 5;                        // distance caméra → lame
const HAUTEUR_VISIBLE = 2 * Math.tan(CHAMP_VISION / 2) * DISTANCE;
const ETROIT = 861;                        // en dessous de cette largeur : mise en scène téléphone
const LAMPE_FANTOME = 0.7;                 // la lampe est un peu plus douce quand personne ne la tient

/**
 * L'état de la scène. Les animations (GSAP) modifient ces nombres ;
 * la boucle de rendu les lit à chaque image. Rien d'autre ne relie les deux.
 */
export const etat = {
  sourisX: 0.5,     // cible du curseur, de 0 à 1 depuis le coin haut-gauche du cadre
  sourisY: 0.5,
  lampe: 0,         // intensité de la lampe du curseur
  reveal: 0,        // 0 → 1 : la scène sort du noir, le jour se lève
  verreIntro: 0,    // opacité de la lame pendant l'entrée
  tourIntro: -1.15, // rotation de la lame pendant l'entrée (radians)
  tourClic: 0,      // rotation ajoutée par les clics : un demi-tour à chaque fois
  jour: 0,          // 0 = nuit (le site n'a plus qu'un thème, sombre : reste à 0)
  // ---- Le portail (voir explorateur.ts) ----
  zoom: 0,          // 0 → 1 : la caméra plonge vers la lame, qui finit par remplir l'écran
  energie: 0,       // 0 → 1 : contours et reflets s'intensifient (survol, charge, traversée)
  fissure: 0,       // 0 → 1 : les fissures gagnent la surface du verre (au clic)
  eclat: 0,         // 1 → 0 : l'éclair de la rupture
  construit: 1,     // 0 → 1 : le portail se dessine (contour, puis verre) pendant l'introduction
  scan: 0,          // 0 → 1 : le scanner du survol descend le long du verre et révèle les destinations
  brise: 0,         // 1 : le cube a volé en éclats (la carte du portail est ouverte), on ne le dessine plus
};

// Une onde sur le paysage, déclenchée par un autre module (l'introduction).
// La vraie fonction est posée par initChamp, quand la scène existe.
let envoyerOnde: ((x: number, y: number) => void) | null = null;
/** Lance une onde depuis un point du cadre (0 à 1 depuis le coin haut-gauche). Par défaut : le portail. */
export function onde(x = 0.5, y = 0.5): void {
  envoyerOnde?.(x, y);
}

// La place du portail à l'écran. La vraie fonction est posée par initChamp.
let mesurerPortail: (() => { x: number; y: number; l: number; h: number } | null) | null = null;
/** L'emprise du portail à l'écran, en pixels (coin haut-gauche, largeur, hauteur). null s'il n'est pas visible. */
export function emprisePortail(): { x: number; y: number; l: number; h: number } | null {
  return mesurerPortail?.() ?? null;
}

// Le point d'impact des fissures. La vraie fonction est posée par initChamp.
let poserImpact: ((x: number, y: number) => void) | null = null;
/** Place le point d'où partent les fissures (coordonnées de l'écran, en pixels). */
export function impacter(x: number, y: number): void {
  poserImpact?.(x, y);
}

let dernierClic: { x: number; y: number } | null = null;
/** L'endroit du dernier clic sur le portail (coordonnées de l'écran). On ne peut le lire qu'une fois. */
export function clicPortail(): { x: number; y: number } | null {
  const clic = dernierClic;
  dernierClic = null;
  return clic;
}

function replier(): false {
  document.documentElement.classList.add('sans-gl');
  return false;
}

/** Démarre la scène. Renvoie false s'il n'y a pas de scène sur la page ou pas de WebGL 2. */
export function initChamp(): boolean {
  const toile = document.querySelector<HTMLCanvasElement>('#champ');
  if (!toile) return false;

  let renderer: Renderer;
  try {
    renderer = new Renderer({
      canvas: toile,
      dpr: Math.min(window.devicePixelRatio || 1, aUneSouris ? 2 : 1.5),
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return replier();
  }
  const gl = renderer.gl;
  if (!gl || !renderer.isWebgl2) return replier();

  // ---- La photographie du paysage, envoyée à la carte graphique ----
  // Les « mipmaps » sont des copies de plus en plus petites de l'image : elles
  // permettent au shader de la lire adoucie (à travers le verre, par exemple).
  const photo = new Texture(gl, {
    generateMipmaps: true,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  });

  // ---- Les uniforms, partagés par les deux shaders ----
  const u = {
    uRes: { value: [1, 1] },
    uTemps: { value: 0 },
    uSouris: { value: [0.5, 0.5] },
    uLampe: { value: 0 },
    uReveal: { value: 0 },
    uJour: { value: 0 },
    uZoom: { value: 0 },
    uEnergie: { value: 0 },
    uFissure: { value: 0 },
    uEclat: { value: 0 },
    uImpact: { value: [0.5, 0.5] },
    uConstruit: { value: 1 },
    uAgitation: { value: 0 },
    uScan: { value: 0 },
    uAmbiance: { value: [1, 0, 0] },
    uSortie: { value: 0 },
    uOnde: { value: [0.5, 0.5, 99] },
    uVerre: { value: [0.5, 0.5, 0] },
    uHorizon: { value: 0.5 },
    uScene: { value: photo },
    uSceneRes: { value: [16, 9] },
    uSceneOn: { value: 0 },
  };
  const uOpacite = { value: 0 };

  // ---- La scène ----
  const camera = new Camera(gl, { fov: 35, near: 0.1, far: 50 });
  camera.position.z = DISTANCE;
  const scene = new Transform();

  const fond = new Mesh(gl, {
    geometry: new Triangle(gl), // un seul grand triangle qui couvre tout le cadre
    program: new Program(gl, {
      vertex: FOND_VERT,
      fragment: ENTETE + communs + fondFrag,
      uniforms: u,
      depthTest: false,
      depthWrite: false,
    }),
  });
  fond.frustumCulled = false;
  fond.renderOrder = 0;
  fond.setParent(scene);

  const verre = new Mesh(gl, {
    geometry: new Box(gl, { width: 1.15, height: 1.9, depth: 0.16 }),
    program: new Program(gl, {
      vertex: verreVert,
      fragment: ENTETE + communs + verreFrag,
      uniforms: { ...u, uOpacite },
      transparent: true,
    }),
  });
  verre.renderOrder = 1;
  verre.setParent(scene);

  // Le panneau qui glisse par-dessus la scène quand on défile.
  const hero = toile.closest<HTMLElement>('.hero');
  const suivante = (hero?.nextElementSibling as HTMLElement | null) ?? null;
  const texteHero = hero?.querySelector<HTMLElement>('.hero__bas') ?? null;
  let sortieAffichee = -1;
  let elevation = 0; // l'élévation du texte du hero sous le panneau (px)

  // ---- Chargement de la photographie ----
  // Deux cadrages : un large pour les écrans d'ordinateur, un vertical pour
  // les téléphones. « horizon » dit où se trouve la ligne d'horizon dans l'image.
  const cadrages = {
    paysage: { adresse: toile.dataset.scene ?? '', horizon: 0.5 },
    portrait: { adresse: toile.dataset.scenePortrait ?? '', horizon: 0.56 },
  };
  let cadrageCharge = '';
  const chargerPhoto = (nom: 'paysage' | 'portrait') => {
    const cadrage = cadrages[nom];
    if (!cadrage.adresse || nom === cadrageCharge) return;
    cadrageCharge = nom;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cadrageCharge !== nom) return; // un autre cadrage a été demandé entre-temps
      photo.image = img;
      photo.needsUpdate = true;
      u.uSceneRes.value[0] = img.naturalWidth;
      u.uSceneRes.value[1] = img.naturalHeight;
      u.uHorizon.value = cadrage.horizon;
      u.uSceneOn.value = 1;
      toile.dispatchEvent(new Event('scene-prete'));
    };
    img.src = cadrage.adresse;
  };

  // ---- Taille ----
  let largeur = 0;
  let hauteur = 0;
  const dimensionner = () => {
    toile.style.width = '';
    toile.style.height = '';
    const l = toile.clientWidth;
    const h = toile.clientHeight;
    if (!l || !h || (l === largeur && h === hauteur)) return;
    largeur = l;
    hauteur = h;
    renderer.setSize(l, h);
    camera.perspective({ aspect: l / h });
    u.uRes.value[0] = gl.canvas.width;
    u.uRes.value[1] = gl.canvas.height;
    chargerPhoto(l / h < 0.85 ? 'portrait' : 'paysage');
  };
  dimensionner();
  window.addEventListener('resize', apresPause(dimensionner, 120));

  // ---- Qui tient la lampe ? ----
  // 0 : personne. Un « curseur fantôme » se promène alors lentement sur les
  // dunes, pour que la scène vive sans souris (téléphone, tablette, ou souris
  // sortie de la fenêtre). 1 : le visiteur, avec sa souris ou son doigt.
  const pilote = { prise: 0 };

  // Centre et demi-dimensions du portail, en fractions du cadre (mis à jour à chaque image).
  const portail = { x: 0.5, y: 0.43, demiL: 0.1, demiH: 0.25 };
  envoyerOnde = (x, y) => {
    u.uOnde.value = [x, 1 - (y === 0.5 ? portail.y : y), 0];
  };
  const surPortail = (p: { x: number; y: number }) =>
    Math.abs(p.x - portail.x) < portail.demiL * 1.08 && Math.abs(p.y - portail.y) < portail.demiH * 1.05;
  mesurerPortail = () => {
    const r = toile.getBoundingClientRect();
    // Hors de l'écran, ou déjà recouvert par le panneau suivant : pas d'emprise utile.
    if (r.bottom <= 0 || r.top >= window.innerHeight || sortieAffichee > 0.6) return null;
    return {
      x: r.left + (portail.x - portail.demiL) * r.width,
      y: r.top + (portail.y - portail.demiH) * r.height,
      l: portail.demiL * 2 * r.width,
      h: portail.demiH * 2 * r.height,
    };
  };
  poserImpact = (x, y) => {
    const r = toile.getBoundingClientRect();
    const px = (x - r.left) / r.width;
    const py = (y - r.top) / r.height;
    u.uImpact.value = [borner(0.5 + (px - portail.x) / (portail.demiL * 2), 0, 1), borner(0.5 - (py - portail.y) / (portail.demiH * 2), 0, 1)];
  };

  // ---- Une image ----
  let sx = 0.5;
  let sy = 0.5;
  let elan = 0; // vitesse du défilement, lissée, de −1 à 1
  let avantX = 0.5; // position du curseur à l'image précédente
  let avantY = 0.5;
  let agitation = 0; // vitesse du curseur, lissée, de 0 à 1 : elle fêle le décor sous lui
  let horloge = 0; // l'horloge de la scène : elle ralentit avec certaines ambiances (voir ambiances.ts)
  const jeu = document.querySelector<HTMLDialogElement>('.rush');
  let horsChamp = false;
  const image = (brut: number, delta = 16.7) => {
    horloge += (Math.min(delta, 100) / 1000) * ambiance.vitesse;
    const temps = mouvementReduit ? brut : horloge;
    // Sortie de l'écran : on ne dessine plus rien, pour ne pas faire travailler
    // la carte graphique pour une scène que personne ne voit.
    if (hero && hero.getBoundingClientRect().bottom <= 0) {
      horsChamp = true;
      return;
    }
    // Pendant le jeu (Portal Rush, en plein écran), la carte graphique est à lui ; pendant la
    // visite rapide, la scène est cachée derrière elle.
    if (jeu?.open || document.documentElement.classList.contains('visite-rapide')) {
      horsChamp = true;
      return;
    }
    // De retour à l'écran (retour à l'accueil, fin de partie) : la bascule due au défilement repart de zéro,
    // sinon la lame pouvait rester penchée vers le sol avec une vitesse figée pendant son absence.
    if (horsChamp) {
      horsChamp = false;
      elan = 0;
      // Le pointeur a pu bouger plusieurs écrans plus bas pendant la pause.
      // Repartir au centre, sans conserver cette ancienne visée hors cadre.
      sx = sy = avantX = avantY = 0.5;
      etat.sourisX = etat.sourisY = 0.5;
    }
    // Quelle part de la scène est recouverte par le panneau suivant ?
    const sortie = suivante ? borner(1 - suivante.getBoundingClientRect().top / window.innerHeight, 0, 1) : 0;
    // Le texte du hero s'efface en douceur sous le panneau de verre qui monte : un dégradé suit
    // le bord du panneau (au-dessus, le texte est net ; dessous, il devient presque transparent),
    // et à mesure qu'il est recouvert, il se trouble un peu et s'élève légèrement.
    if (texteHero && suivante && Math.abs(sortie - sortieAffichee) > 0.002) {
      sortieAffichee = sortie;
      const bord = suivante.getBoundingClientRect().top;
      // (La position mesurée inclut la petite élévation déjà appliquée : on la retire.)
      const r = texteHero.getBoundingClientRect();
      const texte = { top: r.top + elevation, bottom: r.bottom + elevation, height: r.height };
      const y = bord - texte.top; // où le panneau commence, dans le bloc de texte (px)
      const couvert = borner((texte.bottom - bord) / texte.height, 0, 1);
      elevation = couvert > 0.01 ? couvert * 14 : 0;
      const masque = y < texte.height + 90 ? `linear-gradient(to bottom, #000 ${(y - 80).toFixed(0)}px, rgba(0, 0, 0, 0.14) ${(y + 6).toFixed(0)}px, transparent ${(y + 110).toFixed(0)}px)` : '';
      texteHero.style.maskImage = masque;
      texteHero.style.webkitMaskImage = masque;
      texteHero.style.filter = couvert > 0.01 ? `blur(${(couvert * 2.4).toFixed(2)}px)` : '';
      texteHero.style.translate = elevation ? `0 ${(-elevation).toFixed(1)}px` : '';
      texteHero.style.opacity = borner(1 - sortie * 1.2, 0, 1).toFixed(3);
    }

    const aspect = largeur / hauteur;
    const etroit = largeur < ETROIT;

    // Le curseur fantôme suit une courbe lente et jamais tout à fait répétée
    // (deux sinus de périodes différentes), au-dessus du sable et du texte.
    const fantomeX = 0.5 + 0.3 * Math.sin(temps * 0.19) + 0.07 * Math.sin(temps * 0.47 + 1.7);
    const fantomeY = (etroit ? 0.53 : 0.6) + (etroit ? 0.05 : 0.08) * Math.sin(temps * 0.27 + 0.8);
    const cibleX = interpoler(fantomeX, etat.sourisX, pilote.prise);
    const cibleY = interpoler(fantomeY, etat.sourisY, pilote.prise);

    // Le curseur lissé rattrape sa cible de 6 % à chaque image : c'est l'inertie.
    sx += (cibleX - sx) * 0.06;
    sy += (cibleY - sy) * 0.06;
    elan += (borner(vitesse() / 45, -1, 1) - elan) * 0.08;

    // L'agitation monte vite quand le curseur file, et retombe lentement à l'arrêt.
    // Elle ne vaut que pour un vrai pointeur (pas le fantôme), animations complètes.
    const trajet = Math.hypot(etat.sourisX - avantX, etat.sourisY - avantY);
    avantX = etat.sourisX;
    avantY = etat.sourisY;
    const visee = reglages.animations === 1 ? borner(trajet * 30 - 0.05, 0, 1) * pilote.prise * ambiance.eclats : 0;
    agitation += (visee - agitation) * (visee > agitation ? 0.25 : 0.03);
    u.uAgitation.value = agitation;

    u.uTemps.value = temps;
    u.uSouris.value[0] = sx;
    u.uSouris.value[1] = 1 - sy;
    u.uLampe.value = etat.lampe * interpoler(LAMPE_FANTOME, 1, pilote.prise) * ambiance.lampe;
    u.uReveal.value = etat.reveal;
    u.uJour.value = etat.jour;
    u.uSortie.value = sortie;
    u.uOnde.value[2] += delta / 1000;

    // La lame : elle flotte, se tourne vers le curseur et s'en approche un peu.
    // Au défilement, elle bascule avec la vitesse, puis s'élève et se détourne
    // à mesure que le panneau suivant la recouvre.
    const fx = 0.5 + (sx - 0.5) * 0.035;
    const fy = (etroit ? 0.33 : 0.43) + (sy - 0.5) * 0.025 - sortie * 0.07;
    const flottement = Math.sin(temps * 0.55) * 0.012;
    uOpacite.value = etat.verreIntro;
    verre.visible = etat.verreIntro > 0.003 && etat.brise < 0.5;
    verre.position.x = (fx - 0.5) * HAUTEUR_VISIBLE * aspect;
    verre.position.y = (0.5 - fy + flottement) * HAUTEUR_VISIBLE;
    // Le plongeon : la lame grossit jusqu'à remplir l'écran et se présente de face.
    const plongee = etat.zoom * etat.zoom;
    const face = 1 - plongee;
    const echelle = borner(aspect * 0.6, 0.46, 0.9);
    verre.scale.set(echelle * (1 + plongee * 7));
    verre.position.x *= face;
    verre.position.y *= face;
    // Sous la charge, le portail tremble : un petit décalage tiré au hasard à chaque image.
    const tremble = etat.fissure * etat.fissure * 0.012 * ambiance.eclats;
    verre.position.x += (Math.random() - 0.5) * tremble * HAUTEUR_VISIBLE;
    verre.position.y += (Math.random() - 0.5) * tremble * HAUTEUR_VISIBLE;
    verre.rotation.y =
      (Math.sin(temps * 0.31) * 0.22 + (sx - 0.5) * 1.0 + sortie * 0.9) * face + etat.tourIntro + etat.tourClic;
    verre.rotation.x = ((sy - 0.5) * 0.34 + Math.sin(temps * 0.27) * 0.04 + elan * 0.45) * face;
    verre.rotation.z = (-0.045 + elan * 0.06) * face;
    u.uZoom.value = etat.zoom;
    u.uEnergie.value = etat.energie;
    u.uFissure.value = etat.fissure;
    u.uEclat.value = etat.eclat * ambiance.eclats;
    u.uConstruit.value = etat.construit;
    u.uScan.value = etat.scan;
    u.uAmbiance.value[0] = ambiance.brume;
    u.uAmbiance.value[1] = ambiance.douceur;
    u.uAmbiance.value[2] = ambiance.bleu;
    // L'emprise du portail à l'écran (pour savoir si le curseur est dessus).
    portail.x = fx;
    portail.y = fy - flottement;
    portail.demiL = ((1.15 * echelle) / (HAUTEUR_VISIBLE * aspect) / 2) * Math.max(0.35, Math.abs(Math.cos(verre.rotation.y)));
    portail.demiH = (1.9 * echelle) / HAUTEUR_VISIBLE / 2;
    u.uVerre.value[0] = fx;
    u.uVerre.value[1] = 1 - fy + flottement;
    u.uVerre.value[2] = etat.verreIntro;

    renderer.render({ scene, camera });
  };

  if (mouvementReduit) {
    // Moins de mouvement : une image fixe, redessinée seulement si la fenêtre change.
    Object.assign(etat, { reveal: 1, verreIntro: 1, tourIntro: 0 });
    const figer = () => requestAnimationFrame(() => image(8));
    window.addEventListener('resize', apresPause(figer, 160));
    toile.addEventListener('scene-prete', figer);
    figer();
    return true;
  }

  // ---- La lampe ----
  // Elle s'allume toute seule après l'entrée de page, tenue par le fantôme.
  // Au premier mouvement de souris, le visiteur la prend ; quand la souris
  // quitte la fenêtre, le fantôme la reprend.
  gsap.to(etat, { lampe: 1, duration: 2, delay: 1.6, ease: 'power2.out' });

  let tenue = false;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const r = toile.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top >= window.innerHeight || jeu?.open) return;
      // Les coordonnées normalisées restent dans le cadre même pendant le
      // défilement : une cible > 1 basculait la lame vers le sol au retour.
      etat.sourisX = borner((e.clientX - r.left) / r.width, 0, 1);
      etat.sourisY = borner((e.clientY - r.top) / r.height, 0, 1);
      survoler(dessus(e) && surPortail({ x: etat.sourisX, y: etat.sourisY }));
      if (tenue) return;
      tenue = true;
      gsap.to(pilote, { prise: 1, duration: 0.7, ease: 'power2.out', overwrite: true });
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    tenue = false;
    gsap.to(pilote, { prise: 0, duration: 1.6, ease: 'power2.inOut', overwrite: true });
  });

  // ---- Le portail : survol et clic ----
  // Survol : il se réveille. Ses contours s'allument, un reflet le parcourt, et
  // un scanner descend le long du verre en révélant les destinations du site.
  // Clic : il se brise, et ses éclats forment la carte du site. Toute cette
  // séquence est menée par explorateur.ts, qui pilote les fissures et la
  // rupture à travers « etat » ; ici, on se contente de lui annoncer le clic.
  // Chaque moment est annoncé par un évènement « portail » : la carte et les sons s'y accrochent.
  const annoncer = (moment: string) => window.dispatchEvent(new CustomEvent('portail', { detail: moment }));
  const dessus = (e: PointerEvent) => !(e.target as Element).closest('a, button') && !!(e.target as Element).closest('.hero__cadre');
  const carteOuverte = () => document.documentElement.classList.contains('carte-en-transition');
  let survole = false;
  /** Le clic en cours sur le portail : le pointeur qui l'a commencé, et où. */
  let vise: { id: number; x: number; y: number } | null = null;

  const survoler = (oui: boolean) => {
    if (oui === survole || vise || carteOuverte() || etat.fissure > 0.02) return;
    if (oui && document.documentElement.classList.contains('intro')) return;
    survole = oui;
    document.querySelector('.curseur')?.classList.toggle('curseur--lien', oui);
    cadreEl?.classList.toggle('sur-portail', oui);
    gsap.to(etat, { energie: oui ? 0.4 : 0, duration: oui ? 0.5 : 0.9, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(etat, { scan: oui ? 1 : 0, duration: oui ? 1.1 : 0.6, ease: 'power1.inOut', overwrite: 'auto' });
    if (oui) annoncer('survol');
  };

  /** Le portail est cliqué : il quitte son état de survol, et la carte prend la suite. */
  const ouvrir = (x: number, y: number) => {
    dernierClic = { x, y };
    survole = false;
    cadreEl?.classList.remove('sur-portail');
    document.querySelector('.curseur')?.classList.remove('curseur--lien');
    gsap.to(etat, { scan: 0, duration: 0.3, ease: 'power1.out', overwrite: 'auto' });
    annoncer('ouvre');
  };

  /** Le geste commencé sur le portail n'était pas un clic (glissement, défilement au doigt) : rien ne se passe. */
  const abandonner = () => {
    if (!vise) return;
    vise = null;
    gsap.to(etat, { energie: survole ? 0.4 : 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
  };

  // ---- Clic ou toucher : une onde part du point touché, et la lame pivote ----
  const cadre = toile.parentElement;
  const cadreEl = cadre;
  let tourVoulu = 0;
  let appui: { id: number; x: number; y: number } | null = null;

  // Le bouton clavier et le Hub contournent le clic WebGL. Leur ouverture doit
  // pourtant effacer le même aperçu ; sinon « sur-portail » survit au retour.
  window.addEventListener('portail', (e) => {
    if (!['carte-activation', 'carte-fermee', 'carte-quittee'].includes((e as CustomEvent<string>).detail)) return;
    survole = false;
    vise = null;
    appui = null;
    cadreEl?.classList.remove('sur-portail');
    gsap.killTweensOf(etat, 'scan');
    etat.scan = 0;
  });

  /** Position d'un pointeur dans le cadre, de 0 à 1 depuis le coin haut-gauche. */
  const dansCadre = (e: PointerEvent) => {
    const r = toile.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  /** Un demi-tour, du côté où l'on a poussé. La lame est symétrique : elle retombe à l'identique. */
  const pivoter = (x: number) => {
    tourVoulu += Math.PI * (x < u.uVerre.value[0] ? -1 : 1);
    gsap.to(etat, { tourClic: tourVoulu, duration: 1.8, ease: 'expo.out', overwrite: 'auto' });
  };

  cadre?.addEventListener('pointerdown', (e) => {
    // Pendant l'introduction, le portail ne réagit pas : on la laisse se dérouler.
    if (document.documentElement.classList.contains('intro')) return;
    if ((e.target as Element).closest('a, button')) return;
    const p = dansCadre(e);
    // Sur le portail : on retient où le geste a commencé. S'il se termine au même endroit, c'est un clic.
    if (surPortail(p) && !carteOuverte()) {
      vise = { id: e.pointerId, x: e.clientX, y: e.clientY };
      gsap.to(etat, { energie: 0.85, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
      return;
    }
    u.uOnde.value[0] = p.x;
    u.uOnde.value[1] = 1 - p.y;
    u.uOnde.value[2] = 0;

    if (e.pointerType !== 'touch') {
      pivoter(p.x);
      return;
    }
    // Au doigt : la lampe vient sous le doigt, puis le fantôme la reprend.
    // Le pivot attend de savoir si c'est une tape ou le début d'un défilement.
    appui = { id: e.pointerId, x: e.clientX, y: e.clientY };
    etat.sourisX = p.x;
    etat.sourisY = p.y;
    agitation = 0.9; // au toucher : quelques fêlures naissent sous le doigt, puis s'effacent
    gsap.killTweensOf(pilote);
    gsap
      .timeline()
      .to(pilote, { prise: 1, duration: 0.45, ease: 'power2.out' })
      .to(pilote, { prise: 0, duration: 2.4, ease: 'power2.inOut' }, '+=1.2');
  });
  cadre?.addEventListener('pointerup', (e) => {
    const depart = vise;
    if (!depart || depart.id !== e.pointerId) return;
    vise = null;
    // Un vrai clic (le pointeur a peu bougé : jusqu'à 20 px, une main qui tremble un peu) : le portail se brise.
    if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 20) ouvrir(e.clientX, e.clientY);
    else gsap.to(etat, { energie: survole ? 0.4 : 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
  });
  cadre?.addEventListener('pointercancel', abandonner);
  cadre?.addEventListener('pointerleave', abandonner);
  cadre?.addEventListener('pointerup', (e) => {
    const depart = appui;
    appui = null;
    if (!depart || depart.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 12) pivoter(dansCadre(e).x);
  });
  cadre?.addEventListener('pointercancel', () => (appui = null));

  gsap.ticker.add(image);
  return true;
}
