// PORTAL RUSH (Unity) — LE PONT, CÔTÉ PAGE (18 octobre 2026)
//
// Unity affiche et fait jouer ; la page garde la sauvegarde (format v3 : sauvegarde.ts, ranger, enregistrer…),
// l'audio (sons.ts, RUSH RADIO, DREAM RADIO) et la langue du site (contrat docs/UNITY_ARCHITECTURE.md, §1 et §5).
// Unity parle par window.__portalRushUnity.recevoir(json) (PortalRushPont.jslib) ; la page lui répond par
// SendMessage('Pont', 'Recevoir', json). Tant que Unity n'écoute pas encore (« brancher », appelé par index.ts
// après « pret » et l'arrivée du voyage), les messages de la page attendent dans une file ; « config » passe
// toujours en premier. Les messages de Unity sont traités juste après son appel (jamais pendant), et vérifiés :
// une donnée invalide ne touche jamais la sauvegarde. Les sons et la musique suivent les règles de l'ancien jeu
// (rush/sons-course.ts, extraites de rush.ts) : mêmes sons, même musique adaptative, même séquence de fin.

import { creerRushRadio } from '../audio/rush-radio';
import { enMarche, quandMoteur } from '../audio/moteur';
import type { Adaptation } from '../audio/radio';
import { changerLangue } from '../langue';
import { mouvementReduit } from '../outils';
import { regler, reglages as reglagesSite } from '../reglages';
import { arreterMoteurRush, moteurRush, reglerVolumeRush, sonRush, type EvenementRush } from '../sons';
import { EMPLACEMENTS, NIVEAUX, PIECES, VEHICULES, type Difficulte, type Emplacement, type Mode } from '../rush/donnees';
import { ORDRE_DIFFICULTES, RANGS } from '../rush/equilibrage';
import type { ObjectifAtteint, Resultat, TypeEvenement } from '../rush/moteur';
import { charger, difficulteOuverte, enregistrer, noterTutoriel, ranger, type Sauvegarde, type Tutoriel } from '../rush/sauvegarde';
import { SON_EVENEMENT, adaptationCourse, adaptationFixe, cleAdaptation, finVictorieuse } from '../rush/sons-course';
import { ECRANS, type Appareil, type EcranUnity, type EtatRadio, type PontPage, type VersUnity } from './protocole';
import { calculerBilan, calculerVue, langueSite } from './vue';

const NOMS_EVENEMENTS: TypeEvenement[] = ['deplacement', 'parfait', 'fragment', 'dore', 'noyau', 'choc', 'portail', 'overdrive', 'fin-overdrive', 'pret', 'detruit', 'boss-touche', 'phase-boss', 'phase', 'motif', 'combo-perdu', 'conseil', 'od-ouvert', 'fin'];
const SONS: EvenementRush[] = ['deplacement', 'fragment', 'noyau', 'parfait', 'choc', 'portail', 'overdrive', 'pret', 'detruit', 'boss', 'phase', 'victoire', 'defaite', 'ouverture', 'sortie'];
const OBJECTIFS = ['fin', 'fragments', 'parfaits', 'portails', 'boss', 'score', 'combo', 'chocsMax'];
const NOMBRES_RESULTAT = ['score', 'note', 'fragments', 'fragmentsVus', 'parfaits', 'comboMax', 'multiplicateurMax', 'motifs', 'distance', 'temps', 'chocs', 'portails', 'overdrives'] as const;
const journal = (...x: unknown[]) => console.info('[Portal Rush · Unity]', ...x);

// ---- La sauvegarde et RUSH RADIO : une seule de chaque pour la page (comme dans rush.ts) ----
let s: Sauvegarde = charger();
let radio: ReturnType<typeof creerRushRadio> | null = null;
let surRadio: (() => void) | null = null;
const rushRadio = () =>
  (radio ??= (() => {
    const r = creerRushRadio({
      lire: () => ({ piste: s.reglages.piste, volume: s.reglages.volumeMusique, muet: s.reglages.muet }),
      ecrire: (p) => {
        s.reglages.piste = p.piste;
        s.reglages.volumeMusique = p.volume;
        s.reglages.muet = p.muet;
        enregistrer(s);
      },
    });
    r.surChangement(() => surRadio?.());
    return r;
  })());

