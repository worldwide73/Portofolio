// ============================================================================
// SHADER DE LA LAME DE VERRE
// La lame est une lentille. Elle dévie la lumière qui la traverse : on y voit
// le paysage décalé et légèrement adouci. Le rouge, le vert et le bleu ne sont
// pas déviés du même angle (comme dans un prisme), d'où les franges colorées
// sur les bords. Et à travers elle, le relief apparaît en lignes de niveau :
// c'est l'instrument qui « lit » le paysage.
// ============================================================================

in vec3 vNormale;
in vec3 vTangente;
in vec3 vBitangente;
in vec3 vPosVue;
in vec2 vUv;
in float vFace;

uniform float uOpacite;

out vec4 couleur;

// Les six destinations de la carte du portail (cinq sections et le CV), sur la
// face : x vers la droite, y vers le haut, de -0.5 à 0.5. Ce sont les places
// des étoiles de la carte (src/components/Explorateur.astro).
const vec2 DESTINATIONS[6] = vec2[6](
  vec2(-0.20, 0.41), vec2(0.19, 0.26), vec2(-0.17, 0.09),
  vec2(0.20, -0.07), vec2(-0.18, -0.24), vec2(0.18, -0.40)
);

void main() {
  vec2 c = vUv - 0.5;   // position sur la face, centrée : de -0.5 à 0.5

  // Biseau : près des arêtes, la normale bascule vers l'extérieur, comme sur
  // un verre poli. On ajoute une légère courbure de lentille au centre.
  vec2 biseau = smoothstep(vec2(0.44), vec2(0.5), abs(c)) * sign(c);
  vec3 N = normalize(vNormale + vTangente * (biseau.x * 1.1 + c.x * 0.5) + vBitangente * (biseau.y * 1.1 + c.y * 0.5));
  vec3 V = normalize(-vPosVue);   // direction du pixel vers l'œil
  vec3 I = -V;                    // rayon qui arrive sur le verre

  // Fresnel : un verre réfléchit davantage quand on le regarde en biais.
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);

  // Réfraction : trois indices légèrement différents pour le rouge, le vert, le bleu.
  vec2 px = gl_FragCoord.xy;
  vec2 suv = px / uRes;
  vec2 force = vec2(0.105 * uRes.y / uRes.x, 0.105);
  vec2 dR = refract(I, N, 1.0 / 1.40).xy * force;
  vec2 dV = refract(I, N, 1.0 / 1.46).xy * force;
  vec2 dB = refract(I, N, 1.0 / 1.52).xy * force;

  // Le paysage vu à travers : une lecture par couleur, un peu adoucie.
  float flou = 1.1 + 2.0 * max(abs(biseau.x), abs(biseau.y));
  vec3 vu = vec3(scene(suv + dR, flou).r, scene(suv + dV, flou).g, scene(suv + dB, flou).b);
  float lignes = isolignes(suv + dV);

  // Arête : un filet d'un pixel sur le contour de chaque face.
  float bord = max(abs(c.x), abs(c.y));
  float lb = fwidth(bord);
  float arete = smoothstep(0.5 - 2.0 * lb, 0.5 - 0.75 * lb, bord);

  // Reflet : une bande de lumière qui traverse la lame quand elle tourne.
  vec3 R = reflect(I, N);
  float reflet = smoothstep(0.20, 0.0, abs(R.x + 0.22)) * smoothstep(1.0, 0.1, abs(R.y));

  // Le verre concentre la lumière : l'image est plus claire et plus froide dedans.
  // On comprime d'abord les hautes lumières pour que l'aube ne « brûle » pas en blanc.
  vu = vu / (1.0 + 0.8 * vu);
  vec3 col = vu * vec3(1.42, 1.52, 1.74) + vec3(0.020, 0.028, 0.050);
  col += vec3(0.030, 0.042, 0.075) * smoothstep(-0.5, 0.5, c.y);   // un voile, plus dense vers le haut
  col += lignes * vec3(0.80, 0.90, 1.0) * 0.34;
  col += (1.0 - vFace) * vec3(0.18, 0.23, 0.32);                   // la tranche, plus lumineuse
  col += arete * vec3(0.66, 0.76, 0.96) * (0.4 + 0.6 * vFace) * (1.0 + 2.2 * uEnergie);   // le contour, plus vif sous énergie
  col += fresnel * vec3(0.55, 0.68, 0.98) * 0.62;
  col += reflet * vec3(0.81, 0.88, 1.0) * 0.20 * vFace;

  // Sous énergie : un reflet balaie la surface en diagonale, et le bas s'illumine.
  float balayage = fract(uTemps * 0.55);
  float bande = exp(-pow((c.x * 0.6 + c.y - (balayage * 2.4 - 1.2)) / 0.07, 2.0));
  col += bande * vec3(0.75, 0.86, 1.0) * 0.30 * uEnergie * vFace;
  col += vec3(0.30, 0.48, 0.90) * smoothstep(0.1, -0.5, c.y) * 0.22 * uEnergie * vFace;

  // Le scanner (survol) : une ligne descend le long de la lame et réveille,
  // derrière elle, six points lumineux. Ce sont les destinations de la carte
  // qui s'ouvre au clic, aux mêmes places. Quand le curseur s'en va, uScan
  // revient à 0 : la ligne remonte et les éteint.
  if (uScan > 0.001) {
    float hauteurFace = c.y + 0.5;               // 0 en bas de la face, 1 en haut
    float ligneScan = 1.08 - uScan * 1.2;        // la ligne part du haut et sort par le bas
    float presence = sin(uScan * 3.14159);       // elle n'est visible que pendant sa course
    float traitScan = exp(-pow((hauteurFace - ligneScan) / 0.009, 2.0));
    float sillage = smoothstep(0.16, 0.0, hauteurFace - ligneScan) * step(ligneScan, hauteurFace);
    col += (traitScan * 0.5 + sillage * 0.09) * presence * vec3(0.72, 0.86, 1.0) * vFace;
    for (int k = 0; k < 6; k++) {
      vec2 p = DESTINATIONS[k];
      float allume = smoothstep(0.0, 0.07, (p.y + 0.5) - ligneScan);   // la ligne l'a dépassé
      float d = length((c - p) * vec2(1.15, 1.9));
      float scintille = 0.8 + 0.2 * sin(uTemps * 2.6 + float(k) * 1.7);
      float lumiere = exp(-d * d / 0.00016) * 1.1 + exp(-d * d / 0.0035) * 0.16;   // le point, et son halo
      col += lumiere * allume * scintille * min(1.0, uScan * 2.0) * vec3(0.84, 0.92, 1.0) * vFace;
    }
  }

  // Les fissures : un impact dans du verre. Des cassures rayonnent depuis le
  // point touché ; d'autres, en arcs brisés, les relient comme une toile. Elles
  // gagnent la surface avec uFissure. Chaque éclat ainsi découpé prend une
  // teinte un peu différente : il ne renvoie plus la lumière comme ses voisins.
  vec2 depuisImpact = (vUv - uImpact) * vec2(1.15, 1.9);   // en unités de la lame, pour que la toile ne soit pas écrasée
  float eloigne = length(depuisImpact);
  float autour = atan(depuisImpact.y, depuisImpact.x);
  // « rayon » compte les cassures rayonnantes : elles ne sont ni régulières, ni tout à fait droites.
  const float CASSURES = 13.0;
  float rayon = autour / 6.28318 * CASSURES + 0.36 * sin(autour * 3.0 + 1.3) + 0.21 * sin(autour * 7.0 + 0.4) + 0.05 * sin(eloigne * 13.0 + autour * 2.0);
  float numero = floor(rayon);
  float versCassure = min(fract(rayon), 1.0 - fract(rayon)) / CASSURES * 6.28318 * eloigne;   // distance à la cassure la plus proche
  // Le front avance avec uFissure ; chaque cassure s'arrête à sa propre distance.
  float front = uFissure * 2.5;
  float portee = front * (0.62 + 0.7 * semis(vec2(floor(rayon + 0.5), 1.0)).x);
  float rayonnante = (1.0 - smoothstep(0.0, 0.005 + 0.003 * eloigne, versCassure)) * step(eloigne, portee);
  // Les arcs : dans chaque secteur, à des distances qui lui sont propres. Certains manquent.
  float palier = eloigne * 3.4 + semis(vec2(numero, 3.0)).x * 0.9;
  float versArc = min(fract(palier), 1.0 - fract(palier)) / 3.4;
  float existe = step(0.3, semis(vec2(numero, floor(palier + 0.5))).y) * step(eloigne, front - 0.2);
  float arc = (1.0 - smoothstep(0.0, 0.005, versArc)) * existe;
  float cassures = max(rayonnante, arc) * vFace;
  // Autour de chaque cassure, une lueur ; au point d'impact, le verre pilé.
  float lueurCassures = max((1.0 - smoothstep(0.0, 0.03, versCassure)) * step(eloigne, portee), (1.0 - smoothstep(0.0, 0.025, versArc)) * existe) * vFace;
  float pile = exp(-eloigne * eloigne / 0.006) * smoothstep(0.0, 0.3, uFissure) * vFace;
  col += cassures * vec3(0.86, 0.93, 1.0) * (0.7 + 1.0 * uFissure);
  col += lueurCassures * vec3(0.45, 0.62, 1.0) * 0.16 * uFissure;
  col += pile * vec3(0.8, 0.9, 1.0) * 0.55;
  // Les éclats déjà découpés : chacun sa teinte.
  float decoupe = step(eloigne, front - 0.1) * smoothstep(0.25, 0.9, uFissure) * vFace;
  col += (semis(vec2(numero, floor(palier))).y - 0.5) * 0.2 * decoupe;
  // De fines fêlures, près de l'impact, quand le verre est près de rompre.
  float fines = 1.0 - smoothstep(0.0, 0.05, versFissure(depuisImpact * 9.0 + 9.0));
  col += fines * vec3(0.8, 0.9, 1.0) * 0.45 * smoothstep(0.55, 1.0, uFissure) * exp(-eloigne * 2.2) * vFace;

  // La rupture : un éclair blanc bleuté.
  col += vec3(0.85, 0.92, 1.0) * uEclat * 1.6;

  col *= smoothstep(0.0, 0.6, uReveal) * (1.0 - 0.35 * uSortie);
  col += (grain(px, uTemps) - 0.5) * 0.03;

  // La construction du portail (introduction) : le contour monte d'abord, de
  // bas en haut ; le verre se remplit ensuite derrière une ligne de balayage.
  // Quand uConstruit vaut 1 (tout le reste du temps), ce passage ne change rien.
  float hauteur = c.y + 0.5;                                    // 0 en bas de la face, 1 en haut
  float contourVu = step(hauteur, uConstruit * 1.7);
  float niveau = uConstruit * 1.7 - 0.55;                       // hauteur atteinte par le verre
  float rempli = smoothstep(niveau, niveau - 0.04, hauteur);
  float balai = exp(-pow((hauteur - niveau) / 0.016, 2.0)) * step(uConstruit, 0.999);
  col += balai * vec3(0.80, 0.90, 1.0) * 1.5;
  float visible = max(rempli, max(arete * contourVu, balai));

  couleur = vec4(col, uOpacite * visible);
}
