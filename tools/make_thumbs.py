#!/usr/bin/env python3
"""Vignettes du Pokédex : 1re frame Idle de chaque atlas, agrandie au plus
proche (pixel-art net) et centrée sur 144×144. Lancer après `npm run sprites`."""
import json, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SIZE = 240
man = json.load(open(os.path.join(ROOT, 'src', 'data', 'sprites.json')))
out_dir = os.path.join(ROOT, 'assets', 'thumbs')
os.makedirs(out_dir, exist_ok=True)
keys = sorted(man)
for k in keys:
    m = man[k]['actions']['idle']
    im = Image.open(os.path.join(ROOT, 'assets', 'sprites', f'{k}.png')).crop((0, m['y'], m['fw'], m['y'] + m['fh']))
    s = max(1, min(SIZE // m['fw'], SIZE // m['fh']))
    im = im.resize((m['fw'] * s, m['fh'] * s), Image.NEAREST)
    if im.width > SIZE or im.height > SIZE:
        im.thumbnail((SIZE, SIZE), Image.NEAREST)
    c = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    c.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    c.save(os.path.join(out_dir, f't{k[1:]}.png'), optimize=True)
with open(os.path.join(ROOT, 'src', 'data', 'thumbAssets.ts'), 'w') as f:
    f.write('// GÉNÉRÉ par tools/make_thumbs.py — ne pas modifier à la main.\n/* eslint-disable */\n')
    f.write('export const THUMB_ASSETS: Record<string, number> = {\n')
    for k in keys:
        f.write(f"  {k}: require('../../assets/thumbs/t{k[1:]}.png'),\n")
    f.write('};\n')
print(len(keys), 'vignettes')
