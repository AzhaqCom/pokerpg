import { ALL_SPECIES } from '../data';
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
  expect(eligibleAffinityTypes(27)).toEqual(['normal', 'poison']); // Sabelette : 2 options
  expect(eligibleAffinityTypes(27, ['normal'])).toEqual(['poison']); // la 2e case ne propose plus Normal
  // Dracaufeu n'a qu'une seule option : l'exclure ne bloque pas l'emplacement, elle reste proposée
  expect(eligibleAffinityTypes(6, ['normal'])).toEqual(['normal']);
});

test('eligibleAffinityTypes : ignore les types qui ne viennent que d’une capacité de statut/buff/soin (aucun dégât à booster)', () => {
  // Roucarnage (Normal/Vol) ne connaît qu'une capacité Psy : Hâte, un buff de vitesse sans dégâts —
  // la proposer comme affinité offensive serait un bonus totalement inutile.
  expect(eligibleAffinityTypes(18)).not.toContain('psychic');
});

test('eligibleAffinityTypes : se replie sur son/ses propre(s) type(s) si aucune attaque offensive hors-type', () => {
  // Rondoudou (Normal pur) n'a aucune capacité offensive hors Normal dans son movepool : mieux vaut
  // booster son vrai type que de bloquer l'emplacement (`AMÉLIORATIONS` du 2026-09-22).
  expect(eligibleAffinityTypes(39)).toEqual(['normal']);
  // Roucarnage (Normal/Vol), même cas mais bi-type : les deux types propres sont proposés.
  expect(eligibleAffinityTypes(18)).toEqual(['normal', 'flying']);
});

test('eligibleAffinityTypes : jamais aucune option, pour aucune des 151 espèces', () => {
  for (const sp of ALL_SPECIES) expect(eligibleAffinityTypes(sp.id).length).toBeGreaterThan(0);
});

test('talentTree : paliers 6-9, rang max 10, débloqués à 60/70/80/90 points, la somme de tous les rangs max fait pile 100', () => {
  const tree = talentTree(['fire', 'flying']); // Dracaufeu
  const newTiers = ['spec2', 'spec3', 'fury', 'deadly'];
  for (const id of newTiers) {
    const t = tree.find((x) => x.id === id)!;
    expect(t.maxRank).toBe(10);
  }
  expect(TIER_REQ[tree.find((t) => t.id === 'spec2')!.tier]).toBe(60);
  expect(TIER_REQ[tree.find((t) => t.id === 'spec3')!.tier]).toBe(70);
  expect(TIER_REQ[tree.find((t) => t.id === 'fury')!.tier]).toBe(80);
  expect(TIER_REQ[tree.find((t) => t.id === 'deadly')!.tier]).toBe(90);
  expect(tree.find((t) => t.id === 'fury')!.stat).toBe('atkPct');
  expect(tree.find((t) => t.id === 'deadly')!.stat).toBe('critPct');
  const total = tree.reduce((a, t) => a + t.maxRank, 0);
  expect(total).toBe(100); // pile de quoi maxer tout à Nv.100
});

test('talentTree : palier 7 (spec3) exploite le type secondaire pour un bi-type, sinon redouble la 2e saveur', () => {
  const dracaufeu = talentTree(['fire', 'flying']); // bi-type : Vol (Esquive aérienne) jamais exploité ailleurs
  expect(dracaufeu.find((t) => t.id === 'spec3')!.name).toBe('Esquive aérienne');
  expect(dracaufeu.find((t) => t.id === 'spec3')!.stat).toBe('dodgePct');

  const rondoudou = talentTree(['normal']); // mono-type : pas de 2e type, redouble « Ruée » (palier 6)
  expect(rondoudou.find((t) => t.id === 'spec2')!.name).toBe('Ruée');
  expect(rondoudou.find((t) => t.id === 'spec3')!.name).toBe('Ruée');
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
