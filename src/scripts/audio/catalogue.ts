// LE CATALOGUE DES MUSIQUES (16 octobre 2026) : les pistes de DREAM RADIO et de RUSH RADIO, en données
// seulement (titre, artiste, licence, durée, fichier). Il est lu par les composants Astro (la liste des
// pistes est écrite dans la page) et par les lecteurs (dream.ts, rush-radio.ts), qui y associent les
// compositions jouées par le code.
//
// SOURCES ET LICENCES (le détail complet : public/audio/CREDITS.txt et docs/AUDIO.md) :
//   - « original » : composition écrite pour ce site, jouée en direct par le code (compositions.ts) ;
//   - « cc-by-sa » : morceau du jeu libre Pioneer Space Sim (github.com/pioneerspacesim/pioneer, dépôt lu le
//     16 octobre 2026, commit 48376c6d). Le fichier AUTHORS.txt du projet place sa musique sous licence
//     Creative Commons Attribution-ShareAlike 3.0 ; l'historique du dépôt nomme les compositeurs quand il
//     les connaît. Les fichiers ont été réencodés en MP3 et mis au même volume (-18 LUFS), sans autre
//     modification : ils restent sous CC BY-SA 3.0.

export type Licence = 'original' | 'cc-by-sa';

export interface EntreeCatalogue {
  id: string;
  titre: string;
  artiste: string;
  licence: Licence;
  /** Durée (s). */
  duree: number;
  /** Le fichier (public/), pour un morceau enregistré. */
  src?: string;
  /** Le gain qui met la piste au niveau des autres (mesuré : voir docs/AUDIO.md). */
  niveau: number;
  /** Où vérifier l'origine. */
  lien?: string;
  /** Composition à couches séparées : la musique suit vraiment la course. */
  adaptative?: boolean;
}

const PIONEER = 'https://github.com/pioneerspacesim/pioneer';

export const CATALOGUE_DREAM: EntreeCatalogue[] = [
  { id: 'cordes-du-soir', titre: 'Cordes du soir', artiste: 'Portfolio', licence: 'original', duree: 64 * 4 * (60 / 84), niveau: 1.75 },
  { id: 'distant-home', titre: 'Distant Home', artiste: 'diduuz · Pioneer Space Sim', licence: 'cc-by-sa', duree: 245.3, src: '/audio/dream/distant-home.mp3', niveau: 1, lien: PIONEER },
  { id: 'heure-bleue', titre: 'Heure bleue', artiste: 'Portfolio', licence: 'original', duree: 56 * 4 * (60 / 72), niveau: 2.6 },
  { id: 'spaced-piano', titre: 'Spaced Piano', artiste: 'Pioneer Space Sim', licence: 'cc-by-sa', duree: 240, src: '/audio/dream/spaced-piano.mp3', niveau: 1, lien: PIONEER },
  { id: 'floating', titre: 'Floating', artiste: 'diduuz · Pioneer Space Sim', licence: 'cc-by-sa', duree: 161.5, src: '/audio/dream/floating.mp3', niveau: 1, lien: PIONEER },
  { id: 'derive', titre: 'Dérive', artiste: 'Portfolio', licence: 'original', duree: 240, niveau: 0.35 },
  { id: 'trait-fin', titre: 'Trait fin', artiste: 'Portfolio', licence: 'original', duree: 40 * 4.5, niveau: 2.2 },
];

/** « 3:05 » */
export const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** RUSH RADIO : la musique de Portal Rush. Les compositions originales sont adaptatives (leurs couches
    suivent la course) ; les morceaux enregistrés n'ont pas de couches séparées : la course ne fait que
    les filtrer et doser leur volume. */
export const CATALOGUE_RUSH: EntreeCatalogue[] = [
  { id: 'neon-rush', titre: 'Néon Rush', artiste: 'Portfolio', licence: 'original', duree: 96 * 4 * (60 / 124), niveau: 1, adaptative: true },
  { id: 'hyperlane', titre: 'Hyperlane', artiste: 'Portfolio', licence: 'original', duree: 112 * 4 * (60 / 136), niveau: 1, adaptative: true },
  { id: 'techno-fugue', titre: 'Techno Fugue', artiste: 'WKFO · Pioneer Space Sim', licence: 'cc-by-sa', duree: 110.8, src: '/audio/rush/techno-fugue.mp3', niveau: 1, lien: PIONEER },
  { id: 'plazma-steel', titre: 'Plazma Steel', artiste: 'WKFO · Pioneer Space Sim', licence: 'cc-by-sa', duree: 118.2, src: '/audio/rush/plazma-steel.mp3', niveau: 1, lien: PIONEER },
];
