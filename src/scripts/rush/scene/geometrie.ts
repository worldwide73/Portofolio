// PORTAL RUSH 3D — L'ASSEMBLEUR DE MODÈLES
//
// Les modèles du jeu (vaisseau, piste, structures, obstacles) sont construits en
// code, pièce par pièce, puis fusionnés en un seul maillage par objet : un seul
// appel de dessin pour un module entier de station. Chaque sommet porte sa
// couleur et sa matière (métal, rugosité, émission, canal), ce qui permet de
// mélanger métal sombre, verre, alliage éclairé et bandes lumineuses dans un
// même maillage, éclairés par un seul shader (voir materiaux.ts).
//
// Facettes nettes par défaut (le style « surface technique ») ; les formes
// rondes (cylindres, sphères, tores) ont des normales lissées.

import { Geometry } from 'ogl';

export type RGB = [number, number, number];
export type V3 = [number, number, number];
type Gl = ConstructorParameters<typeof Geometry>[0];

/** Les canaux d'une matière : sa couleur vient du sommet, ou d'un réglage du monde. */
export const CANAL = { fixe: 0, peinture: 1, accent: 2, accent2: 3, danger: 4, coeur: 5, ligne: 6, fissure: 7, clignote: 8, peinture2: 9 } as const;

/**
 * Une matière. c : couleur sRGB (0 à 1) ; m : métal ; r : rugosité ; e : émission
 * (la couleur rayonne, même dans l'ombre) ; k : canal (voir CANAL).
 */
export interface Matiere {
  c: RGB;
  m: number;
  r: number;
  e: number;
  k?: number;
}

export const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
/** De sRGB (ce que l'on choisit) à linéaire (ce que l'éclairage calcule). */
export const lineaire = (c: RGB): RGB => [c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2];
export const mat = (c: string | RGB, m: number, r: number, e = 0, k = 0): Matiere => ({ c: typeof c === 'string' ? hex(c) : c, m, r, e, k });

