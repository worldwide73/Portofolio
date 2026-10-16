// La forme du contenu. Les fichiers fr.ts et en.ts doivent tous les deux
// la respecter : si un texte manque dans une langue, l'éditeur le signale.
//
// Convention : un texte qui commence par un crochet, par exemple
// « [À COMPLÉTER : … ] », est une information que seul Mathéo peut donner.
// Le site l'affiche en gris, discrètement, au lieu d'inventer.

export type Langue = 'fr' | 'en';

/** Identifiants des 5 sections. Ils servent d'ancres (#accueil, #contact…). */
export type IdSection = 'accueil' | 'competences' | 'realisations' | 'veille' | 'contact';

/** Ce que l'Orbit Assistant sait reconnaître dans une question (voir src/scripts/hub.ts). */
export type Intention =
  | 'qui'
  | 'parcours'
  | 'dispo'
  | 'salut'
  | 'merci'
  | 'aide'
  | 'cv'
  | 'projets'
  | 'competences'
  | 'veille'
  | 'contact'
  | 'reglages'
  | 'jeu'
  | 'commandes'
  | 'carte'
  | 'langue'
  | 'visite'
  | 'coulisses';

export interface Projet {
  /** Identifiant dans l'adresse de la page : /realisations/<slug>/ */
  slug: string;
  nom: string;
  /** Nom court, pour les endroits étroits (colonnes du tableau, filtres). */
  court: string;
  annee: string;
  genre: string;
  /** « En une phrase » : ce que c'est. */
  phrase: string;
  /** Les rubriques de la fiche, dans l'ordre où elles s'affichent. */
  contexte: string;
  objectifs: string;
  realisation: string;
  difficultes: string;
  resultat: string;
  retiens: string;
  stack: string[];
  lien?: { href: string; texte: string };
  /** Description de la capture pour les lecteurs d'écran. */
  alt: string;
  /** Une création personnelle hors du référentiel : absente du tableau BTS SIO et des filtres de compétences. */
  horsReferentiel?: boolean;
  /** Un jeu jouable sur le site : bouton « Jouer » sur sa carte et sur sa fiche. */
  jouable?: boolean;
}

/** Une compétence et les réalisations (slugs) qui la prouvent. */
export interface Competence {
  nom: string;
  projets: string[];
}

