import { BERRY_HEAL_CAP, berryHeal, berryHpPct, BIOME_SET, CRIT_BY_RARITY, SETS, bonusCritValue, combatValue, TEMPLATES, addItemBonuses, canFuse, convertFlatSub, flatBonus, recycleRefund, upgradeCost, SUB_WORTH, setBonusText, subRollRef, subScore, subTier, fuse, itemScore, makeItem, mainValue, recycleValue, rerollSub, rollLoot, setOfBiome, subRange, template, upgrade, subMax, statText } from '../items';
import { BonusStat, Item, critOverflow, emptyBonuses } from '../model';
import { seededRng } from '../rng';
import { BIOMES } from '../content';
import { newGame, upgradeItem } from '../game';
import { ACTION_LOCK, actionLock, cdFactor } from '../battle';

const rng = seededRng(7);

test('baies : soin plafonné à 100 %, chaque cran au-delà de +8 donne des PV % (2026-10-07)', () => {
  const berry = (plus: number, level: number) => {
    const it: Item = { uid: `b${plus}`, templateId: 'pecha', rarity: 6, level, subs: [] };
    if (plus) it.plus = plus;
    return it;
  };
  // jusqu'à +8 : comme avant (25 % × 2,4 = 60 %, … 25 % × 4,0 = 100 %), aucun PV
  expect([0, 4, 8].map((p) => berryHeal(berry(p, 300)))).toEqual([60, 80, 100]);
  expect([0, 8].map((p) => berryHpPct(berry(p, 300)))).toEqual([0, 0]);
  // au-delà : soin bloqué à 100 %, PV % = 8,45 × niveau × 0,2 par cran (objet défensif PV de la Tour)
  expect(berryHeal(berry(9, 300))).toBe(BERRY_HEAL_CAP);
  expect(berryHeal(berry(17, 1300))).toBe(BERRY_HEAL_CAP);
  const lvl = 1 + 0.08 * 1299;
  expect(berryHpPct(berry(17, 1300))).toBeCloseTo((5.6 * 1.6 / 1.06) * lvl * 1.8, 0); // ~1 600 %
  expect(mainValue(berry(17, 1300))).toBe(berryHpPct(berry(17, 1300)));
  // chaque cran au-delà de +8 vaut un cran d'un objet défensif PV de la Tour
  const cape = (plus: number) => {
    const it = makeItem('toison-prairie', 6, 1300, seededRng(1), BIOMES.length - 1);
    it.plus = plus;
    return mainValue(it);
  };
  expect(berryHpPct(berry(17, 1300)) - berryHpPct(berry(16, 1300))).toBeCloseTo(cape(17) - cape(16), 0);
  // compté dans les bonus du porteur, et dans le score de la baie (fusion, tri)
  const b = emptyBonuses();
  addItemBonuses(b, [berry(17, 1300)]);
  expect(b.hpPct).toBe(berryHpPct(berry(17, 1300)));
  expect(itemScore(berry(10, 300))).toBeGreaterThan(itemScore(berry(9, 300)));
});

test('rareté : nombre de bonus secondaires', () => {
  expect(makeItem('griffe-sylve', 0, 5, rng).subs).toHaveLength(0);
  expect(makeItem('griffe-sylve', 3, 5, rng).subs).toHaveLength(2);
  expect(makeItem('griffe-sylve', 6, 5, rng).subs).toHaveLength(3);
});

test('fusion 3 → 1 : même objet et même rareté uniquement', () => {
  const a = makeItem('griffe-sylve', 1, 4, rng), b = makeItem('griffe-sylve', 1, 7, rng), c = makeItem('griffe-sylve', 1, 5, rng);
  expect(canFuse([a, b, c])).toBe(true);
  expect(canFuse([a, b, makeItem('griffe-sylve', 2, 5, rng)])).toBe(false);
  expect(canFuse([a, b, makeItem('cape-sylve', 1, 5, rng)])).toBe(false);
  expect(canFuse([a, a, b])).toBe(false);
  const f = fuse([a, b, c], rng);
  expect(f.rarity).toBe(2);
  expect(f.level).toBe(7);
  expect(mainValue(f)).toBeGreaterThan(mainValue(b));
});

