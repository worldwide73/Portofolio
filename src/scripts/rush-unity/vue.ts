// PORTAL RUSH (Unity) — CE QUE UNITY VOIT DE LA SAUVEGARDE (18 octobre 2026)
//
// La « vue » est calculée ici, par les fonctions du jeu web (sauvegarde.ts, donnees.ts) : Unity n'a aucune règle de
// progression à réécrire (étoiles, déblocages, difficultés ouvertes, « Continuer », prochaine pièce). Elle est
// envoyée à l'ouverture (config), puis à chaque changement.

import { NIVEAUX, PIECES, VEHICULES, graineDuJour, scoreEtoile, type Condition } from '../rush/donnees';
import { ORDRE_DIFFICULTES } from '../rush/equilibrage';
import { VERSION_SAUVEGARDE, avancement, difficulteJouable, difficulteOuverte, etoilesDe, prochainePiece, reprise, tutorielAFaire, type Bilan as BilanJeu, type Sauvegarde } from '../rush/sauvegarde';
import { reglages as reglagesSite } from '../reglages';
import type { Bilan, ConditionVue, Langue, Vue } from './protocole';

/** La langue du site, telle que la page l'affiche. */
export const langueSite = (): Langue => (document.documentElement.lang.startsWith('en') ? 'en' : 'fr');

const conditionVue = (s: Sauvegarde, c: Condition): ConditionVue => {
  const a = avancement(s, c);
  return {
    type: c.type,
    mesure: a.mesure,
    cible: a.cible,
    faite: a.faite,
    niveau: c.type === 'niveau' ? c.niveau : 0,
    rang: c.type === 'rang' ? c.rang : '',
    difficulte: c.type === 'difficulte' ? c.difficulte : '',
    stat: c.type === 'total' ? c.stat : '',
  };
};

/** Le meilleur score enregistré, tous modes confondus (le même que l'accueil du jeu web). */
const meilleurScore = (s: Sauvegarde): number =>
  Math.max(0, ...Object.values(s.records).map((r) => r.score), ...Object.values(s.infini).map((r) => r.score), s.defi.meilleur);

export function calculerVue(s: Sauvegarde): Vue {
  const jour = graineDuJour();
  const duJour = s.defi.date === jour;
  const suite = prochainePiece(s);
  return {
    version: VERSION_SAUVEGARDE,
    langue: langueSite(),
    reglages: { ...s.reglages, sons: reglagesSite.sons, animations: reglagesSite.animations },
    tutoriel: { etat: s.tutoriel.etat, phase: s.tutoriel.phase, aFaire: tutorielAFaire(s) },
    niveauMax: s.niveauMax,
    difficulte: difficulteJouable(s, s.difficulte),
    vehicule: s.vehicule,
    difficultes: ORDRE_DIFFICULTES.map((d) => ({ id: d, ouverte: difficulteOuverte(s, d) })),
    niveaux: NIVEAUX.map((n) => ({
      id: n.id,
      theme: n.theme,
      debloque: n.id <= s.niveauMax,
      scores: ORDRE_DIFFICULTES.map((d) => {
        const cle = `${n.id}-${d}`;
        const r = s.records[cle];
        return { difficulte: d, reussi: !!s.reussis[cle], etoiles: [...etoilesDe(s, n.id, d)], record: r?.score ?? 0, rang: r?.rang ?? '', etoile: scoreEtoile(n, d) };
      }),
    })),
    vehicules: VEHICULES.map((v) => ({ id: v.id, modele: v.modele, debloque: s.vehicules.includes(v.id), condition: conditionVue(s, v.condition) })),
    pieces: PIECES.map((p) => ({
      id: p.id,
      emplacement: p.emplacement,
      couleur: p.couleur,
      debloquee: s.debloques.includes(p.id),
      equipee: s.equipement[p.emplacement] === p.id,
      condition: conditionVue(s, p.condition),
    })),
    equipement: { ...s.equipement },
    infini: ORDRE_DIFFICULTES.filter((d) => s.infini[d]).map((d) => ({ difficulte: d, score: s.infini[d].score, distance: s.infini[d].distance })),
    defi: { graine: jour, meilleur: duJour ? s.defi.meilleur : 0, dernier: duJour ? s.defi.dernier : 0, tentatives: duJour ? s.defi.tentatives : 0, reussis: s.defisReussis.length },
    totaux: { ...s.totaux },
    meilleurScore: meilleurScore(s),
    derniere: s.derniere ? { existe: true, ...s.derniere } : { existe: false, mode: '', difficulte: '', niveau: 0 },
    reprise: reprise(s),
    prochainePiece: suite ? { id: suite.piece.id, mesure: suite.mesure, cible: suite.cible } : { id: '', mesure: 0, cible: 0 },
  };
}

/** Le bilan d'une partie (retour de « ranger »), dans la forme du contrat, avec la vue d'après. */
export const calculerBilan = (b: BilanJeu, s: Sauvegarde): Bilan => ({
  etoiles: b.etoiles ? [...b.etoiles] : [],
  nouvellesEtoiles: [...b.nouvellesEtoiles],
  record: b.record,
  ancienRecord: b.ancienRecord,
  niveauDebloque: b.niveauDebloque ?? 0,
  cauchemarDebloque: b.cauchemarDebloque,
  paradoxeDebloque: b.paradoxeDebloque,
  pieces: [...b.pieces],
  vehicules: [...b.vehicules],
  vue: calculerVue(s),
});
