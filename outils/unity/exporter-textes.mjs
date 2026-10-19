// PORTAL RUSH → UNITY : LES TEXTES DU JEU EN C#
//
// Écrit unity/PortalRush/Assets/PortalRush/Scripts/Interface/Textes.Generees.cs à partir des vrais textes du jeu
// web (src/contenu/fr.ts et en.ts, partie « rush », plus les quelques textes du portfolio que l'interface Unity
// reprend) : ainsi les deux versions disent exactement la même chose, sans recopie à la main. Les clés sont les
// chemins dans « rush » (« menu.continuer », « tutoriel.phases.0.titre », « garage.pieces.coque-givre »…).
// Les textes propres à l'interface Unity (qui n'existent pas dans le jeu web) sont écrits à la main dans
// Scripts/Interface/Textes.cs (dictionnaires NouveauxFr et NouveauxEn, clés « ui.… »).
//
// Utilisation : node --experimental-strip-types --no-warnings outils/unity/exporter-textes.mjs [--verifier]
// --verifier : n'écrit rien, échoue (code 1) si le fichier C# n'est plus à jour, si une clé employée par le code
// de l'interface n'existe pas, si un texte nouveau manque dans une langue, ou si une police de l'interface
// n'a pas un caractère des textes.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INTERFACE = join(RACINE, 'unity', 'PortalRush', 'Assets', 'PortalRush', 'Scripts', 'Interface');
const SORTIE = join(INTERFACE, 'Textes.Generees.cs');
const NOUVEAUX = join(INTERFACE, 'Textes.cs');
const POLICES = join(RACINE, 'unity', 'PortalRush', 'Assets', 'PortalRush', 'UI', 'Polices');

const charger = async (langue) => (await import(pathToFileURL(join(RACINE, 'src', 'contenu', `${langue}.ts`)).href))[langue];
const fr = await charger('fr');
const en = await charger('en');

/** Aplatit un objet de textes : { a: { b: 'x' }, l: ['y'] } → { 'a.b': 'x', 'l.0': 'y' }, et retient la taille des listes. */
function aplatir(objet, prefixe, textes, tailles) {
  if (Array.isArray(objet)) {
    tailles[prefixe.slice(0, -1)] = objet.length;
    objet.forEach((v, i) => aplatir(v, `${prefixe}${i}.`, textes, tailles));
  } else if (objet && typeof objet === 'object') {
    for (const [cle, v] of Object.entries(objet)) aplatir(v, `${prefixe}${cle}.`, textes, tailles);
  } else if (typeof objet === 'string') textes[prefixe.slice(0, -1)] = objet;
  else throw new Error(`Texte inattendu (${typeof objet}) pour ${prefixe}`);
}
/** Les textes repris : tout « rush », et ce que l'interface Unity emprunte au portfolio (préfixe « site. »). */
function textesDe(c) {
  const textes = {};
  const tailles = {};
  aplatir(c.rush, '', textes, tailles);
  aplatir({ radio: { muet: c.radio.muet, reactiver: c.radio.reactiver } }, 'site.', textes, tailles);
  return { textes, tailles };
}
const FR = textesDe(fr);
const EN = textesDe(en);
const manquants = [...Object.keys(FR.textes).filter((k) => !(k in EN.textes)), ...Object.keys(EN.textes).filter((k) => !(k in FR.textes))];
if (manquants.length) {
  console.error('Clés présentes dans une seule langue :', manquants.join(', '));
  process.exit(1);
}

const chaine = (s) =>
  `"${s.replace(/[\\"\u0000-\u001f]/g, (c) => (c === '\\' ? '\\\\' : c === '"' ? '\\"' : c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`))}"`;
const dictionnaire = (nom, t) => `    static readonly Dictionary<string, string> ${nom} = new Dictionary<string, string>
    {
${Object.entries(t)
  .map(([k, v]) => `      { ${chaine(k)}, ${chaine(v)} },`)
  .join('\n')}
    };`;
const tailles = (nom, t) => `    static readonly Dictionary<string, int> ${nom} = new Dictionary<string, int>
    {
${Object.entries(t)
  .map(([k, v]) => `      { ${chaine(k)}, ${v} },`)
  .join('\n')}
    };`;

const code = `// FICHIER GÉNÉRÉ par outils/unity/exporter-textes.mjs à partir de src/contenu/fr.ts et en.ts (textes de Portal Rush).
// NE PAS MODIFIER À LA MAIN : changer les textes du jeu web, puis relancer l'export. Les textes propres à
// l'interface Unity sont dans Textes.cs. Clés : chemin dans « rush » (ex. « menu.continuer »).
#nullable enable
using System.Collections.Generic;

namespace PortalRush.Interface
{
  public static partial class Textes
  {
${dictionnaire('WebFr', FR.textes)}

${dictionnaire('WebEn', EN.textes)}

    /** La longueur des listes (ex. « commandes.lignes »), par langue. */
${tailles('TaillesFr', FR.tailles)}

${tailles('TaillesEn', EN.tailles)}
  }
}
`;

// ---- Les textes nouveaux (Textes.cs) : leurs clés, dans les deux langues ----
function lireNouveaux() {
  if (!existsSync(NOUVEAUX)) return { fr: {}, en: {} };
  const source = readFileSync(NOUVEAUX, 'utf8');
  const bloc = (nom) => {
    const debut = source.indexOf(`Dictionary<string, string> ${nom}`);
    if (debut < 0) return {};
    const fin = source.indexOf('};', debut);
    const t = {};
    for (const m of source.slice(debut, fin).matchAll(/\{\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\}/g)) t[m[1]] = JSON.parse(`"${m[2]}"`);
    return t;
  };
  return { fr: bloc('NouveauxFr'), en: bloc('NouveauxEn') };
}

