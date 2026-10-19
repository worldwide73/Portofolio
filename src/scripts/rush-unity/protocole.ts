// PORTAL RUSH (Unity) — LE PROTOCOLE DU PONT ENTRE LA PAGE ET UNITY (18 octobre 2026)
//
// Les messages et les données, tels que les fixe le contrat (docs/UNITY_ARCHITECTURE.md, §5.4 et §5.5) ; le côté
// Unity a les mêmes classes (unity/PortalRush/Assets/PortalRush/Scripts/Jeu/Pont/Messages.cs). Chaque message est
// un objet JSON { type, … }. Les ajouts au contrat d'origine sont marqués « (ajout) » et expliqués au §5.6 du
// contrat. Règle de JsonUtility : jamais de null ; un nombre absent vaut 0, un texte absent "".

import type { Difficulte, Emplacement, Mode, Theme } from '../rush/donnees';
import type { Resultat, TypeEvenement } from '../rush/moteur';
import type { Reglages as ReglagesJeu, Tutoriel } from '../rush/sauvegarde';
import type { EvenementRush } from '../sons';

export type Langue = 'fr' | 'en';

/** Les réglages du jeu (sauvegarde), plus deux réglages du site que le jeu montre aussi. */
export interface Reglages extends ReglagesJeu {
  /** (ajout) Effets sonores du site (le panneau du jeu web les montre aussi). */
  sons: boolean;
  /** (ajout) Animations du site : 1 complètes, 0,5 allégées, 0 coupées. */
  animations: number;
}
export interface ConditionVue {
  type: string;
  mesure: number;
  cible: number;
  faite: boolean;
  niveau: number;
  rang: string;
  difficulte: string;
  stat: string;
}
export interface ScoreNiveau {
  difficulte: Difficulte;
  reussi: boolean;
  etoiles: boolean[];
  record: number;
  rang: string;
  /** Le score de l'étoile « score ». */
  etoile: number;
}
export interface NiveauVue {
  id: number;
  theme: Theme;
  debloque: boolean;
  scores: ScoreNiveau[];
}
export interface DifficulteVue {
  id: Difficulte;
  ouverte: boolean;
}
export interface VehiculeVue {
  id: string;
  modele: number;
  debloque: boolean;
  condition: ConditionVue;
}
export interface PieceVue {
  id: string;
  emplacement: Emplacement;
  couleur: string;
  debloquee: boolean;
  equipee: boolean;
  condition: ConditionVue;
}
export interface Equipement {
  coque: string;
  trainee: string;
  overdrive: string;
  noyau: string;
}
export interface InfiniVue {
  difficulte: Difficulte;
  score: number;
  distance: number;
}
export interface DefiVue {
  /** La graine du défi du jour (AAAAMMJJ) ; meilleur, dernier et tentatives sont ceux de ce jour-là. */
  graine: number;
  meilleur: number;
  dernier: number;
  tentatives: number;
  /** (ajout) Le nombre de défis menés au bout, tous jours confondus. */
  reussis: number;
}
export interface Totaux {
  parties: number;
  overdrives: number;
  parfaits: number;
  distance: number;
  multiplicateurMax: number;
  infiniMax: number;
  rangS: boolean;
  meilleurCombo: number;
  meilleursParfaits: number;
  meilleureDistance: number;
}
export interface TutorielVue {
  etat: Tutoriel['etat'];
  phase: number;
  aFaire: boolean;
}
export interface DerniereVue {
  existe: boolean;
  mode: Mode | '';
  difficulte: Difficulte | '';
  niveau: number;
}
/** (ajout) « Continuer » du menu : le prochain secteur, sa difficulté ; « premiere » : « Commencer » le secteur 01. */
export interface RepriseVue {
  premiere: boolean;
  niveau: number;
  difficulte: Difficulte;
}
/** (ajout) La pièce verrouillée la plus proche d'être gagnée (« Prochaine pièce ») ; id "" : aucune. */
export interface PieceSuivanteVue {
  id: string;
  mesure: number;
  cible: number;
}
export interface Vue {
  /** La version du format de sauvegarde (3). */
  version: number;
  langue: Langue;
  reglages: Reglages;
  tutoriel: TutorielVue;
  niveauMax: number;
  /** La difficulté choisie, ramenée à une difficulté ouverte. */
  difficulte: Difficulte;
  vehicule: string;
  difficultes: DifficulteVue[];
  niveaux: NiveauVue[];
  vehicules: VehiculeVue[];
  pieces: PieceVue[];
  equipement: Equipement;
  infini: InfiniVue[];
  defi: DefiVue;
  totaux: Totaux;
  meilleurScore: number;
  derniere: DerniereVue;
  reprise: RepriseVue;
  prochainePiece: PieceSuivanteVue;
}
export interface Bilan {
  /** Les étoiles du secteur après la partie ([] hors campagne réussie). */
  etoiles: boolean[];
  nouvellesEtoiles: number[];
  record: boolean;
  ancienRecord: number;
  /** 0 : aucun. */
  niveauDebloque: number;
  cauchemarDebloque: boolean;
  paradoxeDebloque: boolean;
  pieces: string[];
  vehicules: string[];
  vue: Vue;
}
export interface PisteRadio {
  id: string;
  titre: string;
  auteur: string;
  /** (ajout) La licence telle qu'affichée (« original » pour une composition du site, « CC BY-SA 3.0 »…), et sa source. */
  licence: string;
  lien: string;
  /** (ajout) Composition à couches : la course la dose vraiment. */
  adaptative: boolean;
}
export interface EtatRadio {
  lecture: boolean;
  piste: string;
  pistes: PisteRadio[];
}
export interface Appareil {
  mobile: boolean;
  /** Le rapport de pixels réel de l'écran (la toile Unity est rendue à min(dpr, 1,5), comme la 3D du jeu web). */
  dpr: number;
  /** Appareil modeste ou économie de données demandée. */
  economie: boolean;
  /** (ajout) Mouvement réduit (système) ou animations coupées (site) : fondus brefs, pas de cinématique. */
  mouvementReduit: boolean;
  /** (ajout) Animations du site : 1, 0,5 (allégées) ou 0. */
  animations: number;
}
export interface Config {
  vue: Vue;
  langue: Langue;
  /** Jouer la sortie du tunnel (le portfolio a joué la fissure et le tunnel, sans qu'on les passe). */
  intro: boolean;
  /** Le tutoriel se lance directement (premier lancement depuis le menu). */
  tutorielAFaire: boolean;
  audioDebloque: boolean;
  appareil: Appareil;
  /** (ajout) L'écran demandé par le portfolio : « accueil » (le menu), « tutoriel », « reglages », « commandes »… */
  ecran: string;
}

