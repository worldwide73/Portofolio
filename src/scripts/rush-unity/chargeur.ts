// PORTAL RUSH (Unity) — LE CHARGEUR DU BUILD WEB (18 octobre 2026)
//
// Le portfolio n'utilise pas l'index.html de Unity : il lit le manifeste écrit à côté du build
// (public/rush-unity/portal-rush.json, contrat §6.1), charge le « loader » de Unity à la demande, et appelle
// createUnityInstance sur sa propre toile. Rien n'est téléchargé au chargement du portfolio ; le préchargement
// (faible priorité) attend l'approche du jeu. Manifeste absent ou illisible, pas de WebGL 2, échec du chargement :
// la version Unity n'est pas disponible, et l'ancien jeu prend le relais (index.ts).

export const BASE = '/rush-unity/';

export interface Manifeste {
  version: string;
  unity: string;
  /** Les adresses complètes (le manifeste les donne relatives à son dossier). */
  loader: string;
  data: string;
  framework: string;
  code: string;
  octets: number;
  compression: string;
  repliDecompression: boolean;
}

/** L'instance que rend createUnityInstance (ce que la page en utilise). */
export interface InstanceUnity {
  SendMessage(objet: string, methode: string, valeur?: string | number): void;
  Quit(): Promise<void>;
}
type CreerInstance = (toile: HTMLCanvasElement, config: Record<string, unknown>, progression?: (p: number) => void) => Promise<InstanceUnity>;

let manifeste: Promise<Manifeste | null> | null = null;
/** Le manifeste du build (une seule lecture par page) ; null s'il manque ou ne se lit pas. */
export function lireManifeste(): Promise<Manifeste | null> {
  return (manifeste ??= fetch(`${BASE}portal-rush.json`, { cache: 'no-cache', credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m: unknown) => {
      const o = m && typeof m === 'object' ? (m as Record<string, unknown>) : null;
      const texte = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length < 300 && !/^[a-z]+:|^\/\/|\.\./i.test(v) ? v : null);
      const [loader, data, framework, code] = ['loader', 'data', 'framework', 'code'].map((k) => texte(o?.[k]));
      if (!o || !loader || !data || !framework || !code) return null;
      const adresse = (chemin: string) => new URL(chemin, new URL(BASE, window.location.href)).href;
      return {
        version: String(o.version ?? ''),
        unity: String(o.unity ?? ''),
        loader: adresse(loader),
        data: adresse(data),
        framework: adresse(framework),
        code: adresse(code),
        octets: Number(o.octets) || 0,
        compression: String(o.compression ?? ''),
        repliDecompression: o.repliDecompression === true,
      };
    })
    .catch(() => null));
}

let avecWebgl2: boolean | null = null;
/** WebGL 2 est-il là ? (Le build Web de Unity 6 en a besoin.) */
export function webgl2(): boolean {
  if (avecWebgl2 !== null) return avecWebgl2;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    avecWebgl2 = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    avecWebgl2 = false;
  }
  return avecWebgl2;
}

let precharge = false;
/** Le préchargement discret : les fichiers du build demandés en faible priorité (« prefetch »), une seule fois. */
export function precharger(): void {
  if (precharge || !webgl2()) return;
  precharge = true;
  void lireManifeste().then((m) => {
    if (!m) return;
    for (const href of [m.loader, m.framework, m.code, m.data]) {
      const lien = document.createElement('link');
      lien.rel = 'prefetch';
      lien.href = href;
      lien.dataset.rushUnity = '';
      document.head.append(lien);
    }
  });
}

let script: Promise<CreerInstance> | null = null;
/** Le « loader » de Unity (il définit createUnityInstance), chargé une seule fois. */
function chargerLoader(m: Manifeste): Promise<CreerInstance> {
  const deja = (window as unknown as { createUnityInstance?: CreerInstance }).createUnityInstance;
  if (deja) return Promise.resolve(deja);
  return (script ??= new Promise<CreerInstance>((resoudre, rejeter) => {
    const el = document.createElement('script');
    el.src = m.loader;
    el.async = true;
    el.dataset.rushUnity = '';
    el.onload = () => {
      const f = (window as unknown as { createUnityInstance?: CreerInstance }).createUnityInstance;
      if (f) resoudre(f);
      else rejeter(new Error('createUnityInstance absent du loader'));
    };
    el.onerror = () => rejeter(new Error(`loader introuvable (${m.loader})`));
    document.head.append(el);
  }).catch((e) => {
    // (Un prochain essai pourra recharger le script.)
    script = null;
    document.querySelectorAll('script[data-rush-unity]').forEach((s) => s.remove());
    throw e;
  }));
}

/** Prépare le loader pendant la fissure (avant que la toile n'existe). */
export const preparerLoader = (m: Manifeste) => chargerLoader(m).then(() => undefined);

/** Crée l'instance Unity sur la toile. « progression » : de 0 à 1. */
export async function creerInstance(toile: HTMLCanvasElement, m: Manifeste, progression: (p: number) => void): Promise<InstanceUnity> {
  const creer = await chargerLoader(m);
  return creer(
    toile,
    {
      dataUrl: m.data,
      frameworkUrl: m.framework,
      codeUrl: m.code,
      streamingAssetsUrl: new URL(`${BASE}StreamingAssets`, window.location.href).href,
      companyName: 'Mathéo Maleyran',
      productName: 'Portal Rush',
      productVersion: m.version || '0',
      // (Comme la 3D du jeu web : au plus 1,5 pixel par pixel CSS ; la qualité de Unity peut encore réduire.)
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      matchWebGLToCanvasSize: true,
      // Les messages de Unity vont au journal, discrètement (jamais de bandeau dans la page).
      showBanner: (message: string, genre: string) => (genre === 'error' ? console.warn : console.info)('[Portal Rush · Unity]', message),
    },
    (p) => progression(Math.max(0, Math.min(1, Number(p) || 0))),
  );
}
