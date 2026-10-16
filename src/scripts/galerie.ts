// LA GALERIE DES RÉALISATIONS
//
// Elle tourne toute seule, vite et sans à-coup : les réalisations passent
// l'une contre l'autre, toutes en un peu moins de neuf secondes, et en boucle.
// Elle ne retient jamais le visiteur : la section n'est pas épinglée, la
// molette n'est pas détournée, le défilement vertical reste entièrement libre.
//
// Ce qui la ralentit ou l'arrête :
//   - le curseur sur une réalisation ou sur les commandes : elle ralentit en douceur, sans s'arrêter ;
//   - le clic gauche maintenu sur l'anneau : elle s'arrête (on peut alors la faire tourner à la main),
//     et repart dès qu'on relâche ;
//   - un choix manuel (flèches, clic sur une carte de côté, doigt posé) : elle attend quelques secondes ;
//   - la navigation au clavier dans la galerie ;
//   - une fenêtre ouverte par-dessus ;
//   - la galerie hors de l'écran, ou l'onglet masqué ;
//   - le bouton « pause », jusqu'à ce qu'on le relâche.
//
// La réalisation « active » est celle qui est la plus en avant de l'anneau, face
// au visiteur : c'est son numéro qu'affiche le compteur (« 02 / 06 »), à chaque
// instant, même pendant la rotation. Un clic bref sur une carte de face ouvre sa fiche.
//
// Sur ordinateur (« anneau ») : les cartes sont posées sur un cylindre. Pour
// chaque carte, on calcule un angle à partir de sa distance à la carte centrale :
//     x = sin(angle) × rayon        → elle s'écarte sur le côté
//     z = (cos(angle) − 1) × rayon  → elle recule
//     rotation = angle              → elle se tourne vers l'extérieur
// On peut glisser les cartes, cliquer une carte de côté pour l'amener au
// centre, ou utiliser les flèches (celles de l'écran, et celles du clavier
// quand le focus est dans la galerie).
//
// Sur téléphone, ou si le mouvement est réduit (« ruban ») : une liste
// horizontale que l'on fait glisser au doigt. Elle glisse seule elle aussi,
// d'un bout à l'autre puis en sens inverse, sauf en mouvement réduit.
//
// Dans les deux cas, les cartes entrent « en balayage » quand la galerie
// arrive à l'écran : elles viennent de la droite, l'une derrière l'autre.

import gsap from 'gsap';
import { creerCompteur } from './compteur';
import { vitesse } from './defilement';
import { borner, mouvementReduit } from './outils';

const PAS = 0.36; //         angle entre deux cartes voisines, en radians (≈ 21°) : elles sont presque collées
const ALLURE = 0.68; //      vitesse de la rotation, en réalisations par seconde : les six passent en un peu moins de neuf secondes
const AU_SURVOL = 0.4; //    part de cette vitesse gardée quand le curseur est sur l'anneau : elle ralentit, sans s'arrêter
const APPUI_LONG = 0.3; //   secondes : un appui plus long sert à retenir l'anneau, pas à ouvrir une fiche
const APRES_GESTE = 3; //    secondes de répit après un choix manuel

