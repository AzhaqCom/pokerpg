import { boxExcess, boxProgress, collectionNeeds, completeBox, needsXpForBox, needTracker, wantedForBox } from '../collection';
import { addMon, chooseStarter, makeMon, newGame } from '../game';
import { seededRng } from '../rng';

function kanto() {
  const s = newGame();
  chooseStarter(s, 4, seededRng(1)); // Salamèche en équipe
  addMon(s, makeMon(16, 5, seededRng(98))); // équipe complète (Roucool, Rattata) : les suivants vont en boîte
  addMon(s, makeMon(19, 5, seededRng(99)));
  return s;
}

describe('collection « boîte complète »', () => {
  test('lignée à 3 étages : il faut 3 Bulbizarre au total', () => {
    const s = kanto();
    expect(collectionNeeds(s, false).get(1)).toBe(3); // aucun Bulbizarre : 3 à capturer
    addMon(s, makeMon(1, 5, seededRng(2)));
    expect(collectionNeeds(s, false).get(1)).toBe(2);
    addMon(s, makeMon(3, 40, seededRng(3))); // un Florizarre capturé directement
    expect(collectionNeeds(s, false).get(1)).toBe(1); // reste de quoi faire Herbizarre
    expect(wantedForBox(s, 2, false)).toBe(true); // capturer Herbizarre directement aide aussi
  });

  test('lignée à branches : Évoli (3 formes à Kanto) demande 4 Évoli', () => {
    const s = kanto();
    expect(collectionNeeds(s, false).get(133)).toBe(4); // Évoli + Aquali, Voltali, Pyroli
  });

  test('doublons : garde la matière nécessaire, relâche le reste', () => {
    const s = kanto();
    for (let i = 0; i < 5; i++) addMon(s, makeMon(1, 5, seededRng(10 + i)));
    expect(boxExcess(s, 'box').length).toBe(2); // 5 Bulbizarre, 3 utiles
  });

  test('Compléter la boîte : fait évoluer la matière au bon niveau, garde le 1er exemplaire', () => {
    const s = kanto();
    for (let i = 0; i < 3; i++) addMon(s, makeMon(1, 40, seededRng(20 + i)));
    expect(completeBox(s, 'box', true)).toBe(1);
    completeBox(s, 'box');
    const ids = Object.values(s.mons).map((m) => m.speciesId);
    expect(ids).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(collectionNeeds(s, false).get(1)).toBe(0);
  });

  test('Besoin d\'XP : la matière trop basse de niveau est signalée, pas le 1er exemplaire', () => {
    const s = kanto();
    for (let i = 0; i < 3; i++) addMon(s, makeMon(1, 5, seededRng(30 + i)));
    expect(needsXpForBox(s, 'box').size).toBe(2);
  });

  test('suivi hors ligne et compteur de la boîte', () => {
    const s = kanto();
    const t = needTracker(s, false);
    expect(t.wants(1)).toBe(true);
    t.add(1); t.add(1); t.add(1);
    expect(t.wants(1)).toBe(false);
    const p = boxProgress(s);
    expect(p.total).toBe(151);
    expect(p.normal).toBe(3); // Salamèche, Roucool, Rattata
  });
});

test('objectif « boîte » : garde le meilleur en gènes, même plus bas niveau (même règle que « Nettoyer les doublons »)', () => {
  // Tauros : sans évolution, aucun exemplaire n'est gardé comme matière d'évolution
  const s = newGame();
  chooseStarter(s, 4, seededRng(1));
  const good = makeMon(128, 10, seededRng(2)); good.genes = { hp: 15, atk: 15, def: 14, spe: 15 }; // 59/60, 3★
  const meh = makeMon(128, 40, seededRng(3)); meh.genes = { hp: 12, atk: 12, def: 12, spe: 12 }; // 48/60, 3★, plus haut niveau
  addMon(s, good); addMon(s, meh);
  s.team = [s.team[0]];
  const excess = boxExcess(s, 'box');
  expect(excess.map((m) => m.uid)).toContain(meh.uid);
  expect(excess.map((m) => m.uid)).not.toContain(good.uid);
});
