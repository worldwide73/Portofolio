// LE CHEF D'ORCHESTRE : démarre chaque module, dans le bon ordre.
// Chaque module vit dans son propre fichier et ne fait qu'une chose.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initAcces } from './acces';
import { initApparitions } from './apparitions';
import { initAtmosphere } from './atmosphere';
import { initConstellation } from './constellation';
import { initContact } from './contact';
import { initCurseur } from './curseur';
import { initDecodage } from './decode';
import { initDefilement } from './defilement';
import { initDetails, restaurerPosition } from './details';
import { initExplorateur } from './explorateur';
import { initFil } from './fil';
import { initFiltres } from './filtres';
import { initGalerie } from './galerie';
import { initChamp } from './gl/champ';
import { initHorloge } from './horloge';
import { jouerIntro } from './intro';
import { initLangue, recenserPage } from './langue';
import { initNav } from './nav';
import { initPortail } from './portail';
import { initRapide } from './rapide';
import { initRecherche } from './recherche';
import { initTerminal } from './terminal';
import { initTitres } from './titres';
import { appliquer as appliquerReglages } from './reglages';
import { initHub } from './hub';
import { initRush } from './rush/rush';
import { initReglages } from './reglages-panneau';
import { initSons } from './sons';
import { initVoyage } from './voyage';
import { initVitrine } from './vitrine';

gsap.registerPlugin(ScrollTrigger);
gsap.config({ nullTargetWarn: false });

async function demarrer(): Promise<void> {
  // Avant toute chose : on recense la page telle que le serveur l'a envoyée.
  // Le changement de langue s'appuie sur cet inventaire (voir langue.ts).
  recenserPage();

  // On attend la police (1,5 s au plus) : les titres sont découpés en lignes
  // selon leur largeur, et le menu mesure ses libellés pour placer son fond.
  const police = document.fonts.load('400 48px "Geist Variable"').then(() => document.fonts.ready);
  await Promise.race([police, new Promise((suite) => setTimeout(suite, 1500))]);

  appliquerReglages();
  initAtmosphere();
  initDetails();
  initLangue();
  initDefilement();
  initChamp();
  initDecodage();
  initHorloge();
  initCurseur();
  initTitres();
  initGalerie();
  initApparitions();
  initFiltres();
  initNav();
  initAcces();
  initContact();
  initTerminal();
  initVoyage();
  initFil();
  initExplorateur();
  initPortail();
  initRecherche();
  initRapide();
  initReglages();
  initSons();
  initRush();
  initHub();
  initConstellation();
  initVitrine();

  // La galerie s'épingle et allonge la page : on remet les déclencheurs dans
  // l'ordre de la page avant de recalculer leurs positions, pour que ceux qui
  // se trouvent sous la galerie tiennent compte de cet allongement.
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  restaurerPosition();
  jouerIntro();
}

demarrer();
