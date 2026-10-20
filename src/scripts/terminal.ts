// LA PALETTE DE COMMANDES, en forme de terminal.
// Elle s'ouvre avec la touche ² (celle des consoles de jeu, en haut à gauche du
// clavier français), ou en tapant le mot « trace » n'importe où sur la page.
// (Ctrl + K, son ancien raccourci, ouvre la recherche depuis le 16 octobre 2026.)
//
// On tape une commande, ou seulement son début : la liste du dessous se
// filtre à mesure. Les flèches haut et bas choisissent une ligne, Entrée
// l'exécute, Échap referme. Un clic sur une ligne l'exécute aussi.
//
// Les mots des commandes et leurs réponses viennent du contenu (fr.ts, en.ts) :
// le HTML les transmet dans des attributs data-, lus ici.

import { ouvrirPortail } from './portail';
import { changerLangue } from './langue';
import { voyager } from './voyage';

type IdCommande =
  | 'aide'
  | 'accueil'
  | 'competences'
  | 'realisations'
  | 'veille'
  | 'contact'
  | 'carte'
  | 'cv'
  | 'projets'
  | 'ouvrir'
  | 'langue'
  | 'qui'
  | 'fermer';

interface Textes {
  accueil: string;
  inconnue: string;
  aide: string;
  commandes: Record<IdCommande, { nom: string; texte: string }>;
  qui: string;
  ouvrirErreur: string;
}

const MOT_SECRET = 'trace';