// ---- Page → Unity (SendMessage('Pont', 'Recevoir', json)) ----
export type VersUnity =
  | ({ type: 'config' } & Config)
  | { type: 'vue'; vue: Vue }
  | { type: 'bilan'; bilan: Bilan }
  | { type: 'langue'; langue: Langue }
  | { type: 'radio'; etat: EtatRadio }
  | { type: 'pause' }
  | { type: 'reprendre' }
  | { type: 'fermer' }
  | { type: 'audio'; debloque: boolean };

// ---- Unity → page (PortalRush_Envoyer → window.__portalRushUnity.recevoir) ----
export const ECRANS = ['intro', 'menu', 'niveaux', 'garage', 'records', 'reglages', 'jeu', 'pause', 'fin', 'tutoriel'] as const;
export type EcranUnity = (typeof ECRANS)[number];
export type ActionRadio = 'lecture' | 'pause' | 'suivante' | 'precedente' | 'piste';
export type DepuisUnity =
  | { type: 'pret'; version: string }
  | { type: 'ecran'; nom: EcranUnity }
  /** voie −1 : non précisée. */
  | { type: 'evenement'; nom: TypeEvenement; valeur: number; voie: number }
  /** vitesse de 0 à 1 ; (ajout) avancement, boucliers et boss : la musique adaptative, comme rush.ts. */
  | { type: 'moteur'; actif: boolean; vitesse: number; overdrive: boolean; avancement: number; boucliers: number; boss: boolean }
  | { type: 'fin'; mode: Mode; difficulte: Difficulte; niveau: number; vehicule: string; graine: number; resultat: Resultat }
  | { type: 'reglages'; reglages: Reglages }
  | { type: 'vehicule'; id: string }
  | { type: 'equiper'; emplacement: Emplacement; piece: string }
  | { type: 'tutoriel'; etat: Tutoriel['etat']; phase: number }
  | { type: 'radio'; action: ActionRadio; piste: string }
  | { type: 'langue'; langue: Langue }
  | { type: 'fermer' }
  | { type: 'erreur'; message: string }
  /** (ajout) Un son de l'interface ou des cinématiques de Unity (son propre audio est coupé). */
  | { type: 'son'; nom: EvenementRush }
  /** (ajout) La difficulté choisie dans un menu (gardée comme le jeu web le fait). */
  | { type: 'difficulte'; difficulte: Difficulte };

/** Ce que la page met à la disposition du build Unity (PortalRushPont.jslib). */
export interface PontPage {
  recevoir(json: string): void;
}
