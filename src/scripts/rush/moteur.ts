// PORTAL RUSH — LE MOTEUR (règles, version 2)
//
// Toute la règle du jeu, sans rien dessiner : on peut donc la vérifier seule.
//
// Le parcours est une ligne droite ; « distance » est le chemin parcouru. Chaque
// objet (obstacle, fragment, portail) a une position fixe sur ce parcours. Quand
// il atteint le vaisseau, on regarde la voie : choc, esquive, Perfect Dodge ou
// ramassage. Un couloir de piste instable bloque ses voies sur toute sa longueur.
//
// LA COURBE (voir equilibrage.ts). La vitesse ne dépend que de la distance (une
// accélération constante dans le temps) ; l'écart, la réaction garantie et la
// complexité suivent leurs propres courbes. Toute la génération ne dépend donc
// que de la position et du tirage : avec la même graine, le parcours est le même
// pour tout le monde (défi du jour), quoi que fasse le joueur.
//
// LE GÉNÉRATEUR travaille par MOTIFS (une courte séquence de rangées pensée
// pour un geste : escalier, zigzag, couloir, essaim…), choisis selon la phase du
// niveau et dosés par la complexité. Il garde l'ensemble des voies où le joueur
// peut se trouver à chaque rangée, et place chaque rangée assez loin pour que
// l'une au moins de ses voies libres reste atteignable : temps de réaction, plus
// un changement de voie (0,12 s) par voie à traverser. En Pilot et Ace, il garantit
// en plus une sortie depuis n'importe quelle voie sûre ; en Expert et Nightmare,
// il peut exiger de planifier (une seule bonne voie, toujours visible à temps).
// Aucun obstacle n'est donc impossible, et le jeu ne triche pas selon le joueur.

import { BOSS, COMBO, DEPLACEMENT, INFINI, JAUGE, OVERDRIVE, OVERDRIVE_COMBO, POINTS, PROFILS, RANGS, apparition, type Difficulte, type Profil } from './equilibrage';
import { DEFI, DIFFICULTE_DEFI, NIVEAUX, VEHICULES, VOIES, graineDuJour, hasardGraine, niveauInfini, type Famille, type Mode, type Niveau, type Objectif, type Phase, type Vehicule } from './donnees';

// Les obstacles mobiles de la V4 (16 octobre 2026) ont chacun leur dessin et leur mouvement à l'écran, mais
// obéissent à la même règle que les autres : leur configuration finale est figée assez tôt pour réagir.
//   drone      des drones de patrouille qui glissent sur le côté avant de se poser sur leur voie ;
//   porte      une structure mécanique qui se referme : ses battants ferment une voie de plus en approchant ;
//   rotor      une structure tournante dont l'ouverture tourne, puis s'arrête ;
//   chute      un bloc qui tombe du ciel sur sa voie (sa voie est connue dès qu'il apparaît) ;
//   eclaireur  un vaisseau ennemi qui fonce vers le joueur (sa voie est connue dès qu'il apparaît).
export type TypeObjet = 'bloc' | 'debris' | 'laser' | 'mobile' | 'faille' | 'portail' | 'fragment' | 'dore' | 'noyau' | 'frappe' | 'drone' | 'porte' | 'rotor' | 'chute' | 'eclaireur';
const OBSTACLES: TypeObjet[] = ['bloc', 'debris', 'laser', 'mobile', 'faille', 'frappe', 'drone', 'porte', 'rotor', 'chute', 'eclaireur'];
export const estObstacle = (t: TypeObjet) => OBSTACLES.includes(t);

export interface Objet {
  id: number;
  type: TypeObjet;
  /** Sa position sur le parcours (m) : le début, pour un couloir. */
  pos: number;
  /** Les voies qu'il bloque une fois sa configuration figée (ou la voie qu'il occupe). */
  voies: number[];
  /** Couloir de piste instable : la longueur bloquée (m). */
  longueur?: number;
  /** Laser et obstacle mobile : les configurations précédentes, chacune valable tant que l'objet est plus loin que « des » (m). */
  avant?: { des: number; voies: number[] }[];
  /** Distance (m) à partir de laquelle sa configuration finale est figée. */
  fige?: number;
  /** Portail : la voie où il envoie le vaisseau. */
  vers?: number;
  /** Une attaque de boss (frappe, ou obstacle mobile qui balaie). */
  chaud?: boolean;
  /** L'objet de la rangée suivante dans un enchaînement (un trait les relie, pour lire la suite). */
  lie?: number;
  /** Le motif dont il fait partie. */
  motif?: number;
  passe: boolean;
  touche?: boolean;
  detruit?: boolean;
  graine: number;
}

export type TypeEvenement =
  | 'deplacement'
  | 'parfait'
  | 'fragment'
  | 'dore'
  | 'noyau'
  | 'choc'
  | 'portail'
  | 'overdrive'
  | 'fin-overdrive'
  | 'pret'
  | 'detruit'
  | 'boss-touche'
  | 'phase-boss'
  | 'phase'
  | 'motif'
  | 'combo-perdu'
  | 'conseil'
  | 'od-ouvert'
  | 'fin';
export interface Evenement {
  type: TypeEvenement;
  /** Les points gagnés (fragments, esquives, motifs), une phase, des boucliers restants… */
  valeur?: number;
  voie?: number;
}

export interface ObjectifAtteint extends Objectif {
  atteint: boolean;
  /** Où on en est (pour afficher « 9 / 12 »). */
  mesure: number;
}

export interface Resultat {
  /** Le niveau est réussi : parcours fini, vaisseau intact, objectif principal atteint. */
  reussi: boolean;
  /** Le vaisseau est allé au bout (ou a battu le boss). */
  arrive: boolean;
  objectifs: ObjectifAtteint[];
  score: number;
  rang: string;
  note: number;
  fragments: number;
  fragmentsVus: number;
  parfaits: number;
  comboMax: number;
  multiplicateurMax: number;
  motifs: number;
  distance: number;
  temps: number;
  chocs: number;
  portails: number;
  overdrives: number;
}

interface Motif {
  id: number;
  famille: Famille;
  complexite: number;
  fin: number;
  chocs: number;
  regle: boolean;
}

