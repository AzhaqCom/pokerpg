# Plan — Gen 3 (Hoenn) puis Gen 4 (Sinnoh)

Ordre de travail pour ajouter deux nouvelles régions, chacune débloquée par un prestige avec la même
condition que Kanto → Johto : **Champion de la région battu + toutes les espèces de la région vues**.
Chaque étape s'appuie sur la précédente : ne pas les inverser.

Règles de contenu reprises de Johto (validées par Arno le 2026-09-23) :
- **chaque région est autonome** (Johto, Hoenn et Sinnoh, sans exception) : après un prestige, le joueur
  ne revient pas sur les régions précédentes, donc il doit pouvoir compléter son Pokédex sans elles.
  À valider à chaque nouvelle région par le test de couverture par région ;
- les biomes d'une région précédente ne sont **jamais** retouchés (Kanto = biomes 0-9, Johto = 10-19) ;
- la Carte masque les régions précédentes après un prestige : **tout le Pokédex cumulé** (Kanto + Johto +
  nouvelle région) doit être obtenable dans les seuls biomes de la nouvelle région ;
- on ne place que les **formes de base / sans évolution** : les évolutions par niveau suivent toutes
  seules. Une évolution par pierre, échange, bonheur ou branche (non modélisée : le moteur ne connaît
  qu'un `evolvesTo` par niveau) doit être placée directement, comme Porygon2 ou Nostenfer à Johto ;
- tous les légendaires (anciens et nouveaux) en boss `joinsPool` sur les derniers biomes de la région.

---

## Partie 1 — Gen 3 (Hoenn, espèces 252-386)

### 1. Solder Johto avant d'empiler une région de plus

- `balance.test.ts` : le test bout en bout Kanto échoue depuis le pull du 2026-09-23 (le bot n'atteint
  pas le badge du Champion en 10 h sur au moins une graine) — trouver pourquoi (blocage ou lenteur).
- Poser un `wildMult` de base sur les zones Johto (encore au malus standard Kanto) et étendre la
  simulation bout en bout à Johto.
- Relecture du flux de prestige (voir « À faire » dans `CLAUDE.md`) : le `runner` ne consulte jamais
  `unlocked`, toute téléportation de `s.biome/zone/stage` doit débloquer la zone visée.

### 2. Rendre le prestige générique (une ligne par région)

Aujourd'hui tout est codé pour **un seul** prestige Kanto → Johto. Remplacer par un tableau de régions
dans `content.ts`, par exemple `REGIONS = [{ name, start, starters, dexMax }]`, puis brancher dessus :
- `canPrestige` (`game.ts`) : `prestige === 0`, `arenaBeaten[9]`, `dex.seen.length >= 151` codés en dur
  → Champion de la région courante battu + toutes ses espèces vues ;
- `startPrestige` (`game.ts`) : `PRESTIGE_BIOME`, `prestige = 1` → région suivante ;
- `STARTERS2` → `REGIONS[p].starters` (`StarterScreen.tsx`, `bot.ts`) ;
- limites 151/251 en dur : `game.ts` (`maxId`), `DexPanel.tsx`, `PrestigeOffer.tsx` (« /151 »,
  « 1/251 »), boutons debug de `Hud.tsx` ;
- `runner.ts` et `onStageWon` (`game.ts`) : pause/arrêt en fin de région, aujourd'hui liés à
  `PRESTIGE_BIOME` ;
- `REGION_START`, `MapPanel` et la panoplie du starter sont déjà génériques : rien à faire.

Tests : chaîne complète Kanto → Johto → Hoenn (déblocage de la 1re zone, reset, conservations).

### 3. Données Gen 3

- Étendre le script de données (`tools/gen_data_gen2.py` → Gen 3) aux espèces 252-386, capacités Rubis/
  Saphir, noms FR, **sans réécrire les 251 espèces déjà figées** (même règle que la Gen 2).
- Pas de nouveau type (la Fée n'arrive qu'en Gen 6) : table des types et talents inchangés.
- Relever les évolutions non modélisées à placer directement, dont les bébés qui évoluent vers une
  espèce plus ancienne (Azurill → Marill, Okéoké → Qulbutoké).
- Python n'est pas installé sur le PC perso : lancer le script depuis le PC du boulot.

### 4. Sprites

`tools/fetch-sprites.ts` pour 252-386 (normal + chromatique), miniatures (`tools/make_thumbs.py`),
manifeste `src/data/sprites.json` + `spriteAssets.ts`, `assets/sprites/CREDITS.txt`.

### 5. Contenu : 10 biomes Hoenn

- Un biome par badge (Roche, Combat, Électrik, Feu, Normal, Vol, Psy, Eau) + Conseil 4 + Champion,
  3 zones × 5 étapes chacun, courbe de niveau Nv.5 → 100 (redémarrage, comme Johto).
- Starters Hoenn (Arcko, Poussifeu, Gobou) en `STARTERS3` ; les 9 starters (Kanto, Johto, Hoenn) en
  rencontre très rare dès la 1re zone.
- **Décision à prendre avant de coder** : 21 légendaires Gen 1-3 (11 actuels + Regirock, Regice,
  Registeel, Latias, Latios, Kyogre, Groudon, Rayquaza, Jirachi, Deoxys) pour ~12 places de boss sur
  les 4 derniers biomes. Options : descendre sur plus de biomes, ou un biome post-Champion dédié aux
  légendaires.
- Audit de couverture (le même script que pour Johto) : 0 forme de base manquante dans les biomes Hoenn
  seuls, aucune espèce Hoenn dans Kanto/Johto.

### 6. Objets

10 panoplies Hoenn, branchement dans `rollLoot` (aujourd'hui repli sur le catalogue Kanto pour Johto),
courbe de valeur des objets par biome (même méthode que le rééquilibrage du 2026-09-23 : le 1er biome de
la région calé sur le biome 1).

### 7. Équilibrage

FAIT (2026-09-24) : courbe de difficulté unique par région (`DIFFICULTY`), simulation bout en bout étendue à Hoenn.

### 8. Tests, UI, docs

- Test générique de couverture **par région** dans `game.test.ts` (toutes les formes de base
  ≤ `dexMax` obtenables dans les biomes de la région), continuité de la courbe de niveau.
- Carte, Pokédex (386), page Aide, textes du prestige.
- `CLAUDE.md`, `BIOMES.md` : FAIT.

### 9. Test manuel par Arno

FAIT le 2026-09-24 : prestige Johto → Hoenn OK.

---

## Partie 2 — Gen 4 (Sinnoh, espèces 387-493)

Mêmes étapes que la partie 1 (le prestige générique de l'étape 2 est alors déjà en place : ajouter la
ligne Sinnoh suffit). Points propres à la Gen 4 :

### 1. Évolutions ajoutées aux anciennes espèces

La Gen 4 donne de nouvelles évolutions à des espèces Kanto/Johto/Hoenn : Magnézone, Rhinastoc,
Élekable, Maganon, Togekiss, Porygon-Z, Mammochon, Gallame, Momartik, Noctunoir, Yanmega, Tentacruel…
et de nouveaux bébés (Rozbouton, Korillon, Manzaï, Mime Jr., Ptiravi, Goinfrex, Riolu, Babimanta).

- **Ne jamais modifier l'`evolvesTo` d'une espèce déjà figée** : sinon, par exemple, Magnéton
  évoluerait en Magnézone… en plein Kanto. Même règle que la Gen 2 (Steelix, Cizayox placés
  directement plutôt qu'Onix/Insécateur modifiés).
- Conséquence : la plupart de ces évolutions et bébés sont à placer directement dans les biomes Sinnoh.
- Évolutions en branche (Kirlia → Gallame, Stalgamin → Momartik) : `evolvesTo` n'a qu'une cible, la
  2e branche est à placer directement.

### 2. Légendaires

Environ 14 de plus (Créhelm, Créfollet, Créfadet, Dialga, Palkia, Giratina, Heatran, Regigigas,
Cresselia, Phione, Manaphy, Darkrai, Shaymin, Arceus), soit ~35 au total. La décision prise pour
Hoenn (étape 5 de la partie 1) devra tenir à cette échelle.

### 3. Taille de l'appli

~240 espèces de sprites en plus sur les deux générations (normal + chromatique) : l'APK grossit d'environ
une vingtaine de Mo. À surveiller, sans action prévue pour l'instant.

### 4. Pas de nouveau type

La séparation physique/spécial de la Gen 4 ne change rien : le moteur prend déjà
`Atq = max(Atq, Atq Spé)`.