test('Chromatique = rareté maximale, plus de fusion', () => {
  const x = [0, 1, 2].map(() => makeItem('griffe-sylve', 6, 1, rng));
  expect(canFuse(x)).toBe(false);
});

test('niveau et recyclage', () => {
  const it = makeItem('cape-sylve', 2, 3, rng);
  expect(mainValue(upgrade(it))).toBeGreaterThan(mainValue(it));
  expect(recycleValue(makeItem('cape-sylve', 4, 1, rng))).toBeGreaterThan(recycleValue(it));
});

test('panoplie Sylvestre : bonus à 2 et 3 pièces', () => {
  const b2 = emptyBonuses();
  addItemBonuses(b2, [makeItem('griffe-sylve', 0, 1, rng), makeItem('cape-sylve', 0, 1, rng)]);
  expect(b2.atkPct).toBeCloseTo(6 + 8);
  const b3 = emptyBonuses();
  addItemBonuses(b3, [makeItem('griffe-sylve', 0, 1, rng), makeItem('cape-sylve', 0, 1, rng), makeItem('baie-sylve', 0, 1, rng)]);
  expect(b3.lifestealPct).toBe(SETS.sylve.three.value);
});

describe('panoplies réutilisées par thème (Hoenn) et puissance par région', () => {
  const score = (it: ReturnType<typeof makeItem>) => itemScore({ ...it, subs: [] });
  const offense = (biome: number) => {
    const key = BIOME_SET[biome] ?? Object.keys(SETS).find((k) => SETS[k].biome === biome)!;
    const t = TEMPLATES.find((x) => x.set === key && x.slot === 'offense')!;
    return makeItem(t.id, 3, 50, seededRng(1), biome);
  };
  const defense = (biome: number) => {
    const key = BIOME_SET[biome] ?? Object.keys(SETS).find((k) => SETS[k].biome === biome)!;
    const t = TEMPLATES.find((x) => x.set === key && x.slot === 'defense')!;
    return makeItem(t.id, 3, 50, seededRng(1), biome);
  };

  test('chaque biome Hoenn a une panoplie complète (offensif, défensif, baie)', () => {
    for (let b = 20; b <= 31; b++) {
      const key = setOfBiome(b)!;
      expect(TEMPLATES.filter((t) => t.set === key).map((t) => t.slot).sort()).toEqual(['berry', 'defense', 'offense']);
    }
  });

  test('le 1er biome d’une région est calé sur le 1er biome de Kanto, à niveau et rareté égaux', () => {
    expect(score(offense(20))).toBeCloseTo(score(offense(0)), 0);
    expect(score(defense(20))).toBeCloseTo(score(defense(0)), 0);
  });

  test('le dernier biome vaut environ +60 % du 1er, Kanto et Johto restent inchangés (tier 1)', () => {
    expect(score(offense(31)) / score(offense(20))).toBeGreaterThan(1.55);
    expect(score(offense(31)) / score(offense(20))).toBeLessThan(1.65);
    expect(offense(0).tier).toBeUndefined();
    expect(offense(15).tier).toBeUndefined();
  });

  test('rollLoot dans un biome Hoenn tire dans la panoplie du thème, avec son facteur de puissance', () => {
    const it = rollLoot(seededRng(7), 10, 27);
    expect(template(it.templateId).set).toBe('ciel');
  });

  test('la fusion garde le facteur de puissance', () => {
    const t = TEMPLATES.find((x) => x.id === 'poing-aride')!;
    const items = [1, 2, 3].map((i) => makeItem(t.id, 0, 5, seededRng(i), 24));
    expect(fuse(items, seededRng(9)).tier).toBe(items[0].tier);
  });
});

