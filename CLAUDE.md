@AGENTS.md

# PokéLoot — contexte projet

RPG mobile à **combats automatiques** façon Lootborn Warriors. Le joueur ne pilote pas les combats : il joue la
**préparation** (capture, équipe de 3, objets, fusion, talents, ordre des capacités, évolutions à choix, pension,
exploration). Expo SDK 57 / React Native 0.86 / React 19 / TypeScript, Hermes, New Architecture. Version **1.1.0**.
Projet perso non commercial (sprites PMD SpriteCollab CC BY-NC → pas de Play Store, APK perso).
**Tout en français** (UI, commentaires, commits). Dev sous **Windows + PowerShell 5** : pas de `&&`, une commande par
ligne. Arno veut des propositions arrêtées et structurées, pas une liste d'options ouvertes.

**État** : 4 régions jouables et testées en simulation — Kanto (151), Johto (251), Hoenn (386), Sinnoh (493) — reliées
par un prestige. 47 biomes. Fonctionnement des régions et recette d'ajout : `REGIONS.md`. Historique des sessions :
`HISTORIQUE.md` (périmé, ne pas s'y fier). Pistes et écarts connus : `IDEES.md`. **Dernière passation : `SESSION_2026-09-24.md`.**

## Commandes
```
npm install
npx expo start -c       # Expo Go / dev client
npm run typecheck       # tsc --noEmit
npx jest --testPathIgnorePatterns=balance.test.ts   # tests rapides (~140, ~20 s)
npx jest balance.test.ts                            # simulations de bout en bout (plusieurs minutes)
eas build -p android --profile preview              # APK
```
Modules natifs : toujours `npx expo install <pkg>`. Skia 2.6.2 (épinglé) **exige** `react-native-reanimated` 4.5.1 +
`react-native-worklets` 0.10.1 (sinon crash au lancement).

## Architecture
- `src/game/` : **moteur pur TS, sans React, testé**. Toute règle de jeu vit ici, déterministe (toujours passer un `Rng`).
  - `battle.ts` : classe `Battle`, combat temps réel à recharges. `step(dt)` par pas de 50 ms, `drain()` renvoie les
    événements pour l'UI, `runToEnd()` pour les tests. PV ×4 en combat (`HP_SCALE`), `MAX_BATTLE_TIME` 120 s = défaite.
    Action : première capacité prête et utile dans l'ordre du Pokémon, sinon attaque de base (**neutre** : jamais de STAB,
    jamais ×0/×2). Dégâts : `((0.4·niv+2)·puissance·atq/déf)/50+2` × STAB 1.5 × type × crit × bonus × 0.85–1.
    Recharge réelle : `cdFactor(spe, cdrPct)` = `100/(100+Vitesse) × (1 − min(40 %, Recharge))`.
  - `game.ts` : `GameState` sérialisable + toutes les actions (équipe, objets, fusion, talents, évolution, pension,
    exploration, boutique, capture, prestige, `completeDex`, `whereToFind`, courbes de difficulté). `StageRun` = une
    étape (3 vagues) ; `finishWave()` → `waveRewards()` ; `onStageWon` avance d'étape ; `onStageLost` recule.
  - `content.ts` : `REGIONS`, `BIOMES` (47), `STAGES_PER_ZONE` = 5, `BADGE_BONUS`. Voir `REGIONS.md`.
  - `data.ts` : accès typé aux JSON, `EVOLUTION_CHOICES`, `evolutionTargets`.
  - `items.ts` (catalogue, 7 raretés, panoplies, `BIOME_SET`, `biomeTier`, loot, fusion 3→1, amélioration, recyclage),
    `talents.ts`, `stats.ts` (stats finales, auras, `xpForLevel = 30·N²`), `idle.ts` (hors ligne), `rng.ts`,
    `bot.ts` (joueur automatique pour les simulations).
