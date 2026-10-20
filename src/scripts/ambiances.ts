// LES VALEURS DE LA SCÈNE QUE MODULAIENT LES ANCIENNES AMBIANCES.
// Les ambiances (Chill, Deep Space, Focus, Silence) ont été retirées le 16 octobre 2026 : la musique vit
// désormais dans DREAM RADIO (audio/dream.ts), et la scène garde ses valeurs d'origine. Cet objet reste
// lu par la scène (gl/champ.ts) à chaque image : tous ses facteurs valent 1 (ou 0), c'est-à-dire le site
// tel qu'il a été dessiné.
export const ambiance = { vitesse: 1, brume: 1, douceur: 0, bleu: 0, eclats: 1, lampe: 1 } as const;
