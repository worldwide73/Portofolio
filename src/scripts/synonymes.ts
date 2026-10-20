// LES SYNONYMES DE LA RECHERCHE (16 octobre 2026).
// Chaque groupe réunit des mots qui veulent dire la même chose pour quelqu'un qui cherche dans ce
// portfolio, en français et en anglais (sans accents ni majuscules : la recherche les ignore). Le
// premier mot de chaque groupe est son « concept » : Recherche.astro l'ajoute, sans l'afficher, aux
// entrées qui en relèvent (les CV, parcours et contact relèvent de « candidature », par exemple).
// Ces groupes ne décrivent que ce que le site contient vraiment ; ils n'ajoutent aucun contenu.

export const SYNONYMES: readonly (readonly string[])[] = [
  // Portal Rush, le jeu jouable dans le site.
  ['jeu', 'jeux', 'gaming', 'game', 'games', 'gamer', 'arcade', 'jouer', 'joueur', 'play', 'player', 'jouable', 'playable', 'rush'],
  // Ce qu'un recruteur cherche : le CV, le parcours, le contact.
  ['candidature', 'candidat', 'candidater', 'postuler', 'alternance', 'alternant', 'recrutement', 'recruter', 'recruteur', 'embauche', 'embaucher', 'apprentissage', 'apprenti', 'stage', 'stagiaire', 'emploi', 'job', 'hire', 'hiring', 'recruit', 'recruitment', 'recruiter', 'apply', 'apprenticeship', 'internship', 'intern'],
  // Les compétences techniques.
  ['technologies', 'technologie', 'techno', 'technos', 'tech', 'langage', 'langages', 'programmation', 'programmer', 'coder', 'code', 'codage', 'developpement', 'developper', 'stack', 'framework', 'competence', 'competences', 'language', 'languages', 'programming', 'coding', 'development', 'skill', 'skills', 'savoir'],
  // Les réalisations.
  ['projet', 'projets', 'realisation', 'realisations', 'application', 'applications', 'app', 'apps', 'logiciel', 'logiciels', 'site', 'sites', 'outil', 'outils', 'project', 'projects', 'work', 'software', 'website', 'tool', 'tools', 'portfolio'],
  // Joindre Mathéo.
  ['contact', 'contacter', 'joindre', 'mail', 'email', 'courriel', 'adresse', 'ecrire', 'message', 'telephone', 'appeler', 'numero', 'phone', 'call', 'reach', 'write', 'linkedin'],
  // Le CV.
  ['cv', 'curriculum', 'vitae', 'resume', 'pdf'],
  // La veille.
  ['veille', 'actualite', 'actualites', 'news', 'article', 'articles', 'source', 'sources', 'watch', 'lecture', 'lectures'],
  // La sécurité et l'analyse de systèmes.
  ['securite', 'cybersecurite', 'cyber', 'security', 'cybersecurity', 'forensique', 'forensic', 'forensics', 'analyse', 'analysis', 'audit'],
  // La formation.
  ['formation', 'etudes', 'etudiant', 'ecole', 'diplome', 'cursus', 'bts', 'sio', 'slam', 'school', 'studies', 'student', 'degree', 'education', 'training'],
  // L'intelligence artificielle.
  ['ia', 'ai', 'intelligence', 'artificielle', 'artificial', 'llm', 'claude', 'codex', 'chatgpt', 'gpt'],
  // Windows et l'automatisation.
  ['windows', 'pc', 'systeme', 'system', 'powershell', 'batch', 'script', 'scripts', 'automatisation', 'automation'],
  // Les données.
  ['donnees', 'bdd', 'base', 'database', 'databases', 'sql', 'supabase', 'data'],
  // La mise en ligne.
  ['deploiement', 'hebergement', 'heberger', 'deployer', 'netlify', 'railway', 'domaine', 'deploy', 'deployment', 'hosting', 'host'],
];

/** Les mots vides, ignorés quand la recherche contient aussi d'autres mots (« me joindre » → « joindre »). */
export const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'me', 'mon', 'ma', 'mes', 'moi', 'je', 'j', 'tu', 'te', 'vous', 'nous', 'il', 'elle',
  'pour', 'par', 'sur', 'en', 'au', 'aux', 'et', 'ou', 'a', 'avec', 'dans', 'qui', 'que', 'quoi', 'comment', 'est', 'ce', 'cette', 'son', 'sa', 'ses',
  'the', 'an', 'of', 'to', 'for', 'my', 'i', 'you', 'your', 'in', 'on', 'and', 'or', 'with', 'is', 'how', 'what', 'his', 'her',
]);
