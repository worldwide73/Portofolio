// PORTAL RUSH — LES SAUVEGARDES (version 3, 16 octobre 2026)
//
// Tout reste dans le navigateur du joueur (localStorage) : le tutoriel, les secteurs débloqués et
// réussis, les étoiles, les records (par secteur et difficulté, avec la date et la version des règles),
// les records de survie et de distance par difficulté, le défi du jour, les statistiques cumulées (elles
// débloquent les pièces du garage et les vaisseaux), le vaisseau choisi, l'équipement, les réglages du
// jeu (commandes, effets, RUSH RADIO) et la dernière partie.
//
// SÛRETÉ :
//   - VERSIONNÉE : chaque sauvegarde porte son numéro de version. Une sauvegarde plus ancienne (v2,
//     « portal-rush-2 » ; v1, « portal-rush-1 ») est MIGRÉE sans rien perdre, et l'ancienne clé est
//     laissée telle quelle (elle sert de témoin, jamais effacée) ;
//   - VALIDÉE : le stockage est une entrée non fiable ; chaque champ est vérifié, un champ invalide
//     reprend sa valeur par défaut sans faire tomber le reste ;
//   - DOUBLÉE : chaque écriture réussie garde aussi la précédente dans une copie de secours. Une
//     sauvegarde illisible (JSON cassé) est mise de côté, telle quelle, et la copie de secours la remplace ;
//   - SANS ÉCRASEMENT : si un autre onglet a enregistré entre-temps (numéro de révision plus récent),
//     les deux progressions sont FUSIONNÉES (le meilleur de chacune) au lieu de s'écraser ;
//   - SANS STOCKAGE (navigation privée stricte, quota plein) : le jeu marche quand même, sans mémoire,
//     et le dit (« stockageDisponible »).
//
// Aucun classement en ligne : le projet n'a ni serveur ni comptes. Chaque record garde la version des
// règles (REGLES_VERSION) : seuls les scores obtenus avec les mêmes règles sont comparables.

import { EQUIPEMENT_DEPART, NIVEAUX, PIECES, VEHICULES, VEHICULE_DEPART, scoreEtoile, type Condition, type Equipement, type Mode, type Piece, type Vehicule } from './donnees';
import { ORDRE_DIFFICULTES, RANGS, REGLES_VERSION, type Difficulte } from './equilibrage';
import type { Resultat } from './moteur';

const CLE = 'portal-rush-3';
const SECOURS = 'portal-rush-3-secours';
const CORROMPUE = 'portal-rush-3-illisible';
const V2 = 'portal-rush-2';
const V1 = 'portal-rush-1';
export const VERSION_SAUVEGARDE = 3;

