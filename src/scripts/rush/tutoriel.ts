// PORTAL RUSH V4 — LE TUTORIEL IMMERSIF (16 octobre 2026)
//
// À la toute première entrée (une fois par profil : terminé ou passé, il ne revient plus seul), on arrive du
// voyage temporel directement dans la course : pas de menu, pas de « Commencer », pas de 3-2-1. Le moteur
// démarre, et cinq phases courtes (une trentaine de secondes en tout) apprennent le jeu en le jouant :
//   1. premiers déplacements : changer de voie, à gauche puis à droite (les vraies touches) ;
//   2. esquiver : trois obstacles simples ; s'il ne bouge pas, le vaisseau ralentit et attend (assistance) ;
//   3. l'énergie : ramasser au moins trois fragments ; la jauge se remplit en partie, et l'on explique pourquoi
//      l'Overdrive est rare (aucun Overdrive offert) ;
//   4. un obstacle mobile : un drone qui glisse puis se pose ; l'éviter ;
//   5. l'arrivée : le vaisseau accélère, une courte finale, puis « Entraînement terminé. Bienvenue dans Portal
//      Rush. », et le menu principal s'ouvre de lui-même.
// Chaque phase demande une vraie action. Un échec la fait recommencer, sans rejouer l'introduction. Le bouton
// « PASSER LE TUTORIEL », en bas à droite, arrête tout proprement (moteur, sons) et ouvre le menu. Rien n'est
// compté : ni record, ni statistique. L'état est sauvegardé à chaque phase (une sortie en plein milieu reprend
// à la même phase la fois suivante) ; « Refaire l'entraînement », dans le menu, le relance à volonté.

import { Partie, type Evenement, type Objet } from './moteur';

export interface TextesTutoriel {
  titre: string;
  phases: { titre: string; consigne: string; tactile: string }[];
  bravo: string;
  rate: string;
  ralenti: string;
  energie: string;
  fin: [string, string];
  passer: string;
  refaire: string;
  etape: string;
}

/** Ce que le tutoriel demande à l'interface du jeu (rush.ts). */
export interface HoteTutoriel {
  /** Pose une nouvelle partie scriptée (le moteur et la scène la prennent en charge). */
  partie: (p: Partie | null) => void;
  vehicule: () => string;
  textes: () => TextesTutoriel;
  tactile: boolean;
  /** Montre la ligne de consigne, le numéro de phase, les touches à animer. */
  afficher: (etat: { phase: number; titre: string; consigne: string; touches: ('gauche' | 'droite' | '')[]; message?: string; genre?: 'ok' | 'rate' | 'info' }) => void;
  /** La finale : le texte de fin, puis le menu. */
  finale: (lignes: [string, string]) => void;
  /** Un évènement sonore ou visuel du jeu. */
  son: (quoi: 'pret' | 'parfait' | 'choc' | 'victoire' | 'deplacement') => void;
  /** Sauvegarde l'avancement (phase atteinte, ou fin). */
  noter: (etat: 'commence' | 'termine' | 'passe', phase: number) => void;
  /** Retour au menu principal (fin ou passage). */
  menu: () => void;
}

const VITESSES = [15, 19, 17, 19, 30];

export class Tutoriel {
  private hote: HoteTutoriel;
  partie: Partie | null = null;
  phase = 0;
  actif = false;
  private compte = 0;
  private attendu: ('gauche' | 'droite')[] = [];
  private suivant = 0;
  private enAttente = 0;
  private derniereVoie = 1;
  private termineLe = 0;
  /** Les drones déjà posés sur la voie du vaisseau (phase 4). */
  private poses = new WeakSet<Objet>();

  constructor(hote: HoteTutoriel) {
    this.hote = hote;
  }

  /** Lance le tutoriel à une phase (0 : depuis le début). */
  demarrer(phase = 0): void {
    const p = new Partie('campagne', 'pilote', 1, 20261016, this.hote.vehicule() as never);
    p.scriptee = true;
    p.boucliers = p.bouclierMax;
    this.partie = p;
    this.derniereVoie = p.voie;
    this.actif = true;
    this.hote.partie(p);
    this.entrer(Math.max(0, Math.min(4, phase)));
  }

