// CHANGER DE LANGUE SANS RECHARGER LA PAGE.
//
// Le site a une page par langue (« / » et « /en/ »), construites par le même
// gabarit : elles ont exactement la même forme, seuls les textes diffèrent.
// On s'en sert ainsi :
//   1. au tout début, avant que les autres modules ne touchent à la page, on
//      recense ses éléments dans l'ordre (recenserPage) ;
//   2. au clic sur le drapeau, on télécharge la page d'origine dans les deux
//      langues, et on recense leurs éléments de la même façon : le énième
//      élément de l'une correspond au énième de l'autre, et au énième de la
//      page affichée ;
//   3. on compare les deux pages d'origine. Partout où un texte ou un attribut
//      diffère (libellé, titre, description d'image, adresse d'un lien…), on
//      reporte la nouvelle valeur sur l'élément affiché. Rien d'autre n'est
//      touché : ni le thème, ni les réglages, ni l'état des composants.
// La page n'est donc jamais rechargée : la scène, les sons, la galerie et la
// position de lecture restent où ils étaient.
//
// La transition dure un peu moins d'une demi-seconde : un trait de lumière
// très fin traverse l'écran de gauche à droite pendant que les textes
// s'estompent, changent, puis reviennent. Rien de brusque.
//
// Si quoi que ce soit ne correspond pas (page différente, réseau coupé), on
// revient au changement classique : le lien est suivi, la page se recharge.

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { fixer as fixerDecodage, reserver as reserverDecodage } from './decode';
import { allerA } from './defilement';
import { mouvementReduit } from './outils';
import { reglages } from './reglages';
import { retitrer } from './titres';
import { retrait } from './voyage';

/** Ce qu'on ne recense pas : le code, et les éléments ajoutés par des outils (leur nom contient un tiret). */
const IGNORES = new Set(['script', 'style', 'noscript', 'template']);

/** La liste des éléments d'une page, dans l'ordre. On n'entre pas dans les blocs marqués « data-bloc » : ils sont remplacés d'un seul tenant. */
function recenser(racine: Element): Element[] {
  const liste: Element[] = [];
  const visiter = (parent: Element) => {
    for (const enfant of parent.children) {
      const nom = enfant.localName;
      if (IGNORES.has(nom) || nom.includes('-')) continue;
      liste.push(enfant);
      if (!enfant.hasAttribute('data-bloc')) visiter(enfant);
    }
  };
  visiter(racine);
  return liste;
}

let vivants: Element[] = [];
/** À appeler avant tout autre module, tant que la page est telle que le serveur l'a envoyée. */
export function recenserPage(): void {
  vivants = recenser(document.body);
}

// ---- Les pages d'origine, téléchargées une seule fois par langue ----
interface Version {
  adresse: string;
  doc: Document;
  elements: Element[];
}
const versions = new Map<string, Promise<Version>>();

function charger(adresse: string): Promise<Version> {
  const chemin = new URL(adresse, window.location.href).pathname;
  let version = versions.get(chemin);
  if (!version) {
    version = fetch(chemin, { credentials: 'same-origin' })
      .then((reponse) => {
        if (!reponse.ok) throw new Error(`page introuvable (${reponse.status})`);
        return reponse.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return { adresse: chemin, doc, elements: recenser(doc.body) };
      });
    version.catch(() => versions.delete(chemin));
    versions.set(chemin, version);
  }
  return version;
}

/** Les deux pages d'origine ont-elles bien la forme de la page affichée ? */
function compatibles(a: Version, b: Version): boolean {
  if (a.elements.length !== vivants.length || b.elements.length !== vivants.length) return false;
  return vivants.every((el, i) => el.localName === a.elements[i].localName && el.localName === b.elements[i].localName);
}

// ---- Reporter les différences ----
const textesDe = (el: Element) => [...el.childNodes].filter((noeud): noeud is Text => noeud.nodeType === Node.TEXT_NODE);
/** L'agencement du contenu d'un élément : « t » pour un texte, « e » pour un élément. */
const agencement = (el: Element) => [...el.childNodes].map((noeud) => (noeud.nodeType === Node.TEXT_NODE ? 't' : noeud.nodeType === Node.ELEMENT_NODE ? 'e' : '')).join('');

function reporterAttributs(vivant: Element, a: Element, b: Element): void {
  for (const nom of new Set([...a.getAttributeNames(), ...b.getAttributeNames()])) {
    const valeur = b.getAttribute(nom);
    if (a.getAttribute(nom) === valeur) continue; // identique dans les deux langues : on n'y touche pas
    if (valeur === null) vivant.removeAttribute(nom);
    else vivant.setAttribute(nom, valeur);
  }
}

