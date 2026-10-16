// PORTAL RUSH — L'INTERFACE (version 3)
//
// La fenêtre du jeu (PortalRush.astro) contient la scène, le HUD, une barre du
// haut, des écrans et un panneau de réglages. L'attribut data-ecran de la fenêtre
// dit quel écran est affiché (vide pendant la course) ; data-panneau, si les
// réglages sont ouverts par-dessus ; data-theme, le monde du secteur. Tout ce qui
// s'affiche vient des vraies données : la sauvegarde (records, progression,
// pièces, étoiles), le moteur (score, combo, jauge, objectifs) et l'équilibrage.
//
// LES TOUCHES, selon l'écran :
//   course      ← → (A / D, Q / D) changer de voie ; Espace (↑) Overdrive ; Échap ou P pause
//   menus       flèches : d'une commande à l'autre ; Entrée ou Espace : la commande
//               qui a le focus, sinon l'action principale de l'écran (Continuer,
//               Reprendre, Rejouer…) ; jamais deux fois pour un seul appui
//   Échap       ferme le sélecteur de langue ou le panneau ; met en pause ; reprend ;
//               revient au menu ; depuis le menu, quitte le jeu (repère en haut à gauche)
//   R           recommencer (après une partie ; en pause, avec confirmation)
//
// L'OUVERTURE ET LA FERMETURE sont des transitions de cinéma (portail, onde,
// particules, caméra) ; elles se réduisent à un fondu si les animations sont
// coupées. À la fermeture, tout s'arrête : boucle, moteur, touches.

import type { Contenu } from '../../contenu/types';
import { revenirAccueil } from '../voyage';
import { mouvementReduit } from '../outils';
import { regler, reglages as reglagesSite } from '../reglages';
import { arreterMoteurRush, moteurRush, reglerVolumeRush, sonRush } from '../sons';
import { dreamRadio } from '../audio/dream';
import { creerRushRadio } from '../audio/rush-radio';
import { tamponPret } from '../audio/moteur';
import type { Adaptation } from '../audio/radio';
import { NIVEAUX, PIECES, VEHICULES, graineDuJour, scoreEtoile, type Condition, type Difficulte, type Mode, type Objectif, type Theme } from './donnees';
import { ORDRE_DIFFICULTES, PROFILS, REGLES_VERSION } from './equilibrage';
import { Partie, type ObjectifAtteint } from './moteur';
import { creerRendu, dessinerVaisseau } from './rendu';
import type { RenduJeu } from './scene/scene';
import { avancement, cauchemarOuvert, charger, difficulteJouable, difficulteOuverte, enregistrer, etoilesDe, paradoxeOuvert, prochainePiece, ranger, totalEtoiles, type Bilan, type Sauvegarde } from './sauvegarde';

type Ecran = 'accueil' | 'campagne' | 'infini' | 'defi' | 'records' | 'garage' | 'pause' | 'fin' | 'victoire' | '';
type Textes = Contenu['rush'];
type Ouverture = Ecran | 'reglages' | 'commandes';
type Confirmation = '' | 'recommencer' | 'menu' | 'quitter';

let api: { ouvrir: (ecran?: Ouverture, origine?: HTMLElement | null) => void; pause: () => boolean } | null = null;
/** Ouvre le jeu (sur son menu, ou un autre écran ; « commandes » : les réglages, page des commandes). */
export const ouvrirRush = (ecran: Ouverture = 'accueil') => api?.ouvrir(ecran);
/** Met la partie en pause si elle est en cours. Renvoie vrai si c'était le cas. */
export const pauseRush = () => api?.pause() ?? false;

