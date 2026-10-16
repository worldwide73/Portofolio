> **16 octobre 2026 — Claude Code Cloud : navigation par destinations (lot terminé, testé, poussé sur `claude/hopeful-ritchie-s4w21n`).** Détail et tableau des rôles en tête du README. Destinations indépendantes, barre Portail / Rechercher / Visite rapide, cassure du bouton Portail vers la carte existante, fil des chapitres, fins de destination, menu d'identité réorganisé, raccourcis P / Ctrl+K / ← →. Grand portail, carte, saut, Orbital Hub et dunes inchangés (`git diff`). Tests : build 18 pages ; `outils/recettes/navigation-destinations.mjs` 19/19 ; `saut-ambiances.mjs`, `icone-orbit.mjs` réussies ; `corrections-ciblees.mjs` 21/21 (2 assertions de défilement adaptées aux destinations ; redémarrer le serveur de dev après modification de `src/` avant ces recettes). Non testé : fluidité avec vraie carte graphique, son, vrai téléphone. **Prochaine étape** : retours visuels de Mathéo sur son PC (`git pull` de la branche) ; ne pas fusionner dans `main` ni déployer sans son accord. Les recettes antérieures qui mesurent des positions de défilement entre sections décrivent l'ancienne navigation.

> **16 octobre — derniers réglages de vitesse demandés.** Intro −0,2 s par rapport au lot précédent : réduction cumulée 1,7 s ; 3 957 ms mesurées avec Playwright GPU. Saut Accueil ↔ Contact en Chill : multiplicateur local 1,1, soit environ 10 % plus rapide ; intro et autres ambiances indépendantes. Durée transmise au son et au fil ajustée au même multiplicateur. Fichiers : intro.ts, saut.ts, voyage.ts. Tests : duree-intro.mjs réussi ; saut-ambiances.mjs (12 trajets, origine/Focus/Chill, normal/réduit, aller/retour + animations coupées) réussi sans exception JS ; build 18 pages réussi. Ces valeurs remplacent les précédentes ci-dessous.

> **16 octobre — durée intro rétablie à la demande de Mathéo : +0,5 s.** Réduction cumulée de la partition revenue à 1,5 s (remplace la valeur 2 s ci-dessous). Mesure Playwright avec GPU : 4 120 ms (`outils/recettes/duree-intro.mjs`). Première mesure sans les arguments GPU non exploitable : assertion échouée ; relance GPU réussie. Seule la vitesse de l’intro a changé, aucun effet retiré. La cinématique Accueil ↔ Contact reste inchangée : 0,6 s + 0,55 s nominales, rythme global préexistant dépendant de l’ambiance (Chill 0,85 ; Focus 1,5). Pas de modification de ce rythme dans ce lot. Seuil de recette trois-corrections adapté à la nouvelle durée.

> **16 octobre — transition Accueil ↔ Contact en Focus : corrigée et testée.** La cinématique existait toujours mais voyage.ts exigeait ambiance.eclats >= 0.3 ; Focus donne 0. Absence reproduite dans les deux sens avant correction. Ce filtre d’ambiance est retiré : animations complètes = saut dans les deux sens, quelle que soit l’ambiance. Les animations allégées/coupées et prefers-reduced-motion restent respectées. Recette `outils/recettes/saut-ambiances.mjs` : 8 trajets origine/Focus × normal/réduit × aller/retour, déclenchement de la toile, destination et nettoyage vérifiés ; animations coupées aussi testées ; aucune exception JS. Build 18 pages réussi. Diagnostic avant : `outils/recettes/diagnostic-saut.mjs`. Aucun réglage utilisateur changé dans son navigateur.

> **Correctif du 16 octobre — icône Orbit invisible en Focus.** La règle `html[data-atmosphere="focus"] .jeu-bouton { display:none }` masquait le Hub, même après rechargement puisque le réglage persiste. Règle retirée de `src/styles/reglages.css`, sans changer l’icône. Recette `outils/recettes/icone-orbit.mjs` : visibilité et ouverture/fermeture dans les quatre ambiances, Focus après reload, animations normales/réduites (10 contrôles OK, zéro exception JS). Build Astro 18 pages réussi. La dissimulation temporaire pendant intro/menu/carte reste normale.

