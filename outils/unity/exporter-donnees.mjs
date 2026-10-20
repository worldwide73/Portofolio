// PORTAL RUSH → UNITY : LES DONNÉES DU JEU EN C#
//
// Écrit unity/PortalRush/Assets/PortalRush/Scripts/Coeur/Donnees.Generees.cs à partir des vraies données du jeu
// web (src/scripts/rush/donnees.ts et equilibrage.ts) : niveaux, phases et familles de motifs (dans leur ordre :
// le tirage en dépend), objectifs, étoiles, profils de difficulté, points, jauge, vaisseaux, pièces du garage.
// Ainsi le jeu Unity et le jeu web jouent exactement la même règle ; on ne recopie aucun chiffre à la main.
//
// Utilisation : node --experimental-strip-types --no-warnings outils/unity/exporter-donnees.mjs [--verifier]
// --verifier : n'écrit rien, échoue (code 1) si le fichier C# n'est plus à jour par rapport au jeu web.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chargerCoeur, RACINE } from './coeur-ts.mjs';

const { donnees, equilibrage } = await chargerCoeur();
const SORTIE = join(RACINE, 'unity', 'PortalRush', 'Assets', 'PortalRush', 'Scripts', 'Coeur', 'Donnees.Generees.cs');

const nb = (v) => (v === Infinity ? 'double.PositiveInfinity' : Number.isInteger(v) ? `${v}` : `${v}`);
const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const famille = (f) => `Famille.${pascal(f)}`;
const objectif = (o) => `new Objectif(TypeObjectif.${pascal(o.type)}, ${nb(o.valeur)})`;
const phase = (p) => `new Phase(${nb(p.fin)}, NomPhase.${pascal(p.nom)}, new (Famille, double)[] { ${Object.entries(p.familles).map(([f, w]) => `(${famille(f)}, ${nb(w)})`).join(', ')} }, ${p.pression ? 'true' : 'false'})`;
const niveau = (n) =>
  `new Niveau {
        Id = ${n.id}, Longueur = ${nb(n.longueur)}, Theme = Theme.${pascal(n.theme)}, Vitesse = ${nb(n.vitesse)}, Ecart = ${nb(n.ecart)}, Complexite = ${nb(n.complexite)},
        Phases = new[] {
          ${n.phases.map(phase).join(',\n          ')}
        },
        Objectif = ${objectif(n.objectif)},
        Maitrise = new Objectif[] { ${n.maitrise.map(objectif).join(', ')} },
        Etoiles = ${n.etoiles ? `new double[] { ${n.etoiles.join(', ')} }` : 'null'},
        Brume = ${n.brume ?? 'null'}, Boss = ${n.boss ? `new BossDef(${n.boss.vie}, ${n.boss.phases})` : 'null'}, Tutoriel = ${n.tutoriel ? 'true' : 'false'},
      }`;
const profil = (d, p) => `      [Difficulte.${pascal(d)}] = new Profil {
        Score = ${nb(p.score)},
        Vitesse = (${nb(p.vitesse.depart)}, ${nb(p.vitesse.max)}, ${nb(p.vitesse.acceleration)}),
        Ecart = (${nb(p.ecart.depart)}, ${nb(p.ecart.min)}, ${nb(p.ecart.resserrement)}),
        Reaction = (${nb(p.reaction.depart)}, ${nb(p.reaction.min)}, ${nb(p.reaction.sur)}),
        Complexite = (${nb(p.complexite.depart)}, ${nb(p.complexite.max)}, ${nb(p.complexite.parMotif)}),
        Boucliers = ${p.boucliers}, Invulnerable = ${nb(p.invulnerable)}, Fragments = ${nb(p.fragments)}, GainOverdrive = ${nb(p.gainOverdrive)},
        Overdrive = (${nb(p.overdrive.duree)}, ${p.overdrive.charges}, ${nb(p.overdrive.multiplicateur)}),
        Parfait = ${nb(p.parfait)}, ComboDelai = ${nb(p.comboDelai)}, Pression = (${nb(p.pression.toutesLes)}, ${p.pression.motifs}),
      }`;
