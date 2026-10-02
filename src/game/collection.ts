/**
 * Objectif de collection « boîte complète » : posséder 1 exemplaire de chaque espèce de la région (normal, et
 * chromatique en plus si l'objectif les inclut). Contrairement au Pokédex (vu/capturé une fois), une évolution
 * consomme le Pokémon : pour finir avec Bulbizarre, Herbizarre ET Florizarre, il faut 3 Bulbizarre.
 *
 * Modèle : chaque lignée est un arbre (branches comprises : Évoli a 8 formes) limité au Pokédex de la région.
 * La matière ne descend que vers les évolutions. Pour chaque espèce v :
 *   besoin(v) = max(0, 1 + Σ besoin(enfants) − possédés(v))
 * = nombre de Pokémon qui doivent encore « arriver » en v (capturés, ou évolués depuis un ancêtre). Le besoin de la
 * racine est le nombre de captures qui manquent. Capturer une espèce est utile si son besoin est > 0.
 *
 * Tout se branche là-dessus : capture automatique, nettoyage des doublons, bouton « Compléter la boîte », filtre
 * « Besoin d'XP pour évoluer », compteur de la boîte. Pur : ne modifie `s` que dans `completeBox`.
 */
import { regionOf } from './content';
import { ALL_SPECIES, evolutionTargets, species } from './data';
import { GameState, byQuality, evolve } from './game';
import { Mon } from './model';

export type CollectionGoal = 'off' | 'dex' | 'box' | 'boxShiny';

/** Pré-évolution d'une espèce **dans la région** (celle dont elle est une cible d'évolution). */
function parentIn(id: number, dexMax: number): number | undefined {
  for (const sp of ALL_SPECIES) {
    if (sp.id > dexMax) break;
    if (evolutionTargets(sp.id, dexMax).includes(id)) return sp.id;
  }
  return undefined;
}

/** Racine de la lignée dans la région (Pikachu à Kanto, Pichu ensuite). */
export function regionRoot(id: number, dexMax: number): number {
  let r = id;
  for (let g = 0; g < 5; g++) {
    const p = parentIn(r, dexMax);
    if (p === undefined) break;
    r = p;
  }
  return r;
}

/** Espèces à posséder pour que la boîte soit complète (toutes celles ≤ `dexMax`). */
function regionSpecies(dexMax: number): number[] {
  return ALL_SPECIES.filter((sp) => sp.id <= dexMax).map((sp) => sp.id);
}

/** Enfants d'une espèce dans la région. */
function childrenOf(id: number, dexMax: number): number[] {
  return species(id).evolvesTo ? evolutionTargets(id, dexMax) : [];
}

/** Exemplaires possédés de chaque espèce (boîte, équipe, pension, exploration), normaux ou chromatiques. */
export function ownedCounts(s: GameState, shiny: boolean): Map<number, number> {
  const c = new Map<number, number>();
  for (const m of Object.values(s.mons)) if (m.shiny === shiny) c.set(m.speciesId, (c.get(m.speciesId) ?? 0) + 1);
  return c;
}

/** Exemplaires possédés, regroupés par espèce (normaux ou chromatiques). */
function bySpecies(s: GameState, shiny: boolean): Map<number, Mon[]> {
  const g = new Map<number, Mon[]>();
  for (const m of Object.values(s.mons)) {
    if (m.shiny !== shiny) continue;
    const list = g.get(m.speciesId);
    if (list) list.push(m); else g.set(m.speciesId, [m]);
  }
  return g;
}

/**
 * L'espèce et ses évolutions dans la région (toutes branches) absentes de la boîte, normales ou chromatiques : formes
 * manquantes d'une lignée dans la fenêtre d'une zone de la Carte.
 */