describe('valeur de combat des équipements (poids mesurés)', () => {
  const b = (o: Partial<ReturnType<typeof emptyBonuses>>) => ({ ...emptyBonuses(), ...o });
  test('Dégâts critiques : presque rien sans Critique, beaucoup avec', () => {
    const sansCrit = combatValue(b({ critDmgPct: 20 }));
    const avecCrit = combatValue(b({ critPct: 50, critDmgPct: 20 })) - combatValue(b({ critPct: 50 }));
    expect(sansCrit).toBeLessThan(2);
    expect(avecCrit).toBeGreaterThan(sansCrit * 5);
  });
  test('ordre des stats conforme aux mesures : Attaque ≈ Défense ≈ PV, Vitesse forte à faible dose, Recharge plus faible', () => {
    const v = (k: string, x = 20) => combatValue(b({ [k]: x }));
    expect(Math.abs(v('atkPct') - v('defPct'))).toBeLessThan(2);
    expect(v('atkPct')).toBeGreaterThan(v('critPct'));
    expect(v('spePct', 15)).toBeGreaterThan(v('cdrPct', 15));
    expect(v('spePct', 15)).toBeLessThan(v('atkPct', 15) * 1.5);
  });
  test('Vitesse et Recharge : sans plafond, mais à rendement décroissant (2026-10-01)', () => {
    for (const k of ['spePct', 'cdrPct']) {
      const at = (x: number) => combatValue(b({ [k]: x }));
      expect(at(60)).toBeGreaterThan(at(40));
      expect(at(200)).toBeGreaterThan(at(100));
      expect(at(40) - at(20)).toBeGreaterThan(at(220) - at(200));
    }
  });
});

describe('Critique : objets mixtes et surplus converti en Dégâts critiques', () => {
  test('un objet Critique mixte donne une Critique fixe par rareté + des Dégâts critiques qui grimpent avec le niveau', () => {
    const low = makeItem('croc-givre', 4, 10, seededRng(1));
    const high = makeItem('croc-givre', 4, 100, seededRng(1));
    expect(bonusCritValue(low)).toBe(CRIT_BY_RARITY[4]);
    expect(bonusCritValue(high)).toBe(CRIT_BY_RARITY[4]); // ne grimpe pas avec le niveau
    expect(mainValue(high)).toBeGreaterThan(mainValue(low));
    const b = emptyBonuses();
    addItemBonuses(b, [{ ...high, subs: [] }]);
    expect(b.critPct).toBe(CRIT_BY_RARITY[4]);
    expect(b.critDmgPct).toBe(mainValue(high));
  });

  test('ses secondaires ne tirent jamais Critique ni Dégâts critiques (déjà dans la stat principale)', () => {
    for (let seed = 0; seed < 40; seed++) {
      const it = makeItem('bec-ciel', 6, 50, seededRng(seed));
      expect(it.subs.some((sub) => sub.stat === 'critPct' || sub.stat === 'critDmgPct')).toBe(false);
    }
  });

  test('en fin de partie, un objet Critique mixte vaut à peu près l’objet Attaque équivalent (plus 6 fois moins)', () => {
    const base = { ...emptyBonuses(), critPct: 24, critDmgPct: 20 };
    const gain = (id: string) => { const b = { ...base }; addItemBonuses(b, [{ ...makeItem(id, 4, 100, seededRng(2)), subs: [] }]); return combatValue(b) - combatValue(base); };
    const atkEquivalent = (() => { const b = { ...base, atkPct: base.atkPct + 15.9 * 0.54 * (1 + 0.08 * 99) * 2 }; return combatValue(b) - combatValue(base); })();
    expect(gain('croc-givre') / atkEquivalent).toBeGreaterThan(0.85);
    expect(gain('croc-givre') / atkEquivalent).toBeLessThan(1.2);
  });

  test('surplus de Critique au-delà de 100 % : converti 1 pour 1 en Dégâts critiques', () => {
    expect(critOverflow(80)).toBe(0);
    expect(critOverflow(150)).toBe(50);
    const capped = { ...emptyBonuses(), critPct: 94 }; // 6 + 94 = 100 %
    const over = { ...emptyBonuses(), critPct: 144 }; // 150 % : 50 de surplus
    const sameAsDmg = { ...emptyBonuses(), critPct: 94, critDmgPct: 50 };
    expect(combatValue(over)).toBeGreaterThan(combatValue(capped));
    expect(combatValue(over)).toBeCloseTo(combatValue(sameAsDmg), 6);
  });
});

test('amélioration plafonnée au niveau 100', () => {
  const s = newGame();
  s.shards = 1e9;
  const it = makeItem('griffe-sylve', 2, 99, seededRng(1));
  s.items[it.uid] = it;
  expect(upgradeItem(s, it.uid)).toBe(true);
  expect(s.items[it.uid].level).toBe(100);
  expect(upgradeItem(s, it.uid)).toBe(false);
  expect(s.items[it.uid].level).toBe(100);
});

