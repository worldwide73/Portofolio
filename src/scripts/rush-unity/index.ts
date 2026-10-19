// PORTAL RUSH — LA VERSION UNITY DANS LE PORTFOLIO (18 octobre 2026, derrière le drapeau ?rush=unity : drapeau.ts)
//
// L'ouverture (contrat docs/UNITY_ARCHITECTURE.md, §5.2 bis et §6) :
//   1. le bouton touché se fissure et se brise, le tunnel temporel part (rush/tunnel.ts, comme pour l'ancien jeu),
//      avec son son ; quand l'ouverture remplit l'écran, la fenêtre Portal Rush existante s'ouvre dessous, avec une
//      toile créée pour Unity (plein cadre ; ni iframe ni page externe), et le build se charge (chargeur.ts) ;
//   2. si Unity n'est pas prêt quand le tunnel devrait finir, le tunnel se prolonge en croisière (« retenir ») ;
//   3. Unity envoie « pret » (sa première image) ; la page lui envoie « config » ; avec « intro », Unity joue la
//      sortie du tunnel et annonce « ecran: intro » : la page fond son tunnel (sans éclair, pas d'écran noir) et laisse
//      courir le son du voyage ; le premier écran suivant (menu, tutoriel) est l'arrivée dans le monde : le son
//      d'ouverture, puis RUSH RADIO si le joueur la veut. Sans « intro » (voyage passé ou court, mouvement réduit) :
//      un fondu direct ; une lumière d'attente garde la place si le tunnel a fini avant Unity.
// DREAM RADIO s'efface à l'entrée et reprend à la sortie si elle jouait, comme pour l'ancien jeu. La toile a le
// focus ; Échap lui revient (le navigateur ne ferme pas la fenêtre) ; à la sortie, Unity est arrêté (Quit), la toile
// retirée, et le focus revient au bouton du Hub. Onglet masqué ou fenêtre quittée : « pause » ; retour : « reprendre ».
// Manifeste absent, pas de WebGL 2, chargement en échec ou trop long : l'ancien jeu s'ouvre à la place (un message
// discret dans le journal, rien de visible pour le visiteur).

import styles from './unity.css?inline';
import { dreamRadio } from '../audio/dream';
import { tamponPret } from '../audio/moteur';
import { reglages as reglagesSite } from '../reglages';
import { sonRush, sonVoyageTemporel } from '../sons';
import { charger, tutorielAFaire } from '../rush/sauvegarde';
import { voyageTemporel } from '../rush/tunnel';
import { revenirAccueil } from '../voyage';
import { creerInstance, lireManifeste, precharger, preparerLoader, webgl2, type InstanceUnity } from './chargeur';
import { animationsCoupees, creerPont, sauvegardePont } from './pont';
import type { PontPage } from './protocole';

/** Au-delà, le chargement est abandonné et l'ancien jeu prend le relais. */
const DELAI_CHARGEMENT = 60_000;
/** La sortie du tunnel jouée par Unity (Intro.cs, « Duree ») : le son du voyage la couvre aussi. */
const INTRO_UNITY = 2.6;
/** Le temps laissé à Unity pour annoncer « intro » après « config » ; sinon la page fond quand même son tunnel. */
const ATTENTE_INTRO = 2500;
const journal = (...x: unknown[]) => console.info('[Portal Rush · Unity]', ...x);

/** Le préchargement discret (drapeau.ts l'appelle à l'approche du jeu). */
export const prechargerRushUnity = precharger;

export interface OuvertureUnity {
  /** L'écran demandé (« accueil », « reglages », « commandes »…), comme pour l'ancien jeu. */
  ecran: string;
  /** Le bouton qui se fissure, et le point touché. */
  depuis: HTMLElement | null;
  point: { x: number; y: number } | null;
  /** L'ancien jeu, en repli ; « direct » : tout de suite, sans voyage (il a déjà eu lieu). */
  repli: (direct: boolean) => void;
}

/** Une ouverture est en cours (ou Unity finit de s'arrêter) : on n'en lance pas une autre. */
let occupe = false;
/** Les styles de la version Unity, posés à sa première ouverture seulement (rien dans les pages sans le drapeau). */
const poserStyles = () => {
  if (document.getElementById('rush-unity-styles')) return;
  const el = document.createElement('style');
  el.id = 'rush-unity-styles';
  el.textContent = styles;
  document.head.append(el);
};

