import { PType, TYPE_NAME, move, species } from './data';
import { BattleBonuses, NumericBonusStat } from './model';

/**
 * Arbres de talents : un arbre par type (celui du type principal du Pokémon).
 * 6 talents à rang fixe (5 max) sur 3 paliers (5 et 10 points dépensés pour débloquer
 * les paliers 2 et 3), + 2 talents « Affinité » à rang 15 sur les paliers 4 et 5
 * (20 et 40 points) : le joueur choisit un type hors des siens, présent dans son
 * movepool complet, pour booster ses dégâts, + 4 talents à rang 10 sur les paliers 6 à 9
 * (60/70/80/90 points, chacun exige d'avoir fini le précédent) : 2e saveur par type, saveur
 * classique du type secondaire (ou 2e saveur à nouveau pour un mono-type), Fureur (attaque)
 * et Précision mortelle (critique), génériques. 1 point par niveau à partir du niveau 2,
 * +1 bonus au niveau 100 (100 points max, de quoi tout maxer pile à Nv.100).
 */
export const MAX_RANK = 5;
export const AFFINITY_MAX_RANK = 15;
export const TIER2_MAX_RANK = 10;
export const TIER_REQ = [0, 5, 10, 20, 40, 60, 70, 80, 90];

export interface TalentDef {
  id: string;
  name: string;
  tier: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  stat: NumericBonusStat;
  perRank: number;
  maxRank: number;
  describe: (value: number) => string;
  /** talent « au choix » : le joueur sélectionne un type (hors des siens) au 1er rang, figé ensuite. */
  chooseType?: boolean;
}

const pct = (label: string) => (v: number) => `${label} +${v} %`;

interface Specialty { name: string; stat: NumericBonusStat; perRank: number; describe: (v: number) => string }

const SPECIALTY: Record<PType, Specialty> = {
  fire: { name: 'Brasier', stat: 'dmgVsStatusPct', perRank: 8, describe: (v) => `+${v} % de dégâts contre les cibles sous statut` },
  poison: { name: 'Venin', stat: 'ailmentChancePct', perRank: 12, describe: (v) => `+${v} % de chances d'infliger un statut` },
  electric: { name: 'Surtension', stat: 'ailmentChancePct', perRank: 12, describe: (v) => `+${v} % de chances d'infliger un statut` },
  ice: { name: 'Blizzard', stat: 'ailmentChancePct', perRank: 12, describe: (v) => `+${v} % de chances d'infliger un statut` },
  grass: { name: 'Sève', stat: 'lifestealPct', perRank: 3, describe: (v) => `Vol de vie ${v} %` },
  water: { name: 'Carapace', stat: 'defPct', perRank: 5, describe: (v) => `Défense +${v} %` },
  normal: { name: 'Coups francs', stat: 'basicDmgPct', perRank: 15, describe: (v) => `Attaque de base +${v} %` },
  fighting: { name: 'Frappe sèche', stat: 'critDmgPct', perRank: 10, describe: (v) => `Dégâts critiques +${v} %` },
  flying: { name: 'Esquive aérienne', stat: 'dodgePct', perRank: 3, describe: (v) => `${v} % d'esquive` },
  ground: { name: 'Onde de choc', stat: 'aoeDmgPct', perRank: 10, describe: (v) => `Capacités de zone +${v} %` },
  rock: { name: 'Roc', stat: 'defPct', perRank: 6, describe: (v) => `Défense +${v} %` },
  bug: { name: 'Essaim', stat: 'critPct', perRank: 3, describe: (v) => `Critique +${v} %` },
  ghost: { name: 'Intangible', stat: 'dodgePct', perRank: 4, describe: (v) => `${v} % d'esquive` },
  psychic: { name: 'Prescience', stat: 'cdrPct', perRank: 4, describe: (v) => `Recharge −${v} %` },
  dragon: { name: 'Sang draconique', stat: 'atkPct', perRank: 4, describe: (v) => `Attaque +${v} %` },
};