describe('Vitesse = cadence, Recharge sans plafond (2026-10-01)', () => {
  test('cdFactor : Recharge à rendement décroissant, sans plafond ; actionLock : les bonus de Vitesse raccourcissent l’action', () => {
    expect(cdFactor(0, 100)).toBeCloseTo(0.5, 6);
    expect(cdFactor(0, 300)).toBeCloseTo(0.25, 6); // plus de plafond à 40 %
    expect(cdFactor(100, 0)).toBeCloseTo(0.5, 6);
    expect(actionLock(0)).toBeCloseTo(ACTION_LOCK, 6); // sauvages : aucun bonus, cadence inchangée
    expect(actionLock(100)).toBeCloseTo(ACTION_LOCK / 2, 6);
    expect(actionLock(-50)).toBeCloseTo(ACTION_LOCK, 6);
  });
  test('objets mixtes : stat principale réduite + bonus de Vitesse / Recharge qui grimpe lentement, exclu des secondaires', () => {
    for (const [id, stat] of [['nageoire-maree', 'spePct'], ['semelle-circuit', 'spePct'], ['plume-ciel', 'spePct'], ['voile-oeil', 'cdrPct'], ['voile-brume', 'cdrPct']] as const) {
      const low = makeItem(id, 4, 10, seededRng(1));
      const high = makeItem(id, 4, 100, seededRng(1));
      expect(flatBonus(low)!.stat).toBe(stat);
      expect(flatBonus(high)!.value).toBeGreaterThan(flatBonus(low)!.value);
      expect(flatBonus(high)!.value / flatBonus(low)!.value).toBeLessThan(mainValue(high) / mainValue(low)); // plus lent
      for (let seed = 0; seed < 20; seed++) expect(makeItem(id, 6, 50, seededRng(seed)).subs.some((s) => s.stat === stat)).toBe(false);
      const b = emptyBonuses();
      addItemBonuses(b, [{ ...high, subs: [] }]);
      expect(b[stat]).toBe(flatBonus(high)!.value);
    }
  });
  test('sous-stats Vitesse / Recharge : croissance lente avec le niveau ; anciennes valeurs converties en gardant la qualité du jet', () => {
    const lv = (stat: string, level: number) => {
      for (let seed = 0; seed < 400; seed++) { const s = makeItem('griffe-sylve', 6, level, seededRng(seed)).subs.find((x) => x.stat === stat); if (s) return s.value; }
      return NaN;
    };
    expect(lv('spePct', 120)).toBeLessThan(30); // avant : ~+130 %
    expect(convertFlatSub('spePct', 17.1 * (1 + 0.08 * 119), 120)).toBeCloseTo(convertFlatSub('spePct', 1e9, 120), 6); // jet max → jet max
    expect(convertFlatSub('cdrPct', 7 * (1 + 0.08 * 49), 50)).toBeLessThan(convertFlatSub('cdrPct', 10 * (1 + 0.08 * 49), 50));
    expect(convertFlatSub('atkPct', 12.3, 50)).toBe(12.3); // les autres sous-stats ne bougent pas
  });
});

describe('valeurs mesurées des sous-stats (2026-10-01)', () => {
  test('fusion : garde les sous-stats qui valent le plus, pas les plus gros chiffres', () => {
    const mk = (subs: { stat: any; value: number }[]) => ({ ...makeItem('griffe-sylve', 4, 100, seededRng(1)), subs });
    const lvl = 1 + 0.08 * 99;
    // Dégâts critiques : gros chiffre mais jet moyen ; PV : petit chiffre mais jet moyen d'une stat qui vaut plus
    const a = mk([{ stat: 'critDmgPct', value: 10 * lvl * 0.85 }, { stat: 'critPct', value: 5.6 * lvl * 0.85 }]);
    const b = mk([{ stat: 'hpPct', value: 2.6 * lvl * 0.85 }, { stat: 'cdrPct', value: 30 }]);
    const c = mk([{ stat: 'spePct', value: 7 * Math.sqrt(lvl) * 0.85 }]);
    const out = fuse([a, b, c], seededRng(2));
    expect(out.subs.map((s) => s.stat).sort()).toEqual(['critDmgPct', 'hpPct', 'spePct']); // pas la Critique ni la Recharge
  });
  test('couleurs (recalées le 2026-10-02) : vert PV, Type, Vitesse, Attaque ; jaune Défense ; gris sinon', () => {
    expect(['hpPct', 'typeDmgPct', 'spePct', 'atkPct'].map((k) => subTier(k as any))).toEqual(['top', 'top', 'top', 'top']);
    expect(subTier('defPct')).toBe('good');
    expect(['critDmgPct', 'critPct', 'cdrPct'].every((k) => subTier(k as any) === 'low')).toBe(true);
    expect(subScore('hpPct', 2 * subRollRef('hpPct', 50), 50)).toBeCloseTo(2 * SUB_WORTH.hpPct, 6);
  });
});

