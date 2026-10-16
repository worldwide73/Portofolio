// LES RADIOS : DREAM RADIO (le portfolio) et RUSH RADIO (Portal Rush) (16 octobre 2026).
// Une radio est une liste de pistes, un volume, une sourdine et un lecteur. Une piste est soit un fichier
// enregistré (public/audio/, licence vérifiée et créditée), soit une composition originale jouée en
// direct par le code (compositions.ts). Les deux passent par le canal de la musique du moteur commun
// (moteur.ts) : le volume choisi est la référence, l'atténuation des grands effets s'y ajoute.
//
// Règles :
//   - rien ne démarre seul : une radio ne joue qu'après une action du visiteur (Lecture, une piste) ;
//   - une seule radio à la fois : quand l'une démarre, l'autre se met en pause (en gardant sa place) ;
//   - « suspendre » (l'entrée dans Portal Rush) baisse la radio en fondu, garde sa position, et retient
//     qu'elle jouait : « reprendreSiSuspendue » (la sortie du jeu) ne la relance que dans ce cas ;
//   - onglet masqué : la radio se tait et reprend au retour, si elle jouait.

import { bruitBlanc, canalMusique, contexte } from './moteur';
import type { Fabrique, Lecture } from './compositions';

export interface PisteRadio {
  id: string;
  titre: string;
  artiste: string;
  /** La licence, telle qu'affichée (« CC BY-SA 3.0 », « Composition originale »). */
  licence: string;
  /** Où vérifier la licence ou l'origine. */
  lien?: string;
  /** Un fichier de public/audio/… */
  src?: string;
  /** Ou une composition jouée par le code. */
  fabriquer?: Fabrique;
  /** Le gain qui met la piste au niveau des autres, à l'oreille et au sonomètre (1 = tel quel). */
  niveau: number;
  /** La durée connue d'avance (s), affichée avant le chargement. */
  duree: number;
  /** Les couches séparées existent (compositions de RUSH RADIO) : la musique peut vraiment s'adapter. */
  adaptative?: boolean;
}

export interface EtatRadio {
  index: number;
  lecture: boolean;
  volume: number;
  muet: boolean;
  position: number;
  duree: number;
  chargement: boolean;
  erreur: boolean;
}

export interface Preferences {
  piste: string;
  volume: number;
  muet: boolean;
}
/** Où une radio garde ses préférences : DREAM RADIO dans le navigateur, RUSH RADIO dans la sauvegarde du jeu. */
export interface Stockage {
  lire(): Partial<Preferences> | null;
  ecrire(p: Preferences): void;
}
/** Un stockage dans localStorage, sous une clé à soi. */
export const stockageLocal = (cle: string): Stockage => ({
  lire: () => {
    try {
      const brut = JSON.parse(localStorage.getItem(cle) ?? 'null');
      return brut && typeof brut === 'object' ? brut : null;
    } catch {
      return null;
    }
  },
  ecrire: (p) => {
    try {
      localStorage.setItem(cle, JSON.stringify(p));
    } catch {
      // stockage indisponible : les préférences valent pour cette page
    }
  },
});

const radios: Radio[] = [];
const FONDU = 0.6;

export class Radio {
  readonly nom: string;
  readonly pistes: PisteRadio[];
  private stockage: Stockage;
  private index = 0;
  private volume = 0.55;
  private muet = false;
  private joue = false;
  /** Suspendue par une autre radio ou par l'entrée dans le jeu : elle jouait, et pourra reprendre. */
  private suspendue = false;
  private chargement = false;
  private erreur = false;
  /** La position (s) à laquelle reprendre une composition mise en pause. */
  private reprise = 0;
  private sortie: GainNode | null = null;
  private pisteGain: GainNode | null = null;
  private element: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private composition: Lecture | null = null;
  private suivi = 0;
  private fin = false;
  private ecouteurs: ((e: EtatRadio) => void)[] = [];
  private analyse: AnalyserNode | null = null;
  private masquee = false;

