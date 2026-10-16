// LE RÉFÉRENTIEL DU BTS SIO, et les réalisations qui démontrent chaque compétence.
//
// Les intitulés sont ceux du référentiel officiel, recopiés mot pour mot depuis
// la fiche RNCP40792 de France Compétences (vérifiée le 13 octobre 2026) :
// https://www.francecompetences.fr/recherche/rncp/40792/
// Ils restent en français dans les deux langues du site : ce sont des libellés
// officiels, on ne les traduit pas.
//
// Ce fichier nourrit trois endroits : le tableau de synthèse de la section
// Compétences, la rubrique « Compétences démontrées » de chaque fiche, et le
// fichier téléchargeable /tableau-bts-sio.csv.

export interface CompetenceOfficielle {
  /** Identifiant interne : bloc et rang (b2-1 = bloc 2, première compétence). */
  id: string;
  intitule: string;
}

export interface Bloc {
  numero: number;
  intitule: string;
  competences: CompetenceOfficielle[];
}

export const BLOCS: Bloc[] = [
  {
    numero: 1,
    intitule: 'Support et mise à disposition de services informatiques',
    competences: [
      { id: 'b1-1', intitule: 'Gérer le patrimoine informatique' },
      { id: 'b1-2', intitule: "Répondre aux incidents et aux demandes d'assistance et d'évolution" },
      { id: 'b1-3', intitule: "Développer la présence en ligne de l'organisation" },
      { id: 'b1-4', intitule: 'Travailler en mode projet' },
      { id: 'b1-5', intitule: 'Mettre à disposition des utilisateurs un service informatique' },
      { id: 'b1-6', intitule: 'Organiser son développement professionnel' },
    ],
  },
  {
    numero: 2,
    intitule: "Conception et développement d'applications (option SLAM)",
    competences: [
      { id: 'b2-1', intitule: 'Concevoir et développer une solution applicative' },
      { id: 'b2-2', intitule: "Assurer la maintenance corrective ou évolutive d'une solution applicative" },
      { id: 'b2-3', intitule: 'Gérer les données' },
    ],
  },
  {
    numero: 3,
    intitule: 'Cybersécurité des services informatiques (option SLAM)',
    competences: [
      { id: 'b3-1', intitule: 'Protéger les données à caractère personnel' },
      { id: 'b3-2', intitule: "Préserver l'identité numérique de l'organisation" },
      { id: 'b3-3', intitule: 'Sécuriser les équipements et les usages des utilisateurs' },
      {
        id: 'b3-4',
        intitule:
          "Garantir la disponibilité, l'intégrité et la confidentialité des services informatiques et des données de l'organisation face à des cyberattaques",
      },
      { id: 'b3-5', intitule: "Assurer la cybersécurité d'une solution applicative et de son développement" },
    ],
  },
];

// Pour chaque réalisation (par son slug), les compétences qu'elle démontre.
// Règle : on n'associe une compétence à un projet que s'il la prouve vraiment.
// Mieux vaut trois compétences solides que dix forcées.
export const DEMONTRE: Record<string, string[]> = {
  // Site avec comptes et base de données, maintenu et testé avant chaque mise en production.
  'worldwide-forensics': ['b2-1', 'b2-2', 'b2-3', 'b3-5'],
  // Application reprise d'une interface existante, puis adaptée et améliorée.
  'worldwide-tools': ['b2-1', 'b2-2'],
  // Application livrée avec un guide de procédure pour ses utilisateurs.
  'worldwide-check': ['b1-5', 'b2-1'],
  // Nouvelle version qui fait évoluer et réunit deux applications.
  'worldwide-tweaks': ['b2-1', 'b2-2'],
  // Bots développés puis mis en service sur Railway pour une communauté.
  'bots-discord': ['b1-5', 'b2-1'],
  // Site personnel : présence en ligne, veille et développement professionnel.
  portfolio: ['b1-3', 'b1-6', 'b2-1'],
};

/** Toutes les compétences, à plat. */
export const COMPETENCES_OFFICIELLES = BLOCS.flatMap((b) => b.competences);

/** Les compétences officielles démontrées par une réalisation. */
export function competencesDe(slug: string): CompetenceOfficielle[] {
  const ids = DEMONTRE[slug] ?? [];
  return COMPETENCES_OFFICIELLES.filter((c) => ids.includes(c.id));
}