/** Animations coupées (système ou réglage du site) : comme animationsCoupees() de rush.ts. */
export const animationsCoupees = () => mouvementReduit || reglagesSite.animations === 0;

const nombre = (v: unknown, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut);
const texte = (v: unknown) => (typeof v === 'string' ? v : '');
const borne = (v: number) => Math.max(0, Math.min(1, v));

/** Un résultat venu de Unity, vérifié champ par champ : la forme exacte du Resultat du jeu web, ou rien. */
function lireResultat(x: unknown): Resultat | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.reussi !== 'boolean' || typeof o.arrive !== 'boolean') return null;
  const rang = texte(o.rang);
  if (rang !== '—' && !RANGS.some(([r]) => r === rang)) return null;
  const valeurs: Partial<Record<(typeof NOMBRES_RESULTAT)[number], number>> = {};
  for (const k of NOMBRES_RESULTAT) {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    valeurs[k] = v;
  }
  if (!Array.isArray(o.objectifs)) return null;
  const objectifs: ObjectifAtteint[] = [];
  for (const brut of o.objectifs) {
    const b = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
    if (!OBJECTIFS.includes(texte(b.type)) || typeof b.atteint !== 'boolean' || !Number.isFinite(b.valeur) || !Number.isFinite(b.mesure)) return null;
    objectifs.push({ type: b.type as ObjectifAtteint['type'], valeur: b.valeur as number, atteint: b.atteint, mesure: b.mesure as number });
  }
  return { reussi: o.reussi, arrive: o.arrive, objectifs, rang, ...(valeurs as Record<(typeof NOMBRES_RESULTAT)[number], number>) };
}

export interface OptionsPont {
  fenetre: HTMLDialogElement;
  /** Lu au moment d'envoyer « config » : l'écran demandé, la sortie du tunnel à jouer, le tutoriel à lancer. */
  ouverture: () => { ecran: string; intro: boolean; tutoriel: boolean };
  pret: (version: string) => void;
  /** Chaque écran annoncé par Unity (index.ts y lit la sortie du tunnel, « intro », puis l'arrivée dans le monde). */
  ecran: (nom: EcranUnity, avant: EcranUnity | '') => void;
  fermer: () => void;
  erreur: (message: string) => void;
}
export interface Pont {
  /** Unity écoute : « config », puis la file. */
  brancher(envoi: (json: string) => void): void;
  readonly branche: boolean;
  envoyer(m: VersUnity): void;
  /** RUSH RADIO prend le relais si le joueur la veut (à l'arrivée dans le jeu, comme rush.ts). */
  demarrerMusique(court: boolean): void;
  /** Coupe le son du jeu et les écouteurs ; les messages qui arrivent encore sont ignorés. */
  arreter(): void;
  readonly ecran: EcranUnity | '';
}