export interface RecordJeu {
  score: number;
  rang: string;
  date: string;
  regles: number;
}
export interface Reglages {
  /** Volume des effets du jeu, de 0 à 1 (il s'ajoute au réglage des effets du site). */
  volume: number;
  effetsReduits: boolean;
  secousses: boolean;
  aideCommandes: boolean;
  tactile: 'toucher' | 'glisser';
  /** RUSH RADIO : joue-t-elle en entrant dans le jeu ? Son volume, sa sourdine, sa dernière piste. */
  musique: boolean;
  volumeMusique: number;
  muet: boolean;
  piste: string;
  /** La séquence de fin de secteur : complète, ou courte (pour enchaîner). */
  sequenceFin: 'complete' | 'courte';
  /** (V4-H) La qualité graphique de la 3D : automatique (elle descend seule si les images ralentissent) ou fixée. */
  qualite: 'auto' | 'elevee' | 'equilibree' | 'economie';
}
/** Le tutoriel : jamais vu, commencé (la phase atteinte), terminé ou passé. Il ne se relance seul qu'à l'état « nouveau ». */
export interface Tutoriel {
  etat: 'nouveau' | 'commence' | 'termine' | 'passe';
  phase: number;
  date: string;
}
export interface Sauvegarde {
  version: 3;
  /** Augmente à chaque écriture : sert à détecter qu'un autre onglet a enregistré entre-temps. */
  revision: number;
  tutoriel: Tutoriel;
  /** Le dernier secteur débloqué (1 à 8). */
  niveauMax: number;
  /** Les secteurs réussis, par difficulté (clé « 3-expert »). */
  reussis: { [cle: string]: true };
  records: { [cle: string]: RecordJeu };
  /** Les étoiles gagnées, par secteur et difficulté (clé « 3-expert ») : [terminer, score, maîtrise]. Une étoile gagnée le reste. */
  etoiles: { [cle: string]: [boolean, boolean, boolean] };
  infini: { [d: string]: { score: number; distance: number; date: string; regles: number } };
  defi: { date: number; meilleur: number; dernier: number; tentatives: number; regles: number };
  /** Les jours où le défi a été mené au bout. */
  defisReussis: number[];
  /** Cumuls (pièces du garage) et meilleures valeurs en une seule partie (records personnels). */
  totaux: { parties: number; overdrives: number; parfaits: number; distance: number; multiplicateurMax: number; infiniMax: number; rangS: boolean; meilleurCombo: number; meilleursParfaits: number; meilleureDistance: number };
  derniere: { mode: Mode; difficulte: Difficulte; niveau: number } | null;
  difficulte: Difficulte;
  debloques: string[];
  equipement: Equipement;
  /** Les vaisseaux gagnés, et celui qui est choisi. */
  vehicules: Vehicule['id'][];
  vehicule: Vehicule['id'];
  reglages: Reglages;
  /** D'où vient cette sauvegarde (0 : créée en v3 ; 1 ou 2 : migrée de cette version). */
  origine: number;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function vide(): Sauvegarde {
  return {
    version: 3,
    revision: 0,
    tutoriel: { etat: 'nouveau', phase: 0, date: '' },
    niveauMax: 1,
    reussis: {},
    records: {},
    etoiles: {},
    infini: {},
    defi: { date: 0, meilleur: 0, dernier: 0, tentatives: 0, regles: REGLES_VERSION },
    defisReussis: [],
    totaux: { parties: 0, overdrives: 0, parfaits: 0, distance: 0, multiplicateurMax: 1, infiniMax: 0, rangS: false, meilleurCombo: 0, meilleursParfaits: 0, meilleureDistance: 0 },
    derniere: null,
    difficulte: 'as',
    debloques: PIECES.filter((p) => p.condition.type === 'depart').map((p) => p.id),
    equipement: { ...EQUIPEMENT_DEPART },
    vehicules: VEHICULES.filter((v) => v.condition.type === 'depart').map((v) => v.id),
    vehicule: VEHICULE_DEPART,
    reglages: { volume: 1, effetsReduits: false, secousses: true, aideCommandes: true, tactile: 'toucher', musique: true, volumeMusique: 0.6, muet: false, piste: '', sequenceFin: 'complete', qualite: 'auto' },
    origine: 0,
  };
}

/** Le stockage répond-il ? (Faux en navigation privée stricte, ou si le site n'a pas le droit d'écrire.) */
export let stockageDisponible = true;

function lireBrut(cle: string): { ok: true; valeur: unknown } | { ok: false; brut: string | null } {
  let brut: string | null = null;
  try {
    brut = localStorage.getItem(cle);
  } catch {
    stockageDisponible = false;
    return { ok: false, brut: null };
  }
  if (brut === null) return { ok: true, valeur: null };
  try {
    return { ok: true, valeur: JSON.parse(brut) };
  } catch {
    return { ok: false, brut };
  }
}
const objet = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {});

