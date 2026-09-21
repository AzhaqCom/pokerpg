import { emptyBonuses } from '../model';
import { AFFINITY_MAX_RANK, MAX_RANK, TIER_REQ, addTalentBonuses, eligibleAffinityTypes, talentPoints, talentTree } from '../talents';

test('talentTree : la description de "Puissance" liste tous les types (double type inclus)', () => {
  const dual = talentTree(['fire', 'flying']); // Dracaufeu
  const power = dual.find((t) => t.id === 'power')!;
  expect(power.name).toBe('Puissance Feu'); // le nom garde le type primaire
  expect(power.describe(20)).toBe('Dégâts Feu et Vol +20 %'); // la description reflète les deux types

  const single = talentTree(['grass']); // type unique
  expect(single.find((t) => t.id === 'power')!.describe(12)).toBe('Dégâts Plante +12 %');
});

test('talentTree : paliers 4/5 (Affinité), rang max 15, débloqués à 20/40 points', () => {
  const tree = talentTree(['fire', 'flying']);
  const a1 = tree.find((t) => t.id === 'affinity1')!;
  const a2 = tree.find((t) => t.id === 'affinity2')!;
  expect(a1.chooseType).toBe(true);
  expect(a2.chooseType).toBe(true);
  expect(a1.maxRank).toBe(AFFINITY_MAX_RANK);
  expect(a2.maxRank).toBe(AFFINITY_MAX_RANK);
  expect(TIER_REQ[a1.tier]).toBe(20);
  expect(TIER_REQ[a2.tier]).toBe(40);
  // les 6 talents d'origine gardent leur rang max de 5
  expect(tree.find((t) => t.id === 'power')!.maxRank).toBe(MAX_RANK);
});

test('eligibleAffinityTypes : types du movepool complet, hors des types propres du Pokémon', () => {
  expect(eligibleAffinityTypes(6)).toEqual(['normal']); // Dracaufeu (Feu/Vol) : que du Normal en dehors des siens
});

test('eligibleAffinityTypes : exclut un type déjà pris ailleurs, sauf si ça ne laisserait plus rien', () => {
  expect(eligibleAffinityTypes(25)).toEqual(['normal', 'psychic']); // Pikachu : 2 options
  expect(eligibleAffinityTypes(25, ['normal'])).toEqual(['psychic']); // la 2e case ne propose plus Normal
  // Dracaufeu n'a qu'une seule option : l'exclure ne bloque pas l'emplacement, elle reste proposée
  expect(eligibleAffinityTypes(6, ['normal'])).toEqual(['normal']);
});

test('talentPoints : autant que de niveaux (level - 1), +1 bonus au niveau 100, plus de plafond à 30', () => {
  expect(talentPoints(1)).toBe(0);
  expect(talentPoints(31)).toBe(30); // l'ancien plafond ne s'applique plus
  expect(talentPoints(99)).toBe(98);
  expect(talentPoints(100)).toBe(100); // +1 bonus, pile 100 points à Nv.100
});

test('addTalentBonuses : un talent « au choix » alimente `affinities`, pas la stat générique', () => {
  const b = emptyBonuses();
  addTalentBonuses(b, ['fire', 'flying'], { affinity1: 4 }, { affinity1: 'normal' });
  expect(b.typeDmgPct).toBe(0); // pas touché : les autres talents "typeDmgPct" restent séparés
  expect(b.affinities).toEqual([{ type: 'normal', pct: 12 }]); // 4 rangs × 3 %/rang
});

test('addTalentBonuses : un talent « au choix » entamé mais sans type mémorisé (donnée corrompue) ne plante pas', () => {
  const b = emptyBonuses();
  addTalentBonuses(b, ['fire', 'flying'], { affinity1: 4 }, {});
  expect(b.affinities).toEqual([]);
});