export interface Contenu {
  langue: Langue;
  meta: {
    titre: string;
    description: string;
    /** Description de l'image de partage (réseaux sociaux, messageries). */
    partageAlt: string;
    /** Intitulé du métier dans les données lues par les moteurs de recherche. */
    metier: string;
  };
  interface: {
    evitement: string;
    navigation: string;
    lieuHorloge: string;
    cv: string;
    curseur: { ouvrir: string; glisser: string; copier: string; voir: string; retour: string };
    menu: string;
    fermer: string;
    /** Texte lu par les lecteurs d'écran sur le bouton drapeau. */
    changerLangue: string;
    /** Titre de l'onglet quand le visiteur regarde un autre onglet. */
    ongletAbsent: string;
    precedent: string;
    suivant: string;
    retour: string;
    /** Texte de la couverture du projet « Ce portfolio ». */
    ici: string;
  };
  /** L'accès rapide : le petit menu ouvert par le chevron du bloc d'identité, en haut à gauche. */
  /** Le panneau d'actions rapides, sous le nom (en haut à gauche). Les raccourcis sont ceux qui existent dans le code. */
  acces: {
    titre: string;
    linkedin: string;
    github: string;
    cv: string;
    /** Le petit bouton qui télécharge le CV, à côté de « Mon CV » (qui l'ouvre). */
    telecharger: string;
    partager: string;
    copie: string;
    copieManuelle: string;
    contact: string;
    copierEmail: string;
    emailCopie: string;
    ecrire: string;
    raccourcis: string;
    fermer: string;
    groupes: { nom: string; lignes: [string[], string][] }[];
  };
  /** L'introduction jouée à l'arrivée sur l'accueil : trois lignes, écrites en capitales par le CSS. */
  initialisation: { nom: string; metier: string; etat: string; passer: string };
  /** La constellation : l'autre vue des réalisations, ouverte depuis la galerie. */
  constellation: { ouvrir: string; titre: string; aide: string; objectif: string; competences: string; fiche: string; tous: string; connexes: string };
  /** L'Orbital Hub : le panneau ouvert par l'icône flottante en bas à droite (voir OrbitalHub.astro).
      Il s'ouvre sur l'assistant ; un rang d'onglets mène au jeu, à la visite guidée et aux coulisses. */
  hub: {
    ouvrir: string;
    titre: string;
    sousTitre: string;
    fermer: string;
    retour: string;
    entrees: Record<'rush' | 'explorer' | 'coulisses' | 'assistant', { nom: string; texte: string }>;
    /** Explore My Universe : des visites guidées courtes. « {k} » et « {n} » : l'étape et le nombre d'étapes. */
    explorer: {
      texte: string;
      parcours: Record<'rapide' | 'projets' | 'competences' | 'libre', { nom: string; texte: string; etapes: { section: IdSection; titre: string; texte: string; action?: 'portfolio' | 'constellation' | 'tableau' | 'cv' }[] }>;
      etape: string;
      precedent: string;
      suivant: string;
      terminer: string;
      quitter: string;
      /** Sur une fiche projet, les visites partent de l'accueil. */
      depuisAccueil: string;
    };
    /** Behind the Build : ce qui fait vraiment tourner le site. */
    coulisses: { texte: string; groupes: { nom: string; points: string[] }[]; fiche: string };
    /** Orbit Assistant : une aide locale (sans IA en ligne), au clavier ou au micro, qui peut lire ses réponses à voix haute. */
    assistant: {
      note: string;
      accueil: string;
      invite: string;
      envoyer: string;
      micro: string;
      microArret: string;
      ecoute: string;
      microRefuse: string;
      voix: string;
      /** Les phrases composées avec le contenu réel : « {nom} », « {liste} »… sont remplacés. */
      modeles: { projet: string; stack: string; techno: string; competence: string; plusieurs: string; parcours: string; domaines: string; veille: string; fiche: string; site: string };
      sujets: Record<'cv' | 'projets' | 'competences' | 'contact' | 'reglages' | 'jeu' | 'commandes', string>;
      incompris: string;
      reponses: Record<Intention, { texte: string; action: string }>;
    };
  };
  /** Portal Rush : le jeu de course à trois voies (voir src/scripts/rush/). Les noms des niveaux et des difficultés restent en anglais. */
  rush: {
    titre: string;
    surtitre: string;
    accroche: string;
    /** La barre du haut : la touche Échap (son effet selon l'écran), l'état du système, les icônes, les langues. */
    barre: { echap: { quitter: string; retour: string; fermer: string; pause: string; reprendre: string; menu: string; passer: string }; systeme: string; principal: string; course: string; langue: string; langues: { fr: string; en: string }; entree: string; espace: string };
    menu: { commencer: string; continuer: string; campagne: string; infini: string; defi: string; records: string; garage: string; reglages: string; quitter: string; retour: string; lancer: string; commandes: string };
    /** Sous chaque entrée du menu. « {n} » : le secteur, « {d} » : la difficulté. */
    descriptions: { commencer: string; continuer: string; campagne: string; infini: string; defi: string; records: string; garage: string; reglages: string; quitter: string };
    stats: { meilleur: string; campagne: string; etoiles: string; pieces: string; defis: string; derniere: string; bienvenue: string };
    /** Les trois étoiles d'un secteur. « {v} » : le score cible ; « {n} » : un secteur ; « {p} » : une pièce. */
    etoiles: { titre: string; une: string; deux: string; nouvelle: string; aGagner: string; recompenses: string; debloque: string; piece: string; cauchemar: string; aucune: string; resume: string };
    difficulte: string;
    difficultes: Record<'pilote' | 'as' | 'expert' | 'cauchemar', { nom: string; role: string; texte: string }>;
    verrouCauchemar: string;
    secteur: string;
    niveaux: { nom: string; mecanique: string }[];
    /** « {v} » : la valeur à atteindre. */
    objectifs: Record<'fin' | 'fragments' | 'parfaits' | 'portails' | 'boss' | 'score' | 'combo' | 'chocsMax' | 'aucunChoc', string>;
    etats: { disponible: string; termine: string; verrouille: string };
    verrou: string;
    meilleur: string;
    aucunRecord: string;
    hud: { score: string; record: string; combo: string; boucliers: string; fragments: string; overdrive: string; charges: string; pause: string; boss: string; touche: string; toucheTactile: string };
    phases: Record<'calibrage' | 'acceleration' | 'pression' | 'finale' | 'assaut' | 'tempete' | 'effondrement', string>;
    annonces: { depart: string; parfait: string; overdrive: string; pret: string; choc: string; dernier: string; portail: string; phase: string; comboPerdu: string; motif: string; record: string };
    conseils: { clavier: string[]; tactile: string[] };
    pause: { titre: string; sousTitre: string; reprendre: string; recommencer: string; confirmer: string; reglages: string; menu: string; confirmerMenu: string; quitter: string; confirmerQuitter: string };
    fin: {
      titre: string;
      titreInfini: string;
      titreDefi: string;
      objectifManque: string;
      score: string;
      record: string;
      nouveau: string;
      ecart: string;
      distance: string;
      progression: string;
      rang: string;
      combo: string;
      parfaits: string;
      fragments: string;
      temps: string;
      objectifs: string;
      progres: string;
      rejouer: string;
      autreDifficulte: string;
      menu: string;
    };
    victoire: { titre: string; recompenses: string; aucune: string; meilleurNiveau: string; suivant: string; rejouer: string; menu: string; cauchemar: string; secteurDebloque: string };
    defi: { titre: string; objectif: string; parcours: string; regles: string; score: string; meilleur: string; derniere: string; aucune: string; lancer: string; tentatives: string };
    infini: { titre: string; texte: string; lancer: string };
    records: {
      titre: string;
      sousTitre: string;
      onglets: { resume: string; campagne: string; infini: string; defi: string };
      cartes: { infini: string; distance: string; combo: string; parfaits: string; etoiles: string; defi: string };
      vide: { titre: string; texte: string; action: string };
      campagne: string;
      infini: string;
      defi: string;
      niveau: string;
      aucun: string;
      regles: string;
      aujourdhui: string;
      score: string;
      distance: string;
      tentatives: string;
    };
    garage: {
      titre: string;
      texte: string;
      emplacements: Record<'coque' | 'trainee' | 'overdrive' | 'noyau', string>;
      pieces: Record<string, string>;
      conditions: { depart: string; niveau: string; rang: string; difficulte: string; infini: string; overdrives: string; parfaits: string; defis: string; multiplicateur: string };
      equipe: string;
      verrouille: string;
      progres: string;
    };
    reglages: {
      titre: string;
      effets: string;
      musique: string;
      volumeMusique: string;
      partage: string;
      effetsReduits: string;
      effetsReduitsTexte: string;
      secousses: string;
      aide: string;
      tactile: string;
      toucher: string;
      glisser: string;
      onglets: { audio: string; affichage: string; commandes: string };
      sons: string;
      sonsTexte: string;
      animations: string;
      animationsTexte: string;
      animationsChoix: { complet: string; allege: string; coupe: string };
      fermer: string;
    };
    commandes: { titre: string; lignes: string[] };
  };
  /** Le panneau des réglages (icône à droite de la barre). */
  reglages: {
    titre: string;
    /** Les deux pages du panneau. */
    onglets: { affichage: string; atmosphere: string };
    opacite: string;
    flou: string;
    lueur: string;
    animations: string;
    niveaux: { complet: string; allege: string; coupe: string };
    sons: string;
    musique: string;
    volume: string;
  };
  /** La page « Atmosphère » du panneau : quatre ambiances facultatives, et le lecteur de musique. */
  atmosphere: {
    titre: string;
    /** Affiché tant qu'aucune ambiance n'est choisie. */
    aide: string;
    modes: Record<'chill' | 'espace' | 'focus' | 'silence', { nom: string; texte: string }>;
    pistes: Record<'derive' | 'heure-bleue' | 'trait', { titre: string; texte: string }>;
    lire: string;
    pause: string;
    /** Dit d'où vient la musique : elle est fabriquée par le code, sans fichier audio. */
    genere: string;
    silence: string;
    /** La case « son dès l'ouverture du site », et ce qu'elle fait. */
    lancement: string;
    lancementTexte: string;
  };
  sections: Record<IdSection, string>;
  /** Le fil des chapitres, en bas de l'écran, et le portail qui ouvre la carte. */
  trajet: {
    titre: string;
    precedent: string;
    suivant: string;
    /** Le libellé du portail pour le clavier et les lecteurs d'écran (rien n'est écrit sur la lame) : ce qu'il fait, puis le geste avancé. */
    portail: string;
    portailAide: string;
    /** La courte indication affichée sous le portail (le CSS la met en capitales et ajoute la flèche). */
    invite: string;
  };
  /**
   * La navigation par destinations (16 octobre 2026) : chaque section est une destination
   * indépendante ; on voyage de l'une à l'autre par le portail. La barre du haut porte trois
   * outils (Portail, Rechercher, Visite rapide), le fil du bas les chapitres de la destination.
   */
  navigation: {
    /** La barre du haut : « ici » précède, pour les lecteurs d'écran, le nom de la destination affichée ; « iciAide » est sa bulle. */
    outils: { titre: string; ici: string; iciAide: string; rechercher: string; rechercherAide: string; rapide: string; rapideAide: string };
    /** Les chapitres internes qui n'ont pas de titre propre dans la page. */
    chapitres: { intro: string; methode: string; parcours: string; explorer: string; tableau: string; presentation: string; coordonnees: string; credits: string };
    /** Au-dessus du fil : « {destination} · {k} / {n} ». */
    etat: string;
    /** La conclusion de chaque destination : une invitation à rejoindre le portail. */
    suites: Record<IdSection, { repere: string; titre: string; texte: string; action: string }>;
    recherche: {
      titre: string;
      invite: string;
      aide: string;
      vide: string;
      suggestions: string;
      resultats: string;
      types: Record<'destination' | 'projet' | 'competence' | 'parcours' | 'methode' | 'veille' | 'contact' | 'document' | 'jeu', string>;
      fiche: string;
    };
    rapide: {
      titre: string;
      intro: string;
      quitter: string;
      profil: string;
      competences: string;
      realisations: string;
      parcours: string;
      contact: string;
      cv: string;
      telecharger: string;
      fiche: string;
      site: string;
      ecrire: string;
    };
  };
  /** La carte du portail : les destinations du site, en constellation (voir Explorateur.astro). */
  explorateur: {
    titre: string;
    aide: string;
    ici: string;
    /** Le libellé du noyau de la carte : un clic dessus la referme. */
    refermer: string;
    /** Une ligne par destination. « {n} » est remplacé par le vrai nombre (domaines, réalisations). */
    destinations: Record<IdSection, string>;
  };
  hero: {
    /** Petite ligne au-dessus du titre. */
    surtitre: string;
    /** Le titre, en deux lignes : le nom, puis le métier. */
    titre: [string, string];
    accroche: string;
    actions: { realisations: string; contact: string };
  };
  /** La vitrine de Portal Rush sur l'accueil (et le repère « Jouable »). */
  vitrine: { repere: string; badge: string; lancer: string; jouer: string; fiche: string; note: string };
  methode: {
    titre: [string, string];
    texte: string;
    /** « exemple » : un fait vérifiable tiré de ce site, qui illustre l'étape. */
    etapes: { nom: string; texte: string; exemple: string }[];
    /** Le petit libellé placé devant chaque exemple. */
    surCeSite: string;
    preuve: string;
  };
  /** La suite de l'accueil : l'histoire, le parcours (le CV), le cap. */
  apropos: {
    histoire: { titre: [string, string]; moments: { nom: string; texte: string }[] };
    parcours: {
      titre: string;
      etapes: { date: string; nom: string; lieu: string; texte: string }[];
      cv: string;
    };
    cap: { titre: string; texte: string };
  };
  competences: {
    texte: string;
    /** Libellé au-dessus des filtres par réalisation. */
    lire: string;
    tout: string;
    /** Lu par les lecteurs d'écran après chaque compétence : « prouvé par {projets} ». */
    prouvePar: string;
    domaines: { nom: string; competences: Competence[] }[];
    tableau: {
      titre: string;
      texte: string;
      /** En-tête de la première colonne. */
      colonne: string;
      telecharger: string;
      /** Texte lu dans une case cochée, et dans une case vide. */
      oui: string;
      non: string;
      source: string;
    };
  };
  realisations: {
    aide: string;
    /** Le bouton qui met en pause, ou relance, le défilement automatique des réalisations. */
    pause: string;
    reprendre: string;
    projets: Projet[];
    fiche: {
      contexte: string;
      objectifs: string;
      realisation: string;
      difficultes: string;
      resultat: string;
      competences: string;
      retiens: string;
      stack: string;
      video: string;
      precedent: string;
      suivant: string;
    };
  };
  veille: {
    texte: string;
    /** Les sujets suivis. La clé (ia, windows…) est celle qu'on écrit dans chaque fiche de veille. */
    sujets: Record<string, string>;
    tout: string;
    filtrer: string;
    majLe: string;
    retiens: string;
    source: string;
    /** Affiché sur la version anglaise quand une entrée n'a pas été traduite. */
    nonTraduit: string;
    vide: string;
  };
  contact: {
    titre: string;
    texte: string;
    email: string;
    copier: string;
    copie: string;
    telephoneNom: string;
    telephone: string[];
    liens: { nom: string; texte: string; href: string }[];
    /** Le repère au-dessus du titre, le nom de l'e-mail, ses deux actions, la ligne de disponibilité. */
    repere: string;
    emailNom: string;
    ecrire: string;
    voirProfil: string;
    dispo: string;
    /** Le pied de page : la signature du portfolio et ses crédits (aucun fait inventé). */
    credits: { titre: string; signature: string; role: string; roleTexte: string; outils: string; outilsTexte: string; liens: string; droits: string };
    /** Lien du pied de page vers la fiche qui raconte comment ce site est fait. */
    coulisses: string;
  };
  introuvable: { titreOnglet: string; surtitre: string; titre: [string, string]; texte: string; accueil: string; realisations: string };
  /** La palette de commandes, en forme de terminal (Ctrl + K, touche ², ou le mot « trace »). */
  terminal: {
    titre: string;
    accueil: string;
    invite: string;
    inconnue: string;
    aide: string;
    /** Pour chaque commande : le mot à taper dans cette langue, et ce qu'elle fait. */
    commandes: Record<
      // Les cinq premières mènent à une section : leur identifiant est celui de la section.
      | 'accueil'
      | 'competences'
      | 'realisations'
      | 'veille'
      | 'contact'
      | 'carte'
      | 'cv'
      | 'projets'
      | 'ouvrir'
      | 'aide'
      | 'langue'
      | 'qui'
      | 'fermer',
      { nom: string; texte: string }
    >;
    qui: string;
    ouvrirErreur: string;
  };
}
