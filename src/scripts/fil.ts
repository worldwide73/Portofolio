// LE FIL DES CHAPITRES : la ligne lumineuse en bas de l'écran.
//
// Depuis le 16 octobre 2026, il ne répète plus les cinq destinations (c'est le rôle du
// portail) : il montre les chapitres internes de la destination affichée, et permet de
// passer de l'un à l'autre.
//   - Accueil : Intro, Méthode, Parcours, Explorer ;
//   - Compétences : les cinq domaines, puis le tableau BTS ;
//   - Réalisations : les projets de la galerie (le point actif suit la carte de face) ;
//   - Veille : les notes ;
//   - Contact : Présentation, Coordonnées, Crédits.
// Les chapitres sont lus dans la page : tout bloc marqué data-chapitre-de="<destination>"
// (avec data-chapitre, son identifiant, et data-chapitre-nom, son nom) en est un.
//
// Le point actif dit ce qui est réellement à l'écran : il est calculé d'après la position
// des chapitres (ou, pour les réalisations, d'après l'état de la galerie), jamais d'après
// une animation lancée mais pas encore arrivée. Un clic sur un point, les deux flèches du
// fil et les flèches ← → du clavier rejoignent le chapitre voulu, en douceur.
//
// Au-dessus du fil : « Compétences · 02 / 06 ». Le trait tout en haut de la page dit la même chose.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lenis } from './defilement';
import { borner, mouvementReduit } from './outils';
import { destinationActive, voyager, type Destination } from './voyage';

/** Les blocs qui forment les chapitres d'une destination, dans l'ordre de la page (sans les notes masquées par un filtre). */
const chapitresDe = (destination: string) => [...document.querySelectorAll<HTMLElement>(`[data-chapitre-de="${destination}"]`)].filter((el) => !el.hidden);

/** La distance à laisser sous la barre fixe quand on rejoint un chapitre. */
const retraitChapitre = () => {
  const barre = document.querySelector<HTMLElement>('.barre');
  return (barre ? barre.getBoundingClientRect().bottom : 76) + 18;
};

let allerAuChapitre: ((destination: Destination, cle: string, options?: { ouvrir?: boolean }) => void) | null = null;
/**
 * Rejoint un chapitre d'une destination (la recherche s'en sert). Si la destination n'est pas
 * affichée, on y voyage d'abord ; « ouvrir » déplie aussi le bloc (une note de veille, le tableau).
 */
export function allerChapitre(destination: Destination, cle?: string, options: { ouvrir?: boolean } = {}): void {
  if (!cle) return void voyager(destination);
  allerAuChapitre?.(destination, cle, options);
}

