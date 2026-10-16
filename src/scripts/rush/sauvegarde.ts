// PORTAL RUSH — LES SAUVEGARDES (version 2)
//
// Tout reste dans le navigateur du joueur (localStorage) : secteurs débloqués,
// records (par secteur et difficulté, avec la date et la version des règles),
// records de survie par difficulté, défi du jour, statistiques cumulées (elles
// débloquent les pièces du garage), équipement, réglages du jeu, dernière partie.
//
// Aucun classement en ligne : le projet n'a ni serveur ni comptes. Chaque record
// garde la version des règles (REGLES_VERSION) : le jour où un classement en
// ligne existera, seuls les scores obtenus avec les mêmes règles seront comparés.
// Si le stockage est indisponible, le jeu marche quand même, sans mémoire.

import { EQUIPEMENT_DEPART, NIVEAUX, PIECES, scoreEtoile, type Condition, type Equipement, type Mode, type Piece } from './donnees';
import { ORDRE_DIFFICULTES, RANGS, REGLES_VERSION, type Difficulte } from './equilibrage';
import type { Resultat } from './moteur';

const CLE = 'portal-rush-2';
const ANCIENNE = 'portal-rush-1';

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
}
export interface Sauvegarde {
  version: 2;
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
  reglages: Reglages;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function vide(): Sauvegarde {
  return {
    version: 2,
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
    reglages: { volume: 1, effetsReduits: false, secousses: true, aideCommandes: true, tactile: 'toucher' },
  };
}

export function charger(): Sauvegarde {
  try {
    const lu = JSON.parse(localStorage.getItem(CLE) ?? 'null');
    if (lu?.version === 2) {
      const base = vide();
      const s: Sauvegarde = { ...base, ...lu, totaux: { ...base.totaux, ...lu.totaux }, defi: { ...base.defi, ...lu.defi }, equipement: { ...base.equipement, ...lu.equipement }, reglages: { ...base.reglages, ...lu.reglages }, etoiles: { ...(lu.etoiles ?? {}) } };
      // Un secteur réussi avant l'arrivée des étoiles garde au moins sa première étoile.
      for (const cle of Object.keys(s.reussis)) if (!s.etoiles[cle]) s.etoiles[cle] = [true, false, false];
      return normaliser(s);
    }
    // Une sauvegarde de la première version : on garde les secteurs débloqués et les records (règles 1).
    const ancienne = JSON.parse(localStorage.getItem(ANCIENNE) ?? 'null');
    const s = vide();
    if (ancienne) {
      s.niveauMax = Math.min(NIVEAUX.length, ancienne.niveauMax ?? 1);
      for (const [cle, r] of Object.entries((ancienne.records ?? {}) as { [c: string]: { score: number; rang: string } })) s.records[cle] = { score: r.score, rang: r.rang, date: '', regles: 1 };
    }
    return normaliser(s);
  } catch {
    return vide();
  }
}

/** Le stockage est une entrée non fiable : préserver les champs valides sans propager les types corrompus. */
function normaliser(lu: Sauvegarde): Sauvegarde {
  const s = vide();
  const objet = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
  const nombre = (v: unknown, def = 0, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : def;
  const difficulte = (v: unknown): v is Difficulte => ORDRE_DIFFICULTES.includes(v as Difficulte);
  const cleValide = (cle: string) => /^[1-8]-(pilote|as|expert|cauchemar)$/.test(cle);
  const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
  s.niveauMax = Math.max(1, Math.floor(nombre(lu.niveauMax, 1, NIVEAUX.length)));
  if (difficulte(lu.difficulte)) s.difficulte = lu.difficulte;
  for (const [cle,v] of Object.entries(objet(lu.reussis))) if (cleValide(cle) && v === true) s.reussis[cle] = true;
  for (const [cle,v] of Object.entries(objet(lu.etoiles))) if (cleValide(cle) && Array.isArray(v)) s.etoiles[cle] = [v[0] === true,v[1] === true,v[2] === true];
  for (const cle of Object.keys(s.reussis)) {
    s.etoiles[cle] ??= [true,false,false];
    s.etoiles[cle][0] = true;
  }
  for (const [cle,val] of Object.entries(objet(lu.records))) {
    const v = objet(val);
    if (cleValide(cle) && typeof v.score === 'number' && Number.isFinite(v.score) && v.score >= 0) s.records[cle] = {score:nombre(v.score),rang:RANGS.some(([r]) => r === v.rang) ? v.rang : 'C',date:date(v.date),regles:nombre(v.regles,1)};
  }
  for (const [cle,val] of Object.entries(objet(lu.infini))) {
    const v = objet(val);
    if (difficulte(cle)) s.infini[cle] = {score:nombre(v.score),distance:nombre(v.distance),date:date(v.date),regles:nombre(v.regles,1)};
  }
  for (const cle of Object.keys(s.defi) as (keyof Sauvegarde['defi'])[]) s.defi[cle] = nombre(objet(lu.defi)[cle],s.defi[cle]);
  for (const cle of Object.keys(s.totaux)) {
    const v = objet(lu.totaux)[cle];
    if (cle === 'rangS') s.totaux.rangS = v === true;
    else (s.totaux as unknown as Record<string,number>)[cle] = nombre(v,(s.totaux as unknown as Record<string,number>)[cle]);
  }
  s.defisReussis = Array.isArray(lu.defisReussis) ? [...new Set(lu.defisReussis.filter(v => Number.isInteger(v) && v >= 20000101 && v <= 99991231))] : [];
  s.debloques = [...new Set([...s.debloques,...(Array.isArray(lu.debloques) ? lu.debloques.filter(id => PIECES.some(p => p.id === id)) : [])])];
  for (const cle of Object.keys(s.equipement) as (keyof Equipement)[]) {
    const id = objet(lu.equipement)[cle];
    if (s.debloques.includes(id) && PIECES.some(p => p.id === id && p.emplacement === cle)) s.equipement[cle] = id;
  }
  const r = objet(lu.reglages);
  s.reglages.volume = nombre(r.volume,1,1);
  for (const cle of ['effetsReduits','secousses','aideCommandes'] as const) if (typeof r[cle] === 'boolean') s.reglages[cle] = r[cle];
  if (r.tactile === 'glisser') s.reglages.tactile = r.tactile;
  const d = objet(lu.derniere);
  if (['campagne','infini','defi'].includes(d.mode) && difficulte(d.difficulte)) s.derniere = {mode:d.mode,difficulte:d.difficulte,niveau:Math.max(1,Math.floor(nombre(d.niveau,1,NIVEAUX.length)))};
  return s;
}

export function enregistrer(s: Sauvegarde): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(s));
  } catch {
    // stockage indisponible : la partie n'est pas mémorisée
  }
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

export const cauchemarOuvert = (s: Sauvegarde) => Object.keys(s.reussis).some((cle) => cle.endsWith('-expert') || cle.endsWith('-cauchemar'));

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
  pieces: string[];
}

/** Range le résultat d'une partie : records, secteurs, statistiques, pièces. Renvoie ce qui est nouveau. */
export function ranger(s: Sauvegarde, mode: Mode, difficulte: Difficulte, niveauId: number, r: Resultat, graine: number): Bilan {
  const bilan: Bilan = { etoiles: null, nouvellesEtoiles: [], record: false, ancienRecord: 0, niveauDebloque: null, cauchemarDebloque: false, pieces: [] };
  const cauchemarAvant = cauchemarOuvert(s);
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
  bilan.cauchemarDebloque = !cauchemarAvant && cauchemarOuvert(s);
  enregistrer(s);
  return bilan;
}