/** Une rangée à poser, telle qu'un motif la décrit (la position est calculée par le générateur). */
interface Etape {
  type: TypeObjet;
  voies: number[];
  /** Écart voulu avant cette rangée, en fraction de l'écart courant entre motifs. */
  ecart: number;
  /** Rangée enchaînée dans un motif : réaction raccourcie (le joueur la voit venir depuis longtemps). */
  chaine?: boolean;
  longueur?: number;
  changeant?: boolean;
  chaud?: boolean;
  portail?: number; // voie d'arrivée
  /** Fragments à poser juste avant la rangée, dans ces voies (dorés si « dore »). */
  fragments?: { voie: number; dore?: boolean; nombre?: number }[];
  noyau?: number;
  /** Ce motif autorise le piège qu'il faut anticiper (une seule bonne voie), même en Pilot et Ace. */
  choix?: boolean;
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const TOUTES = [0, 1, 2];

export class Partie {
  readonly mode: Mode;
  readonly difficulte: Difficulte;
  readonly profil: Profil;
  readonly niveauBase: Niveau;
  readonly graine: number;
  private readonly hasard: () => number;
  /** Le vaisseau piloté, et la durée réelle de ses changements de voie (s). */
  readonly vehicule: Vehicule;
  readonly deplacement: number;

  // ---- L'état visible ----
  distance = 0;
  temps = 0;
  vitesse = 0;
  /** La voie visée (0, 1 ou 2), et la position réelle du vaisseau, qui glisse vers elle. */
  voie = 1;
  x = 1;
  voiePrecedente = 1;
  dernierDeplacement = -10;
  boucliers: number;
  /** Les boucliers au départ (profil et vaisseau). */
  bouclierMax = 1;
  invincible = 0;
  /** Vrai pendant qu'une étape du tutoriel retient le vaisseau (il ne change pas de voie). */
  figee = false;
  /**
   * Le tutoriel (V4) pilote la partie lui-même : le générateur se tait, les objets sont posés par le tutoriel
   * (« placer »), la vitesse est imposée (« vitesseImposee »), un choc ne coûte rien et la partie ne finit jamais seule.
   */
  scriptee = false;
  vitesseImposee: number | null = null;
  /** L'ouverture de la jauge d'Overdrive a été annoncée. */
  private odAnnonce = false;
  score = 0;
  combo = 0;
  comboMax = 0;
  multiplicateurMax = 1;
  /** L'instant de la dernière réussite : le combo s'éteint après « comboDelai ». */
  dernierSucces = 0;
  /** La jauge d'Overdrive (0 à 1). */
  jauge = 0;
  /** Le temps qu'il reste à un Overdrive en cours, ses charges (obstacles qu'il peut briser), son multiplicateur. */
  overdrive = 0;
  charges = 0;
  multOverdrive = 1;
  overdrives = 0;
  fragments = 0;
  fragmentsVus = 0;
  parfaits = 0;
  portails = 0;
  chocs = 0;
  motifsReussis = 0;
  objets: Objet[] = [];
  evenements: Evenement[] = [];
  termine: Resultat | null = null;
  boss: { vie: number; max: number; phase: number; phases: number } | null = null;
  conseil = -1;
  /** La phase du niveau où se trouve le vaisseau. */
  phase = 0;

  // ---- Le générateur ----
  private derniere = 50; //                     position de la dernière rangée posée
  private atteignables = new Set([1]); //       les voies où l'on peut être à cette rangée
  private compteur = 0;
  private motifsPoses = 0;
  private prochainePression = 0;
  private signatures = new Set<number>(); //    les phases qui ont déjà reçu leur motif signature
  private motifs = new Map<number, Motif>();
  /** Jusqu'où (m) une rangée suit de trop près un obstacle mobile pour qu'on exige de l'avoir prévue. */
  private incertainJusqua = 0;

  constructor(mode: Mode, difficulte: Difficulte, niveauId = 1, graine?: number, vehicule?: Vehicule['id']) {
    this.mode = mode;
    this.difficulte = mode === 'defi' ? DIFFICULTE_DEFI : difficulte;
    this.profil = PROFILS[this.difficulte];
    // Le vaisseau : ses vraies différences (le défi du jour se court pour tous avec le même, l'Aube).
    this.vehicule = VEHICULES.find((v) => v.id === (mode === 'defi' ? 'aube' : vehicule)) ?? VEHICULES[0];
    this.deplacement = DEPLACEMENT * this.vehicule.deplacement;
    this.niveauBase = mode === 'campagne' ? NIVEAUX[niveauId - 1] : mode === 'defi' ? DEFI : niveauInfini();
    this.graine = graine ?? (mode === 'defi' ? graineDuJour() : Math.floor(Math.random() * 1e9));
    this.hasard = hasardGraine(this.graine);
    // En survie infinie, une seule vie (V4) ; ailleurs, les boucliers du profil, plus ou moins ceux du vaisseau.
    this.boucliers = mode === 'infini' ? INFINI.boucliers : Math.max(1, this.profil.boucliers + this.vehicule.boucliers);
    this.bouclierMax = this.boucliers;
    if (this.niveauBase.boss) {
      const vie = Math.round(this.niveauBase.boss.vie * BOSS.vie[this.difficulte]);
      this.boss = { vie, max: vie, phase: 1, phases: this.niveauBase.boss.phases };
    }
    this.prochainePression = this.profil.pression.toutesLes;
    this.vitesse = this.vitesseA(0);
  }

