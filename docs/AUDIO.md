# Le son du portfolio et de Portal Rush (V4, 16 octobre 2026)

## Architecture

| Pièce | Rôle | Fichier |
|---|---|---|
| Moteur commun | Un seul `AudioContext`. Canal **effets** (volume = réglage « Effets sonores »), canal **musique** (les radios), gain d'**atténuation** entre la musique et la sortie, limiteur final. Chargement des sons enregistrés (`tampon`). | `src/scripts/audio/moteur.ts` |
| Effets du site | Portail, carte, voyages, fil, intro, Portal Rush (synthèse Web Audio). Les grands effets appellent `attenuerMusique` **après** avoir été réellement programmés. | `src/scripts/sons.ts` |
| Radio | Liste de pistes, lecture/pause, précédente/suivante, position, volume, sourdine, préférences, une seule radio à la fois, suspension/reprise. Fichier (`<audio>` branché sur le canal musique) ou composition jouée par le code. | `src/scripts/audio/radio.ts` |
| Compositions | Partitions originales jouées en direct (oscillateurs, bruit filtré, cordes pincées Karplus-Strong). Durée réelle, reprise à la mesure. | `src/scripts/audio/compositions.ts` |
| Catalogue | Titres, artistes, licences, durées, fichiers, niveaux (lu par Astro et par les lecteurs). | `src/scripts/audio/catalogue.ts` |
| DREAM RADIO | Lecteur du portfolio : icône casque à côté du drapeau, lecteur en verre, reprise proposée d'une page à l'autre. | `src/scripts/audio/dream.ts`, `Chrome.astro`, `radio.css` |
| RUSH RADIO | Musique du jeu ; préférences dans la sauvegarde du jeu. | `src/scripts/audio/rush-radio.ts`, `rush/rush.ts` |

## Règles

- La musique est **coupée à l'ouverture** du site et ne démarre **jamais seule** (ni au chargement, ni au retour sur une page : la reprise est seulement proposée).
- Fermer le lecteur n'arrête pas la musique ; elle continue d'une destination à l'autre (même page). Sur une autre page (fiche), le navigateur recharge tout : le lecteur retient la piste et la position et propose de reprendre.
- **Une seule bande-son** : entrer dans Portal Rush suspend DREAM RADIO (fondu 0,9 s, position gardée) ; RUSH RADIO joue si le joueur ne l'a pas coupée ; à la sortie, RUSH RADIO s'arrête et DREAM RADIO reprend **seulement si elle jouait**.
- **Atténuation** (« ducking ») : rupture du portail −24 % (1,1 s), ouverture de la carte −18 % (0,9 s), traversées et saut −20 % (durée du voyage). Seulement si les effets sont activés et l'effet réellement joué ; des effets rapprochés prolongent l'atténuation au lieu de la relancer (pas de pompage) ; remontée en douceur (constante 0,32 s). Le volume choisi n'est jamais modifié.
- Effets sonores **activés par défaut** (8 %), indépendants de la musique. La case « Son de l'introduction » (page Son) coupe désormais vraiment le son de l'introduction.
- Les anciennes ambiances (Chill, Deep Space, Focus, Silence) et le lecteur des réglages sont retirés ; une valeur mémorisée par une ancienne version est ignorée sans rien réinitialiser d'autre.

## Musique adaptative (RUSH RADIO)

`radio.ts` `dosage()` donne, pour chaque situation de la course, le gain de chaque couche et l'ouverture du filtre de la radio : menu (nappe 1, basse 0,55, arpège 0,45), course (batterie et basse 1, arpège 0,35 → 1 avec l'intensité, mélodie au-delà de 0,55, tension = danger, filtre 2,6 → 17,6 kHz), Overdrive (tout ouvert), pause (filtre 750 Hz, −4,4 dB), défaite (nappe seule, 480 Hz), victoire (nappe, arpège, mélodie). `rush.ts` `suivreSon()` calcule l'intensité (vitesse relative au profil et avancée du secteur) et le danger (dernier bouclier, boss) quatre fois par seconde ; changements lissés en 0,5 s ; le tempo d'un morceau ne change jamais.

## Pistes et licences

Détail public : `public/audio/CREDITS.txt`.

| Piste | Origine | Licence | Fichier |
|---|---|---|---|
| Cordes du soir | Composition originale (guitare Karplus-Strong, 84 bpm, grille Amaj9 – F♯m9 – Dmaj9 – Esus4/E) | Code du site | — |
| Heure bleue, Dérive, Trait fin | Compositions originales (déjà présentes, reprises dans DREAM RADIO avec une vraie durée) | Code du site | — |
| Distant Home, Floating | diduuz, via Pioneer Space Sim | CC BY-SA 3.0 | `public/audio/dream/` |
| Spaced Piano | Contributeurs de Pioneer Space Sim (2011) | CC BY-SA 3.0 | `public/audio/dream/` |
| Néon Rush, Hyperlane | Compositions originales synthwave **à couches** (RUSH RADIO, adaptatives) | Code du site | — |
| Techno Fugue, Plazma Steel | WKFO (Arda Güler), via Pioneer Space Sim (sans couches : filtrées seulement) | CC BY-SA 3.0 | `public/audio/rush/` |
| moteur, impact, bris, energie, destruction | Kenney (Starter Kits Racing, 3D Platformer, FPS) | CC0 | `public/audio/effets/` |

Vérification de licence : `AUTHORS.txt` de Pioneer (« art, music and other assets … CC BY-SA 3.0 »), historique git du dépôt pour les auteurs (commits 7982df749, bdfe6ef87, d52690adf) ; README des kits Kenney (« sound effects are CC0 licensed »). Les fichiers Pioneer ont été réencodés en MP3 et mis à −18 LUFS (gain constant + limiteur), sans autre modification.

**Sites bloqués par le réseau de l'environnement** (non consultés) : opengameart.org, kenney.nl, freesound.org, pixabay.com, incompetech.com, freemusicarchive.org, archive.org, ccmixter.org, Wikimedia Commons, YouTube. Seuls GitHub et le registre npm étaient joignables : les sources ont donc été cherchées dans des dépôts GitHub dont la licence est écrite.

## Niveaux

Les compositions n'ont pas de « LUFS » : leur gain (`niveau` du catalogue) a été mesuré dans Chromium (RMS au milieu de chaque piste, 7 s) pour tomber au niveau des morceaux enregistrés (≈ −32 dB RMS au volume 55 %). Mesure, pas écoute : l'équilibre à l'oreille reste à confirmer.

## Ce qui n'est pas vérifié

Le son n'a jamais été écouté : il est produit et mesuré par un analyseur dans un Chromium sans écran (énergie non nulle, atténuation, positions), pas jugé à l'oreille. Ni Safari ni un vrai téléphone n'ont été essayés.