/** Une sauvegarde v2 (ou v3 lue telle quelle) : les champs communs sont repris, les nouveaux prennent leur valeur par défaut. */
function depuisV2(lu: Record<string, any>): Sauvegarde {
  const s = vide();
  const base = { ...s, ...lu };
  // Un secteur réussi avant l'arrivée des étoiles garde au moins sa première étoile.
  const etoiles = { ...objet(lu.etoiles) };
  for (const cle of Object.keys(objet(lu.reussis))) if (!etoiles[cle]) etoiles[cle] = [true, false, false];
  return { ...base, etoiles, version: 3, origine: 2 } as Sauvegarde;
}

/** Une sauvegarde de la première version : on garde les secteurs débloqués et les records (règles 1). */
function depuisV1(ancienne: Record<string, any>): Sauvegarde {
  const s = vide();
  s.niveauMax = Math.min(NIVEAUX.length, Number(ancienne.niveauMax) || 1);
  for (const [cle, r] of Object.entries(objet(ancienne.records))) {
    const v = objet(r);
    if (typeof v.score === 'number') s.records[cle] = { score: v.score, rang: String(v.rang ?? 'C'), date: '', regles: 1 };
  }
  s.origine = 1;
  return s;
}

/** Une sauvegarde tirée d'une valeur lue (n'importe quelle version), ou null si elle n'en est pas une. */
function interpreter(valeur: unknown): Sauvegarde | null {
  const lu = objet(valeur);
  if (lu.version === 3) return normaliser({ ...depuisV2(lu), origine: Number(lu.origine) || 0, tutoriel: lu.tutoriel, vehicules: lu.vehicules, vehicule: lu.vehicule, revision: lu.revision } as Sauvegarde);
  if (lu.version === 2) return normaliser(depuisV2(lu));
  return null;
}

/**
 * Charge la sauvegarde : la v3 ; sinon sa copie de secours (si la v3 est illisible, elle est mise de côté) ;
 * sinon une v2 ou une v1 migrée ; sinon une sauvegarde neuve. Ne réinitialise jamais une progression lisible.
 */
export function charger(): Sauvegarde {
  const principale = lireBrut(CLE);
  if (!stockageDisponible) return vide();
  if (principale.ok) {
    const s = interpreter(principale.valeur);
    if (s) return s;
  } else if (principale.brut !== null) {
    // Illisible : on la garde de côté (on ne détruit rien), puis on essaie la copie de secours.
    try {
      localStorage.setItem(CORROMPUE, principale.brut);
    } catch {
      // tant pis
    }
  }
  const secours = lireBrut(SECOURS);
  if (secours.ok) {
    const s = interpreter(secours.valeur);
    if (s) return s;
  }
  const v2 = lireBrut(V2);
  if (v2.ok && objet(v2.valeur).version === 2) return interpreter(v2.valeur) ?? vide();
  const v1 = lireBrut(V1);
  if (v1.ok && v1.valeur) return normaliser(depuisV1(objet(v1.valeur)));
  return vide();
}