export function missingForms(s: GameState, id: number, shiny: boolean, owned = ownedCounts(s, shiny)): number[] {
  const dexMax = regionOf(s.prestige).dexMax;
  const out: number[] = [];
  const visit = (x: number) => {
    if (!owned.get(x)) out.push(x);
    for (const c of childrenOf(x, dexMax)) visit(c);
  };
  visit(id);
  return out;
}

/** Besoin de chaque espèce de la région (voir en-tête du fichier), pour les normaux ou les chromatiques. */
export function collectionNeeds(s: GameState, shiny: boolean, owned = ownedCounts(s, shiny)): Map<number, number> {
  const dexMax = regionOf(s.prestige).dexMax;
  const need = new Map<number, number>();
  const visit = (v: number): number => {
    const cached = need.get(v);
    if (cached !== undefined) return cached;
    const down = childrenOf(v, dexMax).reduce((a, c) => a + visit(c), 0);
    const n = Math.max(0, 1 + down - (owned.get(v) ?? 0));
    need.set(v, n);
    return n;
  };
  for (const id of regionSpecies(dexMax)) visit(id);
  return need;
}

/** Capturer cette espèce fait-il avancer la boîte ? */
export function wantedForBox(s: GameState, speciesId: number, shiny: boolean): boolean {
  return (collectionNeeds(s, shiny).get(speciesId) ?? 0) > 0;
}

/**
 * Suivi du besoin pendant une série de captures (hors ligne) : `wants(id)` puis `add(id)` quand on capture,
 * sans relire l'état.
 */
export function needTracker(s: GameState, shiny: boolean) {
  const owned = ownedCounts(s, shiny);
  let need = collectionNeeds(s, shiny, owned);
  return {
    wants: (id: number) => (need.get(id) ?? 0) > 0,
    add: (id: number) => { owned.set(id, (owned.get(id) ?? 0) + 1); need = collectionNeeds(s, shiny, owned); },
  };
}

/** Avancement de la boîte : espèces possédées au moins une fois, normales et chromatiques, sur le total de la région. */
export function boxProgress(s: GameState): { normal: number; shiny: number; total: number } {
  const dexMax = regionOf(s.prestige).dexMax;
  const ids = regionSpecies(dexMax);
  const n = ownedCounts(s, false);
  const sh = ownedCounts(s, true);
  return { normal: ids.filter((id) => n.has(id)).length, shiny: ids.filter((id) => sh.has(id)).length, total: ids.length };
}

const isPosted = (s: GameState, m: Mon) => s.team.includes(m.uid) || s.pension.some((p) => p.uid === m.uid) || s.exploration.some((p) => p.uid === m.uid);
/** Gagne de l'XP en ce moment : en équipe ou en pension (l'exploration rapporte des éclats, pas d'XP). */
export const gainsXp = (s: GameState, m: Mon) => s.team.includes(m.uid) || s.pension.some((p) => p.uid === m.uid);
/**
 * Ordre de la matière d'évolution : ceux déjà au niveau d'abord (rien à faire monter), puis ceux qui gagnent déjà de
 * l'XP (équipe, pension), puis les meilleurs en gènes puis en PC (`byQuality`).
 */
const matterOrder = (s: GameState, lv: number) => (a: Mon, b: Mon) =>
  Number(b.level >= lv) - Number(a.level >= lv) || Number(gainsXp(s, b)) - Number(gainsXp(s, a)) || byQuality(a, b);

/**
 * Exemplaires d'une espèce (normaux ou chromatiques) pour l'objectif « boîte » :
 * - `kept` reste sous cette forme : le meilleur en gènes puis en PC (`byQuality`) parmi ceux qui ne gagnent pas d'XP
 *   (boîte, exploration ; à défaut, le meilleur de tous) ;
 * - `matter` évoluera vers les formes qui manquent : autant que le besoin de ses évolutions (`collectionNeeds` : 2
 *   Bulbizarre pour Herbizarre ET Florizarre), dans l'ordre `matterOrder` ; jamais un verrouillé 🔒 qu'on n'a pas mis
 *   soi-même en équipe ou en pension.
 * Un seul calcul pour le filtre « Besoin d'XP » (la matière pas encore au niveau), « Compléter la boîte » (celle au
 * niveau) et « Nettoyer les doublons » (garde `kept` et `matter`). Avant le 2026-10-02, un Pokémon mis en pension
 * devenait « celui qui reste » : le filtre en proposait un autre à sa place (3 Bulbizarre en pension pour 2 utiles), ceux
 * en pension disparaissaient du filtre et « Compléter la boîte » ignorait la pension.
 */
