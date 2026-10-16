// L'ORBITAL HUB (voir OrbitalHub.astro)
//
// ORBIT ASSISTANT. Un assistant local, gratuit, sans IA en ligne : il répond
// à partir du contenu réel du site (data-savoir). Pour comprendre une question,
// au clavier ou au micro, il cherche dans l'ordre :
//   1. un projet cité par son nom (« parle-moi de Forensics ») ;
//   2. une technologie ou une compétence (« où as-tu utilisé Python ? ») ;
//   3. une intention (« le CV », « comment te contacter », « régler le son »…),
//      d'après des mots-clés français et anglais, sans tenir compte des accents.
// Chaque réponse est composée avec le vrai contenu, et propose des actions :
// ouvrir une fiche, aller à une section, ouvrir les réglages, lancer le jeu…
//
// LA VOIX. Le micro passe par la reconnaissance vocale du navigateur
// (SpeechRecognition : Chrome, Edge, Safari ; le bouton est caché ailleurs).
// Les réponses peuvent être lues à voix haute (speechSynthesis) : toujours
// quand la question a été posée au micro, et à chaque fois si la case est cochée.
//
// EXPLORE MY UNIVERSE : des visites guidées de quelques étapes ; chaque étape
// rejoint une vraie section par la navigation du site (voyage.ts).
// BEHIND THE BUILD : du texte, écrit dans le contenu.
// PORTAL RUSH : l'onglet lance le jeu (rush/rush.ts). Depuis la pause du jeu,
// l'aide ouvre l'assistant par-dessus le jeu.

import type { Contenu, IdSection, Intention } from '../contenu/types';
import { ouvrirCarte } from './explorateur';
import { changerLangue } from './langue';
import { ouvrirRush } from './rush/rush';
import { rangCourant, voyager } from './voyage';

type Textes = Contenu['hub'];
interface Savoir {
  page: 'accueil' | 'fiche';
  accueil: string;
  autreLangue: string;
  cv: string;
  email: string;
  projets: { nom: string; court: string; annee: string; genre: string; phrase: string; details: Record<string,string>; stack: string[]; lien: string; fiche: string }[];
  libelles: Record<string,string>;
  domaines: { nom: string; competences: { nom: string; projets: string[] }[] }[];
  parcours: { date: string; nom: string; lieu: string }[];
  cap: string;
  veille: string[];
}
interface Action {
  libelle: string;
  lien?: string;
  nouvelOnglet?: boolean;
  faire?: () => void;
}
interface Reponse {
  texte: string;
  actions: Action[];
}

/** En minuscules, sans accents ni apostrophes : « Où as-tu utilisé ? » devient « ou as-tu utilise ? ». */
const simplifier = (texte: string) =>
  ` ${texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[-–—?!.,;:«»"()]+(?=\s|$)|(?<=\s|^)[-–—«»"(]+|\s[-–—]\s/g, ' ')
    .replace(/(\w)-(\w)/g, '$1 $2')
    .replace(/\s+/g, ' ')} `;

/** Le mot (ou l'expression) apparaît-il entier dans le texte simplifié ? */
const contient = (texte: string, mot: string) => {
  const m = simplifier(mot).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9#+])${m}([^a-z0-9#+]|$)`).test(texte);
};

