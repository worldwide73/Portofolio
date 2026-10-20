// Charge le vrai moteur de Portal Rush (TypeScript) dans Node, sans outil de compilation : les trois fichiers
// de la règle (moteur, données, équilibrage) sont copiés dans un dossier temporaire, leurs imports reçoivent
// l'extension « .ts », et Node les exécute avec --experimental-strip-types (Node 22).
// Sert aux exports vers Unity (données, parties de référence) : la source de vérité reste le code du jeu.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
export const RACINE = join(ICI, '..', '..');
const SOURCE = join(RACINE, 'src', 'scripts', 'rush');

export async function chargerCoeur() {
  const dossier = mkdtempSync(join(tmpdir(), 'portal-rush-coeur-'));
  for (const nom of ['moteur', 'donnees', 'equilibrage']) {
    const code = readFileSync(join(SOURCE, `${nom}.ts`), 'utf8').replace(/from '\.\/(moteur|donnees|equilibrage)'/g, "from './$1.ts'");
    writeFileSync(join(dossier, `${nom}.ts`), code);
  }
  const url = (n) => pathToFileURL(join(dossier, `${n}.ts`)).href;
  const [moteur, donnees, equilibrage] = await Promise.all([import(url('moteur')), import(url('donnees')), import(url('equilibrage'))]);
  return { moteur, donnees, equilibrage };
}