/** Le stockage est une entrée non fiable : préserver les champs valides sans propager les types corrompus. */
function normaliser(lu: Sauvegarde): Sauvegarde {
  const s = vide();
  const nombre = (v: unknown, def = 0, max = Number.MAX_SAFE_INTEGER) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : def);
  const difficulte = (v: unknown): v is Difficulte => ORDRE_DIFFICULTES.includes(v as Difficulte);
  const cleValide = (cle: string) => {
    const [n, d] = cle.split('-');
    return /^[1-8]$/.test(n) && difficulte(d) && cle === `${n}-${d}`;
  };
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  s.revision = Math.floor(nombre(lu.revision));
  s.origine = Math.floor(nombre(lu.origine, 0, 3));
  const tu = objet(lu.tutoriel);
  if (['nouveau', 'commence', 'termine', 'passe'].includes(tu.etat)) s.tutoriel = { etat: tu.etat, phase: Math.floor(nombre(tu.phase, 0, 9)), date: date(tu.date) };
  // Un joueur qui a déjà joué (migration) n'a pas besoin du tutoriel automatique : il reste rejouable.
  if (s.tutoriel.etat === 'nouveau' && (nombre(objet(lu.totaux).parties) > 0 || Object.keys(objet(lu.reussis)).length > 0)) s.tutoriel = { etat: 'passe', phase: 0, date: '' };
  s.niveauMax = Math.max(1, Math.floor(nombre(lu.niveauMax, 1, NIVEAUX.length)));
  if (difficulte(lu.difficulte)) s.difficulte = lu.difficulte;
  for (const [cle, v] of Object.entries(objet(lu.reussis))) if (cleValide(cle) && v === true) s.reussis[cle] = true;
  for (const [cle, v] of Object.entries(objet(lu.etoiles))) if (cleValide(cle) && Array.isArray(v)) s.etoiles[cle] = [v[0] === true, v[1] === true, v[2] === true];
  for (const cle of Object.keys(s.reussis)) {
    s.etoiles[cle] ??= [true, false, false];
    s.etoiles[cle][0] = true;
  }
  for (const [cle, val] of Object.entries(objet(lu.records))) {
    const v = objet(val);
    if (cleValide(cle) && typeof v.score === 'number' && Number.isFinite(v.score) && v.score >= 0) s.records[cle] = { score: nombre(v.score), rang: RANGS.some(([r]) => r === v.rang) ? v.rang : 'C', date: date(v.date), regles: nombre(v.regles, 1) };
  }
  for (const [cle, val] of Object.entries(objet(lu.infini))) {
    const v = objet(val);
    if (difficulte(cle)) s.infini[cle] = { score: nombre(v.score), distance: nombre(v.distance), date: date(v.date), regles: nombre(v.regles, 1) };
  }
  for (const cle of Object.keys(s.defi) as (keyof Sauvegarde['defi'])[]) s.defi[cle] = nombre(objet(lu.defi)[cle], s.defi[cle]);
  for (const cle of Object.keys(s.totaux)) {
    const v = objet(lu.totaux)[cle];
    if (cle === 'rangS') s.totaux.rangS = v === true;
    else (s.totaux as unknown as Record<string, number>)[cle] = nombre(v, (s.totaux as unknown as Record<string, number>)[cle]);
  }
  s.defisReussis = Array.isArray(lu.defisReussis) ? [...new Set(lu.defisReussis.filter((v) => Number.isInteger(v) && v >= 20000101 && v <= 99991231))] : [];
  s.debloques = [...new Set([...s.debloques, ...(Array.isArray(lu.debloques) ? lu.debloques.filter((id) => PIECES.some((p) => p.id === id)) : [])])];
  for (const cle of Object.keys(s.equipement) as (keyof Equipement)[]) {
    const id = objet(lu.equipement)[cle];
    if (s.debloques.includes(id) && PIECES.some((p) => p.id === id && p.emplacement === cle)) s.equipement[cle] = id;
  }
  s.vehicules = [...new Set([...s.vehicules, ...(Array.isArray(lu.vehicules) ? lu.vehicules.filter((id) => VEHICULES.some((v) => v.id === id)) : [])])];
  if (s.vehicules.includes(lu.vehicule)) s.vehicule = lu.vehicule;
  const r = objet(lu.reglages);
  s.reglages.volume = nombre(r.volume, 1, 1);
  s.reglages.volumeMusique = nombre(r.volumeMusique, s.reglages.volumeMusique, 1);
  for (const cle of ['effetsReduits', 'secousses', 'aideCommandes', 'musique', 'muet'] as const) if (typeof r[cle] === 'boolean') s.reglages[cle] = r[cle];
  if (r.tactile === 'glisser') s.reglages.tactile = r.tactile;
  if (r.sequenceFin === 'courte') s.reglages.sequenceFin = 'courte';
  if (['elevee', 'equilibree', 'economie'].includes(r.qualite)) s.reglages.qualite = r.qualite;
  if (typeof r.piste === 'string' && r.piste.length < 40) s.reglages.piste = r.piste;
  const d = objet(lu.derniere);
  if (['campagne', 'infini', 'defi'].includes(d.mode) && difficulte(d.difficulte)) s.derniere = { mode: d.mode, difficulte: d.difficulte, niveau: Math.max(1, Math.floor(nombre(d.niveau, 1, NIVEAUX.length))) };
  // (Les vaisseaux dont la condition est déjà remplie — une progression migrée — sont gagnés tout de suite.)
  for (const v of VEHICULES) if (!s.vehicules.includes(v.id) && avancement(s, v.condition).faite) s.vehicules.push(v.id);
  return s;
}

