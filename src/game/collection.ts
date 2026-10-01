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

function ownedCounts(s: GameState, shiny: boolean): Map<number, number> {
  const c = new Map<number, number>();
  for (const m of Object.values(s.mons)) if (m.shiny === shiny) c.set(m.speciesId, (c.get(m.speciesId) ?? 0) + 1);
  return c;
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

/** Exemplaires d'une espèce, dans l'ordre où on les garde : équipe/pension/exploration d'abord, puis étoiles, niveau. */
/**
 * Exemplaires d'une espèce, à garder d'abord : ceux en équipe/pension/exploration, puis le meilleur en gènes puis en PC
 * (`byQuality`, même règle que « Nettoyer les doublons »). Avant le 2026-10-01 : étoiles puis niveau, qui pouvait garder
 * un exemplaire moins bon en gènes (deux 3★ : le plus haut niveau restait, même à 48/60 contre 59/60).
 */
function ranked(s: GameState, id: number, shiny: boolean): Mon[] {
  return Object.values(s.mons).filter((m) => m.speciesId === id && m.shiny === shiny)
    .sort((a, b) => Number(isPosted(s, b)) - Number(isPosted(s, a)) || byQuality(a, b));
}

/**
 * Nombre d'exemplaires à garder par espèce pour l'objectif : 1 pour elle-même + la matière que ses évolutions
 * attendent encore (`besoin` des enfants), dans la limite de ce qu'on possède.
 */
function keepCounts(s: GameState, shiny: boolean): Map<number, number> {
  const dexMax = regionOf(s.prestige).dexMax;
  const owned = ownedCounts(s, shiny);
  const need = collectionNeeds(s, shiny, owned);
  const keep = new Map<number, number>();
  for (const [id, n] of owned) {
    const down = id <= dexMax ? childrenOf(id, dexMax).reduce((a, c) => a + (need.get(c) ?? 0), 0) : 0;
    keep.set(id, Math.min(n, 1 + down));
  }
  return keep;
}

/**
 * Doublons à relâcher pour l'objectif « boîte » : tout ce qui dépasse `keepCounts`. Jamais l'équipe, la pension ni
 * l'exploration, jamais un Pokémon verrouillé. Les chromatiques ne sont concernés qu'avec l'objectif `boxShiny`
 * (sinon ils sont gardés tels quels).
 */
export function boxExcess(s: GameState, goal: CollectionGoal): Mon[] {
  const out: Mon[] = [];
  for (const shiny of goal === 'boxShiny' ? [false, true] : [false]) {
    const keep = keepCounts(s, shiny);
    for (const [id, k] of keep) {
      for (const m of ranked(s, id, shiny).slice(k)) if (!isPosted(s, m) && !m.locked) out.push(m);
    }
  }
  return out;
}

/**
 * Pokémon qui servent de matière à une évolution manquante mais n'ont pas encore le niveau pour évoluer (filtre
 * « Besoin d'XP pour évoluer » : à mettre en pension ou en équipe). Le premier exemplaire de chaque espèce (celui qu'on
 * garde tel quel) n'est jamais compté.
 */
export function needsXpForBox(s: GameState, goal: CollectionGoal): Set<string> {
  const out = new Set<string>();
  const dexMax = regionOf(s.prestige).dexMax;
  for (const shiny of goal === 'boxShiny' ? [false, true] : [false]) {
    const need = collectionNeeds(s, shiny);
    const keep = keepCounts(s, shiny);
    for (const [id, k] of keep) {
      const sp = species(id);
      const demand = id <= dexMax ? childrenOf(id, dexMax).some((c) => (need.get(c) ?? 0) > 0) : false;
      if (!demand) continue;
      for (const m of ranked(s, id, shiny).slice(1, k)) if (m.level < sp.evolveLevel) out.add(m.uid);
    }
  }
  return out;
}

/**
 * « Compléter la boîte » : fait évoluer la matière disponible (au-delà du 1er exemplaire, hors équipe/pension/
 * exploration, au niveau requis) vers les évolutions qui manquent, branches comprises. Retourne le nombre
 * d'évolutions faites ; `dryRun` ne modifie rien et s'arrête à la première possible.
 */
export function completeBox(s: GameState, goal: CollectionGoal, dryRun = false): number {
  const dexMax = regionOf(s.prestige).dexMax;
  let count = 0;
  for (const shiny of goal === 'boxShiny' ? [false, true] : [false]) {
    // plusieurs passes : une évolution peut créer la matière de l'étage suivant (Bulbizarre → Herbizarre → Florizarre)
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      const need = collectionNeeds(s, shiny);
      for (const id of regionSpecies(dexMax)) {
        const kids = childrenOf(id, dexMax).filter((c) => (need.get(c) ?? 0) > 0);
        if (!kids.length) continue;
        const spares = ranked(s, id, shiny).slice(1).filter((m) => !isPosted(s, m) && !m.locked && m.level >= species(id).evolveLevel);
        for (const c of kids) {
          let demand = need.get(c) ?? 0;
          while (demand > 0 && spares.length) {
            if (dryRun) return 1;
            const m = spares.pop()!; // le moins bon exemplaire évolue, le meilleur reste
            evolve(s, m.uid, c);
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
 * Filtre « Besoin d'XP pour évoluer » avec l'objectif Pokédex : Pokémon dont une évolution (dans la région) manque
 * au Pokédex — normal ou chromatique selon le Pokémon — et qui n'a pas encore le niveau pour évoluer.
 */
export function needsXpForDex(s: GameState): Set<string> {
  const dexMax = regionOf(s.prestige).dexMax;
  const out = new Set<string>();
  for (const m of Object.values(s.mons)) {
    const sp = species(m.speciesId);
    if (!sp.evolvesTo || m.level >= sp.evolveLevel) continue;
    const dex = m.shiny ? s.dex.shiny : s.dex.caught;
    if (childrenOf(m.speciesId, dexMax).some((c) => !dex.includes(c))) out.add(m.uid);
  }
  return out;
}

/** Filtre « Besoin d'XP pour évoluer » selon l'objectif en cours. */
export function needsXp(s: GameState, goal: CollectionGoal): Set<string> {
  return goal === 'box' || goal === 'boxShiny' ? needsXpForBox(s, goal) : needsXpForDex(s);
}