  // ==========================================================================
  // LES COURBES (toutes en fonction de la position : voir l'en-tête)
  // ==========================================================================
  private get v0() {
    return this.profil.vitesse.depart * this.niveauBase.vitesse;
  }
  /** La vitesse de base à une position : accélération constante dans le temps, jusqu'au maximum. */
  vitesseA(pos: number): number {
    const a = this.profil.vitesse.acceleration;
    const vmax = this.profil.vitesse.max;
    const v = Math.sqrt(this.v0 * this.v0 + 2 * a * Math.max(0, pos));
    if (v <= vmax || this.mode !== 'infini') return Math.min(vmax, v);
    // Survie (V4) : au-delà du maximum, la vitesse continue de monter, plus doucement, jusqu'au plafond.
    const dmax = (vmax * vmax - this.v0 * this.v0) / (2 * a);
    const s = INFINI.surcroit;
    return Math.min(INFINI.plafond, Math.sqrt(vmax * vmax + 2 * s * Math.max(0, pos - dmax)));
  }
  /** Le temps qu'un joueur met pour atteindre cette position (sans compter les pauses). */
  tempsA(pos: number): number {
    const a = this.profil.vitesse.acceleration;
    const vmax = this.profil.vitesse.max;
    const dmax = (vmax * vmax - this.v0 * this.v0) / (2 * a);
    if (pos <= dmax) return (this.vitesseA(pos) - this.v0) / a;
    if (this.mode === 'infini') {
      const v = this.vitesseA(pos);
      const s = INFINI.surcroit;
      const dplaf = dmax + (INFINI.plafond ** 2 - vmax * vmax) / (2 * s);
      if (pos <= dplaf) return (vmax - this.v0) / a + (v - vmax) / s;
      return (vmax - this.v0) / a + (INFINI.plafond - vmax) / s + (pos - dplaf) / INFINI.plafond;
    }
    return (vmax - this.v0) / a + (pos - dmax) / vmax;
  }
  ecartA(pos: number): number {
    const e = this.profil.ecart;
    return Math.max(e.min, e.depart * this.niveauBase.ecart - e.resserrement * this.tempsA(pos));
  }
  reactionA(pos: number): number {
    const r = this.profil.reaction;
    return Math.max(r.min, r.depart - (r.depart - r.min) * Math.min(1, this.tempsA(pos) / r.sur));
  }
  get complexite(): number {
    const c = this.profil.complexite;
    // (V4) Dans un secteur, la complexité monte aussi avec l'avancée : la fin est plus dure que le début.
    const avancee = this.mode === 'campagne' && Number.isFinite(this.longueur) ? 0.18 * borner(this.derniere / this.longueur, 0, 1) : 0;
    return borner(c.depart + this.niveauBase.complexite + c.parMotif * this.motifsPoses + avancee, 0, c.max);
  }

  // ---- L'Overdrive rare (V4) ----
  /** La jauge peut-elle se remplir ? Pas au départ ; plus jamais après usage. */
  get overdriveOuvert(): boolean {
    if (this.overdrives >= OVERDRIVE.parPartie) return false;
    const seuil = Number.isFinite(this.longueur) ? Math.max(OVERDRIVE.depart.metres, OVERDRIVE.depart.part * this.longueur) : OVERDRIVE.depart.metres;
    return this.boss ? this.avancement >= 0.2 || this.distance >= OVERDRIVE.depart.metres : this.distance >= seuil;
  }
  /** Où en est l'Overdrive : verrouillé (départ), en charge, prêt, actif, ou déjà utilisé. */
  get etatOverdrive(): 'verrouille' | 'charge' | 'pret' | 'actif' | 'utilise' {
    if (this.overdrive > 0) return 'actif';
    if (this.overdrives >= OVERDRIVE.parPartie) return 'utilise';
    if (!this.overdriveOuvert) return 'verrouille';
    return this.jauge >= 1 ? 'pret' : 'charge';
  }
  /** La distance à partir de laquelle la jauge s'ouvre. */
  get seuilOverdrive(): number {
    return Number.isFinite(this.longueur) && !this.boss ? Math.max(OVERDRIVE.depart.metres, OVERDRIVE.depart.part * this.longueur) : OVERDRIVE.depart.metres;
  }
  /** La distance à laquelle les objets apparaissent, à la vitesse en cours. */
  get apparition(): number {
    return apparition(this.vitesse);
  }

  /** La longueur du parcours (Infinity : jusqu'à la chute du boss, ou sans fin). */
  get longueur(): number {
    const l = this.niveauBase.longueur;
    return l > 0 ? l : Infinity;
  }
  /** L'avancement de 0 à 1 : la distance, ou les dégâts faits au boss. */
  get avancement(): number {
    if (this.boss) return 1 - this.boss.vie / this.boss.max;
    return Number.isFinite(this.longueur) ? borner(this.distance / this.longueur, 0, 1) : 0;
  }
  get multiplicateur(): number {
    return Math.min(COMBO.max, 1 + Math.floor(this.combo / COMBO.parCran));
  }
  /** Ce qu'il reste du délai avant que le combo s'éteigne (1 : tout juste nourri ; 0 : éteint). */
  get comboRestant(): number {
    if (this.combo === 0) return 0;
    return borner(1 - (this.temps - this.dernierSucces) / this.profil.comboDelai, 0, 1);
  }
  /** La phase à une position (fraction du parcours, dégâts au boss, ou mètres en survie infinie). */
  phaseA(pos: number): number {
    const phases = this.niveauBase.phases;
    const repere = this.mode === 'infini' ? pos : this.boss ? this.avancement : Number.isFinite(this.longueur) ? pos / this.longueur : 0;
    const i = phases.findIndex((p) => repere < p.fin);
    return i < 0 ? phases.length - 1 : i;
  }
  get phaseCourante(): Phase {
    return this.niveauBase.phases[this.phase];
  }

  // ==========================================================================
  // LES COMMANDES
  // ==========================================================================
  deplacer(sens: -1 | 1): void {
    if (this.figee) return;
    if (this.termine) return;
    const cible = borner(this.voie + sens, 0, VOIES - 1);
    if (cible === this.voie) return;
    this.voiePrecedente = this.voie;
    this.voie = cible;
    this.dernierDeplacement = this.temps;
    this.evenements.push({ type: 'deplacement', voie: cible });
  }

  /** Déclenche l'Overdrive, si la jauge est pleine. Un gros combo le rend plus rentable. */
  declencher(): boolean {
    if (this.termine || this.jauge < 1 || this.overdrive > 0 || !this.overdriveOuvert) return false;
    const o = this.profil.overdrive;
    this.overdrive = o.duree;
    this.charges = o.charges;
    this.multOverdrive = o.multiplicateur + OVERDRIVE_COMBO.bonus * Math.min(1, this.combo / OVERDRIVE_COMBO.combo);
    this.jauge = 0;
    this.overdrives++;
    this.evenements.push({ type: 'overdrive', valeur: this.multOverdrive });
    if (this.boss) this.toucherBoss(BOSS.degats.overdrive);
    return true;
  }

