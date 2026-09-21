#!/usr/bin/env python3
"""Génère les données de combat depuis les CSV de PokéAPI.

Usage : python3 tools/gen_data.py <dossier des CSV PokéAPI> <dex.json de TamaPoké>
CSV : https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv
Sorties : src/data/species.json, moves.json, types.json

Choix de simplification (document de conception) :
- 1re génération : types Acier / Ténèbres / Fée retirés (Magnéti = Électrik pur, Mélofée = Normal).
- Une seule stat d'attaque : max(Attaque, Atq. Spé.) ; Défense = moyenne(Défense, Déf. Spé.).
- Capacités : apprises par niveau dans Rouge/Bleu ; celles dont l'effet n'est pas géré sont écartées.
"""
import csv, json, os, sys
from collections import defaultdict

SRC, TDEX = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
FR = '5'

def rows(name):
    with open(os.path.join(SRC, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))

TYPES = {1: 'normal', 2: 'fighting', 3: 'flying', 4: 'poison', 5: 'ground', 6: 'rock', 7: 'bug', 8: 'ghost',
         10: 'fire', 11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice', 16: 'dragon'}
DROPPED = {9, 17, 18}  # acier, ténèbres, fée

# --- types : noms FR + table d'efficacité (attaquant -> défenseur -> multiplicateur)
type_fr = {TYPES[int(r['type_id'])]: r['name'] for r in rows('type_names')
           if r['local_language_id'] == FR and int(r['type_id']) in TYPES}
chart = defaultdict(dict)
for r in rows('type_efficacy'):
    a, d = int(r['damage_type_id']), int(r['target_type_id'])
    if a in TYPES and d in TYPES and int(r['damage_factor']) != 100:
        chart[TYPES[a]][TYPES[d]] = int(r['damage_factor']) / 100
json.dump({'names': type_fr, 'chart': chart}, open(os.path.join(OUT, 'types.json'), 'w'), ensure_ascii=False, indent=1)

# --- espèces
tdex = {s['id']: s for s in json.load(open(TDEX))['species']}
ptypes = defaultdict(list)
for r in sorted(rows('pokemon_types'), key=lambda r: int(r['slot'])):
    pid, tid = int(r['pokemon_id']), int(r['type_id'])
    if pid <= 151 and tid in TYPES:
        ptypes[pid].append(TYPES[tid])
stats = defaultdict(dict)
for r in rows('pokemon_stats'):
    pid = int(r['pokemon_id'])
    if pid <= 151:
        stats[pid][int(r['stat_id'])] = int(r['base_stat'])

# --- capacités
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

moves = {}
for r in rows('moves'):
    mid = int(r['id'])
    if int(r['generation_id']) != 1:
        continue
    tid = int(r['type_id'])
    mtype = TYPES.get(tid, 'normal')
    m = meta.get(mid, {})
    cat = int(m.get('meta_category_id') or 0)
    cls = int(r['damage_class_id'])  # 1 statut, 2 physique, 3 spécial
    target = int(r['target_id'])
    aoe = target in (11, 14)  # tous les adversaires / tous
    power = int(r['power']) if r['power'] else 0
    hits = (int(m['min_hits']) + int(m['max_hits'])) / 2 if m.get('min_hits') else 1
    mv = {'id': mid, 'slug': r['identifier'], 'name': move_fr.get(mid, r['identifier']), 'type': mtype}
    ail = AIL.get(int(m.get('meta_ailment_id') or 0))
    chance = int(m.get('ailment_chance') or 0)
    if cls != 1:  # capacité offensive
        if cat == 9:
            power = 120  # K.O. en un coup -> très puissante
        if power == 0:
            power = 50   # dégâts fixes (Frappe Atlas, Draco-Rage…)
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
                continue
            self_target = target == 7
            mv.update(kind='buff' if self_target else 'debuff', stat=STAT[st], stages=ch, cd=10.0, aoe=aoe)
        else:
            continue  # effet non géré (Téléport, Trempette, Brume…)
    moves[mid] = mv

learn = defaultdict(list)
for r in rows('pokemon_moves'):
    pid, mid = int(r['pokemon_id']), int(r['move_id'])
    if pid <= 151 and r['version_group_id'] == '1' and r['pokemon_move_method_id'] == '1' and mid in moves:
        learn[pid].append((max(1, int(r['level'])), mid))

species = []
for pid in range(1, 152):
    s, t = stats[pid], tdex[pid]
    types = ptypes[pid] or ['normal']
    seen, ls = set(), []
    for lv, mid in sorted(learn[pid]):
        if mid not in seen:
            seen.add(mid)
            ls.append([lv, mid])
    species.append({
        'id': pid, 'name': t['name'], 'types': types,
        'base': {'hp': s[1], 'atk': max(s[2], s[4]), 'def': round((s[3] + s[5]) / 2), 'spe': s[6]},
        'evolvesTo': t['evolvesTo'], 'evolveLevel': t['evolveLevel'], 'learnset': ls,
    })
used = {mid for sp in species for _, mid in sp['learnset']}
json.dump(species, open(os.path.join(OUT, 'species.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({k: v for k, v in moves.items() if k in used}, open(os.path.join(OUT, 'moves.json'), 'w'), ensure_ascii=False, indent=0)
print(len(species), 'espèces,', len(used), 'capacités utilisées sur', len(moves))