const RANG_ORDRE = (r: string) => {
  const i = RANGS.findIndex(([x]) => x === r);
  return i < 0 ? RANGS.length : i;
};

/**
 * Fusionne deux progressions (deux onglets ont joué en même temps) : le meilleur de chacune. Rien ne
 * recule : secteurs, étoiles, records, pièces et vaisseaux s'additionnent ; les cumuls prennent le plus grand.
 */
export function fusionner(a: Sauvegarde, b: Sauvegarde): Sauvegarde {
  // La plus récente sert de base (réglages, équipement, vaisseau choisi) ; l'autre y apporte ses progrès.
  const [recente, o] = a.revision >= b.revision ? [a, b] : [b, a];
  const s: Sauvegarde = structuredClone(recente);
  s.niveauMax = Math.max(a.niveauMax, b.niveauMax);
  for (const cle of Object.keys(o.reussis)) s.reussis[cle] = true;
  for (const [cle, e] of Object.entries(o.etoiles)) s.etoiles[cle] = (s.etoiles[cle] ?? [false, false, false]).map((x, i) => x || e[i]) as [boolean, boolean, boolean];
  for (const [cle, r] of Object.entries(o.records)) {
    const m = s.records[cle];
    if (!m || r.score > m.score) s.records[cle] = { ...r, rang: m && RANG_ORDRE(m.rang) < RANG_ORDRE(r.rang) ? m.rang : r.rang };
  }
  for (const [d, r] of Object.entries(o.infini)) if (!s.infini[d] || r.score > s.infini[d].score) s.infini[d] = { ...r, distance: Math.max(r.distance, s.infini[d]?.distance ?? 0) };
  if (o.defi.date > s.defi.date) s.defi = { ...o.defi };
  else if (o.defi.date === s.defi.date) s.defi.meilleur = Math.max(s.defi.meilleur, o.defi.meilleur);
  s.defisReussis = [...new Set([...s.defisReussis, ...o.defisReussis])];
  for (const cle of Object.keys(s.totaux) as (keyof Sauvegarde['totaux'])[]) {
    if (cle === 'rangS') s.totaux.rangS = a.totaux.rangS || b.totaux.rangS;
    else (s.totaux as unknown as Record<string, number>)[cle] = Math.max(a.totaux[cle] as number, b.totaux[cle] as number);
  }
  s.debloques = [...new Set([...s.debloques, ...o.debloques])];
  s.vehicules = [...new Set([...s.vehicules, ...o.vehicules])];
  const fini = (t: Tutoriel) => t.etat === 'termine' || t.etat === 'passe';
  if (!fini(s.tutoriel) && fini(o.tutoriel)) s.tutoriel = { ...o.tutoriel };
  s.revision = Math.max(a.revision, b.revision);
  return s;
}

/**
 * Enregistre la sauvegarde. Si un autre onglet a écrit une révision plus récente entre-temps, les deux
 * progressions sont fusionnées (et la sauvegarde en mémoire est mise à jour). La version précédente est
 * gardée en copie de secours.
 */