export function initGalerie(): void {
  const section = document.querySelector<HTMLElement>('.galerie');
  if (!section) return;

  const scene = section.querySelector<HTMLElement>('.galerie__scene')!;
  const piste = section.querySelector<HTMLElement>('.galerie__piste')!;
  const compteur = section.querySelector<HTMLElement>('[data-courant]')!;
  const barre = section.querySelector<HTMLElement>('.galerie__progression span')!;
  const fleches = [...section.querySelectorAll<HTMLButtonElement>('[data-galerie]')];
  const boutonPause = section.querySelector<HTMLButtonElement>('[data-galerie-pause]');
  const cartes = [...piste.querySelectorAll<HTMLElement>('.carte')].map((carte) => ({
    carte,
    lien: carte.querySelector<HTMLAnchorElement>('.carte__lien')!,
    corps: carte.querySelector<HTMLElement>('.carte__corps')!,
    cadre: carte.querySelector<HTMLElement>('.carte__image')!,
    image: carte.querySelector<HTMLElement>('.carte__image img, .carte__dessin'),
    texte: carte.querySelector<HTMLElement>('.carte__texte')!,
  }));
  const n = cartes.length;
  if (n < 2) return;

  let courant = -1; // la réalisation active : la plus en avant de l'anneau
  let quandChange: ((ancienne: number) => void) | null = null;
  const rouler = creerCompteur(compteur);
  /** Désigne la réalisation active : son numéro s'écrit dans le compteur, elle devient cliquable. */
  const afficherCourant = (i: number, sens = i > courant ? 1 : -1) => {
    if (i === courant) return;
    if (courant >= 0) quandChange?.(courant);
    courant = i;
    cartes.forEach((c, k) => c.carte.classList.toggle('est-centre', k === i));
    rouler(String(i + 1).padStart(2, '0'), sens);
  };

  // ==========================================================================
  // LA ROTATION AUTOMATIQUE : ce qui l'autorise, commun aux deux présentations
  // ==========================================================================
  const auto = {
    enPause: false, // le visiteur a appuyé sur « pause »
    survol: false, //  le curseur est sur une réalisation ou sur les commandes : elle ralentit
    clavier: false, // le focus du clavier est dans la galerie
    visible: false, // la galerie est à l'écran
    repit: 0, //       instant (performance.now) avant lequel elle ne repart pas
  };
  const peutTourner = () => !auto.enPause && !auto.clavier && auto.visible && !document.hidden && performance.now() > auto.repit;
  /** Après un choix du visiteur : la rotation attend un moment. */
  const laisserLire = (secondes = APRES_GESTE) => {
    auto.repit = Math.max(auto.repit, performance.now() + secondes * 1000);
  };
  const observateur = new IntersectionObserver(([entree]) => (auto.visible = entree.isIntersecting), { threshold: 0.35 });
  observateur.observe(scene);
  const pied = section.querySelector<HTMLElement>('.galerie__pied');
  const quitter = () => (auto.survol = false); // elle retrouve sa vitesse, progressivement
  // Le curseur est-il sur une carte, ou sur les commandes ? (Pas toute la section :
  // elle occupe l'écran entier, le curseur y serait toujours.)
  scene.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    if ((e.target as Element).closest('.carte, .galerie__pied')) auto.survol = true;
    else quitter();
  });
  scene.addEventListener('pointerleave', quitter);
  pied?.addEventListener('pointerleave', quitter);
  section.addEventListener('focusin', (e) => (auto.clavier = (e.target as Element).matches?.(':focus-visible') ?? false));
  section.addEventListener('focusout', (e) => {
    if (!section.contains(e.relatedTarget as Node | null)) auto.clavier = false;
  });
  boutonPause?.addEventListener('click', () => {
    auto.enPause = !auto.enPause;
    boutonPause.setAttribute('aria-pressed', String(auto.enPause));
  });

  const media = gsap.matchMedia();

  // ==========================================================================
  // ANNEAU
  // ==========================================================================
  media.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
    section.classList.add('galerie--anneau');

    // La position n'est pas bornée : elle augmente d'une unité par carte, sans fin.
    // Chaque carte se place d'après sa distance « en rond » à cette position.
    let cible = 0; //    position voulue
    let position = 0; // position affichée : elle rattrape la cible avec de l'inertie
    let elan = 0; //     vitesse de défilement de la page, lissée, de −1 à 1
    let rayon = 1;
    let allure = 0; //   vitesse de la rotation en ce moment, en cartes par seconde
    let cale = true; //  la galerie est-elle arrêtée sur une carte ?
    let battement = 0;
    let fenetreOuverte = false;
    let aLaMain = false; // la dernière impulsion vient-elle du visiteur (glissement) plutôt que de la rotation ?

    const mesurer = () => {
      rayon = (cartes[0].carte.offsetWidth * 1.02) / Math.sin(PAS);
    };
    mesurer();
    window.addEventListener('resize', mesurer);

    /** La distance « en rond » : entre −n/2 et n/2. */
    const enRond = (d: number) => ((((d + n / 2) % n) + n) % n) - n / 2;
    /** Amène la carte i au centre, par le plus court chemin. */
    const allerCarte = (i: number) => {
      const ici = Math.round(cible);
      cible = ici + Math.round(enRond(i - ici));
      prendreLaMain();
    };
    /** Le visiteur choisit : la rotation lâche aussitôt son élan, qui sinon pousserait d'une carte de plus. */
    const prendreLaMain = () => {
      allure = 0;
      aLaMain = true;
    };
    /** Une carte plus loin ou plus près. Pendant la rotation, on part de la carte affichée
        (la position voulue a toujours un peu d'avance sur elle) ; après un premier pas, du pas voulu,
        pour que plusieurs clics rapides s'additionnent. */
    const decaler = (sens: number) => {
      const base = Math.abs(cible - Math.round(cible)) < 0.001 ? cible : Math.round(position);
      cible = base + sens;
      prendreLaMain();
    };

    // ---- Entrée en balayage ----
    // « balayage » vaut 1 tant que la galerie n'est pas arrivée à l'écran, puis
    // retombe à 0. Tant qu'il n'est pas nul, chaque carte est repoussée plus
    // loin sur l'anneau, et d'autant plus qu'elle est loin dans la liste :
    // elles arrivent donc de la droite en éventail, la première en tête.
    const entree = { balayage: 1 };
    gsap.to(entree, {
      balayage: 0,
      duration: 1.9,
      ease: 'expo.out',
      scrollTrigger: { trigger: section, start: 'top 60%', once: true },
    });

    // ---- Une image ----
    const image = (_temps: number, delta = 16.7) => {
      // La rotation vise son allure de croisière quand rien ne la retient, une allure
      // réduite sous le curseur, et zéro sous le clic maintenu ou quand elle doit attendre.
      // La vitesse réelle rattrape cette cible en douceur : elle ralentit et repart sans
      // à-coup. À l'arrêt complet, elle se cale sur la carte la plus proche.
      const dt = Math.min(delta, 100) / 1000;
      // (Une fenêtre ouverte par-dessus, constellation ou mini-jeu : on attend. Vérifié trois fois par seconde.)
      if (++battement % 20 === 0) fenetreOuverte = !!document.querySelector('dialog[open]');
      const voulue = saisie || fenetreOuverte || !peutTourner() ? 0 : auto.survol ? ALLURE * AU_SURVOL : ALLURE;
      allure += (voulue - allure) * (voulue > allure ? 0.035 : saisie ? 0.3 : 0.07);
      if (saisie) {
        if (aGlisse) cale = false; // c'est la main du visiteur qui mène
      } else if (voulue > 0 || allure > 0.05) {
        cible += allure * dt;
        cale = false;
        if (voulue > 0) aLaMain = false;
      } else if (!cale) {
        cible = Math.round(cible + (aLaMain ? 0 : 0.25)); // (après la rotation, un peu vers l'avant : elle finit son geste)
        cale = true;
      }
      if (!auto.visible && Math.abs(cible - position) < 0.001) return; // hors de l'écran et à l'arrêt : rien à dessiner

      position += (cible - position) * 0.12;
      if (Math.abs(cible - position) < 0.0005) position = cible; // (arrivée : plus aucune dérive)
      elan += (borner(vitesse() / 48, -1, 1) - elan) * 0.09;
      const arrivee = borner(1 - entree.balayage * 1.25, 0, 1); // opacité pendant l'entrée

      for (let i = 0; i < n; i++) {
        const c = cartes[i];
        const rond = enRond(i - position);
        const d = rond + entree.balayage * (1.5 + i * 0.85);
        const ecart = Math.abs(d);
        if (ecart > 3.1) {
          c.carte.style.visibility = 'hidden';
          continue;
        }
        const angle = d * PAS + elan * 0.12;
        const x = Math.sin(angle) * rayon;
        const z = (Math.cos(angle) - 1) * rayon;
        const net = borner(1 - ecart, 0, 1); // 1 au centre, 0 à une carte de distance
        // Une carte qui passe d'un bout de l'anneau à l'autre le fait sans être vue.
        const auBout = borner((n / 2 - Math.abs(rond)) / 0.6, 0, 1);

        c.carte.style.visibility = 'visible';
        c.carte.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${(angle * 52 + elan * 8).toFixed(2)}deg)`;
        c.carte.style.opacity = (borner(1.3 - ecart * 0.5, 0, 1) * arrivee * auBout).toFixed(3);
        c.carte.style.zIndex = String(50 - Math.round(ecart * 10));

        // Parallaxe : l'image et le texte ne glissent pas à la même vitesse que la carte.
        // --net dit au CSS à quel point ternir l'image (voir galerie.css).
        if (c.image) c.image.style.transform = `translate3d(${(d * -6).toFixed(2)}%,0,0) scale(1.14)`;
        c.carte.style.setProperty('--net', net.toFixed(3));
        c.texte.style.transform = `translate3d(${(d * 42).toFixed(1)}px,0,0)`;
        c.texte.style.opacity = (0.25 + net * 0.75).toFixed(3);
      }

      // Le défilement de la page penche légèrement les cartes : la galerie accompagne le mouvement, sans le retenir.
      piste.style.transform = `skewX(${(elan * -2.6).toFixed(2)}deg)`;
      // La barre : de la première carte à la dernière, puis elle se vide pendant le retour à la première.
      const tour = ((position % n) + n) % n;
      barre.style.transform = `scaleX(${borner(tour <= n - 1 ? tour / (n - 1) : n - tour, 0, 1).toFixed(4)})`;
      afficherCourant(((Math.round(position) % n) + n) % n, cible >= position ? 1 : -1);
    };
    gsap.ticker.add(image);

    // ---- Retenir et glisser, à la souris ou au doigt ----
    // Appuyer arrête l'anneau ; glisser le fait tourner à la main ; relâcher le laisse
    // repartir. Un clic bref sur une carte de face ouvre sa fiche ; un clic bref sur une
    // carte de côté l'amène face au visiteur, et l'anneau attend un moment.
    let saisie = false;
    let aGlisse = false;
    let tenu = false; // l'appui a-t-il duré assez pour retenir l'anneau ?
    let relais = false; // le clic que l'on transmet soi-même au lien d'une carte
    let debutAppui = 0;
    let departX = 0;
    let departCible = 0;
    const appui = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      saisie = true;
      aGlisse = false;
      tenu = false;
      debutAppui = performance.now();
      cible = position + (cible - position) * 0.4; // l'anneau s'arrête presque aussitôt sous la main
      departX = e.clientX;
      departCible = cible;
    };
    const mouvement = (e: PointerEvent) => {
      if (!saisie) return;
      const dx = e.clientX - departX;
      if (Math.abs(dx) > 6 && !aGlisse) {
        aGlisse = true;
        aLaMain = true;
        piste.classList.add('est-saisie');
      }
      if (aGlisse) cible = departCible - dx / (cartes[0].carte.offsetWidth * 0.9);
    };
    const relache = (e: PointerEvent) => {
      if (!saisie) return;
      saisie = false;
      tenu = performance.now() - debutAppui > APPUI_LONG * 1000;
      piste.classList.remove('est-saisie');
      // Au doigt, il n'y a pas de survol pour la ralentir : elle attend un moment.
      if (e.pointerType !== 'mouse') laisserLire();
      // (Le clic qui suit le relâchement lit encore ces deux indications ; on les efface juste après.)
      setTimeout(() => {
        aGlisse = false;
        tenu = false;
      }, 0);
    };
    const clic = (e: MouseEvent) => {
      if (relais) return;
      // Glissé ou retenu : ce n'était pas un clic pour ouvrir. (detail vaut 0 pour la touche Entrée.)
      const retenu = e.detail > 0 && (aGlisse || tenu);
      const rang = cartes.findIndex((c) => c.carte.contains(e.target as Node));
      if (rang < 0) return;
      const c = cartes[rang];
      // De face : la carte active, ou celle qui le devient à l'instant du clic (l'anneau tourne).
      const deFace = c.carte.classList.contains('est-centre') || Math.abs(enRond(rang - position)) < 0.8;
      if (!retenu && deFace) {
        if (c.lien.contains(e.target as Node)) return; // le lien s'ouvre de lui-même
        if ((e.target as Element).closest('[data-jouer-rush]')) return; // « Jouer » : le jeu s'ouvre (voir rush.ts)
        e.preventDefault();
        e.stopPropagation();
        relais = true;
        c.lien.click();
        relais = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!retenu) {
        allerCarte(rang);
        laisserLire();
      }
    };
    const pasDeDrag = (e: Event) => e.preventDefault();
    piste.addEventListener('pointerdown', appui);
    window.addEventListener('pointermove', mouvement);
    window.addEventListener('pointerup', relache);
    window.addEventListener('pointercancel', relache);
    piste.addEventListener('click', clic, true);
    piste.addEventListener('dragstart', pasDeDrag);

    // ---- Clavier : flèches gauche et droite, quand le focus est dans la galerie ----
    // (Ailleurs, ces flèches changent de section : voir voyage.ts.)
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (!section.contains(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      decaler(e.key === 'ArrowRight' ? 1 : -1);
      laisserLire();
    };
    window.addEventListener('keydown', touche);

    // ---- Flèches précédent / suivant ----
    const fleche = (e: Event) => {
      decaler(Number((e.currentTarget as HTMLElement).dataset.galerie));
      laisserLire();
    };
    fleches.forEach((b) => b.addEventListener('click', fleche));

    // ---- Survol de la carte centrale : inclinaison, reflet, séparation des couleurs ----
    const rouge = document.querySelector('#spectre [data-canal="rouge"]');
    const bleu = document.querySelector('#spectre [data-canal="bleu"]');
    const nettoyages: (() => void)[] = [];
    // Quand une carte cesse d'être active sous le curseur immobile, son survol s'efface.
    const sorties: (() => void)[] = [];
    quandChange = (ancienne) => sorties[ancienne]?.();

    cartes.forEach((c, i) => {
      const bouge = (e: PointerEvent) => {
        if (!c.carte.classList.contains('est-centre') || aGlisse) return;
        const r = c.cadre.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        c.corps.style.setProperty('--ry', `${((px - 0.5) * 7).toFixed(2)}deg`);
        c.corps.style.setProperty('--rx', `${((0.5 - py) * 5).toFixed(2)}deg`);
        c.corps.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        c.corps.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      };
      const entre = () => {
        if (!c.carte.classList.contains('est-centre')) return;
        c.carte.classList.add('est-survolee');
        // (La séparation des couleurs seulement à l'arrêt : sur une carte en mouvement, elle coûterait cher.)
        if (c.image && c.image.tagName === 'IMG' && cale) {
          c.image.style.filter = 'url(#spectre)';
          gsap.fromTo(rouge, { attr: { dx: -11 } }, { attr: { dx: -1.5 }, duration: 0.8, ease: 'expo.out', overwrite: true });
          gsap.fromTo(bleu, { attr: { dx: 11 } }, { attr: { dx: 1.5 }, duration: 0.8, ease: 'expo.out', overwrite: true });
        }
      };
      const sort = () => {
        c.carte.classList.remove('est-survolee');
        if (c.image) c.image.style.filter = ''; // rend la main au CSS
        c.corps.style.setProperty('--ry', '0deg');
        c.corps.style.setProperty('--rx', '0deg');
      };
      // Au clavier (touche Tab), la carte atteinte vient au centre.
      const focus = () => {
        if (c.lien.matches(':focus-visible')) allerCarte(i);
      };
      c.lien.addEventListener('pointermove', bouge);
      c.lien.addEventListener('pointerenter', entre);
      c.lien.addEventListener('pointerleave', sort);
      c.lien.addEventListener('focus', focus);
      sorties[i] = sort;
      nettoyages.push(() => {
        c.lien.removeEventListener('pointermove', bouge);
        c.lien.removeEventListener('pointerenter', entre);
        c.lien.removeEventListener('pointerleave', sort);
        c.lien.removeEventListener('focus', focus);
      });
    });

    // Quand l'écran repasse sous 861 px, on défait tout pour revenir au ruban.
    return () => {
      gsap.ticker.remove(image);
      quandChange = null;
      window.removeEventListener('resize', mesurer);
      piste.removeEventListener('pointerdown', appui);
      window.removeEventListener('pointermove', mouvement);
      window.removeEventListener('pointerup', relache);
      window.removeEventListener('pointercancel', relache);
      piste.removeEventListener('click', clic, true);
      piste.removeEventListener('dragstart', pasDeDrag);
      window.removeEventListener('keydown', touche);
      fleches.forEach((b) => b.removeEventListener('click', fleche));
      nettoyages.forEach((fn) => fn());
      section.classList.remove('galerie--anneau');
      [piste, barre].forEach((el) => el.removeAttribute('style'));
      cartes.forEach((c) => [c.carte, c.texte, c.image, c.corps].forEach((el) => el?.removeAttribute('style')));
      courant = -1;
    };
  });

  // ==========================================================================
  // RUBAN
  // ==========================================================================
  media.add('(max-width: 860px), (prefers-reduced-motion: reduce)', () => {
    let attente = 0;

    const actualiser = () => {
      const centre = piste.scrollLeft + piste.clientWidth / 2;
      let proche = 0;
      let min = Infinity;
      cartes.forEach((c, i) => {
        const d = (c.carte.offsetLeft + c.carte.offsetWidth / 2 - centre) / c.carte.offsetWidth;
        const ecart = Math.abs(d);
        if (ecart < min) {
          min = ecart;
          proche = i;
        }
        if (!mouvementReduit && c.image) {
          c.image.style.transform = `translate3d(${(d * -5).toFixed(2)}%,0,0) scale(1.12)`;
          c.carte.style.setProperty('--net', borner(1 - ecart, 0, 1).toFixed(3));
        }
      });
      const max = piste.scrollWidth - piste.clientWidth;
      barre.style.transform = `scaleX(${max > 0 ? (piste.scrollLeft / max).toFixed(4) : 0})`;
      afficherCourant(proche);
    };
    const defile = () => {
      cancelAnimationFrame(attente);
      attente = requestAnimationFrame(actualiser);
    };
    /** Fait glisser le ruban jusqu'à la carte i. (Seul le ruban bouge : la page ne défile pas.) */
    const montrer = (i: number) => {
      const carte = cartes[((i % n) + n) % n].carte;
      piste.scrollTo({ left: carte.offsetLeft - (piste.clientWidth - carte.offsetWidth) / 2, behavior: mouvementReduit ? 'auto' : 'smooth' });
    };

    const fleche = (e: Event) => {
      montrer(courant + Number((e.currentTarget as HTMLElement).dataset.galerie));
      laisserLire();
    };
    fleches.forEach((b) => b.addEventListener('click', fleche));

    // Un doigt posé sur le ruban : le visiteur regarde ou fait glisser, le ruban attend.
    const touche = () => laisserLire();
    piste.addEventListener('pointerdown', touche, { passive: true });
    piste.addEventListener('wheel', touche, { passive: true });

    // Le défilé automatique (pas en mouvement réduit) : le ruban glisse en continu,
    // d'un bout à l'autre, puis dans l'autre sens. Tant qu'il glisse seul,
    // l'aimantation des cartes est levée (elle saccaderait le mouvement) ; elle
    // revient dès qu'on le touche.
    let avant = performance.now();
    let direction = 1;
    let glisse = 0; // vitesse en cours, en pixels par seconde
    const battre = () => {
      const maintenant = performance.now();
      const dt = Math.min(0.1, (maintenant - avant) / 1000);
      avant = maintenant;
      const voulue = peutTourner() ? cartes[0].carte.offsetWidth * 1.4 * (auto.survol ? AU_SURVOL : 1) : 0;
      glisse += (voulue - glisse) * (voulue > glisse ? 0.05 : 0.14);
      if (glisse < 6) {
        if (piste.style.scrollSnapType) piste.style.scrollSnapType = '';
        return;
      }
      piste.style.scrollSnapType = 'none';
      const max = piste.scrollWidth - piste.clientWidth;
      if (piste.scrollLeft >= max - 1) direction = -1;
      else if (piste.scrollLeft <= 1) direction = 1;
      piste.scrollLeft += direction * glisse * dt;
    };
    if (!mouvementReduit) gsap.ticker.add(battre);

    piste.addEventListener('scroll', defile, { passive: true });
    window.addEventListener('resize', defile);
    actualiser();

    // Entrée en balayage : les cartes glissent depuis la droite, l'une après
    // l'autre. (gsap.matchMedia défait cette animation tout seul si l'écran
    // repasse en grand format.)
    if (!mouvementReduit) {
      gsap.from(
        cartes.map((c) => c.carte),
        {
          x: 120,
          autoAlpha: 0,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.1,
          scrollTrigger: { trigger: piste, start: 'top 82%', once: true },
        },
      );
    }

    return () => {
      gsap.ticker.remove(battre);
      piste.style.scrollSnapType = '';
      fleches.forEach((b) => b.removeEventListener('click', fleche));
      piste.removeEventListener('pointerdown', touche);
      piste.removeEventListener('wheel', touche);
      piste.removeEventListener('scroll', defile);
      window.removeEventListener('resize', defile);
      barre.removeAttribute('style');
      cartes.forEach((c) => {
        c.image?.removeAttribute('style');
        c.carte.style.removeProperty('--net');
      });
      courant = -1;
    };
  });
}
