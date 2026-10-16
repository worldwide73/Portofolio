// PORTAL RUSH 3D — LA SCÈNE
//
// Une vraie scène 3D (WebGL 2, bibliothèque OGL déjà utilisée par le site) :
// caméra en perspective, maillages en volume, matières éclairées, brouillard,
// ciel procédural, planètes. Le moteur (moteur.ts) décide de tout ce qui se
// passe ; la scène ne fait que le montrer : chaque objet du parcours devient un
// modèle 3D placé à sa distance, le vaisseau suit la position réelle du moteur
// (les effets ne déplacent jamais la collision).
//
// Le monde défile par tronçons de 48 m recyclés (voir mondes.ts) ; les objets
// sont tirés d'une réserve et rendus à la réserve quand ils sont passés. Une
// toile 2D transparente, par-dessus, affiche les gains (« +120 ») et l'alerte.
//
// Elle sert aussi à l'interface : la scène d'attente des menus, les aperçus des
// mondes de la carte de campagne, et le vaisseau qui tourne dans le garage.

import { Camera, Geometry, Mat4, Mesh, Renderer, Transform, Triangle, Vec3 } from 'ogl';
import type { Equipement, Theme } from '../donnees';
import { apparition } from '../equilibrage';
import { estObstacle, type Objet, type Partie } from '../moteur';
import { couleurPiece, type Vue } from '../rendu';
import { Assembleur, Halos, hex, lineaire, type RGB } from './geometrie';
import { anneau, ciel, energie, halo, planete, points, surface, traits, uniformesMonde } from './materiaux';
import * as Mo from './modeles';
import { kitDe } from './kits';
import { TRONCON, type Palette } from './mondes';
import { creerPli, majPli, plier, type Pli } from './parcours';

export interface RenduJeu {
  troisD: boolean;
  eclater(voie: number, couleur: string, nombre?: number): void;
  flotter(voie: number, texte: string, couleur?: string): void;
  anneau(voie: number, couleur?: string): void;
  secouer(force: number): void;
  flasher(couleur: string, force?: number): void;
  alerter(): void;
  toucherBoss(): void;
  dessiner(p: Partie | null, vue: Vue, temps: number, dt: number): void;
  /** Une image fixe d'un monde (JPEG en data URL), pour la carte de campagne. */
  apercu?(theme: Theme, l: number, h: number): string | null;
  /** Le vaisseau du garage, dessiné dans une autre toile. */
  garage?(cible: CanvasRenderingContext2D, l: number, h: number, eq: Equipement, temps: number): void;
  /**
   * Un mouvement de caméra : ouverture (on recule depuis le vaisseau), fermeture (tout converge vers son noyau),
   * victoire (tour du vaisseau, Overdrive, traversée de la porte d'arrivée), défaite (le monde ralentit).
   */
  cinematique?(type: 'entree' | 'sortie' | 'victoire' | 'defaite'): void;
  /** La position du noyau du vaisseau à l'écran (px). */
  centreVaisseau?(): { x: number; y: number };
  /** La collecte d'un fragment : il est aspiré par le vaisseau ; une onde, des étincelles, un trait d'énergie vers la jauge (cible, en px). */
  capter?(voie: number, couleur: string, cible?: { x: number; y: number }): void;
}

