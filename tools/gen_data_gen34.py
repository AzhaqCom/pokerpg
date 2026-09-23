#!/usr/bin/env python3
"""Étend species.json/moves.json à la Gen 3 (ids 252-386) ou à la Gen 4 (ids 387-493), sans jamais
toucher aux espèces déjà figées (mêmes règles que gen_data_gen2.py, dont ce script est la généralisation).

Usage : python tools/gen_data_gen34.py <dossier des CSV PokéAPI> <3|4>
         (lancer la Gen 3 avant la Gen 4 : chaque passe s'ajoute à la fin de species.json)
CSV : https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv (+ pokemon_types_past.csv)

Choix de simplification (mêmes principes que gen_data.py / gen_data_gen2.py) :
- Une seule stat d'attaque : max(Attaque, Atq. Spé.) ; Défense = moyenne(Défense, Déf. Spé.).
- Capacités : apprises par niveau dans Rubis/Saphir (Gen 3, version_group_id=5) ou Diamant/Perle
  (Gen 4, version_group_id=8) ; celles dont l'effet n'est pas géré sont écartées. Les capacités déjà dans
  moves.json sont réutilisées telles quelles.
- Types : ceux d'avant la Gen 6 (`pokemon_types_past`), le type Fée n'existant pas dans le jeu — sans ça,
  Tarsal/Azurill/Mysdibule/Togekiss… perdraient leur type Fée actuel et retomberaient sur un seul type.
- Évolution : une seule branche par espèce. Les espèces déjà figées ne sont JAMAIS modifiées : une
  évolution de nouvelle génération d'une ancienne espèce (Magnéton->Magnézone, Kirlia->Gallame…) ou un
  bébé qui évolue vers une ancienne espèce (Azurill->Marill) n'est pas câblée — ces Pokémon existent
  comme espèces indépendantes, à placer directement dans les biomes.
- Déclencheurs non basés sur le niveau (pierre, bonheur, échange) : niveau de substitution 30.
"""
import csv, json, os, sys
from collections import defaultdict

SRC = sys.argv[1]
GEN = int(sys.argv[2])
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
FR = '5'
LO, HI, VERSION_GROUP = {3: (252, 386, '5'), 4: (387, 493, '8')}[GEN]

def rows(name):
    with open(os.path.join(SRC, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))

TYPES = {1: 'normal', 2: 'fighting', 3: 'flying', 4: 'poison', 5: 'ground', 6: 'rock', 7: 'bug', 8: 'ghost',
         9: 'steel', 10: 'fire', 11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice',
         16: 'dragon', 17: 'dark'}

species_fr = {int(r['pokemon_species_id']): r['name'] for r in rows('pokemon_species_names')
              if r['local_language_id'] == FR and LO <= int(r['pokemon_species_id']) <= HI}

# --- évolutions : evolves_from_species_id (pokemon_species.csv) donne le sens Gen1/Gen2 -> Gen1/Gen2 ;
# on ne câble QUE les évolutions dont la forme de départ est elle-même en 152-251 (jamais une forme Gen 1).
evolves_from = {}
for r in rows('pokemon_species'):
    pid = int(r['id'])
    if LO <= pid <= HI and r['evolves_from_species_id']:
        evolves_from[pid] = int(r['evolves_from_species_id'])
evolves_to = defaultdict(list)
for evolved, base in evolves_from.items():
    if LO <= base <= HI:  # la forme de départ doit aussi être Gen 2, jamais Gen 1
        evolves_to[base].append(evolved)

evo_level = {}
for r in rows('pokemon_evolution'):
    lv = r['minimum_level']
    if lv:
        evo_level[int(r['evolved_species_id'])] = int(lv)

def evolution_of(pid):
    targets = sorted(evolves_to.get(pid, []))
    if not targets:
        return 0, 0
    target = targets[0]  # une seule branche (comme Évoli en Gen 1)
    return target, evo_level.get(target, 30)

