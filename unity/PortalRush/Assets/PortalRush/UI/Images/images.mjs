// Petites images de l'interface Portal Rush (Unity), dessinées par calcul : dégradés et lueurs.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const sortie = process.argv[2];
mkdirSync(sortie, { recursive: true });
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(nom, l, h, pixel) {
  const brut = Buffer.alloc((l * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    brut[y * (l * 4 + 1)] = 0;
    for (let x = 0; x < l; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (l * 4 + 1) + 1 + x * 4;
      brut[o] = r; brut[o + 1] = g; brut[o + 2] = b; brut[o + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(l, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(join(sortie, nom), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(brut, { level: 9 })), bloc('IEND', Buffer.alloc(0))]));
}
const nuit = [3, 6, 12];
const lisse = (t) => t * t * (3 - 2 * t);
// Voile de gauche : les menus lisent à gauche, le décor reste vu à droite.
png('voile-gauche.png', 512, 4, (x) => [...nuit, 0.9 * Math.pow(1 - x / 511, 1.6)]);
// Voile du bas : le pied des menus et le HUD bas.
png('voile-bas.png', 4, 512, (_, y) => [...nuit, 0.92 * Math.pow(y / 511, 1.8)]);
// Voile du haut : la barre et le HUD haut.
png('voile-haut.png', 4, 256, (_, y) => [...nuit, 0.75 * Math.pow(1 - y / 255, 2)]);
// Vignette : les bords de l'image s'assombrissent.
png('vignette.png', 256, 256, (x, y) => { const dx = (x - 127.5) / 127.5, dy = (y - 127.5) / 127.5; const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2); return [...nuit, 0.85 * lisse(Math.max(0, (d - 0.35) / 0.65))]; });
// Lueur ronde blanche (teintée par -unity-background-image-tint-color).
png('lueur.png', 128, 128, (x, y) => { const dx = (x - 63.5) / 63.5, dy = (y - 63.5) / 63.5; const d = Math.sqrt(dx * dx + dy * dy); return [255, 255, 255, d >= 1 ? 0 : Math.exp(-d * d * 4.2) * (1 - d)]; });
// Trait lumineux horizontal (fort au centre, nul aux bouts).
png('trait.png', 256, 4, (x) => { const t = Math.abs(x - 127.5) / 127.5; return [255, 255, 255, Math.pow(1 - t, 1.8)]; });
// Bande lumineuse verticale (fond d'une jauge, d'un faisceau).
png('faisceau.png', 4, 256, (_, y) => { const t = y / 255; return [255, 255, 255, Math.pow(t, 2.2)]; });
console.log('images écrites dans', sortie);