// ---- Matrices 4×4 (colonnes), le strict nécessaire ----
type M = Float32Array;
const identite = (): M => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function multiplier(a: M, b: M): M {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

const sous = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const croix = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normer = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export class Assembleur {
  private p: number[] = [];
  private n: number[] = [];
  private c: number[] = [];
  private m: number[] = [];
  private t: M = identite();
  private pile: M[] = [];

  get sommets(): number {
    return this.p.length / 3;
  }

  // ---- Le repère courant : on place une pièce en déplaçant le repère ----
  pousser(): this {
    this.pile.push(this.t);
    return this;
  }
  retirer(): this {
    this.t = this.pile.pop() ?? identite();
    return this;
  }
  deplacer(x: number, y: number, z: number): this {
    const d = identite();
    d[12] = x;
    d[13] = y;
    d[14] = z;
    this.t = multiplier(this.t, d);
    return this;
  }
  echelle(x: number, y = x, z = x): this {
    const d = identite();
    d[0] = x;
    d[5] = y;
    d[10] = z;
    this.t = multiplier(this.t, d);
    return this;
  }
  /** Rotations en radians, appliquées dans l'ordre Y, X, Z. */
  tourner(rx: number, ry = 0, rz = 0): this {
    if (ry) {
      const c = Math.cos(ry),
        s = Math.sin(ry);
      this.t = multiplier(this.t, new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]));
    }
    if (rx) {
      const c = Math.cos(rx),
        s = Math.sin(rx);
      this.t = multiplier(this.t, new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]));
    }
    if (rz) {
      const c = Math.cos(rz),
        s = Math.sin(rz);
      this.t = multiplier(this.t, new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    }
    return this;
  }

  private point(v: V3): V3 {
    const t = this.t;
    return [t[0] * v[0] + t[4] * v[1] + t[8] * v[2] + t[12], t[1] * v[0] + t[5] * v[1] + t[9] * v[2] + t[13], t[2] * v[0] + t[6] * v[1] + t[10] * v[2] + t[14]];
  }
  private direction(v: V3): V3 {
    // (Échelles presque toujours uniformes ici : la partie 3×3 suffit, renormalisée.)
    const t = this.t;
    return normer([t[0] * v[0] + t[4] * v[1] + t[8] * v[2], t[1] * v[0] + t[5] * v[1] + t[9] * v[2], t[2] * v[0] + t[6] * v[1] + t[10] * v[2]]);
  }
  private sommet(v: V3, n: V3, q: Matiere) {
    this.p.push(v[0], v[1], v[2]);
    this.n.push(n[0], n[1], n[2]);
    const l = lineaire(q.c);
    this.c.push(l[0], l[1], l[2]);
    this.m.push(q.m, q.r, q.e, q.k ?? 0);
  }

  /**
   * (V4-H7) Ajoute un maillage importé (modèle Blender, voir assets.ts) dans le repère courant. Un repère en miroir
   * (échelle négative) retourne l'ordre des sommets pour garder les faces vers l'extérieur.
   */
  importer(
    m: { attributs: { position: Float32Array; normal: Float32Array; couleur: Float32Array; matiere: Float32Array; index: ArrayLike<number> } },
    /** Facultatif : une matière qui remplace celle du modèle, selon la normale locale du sommet (recolorer). */
    remplacer?: (n: V3) => Matiere,
  ): this {
    const a = m.attributs;
    const t = this.t;
    const det = t[0] * (t[5] * t[10] - t[9] * t[6]) - t[4] * (t[1] * t[10] - t[9] * t[2]) + t[8] * (t[1] * t[6] - t[5] * t[2]);
    const ordre = det < 0 ? [0, 2, 1] : [0, 1, 2];
    const idx = a.index;
    for (let f = 0; f < idx.length; f += 3)
      for (const o of ordre) {
        const i = idx[f + o];
        const p = this.point([a.position[i * 3], a.position[i * 3 + 1], a.position[i * 3 + 2]]);
        const n = this.direction([a.normal[i * 3], a.normal[i * 3 + 1], a.normal[i * 3 + 2]]);
        this.p.push(p[0], p[1], p[2]);
        this.n.push(n[0], n[1], n[2]);
        if (remplacer) {
          const q = remplacer([a.normal[i * 3], a.normal[i * 3 + 1], a.normal[i * 3 + 2]]);
          const l = lineaire(q.c);
          this.c.push(l[0], l[1], l[2]);
          this.m.push(q.m, q.r, q.e, q.k ?? 0);
          continue;
        }
        this.c.push(a.couleur[i * 3], a.couleur[i * 3 + 1], a.couleur[i * 3 + 2]);
        this.m.push(a.matiere[i * 4], a.matiere[i * 4 + 1], a.matiere[i * 4 + 2], a.matiere[i * 4 + 3]);
      }
    return this;
  }

  // ---- Les faces ----
  /** Un triangle à facette nette (la normale suit la facette). */
  tri(a: V3, b: V3, c: V3, q: Matiere): this {
    const A = this.point(a),
      B = this.point(b),
      C = this.point(c);
    const n = normer(croix(sous(B, A), sous(C, A)));
    this.sommet(A, n, q);
    this.sommet(B, n, q);
    this.sommet(C, n, q);
    return this;
  }
  quad(a: V3, b: V3, c: V3, d: V3, q: Matiere): this {
    return this.tri(a, b, c, q).tri(a, c, d, q);
  }
  /** Un triangle aux normales lissées (formes rondes). */
  triLisse(a: V3, b: V3, c: V3, na: V3, nb: V3, nc: V3, q: Matiere): this {
    this.sommet(this.point(a), this.direction(na), q);
    this.sommet(this.point(b), this.direction(nb), q);
    this.sommet(this.point(c), this.direction(nc), q);
    return this;
  }

  // ---- Les volumes ----
  /** Un pavé centré en (x, y, z), de dimensions (l, h, p). « b » : chanfrein des arêtes le long de z. */
  boite(x: number, y: number, z: number, l: number, h: number, p: number, q: Matiere, b = 0): this {
    const L = l / 2,
      H = h / 2;
    const profil: [number, number][] = b > 0 ? [[-L + b, -H], [L - b, -H], [L, -H + b], [L, H - b], [L - b, H], [-L + b, H], [-L, H - b], [-L, -H + b]] : [[-L, -H], [L, -H], [L, H], [-L, H]];
    this.pousser().deplacer(x, y, z);
    this.prisme(profil, -p / 2, p / 2, q);
    return this.retirer();
  }
  /** Extrude un profil (polygone convexe dans le plan XY) de z0 à z1, avec ses deux faces. */
  prisme(profil: [number, number][], z0: number, z1: number, q: Matiere, faces = true, qFaces = q): this {
    const n = profil.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = profil[i];
      const [x1, y1] = profil[(i + 1) % n];
      this.quad([x0, y0, z1], [x1, y1, z1], [x1, y1, z0], [x0, y0, z0], q);
    }
    if (faces)
      for (let i = 1; i < n - 1; i++) {
        this.tri([profil[0][0], profil[0][1], z1], [profil[i + 1][0], profil[i + 1][1], z1], [profil[i][0], profil[i][1], z1], qFaces);
        this.tri([profil[0][0], profil[0][1], z0], [profil[i][0], profil[i][1], z0], [profil[i + 1][0], profil[i + 1][1], z0], qFaces);
      }
    return this;
  }
  /** Un cylindre (ou tronc de cône) vertical, de y0 à y1. */
  cylindre(r0: number, r1: number, y0: number, y1: number, seg: number, q: Matiere, couvercles = true, lisse = true): this {
    const pente = (r0 - r1) / (y1 - y0);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2,
        a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0),
        s0 = Math.sin(a0),
        c1 = Math.cos(a1),
        s1 = Math.sin(a1);
      const A: V3 = [c0 * r0, y0, s0 * r0],
        B: V3 = [c1 * r0, y0, s1 * r0],
        C: V3 = [c1 * r1, y1, s1 * r1],
        D: V3 = [c0 * r1, y1, s0 * r1];
      if (lisse) {
        const n0 = normer([c0, pente, s0]),
          n1 = normer([c1, pente, s1]);
        this.triLisse(A, C, B, n0, n1, n1, q).triLisse(A, D, C, n0, n0, n1, q);
      } else this.quad(A, D, C, B, q);
      if (couvercles) {
        this.tri([0, y1, 0], C, D, q);
        this.tri([0, y0, 0], A, B, q);
      }
    }
    return this;
  }
  /** Un tore dans le plan XY (son axe est z) : anneaux, portails, cadres ronds. */
  tore(R: number, r: number, segA: number, segB: number, q: Matiere, debut = 0, fin = Math.PI * 2): this {
    const pt = (a: number, b: number): [V3, V3] => {
      const ca = Math.cos(a),
        sa = Math.sin(a),
        cb = Math.cos(b),
        sb = Math.sin(b);
      return [
        [(R + r * cb) * ca, (R + r * cb) * sa, r * sb],
        [cb * ca, cb * sa, sb],
      ];
    };
    for (let i = 0; i < segA; i++) {
      const a0 = debut + ((fin - debut) * i) / segA,
        a1 = debut + ((fin - debut) * (i + 1)) / segA;
      for (let j = 0; j < segB; j++) {
        const b0 = (j / segB) * Math.PI * 2,
          b1 = ((j + 1) / segB) * Math.PI * 2;
        const [A, nA] = pt(a0, b0),
          [B, nB] = pt(a1, b0),
          [C, nC] = pt(a1, b1),
          [D, nD] = pt(a0, b1);
        this.triLisse(A, B, C, nA, nB, nC, q).triLisse(A, C, D, nA, nC, nD, q);
      }
    }
    return this;
  }
  /** Une sphère (icosaèdre subdivisé). « relief » déforme le rayon : rochers, astéroïdes. Facettes nettes si « net ». */
  sphere(r: number, sub: number, q: Matiere, relief?: (v: V3) => number, net = false, qRelief?: (v: V3) => Matiere): this {
    const t = (1 + Math.sqrt(5)) / 2;
    let v: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => normer(p as V3));
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < sub; s++) {
      const cache = new Map<string, number>();
      const milieu = (a: number, b: number) => {
        const cle = a < b ? `${a}-${b}` : `${b}-${a}`;
        let i = cache.get(cle);
        if (i === undefined) {
          v.push(normer([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]));
          i = v.length - 1;
          cache.set(cle, i);
        }
        return i;
      };
      const g: number[][] = [];
      for (const [a, b, c] of f) {
        const ab = milieu(a, b),
          bc = milieu(b, c),
          ca = milieu(c, a);
        g.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      f = g;
    }
    const rayon = v.map((p) => r * (relief ? relief(p) : 1));
    const pos = v.map((p, i): V3 => [p[0] * rayon[i], p[1] * rayon[i], p[2] * rayon[i]]);
    // (V4-H) Un relief sans « net » est lissé : les normales de chaque sommet sont la moyenne de celles des faces
    // qui le touchent (la roche paraît ronde ; la texture « brute » lui donne ensuite ses fissures).
    let lisses: V3[] | null = null;
    if (relief && !net) {
      const somme = pos.map((): V3 => [0, 0, 0]);
      for (const [a, b, c] of f) {
        const n = croix(sous(pos[b], pos[a]), sous(pos[c], pos[a]));
        for (const i of [a, b, c]) {
          somme[i][0] += n[0];
          somme[i][1] += n[1];
          somme[i][2] += n[2];
        }
      }
      lisses = somme.map((n) => normer(n));
    }
    for (const [a, b, c] of f) {
      const qq = qRelief ? qRelief(normer([v[a][0] + v[b][0] + v[c][0], v[a][1] + v[b][1] + v[c][1], v[a][2] + v[b][2] + v[c][2]])) : q;
      if (net) this.tri(pos[a], pos[b], pos[c], qq);
      else if (lisses) this.triLisse(pos[a], pos[b], pos[c], lisses[a], lisses[b], lisses[c], qq);
      else this.triLisse(pos[a], pos[b], pos[c], v[a], v[b], v[c], qq);
    }
    return this;
  }
  /**
   * Une coque par sections : chaque section est un polygone (même nombre de points)
   * placé à une profondeur z. Les sections sont reliées par des facettes nettes.
   */
  coque(sections: { z: number; pts: [number, number][] }[], q: Matiere, fermer = true, qPar?: (i: number, j: number) => Matiere): this {
    const n = sections[0].pts.length;
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i],
        b = sections[i + 1];
      for (let j = 0; j < n; j++) {
        const k = (j + 1) % n;
        const qq = qPar ? qPar(i, j) : q;
        this.quad([a.pts[j][0], a.pts[j][1], a.z], [a.pts[k][0], a.pts[k][1], a.z], [b.pts[k][0], b.pts[k][1], b.z], [b.pts[j][0], b.pts[j][1], b.z], qq);
      }
    }
    if (fermer)
      for (const s of [sections[0], sections[sections.length - 1]])
        for (let j = 1; j < n - 1; j++) this.tri([s.pts[0][0], s.pts[0][1], s.z], [s.pts[j][0], s.pts[j][1], s.z], [s.pts[j + 1][0], s.pts[j + 1][1], s.z], q);
    return this;
  }
  /** Un panneau plat (rectangle dans le plan XY, tourné vers +z). */
  panneau(x: number, y: number, z: number, l: number, h: number, q: Matiere): this {
    return this.quad([x - l / 2, y - h / 2, z], [x + l / 2, y - h / 2, z], [x + l / 2, y + h / 2, z], [x - l / 2, y + h / 2, z], q);
  }
  /** Une poutre entre deux points (section carrée de côté « e »). */
  poutre(a: V3, b: V3, e: number, q: Matiere): this {
    const d = sous(b, a);
    const l = Math.hypot(d[0], d[1], d[2]);
    const ry = Math.atan2(d[0], d[2]);
    const rx = -Math.asin(d[1] / l);
    this.pousser().deplacer(a[0], a[1], a[2]).tourner(0, ry).tourner(rx);
    this.boite(0, 0, l / 2, e, e, l, q);
    return this.retirer();
  }

  /** Fusionne tout en une géométrie OGL (null si rien n'a été construit). */
  geometrie(gl: Gl): Geometry | null {
    if (!this.p.length) return null;
    return new Geometry(gl, {
      position: { size: 3, data: new Float32Array(this.p) },
      normal: { size: 3, data: new Float32Array(this.n) },
      couleur: { size: 3, data: new Float32Array(this.c) },
      matiere: { size: 4, data: new Float32Array(this.m) },
    });
  }
}

// ==========================================================================
// LES HALOS : des quads tournés vers la caméra (qui regarde vers -z), en additif
// ==========================================================================
export class Halos {
  private p: number[] = [];
  private uv: number[] = [];
  private c: number[] = [];
  /** Un halo en (x, y, z), de rayon r, de couleur c (sRGB) et d'intensité i. Allongé si « etire » > 1. */
  ajouter(x: number, y: number, z: number, r: number, c: RGB, i = 1, etire = 1): this {
    const l = lineaire(c);
    const coins: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (const [u, v] of coins) {
      this.p.push(x + u * r * etire, y + v * r, z);
      this.uv.push(u, v);
      this.c.push(l[0] * i, l[1] * i, l[2] * i);
    }
    return this;
  }
  geometrie(gl: Gl): Geometry | null {
    if (!this.p.length) return null;
    return new Geometry(gl, {
      position: { size: 3, data: new Float32Array(this.p) },
      uv: { size: 2, data: new Float32Array(this.uv) },
      couleur: { size: 3, data: new Float32Array(this.c) },
    });
  }
}