/** Reporte sur un élément affiché ce qui change entre sa version d'origine « a » et sa version « b ». Renvoie false s'il n'a pas su le faire. */
function reporter(vivant: Element, a: Element, b: Element): boolean {
  reporterAttributs(vivant, a, b);

  // Un bloc d'un seul tenant (texte d'une note, drapeau) : on remplace son contenu.
  if (a.hasAttribute('data-bloc')) {
    if (a.innerHTML !== b.innerHTML) vivant.innerHTML = b.innerHTML;
    return true;
  }

  const ta = textesDe(a);
  const tb = textesDe(b);
  if (ta.length === tb.length && ta.every((texte, i) => texte.nodeValue === tb[i].nodeValue)) return true; // rien à traduire ici

  // Le cas courant : l'élément affiché a gardé sa forme d'origine. On change ses textes, un par un.
  const forme = agencement(a);
  if (forme === agencement(b) && forme === agencement(vivant)) {
    const tv = textesDe(vivant);
    tb.forEach((texte, i) => {
      if (tv[i].nodeValue !== texte.nodeValue) tv[i].nodeValue = texte.nodeValue;
    });
    return true;
  }

  // Un titre découpé en lignes par l'animation : son module sait le réécrire.
  if (vivant instanceof HTMLElement && retitrer(vivant, b.innerHTML)) return true;

  // Un simple libellé qu'un script a réécrit entre-temps (décodage en cours…).
  if (!a.children.length && !b.children.length) {
    vivant.textContent = b.textContent;
    return true;
  }

  // Les mêmes éléments, mais les textes autour ne sont pas rangés pareil d'une
  // langue à l'autre : on recompose le contenu en gardant les éléments en place.
  const enfants = [...vivant.children];
  if (enfants.length === b.children.length) {
    vivant.replaceChildren(...[...b.childNodes].map((noeud) => (noeud.nodeType === Node.ELEMENT_NODE ? enfants.shift()! : document.importNode(noeud, true))));
    return true;
  }
  return false;
}

/** L'en-tête de la page : titre, description, adresse officielle, aperçu de partage, données structurées. */
function reporterEntete(b: Document): void {
  document.title = b.title;
  b.head.querySelectorAll<HTMLElement>('meta[name], meta[property], link[rel="canonical"]').forEach((source) => {
    const cle = source.hasAttribute('name') ? `[name="${source.getAttribute('name')}"]` : source.hasAttribute('property') ? `[property="${source.getAttribute('property')}"]` : '[rel="canonical"]';
    const vivant = document.head.querySelector(`${source.localName}${cle}`);
    const attribut = source.localName === 'link' ? 'href' : 'content';
    const valeur = source.getAttribute(attribut);
    if (vivant && valeur !== null && vivant.getAttribute(attribut) !== valeur) vivant.setAttribute(attribut, valeur);
  });
  const donnees = b.head.querySelector('script[type="application/ld+json"]');
  const vivantes = document.head.querySelector('script[type="application/ld+json"]');
  if (donnees && vivantes) vivantes.textContent = donnees.textContent;
}

// ---- Garder la position de lecture ----
// Les textes n'ont pas la même longueur dans les deux langues : la page change
// de hauteur. On repère donc un point d'appui avant le changement, et on le
// remet à la même hauteur de l'écran après.
export function ancrer(): () => void {
  // Dans un bloc épinglé (la galerie), rien ne bouge à l'écran : on garde le chemin
  // parcouru depuis le début de l'épinglage, donc la même carte.
  const epingle = ScrollTrigger.getAll().find((declencheur) => declencheur.pin && window.scrollY >= declencheur.start && window.scrollY <= declencheur.end);
  if (epingle) {
    const parcouru = window.scrollY - epingle.start;
    return () => allerA(epingle.start + parcouru, true);
  }
  // Une section est calée sous la barre (on vient d'y naviguer) : elle le restera.
  for (const section of document.querySelectorAll<HTMLElement>('[data-section]')) {
    if (Math.abs(section.getBoundingClientRect().top - retrait(section)) < 8) return () => allerA(section, true, retrait(section));
  }
  // Ailleurs : le premier bloc de texte visible sous la barre. (La scène de l'accueil
  // est collée à l'écran : ses textes ne peuvent pas servir de point d'appui.)
  for (const bloc of document.querySelectorAll<HTMLElement>('main :is(h1, h2, h3, h4, p, li, summary, dt, figure)')) {
    const cadre = bloc.getBoundingClientRect();
    if (cadre.height === 0 || cadre.top < 70 || cadre.top > window.innerHeight || bloc.closest('.hero')) continue;
    return () => {
      const ecart = bloc.getBoundingClientRect().top - cadre.top;
      if (Math.abs(ecart) > 0.5) allerA(window.scrollY + ecart, true);
    };
  }
  const y = window.scrollY;
  return () => allerA(y, true);
}