  private get t(): TextesTutoriel {
    return this.hote.textes();
  }

  /** Entre dans une phase : consigne, vitesse, objets. */
  private entrer(n: number): void {
    const p = this.partie;
    if (!p) return;
    this.phase = n;
    this.compte = 0;
    this.suivant = 0;
    this.enAttente = 0;
    p.vider();
    p.vitesseImposee = VITESSES[n];
    p.figee = false;
    this.hote.noter('commence', n);
    const ph = this.t.phases[n];
    const consigne = this.hote.tactile ? ph.tactile : ph.consigne;
    if (n === 0) {
      // Une voie, puis l'autre : d'abord vers le bord le plus proche du centre.
      this.attendu = p.voie === 0 ? ['droite', 'gauche'] : ['gauche', 'droite'];
      this.hote.afficher({ phase: n, titre: ph.titre, consigne, touches: [this.attendu[0]] });
    } else {
      this.hote.afficher({ phase: n, titre: ph.titre, consigne, touches: n === 1 || n === 3 ? ['gauche', 'droite'] : n === 2 ? ['gauche', 'droite'] : [] });
      this.preparer(n);
    }
  }

  /** Pose les objets d'une phase (devant le vaisseau, à des distances qui laissent toujours le temps). */
  private preparer(n: number): void {
    const p = this.partie!;
    const ici = p.voieOccupee;
    if (n === 1) {
      // Trois obstacles, l'un après l'autre : chacun bloque la voie où l'on est quand il est posé.
      this.poserObstacle(ici, 70);
    } else if (n === 2) {
      // Cinq fragments en zigzag, à portée.
      const voies = [ici, ici === 1 ? 0 : 1, ici === 1 ? 2 : ici, ici === 1 ? 1 : ici === 0 ? 1 : 1, ici];
      voies.forEach((v, k) => p.placer('fragment', 45 + k * 22, [v]));
    } else if (n === 3) {
      // Un drone qui glisse d'un bord à l'autre, puis se pose sur la voie du vaisseau.
      const autre = (v: number) => (v === 0 ? 2 : 0);
      p.placer('drone', 90, [ici], { avant: [{ des: 70, voies: [autre(ici)] }, { des: 45, voies: [1] }], fige: 32 });
    } else if (n === 4) {
      // L'arrivée : plus rien sur la piste, le vaisseau accélère.
      this.termineLe = p.distance + 140;
    }
  }

  private poserObstacle(voie: number, devant: number): void {
    this.partie?.placer('bloc', devant, [voie]);
  }

  /** Les évènements du moteur (déplacements, chocs, fragments). */
  surEvenement(e: Evenement): void {
    const p = this.partie;
    if (!this.actif || !p) return;
    if (e.type === 'deplacement') {
      const sens = (e.voie ?? p.voie) < this.derniereVoie ? 'gauche' : 'droite';
      this.derniereVoie = e.voie ?? p.voie;
      if (this.phase === 0 && this.attendu[this.suivant] === sens) {
        this.suivant++;
        this.hote.son('parfait');
        if (this.suivant >= this.attendu.length) this.reussir();
        else this.hote.afficher({ phase: 0, titre: this.t.phases[0].titre, consigne: this.hote.tactile ? this.t.phases[0].tactile : this.t.phases[0].consigne, touches: [this.attendu[this.suivant]], message: '✓', genre: 'ok' });
      }
      // (Le vaisseau ralenti repart dès qu'on a bougé.)
      if (this.enAttente) {
        this.enAttente = 0;
        p.vitesseImposee = VITESSES[this.phase];
      }
    } else if (e.type === 'choc' && (this.phase === 1 || this.phase === 3)) {
      this.hote.son('choc');
      this.recommencer();
    } else if ((e.type === 'fragment' || e.type === 'dore') && this.phase === 2) {
      this.compte++;
      // La jauge se remplit en partie (jamais pleine : l'Overdrive se mérite en course).
      p.jauge = Math.min(0.6, this.compte * 0.12);
      if (this.compte === 3) this.hote.afficher({ phase: 2, titre: this.t.phases[2].titre, consigne: this.t.energie, touches: [], message: '✓', genre: 'ok' });
    }
  }

