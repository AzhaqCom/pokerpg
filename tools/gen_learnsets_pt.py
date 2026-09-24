#!/usr/bin/env python3
"""Remplace les capacités apprises par niveau des 493 espèces par celles de Pokémon Platine (Gen 4,
version_group_id=9), la version la plus complète avant la Gen 5. Motif : les capacités de Kanto venaient de
Rouge/Bleu (très peu d'apprentissages par niveau : Dracaufeu n'avait ni attaque Vol ni attaque forte),
celles de Johto/Hoenn d'Or/Argent/Rubis — Platine donne une base cohérente pour tout le Pokédex.

Usage : python tools/gen_learnsets_pt.py <dossier des CSV PokéAPI>
CSV : pokemon_moves, moves, move_meta, move_meta_stat_changes, move_names
      (https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)

- Ne touche QUE le champ `learnset` de species.json (types, stats, évolutions inchangés).
- moves.json : les capacités déjà présentes sont gardées telles quelles (y compris celles qui ne sont plus
  apprises : une sauvegarde peut encore les avoir équipées) ; les nouvelles sont converties avec la même règle
  que tools/gen_data_gen34.py (`build_move`, recopiée ici). Une capacité dont l'effet n'est pas géré est écartée.
- Une espèce sans aucune capacité gérée en Platine garde son ancienne liste.
"""
import csv, json, os, sys
from collections import defaultdict

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
FR = '5'
VERSION_GROUP = '9'  # platinum

def rows(name):
    with open(os.path.join(SRC, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))

TYPES = {1: 'normal', 2: 'fighting', 3: 'flying', 4: 'poison', 5: 'ground', 6: 'rock', 7: 'bug', 8: 'ghost',
         9: 'steel', 10: 'fire', 11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice',
         16: 'dragon', 17: 'dark'}
meta = {int(r['move_id']): r for r in rows('move_meta')}
statch = defaultdict(list)
for r in rows('move_meta_stat_changes'):
    statch[int(r['move_id'])].append((int(r['stat_id']), int(r['change'])))
move_fr = {int(r['move_id']): r['name'] for r in rows('move_names') if r['local_language_id'] == FR}
AIL = {1: 'paralysis', 2: 'sleep', 3: 'freeze', 4: 'burn', 5: 'poison'}
STAT = {2: 'atk', 3: 'def', 4: 'atk', 5: 'def', 6: 'spe'}

def cooldown(power, aoe):
    cd = max(2.0, min(12.0, (power - 20) / 10))
    return round(cd + (3 if aoe else 0), 1)

def build_move(r):
    mid = int(r['id'])
    mtype = TYPES.get(int(r['type_id']), 'normal')
    m = meta.get(mid, {})
    cat = int(m.get('meta_category_id') or 0)
    cls = int(r['damage_class_id'])
    target = int(r['target_id'])
    aoe = target in (11, 14)
    power = int(r['power']) if r['power'] else 0
    hits = (int(m['min_hits']) + int(m['max_hits'])) / 2 if m.get('min_hits') else 1
    mv = {'id': mid, 'slug': r['identifier'], 'name': move_fr.get(mid, r['identifier']), 'type': mtype}
    ail = AIL.get(int(m.get('meta_ailment_id') or 0))
    chance = int(m.get('ailment_chance') or 0)
    if cls != 1:
        if cat == 9:
            power = 120
        if power == 0:
            power = 50
        mv.update(kind='damage', power=round(power * hits), aoe=aoe, cd=cooldown(power * hits, aoe))
        if ail:
            mv.update(ailment=ail, chance=chance or 10)
        drain = int(m.get('drain') or 0)
        if drain > 0:
            mv['drain'] = drain
        if cat in (6, 7) and statch.get(mid):
            st, ch = statch[mid][0]
            if st in STAT:
                mv['stat'] = {'stat': STAT[st], 'stages': ch, 'self': cat == 7, 'chance': int(m.get('stat_chance') or 100)}
    else:
        if ail and cat == 1:
            mv.update(kind='status', ailment=ail, chance=100, cd=10.0, aoe=aoe)
        elif cat == 3 and int(m.get('healing') or 0) > 0:
            mv.update(kind='heal', heal=int(m['healing']), cd=12.0, aoe=False)
        elif cat == 2 and statch.get(mid):
            st, ch = statch[mid][0]
            if st not in STAT:
                return None
            mv.update(kind='buff' if target == 7 else 'debuff', stat=STAT[st], stages=ch, cd=10.0, aoe=aoe)
        else:
            return None
    return mv

moves = {int(k): v for k, v in json.load(open(os.path.join(OUT, 'moves.json'), encoding='utf-8')).items()}
moves_by_id = {int(r['id']): r for r in rows('moves') if int(r['generation_id']) <= 4}

learn = defaultdict(list)
added = set()
for r in rows('pokemon_moves'):
    pid, mid = int(r['pokemon_id']), int(r['move_id'])
    if pid > 493 or r['version_group_id'] != VERSION_GROUP or r['pokemon_move_method_id'] != '1':
        continue
    if mid not in moves:
        if mid not in moves_by_id:
            continue
        mv = build_move(moves_by_id[mid])
        if not mv:
            continue
        moves[mid] = mv
        added.add(mid)
    learn[pid].append((max(1, int(r['level'])), mid))

species = json.load(open(os.path.join(OUT, 'species.json'), encoding='utf-8'))
kept = []
for sp in species:
    seen, ls = set(), []
    for lv, mid in sorted(learn[sp['id']]):
        if mid not in seen:
            seen.add(mid)
            ls.append([lv, mid])
    if ls:
        sp['learnset'] = ls
    else:
        kept.append(sp['name'])

json.dump(species, open(os.path.join(OUT, 'species.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({k: moves[k] for k in sorted(moves)}, open(os.path.join(OUT, 'moves.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(species) - len(kept), 'espèces avec les capacités de Platine,', len(added), 'nouvelles capacités ;',
      'ancienne liste gardée pour :', ', '.join(kept) or 'aucune')
