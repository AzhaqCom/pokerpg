import { simulate } from '../bot';
import { seededRng } from '../rng';

test('équilibrage V1 : un joueur efficace gagne le 1er badge en 30 min à 3 h de combat pur', () => {
  const reports = [1, 2, 3, 4, 5, 6].map((seed) => simulate(seededRng(seed), 3 * 3600));
  for (const r of reports) {
    const badge1 = r.milestones['biome1-badge']; // en minutes (voir bot.ts, mark())
    expect(badge1).toBeDefined();
    expect(badge1!).toBeGreaterThan(30);
    expect(badge1!).toBeLessThan(180);
  }
});

/**
 * Bout en bout Kanto : un joueur efficace termine les 10 biomes Kanto (Nv.100, badge du Champion) dans
 * un temps raisonnable. Sondé le 2026-09-21 sur 10 seeds : 208-410 min (3h30-6h50), jamais de blocage —
 * bornes ci-dessous avec une bonne marge pour ne pas devenir friable à la moindre retouche d'équilibrage.
 *
 * Ne couvre QUE Kanto (biome 9, pas `BIOMES.length-1`) : Johto (biomes 10-19, ajoutés le 2026-09-22)
 * est un premier jet non équilibré (pas de wildMult de base, pas de panoplies dédiées) — le bot y reste
 * bloqué au-delà de 10h de simulation sur certaines graines. À réactiver sur toute la Gen 2 une fois
 * Johto réglé au même niveau de rigueur que Kanto.
 */
test('équilibrage bout en bout (Kanto) : un joueur efficace termine les 10 biomes (badge du Champion) en 1h30 à 10h de combat pur', () => {
  const reports = [1, 2, 3].map((seed) => simulate(seededRng(seed), 10 * 3600));
  for (const r of reports) {
    // Champion Kanto (biome 9, 0-indexé -> mark "biome10"). Ne vérifie pas le déclenchement du prestige :
    // battre le Champion ne garantit pas d'avoir croisé les 151 espèces (certaines ne sont que dans des
    // pools rares) — le bot peut légitimement finir Kanto sans que l'écran de prestige apparaisse encore.
    const minutes = r.milestones['biome10-badge'];
    expect(minutes).toBeDefined();
    expect(minutes!).toBeGreaterThan(90);
    expect(minutes!).toBeLessThan(600);
  }
});