// ---- Les clés employées par le code de l'interface ----
function fichiersCs(dossier) {
  const liste = [];
  if (!existsSync(dossier)) return liste;
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) liste.push(...fichiersCs(chemin));
    else if (nom.endsWith('.cs') && nom !== 'Textes.Generees.cs') liste.push(chemin);
  }
  return liste;
}
function verifierCles(nouveaux) {
  const erreurs = [];
  const connues = new Set([...Object.keys(FR.textes), ...Object.keys(nouveaux.fr), ...Object.keys(FR.tailles)]);
  for (const k of Object.keys(nouveaux.fr)) if (!(k in nouveaux.en)) erreurs.push(`texte nouveau sans anglais : ${k}`);
  for (const k of Object.keys(nouveaux.en)) if (!(k in nouveaux.fr)) erreurs.push(`texte nouveau sans français : ${k}`);
  let litterales = 0;
  let calculees = 0;
  for (const f of fichiersCs(INTERFACE)) {
    const source = readFileSync(f, 'utf8');
    for (const m of source.matchAll(/\b(?:Textes\.)?(?:De|Taille|Remplir)\(\s*(\$?)"((?:[^"\\]|\\.)*)"/g)) {
      const [, interpole, cle] = m;
      if (!interpole) {
        litterales++;
        if (!connues.has(cle)) erreurs.push(`${relative(RACINE, f)} : clé inconnue « ${cle} »`);
      } else {
        // Une clé calculée ($"difficultes.{d}.nom") : au moins une clé connue doit lui correspondre.
        calculees++;
        const motif = new RegExp(`^${cle.split(/\{[^}]*\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^.]+')}$`);
        if (![...connues].some((k) => motif.test(k))) erreurs.push(`${relative(RACINE, f)} : aucune clé pour « ${cle} »`);
      }
    }
  }
  return { erreurs, litterales, calculees };
}

// ---- Les polices de l'interface ont-elles tous les caractères des textes ? ----
function caracteres(buf) {
  const u16 = (o) => buf.readUInt16BE(o);
  const u32 = (o) => buf.readUInt32BE(o);
  let cmap = -1;
  for (let i = 0; i < u16(4); i++) if (buf.toString('latin1', 12 + i * 16, 16 + i * 16) === 'cmap') cmap = u32(12 + i * 16 + 8);
  const ensemble = new Set();
  for (let i = 0; i < u16(cmap + 2); i++) {
    const t = cmap + u32(cmap + 4 + i * 8 + 4);
    const format = u16(t);
    if (format === 4) {
      const n = u16(t + 6) / 2;
      const fins = t + 14;
      const debuts = fins + n * 2 + 2;
      const deltas = debuts + n * 2;
      const decalages = deltas + n * 2;
      for (let s = 0; s < n; s++) {
        const fin = u16(fins + s * 2);
        const debut = u16(debuts + s * 2);
        const delta = buf.readInt16BE(deltas + s * 2);
        const dec = u16(decalages + s * 2);
        for (let c = debut; c <= fin && c !== 0xffff; c++) {
          const g = dec === 0 ? (c + delta) & 0xffff : u16(decalages + s * 2 + dec + (c - debut) * 2);
          if (g) ensemble.add(c);
        }
      }
    } else if (format === 12) {
      for (let k = 0; k < u32(t + 12); k++) for (let c = u32(t + 16 + k * 12); c <= u32(t + 20 + k * 12); c++) ensemble.add(c);
    }
  }
  return ensemble;
}
function verifierPolices(nouveaux) {
  const erreurs = [];
  if (!existsSync(POLICES)) return { erreurs: ['dossier UI/Polices absent'], polices: 0 };
  const tout = [...Object.values(FR.textes), ...Object.values(EN.textes), ...Object.values(nouveaux.fr), ...Object.values(nouveaux.en)].join('');
  const utiles = [...new Set([...tout].map((c) => c.codePointAt(0)))].filter((c) => c > 32);
  const polices = readdirSync(POLICES).filter((n) => /\.(ttf|otf)$/i.test(n));
  for (const nom of polices) {
    const presents = caracteres(readFileSync(join(POLICES, nom)));
    const absents = utiles.filter((c) => !presents.has(c));
    if (absents.length) erreurs.push(`${nom} n'a pas : ${absents.map((c) => `${String.fromCodePoint(c)} (U+${c.toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}`);
  }
  return { erreurs, polices: polices.length };
}

const nouveaux = lireNouveaux();
if (process.argv.includes('--verifier')) {
  const aJour = existsSync(SORTIE) && readFileSync(SORTIE, 'utf8') === code;
  const cles = verifierCles(nouveaux);
  const polices = verifierPolices(nouveaux);
  console.log(aJour ? 'Textes C# à jour.' : 'Textes C# PÉRIMÉS : relancer outils/unity/exporter-textes.mjs.');
  console.log(`Clés du code : ${cles.litterales} écrites, ${cles.calculees} calculées ; textes nouveaux : ${Object.keys(nouveaux.fr).length} (FR) / ${Object.keys(nouveaux.en).length} (EN).`);
  console.log(`Polices vérifiées : ${polices.polices}.`);
  for (const e of [...cles.erreurs, ...polices.erreurs]) console.log('  ✗', e);
  process.exit(aJour && !cles.erreurs.length && !polices.erreurs.length ? 0 : 1);
}
writeFileSync(SORTIE, code);
console.log('→', SORTIE, `(${Object.keys(FR.textes).length} textes par langue)`);