const borne = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lisse = (a: number, b: number, v: number) => {
  const t = borne((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = (s: string): RGB => s.split(',').map((x) => Number(x) / 255) as RGB;
const lin = (c: RGB): number[] => lineaire(c);
/** Les infinis (survie) parcourent les mondes les uns après les autres. */
const CYCLE_INFINI: Theme[] = ['lancement', 'neon', 'debris', 'laser', 'rift', 'tempete', 'sentinelle', 'singularite'];
const ETAPE_INFINI = 1500;
const VUE = 330;

export function creerScene3D(toile: HTMLCanvasElement, ctx: CanvasRenderingContext2D): RenduJeu | null {
  let renderer: Renderer;
  const fin = window.matchMedia('(pointer: coarse)').matches;
  try {
    renderer = new Renderer({ canvas: toile, dpr: Math.min(window.devicePixelRatio || 1, fin ? 1.25 : 1.5), alpha: false, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const gl = renderer.gl;
  if (!gl || !renderer.isWebgl2) return null;
  gl.clearColor(0.005, 0.008, 0.016, 1);

  // ==========================================================================
  // LES PROGRAMMES
  // ==========================================================================
  const monde = uniformesMonde();
  const pMonde = surface(gl, { ...monde, uDecoupe: { value: 1 } });
  const trous = [monde.uTrou0, monde.uTrou1, monde.uTrou2, monde.uTrou3, monde.uTrou4, monde.uTrou5];
  const pLoin = surface(gl, { ...monde, uBrume: { value: [2200, 12000] }, uPlie: { value: 0 } });
  // (Les objets ont leur propre brouillard : ils émergent de la brume au loin, au lieu d'apparaître d'un coup.)
  const pObjet = surface(gl, { ...monde, uCoeur: { value: [1, 1, 1] }, uBrume: { value: [60, 120] } });
  const uVaisseau = { uPeinture: { value: [0.85, 0.88, 0.92] }, uAccent: { value: [0.3, 0.55, 1] }, uAccent2: { value: [0.9, 0.9, 1] }, uCoeur: { value: [1, 1, 1] } };
  const pVaisseau = surface(gl, { ...monde, ...uVaisseau });
  const pHalo = halo(gl, monde);
  const pHaloLoin = halo(gl, { ...monde, uBrume: { value: [3000, 14000] } });
  pHaloLoin.uniforms.uPlie.value = 0;
  const pFlamme = energie(gl, monde, 0);
  const pFaisceau = energie(gl, monde, 1);
  const pVoile = energie(gl, monde, 2);
  const pChevron = energie(gl, monde, 4);
  const pTraits = traits(gl, monde);
  const pBulle = energie(gl, monde, 3);
  const pCiel = ciel(gl, monde);
  const pPlanete = planete(gl, monde);
  const pAnneau = anneau(gl, monde);
  const pPoints = points(gl, monde);

  const scene = new Transform();
  const camera = new Camera(gl, { fov: 55, near: 0.3, far: 9000 });

  // ---- Le cache des géométries ----
  const geos = new Map<string, Geometry | null>();
  const geo = (cle: string, f: () => Assembleur | Halos): Geometry | null => {
    if (!geos.has(cle)) geos.set(cle, f().geometrie(gl));
    return geos.get(cle) ?? null;
  };
  const double = (cle: string, f: () => { solide: Assembleur; halos: Halos }) => {
    if (!geos.has(cle + ':s')) {
      const r = f();
      geos.set(cle + ':s', r.solide.geometrie(gl));
      geos.set(cle + ':h', r.halos.geometrie(gl));
    }
    return { solide: geos.get(cle + ':s') ?? null, halos: geos.get(cle + ':h') ?? null };
  };
  /** Un maillage. « avant » règle les uniformes propres à cet objet juste avant son dessin. */
  const maillage = (g: Geometry | null, prog: Mesh['program'], parent: Transform, avant?: () => void, mode?: number) => {
    if (!g) return null;
    // (Pas d'élimination hors champ : le pli du parcours déplace les objets loin de leur boîte englobante.)
    const m = new Mesh(gl, { geometry: g, program: prog, mode, frustumCulled: false });
    if (avant) m.onBeforeRender(avant);
    m.setParent(parent);
    return m;
  };

  // ==========================================================================
  // LE CIEL ET LA PALETTE
  // ==========================================================================
  const cielMesh = new Mesh(gl, { geometry: new Triangle(gl), program: pCiel, frustumCulled: false, renderOrder: -10 });
  cielMesh.setParent(scene);
  const vueSansTranslation = new Mat4();
  const inverse = new Mat4();
  const exposition = { base: 1, eclat: 0 };
  let paletteCourante: Palette | null = null;
  let eclair = 0;

  /** Les couleurs d'une palette, prêtes pour les shaders (linéaires). */
  const versUniformes = (p: Palette) => {
    const n = Math.hypot(...p.soleilDir);
    return {
      uSoleilDir: p.soleilDir.map((v) => v / n),
      uSoleil: lin(hex(p.soleil)).map((v) => v * p.soleilForce),
      uCiel: lin(hex(p.ciel)).map((v) => v * p.cielForce),
      uSol: lin(hex(p.sol)),
      uBrouillard: lin(hex(p.brouillard)),
      uBrume: [...p.brume],
      uAccent: lin(hex(p.accent)),
      uAccent2: lin(hex(p.accent2)),
      uHaut: lin(hex(p.haut)),
      uHorizon: lin(hex(p.horizon)),
      uBas: lin(hex(p.bas)),
      uNebuleuse1: lin(hex(p.nebuleuse1)),
      uNebuleuse2: lin(hex(p.nebuleuse2)),
      uDensite: [p.densite],
      uEtoiles: [p.etoiles],
      uVoile: [p.voile],
      expo: [p.exposition],
    };
  };
  type Cibles = ReturnType<typeof versUniformes>;
  const actuel: Cibles = versUniformes(kitDe('lancement').palette);
  /** Rapproche la palette affichée de la palette voulue (t = 1 : d'un coup). */
  const appliquerPalette = (p: Palette, t: number) => {
    paletteCourante = p;
    const cible = versUniformes(p);
    for (const k of Object.keys(cible) as (keyof Cibles)[]) {
      const a = actuel[k] as number[],
        b = cible[k] as number[];
      for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * t;
    }
    for (const k of ['uSoleilDir', 'uSoleil', 'uCiel', 'uSol', 'uBrouillard', 'uBrume', 'uAccent', 'uAccent2'] as const) monde[k].value = actuel[k];
    const u = pCiel.uniforms;
    u.uHaut.value = actuel.uHaut;
    u.uHorizon.value = actuel.uHorizon;
    u.uBas.value = actuel.uBas;
    u.uNebuleuse1.value = actuel.uNebuleuse1;
    u.uNebuleuse2.value = actuel.uNebuleuse2;
    u.uDensite.value = actuel.uDensite[0];
    u.uEtoiles.value = actuel.uEtoiles[0];
    u.uVoile.value = actuel.uVoile[0];
    exposition.base = actuel.expo[0];
  };
  appliquerPalette(kitDe('lancement').palette, 1);
  const copierPalette = (): Cibles => JSON.parse(JSON.stringify(actuel));
  const restaurerPalette = (c: Cibles) => {
    for (const k of Object.keys(c) as (keyof Cibles)[]) (actuel[k] as number[]).splice(0, (c[k] as number[]).length, ...(c[k] as number[]));
  };

  // ==========================================================================
  // LE LOINTAIN : planètes, anneaux, stations (il suit la caméra)
  // ==========================================================================
  const lointains = new Map<Theme, Transform>();
  const geoAnneauPlat = (r0: number, r1: number) => {
    const a = new Assembleur();
    const n = 96;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2,
        t1 = ((i + 1) / n) * Math.PI * 2;
      a.quad([Math.cos(t0) * r0, Math.sin(t0) * r0, 0], [Math.cos(t0) * r1, Math.sin(t0) * r1, 0], [Math.cos(t1) * r1, Math.sin(t1) * r1, 0], [Math.cos(t1) * r0, Math.sin(t1) * r0, 0], Mo.M.blanc);
    }
    return a.geometrie(gl);
  };
  const lointainDe = (theme: Theme): Transform => {
    let g = lointains.get(theme);
    if (g) return g;
    g = new Transform();
    const l = kitDe(theme).lointain;
    const sphere = geo('sphere', () => new Assembleur().sphere(1, 4, Mo.M.blanc));
    for (const pl of l.planetes) {
      const m = maillage(sphere, pPlanete, g, () => {
        const u = pPlanete.uniforms;
        u.uCouleurA.value = lin(hex(pl.a));
        u.uCouleurB.value = lin(hex(pl.b));
        u.uAtmosphere.value = lin(hex(pl.atmosphere));
        u.uGenre.value = pl.genre;
        u.uGraine.value = pl.graine;
      })!;
      m.position.set(...pl.pos);
      m.scale.set(pl.rayon);
      if (pl.anneau) {
        const an = pl.anneau;
        const ma = maillage(geoAnneauPlat(an.r0, an.r1), pAnneau, g, () => {
          const u = pAnneau.uniforms;
          u.uCouleurA.value = lin(hex(an.a));
          u.uCouleurB.value = lin(hex(an.b));
          u.uR0.value = an.r0;
          u.uR1.value = an.r1;
          u.uGenre.value = 0;
        })!;
        ma.position.set(...pl.pos);
        ma.rotation.set(...an.inclinaison);
      }
    }
    if (l.disque) {
      const d = l.disque;
      const md = maillage(geoAnneauPlat(d.r0, d.r1), pAnneau, g, () => {
        const u = pAnneau.uniforms;
        u.uCouleurA.value = lin(hex(d.a));
        u.uCouleurB.value = lin(hex(d.b));
        u.uR0.value = d.r0;
        u.uR1.value = d.r1;
        u.uGenre.value = 1;
      })!;
      md.position.set(...d.pos);
      md.rotation.set(...d.inclinaison);
      const trou = maillage(geo('sphereNoire', Mo.sphereNoire), pLoin, g)!;
      trou.position.set(...d.pos);
      trou.scale.set(d.trou);
    }
    if (l.structures) {
      const a = new Assembleur();
      const h = new Halos();
      l.structures(a, h);
      maillage(a.geometrie(gl), pLoin, g);
      maillage(h.geometrie(gl), pHaloLoin, g);
    }
    lointains.set(theme, g);
    return g;
  };

  // ---- Le trafic lointain : cargos et vaisseau amiral qui traversent le ciel (pas dans le rift ni près du trou noir) ----
  const AVEC_TRAFIC = new Set<Theme>(['lancement', 'neon', 'debris', 'laser', 'tempete', 'sentinelle']);
  const trafic = new Transform();
  const navires: { t: Transform; depart: number[]; dir: number[]; v: number; course: number; s: number }[] = [];
  const ajouterNavire = (g: { solide: Geometry | null; halos: Geometry | null }, pos: number[], cap: number, v: number, course: number, s0: number, echelle = 1) => {
    const t = new Transform();
    t.setParent(trafic);
    maillage(g.solide, pLoin, t);
    maillage(g.halos, pHaloLoin, t);
    t.rotation.y = cap;
    t.scale.set(echelle);
    navires.push({ t, depart: pos, dir: [Math.cos(cap), 0, -Math.sin(cap)], v, course, s: s0 });
  };
  const preparerTrafic = () => {
    if (navires.length) return;
    const cargo = double('cargo-lointain', Mo.cargoLointain);
    const grand = double('amiral', Mo.amiral);
    ajouterNavire(cargo, [-620, 150, -950], 0.22, 26, 1300, 250, 1.7);
    ajouterNavire(cargo, [560, 210, -1250], Math.PI + 0.18, 21, 1400, 700, 1.6);
    ajouterNavire(cargo, [-380, 105, -1700], 0.05, 32, 1600, 0, 1.5);
    ajouterNavire(cargo, [-500, 113, -1670], 0.05, 32, 1600, -130, 1.5);
    ajouterNavire(cargo, [-620, 121, -1640], 0.05, 32, 1600, -260, 1.5);
    ajouterNavire(grand, [1100, 430, -3000], Math.PI * 0.92, 10, 2400, 500, 1.3);
  };

  // ==========================================================================
  // LES TRONÇONS DU MONDE
  // ==========================================================================
  interface Troncon {
    theme: Theme;
    variante: number;
    racine: Transform;
  }
  const troncons = new Map<number, Troncon>();
  const geoTroncon = (theme: Theme, v: number) => double(`troncon-${theme}-${v}`, () => {
    const a = new Assembleur();
    const h = new Halos();
    kitDe(theme).troncon(a, h, v);
    return { solide: a, halos: h };
  });
  const varianteDe = (i: number, theme: Theme) => {
    const n = kitDe(theme).variantes;
    return ((i * 2654435761) >>> 0) % 7 % n;
  };
  const poserTroncons = (distance: number, themePour: (i: number) => Theme, portee = VUE) => {
    const i0 = Math.floor((distance - 14) / TRONCON);
    const i1 = Math.floor((distance + portee) / TRONCON);
    for (const [i, t] of troncons)
      if (i < i0 || i > i1) {
        t.racine.setParent(null);
        troncons.delete(i);
      }
    for (let i = i0; i <= i1; i++) {
      const theme = themePour(i);
      let t = troncons.get(i);
      const v = varianteDe(i, theme);
      if (t && (t.theme !== theme || t.variante !== v)) {
        t.racine.setParent(null);
        t = undefined;
      }
      if (!t) {
        const racine = new Transform();
        const g = geoTroncon(theme, v);
        maillage(g.solide, pMonde, racine);
        maillage(g.halos, pHalo, racine);
        t = { theme, variante: v, racine };
        troncons.set(i, t);
      }
      t.racine.setParent(scene);
      t.racine.position.set(0, 0, distance - i * TRONCON);
    }
  };
  /** Libère les géométries des mondes qui ne servent plus (la mémoire du téléphone compte). */
  const libererMondes = (garder: Set<Theme>) => {
    for (const [cle, g] of geos)
      if (cle.startsWith('troncon-')) {
        const theme = cle.split('-')[1] as Theme;
        if (!garder.has(theme) && g) {
          g.remove();
          geos.delete(cle);
        }
      }
  };

  // ==========================================================================
  // LE VAISSEAU
  // ==========================================================================
  const creerVaisseau = (parent: Transform) => {
    const racine = new Transform();
    racine.setParent(parent);
    const corps = new Transform();
    corps.setParent(racine);
    maillage(geo('vaisseau', Mo.vaisseau), pVaisseau, corps);
    const emetteurs = Mo.EMETTEURS.map((p) => {
      const m = maillage(geo('emetteur', Mo.emetteur), pVaisseau, corps)!;
      m.position.set(...p);
      return m;
    });
    const flammes = [1, -1].map((s) => {
      const f = { force: 1, couleur: [1, 1, 1] };
      const m = maillage(geo('flamme', Mo.flamme), pFlamme, corps, () => {
        pFlamme.uniforms.uCouleur.value = f.couleur;
        pFlamme.uniforms.uForce.value = f.force;
        pFlamme.uniforms.uLongueur.value = 1;
      })!;
      m.position.set(0.27 * s, -0.04, 1.47);
      return { m, f };
    });
    const bulleEtat = { force: 0, couleur: [1, 1, 1] };
    const bulle = maillage(geo('bulle', Mo.bulle), pBulle, racine, () => {
      pBulle.uniforms.uCouleur.value = bulleEtat.couleur;
      pBulle.uniforms.uForce.value = bulleEtat.force;
    })!;
    bulle.scale.set(1.55, 0.75, 2.1);
    bulle.position.set(0, 0.05, 0);
    return { racine, corps, emetteurs, flammes, bulle, bulleEtat };
  };
  const vaisseau = creerVaisseau(scene);

  // La traînée : deux rubans, un par moteur, qui gardent la trace des changements de voie.
  const POINTS_TRAINEE = 34;
  const traces: number[] = Array(POINTS_TRAINEE).fill(0);
  let accTrainee = 0;
  const rubans = [1, -1].map((s) => {
    const n = POINTS_TRAINEE;
    const position = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    const couleur = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      uv[i * 4] = -1;
      uv[i * 4 + 2] = 1;
    }
    const geom = new Geometry(gl, {
      position: { size: 3, data: position },
      uv: { size: 2, data: uv },
      couleur: { size: 3, data: couleur },
    });
    const m = new Mesh(gl, { geometry: geom, program: pHalo, mode: gl.TRIANGLE_STRIP, frustumCulled: false });
    m.setParent(scene);
    return { s, m, position, couleur, geom };
  });

  // ==========================================================================
  // LES PARTICULES ET LA POUSSIÈRE DE VITESSE
  // ==========================================================================
  const N_PART = 360;
  const part = {
    pos: new Float32Array(N_PART * 3),
    col: new Float32Array(N_PART * 4),
    taille: new Float32Array(N_PART),
    vit: new Float32Array(N_PART * 3),
    vie: new Float32Array(N_PART),
    suivant: 0,
  };
  const geoPart = new Geometry(gl, {
    position: { size: 3, data: part.pos },
    couleur: { size: 4, data: part.col },
    taille: { size: 1, data: part.taille },
  });
  const meshPart = new Mesh(gl, { geometry: geoPart, program: pPoints, mode: gl.POINTS, frustumCulled: false });
  meshPart.setParent(scene);
  const N_POUSS = 140;
  const pouss = { pos: new Float32Array(N_POUSS * 3), col: new Float32Array(N_POUSS * 4), taille: new Float32Array(N_POUSS) };
  for (let i = 0; i < N_POUSS; i++) {
    pouss.pos[i * 3] = (Math.random() - 0.5) * 40;
    pouss.pos[i * 3 + 1] = Math.random() * 14 - 3;
    pouss.pos[i * 3 + 2] = -Math.random() * 120;
    pouss.taille[i] = 0.6 + Math.random() * 1.4;
  }
  const geoPouss = new Geometry(gl, {
    position: { size: 3, data: pouss.pos },
    couleur: { size: 4, data: pouss.col },
    taille: { size: 1, data: pouss.taille },
  });
  const meshPouss = new Mesh(gl, { geometry: geoPouss, program: pPoints, mode: gl.POINTS, frustumCulled: false });
  meshPouss.setParent(scene);

  // Les traits de vitesse : des segments posés dans l'espace, de part et d'autre de la piste ; ils filent
  // à la vitesse du monde et s'allongent avec elle (et en Overdrive). Rien en mouvement réduit.
  const N_TRAITS = 90;
  const vitTraits = { pos: new Float32Array(N_TRAITS * 6), col: new Float32Array(N_TRAITS * 8), base: new Float32Array(N_TRAITS * 3) };
  for (let i = 0; i < N_TRAITS; i++) {
    const s = Math.random() < 0.5 ? -1 : 1;
    vitTraits.base.set([s * (5.5 + Math.random() * 16), -1 + Math.random() * 9, -Math.random() * 140], i * 3);
  }
  const geoTraits = new Geometry(gl, { position: { size: 3, data: vitTraits.pos }, couleur: { size: 4, data: vitTraits.col } });
  const meshTraits = new Mesh(gl, { geometry: geoTraits, program: pTraits, mode: gl.LINES, frustumCulled: false });
  meshTraits.setParent(scene);

  const lancerParticules = (x: number, y: number, z: number, c: RGB, n: number, force = 6) => {
    const l = lin(c);
    for (let k = 0; k < n; k++) {
      const i = part.suivant;
      part.suivant = (part.suivant + 1) % N_PART;
      part.pos.set([x, y, z], i * 3);
      const a = Math.random() * Math.PI * 2,
        b = (Math.random() - 0.3) * Math.PI;
      const v = force * (0.4 + Math.random() * 0.8);
      part.vit.set([Math.cos(a) * Math.cos(b) * v, Math.sin(b) * v + 1.5, Math.sin(a) * Math.cos(b) * v + 4], i * 3);
      part.col.set([l[0] * 2, l[1] * 2, l[2] * 2, 1], i * 4);
      part.taille[i] = 2.5 + Math.random() * 3.5;
      part.vie[i] = 0.6 + Math.random() * 0.6;
    }
  };

  // La collecte : le fragment touché est aspiré par le noyau du vaisseau (il rétrécit en s'y précipitant),
  // puis un trait d'énergie file jusqu'à la jauge d'Overdrive. Une réserve de six, réutilisée.
  const captures = Array.from({ length: 6 }, () => {
    const racine = new Transform();
    const etat = { emission: 1, coeur: [1, 1, 1], t: 1, depart: [0, 0, 0], cible: null as { x: number; y: number } | null, couleur: '150, 230, 255' };
    const g = double('cristal-fragment', () => Mo.cristal('fragment'));
    maillage(g.solide, pObjet, racine, () => {
      const u = pObjet.uniforms;
      u.uImpact.value = 0.3 * (1 - etat.t);
      u.uImpactCouleur.value = [0.5, 0.9, 1];
      u.uEmission.value = etat.emission;
      u.uCoeur.value = etat.coeur;
    });
    racine.visible = false;
    racine.setParent(scene);
    return { racine, etat };
  });
  let flashCoeur = 0;
  const aPreparer: (() => void)[] = [];
  let partiePreparee: Partie | null = null;
  const prechauffer = (p: Partie) => {
    partiePreparee = p;
    aPreparer.length = 0;
    // Les couloirs effondrés : une géométrie par longueur (au mètre près, par pas de 2 m).
    for (let l = 4; l <= 48; l += 2) for (const g of [0, 1]) aPreparer.push(() => void double(`faille-${l}-${g}`, () => Mo.faille(l, g)));
  };
  let reduitCourant = false;
  const traineesHud: { t0: number; cible: { x: number; y: number }; couleur: string }[] = [];

  // Les anneaux d'énergie (Perfect Dodge) : ils s'élargissent autour du vaisseau.
  const ondes = Array.from({ length: 6 }, () => {
    const e = { vie: 0, couleur: [1, 1, 1], x: 0, capture: false, z: 0 };
    const m = maillage(geo('onde', Mo.onde), pFaisceau, scene, () => {
      pFaisceau.uniforms.uCouleur.value = e.couleur;
      pFaisceau.uniforms.uForce.value = e.vie * (e.capture ? 1.1 : 2.2);
    })!;
    m.visible = false;
    return { e, m };
  });

  // ==========================================================================
  // LES OBJETS DU PARCOURS
  // ==========================================================================
  interface Visuel {
    type: string;
    racine: Transform;
    /** La position latérale affichée : elle rejoint sa voie en glissant (jamais de saut d'une voie à l'autre). */
    x: number | null;
    etat: { couleur: number[]; force: number; impact: number; emission: number; coeur: number[] };
    extra?: Mesh | null;
  }
  const visuels = new Map<string, Visuel>();
  const reserve = new Map<string, Visuel[]>();
  const creerVisuel = (type: string): Visuel => {
    const racine = new Transform();
    const etat = { couleur: [1, 1, 1], force: 1, impact: 0, emission: 1, coeur: [1, 1, 1] };
    const avantObjet = () => {
      const u = pObjet.uniforms;
      u.uImpact.value = etat.impact;
      u.uImpactCouleur.value = [1, 0.45, 0.2];
      u.uEmission.value = etat.emission;
      u.uCoeur.value = etat.coeur;
    };
    const avantEnergie = (prog: Mesh['program']) => () => {
      prog.uniforms.uCouleur.value = etat.couleur;
      prog.uniforms.uForce.value = etat.force;
    };
    let extra: Mesh | null = null;
    const ajouter = (g: { solide: Geometry | null; halos: Geometry | null }) => {
      maillage(g.solide, pObjet, racine, avantObjet);
      maillage(g.halos, pHalo, racine);
    };
    const [genre, param] = type.split(':');
    switch (genre) {
      case 'bloc':
        ajouter(double('barriere', Mo.barriere));
        break;
      case 'debris':
        maillage(geo(`rochers-${param}`, () => Mo.rochers(Number(param))), pObjet, racine, avantObjet);
        break;
      case 'laser':
        ajouter(double('pylones', Mo.pylones));
        extra = maillage(geo('faisceau', Mo.faisceau), pFaisceau, racine, avantEnergie(pFaisceau));
        break;
      case 'mobile':
        ajouter(double('cargo', Mo.cargo));
        break;
      case 'frappe':
        ajouter(double('lance', Mo.lance));
        break;
      case 'faille': {
        const [l, g] = param.split('/');
        ajouter(double(`faille-${l}-${g}`, () => Mo.faille(Number(l), Number(g))));
        break;
      }
      case 'portail':
        ajouter(double(`portail-${param}`, () => Mo.portail(Number(param) as -1 | 0 | 1)));
        extra = maillage(geo('voile', Mo.voile), pVoile, racine, avantEnergie(pVoile));
        if (extra) {
          extra.position.set(0, 1.25, 0);
          extra.scale.set(0.97);
        }
        break;
      case 'fragment':
      case 'dore':
      case 'noyau':
        ajouter(double(`cristal-${genre}`, () => Mo.cristal(genre)));
        break;
      case 'cible':
        maillage(geo('cible', Mo.cible), pFaisceau, racine, avantEnergie(pFaisceau));
        break;
      case 'chevrons':
        maillage(geo('trait', () => new Assembleur().quad([-0.5, 0, 0], [0.5, 0, 0], [0.5, 0, -1], [-0.5, 0, -1], Mo.M.blanc)), pChevron, racine, avantEnergie(pChevron));
        break;
    }
    return { type, racine, etat, extra, x: null };
  };
  const prendre = (cle: string, type: string): Visuel => {
    let v = visuels.get(cle);
    if (v && v.type !== type) {
      rendre(cle, v);
      v = undefined;
    }
    if (!v) {
      v = reserve.get(type)?.pop() ?? creerVisuel(type);
      v.racine.setParent(scene);
      v.racine.rotation.set(0, 0, 0);
      v.racine.scale.set(1);
      v.x = null;
      visuels.set(cle, v);
    }
    vus.add(cle);
    return v;
  };
  const rendre = (cle: string, v: Visuel) => {
    v.racine.setParent(null);
    visuels.delete(cle);
    if (!reserve.has(v.type)) reserve.set(v.type, []);
    reserve.get(v.type)!.push(v);
  };
  const vus = new Set<string>();
  const xVoie = (v: number) => (v - 1) * Mo.VOIE;

  /** La voie affichée d'un obstacle mobile : il glisse d'une configuration à la suivante (comme la version 2D). */
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

  const placerObjets = (p: Partie, temps: number, distance: number, dt: number) => {
    vus.clear();
    const loin = p.apparition;
    for (const o of p.objets) {
      if (o.detruit && o.type !== 'faille') continue;
      const z = o.pos - distance; // distance devant le vaisseau (m), à l'instant affiché
      // (Un objet dépassé disparaît vite : il ne doit pas masquer la vue de la caméra, placée derrière le vaisseau.)
      if (z > loin + 2 || o.pos + (o.longueur ?? 0) - distance < -2.5) continue;
      // L'apparition : l'objet émerge de la brume (son brouillard propre) et prend sa taille sur les derniers mètres de la portée.
      const naissance = lisse(loin + 2, loin - 10, z);
      const taille = 0.9 + 0.1 * naissance;
      const g = o.graine;
      switch (o.type) {
        case 'fragment':
        case 'dore':
        case 'noyau': {
          const v = prendre(`${o.id}`, o.type);
          v.racine.position.set(xVoie(o.voies[0]), 1.0 + Math.sin(temps * 4 + g * 6) * 0.08, -z);
          v.racine.rotation.y = temps * 2.2 + g * 6;
          v.racine.scale.set(naissance);
          v.etat.coeur = o.type === 'noyau' ? lin([1, 0.65, 0.4]) : [1, 1, 1];
          break;
        }
        case 'portail': {
          const sens = Math.sign((o.vers ?? o.voies[0]) - o.voies[0]);
          const v = prendre(`${o.id}`, `portail:${sens}`);
          v.racine.position.set(xVoie(o.voies[0]), 0, -z);
          v.racine.scale.set(naissance);
          const c = o.vers === 0 ? [0.47, 0.9, 1] : o.vers === 2 ? [0.75, 0.59, 1] : [0.94, 0.96, 1];
          v.etat.coeur = lin(c as RGB);
          v.etat.couleur = lin(c as RGB).map((x) => x * 0.75);
          v.etat.force = 0.85;
          break;
        }
        case 'faille': {
          const l = Math.max(2, Math.round((o.longueur ?? 8) / 2) * 2);
          o.voies.forEach((voie, k) => {
            const v = prendre(`${o.id}:${k}`, `faille:${l}/${g > 0.5 ? 1 : 0}`);
            v.racine.position.set(xVoie(voie), 0, -z);
            v.etat.emission = o.detruit ? 0.25 : 0.8 + 0.2 * Math.sin(temps * 8 + voie);
          });
          break;
        }
        default: {
          const voies = o.type === 'laser' || o.type === 'debris' ? p.voiesA(o, z) : voiesAffichees(p, o, z);
          const fige = z <= (o.fige ?? 0);
          voies.forEach((voie, k) => {
            const type = o.type === 'debris' ? `debris:${Math.floor(g * 3) % 3}` : o.type;
            const v = prendre(`${o.id}:${k}`, type);
            const cibleX = xVoie(voie);
            v.x = v.x === null ? cibleX : v.x + (cibleX - v.x) * borne(dt * 22);
            v.racine.position.set(v.x, o.type === 'debris' ? Math.sin(temps * 1.5 + g * 9) * 0.06 : 0, -z);
            v.racine.scale.set(o.type === 'mobile' && !fige ? 0.94 : 1);
            v.racine.scale.multiply(taille);
            if (o.type === 'debris') v.racine.rotation.set(Math.sin(temps * 0.7 + g) * 0.2, temps * 0.8 + g * 6, 0);
            v.etat.impact = o.chaud ? 0.15 + 0.1 * Math.sin(temps * 10) : 0;
            v.etat.emission = o.chaud ? 1.6 : 1;
            if (o.type === 'laser') {
              v.etat.couleur = lin([1, 0.22, 0.18]).map((x) => x * 2.2);
              v.etat.force = fige ? 1 : 0.3 + 0.25 * Math.sin(temps * 30 + g * 10);
            }
          });
          // Le cargo : des cercles au sol montrent où il va s'arrêter.
          if (o.type === 'mobile' && o.fige && z > o.fige)
            o.voies.forEach((voie, k) => {
              const c = prendre(`${o.id}:cible:${k}`, 'cible');
              c.racine.position.set(xVoie(voie), 0.03, -o.fige!);
              c.etat.couleur = lin([1, 0.65, 0.25]).map((x) => x * 1.2);
              c.etat.force = 0.6 + 0.3 * Math.sin(temps * 6);
            });
          // Une attaque de boss : la voie visée s'allume en rouge jusqu'à l'impact.
          if (o.chaud && z > 6)
            voies.forEach((voie, k) => {
              const t = prendre(`${o.id}:chaud:${k}`, 'chevrons');
              t.racine.position.set(xVoie(voie), 0.02, -Math.max(0, z - 30));
              t.racine.scale.set(2.2, 1, Math.min(30, z));
              t.etat.couleur = lin([1, 0.35, 0.15]).map((x) => x * 1.3);
              t.etat.force = 0.9;
            });
          // (Plus de ligne au sol entre les voies libres : Mathéo ne veut pas de tracé du chemin à suivre.)
        }
      }
    }
    for (const [cle, v] of visuels) if (!vus.has(cle)) rendre(cle, v);
  };

  // ==========================================================================
  // LES BOSS
  // ==========================================================================
  let boss: { racine: Transform; tournant: Transform[]; etat: { coeur: number[]; impact: number; emission: number }; genre: Theme } | null = null;
  let impactBoss = 0;
  const creerBoss = (genre: Theme) => {
    const racine = new Transform();
    const etat = { coeur: [1, 1, 1], impact: 0, emission: 1 };
    const avant = () => {
      const u = pObjet.uniforms;
      u.uImpact.value = etat.impact;
      u.uImpactCouleur.value = [1, 1, 1];
      u.uEmission.value = etat.emission;
      u.uCoeur.value = etat.coeur;
    };
    const tournant: Transform[] = [];
    if (genre === 'sentinelle') {
      const c = double('sentinelle', Mo.sentinelleCorps);
      maillage(c.solide, pObjet, racine, avant);
      maillage(c.halos, pHalo, racine);
      const coeur = maillage(geo('noyauBoss', Mo.noyauBoss), pObjet, racine, avant)!;
      coeur.scale.set(2.6);
      const couronne = new Transform();
      couronne.setParent(racine);
      maillage(geo('couronne', Mo.sentinelleCouronne), pObjet, couronne, avant);
      tournant.push(couronne);
    } else {
      const noir = maillage(geo('sphereNoire', Mo.sphereNoire), pObjet, racine, avant)!;
      noir.scale.set(3.6);
      const coeur = maillage(geo('noyauBoss', Mo.noyauBoss), pObjet, racine, avant)!;
      coeur.scale.set(1.1);
      coeur.position.set(0, 0, 3.4);
      for (const r of [5.2, 6.6, 8]) {
        const t = new Transform();
        t.setParent(racine);
        maillage(geo(`gardien-${r}`, () => Mo.gardienAnneau(r)), pObjet, t, avant);
        tournant.push(t);
      }
    }
    racine.setParent(scene);
    return { racine, tournant, etat, genre };
  };

  // ==========================================================================
  // LA TOILE 2D PAR-DESSUS : gains, alerte, vignettage
  // ==========================================================================
  const textes: { texte: string; x: number; y: number; z: number; vie: number; couleur: string; dy: number }[] = [];
  let alerte = 0;
  let secousse = 0;
  const projeter = (x: number, y: number, z: number, l: number, h: number) => {
    const v = new Vec3(...plier(pli, x, y, z)).applyMatrix4(camera.projectionViewMatrix);
    return { x: (v.x * 0.5 + 0.5) * l, y: (0.5 - v.y * 0.5) * h };
  };

  // ==========================================================================
  // LA CAMÉRA
  // ==========================================================================
  // Le pli du parcours (virages, reliefs, dévers ; voir parcours.ts), appliqué aux shaders à chaque image.
  const pli: Pli = creerPli();
  const soleilTourne = [0, 1, 0];
  const poserPli = (q: Pli) => {
    monde.uPliX.value = q.pliX;
    monde.uPliY.value = q.pliY;
    monde.uPhase.value = q.phase;
    monde.uDevers.value = q.devers;
    pCiel.uniforms.uCap.value = q.cap;
    pCiel.uniforms.uPente.value = q.pente;
    // Le soleil tourne avec le décor : la côte (pente), puis le virage (cap).
    const b = actuel.uSoleilDir;
    const cp = Math.cos(-q.pente),
      sp = Math.sin(-q.pente),
      cc = Math.cos(q.cap),
      sc = Math.sin(q.cap);
    const x1 = b[0],
      y1 = b[1] * cp - b[2] * sp,
      z1 = b[1] * sp + b[2] * cp;
    soleilTourne[0] = x1 * cc + z1 * sc;
    soleilTourne[1] = y1;
    soleilTourne[2] = -x1 * sc + z1 * cc;
    monde.uSoleilDir.value = soleilTourne;
  };
  const pliDroit: Pli = creerPli();
  const cam = { x: 0, roulis: 0, fov: 55 };
  let cine: { type: 'entree' | 'sortie' | 'victoire' | 'defaite'; t0: number } | null = null;
  // La fin de partie : le monde continue d'avancer (« extra ») ; la porte d'arrivée est posée sur le parcours.
  const finale = { extra: 0, avant: 0, sPorte: 0, partie: null as Partie | null, eclair: false, victoire: false };
  let blanc = 0;
  const derniere = { distance: 0, vitesse: 20 };
  const porte = new Transform();
  porte.visible = false;
  porte.setParent(scene);
  let porteConstruite = false;
  const construirePorte = () => {
    if (porteConstruite) return;
    porteConstruite = true;
    const g = double('porte-arrivee', Mo.porteArrivee);
    maillage(g.solide, pObjet, porte, () => {
      const u = pObjet.uniforms;
      u.uImpact.value = 0;
      u.uEmission.value = 1.2;
      u.uCoeur.value = [1, 1, 1];
    });
    maillage(g.halos, pHalo, porte);
    const v = maillage(geo('voile', Mo.voile), pVoile, porte, () => {
      pVoile.uniforms.uCouleur.value = (monde.uAccent.value as number[]).map((x) => x * 1.3);
      pVoile.uniforms.uForce.value = 0.55;
    })!;
    v.position.set(0, 6.8, 0);
    v.scale.set(7.05);
  };
  const doux = (x: number) => {
    const t = borne(x);
    return t * t * (3 - 2 * t);
  };
  const cadrer = (l: number, h: number, boost: number, vitesse: number, dt: number) => {
    const aspect = l / h;
    let fov = 54 + boost * 6 + borne((vitesse - 30) / 50) * 4;
    let recul = 7.4,
      hauteur = 3.25;
    if (aspect < 1) {
      // En portrait : on garde les trois voies, en prenant plus de recul.
      fov = Math.min(80, (2 * Math.atan(Math.tan((31 * Math.PI) / 180) / aspect) * 180) / Math.PI) + boost * 4;
      recul = 9.6;
      hauteur = 4.4;
    }
    cam.fov += (fov - cam.fov) * borne(dt * 4);
    camera.perspective({ fov: cam.fov, aspect });
    return { recul: recul - boost * 0.5, hauteur: hauteur - boost * 0.25 };
  };

  // ==========================================================================
  // LE DESSIN D'UNE IMAGE
  // ==========================================================================
  let taille = { l: 0, h: 0 };
  let themeAffiche: Theme = 'lancement';
  let lointainAffiche: Transform | null = null;
  let distanceMenu = 0;
  const flammesLongueur = [1, 1];

  const dimensionner = (l: number, h: number) => {
    if (l === taille.l && h === taille.h) return;
    taille = { l, h };
    renderer.setSize(l, h);
    toile.style.width = '100%';
    toile.style.height = '100%';
  };

  const equiper = (eq: Equipement, temps: number) => {
    uVaisseau.uPeinture.value = lin(rgb(couleurPiece(eq.coque, temps)));
    uVaisseau.uAccent.value = lin(rgb(couleurPiece(eq.trainee, temps)));
    uVaisseau.uAccent2.value = lin(rgb(couleurPiece(eq.overdrive, temps)));
    uVaisseau.uCoeur.value = lin(rgb(couleurPiece(eq.noyau, temps)));
  };

  const montrerLointain = (theme: Theme) => {
    const g = lointainDe(theme);
    if (lointainAffiche !== g) {
      lointainAffiche?.setParent(null);
      g.setParent(scene);
      lointainAffiche = g;
    }
    g.position.copy(camera.position);
    // Le lointain pivote avec le parcours : on voit le décor tourner dans les virages.
    g.rotation.set(-pli.pente, pli.cap, 0);
    // Le trafic suit le lointain, et avance.
    trafic.visible = AVEC_TRAFIC.has(theme);
    if (trafic.visible) {
      preparerTrafic();
      if (!trafic.parent) trafic.setParent(scene);
      trafic.position.copy(camera.position);
      trafic.rotation.copy(g.rotation);
    }
  };
  /** Le trafic avance (une boucle : chaque navire repart de son point de départ au bout de sa course). */
  const avancerTrafic = (dt: number) => {
    for (const n of navires) {
      n.s += n.v * dt;
      if (n.s > n.course) n.s -= n.course * 2;
      n.t.position.set(n.depart[0] + n.dir[0] * n.s, n.depart[1], n.depart[2] + n.dir[2] * n.s);
    }
  };

  function dessiner(p: Partie | null, vue: Vue, temps: number, dt: number) {
    dimensionner(vue.l, vue.h);
    monde.uTemps.value = temps;
    const mode = p?.mode;
    // Le monde : celui du niveau ; en survie, il change tous les 1 500 m.
    const themePour = (i: number): Theme => (mode === 'infini' ? CYCLE_INFINI[Math.floor((i * TRONCON) / ETAPE_INFINI) % CYCLE_INFINI.length] : vue.theme === 'infini' ? 'lancement' : vue.theme);
    // Le moteur avance par pas fixes (1/120 s) ; l'image montre l'instant exact, entre deux pas
    // (sinon, sur un écran à 144 Hz, certaines images n'avanceraient pas : de petites saccades).
    if (p !== finale.partie) {
      // Une nouvelle partie (ou le retour au menu) : la séquence de fin précédente est oubliée.
      finale.partie = p;
      finale.extra = 0;
      finale.victoire = false;
      porte.visible = false;
      if (cine && (cine.type === 'victoire' || cine.type === 'defaite')) cine = null;
    }
    const cineFin = cine && (cine.type === 'victoire' || cine.type === 'defaite') ? cine : null;
    const tFin = cineFin ? (performance.now() - cineFin.t0) / 1000 : 99;
    if (p?.termine) {
      // (Le jeu ne donne plus de temps une fois la partie finie : la scène prend le sien.)
      const maintenant = performance.now();
      dt = Math.min(0.05, Math.max(0, (maintenant - (finale.avant || maintenant)) / 1000));
      finale.avant = maintenant;
      let mult = 0;
      if (finale.victoire) mult = tFin < 1.15 ? 0.4 : tFin < 2.25 ? 0.4 + ((tFin - 1.15) / 1.1) * 3.2 : tFin < 3.6 ? 3.6 : 0.3;
      else mult = tFin < 1.3 ? (1 - tFin / 1.3) ** 2 : 0;
      finale.extra += p.vitesse * mult * dt;
    } else finale.avant = 0;
    const distance = p ? p.distance + (vue.avance ?? 0) * p.vitesse + finale.extra : (distanceMenu += dt * 12);
    derniere.distance = distance;
    derniere.vitesse = p ? p.vitesse : 12;
    const themeIci = themePour(Math.floor(distance / TRONCON));
    if (themeIci !== themeAffiche) {
      themeAffiche = themeIci;
      libererMondes(new Set([themeIci, themePour(Math.floor((distance + VUE) / TRONCON))]));
    }
    const palette = { ...kitDe(themeIci).palette };
    if (vue.brume) palette.brume = [Math.max(10, vue.brume * 0.25), vue.brume * 1.9];
    appliquerPalette(palette, paletteCourante === palette || !p ? 1 : borne(dt * 1.5));
    monde.uDistance.value = distance;
    // Les virages et les reliefs : plus doux dans les menus, réduits (sans dévers) en mouvement réduit.
    majPli(pli, distance, mode === 'infini' ? themeIci : vue.theme === 'infini' ? 'infini' : themeIci, (p ? 1 : 0.6) * (vue.reduit ? 0.45 : 1), dt);
    if (vue.reduit) {
      pli.devers = 0;
      pli.inclinaison = 0;
    }
    poserPli(pli);
    monde.uIntensite.value = p ? borne((p.multiplicateur - 1) / 9) : 0.25;
    const boost = (p && p.overdrive > 0) || (cineFin?.type === 'victoire' && tFin > 1.15 && tFin < 3.6) ? 1 : 0;
    monde.uBoost.value += (boost - monde.uBoost.value) * borne(dt * 4);
    exposition.eclat = Math.max(0, exposition.eclat - dt * 2.5);
    monde.uExposition.value = exposition.base * (1 + exposition.eclat * 0.35 + monde.uBoost.value * 0.08);
    equiper(vue.equipement, temps);

    poserTroncons(distance, themePour, vue.brume ? Math.min(VUE, vue.brume * 2.2) : VUE);

    // ---- Le vaisseau ----
    const xv = p ? xVoie(p.x) : 0;
    const ecart = p ? p.voie - p.x : 0;
    const vitesse = p ? p.vitesse : 14;
    vaisseau.racine.position.set(xv, Mo.HAUTEUR_VOL + Math.sin(temps * 2.4) * 0.035, 0);
    vaisseau.corps.rotation.set(-0.02 - borne((vitesse - 30) / 60) * 0.03, -ecart * 0.16, -ecart * 0.75);
    if (cineFin?.type === 'victoire') vaisseau.corps.rotation.z += Math.PI * 2 * doux((tFin - 1.15) / 0.6) + Math.sin(Math.min(tFin, 1.15) * 2.7) * 0.22;
    if (cineFin?.type === 'defaite') vaisseau.corps.rotation.z += Math.sin(tFin * 9) * 0.06 * (1 - borne(tFin / 1.3));
    const nb = p ? p.boucliers : 4;
    vaisseau.emetteurs.forEach((m, k) => (m.visible = k < nb));
    const voulue = 0.9 + borne(vitesse / 70) * 0.9 + boost * 1.6;
    vaisseau.flammes.forEach((f, k) => {
      flammesLongueur[k] += (voulue - flammesLongueur[k]) * borne(dt * 6);
      const len = flammesLongueur[k] * (0.92 + 0.08 * Math.sin(temps * 40 + k * 2));
      f.m.scale.set(1 + boost * 0.3, 1 + boost * 0.3, len);
      f.f.couleur = (uVaisseau.uAccent.value as number[]).map((v, i) => v * (1.4 + boost) + (boost ? (uVaisseau.uAccent2.value as number[])[i] * 0.8 : 0));
      f.f.force = 1.1 + boost * 0.7;
    });
    // Le bouclier : visible quand un choc vient d'être encaissé (rouge) ou pendant l'Overdrive (sa couleur).
    const invincible = p ? p.invincible : 0;
    if (alerte > 0.05) {
      vaisseau.bulleEtat.couleur = [1.6, 0.25, 0.18];
      vaisseau.bulleEtat.force = alerte * 1.6;
    } else if (boost) {
      vaisseau.bulleEtat.couleur = (uVaisseau.uAccent2.value as number[]).map((v) => v * 1.2);
      vaisseau.bulleEtat.force = 0.32 + 0.12 * Math.sin(temps * 9);
    } else if (invincible > 0) {
      vaisseau.bulleEtat.couleur = [0.6, 0.85, 1.4];
      vaisseau.bulleEtat.force = 0.45 + 0.35 * Math.sin(temps * 22);
    } else vaisseau.bulleEtat.force = 0;
    vaisseau.bulle.visible = vaisseau.bulleEtat.force > 0.02 && cineFin?.type !== 'victoire';

    // La traînée.
    accTrainee += dt;
    if (accTrainee > 0.1) accTrainee = 0.1;
    while (accTrainee >= 1 / 60) {
      traces.unshift(xv);
      accTrainee -= 1 / 60;
    }
    traces[0] = xv;
    traces.length = POINTS_TRAINEE;
    const coulTrainee = uVaisseau.uAccent.value as number[];
    for (const r of rubans) {
      for (let i = 0; i < POINTS_TRAINEE; i++) {
        const t = i / (POINTS_TRAINEE - 1);
        const z = 1.5 + i * (0.32 + vitesse * 0.006);
        const x = (traces[i] ?? xv) + 0.27 * r.s;
        const w = 0.11 * (1 - t) + 0.02;
        const y = Mo.HAUTEUR_VOL - 0.04;
        r.position.set([x - w, y, z, x + w, y, z], i * 6);
        const a = (1 - t) ** 1.6 * (0.55 + boost * 0.6);
        r.couleur.set([coulTrainee[0] * a, coulTrainee[1] * a, coulTrainee[2] * a, coulTrainee[0] * a, coulTrainee[1] * a, coulTrainee[2] * a], i * 6);
      }
      r.geom.attributes.position.needsUpdate = true;
      r.geom.attributes.couleur.needsUpdate = true;
    }

    // ---- La caméra ----
    const c = cadrer(vue.l, vue.h, monde.uBoost.value, vitesse, dt);
    let pos: number[];
    let cible: number[];
    let roulis = 0;
    if (p) {
      cam.x += (xv * 0.5 - cam.x) * borne(dt * 5);
      cam.roulis += (-ecart * 0.045 - cam.roulis) * borne(dt * 6);
      pos = [cam.x, c.hauteur, c.recul];
      cible = [cam.x * 0.6 + xv * 0.25, 0.95, -16];
      roulis = cam.roulis;
    } else {
      // Les menus : la caméra tourne lentement autour du vaisseau, qui avance au ralenti
      // (visé un peu au-dessus de lui : il reste visible sous le titre et les commandes).
      const a = Math.sin(temps * 0.11) * 0.75 + 0.35;
      pos = [Math.sin(a) * 8.5, 2.6 + Math.sin(temps * 0.23) * 0.5, Math.cos(a) * 8.5 - 1];
      cible = [0, vue.l < vue.h ? 4.9 : 3.35, -3];
    }
    // Les mouvements de cinéma de l'ouverture et de la fermeture.
    let expoCine = 1;
    if (cine) {
      const t = (performance.now() - cine.t0) / 1000;
      if (cine.type === 'entree') {
        const k = borne(t / 1.5);
        const e = 1 - (1 - k) ** 3;
        const p0 = [xv, 1.45, 2.4];
        const c0 = [xv, 1.1, -40];
        pos = pos.map((v, i) => p0[i] + (v - p0[i]) * e);
        cible = cible.map((v, i) => c0[i] + (v - c0[i]) * e);
        camera.perspective({ fov: 92 + (cam.fov - 92) * e });
        expoCine = 1 + (1 - e) * 0.8;
        if (k >= 1) cine = null;
      } else if (cine.type === 'sortie') {
        const k = borne(t / 0.62);
        const e = k * k;
        const p1 = [xv, Mo.HAUTEUR_VOL + 0.55, 1.7];
        const c1 = [xv, Mo.HAUTEUR_VOL + 0.1, -0.3];
        pos = pos.map((v, i) => v + (p1[i] - v) * e * 0.85);
        cible = cible.map((v, i) => v + (c1[i] - v) * e);
        camera.perspective({ fov: cam.fov * (1 - 0.3 * e) });
        expoCine = 1 + e * 1.5;
        uVaisseau.uCoeur.value = (uVaisseau.uCoeur.value as number[]).map((v) => v * (1 + e * 6));
      }
    }
    if (cineFin && p) {
      const t = tFin;
      const orbite = (a: number, R: number, hh: number) => [xv + Math.sin(a) * R, Mo.HAUTEUR_VOL + hh, Math.cos(a) * R];
      if (cineFin.type === 'victoire') {
        let a: number, R: number, hh: number, vise: number[], fov: number;
        if (t < 1.15) {
          const k = doux(t / 1.15);
          a = k * 1.05;
          R = 7.4 - 2.2 * k;
          hh = 2.47 - 1.37 * k;
          vise = [xv, Mo.HAUTEUR_VOL + 0.2, -1.5 - 14 * (1 - k)];
          fov = cam.fov + (46 - cam.fov) * k;
        } else if (t < 2.25) {
          const k = doux((t - 1.15) / 1.1);
          a = 1.05 * (1 - k);
          R = 5.2 + 3.8 * k;
          hh = 1.1 + 1.5 * k;
          vise = [xv, Mo.HAUTEUR_VOL + 0.2 + 0.4 * k, -1.5 - 20 * k];
          fov = 46 + 50 * k;
        } else {
          a = 0;
          R = 9;
          hh = 2.6;
          vise = [xv, Mo.HAUTEUR_VOL + 0.6, -24];
          fov = 96;
        }
        pos = orbite(a, R, hh);
        cible = vise;
        roulis = Math.sin(a) * 0.12;
        camera.perspective({ fov });
        // La porte d'arrivée : elle approche, on la traverse dans un éclair blanc.
        construirePorte();
        porte.visible = t < 3.6;
        porte.position.set(0, 0, -(finale.sPorte - distance));
        if (!finale.eclair && finale.sPorte - distance < -6) {
          finale.eclair = true;
          blanc = 1;
          exposition.eclat = 1.8;
        }
      } else {
        const k = doux(t / 1.3);
        pos = [pos[0] * (1 - k) + xv * 0.3 * k, pos[1] + 2.4 * k, pos[2] + 4.5 * k];
        cible = [cible[0], cible[1] - 0.4 * k, cible[2] + 6 * k];
        expoCine = 1 - 0.3 * k;
      }
    }
    camera.position.set(...plier(pli, pos[0], pos[1], pos[2]));
    camera.lookAt(plier(pli, cible[0], cible[1], cible[2]));
    camera.rotation.z += roulis + pli.inclinaison * (p ? 0.6 : 0.3);
    monde.uExposition.value *= expoCine;
    if (secousse > 0 && vue.secousses && !vue.reduit) {
      camera.position.x += (Math.random() - 0.5) * secousse * 0.35;
      camera.position.y += (Math.random() - 0.5) * secousse * 0.25;
    }
    secousse = Math.max(0, secousse - dt * 3.5);
    avancerTrafic(dt);
    montrerLointain(themeIci);

    // ---- Les objets, le boss ----
    if (p && p !== partiePreparee) prechauffer(p);
    if (aPreparer.length) aPreparer.shift()!();
    // En survie, le monde suivant se prépare 300 m avant son entrée.
    if (p?.mode === 'infini') {
      const suivant = themePour(Math.floor((distance + 300) / TRONCON));
      if (suivant !== themeIci) for (let v = 0; v < kitDe(suivant).variantes; v++) if (!geos.has(`troncon-${suivant}-${v}:s`)) aPreparer.push(() => void geoTroncon(suivant, v));
    }
    // Les trous de la piste : les couloirs effondrés entre la caméra et la portée de vue.
    let nTrous = 0;
    if (p)
      for (const o of p.objets) {
        if (o.type !== 'faille' || nTrous >= trous.length) continue;
        const debut = o.pos - distance,
          fin = debut + (o.longueur ?? 0);
        if (fin < -12 || debut > p.apparition + 2) continue;
        for (const voie of o.voies) if (nTrous < trous.length) trous[nTrous++].value = [xVoie(voie), Mo.VOIE * 0.5 - 0.06, -debut, -fin];
      }
    for (let i = nTrous; i < trous.length; i++) trous[i].value = [0, 0, 0, 0];
    if (p) {
      const portee = vue.brume ? Math.min(p.apparition, vue.brume * 1.25) : p.apparition;
      pObjet.uniforms.uBrume.value = [Math.max(12, portee - 34), portee + 4];
      // Pendant la séquence de victoire, la piste est dégagée : rien ne passe devant la caméra qui tourne.
      if (cineFin?.type === 'victoire') for (const [cle, v] of visuels) rendre(cle, v);
      else placerObjets(p, temps, distance, dt);
    } else for (const [cle, v] of visuels) rendre(cle, v);
    if (p?.boss && vue.theme && (vue.theme === 'sentinelle' || vue.theme === 'singularite')) {
      if (!boss || boss.genre !== vue.theme) {
        boss?.racine.setParent(null);
        boss = creerBoss(vue.theme);
      }
      const couleur = [[0.59, 0.75, 1], [0.75, 0.59, 1], [1, 0.67, 0.47], [1, 0.96, 0.92]][Math.min(3, p.boss.phase - 1)] as RGB;
      boss.etat.coeur = lin(couleur).map((v) => v * (0.7 + impactBoss * 1.6));
      boss.etat.impact = impactBoss * 0.8;
      boss.etat.emission = 0.32 + impactBoss * 0.7;
      boss.racine.position.set(0, 13 + Math.sin(temps * 0.8) * 0.6, -150);
      boss.racine.scale.set(1.7);
      boss.racine.rotation.z = Math.sin(temps * 0.3) * 0.05;
      boss.tournant.forEach((t, k) => {
        if (boss!.genre === 'sentinelle') t.rotation.z = temps * (0.35 + p.boss!.phase * 0.18);
        else t.rotation.set(temps * (0.2 + k * 0.13), temps * (0.31 - k * 0.07), k * 0.6);
      });
    } else if (boss) {
      boss.racine.setParent(null);
      boss = null;
    }
    impactBoss = Math.max(0, impactBoss - dt * 3);

    // ---- Les effets ----
    for (const o of ondes) {
      if (o.e.vie <= 0) {
        o.m.visible = false;
        continue;
      }
      o.e.vie -= dt * (o.e.capture ? 3.6 : 2.2);
      o.m.visible = true;
      if (o.e.capture) {
        // L'onde de collecte : petite, rapide, à l'endroit du fragment.
        const s = 0.3 + (1 - o.e.vie) * 1.4;
        o.m.position.set(o.e.x, 1.0, o.e.z);
        o.m.scale.set(s, s, s);
      } else {
        const s = 0.9 + (1 - o.e.vie) * 3.2;
        o.m.position.set(o.e.x, Mo.HAUTEUR_VOL, -0.4 - (1 - o.e.vie) * 2);
        o.m.scale.set(s, s * 0.8, s);
      }
    }
    // Les fragments aspirés par le vaisseau.
    reduitCourant = vue.reduit;
    const noyau = [xv, Mo.HAUTEUR_VOL + 0.3, 0.35];
    for (const c2 of captures) {
      const e = c2.etat;
      if (e.t >= 1) continue;
      e.t = Math.min(1, e.t + dt / 0.2);
      const k = e.t * e.t;
      c2.racine.position.set(e.depart[0] + (noyau[0] - e.depart[0]) * k, e.depart[1] + (noyau[1] - e.depart[1]) * k, e.depart[2] + (noyau[2] - e.depart[2]) * k);
      c2.racine.scale.set(1 - 0.85 * k);
      c2.racine.rotation.y += dt * 14;
      e.emission = 1 + 2.5 * e.t;
      if (e.t >= 1) {
        c2.racine.visible = false;
        flashCoeur = 1;
        if (e.cible && !vue.reduit) traineesHud.push({ t0: performance.now(), cible: e.cible, couleur: e.couleur });
      }
    }
    flashCoeur = Math.max(0, flashCoeur - dt * 3.2);
    if (flashCoeur > 0) uVaisseau.uCoeur.value = (uVaisseau.uCoeur.value as number[]).map((v) => v * (1 + flashCoeur * 2.5));
    // Les particules.
    for (let i = 0; i < N_PART; i++) {
      if (part.vie[i] <= 0) {
        part.col[i * 4 + 3] = 0;
        continue;
      }
      part.vie[i] -= dt;
      part.vit[i * 3 + 1] -= dt * 6;
      part.pos[i * 3] += part.vit[i * 3] * dt;
      part.pos[i * 3 + 1] += part.vit[i * 3 + 1] * dt;
      part.pos[i * 3 + 2] += part.vit[i * 3 + 2] * dt;
      part.col[i * 4 + 3] = borne(part.vie[i] * 1.6);
    }
    geoPart.attributes.position.needsUpdate = true;
    geoPart.attributes.couleur.needsUpdate = true;
    // La poussière de vitesse : des grains qui filent le long de la piste.
    const pv = vue.reduit ? 0 : 1;
    const ac = monde.uAccent.value as number[];
    for (let i = 0; i < N_POUSS; i++) {
      let z = pouss.pos[i * 3 + 2] + vitesse * dt * (1 + monde.uBoost.value * 0.6);
      if (z > 8) {
        z -= 128;
        pouss.pos[i * 3] = (Math.random() - 0.5) * 40;
        if (Math.abs(pouss.pos[i * 3]) < 5) pouss.pos[i * 3] += Math.sign(pouss.pos[i * 3] || 1) * 5;
        pouss.pos[i * 3 + 1] = Math.random() * 14 - 3;
      }
      pouss.pos[i * 3 + 2] = z;
      const a = pv * lisse(-120, -60, z) * (0.25 + monde.uBoost.value * 0.5) * (p ? 1 : 0.4);
      pouss.col.set([ac[0] * a + 0.3 * a, ac[1] * a + 0.3 * a, ac[2] * a + 0.3 * a, 1], i * 4);
    }
    geoPouss.attributes.position.needsUpdate = true;
    geoPouss.attributes.couleur.needsUpdate = true;
    const boostV = monde.uBoost.value;
    const longueurTrait = borne(vitesse / 80) * 2.2 * (1 + boostV * 2.2);
    for (let i = 0; i < N_TRAITS; i++) {
      let z = vitTraits.base[i * 3 + 2] + vitesse * dt;
      if (z > 10) z -= 150;
      vitTraits.base[i * 3 + 2] = z;
      const x = vitTraits.base[i * 3],
        y = vitTraits.base[i * 3 + 1];
      vitTraits.pos.set([x, y, z, x, y, z - longueurTrait], i * 6);
      const a = pv * (p ? 1 : 0) * lisse(-140, -70, z) * (1 - lisse(2, 10, z)) * (0.1 + borne((vitesse - 30) / 60) * 0.25 + boostV * 0.55);
      vitTraits.col.set([ac[0] * a + 0.25 * a, ac[1] * a + 0.25 * a, ac[2] * a + 0.25 * a, 1, 0, 0, 0, 0], i * 8);
    }
    geoTraits.attributes.position.needsUpdate = true;
    geoTraits.attributes.couleur.needsUpdate = true;
    pPoints.uniforms.uEchelle.value = vue.h * 0.045;

    // Le ciel suit la caméra ; ses éclairs (tempête).
    if (paletteCourante?.eclairs && !vue.reduit) {
      eclair = Math.max(0, eclair - dt * 3);
      if (Math.random() < dt * 0.3) eclair = 1;
    } else eclair = 0;
    pCiel.uniforms.uEclair.value = eclair;
    camera.updateMatrixWorld();
    vueSansTranslation.copy(camera.viewMatrix);
    vueSansTranslation[12] = vueSansTranslation[13] = vueSansTranslation[14] = 0;
    inverse.multiply(camera.projectionMatrix, vueSansTranslation).inverse();
    pCiel.uniforms.uInverse.value = inverse;

    renderer.render({ scene, camera });

    // ---- Par-dessus : les gains, l'alerte, le vignettage ----
    ctx.clearRect(0, 0, vue.l, vue.h);
    ctx.font = `600 ${Math.max(14, vue.l * 0.012)}px Geist Variable, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const t of textes) {
      t.vie -= dt * 1.3;
      t.y += dt * 1.6;
      if (t.vie <= 0) continue;
      const e = projeter(t.x, t.y, t.z, vue.l, vue.h);
      ctx.fillStyle = `rgba(${t.couleur}, ${borne(t.vie * 1.5).toFixed(3)})`;
      ctx.fillText(t.texte, e.x, e.y);
    }
    for (let i = textes.length - 1; i >= 0; i--) if (textes[i].vie <= 0) textes.splice(i, 1);
    if (alerte > 0.01) {
      const rouge = ctx.createRadialGradient(vue.l / 2, vue.h * 0.55, vue.h * 0.4, vue.l / 2, vue.h * 0.55, vue.h * 0.95);
      rouge.addColorStop(0, 'rgba(255, 40, 40, 0)');
      rouge.addColorStop(1, `rgba(255, 40, 40, ${(alerte * 0.32).toFixed(3)})`);
      ctx.fillStyle = rouge;
      ctx.fillRect(0, 0, vue.l, vue.h);
    }
    alerte = Math.max(0, alerte - dt * 2.4);
    // La collecte : un trait d'énergie file du vaisseau jusqu'à la jauge d'Overdrive.
    if (traineesHud.length) {
      const depart = projeter(xv, Mo.HAUTEUR_VOL + 0.3, 0.35, vue.l, vue.h);
      const maintenant = performance.now();
      for (let i = traineesHud.length - 1; i >= 0; i--) {
        const tr = traineesHud[i];
        const k = (maintenant - tr.t0) / 330;
        if (k >= 1) {
          traineesHud.splice(i, 1);
          continue;
        }
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const queue = Math.max(0, e - 0.28);
        // Une courbe : le trait part vers le haut avant de rejoindre la jauge.
        const pt = (t: number) => {
          const mx = (depart.x + tr.cible.x) / 2,
            my = Math.min(depart.y, tr.cible.y) - vue.h * 0.12;
          return { x: (1 - t) ** 2 * depart.x + 2 * (1 - t) * t * mx + t * t * tr.cible.x, y: (1 - t) ** 2 * depart.y + 2 * (1 - t) * t * my + t * t * tr.cible.y };
        };
        const tete = pt(e),
          bout = pt(queue);
        const grad = ctx.createLinearGradient(bout.x, bout.y, tete.x, tete.y);
        grad.addColorStop(0, `rgba(${tr.couleur}, 0)`);
        grad.addColorStop(1, `rgba(${tr.couleur}, ${(0.9 * (1 - k * 0.4)).toFixed(3)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.shadowColor = `rgba(${tr.couleur}, 0.9)`;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        for (let s = 0; s <= 10; s++) {
          const q = pt(queue + ((e - queue) * s) / 10);
          if (s === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
        const halo = ctx.createRadialGradient(tete.x, tete.y, 0, tete.x, tete.y, 14);
        halo.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
        halo.addColorStop(0.35, `rgba(${tr.couleur}, 0.7)`);
        halo.addColorStop(1, `rgba(${tr.couleur}, 0)`);
        ctx.shadowBlur = 0;
        ctx.fillStyle = halo;
        ctx.fillRect(tete.x - 14, tete.y - 14, 28, 28);
      }
      ctx.shadowBlur = 0;
    }
    // La fermeture : des traînées de lumière convergent vers le noyau du vaisseau.
    if (cine?.type === 'sortie') {
      const e = borne((performance.now() - cine.t0) / 620);
      const centre = projeter(xv, Mo.HAUTEUR_VOL + 0.1, -0.2, vue.l, vue.h);
      const R = Math.hypot(vue.l, vue.h) * 0.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 44; i++) {
        const hsh = (Math.sin(i * 91.7) * 43758.5453) % 1;
        const ang = (i / 44) * Math.PI * 2 + hsh;
        const r0 = R * (1 - e) * (0.7 + 0.3 * Math.abs(hsh)) + 20;
        const r1 = r0 * (0.45 + 0.25 * Math.abs(hsh));
        ctx.strokeStyle = `rgba(190, 240, 255, ${(0.75 * e).toFixed(3)})`;
        ctx.lineWidth = 1.2 + 1.6 * e;
        ctx.beginPath();
        ctx.moveTo(centre.x + Math.cos(ang) * r0, centre.y + Math.sin(ang) * r0);
        ctx.lineTo(centre.x + Math.cos(ang) * r1, centre.y + Math.sin(ang) * r1);
        ctx.stroke();
      }
    }
    if (blanc > 0.01) {
      ctx.fillStyle = `rgba(240, 248, 255, ${(Math.min(1, blanc) * 0.9).toFixed(3)})`;
      ctx.fillRect(0, 0, vue.l, vue.h);
      blanc = Math.max(0, blanc - dt * 1.6);
    }
    const vignette = ctx.createRadialGradient(vue.l / 2, vue.h * 0.5, vue.h * 0.45, vue.l / 2, vue.h * 0.5, vue.h * 1.05);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, vue.l, vue.h);
  }

  // ==========================================================================
  // LES APERÇUS DES MONDES ET LE GARAGE
  // ==========================================================================
  const sortieApercu = document.createElement('canvas');
  const ctxApercu = sortieApercu.getContext('2d')!;
  const apercus = new Map<string, string>();
  function apercu(theme: Theme, l: number, h: number): string | null {
    const cle = `${theme}-${l}x${h}`;
    if (apercus.has(cle)) return apercus.get(cle)!;
    if (!taille.l) return null;
    const garde = copierPalette();
    const pal = kitDe(theme).palette;
    appliquerPalette(pal, 1);
    monde.uExposition.value = pal.exposition;
    monde.uIntensite.value = 0.3;
    const sauves = [...troncons.entries()];
    for (const [, t] of troncons) t.racine.setParent(null);
    troncons.clear();
    poserTroncons(30, () => theme, 220);
    for (const [cle2, v] of visuels) rendre(cle2, v);
    const pliPhoto = creerPli();
    majPli(pliPhoto, 330, theme, 0.9, 99);
    poserPli(pliPhoto);
    const pliAvant = { ...pli };
    Object.assign(pli, pliPhoto);
    const ancien = lointainAffiche;
    vaisseau.racine.position.set(0, Mo.HAUTEUR_VOL, 0);
    vaisseau.corps.rotation.set(0, 0, 0);
    camera.perspective({ fov: 50, aspect: l / h });
    camera.position.set(...plier(pli, 3.6, 2.2, 6.4));
    camera.lookAt(plier(pli, -0.6, 1.6, -14));
    camera.updateMatrixWorld();
    montrerLointain(theme);
    vueSansTranslation.copy(camera.viewMatrix);
    vueSansTranslation[12] = vueSansTranslation[13] = vueSansTranslation[14] = 0;
    inverse.multiply(camera.projectionMatrix, vueSansTranslation).inverse();
    pCiel.uniforms.uInverse.value = inverse;
    const lp = Math.min(l, toile.width),
      hp = Math.min(h, toile.height);
    renderer.render({ scene, camera, target: { buffer: null, width: lp, height: hp, depth: true } as never });
    sortieApercu.width = lp;
    sortieApercu.height = hp;
    ctxApercu.drawImage(toile, 0, toile.height - hp, lp, hp, 0, 0, lp, hp);
    const url = sortieApercu.toDataURL('image/jpeg', 0.84);
    apercus.set(cle, url);
    // On remet la scène comme elle était (l'image suivante la recalcule de toute façon).
    for (const [, t] of troncons) t.racine.setParent(null);
    troncons.clear();
    for (const [i, t] of sauves) troncons.set(i, t);
    lointainAffiche?.setParent(null);
    lointainAffiche = ancien;
    ancien?.setParent(scene);
    restaurerPalette(garde);
    appliquerPalette(paletteCourante ?? pal, 0);
    Object.assign(pli, pliAvant);
    poserPli(pli);
    return url;
  }

  // Le garage : le vaisseau sur une plateforme, qui tourne.
  const sceneGarage = new Transform();
  const vaisseauGarage = creerVaisseau(sceneGarage);
  vaisseauGarage.bulle.visible = false;
  const socle = new Assembleur();
  socle.cylindre(2.4, 2.6, -0.3, 0, 48, Mo.M.metalSombre).cylindre(2.15, 2.15, 0, 0.012, 48, Mo.M.accent).cylindre(2.05, 2.05, 0.012, 0.02, 48, Mo.M.metalMoyen);
  maillage(socle.geometrie(gl), pMonde, sceneGarage);
  const cielGarage = new Mesh(gl, { geometry: new Triangle(gl), program: pCiel, frustumCulled: false, renderOrder: -10 });
  cielGarage.setParent(sceneGarage);
  const cameraGarage = new Camera(gl, { fov: 32, near: 0.1, far: 9000 });
  function garage(cible: CanvasRenderingContext2D, l: number, h: number, eq: Equipement, temps: number) {
    if (!taille.l || !l || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lp = Math.min(Math.round(l * dpr), toile.width),
      hp = Math.min(Math.round(h * dpr), toile.height);
    equiper(eq, temps);
    vaisseauGarage.racine.position.set(0, 0.55 + Math.sin(temps * 1.6) * 0.05, 0);
    vaisseauGarage.racine.rotation.y = temps * 0.5;
    vaisseauGarage.corps.rotation.set(0, 0, Math.sin(temps * 0.9) * 0.08);
    vaisseauGarage.flammes.forEach((f) => {
      f.m.scale.set(1, 1, 0.9 + 0.1 * Math.sin(temps * 30));
      f.f.couleur = (uVaisseau.uAccent.value as number[]).map((v) => v * 1.5);
      f.f.force = 1;
    });
    cameraGarage.perspective({ fov: 30, aspect: lp / hp });
    cameraGarage.position.set(0, 2.4, 6.8);
    cameraGarage.lookAt([0, 0.45, 0]);
    cameraGarage.updateMatrixWorld();
    vueSansTranslation.copy(cameraGarage.viewMatrix);
    vueSansTranslation[12] = vueSansTranslation[13] = vueSansTranslation[14] = 0;
    inverse.multiply(cameraGarage.projectionMatrix, vueSansTranslation).inverse();
    pCiel.uniforms.uInverse.value = inverse;
    poserPli(pliDroit);
    renderer.render({ scene: sceneGarage, camera: cameraGarage, target: { buffer: null, width: lp, height: hp, depth: true } as never });
    poserPli(pli);
    cible.clearRect(0, 0, l, h);
    cible.drawImage(toile, 0, toile.height - hp, lp, hp, 0, 0, l, h);
  }

  return {
    troisD: true,
    eclater: (voie, couleur, nombre = 12) => lancerParticules(xVoie(voie), Mo.HAUTEUR_VOL, -0.6, rgb(couleur), nombre),
    flotter: (voie, texte, couleur = '236, 244, 255') => textes.push({ texte, x: xVoie(voie), y: 1.9, z: -0.8, vie: 1, couleur, dy: 0 }),
    anneau: (voie, couleur = '170, 225, 255') => {
      const o = ondes.find((x) => x.e.vie <= 0) ?? ondes[0];
      o.e.vie = 1;
      o.e.x = xVoie(voie);
      o.e.couleur = lin(rgb(couleur)).map((v) => v * 1.6);
    },
    secouer: (f) => (secousse = Math.max(secousse, f)),
    flasher: (_c, f = 0.35) => (exposition.eclat = Math.max(exposition.eclat, f)),
    alerter: () => (alerte = 1),
    toucherBoss: () => (impactBoss = 1),
    dessiner,
    apercu,
    garage,
    cinematique: (type) => {
      cine = { type, t0: performance.now() };
      if (type === 'victoire' || type === 'defaite') {
        finale.victoire = type === 'victoire';
        finale.eclair = false;
        // La porte est posée là où le vaisseau passera vers 2,5 s (le monde ralentit, puis accélère).
        finale.sPorte = derniere.distance + derniere.vitesse * 3.56;
      }
    },
    capter: (voie, couleur, cible) => {
      const c = rgb(couleur);
      const x = xVoie(voie);
      // Le fragment aspiré.
      const cap = captures.find((k) => k.etat.t >= 1) ?? captures[0];
      cap.etat.t = 0;
      cap.etat.depart = [x, 1.0, -0.9];
      cap.etat.cible = cible ?? null;
      cap.etat.couleur = couleur;
      cap.etat.coeur = couleur.startsWith('255') ? lin([1, 0.84, 0.47]) : [1, 1, 1];
      cap.racine.visible = true;
      cap.racine.position.set(x, 1.0, -0.9);
      cap.racine.scale.set(1);
      // L'onde de collecte.
      const o = ondes.find((k) => k.e.vie <= 0) ?? ondes[0];
      o.e.vie = 1;
      o.e.capture = true;
      o.e.x = x;
      o.e.z = -0.9;
      o.e.couleur = lin(c).map((v) => v * 0.9);
      // Des étincelles : quelques-unes s'échappent, d'autres convergent vers le vaisseau.
      lancerParticules(x, 1.0, -0.9, c, reduitCourant ? 3 : 6, 4);
      if (!reduitCourant)
        for (let k = 0; k < 7; k++) {
          const i = part.suivant;
          part.suivant = (part.suivant + 1) % N_PART;
          const a = (k / 7) * Math.PI * 2;
          const px = x + Math.cos(a) * 0.9,
            py = 1.0 + Math.sin(a) * 0.9;
          part.pos.set([px, py, -0.9], i * 3);
          part.vit.set([(x - px) * 4, (Mo.HAUTEUR_VOL + 0.3 - py) * 4 + 2, 5], i * 3);
          const l = lin(c);
          part.col.set([l[0] * 2.4, l[1] * 2.4, l[2] * 2.4, 1], i * 4);
          part.taille[i] = 2.4;
          part.vie[i] = 0.26;
        }
    },
    centreVaisseau: () => projeter(vaisseau.racine.position.x, Mo.HAUTEUR_VOL + 0.1, -0.2, taille.l || window.innerWidth, taille.h || window.innerHeight),
  };
}
