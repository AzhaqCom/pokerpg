import { boxExcess, boxProgress, collectionNeeds, completeBox, missingForms, needsXp, needsXpForBox, needTracker, wantedForBox } from '../collection';
import { addMon, assignPension, chooseStarter, makeMon, newGame } from '../game';
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

describe('« Besoin d’XP » : le nombre nécessaire, sans remplaçant (2026-10-02)', () => {
  const inPension = (s: ReturnType<typeof kanto>, uid: string) => s.pension.some((p) => p.uid === uid);

  test('boîte + ✨ : un Pokémon mis en pension reste compté, aucun autre n’est proposé à sa place', () => {
    const s = kanto();
    for (let i = 0; i < 6; i++) { const m = makeMon(1, 5 + i, seededRng(40 + i)); m.shiny = true; addMon(s, m); }
    const bulbs = () => [...needsXp(s, 'boxShiny')].filter((u) => s.mons[u].speciesId === 1 && s.mons[u].shiny);
    expect(bulbs()).toHaveLength(2); // Herbizarre ✨ et Florizarre ✨ manquent : 2 Bulbizarre ✨ évolueront, 1 reste
    const [first, second] = bulbs();
    assignPension(s, first, 100);
    expect(bulbs().sort()).toEqual([first, second].sort()); // avant : le posté disparaissait, un autre le remplaçait
    assignPension(s, second, 100);
    expect(bulbs().sort()).toEqual([first, second].sort());
    expect(bulbs().filter((u) => !inPension(s, u))).toHaveLength(0); // plus rien à placer
  });

  test('équipe : un membre de l’équipe qui doit évoluer est compté (il gagne déjà de l’XP)', () => {
    const s = kanto();
    for (let i = 0; i < 3; i++) addMon(s, makeMon(1, 5, seededRng(50 + i)));
    const teamBulb = makeMon(1, 6, seededRng(53));
    addMon(s, teamBulb);
    s.team = [s.team[0], teamBulb.uid];
    const set = needsXp(s, 'box');
    expect(set.has(teamBulb.uid)).toBe(true);
    expect([...set].filter((u) => s.mons[u].speciesId === 1)).toHaveLength(2);
  });

  test('Pokédex : un seul Bulbizarre pour Herbizarre et Florizarre, un Évoli par forme manquante', () => {
    const s = kanto();
    for (let i = 0; i < 15; i++) addMon(s, makeMon(1, 5, seededRng(60 + i)));
    for (let i = 0; i < 3; i++) addMon(s, makeMon(133, 5, seededRng(80 + i)));
    s.dex.caught.push(136); // Pyroli déjà au Pokédex : manquent Aquali et Voltali
    const count = (id: number) => [...needsXp(s, 'dex')].filter((u) => s.mons[u].speciesId === id).length;
    expect(count(1)).toBe(1); // avant : les 15
    expect(count(133)).toBe(2);
  });

  test('Pokédex : Florizarre manquant sans Herbizarre possédé → un Bulbizarre (avant : personne)', () => {
    const s = kanto();
    addMon(s, makeMon(1, 5, seededRng(90)));
    s.dex.caught.push(2); // Herbizarre déjà enregistré, plus possédé
    expect([...needsXp(s, 'dex')].filter((u) => s.mons[u].speciesId === 1)).toHaveLength(1);
  });

  test('Compléter la boîte fait évoluer la matière arrivée au niveau en pension, garde le meilleur', () => {
    const s = kanto();
    const best = makeMon(1, 5, seededRng(100)); best.genes = { hp: 15, atk: 15, def: 15, spe: 14 }; addMon(s, best);
    const spare = makeMon(1, 20, seededRng(101)); spare.genes = { hp: 8, atk: 8, def: 8, spe: 8 }; addMon(s, spare);
    addMon(s, makeMon(3, 40, seededRng(102))); // Florizarre possédé : seul Herbizarre manque
    assignPension(s, spare.uid, 100);
    expect(completeBox(s, 'box', true)).toBe(1); // avant : 0, la pension était ignorée
    completeBox(s, 'box');
    expect(s.mons[spare.uid].speciesId).toBe(2);
    expect(s.mons[best.uid].speciesId).toBe(1);
  });

  test('formes manquantes d’une lignée en boîte (fenêtre d’une zone)', () => {
    const s = kanto();
    addMon(s, makeMon(133, 5, seededRng(110)));
    addMon(s, makeMon(134, 30, seededRng(111)));
    expect(missingForms(s, 133, false)).toEqual([135, 136]);
    expect(missingForms(s, 133, true)).toEqual([133, 134, 135, 136]);
  });
});

test('« Besoin d’XP » boîte : un exemplaire déjà au niveau passe d’abord (rien à faire monter), « Compléter » l’utilise, le nettoyage le garde', () => {
  const s = kanto();
  const best = makeMon(1, 5, seededRng(120)); best.genes = { hp: 15, atk: 15, def: 15, spe: 14 }; addMon(s, best);
  const good = makeMon(1, 5, seededRng(121)); good.genes = { hp: 13, atk: 13, def: 13, spe: 13 }; addMon(s, good);
  const ready = makeMon(1, 20, seededRng(122)); ready.genes = { hp: 2, atk: 2, def: 2, spe: 2 }; addMon(s, ready);
  addMon(s, makeMon(3, 40, seededRng(123))); // Florizarre possédé : seul Herbizarre manque, 1 Bulbizarre doit évoluer
  expect([...needsXp(s, 'box')].filter((u) => s.mons[u].speciesId === 1)).toHaveLength(0);
  expect(boxExcess(s, 'box').map((m) => m.uid)).toEqual([good.uid]); // le prêt à évoluer est gardé, le meilleur reste
  completeBox(s, 'box');
  expect(s.mons[ready.uid].speciesId).toBe(2);
  expect(s.mons[best.uid].speciesId).toBe(1);
});