  private reussir(): void {
    const p = this.partie;
    if (!p) return;
    this.hote.son('pret');
    const n = this.phase;
    const ph = this.t.phases[n];
    this.hote.afficher({ phase: n, titre: ph.titre, consigne: this.t.bravo, touches: [], message: '✓', genre: 'ok' });
    this.phase = n + 0.5; // (entre deux phases : rien ne compte)
    window.setTimeout(() => this.actif && this.entrer(n + 1), n === 2 ? 2600 : 900);
  }

  private recommencer(): void {
    const n = Math.floor(this.phase);
    const ph = this.t.phases[n];
    this.hote.afficher({ phase: n, titre: ph.titre, consigne: this.t.rate, touches: [], message: '↺', genre: 'rate' });
    this.phase = n + 0.5;
    this.partie?.vider();
    window.setTimeout(() => this.actif && this.entrer(n), 1100);
  }

  /** À chaque image : l'avancée des phases, l'assistance (ralentir et attendre), la fin. */
  tic(): void {
    const p = this.partie;
    if (!this.actif || !p || this.phase % 1 !== 0) return;
    const ici = p.voieOccupee;
    const devant = p.objets.filter((o) => !o.passe && o.pos > p.distance);
    if (this.phase === 1) {
      // Un obstacle franchi sans choc : le suivant ; trois, la phase est réussie.
      const restant = devant.filter((o) => o.type === 'bloc');
      if (!restant.length) {
        this.compte++;
        if (this.compte >= 3) return this.reussir();
        this.poserObstacle(ici, 60);
        return;
      }
      const o = restant[0];
      // Assistance : à moins de 16 m, si le vaisseau est toujours sur la voie de l'obstacle, il ralentit et attend.
      if (o.pos - p.distance < 16 && o.voies.includes(ici) && !this.enAttente) {
        this.enAttente = 1;
        p.vitesseImposee = 2.5;
        this.hote.afficher({ phase: 1, titre: this.t.phases[1].titre, consigne: this.t.ralenti, touches: ['gauche', 'droite'], genre: 'info' });
      }
    } else if (this.phase === 2) {
      if (!devant.some((o) => o.type === 'fragment')) {
        if (this.compte >= 3) this.reussir();
        else this.recommencer();
      }
    } else if (this.phase === 3) {
      const drone = devant.find((o) => o.type === 'drone');
      if (drone && drone.pos - p.distance <= (drone.fige ?? 0) && drone.voies[0] !== undefined) {
        // Le drone s'est posé : sur la voie du vaisseau au moment où il se fige (il faut vraiment l'éviter).
        if (!this.poses.has(drone)) {
          this.poses.add(drone);
          drone.voies = [ici];
        }
        if (drone.pos - p.distance < 12 && drone.voies.includes(ici) && !this.enAttente) {
          this.enAttente = 1;
          p.vitesseImposee = 2.5;
          this.hote.afficher({ phase: 3, titre: this.t.phases[3].titre, consigne: this.t.ralenti, touches: ['gauche', 'droite'], genre: 'info' });
        }
      }
      if (!drone) this.reussir();
    } else if (this.phase === 4) {
      p.vitesseImposee = Math.min(48, (p.vitesseImposee ?? 30) + 0.25);
      if (p.distance >= this.termineLe) {
        this.phase = 5;
        this.actif = false;
        this.hote.son('victoire');
        this.hote.noter('termine', 5);
        this.hote.finale(this.t.fin);
      }
    }
  }

  /** Passer le tutoriel : tout s'arrête proprement, le menu s'ouvre. */
  passer(): void {
    this.actif = false;
    this.partie = null;
    this.hote.noter('passe', Math.floor(this.phase));
    this.hote.partie(null);
    this.hote.menu();
  }

  /** Quitter en plein milieu (sortie du jeu, menu de pause) : l'état reste « commencé » à cette phase. */
  arreter(): void {
    this.actif = false;
    this.partie = null;
  }
}
