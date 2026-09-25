import { BIOME_SET, CRIT_BY_RARITY, SETS, bonusCritValue, combatValue, TEMPLATES, addItemBonuses, canFuse, fuse, itemScore, makeItem, mainValue, recycleValue, rollLoot, setOfBiome, template, upgrade } from '../items';
import { critOverflow, emptyBonuses } from '../model';
import { seededRng } from '../rng';

const rng = seededRng(7);

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
  test('ordre des stats conforme aux mesures : Attaque ≈ Défense ≈ PV > Critique > Recharge > Vitesse', () => {
    const v = (k: string) => combatValue(b({ [k]: 20 }));
    expect(Math.abs(v('atkPct') - v('defPct'))).toBeLessThan(2);
    expect(v('atkPct')).toBeGreaterThan(v('critPct'));
    expect(v('critPct')).toBeGreaterThan(v('cdrPct'));
    expect(v('cdrPct')).toBeGreaterThan(v('spePct'));
  });
  test('Recharge plafonnée à 40 % comme en combat', () => {
    expect(combatValue(b({ cdrPct: 60 }))).toBeCloseTo(combatValue(b({ cdrPct: 40 })), 5);
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