  // ==========================================================================
  // UNE IMAGE DU JEU (pas de temps fixe, choisi par l'interface)
  // ==========================================================================
  avancer(dt: number): void {
    if (this.termine) return;
    this.temps += dt;
    // (L'Overdrive n'accélère pas le vaisseau : la justice des écarts tient toujours.)
    this.vitesse = this.vitesseImposee ?? this.vitesseA(this.distance);
    const pas = this.vitesse * dt;
    this.distance += pas;
    const glisse = dt / this.deplacement;
    this.x += borner(this.voie - this.x, -glisse, glisse);
    this.invincible = Math.max(0, this.invincible - dt);
    if (this.overdrive > 0) {
      this.overdrive -= dt;
      if (this.overdrive <= 0) {
        this.overdrive = 0;
        this.charges = 0;
        this.evenements.push({ type: 'fin-overdrive' });
      }
    }
    if (this.combo > 0 && this.temps - this.dernierSucces > this.profil.comboDelai) {
      this.combo = 0;
      this.evenements.push({ type: 'combo-perdu' });
    }
    this.score += pas * POINTS.metre * this.profil.score * (this.overdrive > 0 ? this.multOverdrive : 1);

    const phase = this.phaseA(this.distance);
    if (phase !== this.phase && !this.scriptee) {
      this.phase = phase;
      this.evenements.push({ type: 'phase', valeur: phase });
    }
    this.tutoriel();
    if (!this.odAnnonce && !this.scriptee && this.overdriveOuvert && this.overdrives === 0) {
      this.odAnnonce = true;
      this.evenements.push({ type: 'od-ouvert' });
    }
    this.genererJusqua(this.distance + this.apparition);

    for (const o of this.objets) {
      if (o.detruit && o.type !== 'faille') continue;
      // Couloir : ses voies sont bloquées tant que le vaisseau est dessus (sauf si l'Overdrive l'a brisé).
      if (o.type === 'faille' && o.longueur) {
        if (!o.touche && !o.detruit && this.distance >= o.pos && this.distance <= o.pos + o.longueur && o.voies.includes(this.voieOccupee)) this.heurter(o);
        if (!o.passe && this.distance > o.pos + o.longueur) {
          o.passe = true;
          this.finirMotif(o);
        }
        continue;
      }
      if (o.passe || o.pos > this.distance) continue;
      o.passe = true;
      this.franchir(o);
      if (this.termine) return;
    }
    this.objets = this.objets.filter((o) => o.pos + (o.longueur ?? 0) - this.distance > -16);

    if (this.scriptee) return;
    if (this.boss ? this.boss.vie <= 0 : this.distance >= this.longueur) this.finir(true);
  }

  /** Le tutoriel pose un objet à « devant » mètres du vaisseau (ses voies finales, ses états d'approche). */
  placer(type: TypeObjet, devant: number, voies: number[], options: { avant?: { des: number; voies: number[] }[]; fige?: number } = {}): Objet {
    const o = this.objet(type, this.distance + devant, voies, estObstacle(type) ? 0 : undefined);
    if (options.avant) o.avant = options.avant;
    if (options.fige !== undefined) o.fige = options.fige;
    return o;
  }
  /** Retire tout ce qui est encore devant le vaisseau (une phase du tutoriel recommence). */
  vider(): void {
    this.objets = this.objets.filter((o) => o.pos < this.distance - 1);
  }

  /** Les voies bloquées par un obstacle quand il est à « z » mètres du vaisseau. */
  voiesA(o: Objet, z: number): number[] {
    if (!o.avant || z <= (o.fige ?? 0)) return o.voies;
    for (const etat of o.avant) if (z > etat.des) return etat.voies;
    return o.voies;
  }

  get voieOccupee(): number {
    return Math.round(this.x);
  }

  private franchir(o: Objet): void {
    const ici = this.voieOccupee;
    if (o.type === 'fragment' || o.type === 'dore' || o.type === 'noyau') {
      if (o.type !== 'noyau') this.fragmentsVus++;
      if (o.voies[0] !== ici) return;
      o.detruit = true;
      if (o.type === 'noyau') {
        const gain = this.reussite(POINTS.dore, JAUGE.dore);
        this.evenements.push({ type: 'noyau', voie: ici, valeur: gain });
        this.toucherBoss(BOSS.degats.noyau);
      } else {
        this.fragments++;
        const dore = o.type === 'dore';
        const gain = this.reussite(dore ? POINTS.dore : POINTS.fragment, dore ? JAUGE.dore : JAUGE.fragment);
        this.evenements.push({ type: dore ? 'dore' : 'fragment', voie: ici, valeur: gain });
      }
      return;
    }
    if (o.type === 'portail') {
      if (o.voies[0] !== ici || o.vers === undefined) return;
      this.voie = o.vers;
      this.x = o.vers;
      this.voiePrecedente = o.vers;
      this.portails++;
      this.evenements.push({ type: 'portail', voie: o.vers });
      return;
    }
    // Un obstacle.
    const bloquees = this.voiesA(o, 0);
    if (bloquees.includes(ici)) this.heurter(o);
    else if (bloquees.includes(this.voiePrecedente) && this.voiePrecedente !== ici && this.temps - this.dernierDeplacement <= this.profil.parfait * this.vehicule.parfait) {
      // Esquivé au tout dernier moment : Perfect Dodge.
      this.parfaits++;
      const gain = this.reussite(POINTS.parfait, JAUGE.parfait);
      this.evenements.push({ type: 'parfait', voie: this.voiePrecedente, valeur: gain });
      if (this.boss && o.chaud) this.toucherBoss(BOSS.degats.parfait);
    }
    this.finirMotif(o);
  }

  /** Un obstacle touché : l'Overdrive le brise s'il lui reste une charge ; sinon, choc. */
  private heurter(o: Objet): void {
    o.touche = true;
    if (this.overdrive > 0 && this.charges > 0) {
      this.charges--;
      o.detruit = true;
      this.score += POINTS.brise * this.profil.score * this.multOverdrive;
      this.evenements.push({ type: 'detruit', voie: this.voieOccupee, valeur: Math.round(POINTS.brise * this.profil.score * this.multOverdrive) });
      if (this.boss) this.toucherBoss(BOSS.degats.brise);
      return;
    }
    if (this.invincible > 0) return;
    if (this.scriptee) {
      this.chocs++;
      this.invincible = 0.6;
      this.evenements.push({ type: 'choc', valeur: this.boucliers });
      return;
    }
    this.boucliers--;
    this.chocs++;
    this.combo = 0;
    // (V4) Un choc fait reculer la jauge d'Overdrive : il faut la mériter d'un bout à l'autre.
    if (this.overdrive <= 0) this.jauge = Math.max(0, this.jauge - JAUGE.choc);
    this.invincible = this.profil.invulnerable;
    if (o.motif !== undefined) {
      const m = this.motifs.get(o.motif);
      if (m) m.chocs++;
    }
    this.evenements.push({ type: 'choc', valeur: this.boucliers });
    if (this.boucliers <= 0) this.finir(false);
  }