  constructor(nom: string, pistes: PisteRadio[], stockage: Stockage, volumeParDefaut = 0.55) {
    this.nom = nom;
    this.pistes = pistes;
    this.stockage = stockage;
    this.volume = volumeParDefaut;
    this.relirePreferences();
    radios.push(this);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.joue) {
        this.masquee = true;
        this.arreterSon(false);
      } else if (!document.hidden && this.masquee) {
        this.masquee = false;
        if (this.joue) this.demarrerSon();
      }
    });
  }

  // ---- Les préférences (volume, sourdine, dernière piste) : jamais la lecture elle-même ----
  /** Relit les préférences gardées (au démarrage, ou quand la sauvegarde du jeu est rechargée). */
  relirePreferences(): void {
    const p = this.stockage.lire();
    if (!p) return;
    const i = this.pistes.findIndex((x) => x.id === p.piste);
    if (i >= 0 && !this.joue) this.index = i;
    if (typeof p.volume === 'number' && Number.isFinite(p.volume)) this.volume = Math.max(0, Math.min(1, p.volume));
    if (typeof p.muet === 'boolean') this.muet = p.muet;
    this.appliquerVolume();
  }
  private memoriser(): void {
    this.stockage.ecrire({ piste: this.pistes[this.index].id, volume: Math.round(this.volume * 100) / 100, muet: this.muet });
  }

  // ---- L'état, pour l'interface ----
  get etat(): EtatRadio {
    const piste = this.pistes[this.index];
    let position = this.reprise;
    let duree = piste.duree;
    if (this.fichierCharge()) {
      position = this.element!.currentTime || 0;
      if (Number.isFinite(this.element!.duration) && this.element!.duration > 0) duree = this.element!.duration;
    } else if (this.composition) {
      position = this.composition.position();
      duree = this.composition.duree;
    }
    return { index: this.index, lecture: this.joue, volume: this.volume, muet: this.muet, position: Math.min(position, duree), duree, chargement: this.chargement, erreur: this.erreur };
  }
  /** Le fichier de la piste en cours est-il celui de l'élément audio ? */
  private fichierCharge(): boolean {
    const src = this.piste.src;
    return !!(this.element && src && this.element.src === new URL(src, window.location.href).href);
  }
  get piste(): PisteRadio {
    return this.pistes[this.index];
  }
  get enLecture(): boolean {
    return this.joue;
  }
  get estSuspendue(): boolean {
    return this.suspendue;
  }
  /** Les couches de la composition en cours (musique adaptative), s'il y en a. */
  get couches(): Record<string, GainNode> | null {
    return this.composition?.couches ?? null;
  }
  surChangement(fn: (e: EtatRadio) => void): void {
    this.ecouteurs.push(fn);
  }
  private prevenir(): void {
    const e = this.etat;
    this.ecouteurs.forEach((fn) => fn(e));
  }

  /** Un analyseur branché sur la sortie de la radio (pour dessiner le spectre), créé au premier besoin. */
  analyseur(): AnalyserNode | null {
    if (this.analyse) return this.analyse;
    const c = contexte();
    if (!c) return null;
    const sortie = this.preparer(c);
    if (!sortie) return null;
    this.analyse = c.createAnalyser();
    this.analyse.fftSize = 128;
    this.analyse.smoothingTimeConstant = 0.82;
    sortie.connect(this.analyse);
    return this.analyse;
  }

  // ---- Le volume ----
  private gainVoulu(): number {
    return this.muet ? 0 : this.volume * this.volume * 0.9;
  }
  private appliquerVolume(duree = 0.08): void {
    const c = contexte();
    if (!c || !this.sortie) return;
    this.sortie.gain.setTargetAtTime(this.gainVoulu(), c.currentTime, duree);
  }
  reglerVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.volume > 0 && this.muet) this.muet = false;
    this.appliquerVolume();
    this.memoriser();
    this.prevenir();
  }
  basculerMuet(): void {
    this.muet = !this.muet;
    this.appliquerVolume();
    this.memoriser();
    this.prevenir();
  }

  // ---- La lecture ----
  private preparer(c: AudioContext): GainNode | null {
    const canal = canalMusique();
    if (!canal) return null;
    if (!this.sortie) {
      this.sortie = c.createGain();
      this.sortie.gain.value = this.gainVoulu();
      this.sortie.connect(canal);
    }
    return this.sortie;
  }

  /** Lance la piste en cours (depuis sa position), avec un fondu d'entrée. */
  private demarrerSon(): void {
    const c = contexte();
    if (!c) return;
    const sortie = this.preparer(c);
    if (!sortie) return;
    const piste = this.piste;
    this.arreterSon(false, 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(piste.niveau, c.currentTime + FONDU * 1.6);
    g.connect(sortie);
    this.pisteGain = g;
    this.fin = false;
    this.erreur = false;
    if (piste.src) {
      if (!this.element) {
        this.element = new Audio();
        this.element.preload = 'none';
        this.element.crossOrigin = 'anonymous';
        this.element.addEventListener('ended', () => this.joue && this.suivante(true));
        this.element.addEventListener('waiting', () => ((this.chargement = true), this.prevenir()));
        this.element.addEventListener('playing', () => ((this.chargement = false), this.prevenir()));
        this.element.addEventListener('loadedmetadata', () => this.prevenir());
        this.element.addEventListener('error', () => {
          if (!this.joue) return;
          this.erreur = true;
          this.chargement = false;
          this.prevenir();
        });
        this.source = c.createMediaElementSource(this.element);
      }
      this.source!.disconnect();
      this.source!.connect(g);
      if (!this.fichierCharge()) {
        this.element.src = piste.src;
        this.element.currentTime = this.reprise;
      } else if (Math.abs(this.element.currentTime - this.reprise) > 0.5) this.element.currentTime = this.reprise;
      this.chargement = true;
      void this.element.play().catch(() => {
        this.chargement = false;
        if (this.joue) this.erreur = true;
        this.prevenir();
      });
    } else if (piste.fabriquer) {
      this.composition = piste.fabriquer(c, g, this.reprise, bruitBlanc());
    }
    window.clearInterval(this.suivi);
    this.suivi = window.setInterval(() => this.surveiller(), 250);
  }

  /** Arrête le son en cours (en fondu), en retenant la position. */
  private arreterSon(retenir = true, fondu = FONDU): void {
    const c = contexte();
    window.clearInterval(this.suivi);
    this.suivi = 0;
    if (retenir) this.reprise = this.etat.position;
    const g = this.pisteGain;
    this.pisteGain = null;
    if (g && c) {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setValueAtTime(g.gain.value, c.currentTime);
      g.gain.linearRampToValueAtTime(0, c.currentTime + fondu);
      window.setTimeout(() => g.disconnect(), (fondu + 0.1) * 1000);
    }
    if (this.composition) {
      const comp = this.composition;
      this.composition = null;
      window.setTimeout(() => comp.arret(), fondu * 1000);
    }
    if (this.element && !this.element.paused) {
      const el = this.element;
      const src = this.source;
      // (Le fichier se met en pause après le fondu ; s'il a été relancé entre-temps, on n'y touche pas.)
      window.setTimeout(() => {
        if (this.pisteGain && src && this.element === el && !el.paused && this.joue) return;
        el.pause();
      }, fondu * 1000);
    }
  }

  /** Suit la lecture : la fin d'une composition, la progression affichée. */
  private surveiller(): void {
    const e = this.etat;
    if (this.composition && !this.fin && e.position >= e.duree - 2.5) {
      // Les dernières secondes d'une composition : fondu de sortie, puis la piste suivante.
      this.fin = true;
      const c = contexte();
      if (c && this.pisteGain) this.pisteGain.gain.setTargetAtTime(0, c.currentTime, 0.8);
      window.setTimeout(() => this.joue && this.fin && this.suivante(true), 2500);
    }
    this.prevenir();
  }

  /** Lecture (après une action du visiteur). Les autres radios se mettent en pause. */
  jouer(): void {
    const c = contexte();
    if (!c) return;
    radios.forEach((r) => r !== this && r.joue && r.pauser());
    this.joue = true;
    this.suspendue = false;
    this.masquee = false;
    if (c.state !== 'running') void c.resume().catch(() => undefined);
    this.demarrerSon();
    this.memoriser();
    this.prevenir();
  }
  pauser(): void {
    if (!this.joue) return;
    this.joue = false;
    this.arreterSon(true);
    this.prevenir();
  }
  basculer(): void {
    if (this.joue) this.pauser();
    else this.jouer();
  }
  /** Choisit une piste ; « jouer » : la lancer aussitôt (sinon, seulement la préparer). */
  choisir(i: number, jouer = this.joue): void {
    const n = this.pistes.length;
    this.index = ((i % n) + n) % n;
    this.reprise = 0;
    this.memoriser();
    if (jouer) {
      if (!this.joue) this.jouer();
      else this.demarrerSon();
    } else this.prevenir();
  }
  suivante(auto = false): void {
    this.choisir(this.index + 1, auto ? true : this.joue);
  }
  /** Précédente : au-delà de 4 secondes, on revient au début du morceau. */
  precedente(): void {
    if (this.etat.position > 4) {
      this.chercher(0);
      return;
    }
    this.choisir(this.index - 1, this.joue);
  }
  /** Va à une position du morceau (fichiers et compositions). */
  chercher(position: number): void {
    const duree = this.etat.duree;
    this.reprise = Math.max(0, Math.min(duree - 1, position));
    if (this.fichierCharge()) {
      this.element!.currentTime = this.reprise;
      this.prevenir();
    } else if (this.joue) this.demarrerSon();
    else this.prevenir();
  }

  /** L'entrée dans un autre univers sonore (Portal Rush) : fondu, pause, position gardée. */
  suspendre(): void {
    if (!this.joue) return;
    this.joue = false;
    this.suspendue = true;
    this.arreterSon(true, 0.9);
    this.prevenir();
  }
  /** La sortie : la radio ne reprend que si elle jouait avant d'être suspendue. */
  reprendreSiSuspendue(): void {
    if (!this.suspendue) return;
    this.suspendue = false;
    this.jouer();
  }
  /** Coupe tout de suite, sans retenir de reprise (fermeture de la fenêtre qui la porte). */
  arreter(): void {
    this.suspendue = false;
    if (!this.joue) return;
    this.joue = false;
    this.arreterSon(true, 0.25);
    this.prevenir();
  }
  /** Pour la reprise sur une autre page : la position à laquelle la radio s'était arrêtée. */
  poserReprise(index: number, position: number): void {
    if (index < 0 || index >= this.pistes.length) return;
    this.index = index;
    this.reprise = Math.max(0, position);
    this.prevenir();
  }
}

/** Les radios en lecture (pour les recettes et la règle « une seule à la fois »). */
export const radiosEnLecture = () => radios.filter((r) => r.enLecture).map((r) => r.nom);