/** Palier 6 : une 2e saveur par type, différente de celle du palier 3 (`SPECIALTY`). */
const SPECIALTY2: Record<PType, Specialty> = {
  fire: { name: 'Fournaise', stat: 'ailmentChancePct', perRank: 6, describe: (v) => `+${v} % de chances d'infliger un statut` },
  water: { name: 'Courant vital', stat: 'lifestealPct', perRank: 2, describe: (v) => `Vol de vie ${v} %` },
  grass: { name: 'Spores', stat: 'aoeDmgPct', perRank: 5, describe: (v) => `Capacités de zone +${v} %` },
  electric: { name: 'Surcharge', stat: 'critDmgPct', perRank: 5, describe: (v) => `Dégâts critiques +${v} %` },
  ice: { name: 'Banquise', stat: 'defPct', perRank: 3, describe: (v) => `Défense +${v} %` },
  normal: { name: 'Ruée', stat: 'spePct', perRank: 2, describe: (v) => `Vitesse +${v} %` },
  fighting: { name: 'Poigne de fer', stat: 'atkPct', perRank: 2, describe: (v) => `Attaque +${v} %` },
  flying: { name: 'Vent arrière', stat: 'spePct', perRank: 2, describe: (v) => `Vitesse +${v} %` },
  ground: { name: 'Terre battue', stat: 'defPct', perRank: 3, describe: (v) => `Défense +${v} %` },
  rock: { name: 'Éboulement', stat: 'critDmgPct', perRank: 5, describe: (v) => `Dégâts critiques +${v} %` },
  bug: { name: 'Piqûre', stat: 'ailmentChancePct', perRank: 6, describe: (v) => `+${v} % de chances d'infliger un statut` },
  ghost: { name: 'Malédiction', stat: 'dmgVsStatusPct', perRank: 4, describe: (v) => `+${v} % de dégâts contre les cibles sous statut` },
  psychic: { name: 'Clairvoyance', stat: 'critPct', perRank: 1.5, describe: (v) => `Critique +${v} %` },
  poison: { name: 'Infection', stat: 'dmgVsStatusPct', perRank: 4, describe: (v) => `+${v} % de dégâts contre les cibles sous statut` },
  dragon: { name: 'Rage draconique', stat: 'critDmgPct', perRank: 5, describe: (v) => `Dégâts critiques +${v} %` },
};

/**
 * `types` : les 1 ou 2 types du Pokémon (`species(id).types`). Le premier détermine le nom de l'arbre et
 * la Spécialité (palier 3), mais le bonus de « Puissance » profite réellement aux deux types en combat
 * (`f.types.includes(m.type)` dans `battle.ts`, comme le STAB des jeux officiels) — la description
 * l'affiche donc pour éviter l'écart entre le texte et ce que fait vraiment le talent.
 */
export function talentTree(types: PType[]): TalentDef[] {
  const primary = types[0];
  const secondary = types[1];
  const sp = SPECIALTY[primary];
  const sp2 = SPECIALTY2[primary];
  // palier 7 : bi-type → saveur classique du type secondaire (identité jamais exploitée sinon) ;
  // mono-type → pas de 2e type à exploiter, la 2e saveur (palier 6) est reprise pour doubler son rang.
  const sp3 = secondary ? SPECIALTY[secondary] : sp2;
  const typeLabel = types.map((t) => TYPE_NAME[t]).join(' et ');
  return [
    { id: 'power', name: `Puissance ${TYPE_NAME[primary]}`, tier: 0, stat: 'typeDmgPct', perRank: 4, maxRank: MAX_RANK, describe: pct(`Dégâts ${typeLabel}`) },
    { id: 'vigor', name: 'Vigueur', tier: 0, stat: 'hpPct', perRank: 4, maxRank: MAX_RANK, describe: pct('PV') },
    { id: 'guard', name: 'Garde', tier: 1, stat: 'defPct', perRank: 4, maxRank: MAX_RANK, describe: pct('Défense') },
    { id: 'reflex', name: 'Réflexes', tier: 1, stat: 'spePct', perRank: 4, maxRank: MAX_RANK, describe: pct('Vitesse') },
    { id: 'spec', name: sp.name, tier: 2, stat: sp.stat, perRank: sp.perRank, maxRank: MAX_RANK, describe: sp.describe },
    { id: 'mastery', name: 'Maîtrise', tier: 2, stat: 'cdrPct', perRank: 3, maxRank: MAX_RANK, describe: (v) => `Recharge −${v} %` },
    { id: 'affinity1', name: 'Affinité I', tier: 3, stat: 'typeDmgPct', perRank: 3, maxRank: AFFINITY_MAX_RANK, describe: pct('Dégâts du type choisi'), chooseType: true },
    { id: 'affinity2', name: 'Affinité II', tier: 4, stat: 'typeDmgPct', perRank: 3, maxRank: AFFINITY_MAX_RANK, describe: pct('Dégâts du type choisi'), chooseType: true },
    { id: 'spec2', name: sp2.name, tier: 5, stat: sp2.stat, perRank: sp2.perRank, maxRank: TIER2_MAX_RANK, describe: sp2.describe },
    { id: 'spec3', name: sp3.name, tier: 6, stat: sp3.stat, perRank: sp3.perRank, maxRank: TIER2_MAX_RANK, describe: sp3.describe },
    { id: 'fury', name: 'Fureur', tier: 7, stat: 'atkPct', perRank: 2, maxRank: TIER2_MAX_RANK, describe: pct('Attaque') },
    { id: 'deadly', name: 'Précision mortelle', tier: 8, stat: 'critPct', perRank: 1.5, maxRank: TIER2_MAX_RANK, describe: pct('Critique') },
  ];
}