const condition = (c) => {
  switch (c.type) {
    case 'depart':
      return 'Condition.Depart()';
    case 'niveau':
      return `Condition.ParNiveau(${c.niveau})`;
    case 'rang':
      return `Condition.ParRang("${c.rang}")`;
    case 'difficulte':
      return `Condition.ParDifficulte(Difficulte.${pascal(c.difficulte)})`;
    case 'infini':
      return `Condition.ParInfini(${c.distance})`;
    case 'total':
      return `Condition.ParTotal("${c.stat}", ${c.valeur})`;
    case 'multiplicateur':
      return `Condition.ParMultiplicateur(${c.valeur})`;
  }
};
const E = equilibrage;
const code = `// FICHIER GÉNÉRÉ par outils/unity/exporter-donnees.mjs à partir de src/scripts/rush/donnees.ts et equilibrage.ts.
// NE PAS MODIFIER À LA MAIN : changer le jeu web, puis relancer l'export (la règle doit rester la même des deux côtés).
// Règles version ${E.REGLES_VERSION}.
#nullable enable
using System.Collections.Generic;

namespace PortalRush.Coeur
{
  public static partial class Donnees
  {
    public const int ReglesVersion = ${E.REGLES_VERSION};

    public static readonly Niveau[] Niveaux = new[]
    {
      ${donnees.NIVEAUX.map(niveau).join(',\n      ')}
    };

    public static Niveau NiveauInfini() => ${niveau(donnees.niveauInfini())};

    public static readonly Niveau Defi = ${niveau(donnees.DEFI)};
    public const Difficulte DifficulteDefi = Difficulte.${pascal(donnees.DIFFICULTE_DEFI)};

    public static readonly Dictionary<Difficulte, Profil> Profils = new()
    {
${Object.entries(E.PROFILS).map(([d, p]) => profil(d, p)).join(',\n')}
    };

    public static readonly Difficulte[] OrdreDifficultes = { ${E.ORDRE_DIFFICULTES.map((d) => `Difficulte.${pascal(d)}`).join(', ')} };

    public static class Points
    {
${Object.entries(E.POINTS).map(([k, v]) => `      public const double ${pascal(k)} = ${nb(v)};`).join('\n')}
    }
    public const int ComboParCran = ${E.COMBO.parCran}, ComboMax = ${E.COMBO.max};
    public static class Jauge
    {
${Object.entries(E.JAUGE).map(([k, v]) => `      public const double ${pascal(k)} = ${nb(v)};`).join('\n')}
    }
    public const int OverdriveParPartie = ${E.OVERDRIVE.parPartie};
    public const double OverdriveDepartMetres = ${nb(E.OVERDRIVE.depart.metres)}, OverdriveDepartPart = ${nb(E.OVERDRIVE.depart.part)};
    public const int InfiniBoucliers = ${E.INFINI.boucliers};
    public const double InfiniSurcroit = ${nb(E.INFINI.surcroit)}, InfiniPlafond = ${nb(E.INFINI.plafond)};
    public const double OverdriveComboCombo = ${nb(E.OVERDRIVE_COMBO.combo)}, OverdriveComboBonus = ${nb(E.OVERDRIVE_COMBO.bonus)};
    public static readonly Dictionary<Difficulte, double> BossVie = new()
    {
${Object.entries(E.BOSS.vie).map(([d, v]) => `      [Difficulte.${pascal(d)}] = ${nb(v)},`).join('\n')}
    };
    public const double BossDegatsParfait = ${E.BOSS.degats.parfait}, BossDegatsNoyau = ${E.BOSS.degats.noyau}, BossDegatsOverdrive = ${E.BOSS.degats.overdrive}, BossDegatsBrise = ${E.BOSS.degats.brise};
    public static readonly (string Rang, double Seuil)[] Rangs = { ${E.RANGS.map(([r, s]) => `("${r}", ${s})`).join(', ')} };
    public const double Deplacement = ${nb(E.DEPLACEMENT)};

    public static readonly Vehicule[] Vehicules =
    {
${donnees.VEHICULES.map((v) => `      new Vehicule("${v.id}", ${v.modele}, ${nb(v.deplacement)}, ${v.boucliers}, ${nb(v.parfait)}, ${nb(v.jauge)}, ${condition(v.condition)}),`).join('\n')}
    };
    public const string VehiculeDepart = "${donnees.VEHICULE_DEPART}";

    public static readonly Piece[] Pieces =
    {
${donnees.PIECES.map((p) => `      new Piece("${p.id}", Emplacement.${pascal(p.emplacement)}, "${p.couleur}", ${condition(p.condition)}),`).join('\n')}
    };
  }
}
`;
if (process.argv.includes('--verifier')) {
  const aJour = existsSync(SORTIE) && readFileSync(SORTIE, 'utf8') === code;
  console.log(aJour ? 'Données C# à jour.' : 'Données C# PÉRIMÉES : relancer outils/unity/exporter-donnees.mjs.');
  process.exit(aJour ? 0 : 1);
}
mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, code);
console.log('→', SORTIE);
