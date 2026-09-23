# État Gen 3 / Gen 4 — point au 2026-09-23

Suivi de `PLAN_GEN3_GEN4.md` : ce qui est codé, et ce qui reste pour que Hoenn et Sinnoh soient
jouables à 100 %.

---

## Fait

### Prestige générique (toutes régions)
- Table `REGIONS` dans `content.ts` (`name`, `start`, `starters`, `dexMax`) + `regionOf(prestige)` et
  `regionLastBiome(prestige)`. Remplace `STARTERS2`/`PRESTIGE_BIOME` codés en dur pour Johto.
- Branchés dessus : `canPrestige`/`startPrestige`/`completeDex`/`onStageWon` (`game.ts`), `runner.ts`
  (pause en fin de région), `bot.ts`, `StarterScreen`, `DexPanel`, `PrestigeOffer`, boutons debug du HUD.
- Ajouter une région = ajouter une ligne dans `REGIONS` + ses biomes à la fin de `BIOMES`.

### Données Gen 3 et Gen 4 (espèces 252-493)
- `tools/gen_data_gen34.py <csv> <3|4>` : `species.json` passe à 493 espèces, les 251 anciennes jamais
  réécrites. Types d'avant la Fée (`pokemon_types_past`), capacités Rubis/Saphir et Diamant/Perle.
- Sprites 252-493 (normal + chromatique) récupérés via `tools/fetch-sprites.ts 252-493`, miniatures
  régénérées, manifestes `sprites.json`/`spriteAssets.ts`/`thumbAssets.ts` à jour.
  `assets/sprites` passe de 27 à 56 Mo.

### Hoenn (biomes 20-31), jouable
- **12 biomes** au lieu de 10 (228 formes de base à placer contre 150 à Johto), Nv.5 → 100 :
  Mérouville (Roxanne), Myokara (Bastien), Bois de Clémenti, Lavandia (Voltère), Mont Chimnée (Adriane),
  Clémenti-Ville (Norman), Route du Désert, Cimetronelle (Alizée), Algatia (Lévy & Tatia),
  Atalanopolis (Marc), Route Victoire (Conseil des 4), Éternara (Pierre Rochard).
- Tout le Pokédex 1-386 obtenable dans les seuls biomes Hoenn (par capture ou évolution par niveau).
- Les 9 starters de Kanto/Johto/Hoenn sont en rencontre très rare dès la 1re zone.
- Légendaires :
  - les 11 de Kanto/Johto sont semés en rencontre très rare dans les 3 derniers biomes ;
  - les 10 de Hoenn sont des boss `joinsPool` : Regirock/Regice/Registeel, Latias/Latios/Jirachi,
    Kyogre, Groudon, Rayquaza, Deoxys.
- Générateur réutilisable : `npx tsx tools/gen_region.ts tools/regions/hoenn.json`. Il répartit les
  espèces par type dominant et par force, choisit les boss et les équipes d'arène (natifs d'abord).
  Les équipes d'Alizée et de Lévy & Tatia sont imposées à la main, pour coller aux jeux d'origine.

### Tests
- Test de couverture **par région** (`test.each(REGIONS)`) : toute forme de base ≤ `dexMax` est
  obtenable dans la région, et aucune espèce d'une région future n'y apparaît.
- La courbe de niveau redémarre à chaque début de région (`REGION_START`), et le prestige Johto → Hoenn
  est couvert.
- 114 tests rapides OK, typecheck OK. La simulation longue `balance.test.ts` n'a pas été relancée, et
  elle échouait déjà sur Kanto avant ce chantier.

---

## Reste à faire

### Sinnoh (Gen 4) — le gros morceau restant
1. **Plan `tools/regions/sinnoh.json`** : 15 biomes (303 formes de base à placer), biomes 32-46.
   - Starters Tortipouss, Ouisticram, Tiplouf (387, 390, 393).
   - 8 arènes : Pierrick, Flo, Mélina, Lovis, Kiméra, Charles, Gladys, Tanguy.
   - Conseil des 4 et Champion (Cynthia).
2. **Légendaires** :
   - les 14 de Sinnoh en boss `joinsPool` sur les 5 derniers biomes : Créhelm, Créfollet, Créfadet,
     Dialga, Palkia, Giratina, Heatran, Regigigas, Cresselia, Phione, Manaphy, Darkrai, Shaymin, Arceus ;
   - les 21 anciens semés en rencontre très rare.
3. Les nouvelles évolutions d'anciennes espèces (Magnézone, Togekiss, Gallame…) et les bébés (Rozbouton,
   Riolu…) ne sont pas câblés sur les espèces figées. Le générateur les place déjà directement, puisqu'ils
   ne sont la cible d'aucun `evolvesTo`. À vérifier à la relecture.
4. Générer, relire les équipes d'arène, coller à la fin de `BIOMES`, puis ajouter la ligne
   `{ name: 'Sinnoh', start: 32, starters: [387, 390, 393], dexMax: 493 }` dans `REGIONS`. Le test de
   couverture valide le résultat.

### Commun Hoenn + Sinnoh
- **Panoplies** : aucune pour les biomes 20+.
  - `rollLoot` retombe sur tout le catalogue ;
  - le starter reçoit la panoplie Sylvestre (`starterItems`) ;
  - il faut 12 + 15 panoplies, avec la valeur du 1er biome de chaque région calée sur le biome 1.
- **Équilibrage** : pas de `wildMult` sur les zones Hoenn/Sinnoh (malus standard). Le caler via
  `bot.ts`/`simulate()`, puis étendre la simulation bout en bout aux nouvelles régions.
- **Doc** : `CLAUDE.md` (Hoenn codé, `REGIONS`, générateur), `BIOMES.md` (courbes Hoenn/Sinnoh),
  cocher `PLAN_GEN3_GEN4.md`.
- **Détail de nom** : le champion Glace de Johto s'appelle « Alizée » dans `content.ts`, alors que son
  vrai nom français est **Frédo**. Alizée est la championne Vol de Hoenn, désormais aussi dans le jeu.
- **Taille de l'APK** : +29 Mo de sprites. À surveiller au prochain build EAS.

### Test manuel par Arno
- Prestige Kanto → Johto → Hoenn sur une vraie sauvegarde (boutons debug du HUD relatifs à la région),
  puis début de Hoenn : starter, Carte, Pokédex /386.
- Même chose vers Sinnoh une fois codé.