  /** Une réussite : le combo monte, la jauge se remplit. Renvoie les points gagnés. */
  private reussite(points: number, jauge: number): number {
    this.combo++;
    this.dernierSucces = this.temps;
    this.comboMax = Math.max(this.comboMax, this.combo);
    this.multiplicateurMax = Math.max(this.multiplicateurMax, this.multiplicateur);
    const gain = Math.round(points * this.multiplicateur * this.profil.score * (this.overdrive > 0 ? this.multOverdrive : 1));
    this.score += gain;
    if (this.overdrive <= 0 && this.overdriveOuvert) {
      const avant = this.jauge;
      this.jauge = Math.min(1, this.jauge + jauge * this.profil.gainOverdrive * this.vehicule.jauge);
      if (avant < 1 && this.jauge >= 1) this.evenements.push({ type: 'pret' });
    }
    return gain;
  }

  /** La dernière rangée d'un motif est passée : sans choc, le motif est réussi (bonus, combo). */
  private finirMotif(o: Objet): void {
    if (o.motif === undefined) return;
    const m = this.motifs.get(o.motif);
    if (!m || m.regle || o.pos + (o.longueur ?? 0) < m.fin) return;
    m.regle = true;
    this.motifs.delete(m.id);
    if (m.chocs > 0) return;
    this.motifsReussis++;
    const gain = this.reussite(POINTS.motif + POINTS.motifComplexite * m.complexite, JAUGE.motif);
    this.evenements.push({ type: 'motif', valeur: gain });
  }

  private toucherBoss(degats: number): void {
    if (!this.boss || this.boss.vie <= 0) return;
    this.boss.vie = Math.max(0, this.boss.vie - degats);
    this.score += POINTS.boss * degats * this.profil.score;
    this.evenements.push({ type: 'boss-touche', valeur: this.boss.vie });
    const phase = Math.min(this.boss.phases, 1 + Math.floor((1 - this.boss.vie / this.boss.max) * this.boss.phases));
    if (phase !== this.boss.phase && this.boss.vie > 0) {
      this.boss.phase = phase;
      this.evenements.push({ type: 'phase-boss', valeur: phase });
    }
  }

  /** Le tutoriel du premier niveau : quatre conseils, au bon moment. */
  private tutoriel(): void {
    if (!this.niveauBase.tutoriel || this.mode !== 'campagne' || this.scriptee) return;
    const etapes = [20, 380, 760, 1150];
    const prochain = this.conseil + 1;
    if (prochain < etapes.length && this.distance >= etapes[prochain]) {
      this.conseil = prochain;
      // (V4 : plus d'Overdrive offert au premier secteur ; il se mérite.)
      this.evenements.push({ type: 'conseil', valeur: prochain });
    }
  }

  private mesurer(o: Objectif): number {
    switch (o.type) {
      case 'fragments':
        return this.fragments;
      case 'parfaits':
        return this.parfaits;
      case 'portails':
        return this.portails;
      case 'combo':
        return this.comboMax;
      case 'chocsMax':
        return this.chocs;
      case 'score':
        return Math.round(this.score);
      case 'boss':
        return this.boss ? Math.round((1 - this.boss.vie / this.boss.max) * 100) : 0;
      default:
        return Math.round(this.distance);
    }
  }
  private atteint(o: Objectif, arrive: boolean): boolean {
    const m = this.mesurer(o);
    switch (o.type) {
      case 'fin':
        return arrive;
      case 'boss':
        return arrive && !!this.boss && this.boss.vie <= 0;
      case 'chocsMax':
        return arrive && m <= o.valeur;
      default:
        return m >= o.valeur;
    }
  }

  private finir(arrive: boolean): void {
    if (this.termine) return;
    const n = this.niveauBase;
    const infini = this.mode === 'infini';
    const principal = { ...n.objectif, atteint: this.atteint(n.objectif, arrive), mesure: this.mesurer(n.objectif) };
    const maitrise = infini ? [] : n.maitrise.map((o) => ({ ...o, atteint: this.atteint(o, arrive), mesure: this.mesurer(o) }));
    const reussi = arrive && principal.atteint && !infini;
    // Chaque objectif de maîtrise atteint rapporte des points.
    for (const o of maitrise) if (o.atteint) this.score += POINTS.objectif * this.profil.score;
    // La note (sur 100) : l'objectif, la maîtrise, les esquives parfaites, aucun choc, les fragments.
    const cible = n.objectif.type === 'parfaits' ? n.objectif.valeur : 10;
    const note = Math.round(
      (reussi ? 35 : 10) +
        (30 * maitrise.filter((o) => o.atteint).length) / Math.max(1, maitrise.length) +
        15 * Math.min(1, this.parfaits / cible) +
        10 * (this.chocs === 0 ? 1 : 0.4 ** this.chocs) +
        10 * (this.fragmentsVus ? this.fragments / this.fragmentsVus : 1),
    );
    let rang = RANGS.find(([, seuil]) => note >= seuil)?.[0] ?? 'C';
    if (rang === 'SSS' && this.chocs > 0) rang = 'S';
    if (!reussi || infini) rang = '—';
    this.score = Math.round(this.score);
    this.termine = {
      reussi,
      arrive,
      objectifs: infini ? [] : [principal, ...maitrise],
      score: this.score,
      rang,
      note,
      fragments: this.fragments,
      fragmentsVus: this.fragmentsVus,
      parfaits: this.parfaits,
      comboMax: this.comboMax,
      multiplicateurMax: this.multiplicateurMax,
      motifs: this.motifsReussis,
      distance: Math.round(this.distance),
      temps: this.temps,
      chocs: this.chocs,
      portails: this.portails,
      overdrives: this.overdrives,
    };
    this.evenements.push({ type: 'fin' });
  }

  // ==========================================================================
  // LE GÉNÉRATEUR
  // ==========================================================================
  private tirer<T>(liste: T[]): T {
    return liste[Math.floor(this.hasard() * liste.length) % liste.length];
  }