export function enregistrer(s: Sauvegarde): void {
  if (!stockageDisponible) return;
  try {
    const actuel = lireBrut(CLE);
    let aEcrire = s;
    if (actuel.ok && actuel.valeur) {
      const disque = interpreter(actuel.valeur);
      if (disque && disque.revision > s.revision) {
        aEcrire = fusionner(s, disque);
        Object.assign(s, aEcrire);
      }
      // La version qui était sur le disque devient la copie de secours.
      if (disque) localStorage.setItem(SECOURS, JSON.stringify(disque));
    }
    s.revision = aEcrire.revision + 1;
    aEcrire.revision = s.revision;
    localStorage.setItem(CLE, JSON.stringify(aEcrire));
  } catch {
    // stockage indisponible ou plein : la partie n'est pas mémorisée cette fois
    stockageDisponible = false;
  }
}

/** Le tutoriel doit-il se lancer seul ? Une seule fois par profil : ni terminé ni passé. */
export const tutorielAFaire = (s: Sauvegarde) => s.tutoriel.etat === 'nouveau' || s.tutoriel.etat === 'commence';
export function noterTutoriel(s: Sauvegarde, etat: Tutoriel['etat'], phase = s.tutoriel.phase): void {
  // (Une fois terminé ou passé, l'entraînement ne redevient jamais « à faire » : le refaire depuis le menu ne
  // peut que mener de « passé » à « terminé ».)
  const avant = s.tutoriel.etat;
  if (avant === 'termine' || (avant === 'passe' && etat !== 'termine')) return;
  s.tutoriel = { etat, phase, date: aujourdhui() };
  enregistrer(s);
}

/** Vrai si le rang « a » est meilleur que « b ». */
const meilleurRang = (a: string, b: string) => {
  const ia = RANGS.findIndex(([r]) => r === a);
  const ib = RANGS.findIndex(([r]) => r === b);
  return ia >= 0 && (ib < 0 || ia < ib);
};

/** Où en est-on d'une condition (pour afficher « 12 / 25 ») ; « faite » si elle est remplie. */
export function avancement(s: Sauvegarde, c: Condition): { faite: boolean; mesure: number; cible: number } {
  switch (c.type) {
    case 'depart':
      return { faite: true, mesure: 1, cible: 1 };
    case 'niveau': {
      const fait = ORDRE_DIFFICULTES.some((d) => s.reussis[`${c.niveau}-${d}`]);
      return { faite: fait, mesure: fait ? 1 : 0, cible: 1 };
    }
    case 'rang':
      return { faite: s.totaux.rangS, mesure: s.totaux.rangS ? 1 : 0, cible: 1 };
    case 'difficulte': {
      const fait = Object.keys(s.reussis).some((cle) => cle.endsWith(`-${c.difficulte}`));
      return { faite: fait, mesure: fait ? 1 : 0, cible: 1 };
    }
    case 'infini':
      return { faite: s.totaux.infiniMax >= c.distance, mesure: Math.round(s.totaux.infiniMax), cible: c.distance };
    case 'total': {
      const mesure = c.stat === 'overdrives' ? s.totaux.overdrives : c.stat === 'parfaits' ? s.totaux.parfaits : s.defisReussis.length;
      return { faite: mesure >= c.valeur, mesure, cible: c.valeur };
    }
    case 'multiplicateur':
      return { faite: s.totaux.multiplicateurMax >= c.valeur, mesure: s.totaux.multiplicateurMax, cible: c.valeur };
  }
}

export const cauchemarOuvert = (s: Sauvegarde) => Object.keys(s.reussis).some((cle) => cle.endsWith('-expert') || cle.endsWith('-cauchemar') || cle.endsWith('-paradoxe'));
/** Paradoxe (V4) : un secteur réussi en Nightmare (ou déjà en Paradoxe). */
export const paradoxeOuvert = (s: Sauvegarde) => Object.keys(s.reussis).some((cle) => cle.endsWith('-cauchemar') || cle.endsWith('-paradoxe'));
/** Une difficulté est-elle ouverte ? */
export const difficulteOuverte = (s: Sauvegarde, d: Difficulte) => (d === 'cauchemar' ? cauchemarOuvert(s) : d === 'paradoxe' ? paradoxeOuvert(s) : true);
/** La plus haute difficulté ouverte, au plus « d ». */
export const difficulteJouable = (s: Sauvegarde, d: Difficulte): Difficulte => (difficulteOuverte(s, d) ? d : d === 'paradoxe' && cauchemarOuvert(s) ? 'cauchemar' : d === 'pilote' ? 'pilote' : 'expert');

