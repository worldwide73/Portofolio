// PORTAL RUSH — LES MODÈLES IMPORTÉS (V4-H7)
//
// Les vaisseaux (et, plus tard, des modules de décor) sont modélisés dans Blender par des scripts reproductibles
// (outils/assets/*.py) et exportés dans un format binaire compact, « PRM1 », que ce module lit.
// Format (voir outils/assets/commun.py) : « PRM1 » | longueur du JSON (u32) | JSON | blocs alignés sur 4 octets.
// Par maillage : positions int16 ×3 quantifiées dans la boîte du maillage, normales int8 ×4, un indice de matière
// uint8 par sommet (la palette est dans le JSON : couleur sRGB, métal, rugosité, émission, canal), index uint16
// ou uint32. Environ 11 octets par sommet.
// Les attributs produits sont ceux de l'Assembleur (position, normal, couleur linéaire, matiere) : les modèles
// importés passent par les mêmes shaders, ombres et variantes de qualité que le reste de la scène.

import { Geometry } from 'ogl';

type Gl = ConstructorParameters<typeof Geometry>[0];
export type Point = number[];

export interface MaillageImporte {
  nom: string;
  sommets: number;
  triangles: number;
  attributs: { position: Float32Array; normal: Float32Array; couleur: Float32Array; matiere: Float32Array; index: Uint16Array | Uint32Array };
  /** Les points d'ancrage nommés (repère du jeu) : tuyères [x, y, z, rayon], émetteurs, patins… */
  points: Record<string, Point[]>;
  min: number[];
  max: number[];
}

interface Entete {
  nom: string;
  sommets: number;
  index: number;
  idx32: boolean;
  min: number[];
  max: number[];
  pos: number;
  nor: number;
  mat: number;
  idx: number;
  palette: number[][];
  points?: Record<string, Point[]>;
}

/** Décode un fichier PRM1. */
export function lirePrm(tampon: ArrayBuffer): MaillageImporte[] {
  const vue = new DataView(tampon);
  const magie = String.fromCharCode(vue.getUint8(0), vue.getUint8(1), vue.getUint8(2), vue.getUint8(3));
  if (magie !== 'PRM1') throw new Error('Format de modèle inconnu');
  const lj = vue.getUint32(4, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(tampon, 8, lj))) as { maillages: Entete[] };
  const base = 8 + lj;
  return json.maillages.map((e) => {
    const n = e.sommets;
    const q = new Int16Array(tampon, base + e.pos, n * 3);
    const position = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      const k = i % 3;
      position[i] = e.min[k] + ((q[i] + 32768) / 65535) * (e.max[k] - e.min[k]);
    }
    const qn = new Int8Array(tampon, base + e.nor, n * 4);
    const normal = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = qn[i * 4] / 127,
        y = qn[i * 4 + 1] / 127,
        z = qn[i * 4 + 2] / 127;
      const l = Math.hypot(x, y, z) || 1;
      normal[i * 3] = x / l;
      normal[i * 3 + 1] = y / l;
      normal[i * 3 + 2] = z / l;
    }
    // La palette : couleur sRGB → linéaire (ce que l'éclairage calcule), puis métal, rugosité, émission, canal.
    const pal = e.palette.map(([r, g, b, m, ru, em, k]) => [r ** 2.2, g ** 2.2, b ** 2.2, m, ru, em, k]);
    const qm = new Uint8Array(tampon, base + e.mat, n);
    const couleur = new Float32Array(n * 3);
    const matiere = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const p = pal[qm[i]];
      couleur[i * 3] = p[0];
      couleur[i * 3 + 1] = p[1];
      couleur[i * 3 + 2] = p[2];
      matiere[i * 4] = p[3];
      matiere[i * 4 + 1] = p[4];
      matiere[i * 4 + 2] = p[5];
      matiere[i * 4 + 3] = p[6];
    }
    // (Les index sont copiés : la vue d'origine n'est pas forcément alignée pour WebGL.)
    const index = e.idx32 ? new Uint32Array(new Uint32Array(tampon, base + e.idx, e.index)) : new Uint16Array(new Uint16Array(tampon, base + e.idx, e.index));
    return { nom: e.nom, sommets: n, triangles: e.index / 3, attributs: { position, normal, couleur, matiere, index }, points: e.points ?? {}, min: e.min, max: e.max };
  });
}

/** La géométrie OGL d'un maillage importé (mêmes attributs que l'Assembleur, plus l'index). */
export function geometrieImportee(gl: Gl, m: MaillageImporte): Geometry {
  const a = m.attributs;
  return new Geometry(gl, {
    position: { size: 3, data: a.position },
    normal: { size: 3, data: a.normal },
    couleur: { size: 3, data: a.couleur },
    matiere: { size: 4, data: a.matiere },
    index: { data: a.index },
  });
}

const enCours = new Map<string, Promise<MaillageImporte[]>>();
/** Charge (une seule fois) un fichier de modèles de public/rush/modeles/. */
export function chargerModeles(fichier: string): Promise<MaillageImporte[]> {
  let p = enCours.get(fichier);
  if (!p) {
    const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
    p = fetch(`${base}rush/modeles/${fichier}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Modèle introuvable : ${fichier}`);
        return r.arrayBuffer();
      })
      .then(lirePrm);
    // (Un échec n'est pas mémorisé : on pourra réessayer.)
    p.catch(() => enCours.delete(fichier));
    enCours.set(fichier, p);
  }
  return p;
}

/** Les fichiers des quatre vaisseaux (0 Aube, 1 Faucon, 2 Bastion, 3 Spectre). */
export const FICHIERS_VAISSEAUX = ['aube.prm', 'faucon.prm', 'bastion.prm', 'spectre.prm'];