function boxPlan(s: GameState, id: number, mons: Mon[], need: Map<number, number>, dexMax: number): { kept: Mon; matter: Mon[] } {
  const free = mons.filter((m) => !gainsXp(s, m));
  const kept = [...(free.length ? free : mons)].sort(byQuality)[0];
  const down = id <= dexMax ? childrenOf(id, dexMax).reduce((a, c) => a + (need.get(c) ?? 0), 0) : 0;
  if (!down) return { kept, matter: [] };
  const matter = mons.filter((m) => m !== kept && (!m.locked || gainsXp(s, m)))
    .sort(matterOrder(s, species(id).evolveLevel)).slice(0, down);
  return { kept, matter };
}

/**
 * Doublons à relâcher pour l'objectif « boîte » : tout sauf celui qui reste et la matière de ses évolutions manquantes
 * (`boxPlan`). Jamais l'équipe, la pension ni l'exploration, jamais un Pokémon verrouillé. Les chromatiques ne sont
 * concernés qu'avec l'objectif `boxShiny` (sinon ils sont gardés tels quels).
 */
export function boxExcess(s: GameState, goal: CollectionGoal): Mon[] {
  const out: Mon[] = [];
  const dexMax = regionOf(s.prestige).dexMax;
  for (const shiny of goal === 'boxShiny' ? [false, true] : [false]) {
    const need = collectionNeeds(s, shiny);
    for (const [id, mons] of bySpecies(s, shiny)) {
      const { kept, matter } = boxPlan(s, id, mons, need, dexMax);
      const keep = new Set([kept, ...matter]);
      for (const m of mons) if (!keep.has(m) && !isPosted(s, m) && !m.locked) out.push(m);
    }
  }
  return out;
}

/**
 * Filtre « Besoin d'XP pour évoluer » avec l'objectif « boîte » : la matière d'évolution (`boxPlan`) pas encore au
 * niveau — en équipe, en pension (déjà en train de monter) ou à placer. Le premier exemplaire de chaque espèce (celui
 * qu'on garde tel quel) n'est jamais compté.
 */
export function needsXpForBox(s: GameState, goal: CollectionGoal): Set<string> {
  const out = new Set<string>();
  const dexMax = regionOf(s.prestige).dexMax;
  for (const shiny of goal === 'boxShiny' ? [false, true] : [false]) {
    const need = collectionNeeds(s, shiny);
    for (const [id, mons] of bySpecies(s, shiny)) {
      const lv = species(id).evolveLevel;
      for (const m of boxPlan(s, id, mons, need, dexMax).matter) if (m.level < lv) out.add(m.uid);
    }
  }
  return out;
}

/**
 * « Compléter la boîte » : fait évoluer la matière d'évolution (`boxPlan`, celle que montre « Besoin d'XP ») arrivée au
 * niveau requis vers les évolutions qui manquent, branches comprises : en boîte, en pension (2026-10-02 : avant, il
 * fallait l'en retirer) ou en exploration, jamais dans l'équipe (choisie pour le combat) ni verrouillée. Retourne le
 * nombre d'évolutions faites ; `dryRun` ne modifie rien et s'arrête à la première possible.
 */