/** Le pont d'une ouverture de la version Unity. */
export function creerPont(o: OptionsPont): Pont {
  s = charger();
  const r = rushRadio();
  r.relirePreferences();
  reglerVolumeRush(s.reglages.volume);
  let envoi: ((json: string) => void) | null = null;
  let actif = true;
  const file: VersUnity[] = [];
  const minuteries = new Set<number>();
  const minuter = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      minuteries.delete(id);
      if (actif) fn();
    }, ms);
    minuteries.add(id);
  };

  const ecrire = (m: VersUnity) => {
    try {
      envoi?.(JSON.stringify(m));
    } catch (e) {
      console.warn('[Portal Rush · Unity] envoi impossible', m.type, e);
    }
  };
  const envoyer = (m: VersUnity) => {
    if (!actif) return;
    if (envoi) ecrire(m);
    else file.push(m);
  };
  const envoyerVue = () => envoyer({ type: 'vue', vue: calculerVue(s) });

  // ---- RUSH RADIO ----
  let cleRadio = '';
  const etatRadio = (): EtatRadio => ({
    lecture: r.enLecture,
    piste: r.piste.id,
    pistes: r.pistes.map((p) => ({ id: p.id, titre: p.titre, auteur: p.artiste, licence: p.licence, lien: p.lien ?? '', adaptative: !!p.adaptative })),
  });
  const envoyerRadio = (toujours = false) => {
    const e = etatRadio();
    const cle = `${e.lecture}|${e.piste}`;
    if (!toujours && cle === cleRadio) return;
    cleRadio = cle;
    envoyer({ type: 'radio', etat: e });
  };
  surRadio = () => actif && envoi && envoyerRadio();
  /** La lecture choisie devient la préférence d'entrée (jouer ou non en ouvrant le jeu), comme rush.ts. */
  const retenirLecture = () => {
    s.reglages.musique = r.enLecture;
    enregistrer(s);
  };

  // ---- La musique adaptative et la séquence de fin (rush.ts : suivreSon, finDePartie, terminer) ----
  let ecran: EcranUnity | '' = '';
  const COURSE = { vitesse: 0, avancement: 0, boucliers: 99, boss: false, overdrive: false };
  let course = { ...COURSE };
  let fin: { victoire: boolean; secteurReussi: boolean; nouvellesEtoiles: number; sequence: boolean; musique: 'victoire' | 'defaite'; resultats: boolean } | null = null;
  let cleMusique = '';
  const adapter = () => {
    let a: Adaptation;
    if (fin?.sequence) a = adaptationFixe(fin.musique);
    else if (ecran === 'fin') a = adaptationFixe(fin?.secteurReussi ? 'victoire' : 'defaite');
    else if (ecran === 'pause') a = adaptationFixe('pause');
    else if (ecran === 'jeu' || ecran === 'tutoriel') a = adaptationCourse(course);
    else a = adaptationFixe('menu');
    const cle = cleAdaptation(a);
    if (cle === cleMusique) return;
    cleMusique = cle;
    r.adapter(a);
  };

  // ---- Ce qui change autour (autre onglet, langue, audio débloqué) ----
  const surStockage = (e: StorageEvent) => {
    if (e.key !== 'portal-rush-3' || ecran === 'jeu' || ecran === 'pause' || ecran === 'tutoriel') return;
    s = charger();
    r.relirePreferences();
    envoyerVue();
  };
  const surLangue = () => {
    envoyer({ type: 'langue', langue: langueSite() });
    envoyerVue();
  };
  let audio: AudioContext | null = null;
  const surAudio = () => audio?.state === 'running' && envoyer({ type: 'audio', debloque: true });
  window.addEventListener('storage', surStockage);
  window.addEventListener('langue', surLangue);
  quandMoteur((c) => {
    if (!actif) return;
    audio = c;
    c.addEventListener('statechange', surAudio);
  });

  const appareil = (): Appareil => {
    const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    return {
      mobile: window.matchMedia('(pointer: coarse)').matches,
      dpr: window.devicePixelRatio || 1,
      economie: n.connection?.saveData === true || (n.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2,
      mouvementReduit: animationsCoupees(),
      animations: reglagesSite.animations,
    };
  };

  // ==========================================================================
  // LES MESSAGES DE UNITY
  // ==========================================================================
  const traiter = (brut: string) => {
    if (!actif) return;
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(brut);
    } catch {
      return console.warn('[Portal Rush · Unity] message illisible', brut.slice(0, 160));
    }
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
    if (import.meta.env.DEV) ((window as unknown as { __rushUnityRecus?: unknown[] }).__rushUnityRecus ??= []).push(m);
    switch (m.type) {
      case 'pret':
        return o.pret(texte(m.version));
      case 'erreur':
        console.warn('[Portal Rush · Unity] erreur signalée par Unity :', texte(m.message));
        return o.erreur(texte(m.message));
      case 'fermer':
        return o.fermer();

      case 'ecran': {
        const nom = (ECRANS as readonly string[]).includes(texte(m.nom)) ? (m.nom as EcranUnity) : null;
        if (!nom) return;
        const avant = ecran;
        ecran = nom;
        const enCourse = nom === 'jeu' || nom === 'tutoriel';
        // Une nouvelle partie (pas un retour de pause) : la fin d'avant est oubliée.
        if (enCourse && avant !== 'pause' && avant !== 'jeu' && avant !== 'tutoriel') {
          fin = null;
          course = { ...COURSE };
        }
        if (!enCourse) {
          arreterMoteurRush();
          if (fin?.sequence) fin.sequence = false;
        }
        // Comme pause() de rush.ts : un petit son à l'entrée en pause.
        if (nom === 'pause' && avant !== 'pause') sonRush('deplacement');
        // Les résultats (terminer() de rush.ts) : victoire ou défaite, puis les étoiles nouvelles.
        if (nom === 'fin' && fin && !fin.resultats) {
          fin.resultats = true;
          sonRush(fin.victoire ? 'victoire' : 'defaite');
          if (fin.nouvellesEtoiles) minuter(() => sonRush('pret'), 500);
        }
        adapter();
        return o.ecran(nom, avant);
      }

      case 'evenement': {
        const nom = texte(m.nom) as TypeEvenement;
        if (!NOMS_EVENEMENTS.includes(nom)) return;
        const son = SON_EVENEMENT[nom];
        if (son) sonRush(son);
        return;
      }
      case 'son': {
        const nom = texte(m.nom) as EvenementRush;
        if (SONS.includes(nom)) sonRush(nom);
        return;
      }
      case 'moteur': {
        const vitesse = borne(nombre(m.vitesse));
        course = {
          vitesse,
          avancement: borne(nombre(m.avancement)),
          boucliers: typeof m.boucliers === 'number' && Number.isFinite(m.boucliers) ? m.boucliers : COURSE.boucliers,
          boss: m.boss === true,
          overdrive: m.overdrive === true,
        };
        moteurRush({ actif: m.actif === true && (ecran === 'jeu' || ecran === 'tutoriel'), vitesse, overdrive: course.overdrive });
        return adapter();
      }

      case 'fin': {
        const mode = texte(m.mode) as Mode;
        const r2 = lireResultat(m.resultat);
        // (Comme demarrer() de rush.ts : le défi se court toujours en Ace ; survie et défi comptent « secteur 1 ».)
        const difficulte = (mode === 'defi' ? 'as' : texte(m.difficulte)) as Difficulte;
        const niveau = mode === 'campagne' ? Math.floor(nombre(m.niveau)) : 1;
        const graine = nombre(m.graine);
        const valide =
          !!r2 &&
          ['campagne', 'infini', 'defi'].includes(mode) &&
          ORDRE_DIFFICULTES.includes(difficulte) &&
          difficulteOuverte(s, difficulte) &&
          (mode !== 'campagne' || (niveau >= 1 && niveau <= Math.min(s.niveauMax, NIVEAUX.length))) &&
          (mode !== 'defi' || (Number.isInteger(graine) && graine >= 20000101 && graine <= 99991231));
        if (!r2 || !valide) {
          console.warn('[Portal Rush · Unity] fin refusée (données invalides) : la sauvegarde ne change pas.', m);
          return envoyer({ type: 'bilan', bilan: { etoiles: [], nouvellesEtoiles: [], record: false, ancienRecord: 0, niveauDebloque: 0, cauchemarDebloque: false, paradoxeDebloque: false, pieces: [], vehicules: [], vue: calculerVue(s) } });
        }
        if (mode !== 'defi') s.difficulte = difficulte;
        // ranger() met à jour records, étoiles, secteurs, totaux, pièces, vaisseaux, et enregistre (format v3).
        const bilan = calculerBilan(ranger(s, mode, difficulte, niveau, r2, graine), s);
        envoyer({ type: 'bilan', bilan });
        // La séquence de fin (finDePartie) : sa musique, et le souffle d'ouverture d'une victoire.
        const victoire = finVictorieuse(mode, r2);
        const court = animationsCoupees();
        const complete = victoire && !court && s.reglages.sequenceFin !== 'courte';
        fin = { victoire, secteurReussi: mode === 'campagne' && r2.reussi, nouvellesEtoiles: bilan.nouvellesEtoiles.length, sequence: true, musique: complete ? 'victoire' : 'defaite', resultats: false };
        if (victoire && !court) {
          if (s.reglages.sequenceFin === 'courte') sonRush('ouverture');
          else minuter(() => fin?.sequence && sonRush('ouverture'), 1150);
        }
        return adapter();
      }

      case 'reglages': {
        const n = (m.reglages && typeof m.reglages === 'object' ? m.reglages : {}) as Record<string, unknown>;
        const g = s.reglages;
        if (typeof n.volume === 'number' && Number.isFinite(n.volume) && borne(n.volume) !== g.volume) {
          g.volume = borne(n.volume);
          reglerVolumeRush(g.volume);
          sonRush('fragment');
        }
        for (const cle of ['effetsReduits', 'secousses', 'aideCommandes'] as const) if (typeof n[cle] === 'boolean') g[cle] = n[cle] as boolean;
        if (n.tactile === 'toucher' || n.tactile === 'glisser') g.tactile = n.tactile;
        if (n.sequenceFin === 'complete' || n.sequenceFin === 'courte') g.sequenceFin = n.sequenceFin;
        if (n.qualite === 'auto' || n.qualite === 'elevee' || n.qualite === 'equilibree' || n.qualite === 'economie') g.qualite = n.qualite;
        // RUSH RADIO (ses préférences s'écrivent d'elles-mêmes dans la sauvegarde).
        if (typeof n.volumeMusique === 'number' && Number.isFinite(n.volumeMusique) && borne(n.volumeMusique) !== r.etat.volume) r.reglerVolume(borne(n.volumeMusique));
        if (typeof n.muet === 'boolean' && n.muet !== r.etat.muet) r.basculerMuet();
        if (typeof n.piste === 'string' && n.piste !== r.piste.id) {
          const i = r.pistes.findIndex((p) => p.id === n.piste);
          if (i >= 0) r.choisir(i, r.enLecture);
        }
        if (typeof n.musique === 'boolean' && n.musique !== g.musique) {
          g.musique = n.musique;
          if (n.musique) r.jouer();
          else r.pauser();
        }
        // Les réglages du site que le jeu montre aussi.
        if (typeof n.sons === 'boolean' && n.sons !== reglagesSite.sons) {
          regler('sons', n.sons);
          if (n.sons) sonRush('pret');
        }
        if ((n.animations === 0 || n.animations === 0.5 || n.animations === 1) && n.animations !== reglagesSite.animations) regler('animations', n.animations);
        enregistrer(s);
        return envoyerVue();
      }

      case 'vehicule': {
        // Un vaisseau gagné se choisit (rush.ts) ; un vaisseau verrouillé, non.
        const id = texte(m.id) as (typeof VEHICULES)[number]['id'];
        if (s.vehicules.includes(id) && id !== s.vehicule) {
          s.vehicule = id;
          enregistrer(s);
          sonRush('pret');
        }
        return envoyerVue();
      }
      case 'equiper': {
        const emplacement = texte(m.emplacement) as Emplacement;
        const piece = PIECES.find((p) => p.id === m.piece && p.emplacement === emplacement);
        if (EMPLACEMENTS.includes(emplacement) && piece && s.debloques.includes(piece.id)) {
          s.equipement[emplacement] = piece.id;
          enregistrer(s);
          sonRush('pret');
        }
        return envoyerVue();
      }
      case 'difficulte': {
        const d = texte(m.difficulte) as Difficulte;
        if (ORDRE_DIFFICULTES.includes(d) && difficulteOuverte(s, d) && d !== s.difficulte) {
          s.difficulte = d;
          enregistrer(s);
          sonRush('deplacement');
        }
        return envoyerVue();
      }
      case 'tutoriel': {
        const etat = texte(m.etat) as Tutoriel['etat'];
        const phase = Math.floor(nombre(m.phase));
        // noterTutoriel() garde la règle : terminé ou passé, il ne redevient jamais « à faire ».
        if (['nouveau', 'commence', 'termine', 'passe'].includes(etat) && phase >= 0 && phase <= 9) noterTutoriel(s, etat, phase);
        return envoyerVue();
      }

      case 'radio': {
        const action = texte(m.action);
        if (action === 'lecture') {
          if (!r.enLecture) r.jouer();
          retenirLecture();
        } else if (action === 'pause') {
          r.pauser();
          retenirLecture();
        } else if (action === 'suivante') r.suivante();
        else if (action === 'precedente') r.precedente();
        else if (action === 'piste') {
          const i = r.pistes.findIndex((p) => p.id === m.piste);
          if (i >= 0) {
            r.choisir(i, true);
            retenirLecture();
          }
        }
        return envoyerRadio(true);
      }

      case 'langue': {
        const langue = m.langue === 'en' || m.langue === 'fr' ? m.langue : null;
        if (!langue) return;
        if (langue === langueSite()) return envoyer({ type: 'langue', langue });
        // Le changement de langue du site, sans rechargement (langue.ts) ; l'évènement « langue » répondra.
        const lien = o.fenetre.querySelector<HTMLAnchorElement>(`[data-langue-choix="${langue}"]`) ?? document.querySelector<HTMLAnchorElement>(`a[data-langue][hreflang="${langue}"]`);
        if (lien) void changerLangue(lien.href);
        return;
      }
    }
  };

  const page: PontPage = { recevoir: (json: string) => queueMicrotask(() => traiter(String(json))) };
  (window as unknown as { __portalRushUnity?: PontPage }).__portalRushUnity = page;

  return {
    brancher(f) {
      if (envoi || !actif) return;
      envoi = f;
      const ouverture = o.ouverture();
      // « config » d'abord (elle contient la vue et la langue du moment) ; la file ensuite, sans ce qu'elle remplace.
      const reste = file.splice(0).filter((x) => x.type !== 'vue' && x.type !== 'langue' && x.type !== 'config');
      ecrire({ type: 'config', vue: calculerVue(s), langue: langueSite(), intro: ouverture.intro, tutorielAFaire: ouverture.tutoriel, audioDebloque: !!enMarche(), appareil: appareil(), ecran: ouverture.ecran });
      reste.forEach(ecrire);
      envoyerRadio(true);
      adapter();
    },
    get branche() {
      return !!envoi;
    },
    get ecran() {
      return ecran;
    },
    envoyer,
    demarrerMusique(court) {
      if (s.reglages.musique) minuter(() => r.jouer(), court ? 100 : 400);
    },
    arreter() {
      if (!actif) return;
      actif = false;
      minuteries.forEach((id) => window.clearTimeout(id));
      minuteries.clear();
      surRadio = null;
      r.arreter();
      r.adapter(null);
      arreterMoteurRush();
      window.removeEventListener('storage', surStockage);
      window.removeEventListener('langue', surLangue);
      audio?.removeEventListener('statechange', surAudio);
      // (Unity peut encore appeler la page pendant qu'il s'arrête : le pont reste en place, muet ; index.ts le retire.)
    },
  };
}

/** (Développement) La sauvegarde vue par le pont, pour les recettes. */
export const sauvegardePont = () => s;