/**
 * Types éligibles pour un talent « au choix » : types des attaques *offensives* (`kind === 'damage'`)
 * du movepool complet de l'espèce, hors de ses propres types (déjà couverts par « Puissance ») — un
 * type dont la seule présence vient d'une capacité de statut/soin/buff (ex. Hâte, Psy, sur un Pokémon
 * Normal/Vol) ne ferait aucun dégât, donc n'a rien à gagner à être boosté. `exclude` retire en plus les
 * types déjà choisis dans un *autre* emplacement d'Affinité du même Pokémon — pour éviter de cumuler
 * deux fois le même type (le but des 2 emplacements est de diversifier) — sauf si ça ne laisserait plus
 * aucune option, où autant permettre la reprise que de bloquer purement et simplement l'emplacement.
 * Si l'espèce n'a aucune attaque offensive hors de ses propres types (mouvepool étroit type Rondoudou,
 * Rattata, Abra…), l'emplacement se rabat sur ses propres types : mieux vaut booster encore ses dégâts
 * réels que de laisser le talent inutilisable.
 */
export function eligibleAffinityTypes(speciesId: number, exclude: PType[] = []): PType[] {
  const sp = species(speciesId);
  const own = new Set(sp.types);
  const types = new Set<PType>();
  for (const [, moveId] of sp.learnset) {
    const m = move(moveId);
    if (m.kind === 'damage' && !own.has(m.type)) types.add(m.type);
  }
  const all = types.size ? [...types] : [...own];
  const filtered = all.filter((t) => !exclude.includes(t));
  return filtered.length ? filtered : all;
}

export function talentPoints(level: number): number {
  return Math.max(0, level - 1) + (level >= 100 ? 1 : 0);
}

export function spentPoints(talents: Record<string, number>): number {
  return Object.values(talents).reduce((a, b) => a + b, 0);
}

/** Peut-on ajouter un rang à ce talent ? (pour un talent « au choix » déjà entamé, `chosenType` est ignoré) */
export function canRankUp(types: PType[], talents: Record<string, number>, level: number, id: string): boolean {
  const def = talentTree(types).find((t) => t.id === id);
  if (!def) return false;
  const spent = spentPoints(talents);
  if (spent >= talentPoints(level)) return false;
  if ((talents[id] ?? 0) >= def.maxRank) return false;
  return spent >= TIER_REQ[def.tier];
}

export function addTalentBonuses(b: BattleBonuses, types: PType[], talents: Record<string, number>, typeChoices: Record<string, PType>) {
  for (const def of talentTree(types)) {
    const r = talents[def.id] ?? 0;
    if (!r) continue;
    if (def.chooseType) {
      const t = typeChoices[def.id];
      if (t) b.affinities.push({ type: t, pct: def.perRank * r });
    } else {
      b[def.stat] += def.perRank * r;
    }
  }
}

/** Auras : bonus passif du type principal, donné à toute l'équipe (moitié depuis la pension). */
export const AURA: Record<PType, { stat: NumericBonusStat; value: number; label: string }> = {
  normal: { stat: 'hpPct', value: 3, label: 'PV' },
  fire: { stat: 'atkPct', value: 3, label: 'Attaque' },
  water: { stat: 'hpPct', value: 4, label: 'PV' },
  grass: { stat: 'defPct', value: 3, label: 'Défense' },
  electric: { stat: 'spePct', value: 4, label: 'Vitesse' },
  ice: { stat: 'critPct', value: 2, label: 'Critique' },
  fighting: { stat: 'critDmgPct', value: 6, label: 'Dégâts critiques' },
  poison: { stat: 'ailmentChancePct', value: 5, label: 'Chance de statut' },
  ground: { stat: 'aoeDmgPct', value: 5, label: 'Dégâts de zone' },
  flying: { stat: 'spePct', value: 3, label: 'Vitesse' },
  psychic: { stat: 'cdrPct', value: 2, label: 'Recharge' },
  bug: { stat: 'critPct', value: 2, label: 'Critique' },
  rock: { stat: 'defPct', value: 4, label: 'Défense' },
  ghost: { stat: 'dodgePct', value: 2, label: 'Esquive' },
  dragon: { stat: 'atkPct', value: 4, label: 'Attaque' },
};