- `src/data/` : `species.json` (493), `moves.json`, `types.json` **générés** par `tools/gen_data*.py` depuis les CSV PokéAPI
  (Atq = max(Atq, Atq Spé), Déf = moyenne, recharge = `clamp(2,12,(puissance−20)/10)` +3 s si zone). Retoucher un JSON
  à la main est écrasé si on relance le script ; les espèces déjà figées ne sont jamais réécrites.
  **Capacités par niveau : celles de Platine pour les 493** (`tools/gen_learnsets_pt.py`, ne touche que `learnset` et
  garde toutes les anciennes capacités dans `moves.json`). Corrections appliquées au chargement dans `data.ts` (jamais dans
  les JSON) : `MOVE_FIXES` (Baston, Explosion, Destruction), `BABY_EVOLUTIONS`, `CROSS_GEN_EVOLUTIONS`. `learnedMoves`
  inclut les capacités des pré-évolutions (`lineLearnset`) ; `movesAtLevel` (kit de départ d'une capture/d'un sauvage) =
  les 4 meilleures capacités connues (sommeil, attaques de types variés, soin) ; même kit via le bouton « ★ Auto »
  des capacités de la fiche (`autoMoves`).
- Sprites : atlas PMD par espèce (`assets/sprites/p025.png`, `ps025.png` chromatique), manifeste `src/data/sprites.json`,
  `spriteAssets.ts`, miniatures `assets/thumbs` (`tools/make_thumbs.py`, 240 px).
- UI : `App.tsx` ; `src/ui/battle/runner.ts` (singleton hors React qui pilote le combat affiché, offres de capture,
  bandeaux), `BattleView.tsx` (Skia), `Hud.tsx` (réglages), `CaptureBar.tsx`, `panels/` (Équipe, Sac, Carte, Pension,
  Exploration, Pokédex), `MonSheet.tsx` (fiche Pokémon), `HelpScreen.tsx`, `IdleSummary.tsx`, `PrestigeOffer.tsx`.
  Les listes longues (`TeamPanel`, `BagPanel`, `DexPanel`) sont des `FlatList` rendues **hors** du `ScrollView` de `App.tsx`.
  PC colorés par palier (`CP_TIERS`/`cpColor` dans `ui/helpers.ts` : gris < 250, vert, bleu 600, violet 1 200, orange
  2 000, rouge 3 000, doré ≥ 4 000) sur la fiche, les cartes d'équipe et la liste d'échange.
- État : zustand + AsyncStorage (`src/store/game.ts`, clé `pokelootborn/save/v1`, `act(fn)` modifie + sauve).
  `load()` fusionne la sauvegarde avec `newGame()` → **un nouveau champ doit avoir une valeur par défaut dans `newGame()`** ;
  `migrateSave` complète les tableaux de biomes trop courts.
- Outils : `tools/gen_region.ts` (génère un bloc de biomes depuis `tools/regions/*.json`), `tools/fetch-sprites.ts`,
  `tools/gen_data*.py`. `tools/scratch/` = scripts de mesure locaux, **non versionnés**.

## Règles de jeu actuelles
- **Difficulté des sauvages** : une courbe unique par région (`DIFFICULTY`/`zoneWildMult` dans `game.ts`), plus aucun
  multiplicateur par zone : ×0,60 au départ (Nv.5 après un prestige) → ×2 Kanto / ×2,5 Johto / ×2,9 Hoenn / ×3,3 Sinnoh
  au dernier biome, exposant 1,2, sur PV et Atq. Boss (PV ×5) et arènes (PV ×2) sont multipliés par `bossRamp`
  (×0,5 → ×1,2 sur la région). `SOLO_MALUS` ×0,8 / ×0,9 tant que l'équipe a 1 / 2 Pokémon. Sauvage = niveau de l'étape ou −1.
- **XP** : chaque sauvage vaincu = 2 × son niveau (×5 boss), total de la vague partagé à parts égales entre les membres
  de l'équipe, pondéré par `xpGapMult` = `clamp(0.5, 2, 1 + 0.2 × écart)`.