export function initFil(): void {
  const rail = document.querySelector<HTMLElement>('.trajet');
  const liste = rail?.querySelector<HTMLOListElement>('.trajet__fil ol');
  const etat = rail?.querySelector<HTMLElement>('.trajet__etat');
  const progression = document.querySelector<HTMLElement>('.progression'); // le trait tout en haut de la page
  if (!rail || !liste) return;

  let chapitres: HTMLElement[] = [];
  let points: HTMLButtonElement[] = [];
  let destination: Destination = destinationActive();
  let rang = -1; // le chapitre actif
  let position = 0; // la même chose en continu : 1,5 = à mi-chemin entre le 2e et le 3e
  let galerie = -1; // la réalisation de face, annoncée par galerie.ts
  let version = 0; // augmente quand la mise en page change : les mesures gardées ne valent plus
  let memoire = '';
  const fil = { position: 0, guide: false };

  /** Le nom affiché d'une destination : celui de la carte du portail (il suit la langue). */
  const nomDestination = (id: string) =>
    document.querySelector(`.explorateur [data-destination="${id}"] b`)?.textContent?.trim() ?? id;

  // ---- Construire le fil de la destination affichée ----
  const construire = () => {
    destination = destinationActive();
    chapitres = chapitresDe(destination);
    liste.replaceChildren(
      ...chapitres.map((chapitre, i) => {
        const li = document.createElement('li');
        const point = document.createElement('button');
        point.type = 'button';
        point.className = 'trajet__point';
        point.dataset.rang = String(i);
        const nom = chapitre.dataset.chapitreNom ?? '';
        point.setAttribute('aria-label', `${String(i + 1).padStart(2, '0')} · ${nom}`);
        const disque = document.createElement('i');
        disque.setAttribute('aria-hidden', 'true');
        const libelle = document.createElement('span');
        libelle.textContent = nom;
        point.append(disque, libelle);
        li.append(point);
        return li;
      }),
    );
    points = [...liste.querySelectorAll<HTMLButtonElement>('.trajet__point')];
    // Beaucoup de chapitres, ou des noms longs : seul le nom du chapitre actif est écrit.
    rail.toggleAttribute('data-dense', chapitres.length > 5 || destination === 'veille');
    rail.hidden = chapitres.length < 2;
    rang = -1;
    memoire = '';
    version++;
    if (destination === 'realisations') {
      const courant = (document.getElementById('realisations') as (HTMLElement & { courant?: () => number }) | null)?.courant?.() ?? galerie;
      if (courant >= 0) galerie = courant;
    }
  };

  // ---- Où en est-on ? ----
  const situer = (): { rang: number; position: number } => {
    const n = chapitres.length;
    if (!n) return { rang: 0, position: 0 };
    if (destination === 'realisations') {
      const i = Math.max(0, galerie);
      return { rang: i, position: i };
    }
    const ligne = Math.max(retraitChapitre() + 24, window.innerHeight * 0.38);
    const hauts = chapitres.map((c) => c.getBoundingClientRect().top);
    let r = 0;
    hauts.forEach((haut, i) => {
      if (haut <= ligne) r = i;
    });
    // Tout en haut de la destination : son premier chapitre, même si le suivant est déjà visible.
    if (window.scrollY < 4) return { rang: 0, position: 0 };
    // Tout en bas de la destination : le dernier chapitre, même s'il ne peut pas monter plus haut.
    const fin = document.documentElement.scrollHeight - window.innerHeight;
    if (fin > 0 && window.scrollY >= fin - 2) return { rang: n - 1, position: n - 1 };
    const p = r < n - 1 ? r + borner((ligne - hauts[r]) / Math.max(1, hauts[r + 1] - hauts[r]), 0, 1) : r;
    return { rang: r, position: p };
  };

  const afficherEtat = () => {
    if (!etat) return;
    const modele = rail.dataset.etat ?? '{destination} · {k} / {n}';
    etat.textContent = modele
      .replace('{destination}', nomDestination(destination))
      .replace('{k}', String(Math.max(0, rang) + 1).padStart(2, '0'))
      .replace('{n}', String(chapitres.length).padStart(2, '0'));
  };

  // ---- Rejoindre un chapitre ----
  const lancerFaisceau = (vers: number, duree: number) => {
    rail.style.setProperty('--sens', vers < fil.position ? '-1' : '1');
    rail.classList.add('est-en-route');
    fil.guide = true;
    gsap.to(fil, {
      position: vers,
      duration: duree,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => {
        fil.guide = false;
        rail.classList.remove('est-en-route');
      },
    });
  };

  /** Fait défiler jusqu'au chapitre i de la destination affichée. */
  const rejoindre = (i: number, options: { ouvrir?: boolean } = {}) => {
    const n = chapitres.length;
    if (!n) return;
    if (destination === 'realisations') {
      const cible = ((i % n) + n) % n;
      window.dispatchEvent(new CustomEvent('galerie-aller', { detail: cible }));
      if (window.scrollY > 4) (lenis ? lenis.scrollTo(0, { duration: 0.8 }) : window.scrollTo({ top: 0 }));
      return;
    }
    const k = borner(i, 0, n - 1);
    const chapitre = chapitres[k];
    if (options.ouvrir) {
      const details = chapitre instanceof HTMLDetailsElement ? chapitre : chapitre.querySelector('details');
      if (details && !details.open) details.open = true;
    }
    const fin = document.documentElement.scrollHeight - window.innerHeight;
    const y = k === 0 ? 0 : Math.round(borner(chapitre.getBoundingClientRect().top + window.scrollY - retraitChapitre(), 0, fin));
    const duree = mouvementReduit ? 0 : borner(Math.abs(y - window.scrollY) / 2600, 0.6, 1.2);
    if (!mouvementReduit) lancerFaisceau(k, duree);
    if (lenis) lenis.scrollTo(y, { duration: duree, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo({ top: y, behavior: 'auto' });
  };

  const pas = (sens: 1 | -1) => {
    const n = chapitres.length;
    if (n < 2) return;
    if (destination === 'realisations') return rejoindre(Math.max(0, galerie) + sens); // la galerie tourne en boucle
    rejoindre(borner(rang + sens, 0, n - 1));
  };

  allerAuChapitre = (dest, cle, options = {}) => {
    const aller = () => {
      const bloc = document.querySelector<HTMLElement>(`[data-chapitre-de="${dest}"][data-chapitre="${CSS.escape(cle)}"]`);
      // Une note de veille cachée par un filtre : on revient à « Tout » pour la montrer.
      if (bloc?.hidden) {
        document.querySelector<HTMLButtonElement>('[data-filtre="veille"] button[data-valeur=""]')?.click();
        construire();
      }
      const i = bloc ? chapitres.indexOf(bloc) : -1;
      if (i >= 0) rejoindre(i, options);
    };
    if (dest === destinationActive()) return aller();
    // On voyage d'abord ; le chapitre est rejoint une fois la destination affichée.
    const arrivee = () => window.setTimeout(aller, 120);
    window.addEventListener('destination', arrivee, { once: true });
    voyager(dest);
  };

  // ---- Les commandes ----
  liste.addEventListener('click', (e) => {
    const point = (e.target as Element).closest<HTMLButtonElement>('.trajet__point');
    if (point) rejoindre(Number(point.dataset.rang));
  });
  rail.querySelectorAll<HTMLButtonElement>('button[data-trajet]').forEach((bouton) => {
    bouton.addEventListener('click', () => pas(bouton.dataset.trajet === 'suivant' ? 1 : -1));
  });
  // Les flèches gauche et droite du clavier : le chapitre précédent ou suivant.
  // Exceptions : quand on tape ou règle quelque chose (champ, curseur, panneau ou fenêtre
  // ouverts), et dans la galerie, qui garde les flèches pour ses projets (elle marque alors
  // la touche comme « traitée »). Une visite guidée de l'Orbital Hub les prend avant nous.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable], [popover], dialog, .terminal')) return;
    if (document.querySelector('dialog[open]') || document.documentElement.classList.contains('menu-ouvert') || document.documentElement.classList.contains('intro')) return;
    e.preventDefault();
    pas(e.key === 'ArrowRight' ? 1 : -1);
  });

  // ---- Ce qui change le fil ----
  window.addEventListener('destination', () => {
    construire();
    fil.position = 0;
  });
  window.addEventListener('langue', () => {
    construire();
    afficherEtat();
  });
  window.addEventListener('galerie', (e) => {
    galerie = (e as CustomEvent<{ courant: number }>).detail.courant;
    memoire = '';
  });
  // Un filtre de la veille masque ou montre des notes : le fil suit.
  document.querySelector('[data-filtre="veille"]')?.addEventListener('click', () => window.setTimeout(() => destination === 'veille' && construire(), 60));
  ScrollTrigger.addEventListener('refresh', () => version++);
  window.addEventListener('resize', () => version++);

  // ---- À chaque image : on ne remesure que si quelque chose a bougé ----
  const scene = document.querySelector<HTMLElement>('.hero__cadre');
  const voile = document.querySelector<HTMLElement>('.methode');
  let positionAffichee = -1;
  gsap.ticker.add(() => {
    const cle = `${window.scrollY}|${window.innerHeight}|${version}|${galerie}`;
    if (cle !== memoire) {
      memoire = cle;
      const ou = situer();
      if (!fil.guide) fil.position = ou.position;
      if (ou.rang !== rang) {
        rang = ou.rang;
        points.forEach((point, i) => {
          if (i === rang) point.setAttribute('aria-current', 'step');
          else point.removeAttribute('aria-current');
        });
        afficherEtat();
      }
      // Le fil n'a pas de fond : sur la scène de l'accueil (toujours sombre), il en garde les couleurs.
      const ligne = window.innerHeight - 40;
      const surScene = destination === 'accueil' && !!scene && scene.getBoundingClientRect().bottom > ligne && (!voile || voile.getBoundingClientRect().top > ligne);
      rail.classList.toggle('toujours-sombre', surScene);
    }
    if (Math.abs(fil.position - positionAffichee) > 0.002) {
      positionAffichee = fil.position;
      const n = chapitres.length;
      const avance = n > 1 ? borner(fil.position / (n - 1), 0, 1).toFixed(4) : '1';
      rail.style.setProperty('--avance', avance);
      if (progression) progression.style.transform = `scaleX(${avance})`;
      points.forEach((point, i) => point.classList.toggle('est-passe', i <= fil.position + 0.02));
    }
  });

  construire();
}