/** « Continuer » : le prochain secteur de la campagne ; sans partie jouée, « Commencer » le secteur 01 (sorti de rush.ts). */
export function reprise(s: Sauvegarde): { premiere: boolean; niveau: number; difficulte: Difficulte } {
  const premiere = s.totaux.parties === 0 && !Object.keys(s.reussis).length;
  const niveau = premiere ? 1 : Math.min(s.niveauMax, NIVEAUX.length);
  const difficulte = difficulteJouable(s, s.difficulte);
  return { premiere, niveau, difficulte };
}

/** La pièce verrouillée la plus proche d'être gagnée (pour « Prochaine pièce »). */
export function prochainePiece(s: Sauvegarde): { piece: Piece; mesure: number; cible: number } | null {
  let meilleure: { piece: Piece; mesure: number; cible: number; part: number } | null = null;
  for (const piece of PIECES) {
    if (s.debloques.includes(piece.id)) continue;
    const a = avancement(s, piece.condition);
    const c = piece.condition;
    const part =
      c.type === 'multiplicateur' ? (a.mesure - 1) / (c.valeur - 1) : c.type === 'niveau' ? Math.min(0.95, (s.niveauMax - 1) / c.niveau) : a.cible ? a.mesure / a.cible : 0;
    if (!meilleure || part > meilleure.part) meilleure = { piece, mesure: a.mesure, cible: a.cible, part };
  }
  return meilleure;
}

/** Les étoiles d'un secteur dans une difficulté. */
export const etoilesDe = (s: Sauvegarde, niveau: number, d: Difficulte): [boolean, boolean, boolean] => s.etoiles[`${niveau}-${d}`] ?? [false, false, false];
/** Le nombre d'étoiles gagnées (dans une difficulté, ou en tout). */
export const totalEtoiles = (s: Sauvegarde, d?: Difficulte): number =>
  Object.entries(s.etoiles)
    .filter(([cle]) => !d || cle.endsWith(`-${d}`))
    .reduce((n, [, e]) => n + e.filter(Boolean).length, 0);

export interface Bilan {
  /** Les étoiles du secteur après la partie, et celles qui viennent d'être gagnées (0, 1, 2). */
  etoiles: [boolean, boolean, boolean] | null;
  nouvellesEtoiles: number[];
  record: boolean;
  ancienRecord: number;
  niveauDebloque: number | null;
  cauchemarDebloque: boolean;
  paradoxeDebloque: boolean;
  pieces: string[];
  vehicules: string[];
}