# Dernier lot — 16 octobre 2026

Les trois demandes les plus récentes sont terminées : intro −0,5 s supplémentaires (timeScale réduction cumulée 2 s), panneau 390 × 560 sans changement de l’icône, correction de la lame penchée. Cause reproduite : coordonnées souris normalisées hors plage quand le canvas est hors écran (sourisY 3,894), persistantes au retour clavier. Fix dans gl/champ.ts : filtrer les mouvements hors écran, borner la visée, recentrer au retour avec remise à zéro du lissage.

Tests réellement relancés : trois-corrections.mjs (normal + réduit, navigation directe, Contact, flèches, Explore My Universe, dimensions et réponse Hub, émulation 390 px), zéro exception JS, intro 3 574 ms ; captures examinées. Build 18 pages réussi. Rapport captures/ciblees/trois-corrections.json. Diagnostic avant correction conservé dans diagnostic-inclinaison.mjs et inclinaison-avant.png (relancé sur le code corrigé, il ne reproduira plus le défaut).

Fichiers source modifiés : src/scripts/gl/champ.ts, src/scripts/intro.ts, src/styles/hub.css. Serveur local actif : http://127.0.0.1:4321/ (node node_modules/astro/bin/astro.mjs dev --host 127.0.0.1 --port 4321). Pas de dépendance ajoutée. Attendre les retours ; ne pas reprendre les anciens chantiers différés sans demande.

---
Historique précédent :

# Passage de relais — 15 octobre 2026

## Dernière mission traitée
Corrections ciblées seulement. Voir `docs/CORRECTIONS_CIBLEES_2026-10-15.md` pour les fichiers et preuves. Ne pas reprendre spontanément l’audit global ou la configuration des Skills : ils ont été différés par cette demande plus récente.

## Terminé et testé
- Bouton Orbit extérieur restauré à l’identique de la sauvegarde Claude ; jeu.css et dunes inchangés.
- Vraie capture de l’accueil dans la galerie, la fiche portfolio et la Constellation ; description FR/EN enrichie, recadrage de cette seule couverture supprimé.
- Intro encore raccourcie de 0,5 s ; durée totale observée environ 4,2 s. Refresh au début, avec intro et bouton Skip ; mouvement réduit respecté. Une ancienne position de langue est ignorée au refresh.
- Portail : nettoyage commun du survol, suppression du retour automatique de l’aperçu après focus restitué ; souris/clavier/double Entrée/Échap précoce/retour navigateur testés. Un déplacement de souris hors portail ne rallume plus le logo.
- Hub : réponses à partir des champs réels des projets, suivi d’une question, comparaison, réponse honnête si donnée absente ; vraie priorité du CV. Interface et saisie contenues à 320 et 390 px.
- Visites : actions vers fiche, Constellation, CV et tableau ; démarrage depuis une fiche via paramètre consommé ; flèches précédent/suivant.
- Constellation : sept projets, filtres par domaine, capture, relations réelles nommées ; aucun rattachement BTS inventé pour Portal Rush.

## Vérification réelle
`corrections-ciblees.mjs` : 21/21. `finitions-ciblees.mjs` : contrôles complémentaires et mesure d’intro. Rapports/captures dans `captures/ciblees/`. Captures examinées visuellement. Build Astro : 18 pages. Pas de test micro, pas de téléphone physique, pas de Lighthouse.

## Environnement et précautions
Serveur local : http://127.0.0.1:4321/ ; commande npm run dev -- --host 127.0.0.1 --port 4321 ; Ctrl+C pour arrêter. Aucun déploiement, aucun paquet installé. Pas de Git. Archive complète et manifeste dans `.backups/avant-codex-20261015-170633.*` (10 537 fichiers, CRC OK). Les modifications de sécurité/crédits antérieures à la demande ciblée sont conservées, sans prétendre qu’un audit global est terminé.

## Prochaine étape
Attendre les retours visuels de Mathéo ou sa prochaine mission. Si la configuration des Skills redevient le périmètre demandé : les cinq Skills locaux sont autorisés, mais toute installation, tout téléchargement ou connexion externe doivent d’abord être présentés pour accord. Ne pas installer Three.js : le site utilise déjà OGL. Préserver les mémoires Claude.