export function completeBox(s: GameState, goal: CollectionGoal, dryRun = false): number {
  const dexMax = regionOf(s.prestige).dexMax;
  let count = 0;
  for (const shiny of goal === 'boxShiny' ? [false, true] : [false]) {
    // plusieurs passes : une évolution peut créer la matière de l'étage suivant (Bulbizarre → Herbizarre → Florizarre)
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      const need = collectionNeeds(s, shiny);
      const groups = bySpecies(s, shiny);
      for (const id of regionSpecies(dexMax)) {
        const kids = childrenOf(id, dexMax).filter((c) => (need.get(c) ?? 0) > 0);
        const mons = groups.get(id);
        if (!kids.length || !mons) continue;
        const lv = species(id).evolveLevel;
        const ready = boxPlan(s, id, mons, need, dexMax).matter.filter((m) => m.level >= lv && !s.team.includes(m.uid) && !m.locked);
        for (const c of kids) {
          let demand = need.get(c) ?? 0;
          while (demand > 0 && ready.length) {
            if (dryRun) return 1;
            evolve(s, ready.shift()!.uid, c);
            count++;
            demand--;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }
  return count;
}

/**
 * Évolutions qu'il faut encore faire arriver à chaque espèce pour compléter le Pokédex (normal, ou chromatique) : 1 si
 * elle y manque, ou autant que ses évolutions en demandent — une seule pour une lignée simple (un Bulbizarre enregistre
 * Herbizarre puis Florizarre en évoluant), une par branche (un Évoli ne devient qu'une forme) —, moins les exemplaires
 * qu'on en possède déjà (ce sont eux qui évolueront).
 */
function dexArrivals(s: GameState, shiny: boolean, dexMax: number, owned: Map<number, number>): Map<number, number> {
  const dex = new Set(shiny ? s.dex.shiny : s.dex.caught);
  const memo = new Map<number, number>();
  const visit = (x: number): number => {
    const cached = memo.get(x);
    if (cached !== undefined) return cached;
    const down = childrenOf(x, dexMax).reduce((a, c) => a + visit(c), 0);
    const n = Math.max(0, Math.max(dex.has(x) ? 0 : 1, down) - (owned.get(x) ?? 0));
    memo.set(x, n);
    return n;
  };
  for (const id of regionSpecies(dexMax)) visit(id);
  return memo;
}

/**
 * Filtre « Besoin d'XP pour évoluer » avec l'objectif Pokédex (ou aucun) : Pokémon à faire évoluer vers une forme qui
 * manque au Pokédex — normal ou chromatique selon le Pokémon — et qui n'a pas encore le niveau. Seulement le nombre
 * nécessaire (`dexArrivals`) : ceux déjà au niveau d'abord (rien à faire monter), puis ceux qui gagnent de l'XP, puis
 * les meilleurs en gènes. Avant le 2026-10-02, tous les exemplaires : 15 Bulbizarre proposés pour un seul Herbizarre.
 */
export function needsXpForDex(s: GameState): Set<string> {
  const dexMax = regionOf(s.prestige).dexMax;
  const out = new Set<string>();
  for (const shiny of [false, true]) {
    const groups = bySpecies(s, shiny);
    const arrivals = dexArrivals(s, shiny, dexMax, new Map([...groups].map(([id, mons]) => [id, mons.length])));
    for (const [id, mons] of groups) {
      if (id > dexMax) continue;
      const down = childrenOf(id, dexMax).reduce((a, c) => a + (arrivals.get(c) ?? 0), 0);
      if (!down) continue;
      const lv = species(id).evolveLevel;
      const matter = mons.filter((m) => !m.locked || gainsXp(s, m)).sort(matterOrder(s, lv)).slice(0, down);
      for (const m of matter) if (m.level < lv) out.add(m.uid);
    }
  }
  return out;
}

/** Filtre « Besoin d'XP pour évoluer » selon l'objectif en cours. */
export function needsXp(s: GameState, goal: CollectionGoal): Set<string> {
  return goal === 'box' || goal === 'boxShiny' ? needsXpForBox(s, goal) : needsXpForDex(s);
}
