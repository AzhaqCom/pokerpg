import raw from '../data/sprites.json';
import { SPRITE_ASSETS } from '../data/spriteAssets';

export type ActionKey =
  | 'idle' | 'walkL' | 'walkR' | 'sleep' | 'hurt' | 'attack' | 'pose'
  | 'idleR' | 'idleL' | 'attackR' | 'attackL' | 'hurtR' | 'hurtL';

export interface ActionMeta {
  y: number; fw: number; fh: number; ax: number; ay: number; ms: number[];
}
export interface SpriteMeta { w: number; h: number; actions: Partial<Record<ActionKey, ActionMeta>> }

const MANIFEST = raw as Record<string, SpriteMeta>;

/** Animation absente chez PMD → repli sur une animation proche. */
const FALLBACK: Record<ActionKey, ActionKey[]> = {
  idle: [],
  walkL: ['idle'], walkR: ['idle'], sleep: ['idle'], hurt: ['idle'], attack: ['idle'],
  pose: ['idle'],
  idleR: ['walkR', 'idle'], idleL: ['walkL', 'idle'],
  attackR: ['attack', 'idleR'], attackL: ['attack', 'idleL'],
  hurtR: ['hurt', 'idleR'], hurtL: ['hurt', 'idleL'],
};

export function spriteKey(species: number, shiny: boolean) {
  return `p${shiny ? 's' : ''}${String(species).padStart(3, '0')}`;
}

export function getSprite(species: number, shiny: boolean) {
  let key = spriteKey(species, shiny);
  if (!MANIFEST[key]) key = spriteKey(species, false);
  const meta = MANIFEST[key];
  if (!meta) return null;
  return { key, meta, asset: SPRITE_ASSETS[key] };
}

export function resolveAction(meta: SpriteMeta, action: ActionKey): ActionMeta {
  const direct = meta.actions[action];
  if (direct) return direct;
  for (const alt of FALLBACK[action]) {
    const m = meta.actions[alt];
    if (m) return m;
  }
  return meta.actions.idle!;
}

/**
 * L'atlas PMD est fidèle à l'animation d'origine, pensée pour un jeu vu du dessus : certaines attaques
 * tournent le Pokémon sur lui-même en cours de mouvement, ce qui le fait sembler tourner le dos dans
 * notre vue de combat de profil. Pas un bug d'extraction — on limite juste le nombre de frames jouées
 * en combat aux frames qui restent de profil, au cas par cas.
 */
const ATTACK_FRAME_LIMIT: Partial<Record<number, number>> = {
  6: 6, // Dracaufeu : tourne le dos à partir de la 7e frame sur 14 (attackR/attackL)
};

/** Nombre de frames à jouer pour `attackR`/`attackL` de cette espèce, si limitée (voir `ATTACK_FRAME_LIMIT`). */
export function attackFrameLimit(speciesId: number, action: ActionKey): number | undefined {
  if (action !== 'attackR' && action !== 'attackL') return undefined;
  return ATTACK_FRAME_LIMIT[speciesId];
}