test('bonus de panoplie : grimpent avec le niveau de la pièce la plus basse, jamais sous la valeur fixe d’avant (2026-10-01)', () => {
  const at = (level: number, lowest = level) => {
    const b = emptyBonuses();
    addItemBonuses(b, [{ ...makeItem('griffe-sylve', 0, lowest, rng), subs: [] }, { ...makeItem('cape-sylve', 0, level, rng), subs: [] }]);
    return b.atkPct - mainValue(makeItem('griffe-sylve', 0, lowest, rng));
  };
  expect(at(1)).toBe(8); // plancher
  expect(at(100)).toBeGreaterThan(20);
  expect(at(200)).toBeGreaterThan(at(100));
  expect(at(200, 10)).toBeLessThan(at(200)); // une vieille pièce basse bride le bonus
  expect(setBonusText('sylve', 'two', 100)).toMatch(/^Attaque \+[\d.]+ %$/);
});

describe('recyclage revalorisé et remboursement des améliorations (2026-10-01)', () => {
  const at = (rarity: number, level: number, plus = 0) => ({ ...makeItem('griffe-sylve', rarity, level, rng), ...(plus ? { plus } : {}) });
  test('valeur : la plus grande entre l’ancienne formule et 10 % d’un niveau d’amélioration (début de partie inchangé)', () => {
    expect(recycleValue(at(0, 20))).toBe(22);
    expect(recycleValue(at(3, 50))).toBe(100);
    expect(recycleValue(at(6, 200))).toBe(700);
    expect(recycleValue(at(6, 400, 4))).toBe(2200);
  });
  test('améliorer à la main : 50 % des éclats rendus au recyclage, jamais plus que dépensé ; la fusion additionne', () => {
    const s = newGame();
    const it = at(6, 80); // sous le niveau maximum (100) d'une partie sans fin de jeu
    s.items[it.uid] = it;
    s.shards = 1e9;
    const before = recycleValue(it);
    let spent = 0;
    for (let i = 0; i < 10; i++) { const c = upgradeCost(s.items[it.uid]); expect(upgradeItem(s, it.uid)).toBe(true); spent += c; }
    const up = s.items[it.uid];
    expect(up.invested).toBe(spent);
    expect(recycleRefund(up)).toBe(Math.floor(spent / 2));
    expect(recycleValue(up) - before).toBeLessThan(spent); // améliorer pour recycler fait toujours perdre
    const mates = [1, 2].map(() => ({ ...at(6, 80), invested: 1000 }));
    const out = fuse([up, ...mates], seededRng(3), true); // Chromatique → +1 : fin de jeu
    expect(out.invested).toBe(spent + 2000);
  });
});

test('fusion : le cadenas d’un objet verrouillé est conservé sur le résultat', () => {
  const items = [1, 2, 3].map((i) => makeItem('griffe-sylve', 2, 20, seededRng(i)));
  items[1].locked = true;
  expect(fuse(items, seededRng(9)).locked).toBe(true);
  expect(fuse([1, 2, 3].map((i) => makeItem('griffe-sylve', 2, 20, seededRng(i))), seededRng(9)).locked).toBeUndefined();
});