/** Range le résultat d'une partie : records, secteurs, statistiques, pièces. Renvoie ce qui est nouveau. */
export function ranger(s: Sauvegarde, mode: Mode, difficulte: Difficulte, niveauId: number, r: Resultat, graine: number): Bilan {
  const bilan: Bilan = { etoiles: null, nouvellesEtoiles: [], record: false, ancienRecord: 0, niveauDebloque: null, cauchemarDebloque: false, paradoxeDebloque: false, pieces: [], vehicules: [] };
  const cauchemarAvant = cauchemarOuvert(s);
  const paradoxeAvant = paradoxeOuvert(s);
  const t = s.totaux;
  t.parties++;
  t.overdrives += r.overdrives;
  t.parfaits += r.parfaits;
  t.distance += r.distance;
  t.multiplicateurMax = Math.max(t.multiplicateurMax, r.multiplicateurMax);
  t.meilleurCombo = Math.max(t.meilleurCombo, r.comboMax);
  t.meilleursParfaits = Math.max(t.meilleursParfaits, r.parfaits);
  t.meilleureDistance = Math.max(t.meilleureDistance, r.distance);
  s.derniere = { mode, difficulte, niveau: niveauId };

  if (mode === 'campagne') {
    const cle = `${niveauId}-${difficulte}`;
    const ancien = s.records[cle];
    bilan.ancienRecord = ancien?.score ?? 0;
    if (r.reussi) {
      // Les étoiles : 1 terminer ; 2 le score cible ; 3 l'objectif de maîtrise. Elles s'ajoutent à celles déjà gagnées.
      const n = NIVEAUX[niveauId - 1];
      const avant = s.etoiles[cle] ?? [false, false, false];
      const cetteFois: [boolean, boolean, boolean] = [true, r.score >= scoreEtoile(n, difficulte), r.objectifs.slice(1).some((o) => o.atteint)];
      const apres = avant.map((e, i) => e || cetteFois[i]) as [boolean, boolean, boolean];
      bilan.nouvellesEtoiles = apres.map((e, i) => (e && !avant[i] ? i : -1)).filter((i) => i >= 0);
      bilan.etoiles = apres;
      s.etoiles[cle] = apres;
      s.reussis[cle] = true;
      if (r.rang === 'S' || r.rang === 'SSS') t.rangS = true;
      if (niveauId >= s.niveauMax && niveauId < NIVEAUX.length) {
        s.niveauMax = niveauId + 1;
        bilan.niveauDebloque = niveauId + 1;
      }
    }
    // (Un record ne compte que si le secteur est réussi.)
    if (r.reussi && (!ancien || r.score > ancien.score || ancien.regles !== REGLES_VERSION)) {
      bilan.record = !ancien || r.score > ancien.score;
      s.records[cle] = { score: r.score, rang: !ancien || meilleurRang(r.rang, ancien.rang) || ancien.regles !== REGLES_VERSION ? r.rang : ancien.rang, date: aujourdhui(), regles: REGLES_VERSION };
    } else if (r.reussi && ancien && meilleurRang(r.rang, ancien.rang)) ancien.rang = r.rang;
  } else if (mode === 'infini') {
    const ancien = s.infini[difficulte];
    bilan.ancienRecord = ancien?.score ?? 0;
    t.infiniMax = Math.max(t.infiniMax, r.distance);
    if (!ancien || r.score > ancien.score) {
      bilan.record = true;
      s.infini[difficulte] = { score: r.score, distance: r.distance, date: aujourdhui(), regles: REGLES_VERSION };
    }
  } else {
    const memeJour = s.defi.date === graine;
    bilan.ancienRecord = memeJour ? s.defi.meilleur : 0;
    if (!memeJour) s.defi = { date: graine, meilleur: 0, dernier: 0, tentatives: 0, regles: REGLES_VERSION };
    s.defi.tentatives++;
    s.defi.dernier = r.score;
    if (r.score > s.defi.meilleur) {
      bilan.record = true;
      s.defi.meilleur = r.score;
    }
    if (r.arrive && !s.defisReussis.includes(graine)) s.defisReussis.push(graine);
  }

  // Les pièces dont la condition vient d'être remplie.
  for (const piece of PIECES) {
    if (s.debloques.includes(piece.id)) continue;
    if (avancement(s, piece.condition).faite) {
      s.debloques.push(piece.id);
      bilan.pieces.push(piece.id);
    }
  }
  // Les vaisseaux dont la condition vient d'être remplie.
  for (const v of VEHICULES) {
    if (s.vehicules.includes(v.id)) continue;
    if (avancement(s, v.condition).faite) {
      s.vehicules.push(v.id);
      bilan.vehicules.push(v.id);
    }
  }
  bilan.cauchemarDebloque = !cauchemarAvant && cauchemarOuvert(s);
  bilan.paradoxeDebloque = !paradoxeAvant && paradoxeOuvert(s);
  enregistrer(s);
  return bilan;
}