export async function ouvrirRushUnity(o: OuvertureUnity): Promise<void> {
  const fenetre = document.querySelector<HTMLDialogElement>('.rush');
  if (!fenetre || occupe || fenetre.open) return;
  if (!webgl2()) {
    journal('WebGL 2 indisponible : ancien jeu.');
    return o.repli(false);
  }
  occupe = true;
  poserStyles();
  const m = await lireManifeste();
  if (!m) {
    occupe = false;
    journal('pas de build (public/rush-unity/portal-rush.json) : ancien jeu.');
    return o.repli(false);
  }
  // (Le loader de Unity se télécharge pendant la fissure ; une erreur ressortira à la création de l'instance.)
  void preparerLoader(m).catch(() => undefined);

  const textes = JSON.parse(fenetre.dataset.textes ?? '{}') as { voyage?: { passer?: string } };
  const s0 = charger();
  // Le premier lancement (une fois par profil) mène droit au tutoriel ; sinon, le menu (ou l'écran demandé).
  const arrivee = o.ecran === 'accueil' && tutorielAFaire(s0) ? 'tutoriel' : o.ecran;
  // La musique : DREAM RADIO s'efface (sa position est gardée) ; tout le son passe par la page.
  dreamRadio.suspendre();
  tamponPret('/audio/effets/moteur.mp3');
  tamponPret('/audio/effets/bris.mp3');
  const court = animationsCoupees();
  const duree = reglagesSite.animations < 1 ? 2.6 : 4.6;
  // Le son du voyage couvre le tunnel de la page puis celui de Unity (même départ que l'ancien jeu, arrivée plus loin).
  const dureeSon = duree + INTRO_UNITY;
  let sonVoyage = court ? null : sonVoyageTemporel(0.5, 0.85, dureeSon);
  const finSon = performance.now() + (0.5 + 0.85 + dureeSon) * 1000;
  if (court) sonRush('ouverture');

  let toile: HTMLCanvasElement | null = null;
  let attente: HTMLElement | null = null;
  let instance: InstanceUnity | null = null;
  let voyage: ReturnType<typeof voyageTemporel> = null;
  /** Unity a dessiné sa première image ; le tunnel de la page a été vu ; le voyage est arrivé (ou passé). */
  let pret = false;
  let tunnelVu = false;
  let arrive = false;
  let passe = false;
  /** « config » envoyée avec « intro » ; la page a cédé l'image à Unity ; on est arrivé dans le monde. */
  let intro = false;
  let relais = false;
  let monde = false;
  let echec = false;
  let fini = false;
  const delai = window.setTimeout(() => !pret && echouer('délai dépassé'), DELAI_CHARGEMENT);

  const pont = creerPont({
    fenetre,
    ouverture: () => ({ ecran: arrivee, intro, tutoriel: arrivee === 'tutoriel' }),
    pret: () => {
      if (pret) return;
      pret = true;
      window.clearTimeout(delai);
      brancher();
    },
    ecran: (nom) => {
      // « intro » : Unity a repris le tunnel ; tout autre écran : on est arrivé dans le monde.
      if (!relais) relayer();
      if (nom !== 'intro' && !monde) arriverDansLeMonde();
    },
    fermer: () => fermer(),
    erreur: (message) => !pont.branche && echouer(message || 'erreur signalée par Unity'),
  });
  const pontPage = (window as unknown as { __portalRushUnity?: PontPage }).__portalRushUnity;

  /** La toile (et la lumière d'attente) dans la fenêtre du jeu, ouverte sous le tunnel ; Unity démarre dessus. */
  function monter() {
    if (toile || echec || fini) return;
    fenetre!.dataset.moteur = 'unity';
    attente = document.createElement('div');
    attente.className = 'rush-unity__attente';
    attente.setAttribute('aria-hidden', 'true');
    attente.hidden = true;
    const barre = document.createElement('span');
    barre.className = 'rush-unity__barre';
    barre.append(document.createElement('i'));
    attente.append(barre);
    toile = document.createElement('canvas');
    toile.className = 'rush-unity__toile';
    toile.id = 'unity-canvas';
    toile.tabIndex = -1;
    toile.setAttribute('aria-label', 'Portal Rush');
    fenetre!.append(toile, attente);
    if (!fenetre!.open) fenetre!.showModal();
    voyage?.remonter();
    toile.focus({ preventScroll: true });
    const ici = toile;
    creerInstance(ici, m!, (p) => attente?.style.setProperty('--p', p.toFixed(3)))
      .then((i) => {
        if (fini || echec || toile !== ici) {
          void i.Quit().catch(() => undefined);
          return;
        }
        instance = i;
        brancher();
      })
      .catch((e) => echouer(e instanceof Error ? e.message : String(e)));
  }

  /** Unity écoute (« pret ») et l'instance existe : « config », puis la file. */
  function brancher() {
    if (fini || echec || pont.branche || !pret || !instance) return;
    const i = instance;
    // La sortie du tunnel, seulement si la page a joué son tunnel et que le visiteur ne l'a pas passé.
    intro = !court && tunnelVu && !passe && !arrive;
    pont.brancher((json) => i.SendMessage('Pont', 'Recevoir', json));
    toile?.focus({ preventScroll: true });
    if (!intro) {
      relayer();
      arriverDansLeMonde();
    } else window.setTimeout(() => !relais && !fini && relayer(), ATTENTE_INTRO);
  }

  /** La page cède l'image à Unity : son tunnel fond (sans éclair), ou la lumière d'attente s'efface. */
  function relayer() {
    if (relais || fini || echec) return;
    relais = true;
    document.querySelectorAll<HTMLElement>('#hub:popover-open').forEach((h) => h.hidePopover());
    voyage?.fondre(court ? 200 : 450);
    const a = attente;
    attente = null;
    if (a && !a.hidden) {
      a.classList.add('est-finie');
      window.setTimeout(() => a.remove(), 700);
    } else a?.remove();
    toile?.focus({ preventScroll: true });
  }

  /** L'arrivée dans le monde (premier écran après la sortie du tunnel) : le son d'ouverture, la musique du jeu. */
  function arriverDansLeMonde() {
    if (monde || fini) return;
    monde = true;
    if (intro) {
      // (Le son du voyage s'efface s'il court encore ; le son d'ouverture marque l'arrivée, comme l'ancien jeu.)
      if (sonVoyage && performance.now() < finSon - 300) sonVoyage.arreter(false);
      sonVoyage = null;
      sonRush('ouverture');
    }
    pont.demarrerMusique(court);
  }

  /** L'arrivée du voyage de la page : le Hub se range ; en échec, l'ancien jeu ; sinon, l'attente si Unity n'a pas pris le relais. */
  function arriver(p: boolean) {
    passe = p;
    arrive = true;
    document.querySelectorAll<HTMLElement>('#hub:popover-open').forEach((h) => h.hidePopover());
    if (echec) return basculer();
    monter();
    voyage?.remonter();
    if (!relais && attente) attente.hidden = false;
  }

  /** Repli : l'ancien jeu s'ouvre tout de suite dans la même fenêtre, sous l'éclair du voyage. */
  function basculer() {
    // (Le son du voyage, prévu plus long pour la sortie du tunnel de Unity, finit ici sur son accord d'arrivée.)
    if (sonVoyage && performance.now() < finSon - 300) sonVoyage.arreter(true);
    sonVoyage = null;
    o.repli(true);
    voyage?.remonter();
  }

  function echouer(raison: string) {
    if (echec || fini || pont.branche) return;
    echec = true;
    journal(`chargement impossible (${raison}) : ancien jeu.`);
    pont.arreter();
    demonter();
    // (Avant l'arrivée : le tunnel n'est plus retenu, l'ancien jeu s'ouvrira à son arrivée.)
    if (arrive) basculer();
  }

  /** Retire Unity : écouteurs, toile, instance (Quit), et le pont une fois Unity arrêté. */
  function demonter() {
    window.clearTimeout(delai);
    document.removeEventListener('keydown', touche, true);
    fenetre!.removeEventListener('cancel', annuler);
    document.removeEventListener('visibilitychange', visibilite);
    window.removeEventListener('blur', flou);
    window.removeEventListener('focus', retour);
    const i = instance;
    const t = toile;
    instance = null;
    toile = null;
    attente?.remove();
    attente = null;
    delete fenetre!.dataset.moteur;
    const retirer = () => {
      t?.remove();
      const w = window as unknown as { __portalRushUnity?: PontPage };
      if (w.__portalRushUnity === pontPage) delete w.__portalRushUnity;
      occupe = false;
    };
    if (i) void Promise.race([i.Quit().catch(() => undefined), new Promise((r) => window.setTimeout(r, 1500))]).then(retirer);
    else retirer();
  }

  /** La sortie (Unity a dit « fermer », ou le visiteur abandonne le chargement) : comme quitterJeu() de rush.ts. */
  function fermer() {
    if (fini) return;
    fini = true;
    pont.arreter();
    sonVoyage?.arreter(false);
    sonVoyage = null;
    if (voyage) voyage.fondre(150);
    sonRush('sortie');
    // On revient toujours en haut de l'accueil (demande de Mathéo, 15 octobre 2026) : ailleurs, on y part.
    if (!document.querySelector('.hero')) {
      fenetre!.classList.add('rush-unity--sortie');
      window.setTimeout(() => window.location.assign(document.documentElement.lang.startsWith('en') ? '/en/' : '/'), 220);
      return;
    }
    revenirAccueil();
    fenetre!.classList.add('rush-unity--sortie');
    window.setTimeout(() => {
      demonter();
      fenetre!.classList.remove('rush-unity--sortie');
      dreamRadio.reprendreSiSuspendue();
      if (fenetre!.open) fenetre!.close();
      document.querySelector<HTMLElement>('.jeu-bouton')?.focus({ preventScroll: true });
    }, court ? 190 : 450);
  }

  // ---- Les touches et les évènements de la page ----
  /** Pendant le voyage : Échap, Entrée ou Espace le passent (comme rush.ts) ; le reste attend. Pas après le relais. */
  const toucheVoyage = (e: KeyboardEvent) => {
    if (!voyage || relais) return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) {
        sonVoyage?.arreter(true);
        sonVoyage = null;
        voyage.passer();
      }
    } else if (!e.ctrlKey && !e.metaKey) e.preventDefault();
  };
  /** Jeu ouvert : Échap n'est pas pris par le navigateur (il irait fermer la fenêtre) mais reste à Unity. */
  const touche = (e: KeyboardEvent) => {
    if (!fenetre.open || fenetre.dataset.moteur !== 'unity' || (voyage && !relais) || fini) return;
    if (e.key === 'Escape') e.preventDefault();
    if (!pont.branche) {
      if (e.key === 'Escape' && !e.repeat) {
        journal('chargement interrompu par le visiteur.');
        fermer();
      }
      return;
    }
    // (La touche suivante ira à Unity : il n'écoute le clavier que sur sa toile.)
    if (toile && document.activeElement !== toile) toile.focus({ preventScroll: true });
  };
  /** Les autres demandes de fermeture (bouton « retour » d'un téléphone…) : Unity coupe tout et répond « fermer ». */
  const annuler = (e: Event) => {
    if (fenetre.dataset.moteur !== 'unity' || fini) return;
    e.preventDefault();
    if (!pont.branche) return fermer();
    pont.envoyer({ type: 'fermer' });
    window.setTimeout(() => fermer(), 1500);
  };
  const visibilite = () => pont.branche && pont.envoyer({ type: document.hidden ? 'pause' : 'reprendre' });
  const flou = () => pont.branche && pont.envoyer({ type: 'pause' });
  const retour = () => pont.branche && !document.hidden && pont.envoyer({ type: 'reprendre' });
  document.addEventListener('keydown', touche, true);
  fenetre.addEventListener('cancel', annuler);
  document.addEventListener('visibilitychange', visibilite);
  window.addEventListener('blur', flou);
  window.addEventListener('focus', retour);
  window.addEventListener('keydown', toucheVoyage, true);

  // ---- Le voyage (fissure, bris, tunnel), le même que pour l'ancien jeu ----
  voyage = voyageTemporel({
    source: o.depuis,
    point: o.point,
    duree,
    court,
    passerVisibleTout: s0.tutoriel.etat !== 'nouveau' || s0.totaux.parties > 0,
    texte: { passer: textes.voyage?.passer ?? 'Passer' },
    moment: (q) => {
      if (import.meta.env.DEV) ((window as unknown as { __voyage?: [string, number][] }).__voyage ??= []).push([q, performance.now()]);
      // L'ouverture remplit l'écran : la fenêtre du jeu peut s'ouvrir dessous, et Unity démarrer.
      if (q === 'tunnel') {
        tunnelVu = true;
        monter();
      }
      // (Passé d'un clic : le son s'arrête aussi, sur un court accord d'arrivée.)
      if (q === 'passe' && sonVoyage) {
        sonVoyage.arreter(true);
        sonVoyage = null;
      }
    },
    // (Le tunnel file en croisière tant que Unity n'a pas repris l'image.)
    retenir: () => !relais && !echec && !fini,
    arrivee: (p) => arriver(p),
    fin: () => {
      voyage = null;
      window.removeEventListener('keydown', toucheVoyage, true);
    },
  });
  if (!voyage) arriver(false);

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__rushUnity = {
      etat: () => ({ pret, tunnelVu, arrive, passe, intro, relais, monde, echec, fini, branche: pont.branche, ecran: pont.ecran, voyage: !!voyage, toile: !!toile, attente: !!attente && !attente.hidden }),
      sauvegarde: sauvegardePont,
    };
  }
}