describe('sous-stats : fourchette, changement à 85-100 %, fusion recalée (2026-10-02)', () => {
  // les valeurs sont arrondies au dixième : comparaisons à 0,1 près (0,15 quand deux arrondis s'enchaînent)
  const near = (a: number, b: number, tol = 0.1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

  test('fourchette : 70 à 100 % du jet maximum, +10 % par cran +N', () => {
    const r = subRange('atkPct', 100);
    near(r.max, 3 * (1 + 0.08 * 99));
    near(r.min, r.max * 0.7);
    near(subRange('atkPct', 100, 2).max, r.max * 1.2);
    // un jet du butin tombe toujours dans la fourchette
    for (let i = 0; i < 50; i++) {
      const it = makeItem('griffe-sylve', 6, 60, seededRng(200 + i));
      for (const s of it.subs) {
        const { min, max } = subRange(s.stat, 60);
        expect(s.value).toBeGreaterThanOrEqual(min - 0.05);
        expect(s.value).toBeLessThanOrEqual(max + 0.05);
      }
    }
  });

  test('changer une sous-stat : nouveau jet entre 85 et 100 % du maximum, cran +N compris', () => {
    const base: Item = { ...makeItem('griffe-sylve', 6, 150, seededRng(3)), plus: 3 };
    for (let i = 0; i < 200; i++) {
      const sub = rerollSub(base, 0, seededRng(1000 + i)).subs[0];
      const { max } = subRange(sub.stat, 150, 3);
      expect(sub.value).toBeGreaterThanOrEqual(max * 0.85 - 0.1);
      expect(sub.value).toBeLessThanOrEqual(max + 0.1);
    }
  });

  test('fusion : une sous-stat venue d’une pièce plus basse est remise au niveau de l’objet obtenu', () => {
    const mk = (level: number, stat: BonusStat, roll: number): Item =>
      ({ ...makeItem('griffe-sylve', 2, level, seededRng(level)), subs: [{ stat, value: subRange(stat, level).max * roll }] });
    const out = fuse([mk(10, 'hpPct', 1), mk(10, 'typeDmgPct', 1), mk(50, 'defPct', 0.7)], seededRng(4));
    expect(out.level).toBe(50);
    expect(out.subs.map((s) => s.stat).sort()).toEqual(['hpPct', 'typeDmgPct']);
    // jet maximum au Nv.10 → jet maximum au Nv.50 (avant : la valeur du Nv.10, sous le minimum de l'objet obtenu)
    near(out.subs.find((s) => s.stat === 'hpPct')!.value, subRange('hpPct', 50).max, 0.15);
    near(out.subs.find((s) => s.stat === 'typeDmgPct')!.value, subRange('typeDmgPct', 50).max, 0.15);
  });
});

test('amélioration : une sous-stat garde sa place dans sa fourchette de Nv.1 à 1 000, sans dérive d’arrondis (2026-10-02)', () => {
  // avant : arrondie au dixième à chaque niveau, une sous-stat pouvait se décaler de 33 points de jet de Nv.1 à 300
  // (sortir de sa fourchette ou perdre de la valeur), ~100 à Nv.1 000 (la Vitesse restait bloquée)
  const stats: BonusStat[] = ['atkPct', 'defPct', 'hpPct', 'spePct', 'critPct', 'critDmgPct', 'typeDmgPct', 'cdrPct'];
  for (const stat of stats) for (const plus of [0, 3]) for (const roll of [70, 85, 100]) {
    let it: Item = { uid: 'x', templateId: 'griffe-sylve', rarity: 6, level: 1, plus, subs: [{ stat, value: (subMax(stat, 1, plus) * roll) / 100 }] };
    for (let l = 1; l < 1000; l++) it = upgrade(it);
    const max = subMax(stat, 1000, plus);
    const v = it.subs[0].value;
    expect(Math.abs((v / max) * 100 - roll)).toBeLessThan(0.5);
    expect(v).toBeLessThanOrEqual(max + 0.001);
    expect(v).toBeGreaterThanOrEqual(max * 0.7 - 0.001);
  }
});

test('sous-stats : gardées à 3 décimales, affichées au dixième', () => {
  expect(statText('atkPct', 106.2345)).toBe('Attaque +106.2 %');
  const it = makeItem('griffe-sylve', 6, 250, seededRng(5));
  expect(it.subs.every((s) => Math.abs(s.value * 1000 - Math.round(s.value * 1000)) < 1e-6)).toBe(true);
});
