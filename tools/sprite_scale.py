#!/usr/bin/env python3
"""Réduction des sprites géants en combat (compression douce) : mesure la hauteur réellement dessinée (pixels non
transparents) de la pose de repos de chaque espèce ; jusqu'à SEUIL px rien ne change, au-delà on ne garde que TAUX de ce
qui dépasse. Les géants restent les plus grands et gardent leur ordre (Rayquaza 63 → 47 px, Onix 47 → 40, Dracaufeu 26
inchangé). Écrit src/data/spriteScale.ts (coefficient par espèce, 1 par défaut). Relancer après `tools/fetch-sprites.ts`.
Usage : python tools/sprite_scale.py
"""
import json, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SEUIL = 36
TAUX = 0.4
man = json.load(open(os.path.join(ROOT, 'src', 'data', 'sprites.json'), encoding='utf-8'))
out = {}
for key, meta in man.items():
    if not key.startswith('p') or key.startswith('ps'):
        continue  # le chromatique a la même silhouette que le normal
    a = meta['actions']['idle']
    im = Image.open(os.path.join(ROOT, 'assets', 'sprites', f'{key}.png')).crop((0, a['y'], a['fw'], a['y'] + a['fh']))
    bb = im.getchannel('A').getbbox()
    h = (bb[3] - bb[1]) if bb else 0
    if h > SEUIL:
        out[int(key[1:])] = round((SEUIL + (h - SEUIL) * TAUX) / h, 3)
with open(os.path.join(ROOT, 'src', 'data', 'spriteScale.ts'), 'w', encoding='utf-8') as f:
    f.write('// GÉNÉRÉ par tools/sprite_scale.py — ne pas modifier à la main.\n')
    f.write('/** Réduction des sprites géants en combat (compression douce au-delà de 36 px de haut), par espèce. */\n')
    f.write('export const SPRITE_SCALE: Record<number, number> = {\n')
    for k in sorted(out):
        f.write(f'  {k}: {out[k]},\n')
    f.write('};\n\nexport const spriteScale = (speciesId: number) => SPRITE_SCALE[speciesId] ?? 1;\n')
print(len(out), 'espèces réduites')