# --- types + stats
ptypes = defaultdict(list)
for r in sorted(rows('pokemon_types'), key=lambda r: int(r['slot'])):
    pid, tid = int(r['pokemon_id']), int(r['type_id'])
    if LO <= pid <= HI and tid in TYPES:
        ptypes[pid].append(TYPES[tid])
# types d'avant la Fée (Gen 6) : remplacent entièrement les types actuels quand ils existent
past = defaultdict(list)
for r in sorted(rows('pokemon_types_past'), key=lambda r: int(r['slot'])):
    pid, gen_until, tid = int(r['pokemon_id']), int(r['generation_id']), int(r['type_id'])
    if LO <= pid <= HI and gen_until >= GEN and tid in TYPES:
        past[pid].append(TYPES[tid])
for pid, types in past.items():
    ptypes[pid] = types
stats = defaultdict(dict)
for r in rows('pokemon_stats'):
    pid = int(r['pokemon_id'])
    if LO <= pid <= HI:
        stats[pid][int(r['stat_id'])] = int(r['base_stat'])

# --- capacités : réutilise moves.json existant, ajoute les nouvelles (Gen 2) utilisées
existing_moves = json.load(open(os.path.join(OUT, 'moves.json'), encoding='utf-8'))
existing_moves = {int(k): v for k, v in existing_moves.items()}

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
    tid = int(r['type_id'])
    mtype = TYPES.get(tid, 'normal')
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
            self_target = target == 7
            mv.update(kind='buff' if self_target else 'debuff', stat=STAT[st], stages=ch, cd=10.0, aoe=aoe)
        else:
            return None
    return mv

moves_by_id = {int(r['id']): r for r in rows('moves') if int(r['generation_id']) <= GEN}

learn = defaultdict(list)
new_move_ids = set()
for r in rows('pokemon_moves'):
    pid, mid = int(r['pokemon_id']), int(r['move_id'])
    if LO <= pid <= HI and r['version_group_id'] == VERSION_GROUP and r['pokemon_move_method_id'] == '1':
        if mid in existing_moves:
            learn[pid].append((max(1, int(r['level'])), mid))
        elif mid in moves_by_id:
            mv = build_move(moves_by_id[mid])
            if mv:
                existing_moves[mid] = mv
                new_move_ids.add(mid)
                learn[pid].append((max(1, int(r['level'])), mid))

existing_species = json.load(open(os.path.join(OUT, 'species.json'), encoding='utf-8'))
have = {sp['id'] for sp in existing_species}
if any(LO <= i <= HI for i in have):
    sys.exit(f'Gen {GEN} déjà présente dans species.json (ids {LO}-{HI}) : rien à faire.')
if LO - 1 not in have:
    sys.exit(f'species.json doit déjà contenir l\'espèce {LO - 1} : lancer d\'abord la génération précédente.')

new_species = []
for pid in range(LO, HI + 1):
    s, types = stats[pid], ptypes[pid] or ['normal']
    evo_to, evo_lv = evolution_of(pid)
    seen, ls = set(), []
    for lv, mid in sorted(learn[pid]):
        if mid not in seen:
            seen.add(mid)
            ls.append([lv, mid])
    new_species.append({
        'id': pid, 'name': species_fr.get(pid, f'#{pid}'), 'types': types,
        'base': {'hp': s[1], 'atk': max(s[2], s[4]), 'def': round((s[3] + s[5]) / 2), 'spe': s[6]},
        'evolvesTo': evo_to, 'evolveLevel': evo_lv, 'learnset': ls,
    })

all_species = existing_species + new_species
used = {mid for sp in all_species for _, mid in sp['learnset']}
json.dump(all_species, open(os.path.join(OUT, 'species.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({k: v for k, v in existing_moves.items() if k in used}, open(os.path.join(OUT, 'moves.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0)
print(len(new_species), 'nouvelles espèces (', len(existing_species), '->', len(all_species), '),',
      len(new_move_ids), f'nouvelles capacités (Gen {GEN}),', len(used), 'capacités utilisées au total')