/** Les mots qui trahissent chaque intention, en français et en anglais (sans accents). Un mot peut commencer un plus long : « recrut » trouve « recruteur ». */
const MOTS: Record<Intention, string[]> = {
  salut: ['bonjour', 'salut', 'hello', 'coucou', 'bonsoir', 'hey', 'hi', 'yo'],
  merci: ['merci', 'thanks', 'thank you', 'genial', 'parfait', 'super', 'top'],
  aide: ['aide', 'help', 'que peux tu', 'que sais tu', 'tu sers a quoi', 'what can you', 'que faire', 'comment ca marche', 'tu fais quoi'],
  qui: ['qui es', 'qui est', 'presente', 'presentation', 'about', 'who is', 'who are', 'matheo', 'maleyran', 'profil', 'profile', 'toi', 'yourself'],
  parcours: ['parcours', 'formation', 'etude', 'ecole', 'diplome', 'bts', 'nexa', 'bac', 'background', 'education', 'school', 'degree', 'master', 'experience', 'stage en equipe', 'study', 'studies', 'studied', 'what did you study'],
  dispo: ['alternance', 'alternant', 'stage', 'embauche', 'recrut', 'disponible', 'dispo', 'travailler avec', 'hire', 'hiring', 'internship', 'work study', 'available', 'job', 'emploi', 'apprentissage', 'opportunite'],
  cv: ['cv', 'curriculum', 'resume', 'pdf'],
  projets: ['projet', 'project', 'realisation', 'galerie', 'gallery', 'travaux', 'work', 'portfolio', 'creation', 'application', 'site web'],
  competences: ['competence', 'skill', 'savoir faire', 'domaine', 'referentiel', 'tableau', 'technologie', 'techno', 'langage', 'stack', 'maitrise'],
  veille: ['veille', 'actualite', 'news', 'watch', 'sujet', 'topic', 'article', 'source'],
  contact: ['contact', 'mail', 'courriel', 'ecrire', 'telephone', 'numero', 'linkedin', 'github', 'joindre', 'phone', 'reach', 'email', 'appeler', 'message'],
  reglages: ['reglage', 'parametre', 'setting', 'son', 'sound', 'volume', 'musique', 'music', 'opacite', 'flou', 'blur', 'animation', 'ambiance', 'atmosphere', 'mute', 'couper', 'bruit', 'lumiere', 'luminosite'],
  jeu: ['jeu', 'jouer', 'rush', 'game', 'play', 'niveau', 'level', 'boss', 'arcade', 'score', 'record'],
  commandes: [
    'commande',
    'touche',
    'clavier',
    'control',
    'key',
    'comment jouer',
    'comment on joue',
    'comment je joue',
    'comment ca se joue',
    'regle du jeu',
    'how to play',
    'how do i play',
    'how do you play',
    'how does the game work',
    'rules',
    'overdrive',
    'perfect',
    'dodge',
    'combo',
    'manette',
  ],
  carte: ['carte', 'portail', 'cube', 'map', 'galaxie', 'constellation', 'navigation', 'naviguer'],
  langue: ['anglais', 'english', 'francais', 'french', 'langue', 'language', 'traduire', 'translate', 'traduction'],
  visite: ['visite', 'tour', 'guide', 'decouvrir', 'explore', 'parcourir', 'faire le tour'],
  coulisses: [
    'coulisse',
    'comment est fait',
    'comment c est fait',
    'site est fait',
    'site a ete fait',
    'construit',
    'technologies du site',
    'pour le site',
    'pour ce site',
    'for this site',
    'for the site',
    'technique du site',
    'fait avec',
    'code source',
    'how is it made',
    'how was',
    'made with',
    'built',
    'build',
    'astro',
    'webgl',
    'gsap',
  ],
};
// Certaines intentions l'emportent à score égal (les plus précises d'abord).
const PRIORITE: Intention[] = ['commandes', 'jeu', 'cv', 'dispo', 'contact', 'reglages', 'carte', 'langue', 'visite', 'coulisses', 'parcours', 'veille', 'competences', 'projets', 'qui', 'aide', 'merci', 'salut'];

let ouvrirAssistant: (() => void) | null = null;
/** Ouvre l'Orbital Hub sur l'assistant (sert à l'aide du jeu). */
export const ouvrirOrbitAssistant = () => ouvrirAssistant?.();