export function initRush(): void {
  const fenetre = document.querySelector<HTMLDialogElement>('.rush');
  const toile = fenetre?.querySelector<HTMLCanvasElement>('.rush__toile');
  const ctx = toile?.getContext('2d');
  if (!fenetre || !toile || !ctx) return;
  const apercu = fenetre.querySelector<HTMLCanvasElement>('.garage__apercu');
  const ctxApercu = apercu?.getContext('2d') ?? null;

  const lire = (): Textes => JSON.parse(fenetre.dataset.textes ?? '{}');
  let textes = lire();
  // La scène 3D (WebGL 2) ; sinon, le rendu 2D d'origine. Son code est chargé à
  // part, à l'approche du jeu (survol de l'Orbital Hub) ou à son ouverture.
  const toileMonde = fenetre.querySelector<HTMLCanvasElement>('.rush__monde');
  let scene: RenduJeu | null = null;
  let chargement: Promise<void> | null = null;
  const chargerScene = () =>
    (chargement ??= import('./scene/scene')
      .then((m) => {
        scene = (toileMonde && m.creerScene3D(toileMonde, ctx)) || null;
        if (transition === 'entree') scene?.cinematique?.('entree');
      })
      .catch(() => undefined)
      .finally(() => {
        scene ??= Object.assign(creerRendu(ctx), { troisD: false });
      }));
  document.querySelector('.jeu-bouton')?.addEventListener('pointerenter', () => void chargerScene(), { once: true });
  // En attendant (quelques dizaines de millisecondes), rien n'est dessiné.
  const attente: RenduJeu = { troisD: false, eclater() {}, flotter() {}, anneau() {}, secouer() {}, flasher() {}, alerter() {}, toucherBoss() {}, dessiner: () => ctx.clearRect(0, 0, l, h) };
  const rendu = new Proxy({} as RenduJeu, { get: (_, cle: keyof RenduJeu) => (scene ?? attente)[cle] });

  let s: Sauvegarde = charger();
  // RUSH RADIO : ses préférences (piste, volume, sourdine) vivent dans la sauvegarde du jeu.
  const rushRadio = creerRushRadio({
    lire: () => ({ piste: s.reglages.piste, volume: s.reglages.volumeMusique, muet: s.reglages.muet }),
    ecrire: (p) => {
      s.reglages.piste = p.piste;
      s.reglages.volumeMusique = p.volume;
      s.reglages.muet = p.muet;
      enregistrer(s);
    },
  });
  let partie: Partie | null = null;
  let enPause = false;
  let compte = 0; // le compte à rebours avant le départ, ou avant la reprise (s)
  let ecran: Ecran = 'accueil';
  let panneau: 'reglages' | null = null;
  let transition: 'entree' | 'sortie' | null = null;
  /** La séquence de fin en cours (minuterie qui affichera les résultats), 0 sinon. */
  let finCine = 0;
  let choix: { mode: Mode; difficulte: Difficulte; niveau: number } = { mode: 'campagne', difficulte: s.difficulte, niveau: 1 };
  let secteur = Math.min(s.niveauMax, NIVEAUX.length);
  let confirmer: Confirmation = '';
  let recordAnnonce = false;
  let boucle = 0;
  let avant = 0;
  let reste = 0;
  let temps = 0;
  let images = 0;
  let l = 1;
  let h = 1;
  const tactile = window.matchMedia('(pointer: coarse)').matches;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => fenetre.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...fenetre.querySelectorAll<T>(sel)];
  const locale = () => (fenetre.dataset.langue === 'en' ? 'en-GB' : 'fr-FR');
  const nombre = (n: number) => Math.round(n).toLocaleString(locale());
  const deux = (n: number) => String(n).padStart(2, '0');
  const remplir = (modele: string, valeurs: Record<string, string | number>) => modele.replace(/\{(\w+)\}/g, (_, cle) => String(valeurs[cle] ?? ''));
  /** Animations coupées (système ou réglage du site) : des fondus brefs à la place des transitions. */
  const animationsCoupees = () => mouvementReduit || reglagesSite.animations === 0;
  const effetsReduits = () => mouvementReduit || s.reglages.effetsReduits || reglagesSite.animations === 0;
  reglerVolumeRush(s.reglages.volume);

  // ---- Les aperçus des mondes : rendus par la scène 3D, une image à la fois, avant l'image du jeu ----
  const apercus = new Map<string, string>();
  const aRendre: (() => void)[] = [];
  const demanderApercu = (theme: Theme, lp: number, hp: number, poser: (url: string) => void) => {
    const cle = `${theme}-${lp}x${hp}`;
    const deja = apercus.get(cle);
    if (deja) return poser(deja);
    aRendre.push(() => {
      const url = rendu.apercu?.(theme, lp, hp);
      if (url) {
        apercus.set(cle, url);
        poser(url);
      }
    });
  };
  const poserImage = (img: HTMLImageElement | null) => (url: string) => {
    if (!img) return;
    if (img.getAttribute('src') !== url) img.src = url;
    img.hidden = false;
  };

  // ==========================================================================
  // RUSH RADIO : le lecteur compact du menu principal, et la musique qui suit la course
  // ==========================================================================
  const radioBloc = $('.rush-radio');
  const radioListe = $('[data-rr-liste]');
  const radioVolume = $<HTMLInputElement>('[data-rr="volume"]');
  const majRadio = () => {
    const e = rushRadio.etat;
    const p = rushRadio.piste;
    radioBloc.dataset.lecture = String(e.lecture);
    const lecture = $('[data-rr="lecture"]');
    lecture.setAttribute('aria-pressed', String(e.lecture));
    lecture.setAttribute('aria-label', e.lecture ? textes.radio.pause : textes.radio.lire);
    lecture.title = lecture.getAttribute('aria-label') ?? '';
    $('[data-rr-champ="titre"]').textContent = p.titre;
    $('[data-rr-champ="detail"]').textContent = p.fabriquer ? textes.radio.adaptative : `${p.artiste} · ${p.licence}`;
    if (document.activeElement !== radioVolume) radioVolume.value = String(Math.round(e.volume * 100));
    radioVolume.style.setProperty('--v', `${e.muet ? 0 : Math.round(e.volume * 100)}%`);
    $$('[data-rr-piste]').forEach((b, i) => b.setAttribute('aria-current', String(i === e.index)));
  };
  rushRadio.surChangement(majRadio);
  const listeRadioOuverte = () => !radioListe.hidden;
  const basculerListeRadio = (ouvrir = radioListe.hidden) => {
    radioListe.hidden = !ouvrir;
    $('[data-rr="liste"]').setAttribute('aria-expanded', String(ouvrir));
    if (ouvrir) $$<HTMLButtonElement>('[data-rr-piste]')[rushRadio.etat.index]?.focus({ preventScroll: true });
  };
  /** La lecture choisie dans le lecteur devient la préférence d'entrée (jouer ou non en ouvrant le jeu). */
  const retenirLecture = () => {
    s.reglages.musique = rushRadio.enLecture;
    enregistrer(s);
  };
  let cleAdaptation = '';
  /** Le vaisseau montré au garage (un vaisseau verrouillé peut être regardé, pas choisi). */
  let vehiculeVu: string | null = null;
  let dernierSuivi = 0;
  /** Ce que la course dit à la musique et au moteur, quatre fois par seconde. */
  const suivreSon = () => {
    const p = partie;
    const enCourse = !!p && ecran === '' && !enPause && !p.termine && fenetre.open && transition !== 'sortie';
    const vitesse = p ? Math.max(0, Math.min(1, (p.vitesse - p.profil.vitesse.depart) / Math.max(1, p.profil.vitesse.max - p.profil.vitesse.depart))) : 0;
    let a: Adaptation;
    if (ecran === 'victoire' || (finCine && fenetre.classList.contains('est-cinematique-victoire'))) a = { mode: 'victoire', intensite: 0.6, danger: 0, overdrive: false };
    else if (ecran === 'fin' || (finCine && p?.termine)) a = { mode: 'defaite', intensite: 0, danger: 0, overdrive: false };
    else if (ecran === 'pause' || (p && enPause)) a = { mode: 'pause', intensite: 0, danger: 0, overdrive: false };
    else if (p && ecran === '') {
      const avance = Number.isFinite(p.longueur) ? p.avancement : 0;
      a = { mode: 'course', intensite: Math.min(1, vitesse * 0.75 + avance * 0.35), danger: p.boucliers <= 1 ? 0.8 : p.boss ? 0.5 : 0, overdrive: p.overdrive > 0 };
    } else a = { mode: 'menu', intensite: 0, danger: 0, overdrive: false };
    const cle = `${a.mode}|${Math.round(a.intensite * 20)}|${Math.round(a.danger * 4)}|${a.overdrive}`;
    if (cle !== cleAdaptation) {
      cleAdaptation = cle;
      rushRadio.adapter(a);
    }
    moteurRush({ actif: enCourse && compte <= 0, vitesse, overdrive: !!p && p.overdrive > 0 });
  };

  // ==========================================================================
  // LES TEXTES CALCULÉS
  // ==========================================================================
  const objectifTexte = (o: Objectif) => (o.type === 'chocsMax' && o.valeur === 0 ? textes.objectifs.aucunChoc : remplir(textes.objectifs[o.type], { v: nombre(o.valeur) }));
  /** Les libellés des trois étoiles d'un secteur, dans une difficulté. */
  const libellesEtoiles = (n: (typeof NIVEAUX)[number], d: Difficulte): string[] => [
    n.objectif.type === 'fin' ? textes.etoiles.une : objectifTexte(n.objectif),
    remplir(textes.etoiles.deux, { v: nombre(scoreEtoile(n, d)) }),
    n.maitrise[0] ? objectifTexte(n.maitrise[0]) : '—',
  ];
  const peindreEtoiles = (conteneur: Element | null, etoiles: boolean[]) =>
    conteneur?.querySelectorAll('i').forEach((i, k) => i.classList.toggle('est-gagnee', !!etoiles[k]));
  const conditionTexte = (c: Condition): string => {
    const k = textes.garage.conditions;
    switch (c.type) {
      case 'depart':
        return k.depart;
      case 'niveau':
        return remplir(k.niveau, { v: deux(c.niveau) });
      case 'rang':
        return k.rang;
      case 'difficulte':
        return remplir(k.difficulte, { v: textes.difficultes[c.difficulte].nom });
      case 'infini':
        return remplir(k.infini, { v: nombre(c.distance) });
      case 'total':
        return remplir(k[c.stat], { v: nombre(c.valeur) });
      case 'multiplicateur':
        return remplir(k.multiplicateur, { v: c.valeur });
    }
  };
  /** Le record qui sert de repère pendant la partie en cours. */
  const recordCourant = (): number => {
    if (!partie) return 0;
    if (partie.mode === 'campagne') return s.records[`${choix.niveau}-${choix.difficulte}`]?.score ?? 0;
    if (partie.mode === 'infini') return s.infini[choix.difficulte]?.score ?? 0;
    return s.defi.date === partie.graine ? s.defi.meilleur : 0;
  };
  const libellePartie = () => {
    if (choix.mode === 'campagne') return `${remplir(textes.secteur, { n: deux(choix.niveau) })} · ${textes.niveaux[choix.niveau - 1].nom} · ${textes.difficultes[choix.difficulte].nom}`;
    if (choix.mode === 'infini') return `${textes.menu.infini} · ${textes.difficultes[choix.difficulte].nom}`;
    return `${textes.defi.titre} · ${new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}`;
  };
  const multiplicateur = (d: Difficulte) => `×${PROFILS[d].score.toLocaleString(locale())}`;
  /** Le meilleur score enregistré, tous modes confondus, et d'où il vient. */
  const meilleurScore = (): { score: number; origine: string } => {
    let m = { score: 0, origine: '' };
    for (const [cle, r] of Object.entries(s.records)) {
      const [n, d] = cle.split('-') as [string, Difficulte];
      if (r.score > m.score) m = { score: r.score, origine: `${remplir(textes.secteur, { n: deux(Number(n)) })} · ${textes.difficultes[d]?.nom ?? d}` };
    }
    for (const [d, r] of Object.entries(s.infini)) if (r.score > m.score) m = { score: r.score, origine: `${textes.menu.infini} · ${textes.difficultes[d as Difficulte]?.nom ?? d}` };
    if (s.defi.meilleur > m.score) m = { score: s.defi.meilleur, origine: textes.defi.titre };
    return m;
  };
  /** Continuer : le prochain secteur de la campagne ; sans partie jouée, « Commencer » le secteur 01. */
  const reprise = () => {
    const premiere = s.totaux.parties === 0 && !Object.keys(s.reussis).length;
    const niveau = premiere ? 1 : Math.min(s.niveauMax, NIVEAUX.length);
    const difficulte = difficulteJouable(s, s.difficulte);
    return { premiere, niveau, difficulte };
  };

  // ==========================================================================
  // LA BARRE DU HAUT : la touche Échap dit ce qu'elle fera ; le module, où l'on est
  // ==========================================================================
  const listeLangues = $('[data-langues]');
  const boutonLangue = $('[data-rush="langue"]');
  const languesOuvertes = () => !listeLangues.hidden;
  const majBarre = () => {
    const e = textes.barre.echap;
    const effet = finCine ? e.passer : languesOuvertes() || panneau ? e.fermer : ecran === '' ? e.pause : ecran === 'pause' ? e.reprendre : ecran === 'accueil' ? e.quitter : ecran === 'fin' || ecran === 'victoire' ? e.menu : e.retour;
    $('[data-echap]').textContent = effet;
    const titres: Record<Ecran, string> = {
      accueil: textes.barre.principal,
      campagne: textes.menu.campagne,
      infini: textes.menu.infini,
      defi: textes.menu.defi,
      records: textes.menu.records,
      garage: textes.menu.garage,
      pause: textes.pause.titre,
      fin: textes.fin.score,
      victoire: textes.victoire.titre,
      '': textes.barre.course,
    };
    $('[data-module]').textContent = panneau ? textes.reglages.titre : titres[ecran];
    $('[data-rush="echap"]').setAttribute('aria-label', `Esc · ${effet}`);
  };
  const fermerLangues = (rendreFocus = false) => {
    if (!languesOuvertes()) return;
    listeLangues.hidden = true;
    boutonLangue.setAttribute('aria-expanded', 'false');
    if (rendreFocus) boutonLangue.focus({ preventScroll: true });
    majBarre();
  };
  const ouvrirLangues = () => {
    listeLangues.hidden = false;
    boutonLangue.setAttribute('aria-expanded', 'true');
    masquerInfo();
    (listeLangues.querySelector<HTMLElement>('a:not([aria-current])') ?? listeLangues.querySelector<HTMLElement>('a'))?.focus({ preventScroll: true });
    majBarre();
  };

  // L'infobulle des icônes : à la souris (après un court délai) et au clavier.
  const info = document.createElement('span');
  info.className = 'rush__info';
  info.setAttribute('aria-hidden', 'true');
  fenetre.append(info);
  let delaiInfo = 0;
  const montrerInfo = (el: HTMLElement) => {
    if (languesOuvertes()) return;
    info.textContent = el.dataset.info ?? '';
    const b = el.getBoundingClientRect();
    info.style.top = `${b.bottom + 8}px`;
    info.style.left = '0px';
    info.classList.add('est-vue');
    const largeur = info.offsetWidth;
    info.style.left = `${Math.max(8, Math.min(window.innerWidth - largeur - 8, b.left + b.width / 2 - largeur / 2))}px`;
  };
  const masquerInfo = () => {
    window.clearTimeout(delaiInfo);
    info.classList.remove('est-vue');
  };
  fenetre.addEventListener('pointerover', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-info]');
    if (!el || e.pointerType !== 'mouse') return;
    window.clearTimeout(delaiInfo);
    delaiInfo = window.setTimeout(() => montrerInfo(el), 320);
  });
  fenetre.addEventListener('pointerout', (e) => {
    if ((e.target as Element).closest('[data-info]')) masquerInfo();
  });
  fenetre.addEventListener('focusin', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-info]');
    if (el && el.matches(':focus-visible')) montrerInfo(el);
    else masquerInfo();
  });
  fenetre.addEventListener('focusout', masquerInfo);

  // ==========================================================================
  // LES ÉCRANS
  // ==========================================================================
  const theme = (): Theme => {
    if (partie) return partie.niveauBase.theme;
    if (ecran === 'campagne') return NIVEAUX[secteur - 1].theme;
    if (ecran === 'infini') return 'infini';
    if (ecran === 'defi') return 'defi';
    return 'lancement';
  };
  /** L'action principale de l'écran (Entrée ou Espace quand rien d'autre n'a le focus). */
  const principale = (): HTMLButtonElement | null => {
    const sel: Partial<Record<Ecran, string>> = {
      accueil: '[data-rush="continuer"]',
      records: '[data-records-vide]:not([hidden]) [data-rush="premiere"]',
      pause: '[data-rush="reprendre"]',
      fin: 'section[data-ecran="fin"] [data-rush="rejouer"]',
      victoire: 'section[data-ecran="victoire"] [data-rush="suivant"]:not([hidden]), section[data-ecran="victoire"] [data-rush="rejouer"]',
      campagne: '[data-rush="lancer"]',
      infini: '[data-rush="lancer-infini"]',
      defi: '[data-rush="lancer-defi"]',
    };
    const css = sel[ecran];
    const b = css ? fenetre.querySelector<HTMLButtonElement>(css) : null;
    return b && !b.disabled ? b : null;
  };

  const montrer = (e: Ecran, focus = true) => {
    if (ecran === 'pause' && e !== 'pause') confirmer = '';
    if (e !== 'garage') vehiculeVu = null;
    ecran = e;
    fenetre.dataset.ecran = e;
    fenetre.dataset.theme = theme();
    $('.rush__hud').hidden = !partie || !(e === '' || e === 'pause');
    fermerLangues();
    if (e === 'accueil') majAccueil();
    if (e === 'campagne') majCampagne();
    if (e === 'infini') majInfini();
    if (e === 'defi') majDefi();
    if (e === 'records') majRecords();
    if (e === 'garage') majGarage();
    if (e === 'pause') majPause();
    majBarre();
    if (!focus) return;
    requestAnimationFrame(() => {
      if (panneau) return;
      if (e === '') return toile.focus({ preventScroll: true });
      const zone = fenetre.querySelector<HTMLElement>(`section[data-ecran="${e}"]`);
      const cible =
        principale() ??
        zone?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ??
        zone?.querySelector<HTMLElement>('input[type="radio"]:checked:not([disabled])') ??
        zone?.querySelector<HTMLElement>('button:not([disabled]):not([hidden])');
      cible?.focus({ preventScroll: true });
    });
  };
  /** Récrit les textes de l'écran affiché (après un changement de langue), sans rien réinitialiser. */
  const rafraichir = () => {
    if (!fenetre.open) return;
    if (ecran) montrer(ecran, false);
    if (panneau) majReglages();
    if (partie) majHud();
    majBarre();
  };

  const majAccueil = () => {
    const m = meilleurScore();
    $('[data-stat="meilleur"]').textContent = m.score ? nombre(m.score) : '—';
    $('[data-stat="meilleurOrigine"]').textContent = m.origine;
    const faits = NIVEAUX.filter((n) => ORDRE_DIFFICULTES.some((d) => s.reussis[`${n.id}-${d}`])).length;
    $('[data-stat="campagne"]').textContent = `${faits} / ${NIVEAUX.length}`;
    $$('[data-stat="segments"] i').forEach((i, k) => i.classList.toggle('est-fait', k < faits));
    $('[data-stat="etoiles"]').textContent = `${totalEtoiles(s)} / ${NIVEAUX.length * 3 * ORDRE_DIFFICULTES.length}`;
    $('[data-stat="pieces"]').textContent = `${s.debloques.length} / ${PIECES.length}`;
    $('[data-stat="defis"]').textContent = String(s.defisReussis.length);
    const d = s.derniere;
    $('[data-stat="derniere"]').textContent = d
      ? `${d.mode === 'campagne' ? remplir(textes.secteur, { n: deux(d.niveau) }) : d.mode === 'infini' ? textes.menu.infini : textes.menu.defi} · ${textes.difficultes[d.difficulte].nom}`
      : '—';
    $('[data-stat="bienvenue"]').hidden = s.totaux.parties > 0;
    const r = reprise();
    $('[data-libelle-continuer]').textContent = r.premiere ? textes.menu.commencer : textes.menu.continuer;
    $('[data-desc="continuer"]').textContent = r.premiere
      ? remplir(textes.descriptions.commencer, { nom: textes.niveaux[0].nom })
      : remplir(textes.descriptions.continuer, { n: deux(r.niveau), nom: textes.niveaux[r.niveau - 1].nom, d: textes.difficultes[r.difficulte].nom });
  };

  const majDifficultes = () => {
    $$<HTMLInputElement>('input[name="rush-difficulte"], input[name="rush-difficulte-infini"]').forEach((r) => {
      const verrou = !difficulteOuverte(s, r.value as Difficulte);
      r.disabled = verrou;
      r.closest('.difficulte')?.classList.toggle('est-verrouille', verrou);
      r.checked = r.value === choix.difficulte;
    });
    $$('[data-verrou-cauchemar]').forEach((el) => (el.hidden = cauchemarOuvert(s)));
    $$('[data-verrou-paradoxe]').forEach((el) => (el.hidden = paradoxeOuvert(s)));
  };

  const majCampagne = () => {
    choix.difficulte = difficulteJouable(s, choix.difficulte);
    majDifficultes();
    $$<HTMLButtonElement>('[data-secteur]').forEach((b) => {
      const n = Number(b.dataset.secteur);
      const termine = !!s.reussis[`${n}-${choix.difficulte}`];
      const libre = n <= s.niveauMax;
      b.classList.toggle('est-termine', termine);
      b.classList.toggle('est-disponible', libre && !termine);
      b.classList.toggle('est-verrouille', !libre);
      b.setAttribute('aria-pressed', String(n === secteur));
      const rec = s.records[`${n}-${choix.difficulte}`];
      b.querySelector('[data-etat]')!.textContent = termine && rec ? `${textes.meilleur} ${nombre(rec.score)}` : libre ? textes.etats.disponible : textes.etats.verrouille;
      const etoiles = etoilesDe(s, n, choix.difficulte);
      peindreEtoiles(b.querySelector('[data-etoiles]'), etoiles);
      b.querySelector('[data-etoiles]')!.setAttribute('aria-label', remplir(textes.etoiles.resume, { n: etoiles.filter(Boolean).length }));
      demanderApercu(NIVEAUX[n - 1].theme, 384, 216, poserImage(b.querySelector('img')));
    });
    $('[data-campagne="etoiles"]').textContent = `★ ${totalEtoiles(s, choix.difficulte)} / ${NIVEAUX.length * 3} · ${textes.difficultes[choix.difficulte].nom}`;
    majPreparation();
  };

  const majPreparation = () => {
    const n = NIVEAUX[secteur - 1];
    const libre = secteur <= s.niveauMax;
    $('[data-apercu]').dataset.theme = n.theme;
    fenetre.dataset.theme = n.theme;
    $('[data-prep="secteur"]').textContent = `${remplir(textes.secteur, { n: deux(n.id) })} · ${textes.difficultes[choix.difficulte].nom} ${multiplicateur(choix.difficulte)}`;
    $('[data-prep="nom"]').textContent = textes.niveaux[n.id - 1].nom;
    $('[data-prep="mecanique"]').textContent = textes.niveaux[n.id - 1].mecanique;
    demanderApercu(n.theme, 720, 340, poserImage(fenetre.querySelector('[data-apercu-grand]')));
    // Les trois étoiles : leur objectif, et celles déjà gagnées dans cette difficulté.
    const etoiles = etoilesDe(s, n.id, choix.difficulte);
    const libelles = libellesEtoiles(n, choix.difficulte);
    $$('[data-prep="etoiles"] li').forEach((li, k) => {
      li.classList.toggle('est-gagnee', etoiles[k]);
      li.querySelector('i')!.classList.toggle('est-gagnee', etoiles[k]);
      li.querySelector('span')!.textContent = libelles[k];
    });
    // Ce que ce secteur peut encore débloquer (rien d'inventé : seulement ce qui existe vraiment).
    const gains: string[] = [];
    if (n.id < NIVEAUX.length && s.niveauMax <= n.id) gains.push(remplir(textes.etoiles.debloque, { n: deux(n.id + 1) }));
    for (const p of PIECES) if (p.condition.type === 'niveau' && p.condition.niveau === n.id && !s.debloques.includes(p.id)) gains.push(remplir(textes.etoiles.piece, { p: `${textes.garage.emplacements[p.emplacement]} · ${textes.garage.pieces[p.id]}` }));
    if (choix.difficulte === 'expert' && !cauchemarOuvert(s)) gains.push(textes.etoiles.cauchemar);
    if (choix.difficulte === 'cauchemar' && !paradoxeOuvert(s)) gains.push(textes.etoiles.paradoxe);
    $('[data-prep="recompenses"]').replaceChildren(
      ...(gains.length ? gains : [textes.etoiles.aucune]).map((g) => {
        const li = document.createElement('li');
        li.textContent = g;
        li.classList.toggle('est-vide', !gains.length);
        return li;
      }),
    );
    const rec = s.records[`${n.id}-${choix.difficulte}`];
    $('[data-prep="record"]').textContent = rec ? `${textes.meilleur} ${nombre(rec.score)} · ${rec.rang}` : textes.aucunRecord;
    const verrou = $('[data-prep="verrou"]');
    verrou.hidden = libre;
    verrou.textContent = libre ? '' : remplir(textes.verrou, { n: deux(n.id - 1) });
    $<HTMLButtonElement>('[data-rush="lancer"]').disabled = !libre;
  };

  const majInfini = () => {
    choix.difficulte = difficulteJouable(s, choix.difficulte);
    majDifficultes();
    $$('[data-infini-record]').forEach((el) => {
      const r = s.infini[el.dataset.infiniRecord!];
      el.textContent = r ? `${textes.meilleur} ${nombre(r.score)} · ${nombre(r.distance)} m` : textes.aucunRecord;
    });
  };

  const majDefi = () => {
    $('[data-defi="date"]').textContent = new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
    const jour = s.defi.date === graineDuJour() && s.defi.tentatives > 0;
    $('[data-defi="meilleur"]').textContent = jour ? nombre(s.defi.meilleur) : textes.defi.aucune;
    $('[data-defi="derniere"]').textContent = jour ? `${nombre(s.defi.dernier)} · ${remplir(textes.defi.tentatives, { n: s.defi.tentatives })}` : '—';
  };

  // ---- Les records : uniquement ce qui est enregistré ; un état vide pour commencer ----
  const choisirOnglet = (groupe: 'records' | 'reglages', nom: string, focus = false) => {
    $$(`[data-onglet-${groupe}]`).forEach((b) => {
      const choisi = b.dataset[groupe === 'records' ? 'ongletRecords' : 'ongletReglages'] === nom;
      b.setAttribute('aria-selected', String(choisi));
      b.tabIndex = choisi ? 0 : -1;
      if (choisi && focus) b.focus({ preventScroll: true });
    });
    $$(`[data-page-${groupe}]`).forEach((p) => (p.hidden = p.dataset[groupe === 'records' ? 'pageRecords' : 'pageReglages'] !== nom));
  };
  const majRecords = () => {
    const vide = s.totaux.parties === 0 && !Object.keys(s.records).length;
    $('[data-records-vide]').hidden = !vide;
    $('[data-records-plein]').hidden = vide;
    const carte = (k: string, valeur: string, detail = '') => {
      const c = $(`[data-records-carte="${k}"]`);
      c.querySelector('b')!.textContent = valeur;
      c.querySelector('small')!.textContent = detail;
      c.classList.toggle('est-vide', valeur === '—');
    };
    const infinis = Object.entries(s.infini).sort((a, b) => b[1].score - a[1].score);
    const [dInf, rInf] = infinis[0] ?? [];
    carte('infini', rInf ? nombre(rInf.score) : '—', rInf ? `${textes.difficultes[dInf as Difficulte].nom} · ${multiplicateur(dInf as Difficulte)}` : '');
    const distance = Math.max(s.totaux.meilleureDistance ?? 0, s.totaux.infiniMax);
    carte('distance', distance ? `${nombre(distance)} m` : '—');
    carte('combo', s.totaux.meilleurCombo ? nombre(s.totaux.meilleurCombo) : '—');
    carte('parfaits', s.totaux.meilleursParfaits ? nombre(s.totaux.meilleursParfaits) : '—');
    carte('etoiles', `${totalEtoiles(s)} / ${NIVEAUX.length * 3 * ORDRE_DIFFICULTES.length}`, ORDRE_DIFFICULTES.map((d) => `${textes.difficultes[d].nom} ${totalEtoiles(s, d)}`).join(' · '));
    const jour = s.defi.date === graineDuJour() && s.defi.tentatives > 0;
    carte('defi', String(s.defisReussis.length), jour ? `${textes.records.aujourdhui} ${nombre(s.defi.meilleur)}` : '');
    $$('[data-record]').forEach((td) => {
      const r = s.records[td.dataset.record!];
      td.classList.toggle('a-record', !!r);
      td.replaceChildren();
      if (!r) td.textContent = textes.records.aucun;
      else {
        const b = document.createElement('b');
        const [n, d] = td.dataset.record!.split('-');
        b.textContent = `${'★'.repeat(etoilesDe(s, Number(n), d as Difficulte).filter(Boolean).length)} ${r.rang}`.trim();
        td.append(nombre(r.score), b);
      }
    });
    $$('[data-record-infini]').forEach((td) => {
      const r = s.infini[td.dataset.recordInfini!];
      td.classList.toggle('a-record', !!r);
      td.textContent = r ? nombre(r.score) : textes.records.aucun;
    });
    $$('[data-record-infini-distance]').forEach((td) => {
      const r = s.infini[td.dataset.recordInfiniDistance!];
      td.classList.toggle('a-record', !!r);
      td.textContent = r ? `${nombre(r.distance)} m` : textes.records.aucun;
    });
    $('[data-record-defi]').textContent = jour ? nombre(s.defi.meilleur) : textes.records.aucun;
    $('[data-record-tentatives]').textContent = String(jour ? s.defi.tentatives : 0);
    $('[data-record-defis]').textContent = String(s.defisReussis.length);
  };

  const majGarage = () => {
    // Les vaisseaux : choisi, gagné, ou verrouillé avec sa condition et sa progression.
    $$<HTMLButtonElement>('[data-vehicule]').forEach((b) => {
      const v = VEHICULES.find((x) => x.id === b.dataset.vehicule)!;
      const gagne = s.vehicules.includes(v.id);
      const choisi = s.vehicule === v.id;
      b.setAttribute('aria-pressed', String(choisi));
      b.classList.toggle('est-verrouille', !gagne);
      b.classList.toggle('est-vu', vehiculeVu === v.id && !choisi);
      const a = avancement(s, v.condition);
      b.querySelector('[data-vehicule-etat]')!.textContent = choisi
        ? textes.garage.vaisseaux.choisi
        : gagne
          ? ''
          : `${conditionTexte(v.condition)}${a.cible > 1 ? ` · ${remplir(textes.garage.progres, { n: nombre(a.mesure), v: nombre(a.cible) })}` : ''}`;
    });
    $$<HTMLButtonElement>('[data-piece]').forEach((b) => {
      const piece = PIECES.find((p) => p.id === b.dataset.piece)!;
      const gagnee = s.debloques.includes(piece.id);
      const equipee = s.equipement[piece.emplacement] === piece.id;
      b.disabled = !gagnee;
      b.setAttribute('aria-pressed', String(equipee));
      const a = avancement(s, piece.condition);
      b.querySelector('[data-piece-etat]')!.textContent = equipee
        ? textes.garage.equipe
        : gagnee
          ? ''
          : `${conditionTexte(piece.condition)}${a.cible > 1 ? ` · ${remplir(textes.garage.progres, { n: nombre(a.mesure), v: nombre(a.cible) })}` : ''}`;
    });
  };

  // ---- Le panneau des réglages : par-dessus l'écran en cours, sans rien relancer ----
  const peindreCurseur = (champ: HTMLInputElement) => champ.style.setProperty('--v', `${champ.value}%`);
  const majReglages = () => {
    const v = (cle: string) => $<HTMLInputElement>(`[data-reglage="${cle}"]`);
    v('volume').value = String(Math.round(s.reglages.volume * 100));
    $('[data-sortie="volume"]').textContent = `${Math.round(s.reglages.volume * 100)} %`;
    v('sons').checked = reglagesSite.sons;
    v('musique').checked = s.reglages.musique;
    v('volumeMusique').value = String(Math.round(s.reglages.volumeMusique * 100));
    $('[data-sortie="volumeMusique"]').textContent = `${Math.round(s.reglages.volumeMusique * 100)} %`;
    $$<HTMLInputElement>('[data-reglage="animations"]').forEach((r) => (r.checked = Number(r.value) === reglagesSite.animations));
    v('effetsReduits').checked = s.reglages.effetsReduits;
    v('secousses').checked = s.reglages.secousses;
    v('aideCommandes').checked = s.reglages.aideCommandes;
    $$<HTMLInputElement>('[data-reglage="tactile"]').forEach((r) => (r.checked = r.value === s.reglages.tactile));
    $$<HTMLInputElement>('[data-reglage="sequenceFin"]').forEach((r) => (r.checked = r.value === s.reglages.sequenceFin));
    $$<HTMLInputElement>('.curseur-jeu input').forEach(peindreCurseur);
  };
  let retourFocus: HTMLElement | null = null;
  const ouvrirPanneau = (onglet = 'audio') => {
    retourFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panneau = 'reglages';
    fenetre.dataset.panneau = 'reglages';
    fermerLangues();
    masquerInfo();
    majReglages();
    choisirOnglet('reglages', onglet);
    majBarre();
    requestAnimationFrame(() => $<HTMLElement>('[data-onglet-reglages][aria-selected="true"]').focus({ preventScroll: true }));
  };
  const fermerPanneau = () => {
    if (!panneau) return;
    panneau = null;
    fenetre.dataset.panneau = '';
    majBarre();
    // (En pause, la partie reste en pause : seule une action explicite la reprend.)
    const cible = retourFocus && fenetre.contains(retourFocus) && retourFocus.getClientRects().length ? retourFocus : principale();
    cible?.focus({ preventScroll: true });
  };

  const majPause = () => {
    $$('section[data-ecran="pause"] [data-confirmer]').forEach((bouton) => {
      const enAttente = confirmer === bouton.dataset.rush;
      bouton.querySelector('[data-libelle-cible]')!.textContent = enAttente ? bouton.dataset.confirmer! : bouton.dataset.libelle!;
      bouton.classList.toggle('est-a-confirmer', enAttente);
    });
  };
  /** Une action qui abandonne la course (recommencer, menu, quitter) se confirme d'un second appui. */
  const confirmerPuis = (quoi: Exclude<Confirmation, ''>, faire: () => void) => {
    if (confirmer !== quoi) {
      confirmer = quoi;
      majPause();
      return;
    }
    confirmer = '';
    faire();
  };

  // ==========================================================================
  // LA PARTIE
  // ==========================================================================
  const demarrer = (mode: Mode, difficulte: Difficulte, niveau = 1) => {
    window.clearTimeout(finCine);
    finCine = 0;
    fenetre.classList.remove('est-cinematique', 'est-cinematique-victoire');
    choix = { mode, difficulte: mode === 'defi' ? 'as' : difficulte, niveau };
    if (mode !== 'defi') {
      s.difficulte = choix.difficulte;
      enregistrer(s);
    }
    fermerPanneau();
    partie = new Partie(mode, choix.difficulte, niveau, undefined, s.vehicule);
    enPause = false;
    confirmer = '';
    reste = 0;
    compte = animationsCoupees() ? 0.4 : 1.2;
    recordAnnonce = false;
    $('.rush__conseil').hidden = true;
    fenetre.classList.remove('en-overdrive', 'od-pret', 'bat-record');
    fenetre.classList.toggle('sans-aide', !s.reglages.aideCommandes);
    $('[data-hud="secteur"]').textContent = mode === 'campagne' ? `${deux(niveau)} · ${textes.niveaux[niveau - 1].nom}` : mode === 'infini' ? textes.menu.infini : textes.defi.titre;
    $('[data-hud="boss"]').hidden = !partie.boss;
    $('[data-hud="touche"]').textContent = tactile ? textes.hud.toucheTactile : textes.hud.touche;
    // Les repères des phases sur la barre de progression (pas en survie : elle n'a pas de fin).
    const reperes = Number.isFinite(partie.longueur) ? partie.niveauBase.phases.slice(0, -1).map((p) => p.fin) : [];
    $('[data-hud="reperes"]').replaceChildren(
      ...reperes.map((f) => {
        const i = document.createElement('i');
        i.style.left = `${f * 100}%`;
        return i;
      }),
    );
    $('[data-hud="boucliers"]').replaceChildren(...Array.from({ length: partie.bouclierMax }, () => document.createElement('i')));
    $('[data-hud="record"]').textContent = recordCourant() ? nombre(recordCourant()) : '—';
    montrer('');
    majHud();
  };

  const pause = (): boolean => {
    if (!partie || partie.termine || ecran !== '' || transition) return false;
    enPause = true;
    montrer('pause');
    sonRush('deplacement');
    return true;
  };
  /** Reprendre : un bref compte à rebours, pour se replacer (rien n'a bougé pendant la pause). */
  const reprendre = () => {
    if (!partie) return;
    fermerPanneau();
    enPause = false;
    compte = animationsCoupees() ? 0.3 : 0.9;
    avant = performance.now();
    montrer('');
  };
  const menu = () => {
    partie = null;
    enPause = false;
    fenetre.classList.remove('en-overdrive', 'od-pret', 'bat-record');
    montrer('accueil');
  };

  const annoncer = (texte: string, genre = '') => {
    const a = $('.rush__annonce');
    a.textContent = texte;
    a.dataset.genre = genre;
    a.classList.remove('est-vue');
    void a.offsetWidth;
    a.classList.add('est-vue');
  };
  const gagner = (points?: number) => {
    if (!points) return;
    const g = $('[data-hud="gain"]');
    g.textContent = `+${nombre(points)}`;
    g.classList.remove('est-vu');
    void g.offsetWidth;
    g.classList.add('est-vu');
    fenetre.classList.add('a-gagne');
    window.setTimeout(() => fenetre.classList.remove('a-gagne'), 160);
  };

  const majHud = () => {
    if (!partie) return;
    const p = partie;
    $('[data-hud="score"]').textContent = nombre(p.score);
    $('[data-hud="phase"]').textContent = textes.phases[p.phaseCourante.nom];
    $('[data-hud="progression"]').style.transform = `scaleX(${p.avancement.toFixed(3)})`;
    const o = p.niveauBase.objectif;
    const mesure = o.type === 'fragments' ? p.fragments : o.type === 'parfaits' ? p.parfaits : o.type === 'portails' ? p.portails : 0;
    $('[data-hud="objectif"]').textContent =
      p.mode === 'infini'
        ? `${nombre(p.distance)} m · ${Math.round(p.vitesse * 3.6)} km/h`
        : p.mode === 'defi' || o.type === 'fin'
          ? `${nombre(p.distance)} / ${nombre(p.longueur)} m`
          : o.type === 'boss'
            ? objectifTexte(o)
            : `${objectifTexte(o)} · ${mesure} / ${o.valeur}`;
    if (p.boss) {
      $('[data-hud="bossVie"]').style.transform = `scaleX(${(p.boss.vie / p.boss.max).toFixed(3)})`;
      $('[data-hud="bossPhase"]').textContent = remplir(textes.annonces.phase, { n: p.boss.phase });
    }
    $$('[data-hud="boucliers"] i').forEach((i, k) => i.classList.toggle('est-perdu', k >= p.boucliers));
    $('[data-hud="fragments"]').textContent = String(p.fragments);
    const od = p.overdrive > 0;
    $('[data-hud="jauge"]').style.transform = `scaleY(${Math.min(1, od ? p.overdrive / p.profil.overdrive.duree : p.jauge).toFixed(3)})`;
    fenetre.classList.toggle('en-overdrive', od);
    fenetre.classList.toggle('od-pret', p.jauge >= 1 && !od);
    // L'Overdrive rare (V4) : verrouillé au départ, en charge, prêt, actif, puis « utilisé » jusqu'à la fin.
    const etatOd = p.etatOverdrive;
    fenetre.dataset.od = etatOd;
    $('[data-hud="charges"]').textContent = od
      ? `×${p.multOverdrive.toLocaleString(locale(), { maximumFractionDigits: 1 })} · ${remplir(textes.hud.charges, { n: p.charges })}`
      : etatOd === 'verrouille'
        ? remplir(textes.hud.odVerrouille, { n: nombre(p.seuilOverdrive) })
        : etatOd === 'utilise'
          ? textes.hud.odUtilise
          : '';
    $('[data-hud="mult"]').textContent = `×${p.multiplicateur}`;
    $('[data-hud="combo"]').textContent = String(p.combo);
    $('[data-hud="delai"]').style.transform = `scaleX(${p.comboRestant.toFixed(3)})`;
    fenetre.toggleAttribute('data-mult-haut', p.multiplicateur >= 5);
    // Battre son record en cours de partie : un évènement à part entière.
    const rec = recordCourant();
    if (!recordAnnonce && rec > 0 && p.score > rec) {
      recordAnnonce = true;
      fenetre.classList.add('bat-record');
      annoncer(textes.annonces.record, 'record');
      sonRush('victoire');
    }
  };

  /** La jauge d'Overdrive s'allume quand le trait d'énergie l'atteint. */
  const nourrirJauge = (delai: number) =>
    window.setTimeout(() => {
      const j = $('.hud__jauge');
      j.classList.remove('est-nourrie');
      void j.offsetWidth;
      j.classList.add('est-nourrie');
    }, delai);

  const montrerConseil = (n: number) => {
    if (!s.reglages.aideCommandes) return;
    const liste = tactile ? textes.conseils.tactile : textes.conseils.clavier;
    const c = $('.rush__conseil');
    c.textContent = liste[n] ?? '';
    c.hidden = !c.textContent;
    window.setTimeout(() => {
      if (c.textContent === liste[n]) c.hidden = true;
    }, 4200);
  };

  const evenements = () => {
    if (!partie) return;
    const p = partie;
    const peu = effetsReduits();
    for (const e of p.evenements) {
      const voie = e.voie ?? p.voieOccupee;
      switch (e.type) {
        case 'deplacement':
          sonRush('deplacement');
          break;
        case 'fragment':
        case 'dore': {
          // Une vraie collecte, validée par le moteur (une seule fois par fragment) : aspiration, onde, trait vers la jauge.
          const couleur = e.type === 'dore' ? '255, 214, 120' : '150, 230, 255';
          const jauge = $('.hud__jauge').getBoundingClientRect();
          if (rendu.capter) rendu.capter(voie, couleur, jauge.width ? { x: jauge.left + jauge.width / 2, y: jauge.top + jauge.height * (1 - Math.min(1, p.jauge)) } : undefined);
          else rendu.eclater(voie, couleur, peu ? 4 : 10);
          rendu.flotter(voie, `+${nombre(e.valeur ?? 0)}`, couleur);
          gagner(e.valeur);
          sonRush(e.type === 'dore' ? 'noyau' : 'fragment');
          nourrirJauge(peu ? 0 : 520);
          break;
        }
        case 'noyau':
          rendu.eclater(voie, '255, 190, 140', peu ? 6 : 16);
          gagner(e.valeur);
          sonRush('noyau');
          break;
        case 'parfait':
          annoncer(textes.annonces.parfait, 'parfait');
          rendu.anneau(p.voieOccupee, '170, 225, 255');
          rendu.flotter(p.voieOccupee, `+${nombre(e.valeur ?? 0)}`, '236, 244, 255');
          if (!peu) rendu.flasher('170, 225, 255', 0.12);
          gagner(e.valeur);
          sonRush('parfait');
          break;
        case 'motif':
          annoncer(textes.annonces.motif, 'motif');
          rendu.flotter(p.voieOccupee, `+${nombre(e.valeur ?? 0)}`, '255, 214, 120');
          gagner(e.valeur);
          sonRush('pret');
          break;
        case 'choc':
          annoncer((e.valeur ?? 0) === 1 ? textes.annonces.dernier : textes.annonces.choc, 'choc');
          if (s.reglages.secousses && !peu) rendu.secouer(1);
          rendu.alerter();
          rendu.eclater(voie, '255, 150, 140', peu ? 6 : 20);
          sonRush('choc');
          break;
        case 'combo-perdu':
          annoncer(textes.annonces.comboPerdu, 'choc');
          break;
        case 'portail':
          annoncer(textes.annonces.portail, 'portail');
          if (!peu) rendu.flasher('190, 150, 255', 0.25);
          sonRush('portail');
          break;
        case 'overdrive':
          annoncer(remplir(textes.annonces.overdrive, { n: (e.valeur ?? 2).toLocaleString(locale(), { maximumFractionDigits: 1 }) }), 'overdrive');
          if (!peu) rendu.flasher('210, 190, 255', 0.35);
          sonRush('overdrive');
          break;
        case 'fin-overdrive':
          break;
        case 'od-ouvert':
          annoncer(textes.annonces.odOuvert, 'pret');
          break;
        case 'pret':
          annoncer(textes.annonces.pret, 'pret');
          sonRush('pret');
          break;
        case 'detruit':
          rendu.eclater(voie, '236, 244, 255', peu ? 6 : 18);
          rendu.flotter(voie, `+${nombre(e.valeur ?? 0)}`, '210, 190, 255');
          gagner(e.valeur);
          sonRush('detruit');
          break;
        case 'boss-touche':
          rendu.toucherBoss();
          sonRush('boss');
          break;
        case 'phase-boss':
          annoncer(remplir(textes.annonces.phase, { n: e.valeur ?? 1 }), 'phase');
          if (s.reglages.secousses && !peu) rendu.secouer(0.6);
          sonRush('phase');
          break;
        case 'phase':
          if ((e.valeur ?? 0) > 0) annoncer(textes.phases[p.niveauBase.phases[e.valeur ?? 0]?.nom ?? p.phaseCourante.nom], 'phase');
          break;
        case 'conseil':
          montrerConseil(e.valeur ?? 0);
          break;
        case 'fin':
          finDePartie();
          break;
      }
    }
    p.evenements.length = 0;
  };

  const ligneObjectif = (o: ObjectifAtteint) => {
    const li = document.createElement('li');
    li.classList.toggle('est-atteint', o.atteint);
    li.textContent = objectifTexte(o);
    if (!['fin', 'boss', 'chocsMax'].includes(o.type)) {
      const m = document.createElement('small');
      m.textContent = ` ${nombre(o.mesure)} / ${nombre(o.valeur)}`;
      li.append(m);
    }
    return li;
  };
  const statistiques = (cible: HTMLElement, lignes: [string, string][]) =>
    cible.replaceChildren(
      ...lignes.map(([nom, valeur]) => {
        const div = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = nom;
        const dd = document.createElement('dd');
        dd.textContent = valeur;
        div.append(dt, dd);
        return div;
      }),
    );

  /**
   * La séquence de fin. Victoire (3,4 s) : bandes de cinéma, « Secteur terminé », la caméra tourne autour du vaisseau
   * au ralenti, puis il passe en Overdrive et traverse le portail d'arrivée dans un éclair blanc ; ensuite les étoiles.
   * Échec (1,3 s) : le monde ralentit, la caméra recule. Entrée, Espace, Échap ou un clic la passent.
   * Sans animations : comme avant, les résultats arrivent après 0,9 s.
   */
  const finDePartie = () => {
    const r = partie?.termine;
    if (!r || finCine) return;
    const victoire = (choix.mode === 'campagne' && r.reussi) || (choix.mode === 'defi' && r.arrive);
    if (animationsCoupees() || !rendu.cinematique) {
      finCine = window.setTimeout(passerCinematique, 900);
      return;
    }
    // (V4) Séquence courte, au choix du joueur : un éclair de victoire, puis les résultats.
    if (victoire && s.reglages.sequenceFin === 'courte') {
      rendu.flasher('236, 244, 255', 0.6);
      sonRush('ouverture');
      finCine = window.setTimeout(passerCinematique, 1000);
      majBarre();
      return;
    }
    $('[data-cine-titre]').textContent = victoire ? textes.victoire.titre : '';
    $('[data-cine-sous]').textContent = victoire ? libellePartie() : '';
    fenetre.classList.add('est-cinematique');
    fenetre.classList.toggle('est-cinematique-victoire', victoire);
    rendu.cinematique(victoire ? 'victoire' : 'defaite');
    if (victoire) window.setTimeout(() => finCine && sonRush('ouverture'), 1150);
    finCine = window.setTimeout(passerCinematique, victoire ? 3350 : 1300);
    majBarre();
  };
  const passerCinematique = () => {
    if (!finCine) return;
    window.clearTimeout(finCine);
    finCine = 0;
    fenetre.classList.remove('est-cinematique', 'est-cinematique-victoire');
    terminer();
  };

  /** La partie est finie : on range le résultat, puis l'écran de victoire ou celui de fin. */
  const terminer = () => {
    if (!partie?.termine || ecran === 'fin' || ecran === 'victoire' || !fenetre.open || transition === 'sortie') return;
    const p = partie;
    const r = p.termine;
    const bilan: Bilan = ranger(s, choix.mode, choix.difficulte, choix.niveau, r, p.graine);
    const victoire = choix.mode === 'campagne' && r.reussi;
    sonRush(victoire || (choix.mode === 'defi' && r.arrive) ? 'victoire' : 'defaite');
    fermerPanneau();
    const f = textes.fin;
    if (victoire) {
      $('[data-victoire="secteur"]').textContent = libellePartie();
      $('[data-victoire="rang"]').textContent = r.rang;
      $('[data-victoire="score"]').textContent = nombre(r.score);
      const rec = $('[data-victoire="record"]');
      rec.classList.toggle('est-record', bilan.record);
      rec.textContent = bilan.record ? f.nouveau : `${textes.meilleur} ${nombre(Math.max(bilan.ancienRecord, r.score))}`;
      const n = NIVEAUX[choix.niveau - 1];
      const libelles = libellesEtoiles(n, choix.difficulte);
      const mesures = [r.objectifs[0], { mesure: r.score, valeur: scoreEtoile(n, choix.difficulte), type: 'score' }, r.objectifs[1]];
      $$('[data-victoire="etoiles"] .etoile-resultat').forEach((el, k) => {
        const gagnee = !!bilan.etoiles?.[k];
        const nouvelle = bilan.nouvellesEtoiles.includes(k);
        el.classList.toggle('est-gagnee', gagnee);
        el.classList.toggle('est-nouvelle', nouvelle);
        el.style.setProperty('--delai', `${0.35 + k * 0.35}s`);
        const m = mesures[k];
        const suivi = m && !['fin', 'boss', 'chocsMax'].includes(m.type) && !gagnee ? ` · ${nombre(m.mesure)} / ${nombre(m.valeur)}` : '';
        el.querySelector('small')!.textContent = libelles[k] + suivi;
      });
      if (bilan.nouvellesEtoiles.length) window.setTimeout(() => sonRush('pret'), 500);
      const gains = [
        ...(bilan.niveauDebloque ? [`${remplir(textes.victoire.secteurDebloque, { n: deux(bilan.niveauDebloque) })} · ${textes.niveaux[bilan.niveauDebloque - 1].nom}`] : []),
        ...(bilan.cauchemarDebloque ? [textes.victoire.cauchemar] : []),
        ...(bilan.paradoxeDebloque ? [textes.victoire.paradoxe] : []),
        ...bilan.pieces.map((id) => {
          const piece = PIECES.find((x) => x.id === id)!;
          return `${textes.garage.emplacements[piece.emplacement]} · ${textes.garage.pieces[id]}`;
        }),
      ];
      $('[data-victoire="recompenses"]').replaceChildren(
        ...(gains.length ? gains : [textes.victoire.aucune]).map((g) => {
          const li = document.createElement('li');
          li.textContent = g;
          li.classList.toggle('est-vide', !gains.length);
          return li;
        }),
      );
      $('[data-rush="suivant"]').hidden = choix.niveau >= NIVEAUX.length || choix.niveau + 1 > s.niveauMax;
      montrer('victoire');
      return;
    }
    $('[data-fin="secteur"]').textContent = libellePartie();
    $('[data-fin="titre"]').textContent = choix.mode === 'infini' ? f.titreInfini : r.arrive ? (choix.mode === 'defi' ? f.titreDefi : f.objectifManque) : f.titre;
    $('[data-fin="score"]').textContent = nombre(r.score);
    const rec = $('[data-fin="record"]');
    rec.classList.toggle('est-record', bilan.record);
    rec.textContent = bilan.record ? f.nouveau : bilan.ancienRecord > r.score ? remplir(f.ecart, { n: nombre(bilan.ancienRecord - r.score) }) : '';
    const lignes: [string, string][] = [
      choix.mode === 'infini' ? [f.distance, `${nombre(r.distance)} m`] : [f.progression, `${Math.round(p.avancement * 100)} %`],
      ...(r.rang !== '—' ? [[f.rang, r.rang] as [string, string]] : []),
      [f.combo, String(r.comboMax)],
      [f.parfaits, String(r.parfaits)],
      [f.fragments, `${r.fragments} / ${r.fragmentsVus}`],
      [f.temps, `${Math.floor(r.temps / 60)}:${String(Math.floor(r.temps % 60)).padStart(2, '0')}`],
    ];
    statistiques($('[data-fin="stats"]'), lignes);
    $('[data-fin="objectifs"]').replaceChildren(...r.objectifs.map(ligneObjectif));
    const blocEtoiles = $('[data-fin="etoiles"]');
    blocEtoiles.hidden = choix.mode !== 'campagne';
    if (choix.mode === 'campagne') {
      const n = NIVEAUX[choix.niveau - 1];
      const libelles = libellesEtoiles(n, choix.difficulte);
      const deja = etoilesDe(s, n.id, choix.difficulte);
      blocEtoiles.querySelectorAll<HTMLElement>('.etoile-resultat').forEach((el, k) => {
        el.classList.toggle('est-gagnee', deja[k]);
        el.classList.remove('est-nouvelle');
        el.querySelector('small')!.textContent = libelles[k];
      });
    }
    const suite = prochainePiece(s);
    $('[data-fin="progres"]').textContent = suite
      ? `${f.progres} ${textes.garage.emplacements[suite.piece.emplacement]} · ${textes.garage.pieces[suite.piece.id]} — ${conditionTexte(suite.piece.condition)}${suite.cible > 1 ? ` (${remplir(textes.garage.progres, { n: nombre(suite.mesure), v: nombre(suite.cible) })})` : ''}`
      : '';
    $('[data-rush="autre"]').hidden = choix.mode === 'defi';
    montrer('fin');
  };

  // ==========================================================================
  // LA BOUCLE
  // ==========================================================================
  const dimensionner = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    l = fenetre.clientWidth || window.innerWidth;
    h = fenetre.clientHeight || window.innerHeight;
    toile.width = Math.round(l * dpr);
    toile.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const dimensionnerApercu = () => {
    if (!apercu || !ctxApercu) return null;
    const b = apercu.getBoundingClientRect();
    if (!b.width) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lw = Math.round(b.width * dpr);
    const lh = Math.round(b.height * dpr);
    if (apercu.width !== lw || apercu.height !== lh) {
      apercu.width = lw;
      apercu.height = lh;
    }
    ctxApercu.setTransform(dpr, 0, 0, dpr, 0, 0);
    return b;
  };

  const PAS = 1 / 120;
  const image = (maintenant: number) => {
    boucle = requestAnimationFrame(image);
    const dt = Math.min(0.05, Math.max(0, (maintenant - avant) / 1000));
    avant = maintenant;
    const actif = !!partie && !enPause && !partie.termine && ecran === '' && !panneau && transition !== 'sortie';
    if (actif && partie) {
      if (compte > 0) {
        const avantCompte = compte;
        compte -= dt;
        const pas = animationsCoupees() ? 0.15 : 0.3;
        const etape = Math.ceil(compte / pas);
        if (Math.ceil(avantCompte / pas) !== etape) annoncer(etape > 0 ? String(etape) : textes.annonces.depart, 'compte');
      } else {
        reste += dt;
        while (reste >= PAS && !partie.termine) {
          partie.avancer(PAS);
          reste -= PAS;
        }
        evenements();
      }
    } else if (partie?.termine && partie.evenements.length) evenements();
    temps += actif ? dt : dt * 0.35;
    // (La scène 3D dessine ces images dans sa propre toile, puis l'image du jeu la recouvre entièrement.)
    if (!actif && aRendre.length && !transition) aRendre.shift()!();
    const modele = partie ? partie.vehicule.modele : (VEHICULES.find((v) => v.id === (vehiculeVu ?? s.vehicule))?.modele ?? 0);
    if (ecran === 'garage' && rendu.garage) {
      const b = dimensionnerApercu();
      if (b && ctxApercu) rendu.garage(ctxApercu, b.width, b.height, s.equipement, temps, modele);
    }
    const vue = { l, h, reduit: effetsReduits(), secousses: s.reglages.secousses, equipement: s.equipement, theme: theme(), brume: partie?.niveauBase.brume ?? 0, avance: actif && compte <= 0 ? reste : 0, modele };
    rendu.dessiner(partie, vue, temps, actif ? dt : partie ? 0 : dt * 0.35);
    if (++images % 3 === 0) majHud();
    if (maintenant - dernierSuivi > 250) {
      dernierSuivi = maintenant;
      suivreSon();
    }
    // L'aperçu du garage, sans la 3D : le vaisseau dessiné à plat.
    if (ecran === 'garage') {
      const b = dimensionnerApercu();
      if (b && ctxApercu && !rendu.garage) {
        ctxApercu.clearRect(0, 0, b.width, b.height);
        const taille = Math.min(b.width, b.height) * 0.2;
        dessinerVaisseau(ctxApercu, b.width / 2, b.height * 0.36, taille, Math.sin(temps * 1.1) * 0.25, s.equipement, temps, 0.55 + 0.45 * Math.sin(temps * 1.8));
      }
    }
  };

  // ==========================================================================
  // L'OUVERTURE ET LA FERMETURE
  // ==========================================================================
  /** Le passage côté portfolio : une onde depuis l'Orbital Hub, des particules qui convergent, l'aspiration du tunnel. */
  const passage = (origine: { x: number; y: number }, duree: number, particules: boolean) => {
    const voile = document.createElement('div');
    voile.className = 'passage-rush';
    voile.setAttribute('aria-hidden', 'true');
    const toilePassage = document.createElement('canvas');
    voile.append(toilePassage);
    document.body.append(voile);
    const L = (toilePassage.width = window.innerWidth);
    const H = (toilePassage.height = window.innerHeight);
    const c = toilePassage.getContext('2d')!;
    const cx = L / 2,
      cy = H / 2;
    const grains = Array.from({ length: particules ? 150 : 0 }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = Math.hypot(L, H) * (0.35 + Math.random() * 0.4);
      return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, v: 0.5 + Math.random() * 0.8, retard: Math.random() * 0.25 };
    });
    const t0 = performance.now();
    const pas = (maintenant: number) => {
      // (L'horodatage de la première image peut précéder t0 : on borne à 0, sinon l'onde aurait un rayon négatif.)
      const t = Math.min(1, Math.max(0, (maintenant - t0) / duree));
      c.clearRect(0, 0, L, H);
      // L'aspiration : le portfolio s'assombrit depuis les bords vers le centre.
      const fond = Math.min(1, Math.max(0, (t - 0.18) / 0.55));
      const rayon = Math.hypot(L, H) * (0.75 - fond * 0.62);
      const g = c.createRadialGradient(cx, cy, Math.max(1, rayon * 0.15), cx, cy, rayon);
      g.addColorStop(0, 'rgba(3, 6, 12, 0)');
      g.addColorStop(1, `rgba(3, 6, 12, ${(0.25 + fond * 0.75).toFixed(3)})`);
      c.fillStyle = g;
      c.fillRect(0, 0, L, H);
      if (fond > 0.92) {
        c.fillStyle = `rgba(3, 6, 12, ${((fond - 0.92) / 0.08).toFixed(3)})`;
        c.fillRect(0, 0, L, H);
      }
      // L'onde : un anneau de lumière qui part de l'icône de l'Orbital Hub.
      const onde = Math.min(1, t / 0.5);
      if (onde < 1) {
        c.strokeStyle = `rgba(168, 236, 255, ${(0.9 * (1 - onde)).toFixed(3)})`;
        c.lineWidth = 2 + 6 * (1 - onde);
        c.beginPath();
        c.arc(origine.x, origine.y, 10 + onde * Math.hypot(L, H), 0, Math.PI * 2);
        c.stroke();
      }
      // Les particules : elles convergent vers le centre en laissant une traînée.
      for (const p of grains) {
        const k = Math.min(1, Math.max(0, (t - p.retard) / (0.75 - p.retard)));
        const e = k * k * k * p.v + k * (1 - p.v) * 0.6;
        const x = p.x + (cx - p.x) * Math.min(1, e);
        const y = p.y + (cy - p.y) * Math.min(1, e);
        const x0 = p.x + (cx - p.x) * Math.max(0, Math.min(1, e - 0.08));
        const y0 = p.y + (cy - p.y) * Math.max(0, Math.min(1, e - 0.08));
        c.strokeStyle = `rgba(190, 240, 255, ${(0.85 * k * (1 - k * 0.3)).toFixed(3)})`;
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x, y);
        c.stroke();
      }
      // Le cœur du portail, au centre, qui s'embrase juste avant l'ouverture.
      const coeur = Math.max(0, (t - 0.35) / 0.4);
      if (coeur > 0) {
        const r = 6 + coeur * 46;
        const gc = c.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
        gc.addColorStop(0, `rgba(235, 250, 255, ${Math.min(1, coeur).toFixed(3)})`);
        gc.addColorStop(0.3, `rgba(120, 220, 255, ${(0.6 * Math.min(1, coeur)).toFixed(3)})`);
        gc.addColorStop(1, 'rgba(98, 217, 255, 0)');
        c.fillStyle = gc;
        c.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
      }
      if (t < 1) requestAnimationFrame(pas);
      else window.setTimeout(() => voile.remove(), 260);
    };
    requestAnimationFrame(pas);
  };

  const demarrerFenetre = (e: Ouverture) => {
    s = charger();
    textes = lire();
    reglerVolumeRush(s.reglages.volume);
    panneau = null;
    fenetre.dataset.panneau = '';
    if (!fenetre.open) fenetre.showModal();
    dimensionner();
    avant = performance.now();
    if (!boucle) boucle = requestAnimationFrame(image);
    if (e === 'reglages' || e === 'commandes') {
      montrer('accueil', false);
      ouvrirPanneau(e === 'commandes' ? 'commandes' : 'audio');
    } else montrer(e);
  };

  const ouvrir = (e: Ouverture = 'accueil', depuis: HTMLElement | null = null) => {
    if (transition) return;
    if (fenetre.open) {
      if (e === 'reglages' || e === 'commandes') ouvrirPanneau(e === 'commandes' ? 'commandes' : 'audio');
      else if (!partie) montrer(e);
      return;
    }
    void chargerScene();
    // La musique : DREAM RADIO s'efface (sa position est gardée), RUSH RADIO prend le relais si le joueur la veut.
    dreamRadio.suspendre();
    s = charger();
    rushRadio.relirePreferences();
    tamponPret('/audio/effets/moteur.mp3');
    majRadio();
    if (s.reglages.musique) window.setTimeout(() => fenetre.open && rushRadio.jouer(), animationsCoupees() ? 100 : 700);
    const icone = document.querySelector<HTMLElement>('.jeu-bouton');
    icone?.classList.add('est-lance');
    window.setTimeout(() => icone?.classList.remove('est-lance'), 700);
    sonRush('ouverture');
    if (animationsCoupees()) {
      fenetre.classList.add('est-entree-douce');
      demarrerFenetre(e);
      window.setTimeout(() => fenetre.classList.remove('est-entree-douce'), 260);
      return;
    }
    // Onde, particules et aspiration côté portfolio ; puis le portail s'ouvre au centre et le monde apparaît.
    transition = 'entree';
    const b = (depuis ?? icone)?.getBoundingClientRect();
    const origine = b && b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const allege = reglagesSite.animations < 1;
    passage(origine, allege ? 520 : 720, !allege);
    window.setTimeout(
      () => {
        fenetre.style.setProperty('--ox', '50%');
        fenetre.style.setProperty('--oy', '50%');
        fenetre.classList.add('est-entree');
        demarrerFenetre(e);
        rendu.cinematique?.('entree');
      },
      allege ? 240 : 380,
    );
    window.setTimeout(
      () => {
        fenetre.classList.remove('est-entree');
        transition = null;
      },
      allege ? 1150 : 1500,
    );
  };

  /**
   * Quitter le jeu : pause immédiate, la scène se referme dans le noyau du vaisseau, et l'on revient toujours
   * en haut de l'accueil (demande de Mathéo, 15 octobre 2026). Sur l'accueil, la page remonte pendant que le jeu
   * la cache encore ; ailleurs (une fiche), le jeu s'efface et l'on part vers l'accueil.
   */
  const quitterJeu = () => {
    if (!fenetre.open || transition === 'sortie') return;
    if (partie && !partie.termine) enPause = true;
    fermerLangues();
    masquerInfo();
    sonRush('sortie');
    if (!document.querySelector('.hero')) {
      transition = 'sortie';
      fenetre.classList.add('est-sortie-douce');
      window.setTimeout(() => window.location.assign(document.documentElement.lang.startsWith('en') ? '/en/' : '/'), 220);
      return;
    }
    if (window.location.hash) history.replaceState(history.state, '', window.location.pathname + window.location.search);
    // (Depuis le 16 octobre 2026, l'accueil est une destination : on y revient, en haut, sous le jeu.)
    revenirAccueil();
    const finir = () => {
      fenetre.classList.remove('est-sortie', 'est-sortie-douce', 'est-entree');
      transition = null;
      if (fenetre.open) fenetre.close();
      document.querySelector<HTMLElement>('.jeu-bouton')?.focus({ preventScroll: true });
    };
    transition = 'sortie';
    if (animationsCoupees()) {
      fenetre.classList.add('est-sortie-douce');
      window.setTimeout(finir, 190);
      return;
    }
    const c = rendu.centreVaisseau?.() ?? { x: l / 2, y: h * 0.62 };
    fenetre.style.setProperty('--ox', `${Math.round(c.x)}px`);
    fenetre.style.setProperty('--oy', `${Math.round(c.y)}px`);
    rendu.cinematique?.('sortie');
    fenetre.classList.add('est-sortie');
    window.setTimeout(finir, 660);
  };

  /** Échap (et le repère cliquable en haut à gauche) : son effet dépend de ce qui est ouvert. */
  const echap = () => {
    if (finCine) return passerCinematique();
    if (transition) return;
    if (listeRadioOuverte()) {
      basculerListeRadio(false);
      $('[data-rr="liste"]').focus({ preventScroll: true });
      return;
    }
    if (languesOuvertes()) fermerLangues(true);
    else if (panneau) fermerPanneau();
    else if (partie && ecran === '') pause();
    else if (ecran === 'pause') reprendre();
    else if (ecran === 'accueil') quitterJeu();
    else if (ecran === 'fin' || ecran === 'victoire') menu();
    else montrer('accueil');
  };
  api = { ouvrir, pause };
  // Les boutons « Jouer à Portal Rush » du portfolio (vitrine de l'accueil, carte et fiche du projet).
  document.addEventListener('click', (e) => {
    const bouton = (e.target as Element).closest<HTMLElement>('[data-jouer-rush]');
    if (!bouton || e.defaultPrevented) return;
    e.preventDefault();
    void chargerScene();
    ouvrir('accueil', bouton);
  });
  document.addEventListener('pointerover', (e) => (e.target as Element).closest?.('[data-jouer-rush]') && void chargerScene(), { passive: true });

  // ==========================================================================
  // LES COMMANDES
  // ==========================================================================
  // (Écouté sur le document, en premier : même si plus rien n'a le focus, les touches arrivent au jeu,
  // et le portfolio, dessous, ne réagit pas aux flèches pendant que le jeu est ouvert.)
  document.addEventListener(
    'keydown',
    (e) => {
    if (!fenetre.open || e.ctrlKey || e.metaKey || e.altKey) return;
    const actif = document.activeElement;
    if (actif instanceof Element && actif.closest('#hub')) return;
    // Échap : traité ici (le navigateur ne ferme jamais la fenêtre de lui-même).
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!e.repeat) {
        const repere = $('[data-rush="echap"]');
        repere.classList.add('est-pressee');
        window.setTimeout(() => repere.classList.remove('est-pressee'), 140);
        echap();
      }
      return;
    }
    if (transition) {
      e.preventDefault();
      return;
    }
    // Pendant la séquence de fin, Entrée et Espace la passent.
    if (finCine && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (!e.repeat) passerCinematique();
      return;
    }
    // Entrée / Espace : une seule fois par appui ; la commande qui a le focus, sinon l'action principale.
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      if (ecran === '' && partie) {
        if (e.key === 'Enter') e.preventDefault();
      } else {
        const commande = actif instanceof HTMLElement && actif !== toile && fenetre.contains(actif) && actif.matches('button, a, input, select, textarea');
        if (!commande) {
          e.preventDefault();
          if (!panneau && !languesOuvertes()) principale()?.click();
        }
        return;
      }
    }
    // Les onglets : ← → passent d'un onglet à l'autre.
    if (actif instanceof HTMLElement && actif.getAttribute('role') === 'tab' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const groupe = actif.dataset.ongletRecords ? 'records' : 'reglages';
      const onglets = $$(`[data-onglet-${groupe}]`);
      const suivant = onglets[(onglets.indexOf(actif) + (e.key === 'ArrowRight' ? 1 : -1) + onglets.length) % onglets.length];
      choisirOnglet(groupe, (suivant.dataset.ongletRecords ?? suivant.dataset.ongletReglages)!, true);
      return;
    }
    // Dans un menu (ou le panneau), les flèches passent d'une commande à l'autre.
    // Sur une case à choix ou un curseur, ← → gardent leur rôle ; ↑ ↓ en sortent.
    if ((ecran !== '' || panneau) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const garde = actif instanceof HTMLInputElement && (actif.type === 'radio' || actif.type === 'range');
      if (garde && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      const zone = languesOuvertes() ? listeLangues : panneau ? $('.panneau') : fenetre.querySelector<HTMLElement>(`section[data-ecran="${ecran}"]`);
      if (!zone) return;
      const arrets = [...zone.querySelectorAll<HTMLElement>('a, button:not([disabled]), input[type="radio"]:checked:not([disabled]), input[type="range"], input[type="checkbox"]')].filter(
        (el) => !el.closest('[hidden]') && el.getClientRects().length > 0 && !(el.getAttribute('role') === 'tab' && el.getAttribute('aria-selected') !== 'true'),
      );
      if (!arrets.length) return;
      e.preventDefault();
      const ici = arrets.indexOf(actif as HTMLElement);
      const sens = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      arrets[ici < 0 ? 0 : (ici + sens + arrets.length) % arrets.length].focus();
      return;
    }
    // R : recommencer tout de suite après une partie ; en pause, en deux temps (comme le bouton).
    if (e.code === 'KeyR' && partie && !panneau && (ecran === 'fin' || ecran === 'victoire' || ecran === 'pause')) {
      e.preventDefault();
      if (ecran === 'pause') {
        confirmerPuis('recommencer', () => demarrer(choix.mode, choix.difficulte, choix.niveau));
        $('[data-rush="recommencer"]').focus();
      } else demarrer(choix.mode, choix.difficulte, choix.niveau);
      return;
    }
    if (!partie || ecran !== '' || panneau) return;
    const code = e.code;
    if (['ArrowLeft', 'KeyA', 'KeyQ'].includes(code)) {
      e.preventDefault();
      if (!e.repeat && compte <= 0) partie.deplacer(-1);
    } else if (['ArrowRight', 'KeyD'].includes(code)) {
      e.preventDefault();
      if (!e.repeat && compte <= 0) partie.deplacer(1);
    } else if (['Space', 'ArrowUp', 'KeyW', 'KeyZ'].includes(code)) {
      e.preventDefault();
      if (!e.repeat && compte <= 0) partie.declencher();
    } else if (code === 'KeyP') {
      e.preventDefault();
      pause();
    } else if (code === 'ArrowDown') e.preventDefault();
    },
    true,
  );
  // Les autres demandes de fermeture (bouton « retour » d'un téléphone…) suivent la même règle qu'Échap.
  fenetre.addEventListener('cancel', (e) => {
    e.preventDefault();
    echap();
  });
  fenetre.addEventListener('close', () => {
    // Le son du jeu s'arrête ; DREAM RADIO reprend seulement si elle jouait avant l'entrée.
    rushRadio.arreter();
    rushRadio.adapter(null);
    cleAdaptation = '';
    arreterMoteurRush();
    basculerListeRadio(false);
    dreamRadio.reprendreSiSuspendue();
    cancelAnimationFrame(boucle);
    boucle = 0;
    partie = null;
    enPause = false;
    panneau = null;
    transition = null;
    window.clearTimeout(finCine);
    finCine = 0;
    fenetre.dataset.panneau = '';
    fenetre.classList.remove('en-overdrive', 'od-pret', 'bat-record', 'est-sortie', 'est-sortie-douce', 'est-entree', 'est-entree-douce', 'est-cinematique', 'est-cinematique-victoire');
    listeLangues.hidden = true;
    boutonLangue.setAttribute('aria-expanded', 'false');
    masquerInfo();
  });

  // Au doigt (ou à la souris) sur la toile.
  let depart: { x: number; y: number } | null = null;
  toile.addEventListener('pointerdown', (e) => {
    if (finCine) return passerCinematique();
    if (!partie || ecran !== '') return;
    depart = { x: e.clientX, y: e.clientY };
  });
  toile.addEventListener('pointerup', (e) => {
    if (!depart || !partie || ecran !== '' || compte > 0 || panneau) return (depart = null);
    const dx = e.clientX - depart.x;
    const dy = e.clientY - depart.y;
    depart = null;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) partie.deplacer(dx < 0 ? -1 : 1);
    else if (dy < -40) partie.declencher();
    else if (s.reglages.tactile === 'toucher' || e.pointerType === 'mouse') partie.deplacer(e.clientX < l / 2 ? -1 : 1);
  });
  toile.addEventListener('pointercancel', () => (depart = null));

  // Les boutons, les onglets, les liens de langue.
  fenetre.addEventListener('click', (e) => {
    if (transition) return;
    const el = e.target as Element;
    // Le sélecteur de langue : la langue affichée ne recharge rien ; l'autre passe par le changement sans rechargement du site.
    const lien = el.closest<HTMLAnchorElement>('[data-langue-choix]');
    if (lien) {
      if (lien.getAttribute('aria-current') === 'true') e.preventDefault();
      fermerLangues(true);
      return;
    }
    if (languesOuvertes() && !el.closest('.langue-jeu')) fermerLangues();
    // RUSH RADIO.
    const rr = el.closest<HTMLElement>('[data-rr], [data-rr-piste]');
    if (!rr && listeRadioOuverte() && !el.closest('.rush-radio')) basculerListeRadio(false);
    if (rr) {
      if (rr.dataset.rrPiste) {
        rushRadio.choisir(Number(rr.dataset.rrPiste), true);
        retenirLecture();
        basculerListeRadio(false);
        $('[data-rr="liste"]').focus({ preventScroll: true });
      } else if (rr.dataset.rr === 'lecture') {
        rushRadio.basculer();
        retenirLecture();
      } else if (rr.dataset.rr === 'liste') basculerListeRadio();
      else if (rr.dataset.rr === 'precedente') rushRadio.precedente();
      else if (rr.dataset.rr === 'suivante') rushRadio.suivante();
      return;
    }
    const onglet = el.closest<HTMLElement>('[data-onglet-records], [data-onglet-reglages]');
    if (onglet) {
      if (onglet.dataset.ongletRecords) choisirOnglet('records', onglet.dataset.ongletRecords);
      else choisirOnglet('reglages', onglet.dataset.ongletReglages!);
      return;
    }
    const cible = el.closest<HTMLElement>('[data-rush], [data-secteur], [data-piece], [data-vehicule]');
    if (!cible || (cible as HTMLButtonElement).disabled) return;
    masquerInfo();
    if (cible.dataset.secteur) {
      secteur = Number(cible.dataset.secteur);
      majCampagne();
      sonRush('deplacement');
      return;
    }
    if (cible.dataset.vehicule) {
      // Un vaisseau gagné se choisit ; un vaisseau verrouillé se regarde seulement (aperçu 3D).
      const id = cible.dataset.vehicule as (typeof VEHICULES)[number]['id'];
      if (s.vehicules.includes(id)) {
        s.vehicule = id;
        vehiculeVu = null;
        enregistrer(s);
        sonRush('pret');
      } else {
        vehiculeVu = vehiculeVu === id ? null : id;
        sonRush('deplacement');
      }
      majGarage();
      return;
    }
    if (cible.dataset.piece) {
      const piece = PIECES.find((p) => p.id === cible.dataset.piece)!;
      s.equipement[piece.emplacement] = piece.id;
      enregistrer(s);
      majGarage();
      sonRush('pret');
      return;
    }
    const action = cible.dataset.rush;
    if (cible.matches('.action-principale, .lancer')) {
      cible.classList.remove('est-activee');
      void cible.offsetWidth;
      cible.classList.add('est-activee');
    }
    switch (action) {
      case 'echap':
        echap();
        break;
      case 'langue':
        if (languesOuvertes()) fermerLangues(true);
        else ouvrirLangues();
        break;
      case 'continuer': {
        const r = reprise();
        secteur = r.niveau;
        demarrer('campagne', r.difficulte, r.niveau);
        break;
      }
      case 'premiere':
        secteur = 1;
        demarrer('campagne', reprise().difficulte, 1);
        break;
      case 'campagne':
        secteur = Math.min(s.niveauMax, NIVEAUX.length);
        montrer('campagne');
        break;
      case 'infini':
      case 'defi':
      case 'garage':
        montrer(action);
        break;
      case 'records':
        if (ecran === 'pause') return;
        choisirOnglet('records', 'resume');
        montrer('records');
        break;
      case 'reglages':
        if (panneau) fermerPanneau();
        else ouvrirPanneau();
        break;
      case 'fermer-panneau':
        fermerPanneau();
        break;
      case 'retour':
        montrer('accueil');
        break;
      case 'lancer':
        demarrer('campagne', choix.difficulte, secteur);
        break;
      case 'lancer-infini':
        demarrer('infini', choix.difficulte);
        break;
      case 'lancer-defi':
        demarrer('defi', 'as');
        break;
      case 'menu':
        if (ecran === 'pause') confirmerPuis('menu', menu);
        else menu();
        break;
      case 'quitter':
        if (ecran === 'pause') confirmerPuis('quitter', quitterJeu);
        else quitterJeu();
        break;
      case 'pause':
        pause();
        break;
      case 'overdrive':
        if (partie && compte <= 0) partie.declencher();
        toile.focus({ preventScroll: true });
        break;
      case 'reprendre':
        reprendre();
        break;
      case 'recommencer':
        confirmerPuis('recommencer', () => demarrer(choix.mode, choix.difficulte, choix.niveau));
        break;
      case 'rejouer':
        demarrer(choix.mode, choix.difficulte, choix.niveau);
        break;
      case 'autre':
        partie = null;
        if (choix.mode === 'campagne') secteur = choix.niveau;
        montrer(choix.mode === 'infini' ? 'infini' : 'campagne');
        break;
      case 'suivant':
        secteur = Math.min(NIVEAUX.length, choix.niveau + 1);
        demarrer('campagne', choix.difficulte, secteur);
        break;
    }
  });
  fenetre.addEventListener('change', (e) => {
    const champ = e.target as HTMLInputElement;
    if (champ.name === 'rush-difficulte' || champ.name === 'rush-difficulte-infini') {
      choix.difficulte = champ.value as Difficulte;
      s.difficulte = choix.difficulte;
      enregistrer(s);
      if (ecran === 'campagne') majCampagne();
      else majInfini();
      sonRush('deplacement');
      return;
    }
    const cle = champ.dataset.reglage;
    if (!cle) return;
    if (cle === 'musique') {
      // RUSH RADIO : la coupe ou la relance tout de suite, et s'en souvient pour les prochaines entrées.
      s.reglages.musique = champ.checked;
      if (champ.checked) rushRadio.jouer();
      else rushRadio.pauser();
    } else if (cle === 'sons') regler('sons', champ.checked);
    else if (cle === 'animations') regler('animations', Number(champ.value));
    else if (cle === 'tactile') s.reglages.tactile = champ.value as 'toucher' | 'glisser';
    else if (cle === 'sequenceFin') s.reglages.sequenceFin = champ.value === 'courte' ? 'courte' : 'complete';
    else if (cle === 'effetsReduits' || cle === 'secousses' || cle === 'aideCommandes') s.reglages[cle] = champ.checked;
    enregistrer(s);
    fenetre.classList.toggle('sans-aide', !s.reglages.aideCommandes);
    majReglages();
    if (cle === 'sons' && champ.checked) sonRush('pret');
  });
  fenetre.addEventListener('input', (e) => {
    const champ = e.target as HTMLInputElement;
    if (champ.dataset.rr === 'volume') {
      rushRadio.reglerVolume(Number(champ.value) / 100);
      return;
    }
    if (champ.dataset.reglage === 'volume') {
      s.reglages.volume = Number(champ.value) / 100;
      reglerVolumeRush(s.reglages.volume);
      enregistrer(s);
      $('[data-sortie="volume"]').textContent = `${champ.value} %`;
      peindreCurseur(champ);
      sonRush('fragment');
    } else if (champ.dataset.reglage === 'volumeMusique') {
      rushRadio.reglerVolume(Number(champ.value) / 100);
      $('[data-sortie="volumeMusique"]').textContent = `${champ.value} %`;
      peindreCurseur(champ);
    }
  });

  // Un autre onglet a enregistré : hors partie, on relit la sauvegarde (rien n'est écrasé : voir sauvegarde.ts).
  window.addEventListener('storage', (e) => {
    if (e.key !== 'portal-rush-3' || partie) return;
    s = charger();
    rushRadio.relirePreferences();
    rafraichir();
  });

  // Onglet masqué, fenêtre quittée : pause.
  document.addEventListener('visibilitychange', () => document.hidden && pause());
  window.addEventListener('blur', () => pause());
  window.addEventListener('resize', () => fenetre.open && dimensionner());
  // Le changement de langue (sans rechargement) : on relit les textes, sans toucher à la partie.
  window.addEventListener('langue', () => {
    textes = lire();
    fenetre.dataset.langue = document.documentElement.lang === 'en' ? 'en' : 'fr';
    rafraichir();
  });

  // (Seulement pendant le développement : de quoi vérifier le jeu depuis les recettes.)
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__portalRush = {
      Partie,
      NIVEAUX,
      PROFILS,
      REGLES_VERSION,
      partie: () => partie,
      radio: rushRadio,
      demarrer,
      terminer,
      etat: () => ({ ecran, panneau, transition, enPause, compte, sauvegarde: s, choix, secteur, confirmer, troisD: rendu.troisD, distanceAffichee: partie ? partie.distance + (partie && !enPause && ecran === '' && compte <= 0 ? reste * partie.vitesse : 0) : 0 }),
    };
  }
}