export function initTerminal(): void {
  const boite = document.querySelector<HTMLElement>('.terminal');
  if (!boite) return;

  let textes: Textes = JSON.parse(boite.dataset.textes ?? '{}');
  let projets: { nom: string; href: string }[] = JSON.parse(boite.dataset.projets ?? '[]');
  let liens = { accueil: boite.dataset.accueil ?? '/', cv: boite.dataset.cv ?? '', langue: boite.dataset.langue ?? '' };
  // Changement de langue : les commandes, leurs réponses et les adresses sont relues.
  window.addEventListener('langue', () => {
    textes = JSON.parse(boite.dataset.textes ?? '{}');
    projets = JSON.parse(boite.dataset.projets ?? '[]');
    liens = { accueil: boite.dataset.accueil ?? '/', cv: boite.dataset.cv ?? '', langue: boite.dataset.langue ?? '' };
    if (ouvert) filtrer();
  });
  const ids = Object.keys(textes.commandes) as IdCommande[];

  const sortie = boite.querySelector<HTMLElement>('.terminal__sortie')!;
  const liste = boite.querySelector<HTMLElement>('.terminal__suggestions')!;
  const formulaire = boite.querySelector<HTMLFormElement>('form')!;
  const champ = boite.querySelector<HTMLInputElement>('input')!;
  let ouvert = false;
  let dejaOuvert = false;
  let frappes = ''; // les dernières lettres tapées sur la page, pour reconnaître le mot secret
  let retour: HTMLElement | null = null; // l'élément qui avait le focus avant l'ouverture
  let proposees: IdCommande[] = []; // les commandes affichées dans la liste
  let choisie = -1; // la ligne choisie aux flèches (-1 : aucune)

  const ecrire = (ligne: string, classe = '') => {
    const p = document.createElement('div');
    p.textContent = ligne;
    if (classe) p.className = classe;
    sortie.append(p);
    sortie.scrollTop = sortie.scrollHeight;
  };

  const ouvrir = () => {
    if (ouvert) return;
    ouvert = true;
    retour = document.activeElement as HTMLElement | null;
    boite.hidden = false;
    void boite.offsetWidth; // force le navigateur à prendre en compte l'état caché avant d'animer
    boite.classList.add('est-ouvert');
    if (!dejaOuvert) ecrire(textes.accueil);
    dejaOuvert = true;
    champ.value = '';
    filtrer();
    champ.focus({ preventScroll: true });
  };

  const fermer = () => {
    if (!ouvert) return;
    ouvert = false;
    boite.classList.remove('est-ouvert');
    window.setTimeout(() => !ouvert && (boite.hidden = true), 320);
    retour?.focus?.({ preventScroll: true });
  };

  /**
   * Va à une section. L'identifiant de ces commandes est aussi l'ancre de la
   * section : sur l'accueil on la rejoint par le fil, depuis une autre page on suit un lien.
   */
  const allerSection = (id: string) => {
    fermer();
    if (document.getElementById(id)) voyager(id);
    else window.location.href = `${liens.accueil}#${id}`;
  };

  // ---- Ce que fait chaque commande ----
  const actions: Record<IdCommande, (argument: string) => void> = {
    aide: () => {
      ecrire(textes.aide);
      ids.forEach((id) => ecrire(`  ${textes.commandes[id].nom.padEnd(12)} ${textes.commandes[id].texte}`));
    },
    accueil: () => allerSection('accueil'),
    competences: () => allerSection('competences'),
    realisations: () => allerSection('realisations'),
    veille: () => allerSection('veille'),
    contact: () => allerSection('contact'),
    carte: () => {
      fermer();
      ouvrirPortail();
    },
    cv: () => window.open(liens.cv, '_blank', 'noopener'),
    projets: () => projets.forEach((p, i) => ecrire(`  ${i + 1}  ${p.nom}`)),
    ouvrir: (argument) => {
      const projet = projets[Number(argument) - 1];
      if (projet) window.location.href = projet.href;
      else ecrire(textes.ouvrirErreur);
    },
    langue: () => void changerLangue(liens.langue),
    qui: () => ecrire(textes.qui),
    fermer,
  };

  const executer = (id: IdCommande, argument = '') => {
    ecrire(`> ${textes.commandes[id].nom}${argument ? ` ${argument}` : ''}`, 'est-commande');
    champ.value = '';
    filtrer();
    actions[id](argument);
  };

  // ---- La liste filtrée ----
  /** N'affiche que les commandes dont le nom ou la description contient ce qui est tapé. */
  function filtrer(): void {
    const tape = champ.value.trim().toLowerCase().split(/\s+/)[0] ?? '';
    proposees = ids.filter((id) => {
      const c = textes.commandes[id];
      return !tape || c.nom.startsWith(tape) || (tape.length > 2 && c.texte.toLowerCase().includes(tape));
    });
    choisie = tape && proposees.length ? 0 : -1;
    liste.replaceChildren(
      ...proposees.map((id, i) => {
        const ligne = document.createElement('button');
        ligne.type = 'button';
        ligne.tabIndex = -1; // on la choisit aux flèches depuis le champ, pas à la touche Tab
        ligne.dataset.commande = id;
        ligne.classList.toggle('est-choisie', i === choisie);
        const nom = document.createElement('b');
        nom.textContent = textes.commandes[id].nom;
        const texte = document.createElement('span');
        texte.textContent = textes.commandes[id].texte;
        ligne.append(nom, texte);
        return ligne;
      }),
    );
  }

  const choisir = (rang: number) => {
    if (!proposees.length) return;
    choisie = (rang + proposees.length) % proposees.length;
    [...liste.children].forEach((ligne, i) => ligne.classList.toggle('est-choisie', i === choisie));
    liste.children[choisie]?.scrollIntoView({ block: 'nearest' });
  };

  champ.addEventListener('input', filtrer);
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      choisir(choisie + (e.key === 'ArrowDown' ? 1 : -1));
    }
  });
  liste.addEventListener('click', (e) => {
    const ligne = (e.target as Element).closest<HTMLElement>('[data-commande]');
    if (ligne) executer(ligne.dataset.commande as IdCommande);
    champ.focus({ preventScroll: true });
  });

  formulaire.addEventListener('submit', (e) => {
    e.preventDefault();
    const [mot = '', argument = ''] = champ.value.trim().toLowerCase().split(/\s+/);
    const exacte = ids.find((id) => textes.commandes[id].nom === mot);
    if (exacte) executer(exacte, argument);
    else if (choisie >= 0) executer(proposees[choisie], argument);
    else if (mot) {
      ecrire(`> ${mot}`, 'est-commande');
      ecrire(textes.inconnue.replace('{commande}', mot));
      champ.value = '';
      filtrer();
    }
  });

  boite.querySelector('.terminal__fermer')?.addEventListener('click', fermer);

  document.addEventListener('keydown', (e) => {
    // Ctrl + K (ou Cmd + K) ouvre désormais la recherche (recherche.ts, 16 octobre 2026) : le terminal s'efface devant elle.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      if (ouvert) fermer();
      return;
    }
    if (ouvert) {
      if (e.key === 'Escape') fermer();
      return;
    }
    // On n'écoute pas ce qui est tapé dans un champ de saisie ou dans le mini-jeu.
    if ((e.target as Element).closest('input, textarea, [contenteditable], .rush, .hub')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '²') {
      e.preventDefault();
      ouvrir();
      return;
    }
    if (e.key.length === 1) {
      frappes = (frappes + e.key.toLowerCase()).slice(-MOT_SECRET.length);
      if (frappes === MOT_SECRET) ouvrir();
    }
  });

}