export function initHub(): void {
  const hub = document.querySelector<HTMLElement>('#hub');
  if (!hub) return;
  const lireTextes = (): Textes => JSON.parse(hub.dataset.textes ?? '{}');
  const lireSavoir = (): Savoir => JSON.parse(hub.dataset.savoir ?? '{}');
  let textes = lireTextes();
  let savoir = lireSavoir();
  let dernierProjet: Savoir['projets'][number] | null = null;
  const place = { parent: hub.parentElement!, suivant: hub.nextSibling };
  const fil = hub.querySelector<HTMLElement>('.hub__fil')!;
  const messages = hub.querySelector<HTMLElement>('.hub__messages')!;
  const formulaire = hub.querySelector<HTMLFormElement>('.hub__saisie')!;
  const champ = hub.querySelector<HTMLInputElement>('#hub-question')!;
  const micro = hub.querySelector<HTMLButtonElement>('.hub__micro')!;
  const caseVoix = hub.querySelector<HTMLInputElement>('[data-voix]')!;
  const fin = window.matchMedia('(pointer: fine)').matches;
  const anglais = () => hub.dataset.langue === 'en';

  // ==========================================================================
  // LES VUES ET L'OUVERTURE
  // ==========================================================================
  const montrerVue = (vue: 'assistant' | 'explorer' | 'coulisses') => {
    hub.dataset.vue = vue;
    hub.querySelectorAll<HTMLElement>('[data-onglet]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.onglet === vue)));
    if (vue === 'assistant' && fin) requestAnimationFrame(() => champ.focus({ preventScroll: true }));
  };
  const masquer = () => {
    if (hub.matches(':popover-open')) hub.hidePopover();
  };
  hub.addEventListener('toggle', (e) => {
    const ouvert = (e as ToggleEvent).newState === 'open';
    if (ouvert) {
      if (hub.dataset.vue === 'assistant' && fin) champ.focus({ preventScroll: true });
      return;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    arreterEcoute();
    // Ouvert par-dessus le jeu : on le remet à sa place.
    if (hub.parentElement !== place.parent) place.parent.insertBefore(hub, place.suivant);
  });
  hub.querySelectorAll<HTMLElement>('[data-onglet]').forEach((bouton) =>
    bouton.addEventListener('click', () => {
      const vue = bouton.dataset.onglet as 'assistant' | 'rush' | 'explorer' | 'coulisses';
      if (vue === 'rush') {
        bouton.classList.add('est-lance');
        window.setTimeout(() => {
          bouton.classList.remove('est-lance');
          masquer();
          ouvrirRush();
        }, 140);
      } else montrerVue(vue);
    }),
  );

  /** Ouvre l'assistant ; par-dessus le jeu si le jeu est ouvert (le jeu est alors en pause). */
  ouvrirAssistant = () => {
    const jeu = document.querySelector<HTMLDialogElement>('.rush[open]');
    if (jeu && hub.parentElement !== jeu) jeu.append(hub);
    montrerVue('assistant');
    if (!hub.matches(':popover-open')) hub.showPopover();
  };
  window.addEventListener('orbital', (e) => {
    if ((e as CustomEvent<string>).detail === 'assistant') ouvrirAssistant?.();
  });

  // ==========================================================================
  // LES ACTIONS
  // ==========================================================================
  /** Rejoint une section : par la navigation du site sur l'accueil, en changeant de page ailleurs. */
  const aller = (section: IdSection) => {
    masquer();
    if (savoir.page === 'accueil') voyager(section);
    else window.location.href = section === 'accueil' ? savoir.accueil : `${savoir.accueil}#${section}`;
  };
  const r = () => textes.assistant.reponses;
  const versSection = (section: IdSection, libelle: string): Action => ({ libelle, faire: () => aller(section) });
  const actionCV = (): Action => ({ libelle: r().cv.action, lien: savoir.cv, nouvelOnglet: true });
  const actionMail = (): Action => ({ libelle: savoir.email, lien: `mailto:${savoir.email}` });
  const remplir = (modele: string, valeurs: Record<string, string>) => modele.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
  const liste = (elements: string[]) => {
    if (elements.length < 2) return elements.join('');
    const et = anglais() ? ' and ' : ' et ';
    return `${elements.slice(0, -1).join(', ')}${et}${elements[elements.length - 1]}`;
  };

  // ==========================================================================
  // COMPRENDRE UNE QUESTION
  // ==========================================================================
  /** Les projets cités : un mot qui n'appartient qu'à un projet compte triple (« Forensics »), un mot partagé une fois (« WorldWide »). */
  const projetsCites = (q: string) => {
    const vides = ['this', 'that', 'with', 'your', 'pour', 'avec', 'dans', 'cette', 'tout', 'trois', 'three'];
    const mots = savoir.projets.map((p) => [...new Set(simplifier(`${p.nom} ${p.court}`).trim().split(/[^a-z0-9.]+/).filter((m) => m.length >= 4 && !vides.includes(m)))]);
    const scores = savoir.projets.map((p, i) => {
      let s = 0;
      for (const m of mots[i]) {
        if (!contient(q, m)) continue;
        const partage = mots.filter((autres) => autres.includes(m)).length > 1;
        s += partage ? 1 : 3;
      }
      return { p, s };
    });
    return scores.filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  };

  /** Une technologie ou une compétence citée, et les projets qui l'emploient. */
  const technoCitee = (q: string) => {
    const candidats = new Map<string, { nom: string; projets: Set<string>; domaine: string }>();
    for (const d of savoir.domaines)
      for (const k of d.competences) {
        const cle = simplifier(k.nom).trim();
        const c = candidats.get(cle) ?? { nom: k.nom, projets: new Set<string>(), domaine: d.nom };
        k.projets.forEach((p) => c.projets.add(p));
        candidats.set(cle, c);
      }
    for (const p of savoir.projets)
      for (const t of p.stack) {
        const cle = simplifier(t).trim();
        const c = candidats.get(cle) ?? { nom: t, projets: new Set<string>(), domaine: '' };
        c.projets.add(p.nom);
        candidats.set(cle, c);
      }
    // Le nom le plus long d'abord : « Base de données Supabase » avant « Supabase ».
    const tries = [...candidats.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [cle, c] of tries) if (cle.length >= 2 && contient(q, cle)) return c;
    // Un mot significatif d'un nom composé (« Supabase », « PowerShell ») suffit aussi.
    for (const [cle, c] of tries)
      for (const mot of cle.split(/\s+/)) if (mot.length >= 5 && !['analyse', 'systemes', 'windows', 'donnees', 'diagnostic'].includes(mot) && contient(q, mot)) return c;
    return null;
  };

  const intention = (question: string): Intention | null => {
    const q = simplifier(question);
    if (['cv','curriculum','resume'].some(m => contient(q,m))) return 'cv';
    let meilleure: Intention | null = null;
    let score = 0;
    for (const id of PRIORITE) {
      let s = 0;
      for (const mot of MOTS[id]) {
        const m = mot.trim();
        // « recrut » trouve « recruteur » ; les mots courts doivent être entiers.
        const trouve = m.length >= 5 ? q.includes(m) : contient(q, m);
        // (Une expression entière compte bien plus qu'un mot isolé : « how do I play » l'emporte sur « play ».)
        if (trouve) s += (m.includes(' ') ? 3 : 1) + m.length / 10;
      }
      if (s > score) {
        score = s;
        meilleure = id;
      }
    }
    return meilleure;
  };

  /** La réponse à une question (ou à un sujet choisi). */
  const repondre = (question: string, sujet?: Intention): Reponse => {
    const q = simplifier(question);
    const m = textes.assistant.modeles;
    if (!sujet && !['cv','contact','reglages','commandes','langue'].includes(intention(question) ?? '')) {
      // 1. Un projet.
      const cites = projetsCites(q);
      if (!cites.length && /decouvrir.*site|discover.*site|identite.*visuelle|visual.*identity|fonctionnalites.*site|site.*features/.test(q)) {
        const portfolio = savoir.projets.find(p => p.fiche.endsWith('/portfolio/'));
        if (portfolio) cites.push({p:portfolio,s:3});
      }
      const detailsDemandes = /objectif|resultat|difficulte|realisation|fonction|feature|contexte|appris|reten|goal|result|challenge|built|learn/.test(q);
      if (!cites.length && dernierProjet && detailsDemandes && /\b(et|ses|ce|son|sa|and|its|it|this)\b/.test(q)) cites.push({ p: dernierProjet, s: 3 });
      if (cites.filter(x => x.s >= 3).length > 1) {
        const projets = cites.filter(x => x.s >= 3).slice(0,3).map(x => x.p);
        return { texte: projets.map(p => `${p.nom} — ${p.phrase}\n${remplir(m.stack,{liste:p.stack.join(', ')})}`).join('\n\n'), actions: projets.map(p => ({libelle:p.court,lien:p.fiche})) };
      }
      if (cites.length && (cites[0].s >= 3 || cites.length === 1)) {
        const p = cites[0].p;
        dernierProjet = p;
        const cle = /difficulte|challenge/.test(q) ? 'difficultes' : /resultat|result/.test(q) ? 'resultat' : /appris|reten|learn/.test(q) ? 'retiens' : /realisation|fonction|techni|visual|built|feature|comment|how/.test(q) ? 'realisation' : /objectif|goal/.test(q) ? 'objectifs' : '';
        const manque = anglais() ? 'This detail is not documented yet. Please ask Mathéo via Contact.' : 'Ce détail n’est pas encore documenté. Vous pouvez le demander à Mathéo via Contact.';
        const details = (cle ? [cle] : ['objectifs','realisation','resultat']).map(k => `${savoir.libelles[k] ?? k} : ${p.details[k] || manque}`);
        const texte = [remplir(m.projet, {nom:p.nom,annee:p.annee,genre:p.genre,phrase:p.phrase}), ...details, remplir(m.stack, { liste: p.stack.join(', ') })].join('\n\n');
        const actions: Action[] = [{ libelle: m.fiche, lien: p.fiche }];
        if (p.lien) actions.push({ libelle: m.site, lien: p.lien, nouvelOnglet: true });
        return { texte, actions };
      }
      if (cites.length > 1) {
        return { texte: remplir(m.plusieurs, { liste: liste(cites.map((x) => x.p.nom)) }), actions: cites.slice(0, 4).map((x) => ({ libelle: x.p.court || x.p.nom, lien: x.p.fiche })) };
      }
      // 2. Une technologie, une compétence.
      const techno = technoCitee(q);
      if (techno) {
        const projets = [...techno.projets];
        const texte = projets.length ? remplir(m.techno, { tech: techno.nom, projets: liste(projets) }) : remplir(m.competence, { tech: techno.nom, domaine: techno.domaine });
        const actions = projets
          .map((nom) => savoir.projets.find((p) => p.nom === nom))
          .filter((p): p is Savoir['projets'][number] => !!p)
          .slice(0, 3)
          .map((p) => ({ libelle: p.court || p.nom, lien: p.fiche }));
        if (!actions.length) actions.push(versSection('competences', r().competences.action));
        return { texte, actions };
      }
    }
    // 3. Une intention.
    const id = sujet ?? intention(question);
    if (!id) return { texte: textes.assistant.incompris, actions: [] };
    const rep = r()[id];
    switch (id) {
      case 'qui':
        return { texte: rep.texte, actions: [versSection('accueil', rep.action), actionCV()] };
      case 'parcours': {
        const etapes = savoir.parcours.map((e) => `${e.date}${anglais() ? ': ' : ' : '}${e.nom}${e.lieu ? ` (${e.lieu})` : ''}`);
        return { texte: remplir(m.parcours, { liste: etapes.join(' ; '), cap: savoir.cap }).trim(), actions: [actionCV()] };
      }
      case 'dispo':
        return { texte: rep.texte, actions: [versSection('contact', rep.action), actionMail(), actionCV()] };
      case 'cv':
        return { texte: rep.texte, actions: [actionCV()] };
      case 'projets':
        return { texte: `${rep.texte} ${liste(savoir.projets.map((p) => p.nom))}.`, actions: [versSection('realisations', rep.action)] };
      case 'competences':
        return { texte: `${rep.texte} ${remplir(m.domaines, { liste: liste(savoir.domaines.map((d) => d.nom)) })}`, actions: [versSection('competences', rep.action)] };
      case 'veille':
        return { texte: `${rep.texte} ${remplir(m.veille, { liste: liste(savoir.veille) })}`, actions: [versSection('veille', rep.action)] };
      case 'contact':
        return { texte: rep.texte, actions: [actionMail(), versSection('contact', rep.action)] };
      case 'reglages':
        return {
          texte: rep.texte,
          actions: [
            {
              libelle: rep.action,
              faire: () => {
                masquer();
                document.querySelector<HTMLElement>('#reglages')?.showPopover();
              },
            },
          ],
        };
      case 'jeu':
        return { texte: rep.texte, actions: [{ libelle: rep.action, faire: () => (masquer(), ouvrirRush()) }] };
      case 'commandes':
        return { texte: rep.texte, actions: [{ libelle: rep.action, faire: () => (masquer(), ouvrirRush('commandes')) }] };
      case 'carte':
        return {
          texte: rep.texte,
          actions: [
            {
              libelle: rep.action,
              faire: () => {
                if (savoir.page !== 'accueil') return void (window.location.href = savoir.accueil);
                masquer();
                const ici = rangCourant() === 0;
                if (!ici) voyager('accueil');
                window.setTimeout(() => ouvrirCarte(), ici ? 60 : 750);
              },
            },
          ],
        };
      case 'langue':
        return { texte: rep.texte, actions: [{ libelle: rep.action, faire: () => (masquer(), void changerLangue(savoir.autreLangue)) }] };
      case 'visite':
        return { texte: rep.texte, actions: [{ libelle: rep.action, faire: () => montrerVue('explorer') }] };
      case 'coulisses':
        return { texte: rep.texte, actions: [{ libelle: rep.action, faire: () => montrerVue('coulisses') }] };
      default:
        return { texte: rep.texte, actions: [] };
    }
  };

  // ==========================================================================
  // LA CONVERSATION
  // ==========================================================================
  const ajouter = (qui: 'visiteur' | 'assistant', texte: string, actions: Action[] = []) => {
    const bulle = document.createElement('div');
    bulle.className = `hub__message hub__message--${qui}`;
    const p = document.createElement('p');
    p.textContent = texte;
    bulle.append(p);
    if (actions.length) {
      const rang = document.createElement('div');
      rang.className = 'hub__actions etiquette';
      for (const a of actions) {
        const el = a.lien ? document.createElement('a') : document.createElement('button');
        el.className = 'pastille';
        el.textContent = a.nouvelOnglet ? `${a.libelle} ↗` : a.libelle;
        if (el instanceof HTMLAnchorElement && a.lien) {
          el.href = a.lien;
          if (a.nouvelOnglet) {
            el.target = '_blank';
            el.rel = 'noopener';
          }
        } else if (el instanceof HTMLButtonElement) el.type = 'button';
        if (a.faire) el.addEventListener('click', a.faire);
        rang.append(el);
      }
      bulle.append(rang);
    }
    messages.append(bulle);
    // On garde les quarante derniers messages.
    while (messages.children.length > 40) messages.firstElementChild?.remove();
    // Une réponse longue se lit depuis son début, pas depuis ses derniers mots.
    if (qui === 'assistant') fil.scrollTop += bulle.getBoundingClientRect().top - fil.getBoundingClientRect().top;
    else fil.scrollTop = fil.scrollHeight;
    return bulle;
  };

  let voixActive = false;
  try {
    voixActive = localStorage.getItem('orbit-voix') === '1';
  } catch {
    // stockage indisponible
  }
  caseVoix.checked = voixActive;
  if ('speechSynthesis' in window) hub.querySelector<HTMLElement>('.hub__voix')!.hidden = false;
  caseVoix.addEventListener('change', () => {
    voixActive = caseVoix.checked;
    try {
      localStorage.setItem('orbit-voix', voixActive ? '1' : '0');
    } catch {
      // stockage indisponible
    }
    if (!voixActive && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  });
  const parler = (texte: string) => {
    if (!('speechSynthesis' in window)) return;
    const synthese = window.speechSynthesis;
    synthese.cancel();
    const phrase = new SpeechSynthesisUtterance(texte);
    phrase.lang = anglais() ? 'en-GB' : 'fr-FR';
    const voix = synthese.getVoices().find((v) => v.lang.toLowerCase().startsWith(phrase.lang.slice(0, 2)));
    if (voix) phrase.voice = voix;
    phrase.rate = 1.03;
    synthese.speak(phrase);
  };

  /** Réponse locale immédiate : aucun faux temps de chargement ni requête distante. */
  const demander = (question: string, sujet?: Intention, auMicro = false) => {
    const texte = question.trim().slice(0,600);
    if (!texte) return;
    ajouter('visiteur', texte);
    try {
      const reponse = repondre(texte, sujet);
      ajouter('assistant', reponse.texte, reponse.actions);
      if (voixActive || auMicro) parler(reponse.texte);
    } catch {
      ajouter('assistant', textes.assistant.incompris, [actionMail()]);
    }
  };

  formulaire.addEventListener('submit', (e) => {
    e.preventDefault();
    demander(champ.value);
    champ.value = '';
  });
  hub.querySelectorAll<HTMLButtonElement>('[data-intention]').forEach((bouton) =>
    bouton.addEventListener('click', () => demander(bouton.textContent ?? '', bouton.dataset.intention as Intention)),
  );

  // ---- Le micro ----
  type Reconnaissance = {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
  };
  const Moteur = (window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => Reconnaissance }).webkitSpeechRecognition;
  let ecoute: Reconnaissance | null = null;
  const arreterEcoute = () => ecoute?.stop();
  if (Moteur) {
    micro.hidden = false;
    micro.addEventListener('click', () => {
      if (ecoute) return arreterEcoute();
      const reco = new Moteur();
      ecoute = reco;
      reco.lang = anglais() ? 'en-GB' : 'fr-FR';
      reco.interimResults = true;
      reco.maxAlternatives = 1;
      let envoye = false;
      reco.onstart = () => {
        micro.setAttribute('aria-pressed', 'true');
        micro.setAttribute('aria-label', textes.assistant.microArret);
        champ.placeholder = textes.assistant.ecoute;
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      };
      reco.onresult = (e) => {
        let texte = '';
        let final = false;
        for (let i = 0; i < e.results.length; i++) {
          texte += e.results[i][0].transcript;
          if (e.results[i].isFinal) final = true;
        }
        champ.value = texte;
        if (final && !envoye) {
          envoye = true;
          champ.value = '';
          demander(texte, undefined, true);
        }
      };
      reco.onerror = (e) => {
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) ajouter('assistant', textes.assistant.microRefuse);
      };
      reco.onend = () => {
        ecoute = null;
        micro.setAttribute('aria-pressed', 'false');
        micro.setAttribute('aria-label', textes.assistant.micro);
        champ.placeholder = textes.assistant.invite;
      };
      try {
        reco.start();
      } catch {
        ecoute = null;
        ajouter('assistant', textes.assistant.microRefuse);
      }
    });
  }

  // ==========================================================================
  // EXPLORE MY UNIVERSE : les visites guidées
  // ==========================================================================
  const carte = document.querySelector<HTMLElement>('.visite');
  let visite: { id: keyof Textes['explorer']['parcours']; k: number } | null = null;
  const etapes = () => (visite ? textes.explorer.parcours[visite.id].etapes : []);
  const montrerEtape = (naviguer = true) => {
    if (!carte || !visite) return;
    const liste = etapes();
    const etape = liste[visite.k];
    const e = textes.explorer;
    carte.hidden = false;
    carte.querySelector('[data-visite="etape"]')!.textContent = `${e.parcours[visite.id].nom} · ${remplir(e.etape, { k: String(visite.k + 1), n: String(liste.length) })}`;
    carte.querySelector('[data-visite="titre"]')!.textContent = etape.titre;
    carte.querySelector('[data-visite="texte"]')!.textContent = etape.texte;
    const ressource = carte.querySelector<HTMLElement>('[data-visite-ressource]')!;
    ressource.replaceChildren();
    if (etape.action) {
      const bouton = document.createElement('button');
      bouton.className = 'pastille pastille--pleine';
      bouton.type = 'button';
      const labels = anglais() ? {portfolio:'See the portfolio project',constellation:'Compare projects',tableau:'Download the skills table',cv:'Open CV'} : {portfolio:'Voir le projet portfolio',constellation:'Comparer les projets',tableau:'Télécharger le tableau de compétences',cv:'Ouvrir le CV'};
      bouton.textContent = labels[etape.action];
      const action = etape.action;
      bouton.addEventListener('click', () => {
        if (action === 'constellation') document.querySelector<HTMLButtonElement>('[data-constellation]')?.click();
        else {
          const lien = action === 'cv' ? savoir.cv : action === 'tableau' ? '/tableau-bts-sio.csv' : savoir.projets.find(p => p.fiche.endsWith('/portfolio/'))?.fiche;
          if (lien) { if (action === 'portfolio') window.location.href = lien; else window.open(lien,'_blank','noopener,noreferrer'); }
        }
      });
      ressource.append(bouton);
    }
    carte.querySelector<HTMLButtonElement>('[data-visite="precedent"]')!.disabled = visite.k === 0;
    carte.querySelector('[data-visite="suivant"]')!.textContent = visite.k === liste.length - 1 ? e.terminer : e.suivant;
    if (!naviguer) return;
    voyager(etape.section);
    // Le titre de la section s'éclaire un instant.
    const titre = document.querySelector<HTMLElement>(`#${etape.section} :is(h1, h2)`);
    if (titre) {
      titre.classList.remove('visite-cible');
      void titre.offsetWidth;
      titre.classList.add('visite-cible');
      window.setTimeout(() => titre.classList.remove('visite-cible'), 2600);
    }
  };
  const finirVisite = () => {
    visite = null;
    if (carte) carte.hidden = true;
  };
  hub.querySelectorAll<HTMLButtonElement>('[data-parcours]').forEach((bouton) =>
    bouton.addEventListener('click', () => {
      const id = bouton.dataset.parcours as keyof Textes['explorer']['parcours'];
      // Les visites partent de l'accueil.
      if (savoir.page !== 'accueil') return void (window.location.href = `${savoir.accueil}?visite=${id}`);
      masquer();
      if (id === 'libre') {
        const ici = rangCourant() === 0;
        if (!ici) voyager('accueil');
        window.setTimeout(() => ouvrirCarte(), ici ? 60 : 750);
        return;
      }
      visite = { id, k: 0 };
      montrerEtape();
    }),
  );
  // Un parcours demandé depuis une fiche commence vraiment à l'arrivée,
  // après l'introduction ; son paramètre est consommé une seule fois.
  const urlVisite = new URL(window.location.href);
  const parcoursDemande = urlVisite.searchParams.get('visite');
  if (savoir.page === 'accueil' && parcoursDemande && Object.hasOwn(textes.explorer.parcours, parcoursDemande)) {
    urlVisite.searchParams.delete('visite');
    history.replaceState(history.state, '', urlVisite.pathname + urlVisite.search + urlVisite.hash);
    const lancer = () => {
      if (document.documentElement.classList.contains('intro')) return false;
      hub.querySelector<HTMLButtonElement>(`[data-parcours="${parcoursDemande}"]`)?.click();
      return true;
    };
    if (!lancer()) {
      const observer = new MutationObserver(() => { if (lancer()) observer.disconnect(); });
      observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    }
  }
  /** Une étape plus loin (1) ou plus tôt (−1) ; après la dernière, la visite se termine. */
  const avancerVisite = (sens: 1 | -1) => {
    if (!visite) return;
    if (sens < 0) {
      if (visite.k === 0) return;
      visite.k--;
    } else {
      if (visite.k >= etapes().length - 1) return finirVisite();
      visite.k++;
    }
    montrerEtape();
  };
  carte?.addEventListener('click', (e) => {
    const quoi = (e.target as Element).closest<HTMLElement>('[data-visite]')?.dataset.visite;
    if (!visite || !quoi) return;
    if (quoi === 'quitter') return finirVisite();
    if (quoi === 'precedent') avancerVisite(-1);
    if (quoi === 'suivant') avancerVisite(1);
  });
  // Pendant une visite, les flèches ← → passent d'une explication à l'autre (au lieu de changer
  // de section sans elles). On les prend avant le reste du site : phase de capture.
  window.addEventListener(
    'keydown',
    (e) => {
      if (!visite || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable], dialog, [popover]')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) avancerVisite(e.key === 'ArrowRight' ? 1 : -1);
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && visite && !document.querySelector('dialog[open], [popover]:popover-open')) finirVisite();
  });

  // Le changement de langue (sans rechargement) : on relit les textes et ce que sait l'assistant.
  window.addEventListener('langue', () => {
    dernierProjet = null;
    arreterEcoute();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    textes = lireTextes();
    savoir = lireSavoir();
    messages.replaceChildren();
    if (visite) montrerEtape(false);
  });

  // (Seulement pendant le développement : de quoi vérifier l'assistant depuis les recettes.)
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__orbit = { repondre: (q: string) => repondre(q) };
}
