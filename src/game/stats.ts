import { PType, StatKey, species } from './data';
import { addItemBonuses } from './items';
import { BattleBonuses, Item, Mon, emptyBonuses } from './model';
import { AURA, addTalentBonuses } from './talents';

/** Stats brutes (formule du document de conception). */
export function rawStats(speciesId: number, level: number, genes: Record<StatKey, number>) {
  const b = species(speciesId).base;
  const stat = (k: Exclude<StatKey, 'hp'>) => Math.floor(((2 * b[k] + genes[k]) * level) / 100) + 5;
  return {
    hp: Math.floor(((2 * b.hp + genes.hp) * level) / 100) + level + 10,
    atk: stat('atk'),
    def: stat('def'),
    spe: stat('spe'),
  };
}

export function primaryType(speciesId: number): PType {
  return species(speciesId).types[0];
}

/** Auras d'équipe : pleine pour chaque membre de l'équipe, moitié pour la pension. */
export function auraBonuses(teamSpecies: number[], pensionSpecies: number[]): BattleBonuses {
  const b = emptyBonuses();
  for (const id of teamSpecies) { const a = AURA[primaryType(id)]; b[a.stat] += a.value; }
  for (const id of pensionSpecies) { const a = AURA[primaryType(id)]; b[a.stat] += a.value / 2; }
  return b;
}

export function sumBonuses(...list: BattleBonuses[]): BattleBonuses {
  const out = emptyBonuses();
  for (const b of list) {
    for (const k of Object.keys(out) as (keyof BattleBonuses)[]) {
      if (k === 'affinities') continue;
      (out[k] as number) += b[k] as number;
    }
    out.affinities.push(...b.affinities);
  }
  return out;
}

/** Bonus totaux d'un Pokémon : objets tenus + talents + auras. */
export function monBonuses(mon: Mon, held: Item[], auras: BattleBonuses): BattleBonuses {
  const b = emptyBonuses();
  addItemBonuses(b, held);
  addTalentBonuses(b, species(mon.speciesId).types, mon.talents, mon.talentTypeChoices);
  return sumBonuses(b, auras);
}

export interface FinalStats { hp: number; atk: number; def: number; spe: number; crit: number }

export function finalStats(mon: Mon, bonuses: BattleBonuses): FinalStats {
  const r = rawStats(mon.speciesId, mon.level, mon.genes);
  const shiny = mon.shiny ? 1.1 : 1;
  return {
    hp: Math.round(r.hp * shiny * (1 + bonuses.hpPct / 100)),
    atk: Math.round(r.atk * shiny * (1 + bonuses.atkPct / 100)),
    def: Math.round(r.def * shiny * (1 + bonuses.defPct / 100)),
    spe: Math.round(r.spe * shiny * (1 + bonuses.spePct / 100)),
    crit: 6 + bonuses.critPct,
  };
}

/** Puissance de combat (affichage) : un seul nombre pour comparer. */
export function combatPower(s: FinalStats): number {
  return Math.round(s.hp * 0.5 + s.atk * 2 + s.def * 1.5 + s.spe * 1.2 + s.crit * 3);
}

/**
 * Qualité génétique (0 à 1) : les gènes (PV/Atq/Déf/Vit, 0 à 15 chacun) sont tirés une seule fois à la
 * capture et ne changent plus jamais — contrairement au PC, qui grimpe avec le niveau/objets/talents
 * mais reste plafonné par ce potentiel de départ.
 */
export function geneQuality(genes: Mon['genes']): number {
  return (genes.hp + genes.atk + genes.def + genes.spe) / 60;
}

/** Étoiles façon Pokémon GO : 4 = gènes parfaits (15/15/15/15), 1 = faible qualité génétique. */
export function monStars(mon: Mon): 1 | 2 | 3 | 4 {
  const q = geneQuality(mon.genes);
  if (q >= 1) return 4;
  if (q >= 0.8) return 3;
  if (q >= 0.5) return 2;
  return 1;
}

// ---------------------------------------------------------------- expérience
export const xpForLevel = (n: number) => 30 * n * n;
export const MAX_LEVEL = 100;

export function levelFromXp(xp: number): number {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= xpForLevel(lv + 1)) lv++;
  return lv;
}