  /** Pose des motifs jusqu'à une position du parcours (sert aussi aux vérifications). */
  genererJusqua(limite: number): void {
    if (this.scriptee) return;
    while (this.derniere < limite) {
      // Plus rien dans les derniers mètres : on arrive au portail.
      if (this.derniere > this.longueur - 90) {
        this.derniere = Infinity;
        return;
      }
      const phaseIndex = this.phaseA(this.derniere);
      const phase = this.niveauBase.phases[phaseIndex];
      // Le motif signature de la phase : toujours le même, pour qu'on apprenne à le passer.
      if (!this.signatures.has(phaseIndex) && this.mode !== 'infini' && this.derniere > 150) {
        this.signatures.add(phaseIndex);
        this.motifSignature(phaseIndex);
        continue;
      }
      // Phase de pression : plusieurs motifs enchaînés sans répit.
      const enPression = this.derniere >= this.prochainePression || (phase.pression && this.hasard() < 0.12);
      if (enPression && this.derniere > 250) {
        this.prochainePression = this.derniere + this.profil.pression.toutesLes * (phase.pression ? 0.6 : 1);
        for (let k = 0; k < this.profil.pression.motifs; k++) this.motif(this.choisirFamille(phase), k === 0 ? 0.8 : 0.35);
        continue;
      }
      this.motif(this.choisirFamille(phase), this.derniere < 120 ? 1.3 : 1);
    }
  }

  private choisirFamille(phase: Phase): Famille {
    const poids = Object.entries(phase.familles).filter(([, p]) => (p ?? 0) > 0) as [Famille, number][];
    const total = poids.reduce((s, [, p]) => s + p, 0);
    let tirage = this.hasard() * total;
    for (const [f, p] of poids) {
      tirage -= p;
      if (tirage <= 0) return f;
    }
    return poids[0]?.[0] ?? 'simple';
  }

  private motifSignature(phaseIndex: number): void {
    // Un tirage à part, fixé par le niveau et la phase : la même séquence à chaque partie.
    const sauve = this.hasard;
    const fixe = hasardGraine(this.niveauBase.id * 1000 + phaseIndex * 37 + 7);
    (this as unknown as { hasard: () => number }).hasard = fixe;
    const phase = this.niveauBase.phases[phaseIndex];
    const familles = Object.keys(phase.familles) as Famille[];
    this.motif(familles.includes('zigzag') ? 'zigzag' : familles[0], 1);
    (this as unknown as { hasard: () => number }).hasard = sauve;
  }

  /** Construit un motif (une liste d'étapes) selon sa famille et la complexité, puis le pose. */
  private motif(famille: Famille, ecartMotif: number): void {
    const c = this.complexite;
    const etapes = this.construire(famille, c);
    if (!etapes.length) return;
    etapes[0].ecart *= ecartMotif;
    const m: Motif = { id: ++this.compteur, famille, complexite: c, fin: 0, chocs: 0, regle: false };
    this.motifs.set(m.id, m);
    let precedent: Objet | null = null;
    for (const etape of etapes) {
      const o = this.poser(etape, m.id);
      if (precedent && o) precedent.lie = o.id;
      if (o) precedent = o;
      m.fin = Math.max(m.fin, o ? o.pos + (o.longueur ?? 0) : m.fin);
    }
    this.motifsPoses++;
    // Parfois, un fragment sur une voie sûre, après le motif.
    if (this.hasard() < 0.3 * this.profil.fragments) this.objet('fragment', this.derniere + 4, [this.tirer([...this.atteignables])]);
  }

  /** Une voie que l'on peut atteindre, au hasard ; et des voies à bloquer qui obligent à bouger. */
  private voieAtteinte(): number {
    return this.tirer([...this.atteignables]);
  }
  private bloquer(nombre: number, eviter?: number): number[] {
    const premiere = this.hasard() < 0.6 ? this.voieAtteinte() : this.tirer(TOUTES);
    const bloquees = new Set([premiere]);
    while (bloquees.size < nombre) bloquees.add(this.tirer(TOUTES));
    if (eviter !== undefined && bloquees.has(eviter) && bloquees.size === 2) {
      bloquees.delete(eviter);
      bloquees.add(TOUTES.find((v) => !bloquees.has(v) && v !== eviter) ?? premiere);
    }
    if (bloquees.size >= 3) bloquees.delete(this.tirer([...bloquees]));
    return [...bloquees];
  }

