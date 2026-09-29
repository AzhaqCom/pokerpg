# Régions : fonctionnement et ajout d'une région

Quatre régions sont codées : Kanto (biomes 0-9), Johto (10-19), Hoenn (20-31), Sinnoh (32-46).

## Modèle
- `REGIONS` (`src/game/content.ts`) : une ligne par région (`name`, `start` = 1er biome, `starters`, `dexMax` = dernière
  espèce du Pokédex cumulé). Aides : `regionOf(prestige)`, `regionLastBiome(prestige)`, `REGION_START`.
- `GameState.prestige` = index de la région en cours. Le **prestige** (`canPrestige`/`startPrestige` dans `game.ts`)
  se débloque avec le Champion de la région + le Pokédex cumulé complet : équipe, boîte, objets, badges, Pokédex
  repartent à zéro (Balls de départ `START_BALLS`, compteur de temps `startedAt` remis à zéro) ; les bonbons, la
  progression de zone des régions précédentes et les totaux sont conservés.
- **Régions autonomes** : après un prestige on ne revient pas en arrière, donc tout le Pokédex jusqu'à `dexMax` doit
  être obtenable dans les seuls biomes de la région (capture ou évolution). Test de couverture par région dans
  `game.test.ts` (`test.each(REGIONS)`) ; `whereToFind` (Pokédex) en donne le lieu pour chaque espèce.
- La courbe de niveau redémarre à chaque région (Nv.5 → 100), un biome par badge plus des biomes de route sans badge
  (`grantsBadge: false`), puis Route Victoire, Conseil des 4 et Champion.

## Contenu d'une région
- **Biomes** : `BIOMES` (fin du tableau). 3 zones par biome, 5 étapes par zone, 3 vagues par étape. Chaque zone a un
  `pool` `[espèce, poids]`, un boss (`boss`, `joinsPool` pour un légendaire farmable une fois vaincu) et un fond.
- **Minimum de 6 espèces normales par zone** (règle d'Arno), hors starters et légendaires.
- **Poids** (`pool`) : fréquence d'apparition. Un poids < 10 rend l'espèce « rare » : capture ÷ 2 (`isRareInZone`).
  Valeurs usuelles : 20 normal, 8-10 forme évoluée ajoutée pour compléter une zone, 10 starter, 20 légendaire
  (`BOSS_POOL_WEIGHT` pour un boss vaincu, et anciens légendaires semés dans les régions suivantes).
- **Starters** : chacun est un sauvage (poids 10) dans un biome de son type (Plante/Feu/Eau) de sa région, hors 1er biome
  et 3 derniers. Ceux des régions précédentes y sont aussi ; ceux d'une région future jamais (`id ≤ dexMax`).
- **Légendaires** : ceux de la région sont des boss `joinsPool` sur les derniers biomes ; les anciens sont semés dans les
  3 derniers biomes.
- **Évolutions à choix** : `EVOLUTION_CHOICES` (`data.ts`), filtrées par `dexMax`. Les formes alternatives n'ont pas à
  être placées en sauvage (le test de couverture les accepte via l'évolution).
- **Panoplies** : `BIOME_SET` (`items.ts`) associe chaque biome des régions 3+ à une panoplie existante ;
  `biomeTier()` recale la puissance sur la région (1er biome = Kanto 1, dernier ≈ +60 %).
- **Difficulté** : `DIFFICULTY.end[région]` (`game.ts`), voir `CLAUDE.md`.

## Répartition des sauvages (Johto, Hoenn, Sinnoh — 2026-09-29)
Kanto est fait à la main. Les pools des 3 autres régions sont générés par `tools/regen_pools_official.ts` à partir des
**données de rencontre des jeux officiels** (CSV PokéAPI `encounters`, `encounter_slots`) : chaque espèce est placée au
moment de l'aventure où on la croise dans son jeu d'origine (Or HG/Argent SS pour Kanto/Johto, Émeraude pour Hoenn,
Platine pour Sinnoh ; difficulté du 1er lieu de rencontre, herbes/grottes seulement). Roucool/Chenipan en début de région,
Minidraco/Embrylex/Terhal en fin. Le type du biome n'est qu'une légère préférence (les biomes sont surtout un décor).
Bébés en début, fossiles au milieu, starters dans les biomes de début de leur type, formes évoluées officiellement
sauvages ajoutées à leur moment. Anciens légendaires gardés en fin de région, et l'un d'eux devient le boss d'une zone
dont le boss était un Pokémon ordinaire (lot 4). Relancer : `npx tsx tools/regen_pools_official.ts <csv> --write`.

## Ajouter une région (recette suivie pour Hoenn et Sinnoh)
1. Données : `tools/gen_data_gen34.py` (ou équivalent) étend `species.json`/`moves.json` ; ne **jamais** réécrire
   l'`evolvesTo` d'une espèce déjà figée. Sprites : `tools/fetch-sprites.ts` puis `tools/make_thumbs.py`.
2. Plan JSON : `tools/regions/<region>.json` (biomes, types dominants, zones, arènes, légendaires, `oldLegendaryZones`).
3. Générer : `npx tsx tools/gen_region.ts tools/regions/<region>.json > bloc.txt` (répartit les formes de base par type
   dominant et par force, complète les zones de moins de 6 espèces, choisit boss et équipes d'arène).
4. Coller le bloc à la fin de `BIOMES` (échapper les apostrophes des noms : utiliser `’`), ajouter la ligne dans
   `REGIONS`, les biomes dans `BIOME_SET`, une valeur dans `DIFFICULTY.end`.
5. Répartir les starters par type et relire les zones de départ ; relire les équipes d'arène (les noms des chefs de route
   reprennent d'anciens champions).
6. Tests : couverture par région, `whereToFind`, simulation de bout en bout (`simulate(rng, secondes, trace, région)`
   dans `bot.ts`, à ajouter à `balance.test.ts`), puis test manuel du prestige.
