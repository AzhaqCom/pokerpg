import { Battle } from '../battle';
import { species, typeMultiplier } from '../data';
import { makeMon, wildFighter } from '../game';
import { seededRng } from '../rng';
import { finalStats } from '../stats';
import { emptyBonuses } from '../model';

describe('types', () => {
  test('table classique', () => {
    expect(typeMultiplier('fire', ['grass'])).toBe(2);
    expect(typeMultiplier('water', ['fire'])).toBe(2);
    expect(typeMultiplier('electric', ['ground'])).toBe(0);
    expect(typeMultiplier('water', ['rock', 'ground'])).toBe(4);
    expect(typeMultiplier('fire', ['water'])).toBe(0.5);
  });
  test('double type réel : Dracaufeu Feu/Vol, Magnéti Électrik pur', () => {
    expect(species(6).types).toEqual(['fire', 'flying']);
    expect(species(81).types).toEqual(['electric']);
    expect(species(35).types).toEqual(['normal']);
  });
});

function fighter(id: string, side: 0 | 1, sp: number, lv: number, seed = 1) {
  const mon = makeMon(sp, lv, seededRng(seed), false, 8);
  const f = wildFighter(id, mon);
  return { ...f, side };
}

describe('combat automatique', () => {
  test('déterministe à graine égale', () => {
    const run = () => {
      const b = new Battle([fighter('a', 0, 4, 10), fighter('b', 1, 1, 10)], seededRng(42));
      b.runToEnd();
      return [b.result, b.t.toFixed(2)];
    };
    expect(run()).toEqual(run());
  });

  test('beaucoup plus fort gagne ; les deux côtés agissent', () => {
    const b = new Battle([fighter('a', 0, 6, 40), fighter('b', 1, 10, 5)], seededRng(3));
    expect(b.runToEnd()).toBe('win');
    const ev = b.drain();
    expect(ev.some((e) => e.kind === 'use' && e.actor === 'a')).toBe(true);
    expect(ev.at(-1)).toEqual(expect.objectContaining({ kind: 'end', result: 'win' }));
  });

  test("l'avantage de type pèse : Carapuce bat Salamèche de même niveau le plus souvent", () => {
    let wins = 0;
    for (let s = 0; s < 40; s++) {
      const b = new Battle([fighter('a', 0, 7, 15, s), fighter('b', 1, 4, 15, s + 100)], seededRng(s));
      if (b.runToEnd() === 'win') wins++;
    }
    expect(wins).toBeGreaterThan(28);
  });

  test('formule de dégâts : STAB et efficacité', () => {
    const b = new Battle([fighter('a', 0, 4, 20), fighter('b', 1, 1, 20)], seededRng(1));
    const [a, t] = b.fighters;
    const flame: Extract<ReturnType<typeof import('../data').move>, { kind: 'damage' }> = { id: 52, slug: 'ember', name: 'Flammèche', type: 'fire' as const, cd: 4, aoe: false, kind: 'damage' as const, power: 40 };
    const tackle: typeof flame = { ...flame, id: 33, type: 'normal' };
    const avg = (m: typeof flame) => { let s = 0; for (let i = 0; i < 200; i++) s += b.damage(a, m, t).amount; return s / 200; };
    // Feu (STAB ×1,5) sur Plante (×2) ≈ 3× une attaque Normale
    expect(avg(flame) / avg(tackle)).toBeGreaterThan(2.5);
    expect(avg(flame) / avg(tackle)).toBeLessThan(3.5);
  });

  test('statut : Cage Éclair paralyse (Vitesse −50 %)', () => {
    const pika = { ...fighter('a', 0, 25, 20), moves: [86] };
    const b = new Battle([pika, fighter('b', 1, 19, 30)], seededRng(5));
    b.step(3);
    expect(b.drain().some((e) => e.kind === 'status' && e.ailment === 'paralysis')).toBe(true);
  });

  test('pas de combat infini', () => {
    const tank = { ...fighter('a', 0, 129, 5), moves: [] as number[] };
    const tank2 = { ...fighter('b', 1, 129, 5), stats: { ...finalStats(makeMon(129, 5, seededRng(1)), emptyBonuses()), hp: 99999 } };
    const b = new Battle([{ ...tank, stats: { ...tank.stats, hp: 99999 } }, tank2], seededRng(1));
    expect(b.runToEnd()).toBe('lose');
    expect(b.t).toBeLessThanOrEqual(121);
  });
});