  private construire(famille: Famille, c: number): Etape[] {
    const h = () => this.hasard();
    const sauf = (libre: number) => TOUTES.filter((v) => v !== libre);
    switch (famille) {
      case 'simple':
        return [{ type: 'bloc', voies: this.bloquer(1), ecart: 1 }];
      case 'double': {
        const voies = this.bloquer(2);
        const libre = TOUTES.find((v) => !voies.includes(v)) ?? 1;
        return [{ type: 'bloc', voies, ecart: 1, fragments: h() < 0.3 ? [{ voie: libre }] : undefined }];
      }
      case 'escalier': {
        const n = 3 + Math.round(2 * c);
        const sens = h() < 0.5 ? 1 : -1;
        let libre = sens > 0 ? 0 : 2;
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) {
          etapes.push({ type: 'bloc', voies: sauf(libre), ecart: k === 0 ? 1 : 0.55, chaine: k > 0 });
          libre = borner(libre + sens, 0, 2);
        }
        return etapes;
      }
      case 'zigzag': {
        // Enchaînement rapide : d'un bord à l'autre (deux voies à traverser) dès que la complexité le permet.
        const n = 3 + Math.round(3 * c);
        const large = c >= 0.35;
        let libre = this.tirer(large ? [0, 2] : TOUTES);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) {
          etapes.push({ type: 'bloc', voies: sauf(libre), ecart: k === 0 ? 1 : 0.45, chaine: k > 0, choix: c > 0.35 });
          libre = large ? 2 - libre : libre === 1 ? this.tirer([0, 2]) : 1;
        }
        return etapes;
      }
      case 'couloir': {
        // Piste instable : on choisit sa voie avant d'entrer ; parfois, il faut en sortir aussitôt.
        const deux = c >= 0.3 || h() < 0.5;
        const voies = deux ? this.bloquer(2) : this.bloquer(1);
        const libres = TOUTES.filter((v) => !voies.includes(v));
        const longueur = 22 + 45 * c + h() * 12;
        const etapes: Etape[] = [
          {
            type: 'faille',
            voies,
            longueur,
            ecart: 1,
            choix: true,
            fragments: [{ voie: this.tirer(libres), dore: c > 0.45, nombre: 2 + Math.round(2 * c) }],
          },
        ];
        // Juste après la sortie, la voie du couloir se ferme : il faut en sortir aussitôt.
        if (c > 0.4) etapes.push({ type: 'bloc', voies: libres, ecart: 0.35, chaine: true });
        return etapes;
      }
      case 'essaim': {
        const n = 5 + Math.round(6 * c);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) etapes.push({ type: 'debris', voies: this.bloquer(c > 0.6 && h() < 0.3 ? 2 : 1), ecart: k === 0 ? 1 : 0.38, chaine: k > 0 });
        return etapes;
      }
      case 'laser': {
        const n = 1 + Math.round(2 * c);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) etapes.push({ type: 'laser', voies: this.bloquer(c < 0.2 ? 1 : 2), ecart: k === 0 ? 1 : 0.7, changeant: true, chaine: k > 0 });
        return etapes;
      }
      case 'glissement': {
        const etapes: Etape[] = [{ type: 'mobile', voies: this.bloquer(1), ecart: 1, changeant: true }];
        if (c > 0.5) etapes.push({ type: 'mobile', voies: this.bloquer(c > 0.75 ? 2 : 1), ecart: 0.6, changeant: true, chaine: true });
        if (c > 0.65) etapes.push({ type: 'bloc', voies: this.bloquer(2), ecart: 0.5, chaine: true });
        return etapes;
      }
      case 'portail': {
        // Un portail sur une voie sûre ; juste après, une rangée dont la seule sortie est la voie d'arrivée.
        const voie = this.voieAtteinte();
        const vers = this.tirer(TOUTES.filter((v) => v !== voie));
        return [
          { type: 'portail', voies: [voie], portail: vers, ecart: 1, fragments: [{ voie: vers, dore: true }] },
          { type: 'bloc', voies: sauf(vers), ecart: 0.45, chaine: true, choix: true },
        ];
      }
      case 'risque': {
        // Des fragments dorés dans une voie qu'il faut quitter juste après : plus de points, moins de marge.
        const premiere = this.bloquer(1);
        const libres = TOUTES.filter((v) => !premiere.includes(v));
        const riche = this.tirer(libres);
        return [
          { type: 'bloc', voies: premiere, ecart: 1, fragments: [{ voie: riche, dore: true, nombre: 2 }] },
          { type: 'bloc', voies: [riche, ...(c > 0.55 ? [this.tirer(TOUTES.filter((v) => v !== riche))] : [])], ecart: 0.42, chaine: true },
        ];
      }
      case 'frappe': {
        const phase = this.boss?.phase ?? 1;
        const n = 1 + (phase >= 2 ? 1 : 0) + (c > 0.6 ? 1 : 0);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++)
          etapes.push({ type: 'frappe', voies: this.bloquer(phase >= 2 && h() < 0.6 ? 2 : 1), ecart: k === 0 ? 1.1 : 0.55, chaud: true, chaine: k > 0, noyau: h() < 0.3 ? 1 : undefined });
        return etapes;
      }
      case 'balayage': {
        const n = 2 + (c > 0.5 ? 1 : 0);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) etapes.push({ type: 'mobile', voies: this.bloquer(1), ecart: k === 0 ? 1 : 0.6, changeant: true, chaud: true, chaine: k > 0 });
        return etapes;
      }
      case 'grille': {
        const etapes: Etape[] = [
          { type: 'laser', voies: this.bloquer(2), ecart: 1, changeant: true },
          { type: 'laser', voies: this.bloquer(2), ecart: 0.6, changeant: true, chaine: true },
          { type: 'frappe', voies: this.bloquer(2), ecart: 0.5, chaud: true, chaine: true, noyau: 1 },
        ];
        return etapes;
      }
      // ---- Les familles mobiles de la V4 ----
      case 'drones': {
        // Une patrouille : un ou deux drones qui glissent d'une voie à l'autre avant de se poser.
        const n = 1 + (c > 0.45 ? 1 : 0) + (c > 0.8 ? 1 : 0);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) etapes.push({ type: 'drone', voies: this.bloquer(c > 0.6 && h() < 0.4 ? 2 : 1), ecart: k === 0 ? 1 : 0.6, changeant: true, chaine: k > 0 });
        return etapes;
      }
      case 'portes': {
        // Une structure qui se referme : elle bloque deux voies une fois close ; plus loin, une seule.
        const etapes: Etape[] = [{ type: 'porte', voies: this.bloquer(2), ecart: 1, changeant: true }];
        if (c > 0.55) etapes.push({ type: 'porte', voies: this.bloquer(2), ecart: 0.7, changeant: true, chaine: true });
        return etapes;
      }
      case 'rotors': {
        const n = 1 + (c > 0.5 ? 1 : 0);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) etapes.push({ type: 'rotor', voies: this.bloquer(2), ecart: k === 0 ? 1 : 0.7, changeant: true, chaine: k > 0 });
        return etapes;
      }
      case 'chutes': {
        // Des blocs qui tombent : leur voie est connue dès qu'ils apparaissent ; ils arrivent en rafale.
        const n = 2 + Math.round(2 * c);
        const etapes: Etape[] = [];
        for (let k = 0; k < n; k++) etapes.push({ type: 'chute', voies: this.bloquer(c > 0.7 && h() < 0.3 ? 2 : 1), ecart: k === 0 ? 1 : 0.5, chaine: k > 0 });
        return etapes;
      }
      case 'convoi': {
        // Des éclaireurs ennemis qui foncent vers le joueur, l'un derrière l'autre, sur des voies différentes.
        const n = 2 + Math.round(2 * c);
        const etapes: Etape[] = [];
        let voie = this.voieAtteinte();
        for (let k = 0; k < n; k++) {
          etapes.push({ type: 'eclaireur', voies: [voie], ecart: k === 0 ? 1 : 0.45, chaine: k > 0 });
          voie = this.tirer(TOUTES.filter((v) => v !== voie));
        }
        return etapes;
      }
      case 'effondrement': {
        const voies = this.bloquer(2);
        const libre = TOUTES.find((v) => !voies.includes(v)) ?? 1;
        return [
          { type: 'faille', voies, longueur: 40 + 30 * c, ecart: 1, choix: true, fragments: [{ voie: libre, dore: true, nombre: 3 }] },
          { type: 'mobile', voies: [libre], ecart: 0.4, changeant: true, chaud: true, chaine: true },
          { type: 'frappe', voies: this.bloquer(2), ecart: 0.5, chaud: true, chaine: true, noyau: 1 },
        ];
      }
    }
  }

  /**
   * Pose une étape en respectant la règle de justice ; renvoie l'objet posé.
   * L'ensemble des voies atteignables avance d'une rangée.
   */
  private poser(e: Etape, motif: number): Objet | null {
    const pos0 = this.derniere;
    const v = this.vitesseA(pos0 + 40) * 1.03; // la vitesse au moment d'arriver (elle ne fait que monter)
    const reaction = this.reactionA(pos0);
    const r = e.chaine ? Math.max(0.12, reaction * 0.55) : reaction;
    const pieges = e.choix || this.difficulte === 'expert' || this.difficulte === 'cauchemar' || this.difficulte === 'paradoxe';

    if (e.type === 'portail' && e.portail !== undefined) {
      const pos = pos0 + Math.max(this.ecartA(pos0) * e.ecart, v * (r + this.deplacement) + 3);
      const o = this.objet('portail', pos, e.voies, motif);
      o.vers = e.portail;
      this.poserFragments(e, pos, motif);
      this.derniere = pos;
      // On peut être dans la voie d'arrivée en plus de celles où l'on était.
      this.atteignables = new Set([...this.atteignables, e.portail]);
      return o;
    }

    const libres = TOUTES.filter((x) => !e.voies.includes(x));
    if (!libres.length) return null;
    /** Le temps qu'il faut pour aller de la voie a à la voie l. */
    const temps = (a: number, l: number) => (a === l ? 0 : r + Math.abs(a - l) * this.deplacement);
    // L'écart minimal : au moins une voie libre atteignable (ou, sans piège, une sortie depuis chaque voie sûre).
    const depuis = [...this.atteignables];
    const meilleur = (a: number) => Math.min(...libres.map((l) => temps(a, l)));
    // (V4) Un obstacle qui change encore (laser, cargo, drone, porte, rotor) ne laisse pas planifier : sa place finale
    // n'est connue qu'au dernier moment. Il garantit donc toujours une sortie depuis chaque voie possible, même en
    // Expert et au-delà (la simulation a montré qu'un « piège » posé sur un obstacle mobile pouvait être impossible).
    // Les rangées qui suivent de près un obstacle mobile non plus : on ne pouvait pas savoir où se placer avant lui.
    const incertain = e.changeant || pos0 < this.incertainJusqua;
    const besoin = pieges && !incertain ? Math.min(...depuis.map(meilleur)) : Math.max(...depuis.map(meilleur));
    const ecart = Math.max(this.ecartA(pos0) * e.ecart, v * besoin + 4);
    // Laser, obstacle mobile : la configuration finale est figée assez tôt pour réagir puis traverser deux voies.
    const fige = e.changeant ? v * (reaction + 2 * this.deplacement + 0.08) : undefined;
    const pos = pos0 + ecart;
    const dt = ecart / v;
    const suivantes = new Set(libres.filter((l) => depuis.some((a) => temps(a, l) <= dt + 1e-9)));
    const o = this.objet(e.type, pos, e.voies, motif);
    if (e.chaud) o.chaud = true;
    if (e.type === 'faille' && e.longueur) {
      o.longueur = e.longueur;
      // Dans un couloir, on ne traverse pas une voie effondrée : seules les voies libres voisines communiquent.
      this.derniere = pos + e.longueur;
    } else this.derniere = pos;
    if (e.changeant && fige !== undefined) {
      this.changer(o, fige);
      this.incertainJusqua = Math.max(this.incertainJusqua, pos + apparition(v));
    }
    this.poserFragments(e, pos, motif);
    if (e.noyau !== undefined && this.boss) this.objet('noyau', pos - 3, [this.tirer(libres)], motif);
    this.atteignables = suivantes.size ? suivantes : new Set(libres);
    if (e.type === 'faille') {
      // À la sortie du couloir, on peut rejoindre les voies libres contiguës.
      const sortie = new Set(this.atteignables);
      for (const l of [...sortie]) for (const voisin of [l - 1, l + 1]) if (libres.includes(voisin)) sortie.add(voisin);
      this.atteignables = sortie;
    }
    return o;
  }

  /** Laser : la voie libre tourne en approchant ; mobile : l'obstacle glisse jusqu'à sa place finale. */
  private changer(o: Objet, fige: number): void {
    o.fige = fige;
    const loin = apparition(this.vitesseA(o.pos));
    const pas = (loin - fige) / 3;
    o.avant = [];
    for (let k = 0; k < 2; k++) {
      let voies: number[];
      if (o.type === 'mobile' || o.type === 'drone') {
        const decalage = (k === 0 ? 2 : 1) * (this.hasard() < 0.5 ? 1 : -1);
        voies = [...new Set(o.voies.map((b) => borner(b + decalage, 0, 2)))];
      } else if (o.type === 'porte') {
        // Une porte qui se referme : de loin, ses battants ne ferment qu'une de ses voies, puis les deux.
        voies = k === 0 ? [] : [o.voies[Math.floor(this.hasard() * o.voies.length) % o.voies.length]];
      } else {
        const libreAvant = this.tirer(TOUTES);
        voies = TOUTES.filter((x) => x !== libreAvant).slice(0, o.voies.length);
      }
      o.avant.push({ des: loin - pas * (k + 1), voies });
    }
  }

  private poserFragments(e: Etape, pos: number, motif: number): void {
    for (const f of e.fragments ?? []) {
      const n = Math.max(1, Math.round((f.nombre ?? 1) * (f.dore ? 1 : this.profil.fragments)));
      for (let k = 0; k < n; k++) this.objet(f.dore ? 'dore' : 'fragment', pos - 3 - k * 5 + (e.type === 'faille' ? (e.longueur ?? 0) * 0.5 + k * 10 : 0), [f.voie], motif);
    }
  }

  private objet(type: TypeObjet, pos: number, voies: number[], motif?: number): Objet {
    const o: Objet = { id: ++this.compteur, type, pos, voies, passe: false, graine: this.hasard(), motif: estObstacle(type) ? motif : undefined };
    this.objets.push(o);
    return o;
  }
}
