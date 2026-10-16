// LA RECHERCHE DANS LE PORTFOLIO (16 octobre 2026)
// Le deuxième outil de la barre, aussi au clavier : Ctrl + K (Cmd + K sur Mac).
// Une palette légère : on tape, les résultats viennent de l'index construit au build à partir
// du vrai contenu (voir Recherche.astro), sans aucun appel réseau.
//
// Comprendre une recherche : en minuscules, sans accents ; chaque mot tapé doit se trouver
// dans le résultat (au début d'un mot, ou dedans). Le titre compte plus que le texte.
// Depuis le 16 octobre 2026, un mot peut aussi être trouvé par :
//   - son singulier (« projets » → « projet ») ;
//   - un synonyme, en français ou en anglais (synonymes.ts : « gaming » → Portal Rush,
//     « alternance » → CV, parcours, contact) ; il compte un peu moins que le mot lui-même ;
//   - une petite faute de frappe (une lettre de plus, de moins ou changée, sur un mot assez long) ;
// et les mots vides sont ignorés (« me joindre » → « joindre »).
//
// Ouvrir un résultat :
//   - une destination, ou un chapitre (une compétence, une note de veille, la méthode…) :
//     on y voyage par la navigation du site, et le chapitre est rejoint (fil.ts) ;
//   - une réalisation : on rejoint les Réalisations, et la galerie l'amène de face ;
//   - Portal Rush : le jeu s'ouvre ; le CV, LinkedIn, GitHub : dans un nouvel onglet.
// Depuis une fiche, on part vers l'accueil, à la bonne destination.
//
// Clavier : ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer (le focus revient au bouton).

import { allerChapitre } from './fil';
import { ouvrirRush } from './rush/rush';
import { reglages } from './reglages';
import { mouvementReduit } from './outils';
import { MOTS_VIDES, SYNONYMES } from './synonymes';
import type { Destination } from './voyage';

interface Entree {
  t: string;
  titre: string;
  texte: string;
  mots?: string;
  d?: Destination;
  ch?: string;
  href?: string;
  externe?: boolean;
  fiche?: string;
  jeu?: boolean;
}
interface Textes {
  vide: string;
  suggestions: string;
  resultats: string;
  types: Record<string, string>;
}