// ---- La transition ----
let trait: HTMLElement | null = null;
// (15 octobre 2026, demandes de Mathéo : plus long qu'avant (460 ms), puis un peu moins lent (1 660 → 1 300 → 1 000 ms),
// et un voile un peu moins sombre.)
const DUREE = 1000; // millisecondes

function jouerTransition(): void {
  // Les textes s'effacent, le temps que le trait passe, puis reviennent.
  document.querySelectorAll<HTMLElement>('main, .barre, .trajet').forEach((zone) => {
    zone.animate([{ opacity: 1 }, { opacity: 0.42, offset: 0.4 }, { opacity: 0.42, offset: 0.5 }, { opacity: 1 }], { duration: DUREE, easing: 'ease-in-out' });
  });
  trait?.animate(
    [
      { translate: '-12vw 0', opacity: 0 },
      { opacity: 1, offset: 0.14 },
      { opacity: 1, offset: 0.84 },
      { translate: '100vw 0', opacity: 0 },
    ],
    { duration: DUREE, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
  );
}

let occupe = false;

/**
 * Passe la page dans la langue de l'adresse donnée, sans la recharger.
 * En cas d'impossibilité, suit simplement l'adresse (rechargement classique).
 */
export async function changerLangue(adresse: string): Promise<void> {
  if (occupe) return;
  occupe = true;
  try {
    const [a, b] = await Promise.all([charger(window.location.pathname), charger(adresse)]);
    if (!compatibles(a, b)) throw new Error('les deux pages n’ont pas la même forme');

    if (!mouvementReduit && reglages.animations !== 0) {
      jouerTransition();
      await new Promise((suite) => window.setTimeout(suite, DUREE * 0.44)); // au creux du fondu
    }

    const replacer = ancrer();
    let rates = 0;
    reporterAttributs(document.documentElement, a.doc.documentElement, b.doc.documentElement); // dont lang="…"
    reporterAttributs(document.body, a.doc.body, b.doc.body);
    vivants.forEach((vivant, i) => {
      if (!reporter(vivant, a.elements[i], b.elements[i])) rates++;
    });
    reporterEntete(b.doc);
    // Les libellés « décodés » dont le texte vient de changer le gardent comme texte final.
    vivants.forEach((vivant, i) => {
      if (vivant instanceof HTMLElement && vivant.hasAttribute('data-decode') && a.elements[i].textContent !== b.elements[i].textContent) fixerDecodage(vivant);
    });
    reserverDecodage();

    // L'adresse change sans navigation, et sans ajouter d'étape à l'historique.
    history.replaceState(history.state, '', b.adresse + window.location.hash);
    try {
      sessionStorage.removeItem('position-avant-langue'); // (mémoire du changement classique : inutile ici)
    } catch {
      // stockage indisponible : rien à effacer
    }
    if (rates) console.warn(`Changement de langue : ${rates} élément(s) n'ont pas pu être traduits sur place.`);

    // Les modules qui gardent des textes en mémoire (palette, mini-jeu, onglet) les relisent.
    window.dispatchEvent(new CustomEvent('langue', { detail: document.documentElement.lang }));

    // La page a changé de hauteur : on recalcule, on reprend le point d'appui,
    // et on laisse le menu et les filtres remesurer leurs libellés.
    ScrollTrigger.refresh();
    replacer();
    ScrollTrigger.update();
    window.dispatchEvent(new Event('resize'));
  } catch {
    window.location.href = adresse;
    return;
  } finally {
    // (On attend la fin du trait avant d'accepter un autre changement.)
    window.setTimeout(() => (occupe = false), DUREE * 0.6);
  }
}

export function initLangue(): void {
  trait = document.createElement('div');
  trait.className = 'balayage';
  trait.setAttribute('aria-hidden', 'true');
  document.body.append(trait);

  // Le drapeau (dans la barre, et dans le menu du téléphone).
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const lien = (e.target as Element).closest<HTMLAnchorElement>('a[data-langue]');
    if (!lien) return;
    e.preventDefault();
    void changerLangue(lien.href);
  });

  // Dès que le visiteur s'approche du drapeau, on télécharge les deux pages : le clic n'attend pas.
  const preparer = (e: Event) => {
    const lien = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[data-langue]');
    if (!lien) return;
    charger(window.location.pathname).catch(() => {});
    charger(lien.href).catch(() => {});
  };
  document.addEventListener('pointerover', preparer, { passive: true });
  document.addEventListener('focusin', preparer);
  document.addEventListener('touchstart', preparer, { passive: true });
}