- **Capture** : offre après 35 % des vagues gagnées (`CAPTURE_OFFER_CHANCE`), sur un ennemi tiré au hasard ; chromatique
  (1/256 par ennemi, `SHINY_ODDS`) toujours proposé et garanti ; boss vaincu capturé d'office. Balls : Poké 30 %, Super 55 %,
  Hyper 80 %, ×0,5 si l'espèce est rare dans la zone (poids < 10). Début de partie : `START_BALLS` = 25 (aussi à chaque
  prestige), Poké Ball à 50 % tant que l'équipe a < 3 Pokémon, **pitié** (`CAPTURE_PITY` = 3 échecs de suite → capture
  garantie, `missStreak`). Niveau du capturé plafonné au meilleur de l'équipe. Réglages : capture auto des espèces
  manquantes, ne pas proposer une espèce déjà possédée à 3★+, ne pas capturer un chromatique déjà obtenu.
- **Poids des espèces** : voir `REGIONS.md`. Tous les légendaires sont à 20 (chasse aux chromatiques en hors ligne visée :
  ~5 h Kanto, 9 h Johto, 18 h Hoenn, 40 h Sinnoh).
- **Butin** : 11 %/sauvage (`LOOT_CHANCE`), boss 3 objets ; niveau = `max(niveau ennemi, meilleur de l'équipe)`.
- **Objets** : 7 raretés, panoplies (`SETS`), `BIOME_SET` + `biomeTier` pour les régions 3+. Puissance calée sur les
  **poids mesurés** (`STAT_WEIGHT`, 2026-09-24). Comparaison d'équipements par `combatValue` (modèle multiplicatif :
  Critique × Dégâts critiques liés, Recharge plafonnée à 40 %) dans le contexte du Pokémon (`monBaseBonuses` : talents,
  auras, badges) : `autoEquipBest` évalue chaque combinaison complète, `equipGain` donne les flèches du sélecteur.
  Anciennes sauvegardes : sous-stats converties une fois (`balanceVersion`). Recyclage en éclats (`recycleValue`).
- **Qualité génétique** : gènes 0-15 (PV/Atq/Déf/Vit) tirés à la capture, jamais modifiés (sauf méga bonbons). Étoiles :
  4★ parfait, 3★ ≥ 80 %, 2★ ≥ 50 %. Plancher garanti par badge (`genesMinForBadges` : ≥ 8 dès 4 badges, ≥ 12 dès 8).
- **Sous-stats** (depuis le 2026-09-24) : Attaque, Défense, PV, Vitesse, Critique, Dégâts critiques, Dégâts du type,
  Recharge, Vol de vie, Esquive. Chance de statut, dégâts contre statut, attaque de base et zone ont été **supprimées**
  (valeur quasi nulle mesurée). Dégâts critiques n'ont de valeur qu'avec beaucoup de Critique.
- **Talents** : 1 arbre par type primaire, `talentPoints(level)` = niveau − 1 (+1 à Nv.100). 9 paliers ; paliers 4-5 = affinités
  « au choix » (type figé au 1er rang) ; paliers 6-9 = Spécialité II, saveur du 2e type (valeur par rang ÷ 2), Fureur,
  Précision mortelle. Les deux Affinités peuvent viser le même type. **Spécialités rééquilibrées** : chaque type vaut à
  peu près autant au rang max (84-88 % de victoires en 3 contre 3 contre 60 % sans, voir `AUDIT_EQUILIBRAGE.md`) ;
  Réflexes donne de l'Esquive.
- **Auras** : chaque membre de l'équipe donne l'aura de son type à toute l'équipe (pleine en équipe, moitié en
  pension/exploration) ; un Pokémon bi-type donne ses deux auras, chacune divisée par 2.
- **Évolutions à choix** : `EVOLUTION_CHOICES` (11 espèces, dont Évoli ×7), filtrées par `dexMax` ; la fiche Pokémon a un bouton
  « Faire évoluer » qui ouvre un choix quand il y a plusieurs formes. Les automatismes (bot, `completeDex`) prennent la forme
  par défaut (`evolvesTo`).