/** En minuscules, sans accents ni ponctuation : « Électron, » devient « electron ». */
const simplifier = (texte: string) =>
  texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`«»"(),.;:!?/·–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ---- Les synonymes, simplifiés une fois : à chaque mot, les groupes qui le contiennent ----
const GROUPES = SYNONYMES.map((groupe) => groupe.map(simplifier));
const PAR_MOT = new Map<string, number[]>();
GROUPES.forEach((groupe, k) => groupe.forEach((mot) => PAR_MOT.set(mot, [...(PAR_MOT.get(mot) ?? []), k])));

/** Le mot lui-même, et son singulier ; puis ses synonymes. */
function formes(mot: string): { propres: string[]; synonymes: string[] } {
  const propres = [mot];
  if (mot.length > 3 && /[sx]$/.test(mot)) propres.push(mot.slice(0, -1));
  const synonymes = new Set<string>();
  for (const forme of propres) for (const k of PAR_MOT.get(forme) ?? []) GROUPES[k].forEach((autre) => !propres.includes(autre) && synonymes.add(autre));
  return { propres, synonymes: [...synonymes] };
}

/** Deux mots à une faute près (une lettre ajoutée, retirée ou changée) ? */
function presque(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0;
  let j = 0;
  let fautes = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++fautes > 1) return false;
    // Deux lettres inversées (« pyhton ») comptent pour une seule faute.
    if (a[i] === b[j + 1] && a[i + 1] === b[j]) {
      i += 2;
      j += 2;
    } else if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return fautes + (a.length - i) + (b.length - j) <= 1;
}

/** Un petit avantage par genre de résultat, pour départager deux résultats aussi pertinents. */
const BONUS: Record<string, number> = { destination: 0.5, document: 0.3, contact: 0.25, jeu: 0.2, projet: 0.15, competence: 0.1, parcours: 0.05 };

const echapper = (mot: string) => mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let ouvrir: ((depuis?: HTMLElement | null) => void) | null = null;
/** Ouvre la recherche (le bouton de la barre, Ctrl + K). */
export function ouvrirRecherche(depuis?: HTMLElement | null): void {
  ouvrir?.(depuis);
}

export function initRecherche(): void {
  const fenetre = document.querySelector<HTMLDialogElement>('.recherche');
  if (!fenetre) return;
  const champ = fenetre.querySelector<HTMLInputElement>('#recherche-champ')!;
  const liste = fenetre.querySelector<HTMLUListElement>('.recherche__liste')!;
  const etat = fenetre.querySelector<HTMLElement>('.recherche__etat')!;
  const surAccueil = fenetre.dataset.page === 'accueil';

  let index: Entree[] = [];
  let suggestions: number[] = [];
  let textes: Textes = { vide: '', suggestions: '', resultats: '', types: {} };
  /** Ce qu'on compare : le titre et le reste, simplifiés une fois pour toutes, les mots du titre, et le genre. */
  let prepare: { titre: string; tout: string; motsTitre: string[]; genre: string }[] = [];
  const lire = () => {
    index = JSON.parse(fenetre.dataset.index ?? '[]');
    suggestions = JSON.parse(fenetre.dataset.suggestions ?? '[]');
    textes = JSON.parse(fenetre.dataset.textes ?? '{}');
    prepare = index.map((e) => {
      const titre = simplifier(e.titre);
      return { titre, tout: simplifier(`${e.titre} ${e.texte} ${e.mots ?? ''} ${textes.types[e.t] ?? ''}`), motsTitre: titre.split(' '), genre: simplifier(textes.types[e.t] ?? '') };
    });
  };
  lire();

  let affiches: number[] = [];
  let choisi = 0;

  /** La note d'une forme dans une entrée : au début du titre, au début d'un mot du titre, dans le titre, puis ailleurs. 0 : absente. */
  const noter = (p: (typeof prepare)[number], forme: string): number => {
    const debutMot = new RegExp(`(^| )${echapper(forme)}`);
    if (p.titre.startsWith(forme)) return 6;
    if (debutMot.test(p.titre)) return 4;
    if (p.titre.includes(forme)) return 2;
    if (debutMot.test(p.tout)) return 1.5;
    if (forme.length > 2 && p.tout.includes(forme)) return 0.6;
    return 0;
  };

  /** Les résultats d'une recherche, du plus pertinent au moins pertinent. */
  const chercher = (requete: string): number[] => {
    const tapes = simplifier(requete).split(' ').filter(Boolean);
    if (!tapes.length) return suggestions;
    // Les mots vides ne comptent pas, sauf si la recherche n'a rien d'autre.
    const pleins = tapes.filter((mot) => !MOTS_VIDES.has(mot));
    const mots = (pleins.length ? pleins : tapes).map((mot) => ({ mot, ...formes(mot) }));
    const notes: { i: number; note: number }[] = [];
    prepare.forEach((p, i) => {
      let note = 0;
      for (const { mot, propres, synonymes } of mots) {
        // Le mot lui-même (ou son singulier) ; sinon un synonyme, qui compte un peu moins ; sinon une petite faute dans le titre.
        let meilleure = Math.max(...propres.map((forme) => noter(p, forme)));
        // (Un synonyme trouvé dans un titre ne vaut pas le mot lui-même : il est plafonné.)
        if (!meilleure && synonymes.length) meilleure = Math.min(1.5, Math.max(...synonymes.map((forme) => noter(p, forme)))) * 0.7;
        if (!meilleure && mot.length >= 5 && p.motsTitre.some((m) => presque(mot, m))) meilleure = 1.8;
        if (!meilleure) return; // un mot introuvable : ce résultat ne convient pas
        note += meilleure;
        // Le mot nomme le genre du résultat (« projets », « compétence », « contact ») : c'en est un.
        if (p.genre && (propres.includes(p.genre) || synonymes.includes(p.genre))) note += propres.includes(p.genre) ? 3 : 2;
      }
      if (p.titre === tapes.join(' ')) note += 5; // le titre exact
      // À égalité, l'ordre des genres départage : une destination, un document (le CV), un moyen de contact…
      note += BONUS[index[i].t] ?? 0;
      notes.push({ i, note });
    });
    // Un même titre peut revenir (une compétence dans deux domaines) : on garde le meilleur.
    const vus = new Set<string>();
    return notes
      .sort((a, b) => b.note - a.note)
      .filter(({ i }) => {
        const cle = `${index[i].t}|${index[i].titre}|${index[i].ch ?? index[i].href ?? ''}`;
        if (vus.has(cle)) return false;
        vus.add(cle);
        return true;
      })
      .slice(0, 12)
      .map(({ i }) => i);
  };

  /** Met en valeur les mots trouvés dans un texte (sans toucher au texte lui-même). */
  const surligner = (texte: string, requete: string): Node[] => {
    const mots = simplifier(requete).split(' ').filter((m) => m.length > 1);
    if (!mots.length) return [document.createTextNode(texte)];
    const base = texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // (La normalisation garde la même longueur pour les lettres accentuées courantes du français : é → e.)
    if (base.length !== texte.length) return [document.createTextNode(texte)];
    const marques = new Array(texte.length).fill(false);
    mots.forEach((mot) => {
      let k = base.indexOf(mot);
      while (k >= 0) {
        for (let j = k; j < k + mot.length; j++) marques[j] = true;
        k = base.indexOf(mot, k + mot.length);
      }
    });
    const noeuds: Node[] = [];
    let i = 0;
    while (i < texte.length) {
      const marque = marques[i];
      let j = i;
      while (j < texte.length && marques[j] === marque) j++;
      const morceau = texte.slice(i, j);
      if (marque) {
        const m = document.createElement('mark');
        m.textContent = morceau;
        noeuds.push(m);
      } else noeuds.push(document.createTextNode(morceau));
      i = j;
    }
    return noeuds;
  };

  const afficher = () => {
    const requete = champ.value;
    affiches = chercher(requete);
    choisi = affiches.length ? Math.min(choisi, affiches.length - 1) : -1;
    liste.replaceChildren(
      ...affiches.map((i, rang) => {
        const e = index[i];
        const li = document.createElement('li');
        li.className = 'recherche__resultat';
        li.id = `recherche-${rang}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(rang === choisi));
        li.dataset.rang = String(rang);
        const titre = document.createElement('b');
        titre.append(...surligner(e.titre, requete));
        const texte = document.createElement('small');
        texte.append(...surligner(e.texte, requete));
        const type = document.createElement('span');
        type.className = 'recherche__type';
        type.textContent = `${textes.types[e.t] ?? ''}${e.externe ? ' ↗' : ''}`;
        li.append(titre, type, texte);
        return li;
      }),
    );
    const n = affiches.length;
    etat.textContent = !champ.value.trim() ? textes.suggestions : n ? textes.resultats.replace('{n}', String(n)) : textes.vide.replace('{q}', champ.value.trim());
    if (choisi >= 0) champ.setAttribute('aria-activedescendant', `recherche-${choisi}`);
    else champ.removeAttribute('aria-activedescendant');
  };

  const choisir = (rang: number) => {
    if (!affiches.length) return;
    choisi = (rang + affiches.length) % affiches.length;
    liste.querySelectorAll('[role="option"]').forEach((li, k) => li.setAttribute('aria-selected', String(k === choisi)));
    champ.setAttribute('aria-activedescendant', `recherche-${choisi}`);
    liste.querySelector(`#recherche-${choisi}`)?.scrollIntoView({ block: 'nearest', behavior: mouvementReduit || reglages.animations === 0 ? 'auto' : 'smooth' });
  };

  /** Ouvre un résultat : la fenêtre se ferme, puis on y va. */
  const executer = (rang: number) => {
    const e = index[affiches[rang]];
    if (!e) return;
    fenetre.close();
    if (e.jeu) return void ouvrirRush();
    if (e.href) return void window.open(e.href, '_blank', 'noopener,noreferrer');
    if (!e.d) return;
    if (!surAccueil) {
      // Depuis une fiche : une réalisation mène à sa fiche ; le reste, à sa destination sur l'accueil.
      if (e.fiche && e.t === 'projet') return void (window.location.href = e.fiche);
      return void (window.location.href = `${fenetre.dataset.accueil ?? '/'}${e.d === 'accueil' ? '' : `#${e.d}`}`);
    }
    // (Un résultat choisi est un accès direct : le court fondu, pas le long saut dans le temps.)
    allerChapitre(e.d, e.ch, { ouvrir: e.t === 'veille' || e.ch === 'tableau', direct: true });
  };

  let retour: HTMLElement | null = null;
  ouvrir = (depuis) => {
    if (fenetre.open) return;
    if (document.querySelector('dialog[open]')) return; // une autre fenêtre est déjà ouverte (carte, jeu…)
    retour = depuis ?? (document.activeElement as HTMLElement | null);
    document.querySelectorAll<HTMLElement>('#acces:popover-open, #reglages:popover-open').forEach((p) => p.hidePopover());
    champ.value = '';
    choisi = 0;
    afficher();
    fenetre.showModal();
    champ.focus();
    window.dispatchEvent(new Event('outil'));
  };

  champ.addEventListener('input', () => {
    choisi = 0;
    afficher();
  });
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      choisir(choisi + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (choisi >= 0) executer(choisi);
    }
  });
  liste.addEventListener('click', (e) => {
    const li = (e.target as Element).closest<HTMLElement>('[role="option"]');
    if (li) executer(Number(li.dataset.rang));
  });
  liste.addEventListener('pointermove', (e) => {
    const li = (e.target as Element).closest<HTMLElement>('[role="option"]');
    if (li && Number(li.dataset.rang) !== choisi) choisir(Number(li.dataset.rang));
  });
  fenetre.querySelector('[data-recherche-fermer]')?.addEventListener('click', () => fenetre.close());
  // Un clic sur le fond (hors de la fenêtre) la referme ; Échap est géré par le navigateur.
  fenetre.addEventListener('click', (e) => {
    if (e.target === fenetre) fenetre.close();
  });
  fenetre.addEventListener('close', () => {
    window.dispatchEvent(new Event('outil'));
    // Le focus revient au bouton qui l'a ouverte, s'il est toujours là.
    if (retour?.isConnected && !document.querySelector('dialog[open]')) retour.focus({ preventScroll: true });
    retour = null;
  });

  // Ctrl + K (Cmd + K) : ouvre la recherche, ou la referme. (Le terminal caché garde la touche ² et le mot « trace ».)
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'k') return;
    if (document.querySelector('.rush[open]')) return; // pas pendant une partie
    e.preventDefault();
    if (fenetre.open) fenetre.close();
    else ouvrir?.(null);
  });

  // Le changement de langue : l'index et les textes sont relus.
  window.addEventListener('langue', () => {
    lire();
    if (fenetre.open) afficher();
  });
}