- **Compléter le Pokédex / doublons** : `completeDex` et `excessMons`/`releaseExcess` suivent le réglage
  `keepEvolutionMaterial` (mode collectionneur par défaut : garde 1 exemplaire par étage possédé + matière pour les étages
  manquants ; décoché : un exemplaire unique peut évoluer si l'étage suivant manque au Pokédex).
- **Pension** (XP passive, 40 % de l'XP/h de l'équipe, taux rafraîchi à chaque récolte) et **Exploration**
  (`SHARDS_PER_MIN` = 3 éclats/min par Pokémon) : plafond 8 h, un Pokémon ne peut être que dans l'une des deux.
- **Hors ligne** (`idle.ts`) : plafond 8 h (`IDLE_CAP_MS`), calcul par échantillon réel de combats, gains encaissés tout de
  suite avec un résumé (`IdleSummary`). **XP, butin et chromatiques suivent tous l'étape en cours** (`idleRun`, 2026-09-24) :
  +1 étape après 3 vagues gagnées (jamais au-delà de la plus haute débloquée), −1 étape après un K.O. (comme au premier plan,
  sans changer de zone) ; au retour, la position affichée reprend l'étape atteinte (`endStage`). `IDLE_REWARD_MULT` = 1
  (XP et butin, pas de réduction : la vitesse ×2 avantage déjà le jeu actif ; 0,8 = −20 %). `idleFarmTarget` passe à la
  zone suivante (déjà débloquée) quand la zone est entièrement farmée. La pension (`teamXpPerHour`) mesure toujours l'étape 1.
- **Réglage « Avancer dans les étapes »** (⚙, activé par défaut) : `GameState.fixedStage` (dans la sauvegarde, `null` =
  avance auto). Désactivé (`setAutoAdvance`), l'étape en cours devient un plafond, au premier plan comme hors ligne : une
  étape gagnée est rejouée (la suivante se débloque quand même), un K.O. recule d'une étape sans jamais changer de zone,
  puis on regrimpe jusqu'au plafond ; choisir une étape sur la Carte déplace le plafond (`selectStage`, sauf raccourci
  boss) ; le hors ligne ne passe plus à la zone suivante. La Carte affiche « 📌 Étape fixée » sous les étapes de la zone.
- **Cibles 🎯 (farm de bonbons)** : `GameState.targets` = bases de lignée (`toggleTarget`, bouton dans la fiche Pokémon et
  la fenêtre « où le trouver » du Pokédex ; 🎯 devant les zones concernées sur la Carte). Une offre de capture d'un membre
  d'une lignée ciblée est capturée automatiquement, même déjà possédée (`captureTarget`, Ball selon « Toujours utiliser
  la meilleure Ball »), en combat comme **hors ligne** (`idleTargetCaptures` : mêmes règles, stock de Balls seulement,
  jamais d'achat, arrêt quand il est vide ; résumé au retour). Réglage `convertTargets` (défaut activé) : un exemplaire
  qui n'est ni chromatique ni meilleur en étoiles que le meilleur possédé est relâché aussitôt (`RELEASE_CANDIES` = 3).
  Le hors ligne ne quitte jamais une zone qui contient une cible (`zoneHasTarget` dans `idleFarmTarget`).
- **Garder l'écran allumé** (réglage `keepAwake`, `expo-keep-awake`, module natif : nouvel APK nécessaire) : composant
  `KeepAwake` monté dans `App.tsx` tant que le réglage est actif.
- **Prestige** : voir `REGIONS.md`. Le `runner` ne consulte jamais `unlocked` : toute téléportation directe de
  `s.biome/zone/stage` (hors `selectStage`) doit débloquer la zone visée.
- **Pokédex** : n'affiche que les espèces ≤ `dexMax` de la région ; toucher une espèce vue ouvre « où la trouver »
  (`whereToFind`, y compris la route par évolution).

## Règles de travail
- Toute modif de règle de jeu = test Jest dans `src/game/__tests__/`, puis tests rapides + `npm run typecheck`.
  Toute modif de `battle.ts`, des courbes de difficulté, des pools ou du bot demande aussi la simulation longue
  (`balance.test.ts`, jamais de « changement mineur » sans vérifier : l'attaque de base typée avait cassé le début de partie).
- Garder le moteur indépendant de React et déterministe.
- Ne commiter/pousser que sur demande d'Arno. `CODEMAP.md` est dans `.gitignore` et ne doit **jamais** être poussé.
- Les messages personnels d'Arno dans l'UI (écran de départ, crédits du HUD) sont de lui : ne pas les retoucher.
- Simulations : lentes (~10 min pour une région). Arno préfère tester en vrai ; ne pas en relancer sans nécessité.
