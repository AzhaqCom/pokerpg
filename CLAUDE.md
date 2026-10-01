@AGENTS.md

# PokéLoot — contexte projet

RPG mobile à **combats automatiques** façon Lootborn Warriors. Le joueur ne pilote pas les combats : il joue la
**préparation** (capture, équipe de 3, objets, fusion, talents, ordre des capacités, évolutions à choix, pension,
exploration). Expo SDK 57 / React Native 0.86 / React 19 / TypeScript, Hermes, New Architecture. Version **1.1.0**.
Projet perso non commercial (sprites PMD SpriteCollab CC BY-NC → pas de Play Store, APK perso).
**Tout en français** (UI, commentaires, commits). Dev sous **Windows + PowerShell 5** : pas de `&&`, une commande par
ligne. Arno veut des propositions arrêtées et structurées, pas une liste d'options ouvertes.

**État** : 4 régions jouables et testées en simulation — Kanto (151), Johto (251), Hoenn (386), Sinnoh (493) — reliées
par un prestige. 47 biomes. Fonctionnement des régions et recette d'ajout : `REGIONS.md`. Pistes et écarts connus : `IDEES.md`.
**Dernière passation : `SESSION_2026-10-01.md`.** (L'ancien journal `HISTORIQUE.md` a été retiré : l'historique est dans git.)

## Commandes
```
npm install
npx expo start -c       # Expo Go / dev client
npm run typecheck       # tsc --noEmit
npx jest --testPathIgnorePatterns=balance.test.ts   # tests rapides (~230, ~20 s)
npx jest balance.test.ts                            # simulations de bout en bout (~11 min)
eas build -p android --profile preview              # APK
```
Modules natifs : toujours `npx expo install <pkg>`. Plugin local `plugins/withNoForceDark.js` (`android:forceDarkAllowed=false` :
le mode sombre forcé des téléphones assombrissait les couleurs claires, ex. Électrik brun ; natif, APK seulement). Skia 2.6.2 (épinglé) **exige** `react-native-reanimated` 4.5.1 +
`react-native-worklets` 0.10.1 (sinon crash au lancement).

## Architecture
- `src/game/` : **moteur pur TS, sans React, testé**. Toute règle de jeu vit ici, déterministe (toujours passer un `Rng`).
  - `battle.ts` : classe `Battle`, combat temps réel à recharges. `step(dt)` par pas de 50 ms, `drain()` renvoie les
    événements pour l'UI, `runToEnd()` pour les tests. PV ×4 en combat (`HP_SCALE`), `MAX_BATTLE_TIME` 120 s = défaite.
    Action : première capacité prête et utile dans l'ordre du Pokémon (jamais une attaque à ×0 contre la cible,
    ni une attaque de zone sans effet sur tous, depuis le 2026-10-01), sinon attaque de base (**neutre** : jamais de STAB,
    jamais ×0/×2). Dégâts : `((0.4·niv+2)·puissance·atq/déf)/50+2` × STAB 1.5 × type × crit × bonus × 0.85–1.
    Recharge réelle : `cdFactor(spe, cdrPct)` = `100/(100+Vitesse) × 100/(100+Recharge)` (sans plafond depuis le
    2026-10-01). Cadence : `actionLock(spePct)` = 0,7 s × `100/(100+bonus de Vitesse %)` entre deux actions (les sauvages
    n'ont pas de bonus → inchangés). Vitesse = combien d'actions, Recharge = lesquelles (capacités plutôt qu'attaque de base).
  - `game.ts` : `GameState` sérialisable + toutes les actions (équipe, objets, fusion, talents, évolution, pension,
    exploration, boutique, capture, prestige, `completeDex`, `whereToFind`, courbes de difficulté). `StageRun` = une
    étape (3 vagues) ; `finishWave()` → `waveRewards()` ; `onStageWon` avance d'étape ; `onStageLost` recule.
  - `content.ts` : `REGIONS`, `BIOMES` (47), `STAGES_PER_ZONE` = 5, `BADGE_BONUS`. Voir `REGIONS.md`.
  - `data.ts` : accès typé aux JSON, `EVOLUTION_CHOICES`, `evolutionTargets`.
  - `items.ts` (catalogue, 7 raretés, panoplies, `BIOME_SET`, `biomeTier`, loot, fusion 3→1, amélioration, recyclage),
    `talents.ts`, `stats.ts` (stats finales, auras, `xpForLevel = 30·N²`), `idle.ts` (hors ligne), `rng.ts`,
    `bot.ts` (joueur automatique pour les simulations), `collection.ts` (objectifs de collection, capture auto),
    `optimize.ts` (modèles des boutons « ★ Auto » : kit de capacités, part de dégâts par type, duel d'équipement).
- `src/data/` : `species.json` (493), `moves.json`, `types.json` **générés** par `tools/gen_data*.py` depuis les CSV PokéAPI
  (Atq = max(Atq, Atq Spé), Déf = moyenne, recharge = `clamp(2,12,(puissance−20)/10)` +3 s si zone). Retoucher un JSON
  à la main est écrasé si on relance le script ; les espèces déjà figées ne sont jamais réécrites.
  **Capacités par niveau : celles de Platine pour les 493** (`tools/gen_learnsets_pt.py`, ne touche que `learnset` et
  garde toutes les anciennes capacités dans `moves.json`). Corrections appliquées au chargement dans `data.ts` (jamais dans
  les JSON) : `MOVE_FIXES` (Baston, Explosion, Destruction), `BABY_EVOLUTIONS`, `CROSS_GEN_EVOLUTIONS`. `learnedMoves`
  inclut les capacités des pré-évolutions (`lineLearnset`) ; `movesAtLevel` (kit de départ d'une capture/d'un sauvage) =
  les 4 meilleures capacités connues (sommeil, attaques de types variés, soin). Le bouton « ★ Auto » des capacités
  (`autoMoves`) fait mieux : `bestMoves` (`optimize.ts`) cherche le kit au plus de dégâts par seconde avec les vraies
  stats du Pokémon (recharges × Vitesse/Recharge, verrou d'action 0,7 s, efficacité moyenne, zone, drain) ; mesuré en
  Tour (2026-10-01) ~+12 points de victoire en moyenne. `movesAtLevel` reste celui des sauvages (équilibrage).
- Sprites : atlas PMD par espèce (`assets/sprites/p025.png`, `ps025.png` chromatique), manifeste `src/data/sprites.json`,
  `spriteAssets.ts`, miniatures `assets/thumbs` (`tools/make_thumbs.py`, 240 px).
- UI : `App.tsx` (onglets Équipe, Sac, Boutique, Carte, Pension, Exploration, Pokédex) ; `src/ui/battle/runner.ts` (singleton hors React qui pilote le combat affiché, offres de capture,
  bandeaux), `BattleView.tsx` (Skia), `Hud.tsx` (réglages), `CaptureBar.tsx`, `panels/` (Équipe, Sac, Boutique, Carte,
  Pension, Exploration, Pokédex), `TowerSection.tsx` (onglet de la Tour sur la Carte), `MonSheet.tsx` (fiche Pokémon,
  2026-10-01 : en-tête sur une ligne, onglets Combat · Talents · Bonbons, capacités sur une ligne avec sélecteur
  `MovePicker`, objets en 3 mini-cartes avec sous-stats et bouton « ⚙ Gérer », effet de chaque talent toujours affiché,
  gènes en colonnes), `ItemDetail.tsx` (fiche d'un objet), `HelpScreen.tsx`, `IdleSummary.tsx`, `PrestigeOffer.tsx`.
  Les listes longues (`TeamPanel`, `BagPanel`, `DexPanel`) sont des `FlatList` rendues **hors** du `ScrollView` de `App.tsx`.
  PC affichés = `monPower` (le Pokémon seul : objets, talents, badges, **sans les auras** de l'équipe/pension, pour
  qu'ils ne bougent pas quand on change d'équipe). PC colorés par palier (`CP_TIERS`/`cpColor` dans `ui/helpers.ts` : gris < 250, vert, bleu 600, violet 1 200, orange
  2 000, rouge 3 000, doré ≥ 4 000) sur la fiche, les cartes d'équipe et la liste d'échange.
  Boutique : Balls achetées au toucher (+1) ou en rafale (appui long) ; au relâchement d'une rafale, boîte « ×10 · ×100 »
  sous les Balls pendant 3 s (`buyBalls`, tout ou rien). Le Sac n'affiche plus que le stock.
  Cartes d'objets (`ItemCard`, 2026-10-01) : compactes par défaut (nom sur 2 lignes, « Nv. » sans la panoplie, rareté portée
  par la couleur, sous-stats en pastilles abrégées `STAT_SHORT`, colorées par `subTier` (vert ≥ 10, jaune ≥ 8, d'après `SUB_WORTH`), porteur en
  pastille miniature sur le coin haut-droit, jamais une ligne de plus) ;
  `full` dans la fiche d'un objet (`ItemDetail`). « Améliorer » maintenu = rafale accélérée (`useHoldRepeat`).
  Sac : filtre par panoplie (puces défilantes) et « ♻ Recycler <panoplie> » avec confirmation (`setRecycleCandidates` :
  toutes raretés, jamais les objets verrouillés 🔒 ni portés).
  Lisibilité du combat (2026-09-25) : zone de combat haute de 72 % de la largeur ; messages 1,6 s, 2 max à l'écran
  (`TOAST_MS`/`TOAST_MAX`, `store/ui.ts`), un seul par événement (butin groupé par vague, capacités groupées par
  Pokémon, « ✨ X chromatique capturé ! ») ; offre de capture `CaptureBar` sur une seule ligne compacte.
  Décors abstraits fixes par type de zone et pour les arènes (`battle/Backdrop.tsx` : `BackdropBack` derrière le sol,
  `BackdropFront` sur le sol, sous les sprites), palette `SKIES` dans `BattleView.tsx`. Types de zone (`ZoneDef.biome`,
  purement visuel) : prairie, forêt, grotte, eau, électrique, marais, temple, volcan, désert, **ligue** (salles de Ligue
  et du Champion), **dojo**, **hanté** (Tour Hantée, Manoir) ; les arènes ont leur propre décor.
- **Police** : Nunito (OFL, `assets/fonts/`, 5 graisses) embarquée dans l'APK par le plugin `expo-font` (famille Android
  « Nunito », le `fontWeight` choisit la graisse) ; chargée au démarrage dans Expo Go seulement (`useGameFont`).
  **Toujours importer `Text`/`TextInput` depuis `src/ui/components/Text`**, jamais depuis 'react-native' : la police
  système des Xiaomi (MiSans) faisait mesurer et dessiner les textes avec deux polices différentes au 1er lancement à
  froid (mots coupés : « Equip », « Nv.10 ») jusqu'au rechargement. Changer de police = nouvel APK.
- **Performances** : sprites chargés par `useSpriteImage`/`preloadImage` (`src/sprites/imageCache.ts`, cache des 24
  dernières planches décodées ; `useImage` de Skia n'a aucun cache et redécodait chaque planche à chaque vague, par le
  réseau dans Expo Go) ; le runner précharge les ennemis des 3 vagues au début de l'étape. Onglet Équipe : calculs de
  collection mémorisés sur `boxSignature` et cases de la boîte mémorisées (`BoxCell`), pas recalculés à chaque `rev`.
- État : zustand + AsyncStorage (`src/store/game.ts`, clé `pokelootborn/save/v1`, `act(fn)` modifie + sauve).
  **Sauvegarde protégée (2026-10-01)** : une sauvegarde illisible n'est jamais écrasée — copiée sous
  `pokelootborn/save/illisible/<horodatage>` avant une partie neuve, et si la lecture elle-même échoue, la session ne
  sauvegarde rien ; échec d'écriture et sauvegarde > 1,5 Mo signalés par une fenêtre (`saveIssue`) ; « Tout effacer »
  annule la sauvegarde en attente.
  `load()` fusionne la sauvegarde avec `newGame()` → **un nouveau champ doit avoir une valeur par défaut dans `newGame()`** ;
  `migrateSave` complète les tableaux de biomes trop courts.
- Outils : `tools/gen_region.ts` (génère un bloc de biomes depuis `tools/regions/*.json`), `tools/regen_pools_official.ts`
  (pools de Johto à Sinnoh depuis les jeux officiels), `tools/fetch-sprites.ts`, `tools/gen_data*.py`,
  `tools/gen_learnsets_pt.py`, `tools/measure/` (simulations par région). `tools/scratch/` = scripts de mesure locaux,
  **non versionnés** (mesures du 2026-10-01 : `auto_audit.ts`, `proto_speed.ts`, `calib_speed.ts`, `proto_sets.ts`,
  `tower100.ts`).

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
- **Charme Chroma** (`hasShinyCharm`/`shinyOdds`) : Pokédex de la région complet (capturés) → chromatiques 1/128 au lieu
  de 1/256, en combat et hors ligne ; perdu au prestige (le Pokédex repart à zéro), regagné dans la région suivante.
  Annoncé par une fenêtre à fermer soi-même (`ShinyCharmScreen`, combat en pause), une fois par région (`shinyCharmSeen`).
- **Boutique** (onglet 🛒, `ShopPanel`, 2026-09-30) : Balls (déplacées depuis le Sac), bonus temporaires `BOOSTS`
  (`GameState.boosts` = horodatage de fin ; 1 h par achat, 8 h de réserve au plus, perdus au prestige) : Mini Charme Chroma
  3 000 (chromatiques ×1,5, cumulable : 1/171, 1/85), Encens 800 (offres de capture ×2), Parfum rare 1 500 (poids des
  espèces rares < 10 ×3, `pickSpecies(…, rareMult)`), Multi Exp 1 000 (XP de l'équipe ×1,5). Hors ligne, chaque bonus
  compte au prorata de l'absence couverte (`boostCoverage`). Méga bonbon universel 2 000 (`universalMega`, gardé au
  prestige ; `applyMegaCandy` prend ceux de la lignée d'abord). Minuteurs des bonus actifs dans `HudTop`.
- **Nouvelle partie / prestige** : `runner.newGame()` efface l'offre de capture en cours (bug du 2026-09-30 : Arceus de
  Sinnoh capturé à Kanto) ; `tryCapture` refuse toute espèce > `dexMax` ; `migrateSave` purge le Pokédex hors région.
- **Fin de l'aventure** (`endingReady`, `EndingScreen`) : Champion de la dernière région → écran « Maître Pokémon » avec le
  récap de toute la partie (`adventureStart`), montré une fois (`endingSeen`), puis on continue dans la région.
- **Poids des espèces** : voir `REGIONS.md`. Tous les légendaires sont à 20 (chasse aux chromatiques en hors ligne visée :
  ~5 h Kanto, 9 h Johto, 18 h Hoenn, 40 h Sinnoh).
- **Butin** : 11 %/sauvage (`LOOT_CHANCE`), boss 3 objets ; niveau = `max(niveau ennemi, meilleur de l'équipe)`.
- **Objets** : 7 raretés, panoplies (`SETS`), `BIOME_SET` + `biomeTier` pour les régions 3+. Puissance calée sur les
  **poids mesurés** (`STAT_WEIGHT`, 2026-09-24 ; Vitesse et Recharge recalées le 2026-10-01). Deux valeurs d'équipement dans le contexte du Pokémon
  (`monBaseBonuses` : talents, auras, badges) : `quickEquipValue` (`combatValue` des bonus, poids fixes, + soin de la
  baie) et `equipValue` (duel `duelMult` d'`optimize.ts` : multiplicateur tenu à égalité contre un adversaire moyen,
  Vol de vie et kit réel compris). Chacune se trompe de 10 points ou plus sur certains Pokémon : `autoEquipBest` prend
  la meilleure combinaison selon chacune (`bestEquipCombo` : combinaisons des 6 meilleurs objets par emplacement +
  panoplies à 2-3 pièces, exact sur un petit sac) puis les **départage par ~500 vrais combats** déterministes de
  l'équipe réelle (`benchEquipCombos`, 2026-10-01). Le bot garde `autoEquipBest(…, 'quick')` (ancien calcul seul,
  équilibrage inchangé) ; `equipGain` (flèches du sélecteur) suit le calcul retenu par le dernier Auto pour ce Pokémon
  (`Mon.equipModel`, absent = `quickEquipValue`) : après l'Auto, aucune flèche ne le contredit.
  Anciennes sauvegardes : sous-stats converties une fois (`balanceVersion`). Recyclage en éclats (`recycleValue` = `recycleBase` + `recycleRefund`, 2026-10-01) : la plus grande entre
  2 × (rareté + 1 + cran)² + niveau et 10 % du coût d'un niveau d'amélioration (Chromatique Nv.200 : 700 au lieu de 298),
  + 50 % des éclats dépensés à la main en améliorations (`Item.invested`, additionné à la fusion, compté depuis le
  2026-10-01).
  **Critique (2026-09-25)** : la chance de critique au-delà de 100 % est convertie 1 pour 1 en Dégâts critiques
  (`critOverflow`, en combat et dans `combatValue`). Les 5 objets Critique sont **mixtes** (`bonusCrit`) : Critique fixe par
  rareté (`CRIT_BY_RARITY` 8→25 %) + Dégâts critiques qui grimpent avec le niveau (`CRIT_HYBRID_BASE`, calés pour valoir
  l'objet Attaque équivalent à ~30 % de Critique) ; les objets déjà possédés suivent (valeur recalculée depuis le modèle).
- **Fin de jeu** (`endgameUnlocked` : dernier Champion battu, 2026-09-30) : **Chromatique +N** (`Item.plus`) = fusion de 3
  Chromatiques +N identiques (`fuseKey` : objet, rareté, cran) → +N+1, sans plafond ; stat principale +0,2 au
  multiplicateur de rareté par cran (`rarityMult`, ×2,4 → ×2,6…), secondaires +10 % par cran (`PLUS_SUB_STEP`),
  recyclage/amélioration plus chers. Niveau des objets déplafonné (`itemLevelCap`). Cartes +N : bordure arc-en-ciel
  (`RainbowBorder`, fixe dans les listes, tournante seulement dans la fiche détaillée) et « Chromatique +2 » en couleurs.
- **Tour de Combat** (fin de jeu, onglet « 🗼 Tour de Combat » après le dernier biome de la Carte, `TowerSection`, 2026-09-30) : `StageKind` `'tower'`, 1 combat par étage
  contre 3 formes finales/légendaires Nv.100 aux gènes parfaits (`towerSpecies`, `towerWaves`), PV et Atq ×`TOWER_BASE`
  (12) × `TOWER_GROWTH` (1,024)^(étage − 1), calés par `tools/scratch/tower.ts` avant la refonte Vitesse/Recharge (mur
  ~étage 13 pour le bot en fin de Sinnoh, ~30 en Chromatique Nv.100, ~100 en +8 Nv.300). Mesure du 2026-10-01
  (`tower100.ts`) : Giratina + Kyogre + Heatran, Nv.100 4★, Chromatiques Nv.200, gagnent l'étage 100 à 53 % en +0,
  84 % en +2, 95 % en +4. `GameState.towerFloor` (null = hors Tour ; le runner enchaîne
  les étages, `selectStage`/boss/arène en sortent), `towerBest` (record), reprise au palier de 10 (`towerStart`).
  Défaite = sortie sans pénalité ; jamais hors ligne. **Combat continu** (`towerAuto`, interrupteur 🔁, défaut désactivé,
  2026-10-01) : une défaite fait reprendre au début du palier de 10 en cours, ou du précédent sur son 1er étage
  (`towerRetryFloor`). **Coffres de palier au premier passage seulement** (étage gagné > record, 2026-10-01) : rejouer
  des étages ne rapporte que leurs éclats et leur Chromatique (avant, un +5 au choix toutes les 10 victoires vers l'étage 120). Récompenses (`towerFloorRewards`) : `towerShards` éclats, 1 objet
  **Chromatique** Nv.100 + étage tiré parmi les 45 objets des 15 panoplies de Sinnoh (`towerLootTemplates` : puissance
  identique quelle que soit la panoplie, créés au niveau du dernier biome ; moins d'objets différents = plus de doublons
  à fusionner), tous les 10 étages (premier passage) un Chromatique +`towerRewardPlus`
  (+1 tous les 20 étages, 10 % de chance d'un cran de plus) à choisir objet par objet (`towerRewards`, `claimTowerReward`).
  **Entraînement hors ligne** (`towerIdle`, activé par défaut, interrupteur dans l'onglet de la Tour) : dès un étage
  franchi, l'absence rejoue `towerIdleFloor` (dernier palier de 10, ou `towerIdlePick`, jamais au-delà du record ; une
  défaite fait redescendre d'un étage, 10 au plus) au lieu de farmer la zone : 1 Chromatique Nv.100 + étage tous les
  `TOWER_IDLE_ITEM_EVERY` (10) étages gagnés, éclats ÷ 2, ni XP, ni chromatiques, ni captures, ni +N (`towerIdleGains`
  dans `idle.ts`). Mesuré : 230 à 390 Chromatiques par nuit de 8 h.
- **Qualité génétique** : gènes 0-15 (PV/Atq/Déf/Vit) tirés à la capture, jamais modifiés (sauf méga bonbons). Étoiles :
  4★ parfait, 3★ ≥ 80 %, 2★ ≥ 50 %. Plancher garanti par badge (`genesMinForBadges` : ≥ 8 dès 4 badges, ≥ 12 dès 8).
- **Sous-stats** (depuis le 2026-09-24) : Attaque, Défense, PV, Vitesse, Critique, Dégâts critiques, Dégâts du type,
  Recharge, Vol de vie, Esquive. Chance de statut, dégâts contre statut, attaque de base et zone ont été **supprimées**
  (valeur quasi nulle mesurée). Dégâts critiques n'ont de valeur qu'avec beaucoup de Critique.
  **Vitesse et Recharge (2026-10-01)** : sous-stats à croissance lente (`slowLvlMult` = racine de `lvlMult`, `FLAT_SUBS`),
  objets **mixtes** (`ItemTemplate.flat`) : Nageoire Rapide (Attaque), Semelle Isolante, Voile Brumeux (Défense), Plume
  Véloce, Voile Mental (PV) à 60 % de stat principale (`HYBRID_MAIN_SHARE`) + bonus de Vitesse / Recharge (`flatBonus`,
  `FLAT_HYBRID_BASE` × `slowLvlMult` × rareté) ; panoplies Circuit/Zéphyr Vitesse +10 %, Œil/Voile de la Tour Recharge
  +24. `combatValue` recalé (`tools/scratch/calib_speed.ts`, prototype `proto_speed.ts`). Anciennes sauvegardes :
  sous-stats Vitesse/Recharge converties une fois (`convertFlatSub`, `balanceVersion` 3).
  **Valeurs mesurées des sous-stats** (`SUB_WORTH`, Tour étage ~100, `tools/scratch/tower100.ts`) : PV 11,5, Vitesse 11,1,
  Attaque 10,2, Type 8,8, D.crit 7,4, Défense 6,5, Critique 4,1, Recharge 1,2 (points de victoire par jet moyen). Servent
  à la fusion (`fuse` garde les sous-stats au meilleur `subScore`, plus les plus gros chiffres ; `fusionCandidates`
  départage à niveau égal), à l'équipement Auto (3e candidat `measuredEquipValue`, départagé par combats comme les
  autres) et aux couleurs.
  **Bonus de panoplie qui grimpent** (`setBonusValue`, 2026-10-01) : 2 pièces = 1 jet moyen de sous-stat (`subRollRef`)
  au niveau de la pièce la plus basse portée, 3 pièces = 2 jets ; Vol de vie / Esquive : valeur de `SETS` × croissance
  lente ; jamais sous la valeur fixe de `SETS` (plancher : début de partie inchangé). Affichés au niveau du biome sur la
  Carte, de l'objet dans sa fiche (`setBonusText`). Prototype `tools/scratch/proto_sets.ts` : Tour +6 à +9 %.
- **Talents** : 1 arbre par type primaire, `talentPoints(level)` = niveau − 1 (+1 à Nv.100). 9 paliers ; paliers 4-5 = affinités
  « au choix » (type figé au 1er rang) ; paliers 6-9 = Spécialité II, saveur du 2e type (valeur par rang ÷ 2), Fureur,
  Précision mortelle. Les deux Affinités peuvent viser le même type ; le bouton Auto les met
  toutes deux sur le type qui porte le plus de dégâts du kit (`kitTypeShare`, attaque de base = Normal ; avant le
  2026-10-01 : type le plus fréquent, statuts compris → Lokhlass en Normal à cause de Berceuse). Descriptions arrondies
  (`roundPct`). **Spécialités rééquilibrées** : chaque type vaut à
  peu près autant au rang max (84-88 % de victoires en 3 contre 3 contre 60 % sans, voir `AUDIT_EQUILIBRAGE.md`) ;
  Réflexes donne de l'Esquive. Recalage du 2026-09-29 : arbre complet ≥ 440 « % d'Attaque » pour tous (441-529, les types
  à Critique un cran au-dessus). **Esquive et vol de vie plafonnés à 50 %** en combat (`DODGE_CAP`, `LIFESTEAL_CAP`).
- **Auras** : chaque membre de l'équipe donne l'aura de son type à toute l'équipe (pleine en équipe, moitié en
  pension/exploration) ; un Pokémon bi-type donne ses deux auras, chacune divisée par 2.
- **Évolutions à choix** : `EVOLUTION_CHOICES` (11 espèces, dont Évoli ×7), filtrées par `dexMax` ; la fiche Pokémon a un bouton
  « Faire évoluer » qui ouvre un choix quand il y a plusieurs formes. Les automatismes (bot, `completeDex`) prennent la forme
  par défaut (`evolvesTo`).
- **Compléter le Pokédex / doublons** : `completeDex` et `excessMons`/`releaseExcess` suivent le réglage
  `keepEvolutionMaterial` (mode collectionneur par défaut : garde 1 exemplaire par étage possédé + matière pour les étages
  manquants ; décoché : un exemplaire unique peut évoluer si l'étage suivant manque au Pokédex). Choix de l'exemplaire gardé
  **par total des gènes puis PC** (`byQuality`, aussi utilisé par l'objectif « boîte » de `collection.ts` depuis le 2026-10-01) : le meilleur en gènes d'un étage est toujours gardé en plus du porteur en
  équipe/pension/exploration s'il fait mieux (bug du 2026-09-25 : un 4★ bas niveau partait, le tri se faisait aux PC).
  Réserve d'évolution : 1 par forme manquante, choisie **parmi ses pré-évolutions** (`isAncestor`). **Lignées à
  branches** (2026-09-25) : `lineBase` suit `preEvolution` (évolutions à choix comprises) et `lineForms` liste toutes
  les formes — Voltali partage la base d'Évoli (bonbons, méga bonbons, cibles, doublons ; anciens stocks et cibles
  regroupés par `migrateSave`). `completeDex` ne suit toujours que la forme par défaut (`lineChain`).
- **Verrou 🔒** (`Mon.locked`, `toggleLock`) : un verrouillé n'est jamais relâché (`release` refuse), ni nettoyé
  (doublons, 3★+, chromatiques), ni utilisé par `completeDex`. Posé d'office sur tout 4★ (`addMon`, méga bonbon qui rend
  parfait, et 4★ des anciennes sauvegardes via `migrateSave` quand `locked` est absent). Cadenas à côté du nom dans la fiche,
  🔒 en bas à gauche de la vignette dans la boîte.
- **Pension** (XP passive, 50 % de l'XP/h de l'équipe (`PENSION_XP_SHARE`), taux rafraîchi à chaque récolte) et **Exploration**
  (`SHARDS_PER_MIN` = 3 éclats/min par Pokémon) : plafond 8 h, un Pokémon ne peut être que dans l'une des deux.
  Retirer un Pokémon (bouton, mise en équipe via `setTeam`) encaisse d'abord son XP / ses éclats (`removePension`,
  `removeExploration`, 2026-10-01 : avant, tout était perdu).
- **Hors ligne** (`idle.ts`) : plafond 8 h (`IDLE_CAP_MS`), calcul par échantillon réel de combats, gains encaissés tout de
  suite avec un résumé (`IdleSummary`). **XP, butin et chromatiques suivent tous l'étape en cours** (`idleRun`, 2026-09-24) :
  +1 étape après 3 vagues gagnées (jamais au-delà de la plus haute débloquée), −1 étape après un K.O. (comme au premier plan,
  sans changer de zone) ; au retour, la position affichée reprend l'étape atteinte (`endStage`). `IDLE_REWARD_MULT` = 1
  (XP et butin, pas de réduction : les vitesses ×2/×3 avantagent déjà le jeu actif ; 0,8 = −20 %). `idleFarmTarget` passe à la
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
- **Prestige** : voir `REGIONS.md`. Récap de fin de région (`PrestigeOffer`) affiché **une fois** quand `canPrestige`
  (combat en pause) : « Nouveau départ » ou « Plus tard » (`postponePrestige` → `GameState.prestigeOffered`, remis à
  `false` par `startPrestige`) ; reporté, il se lance depuis la bannière « 🏆 Nouveau départ à X » en haut de la Carte
  (avec confirmation). Champion battu mais Pokédex incomplet : plus de pause du combat. Les raccourcis boss/arène sous le
  combat (`HudBottom`) ont été retirés (doublons de la Carte) : badge sur l'onglet Carte (`challengesReady`).
  Le `runner` ne consulte jamais `unlocked` : toute téléportation directe de
  `s.biome/zone/stage` (hors `selectStage`) doit débloquer la zone visée.
- **Vitesse de combat** (`maxBattleSpeed`, `SPEED_UNLOCKS`) : ×2 au 1er badge de la région, ×3 au 4e, chacune activée
  d'office avec un message ; les badges repartant à 0, chaque Nouveau départ recommence en ×1 (le réglage `speed` est
  plafonné, pas effacé). Bouton ×1 → ×2 → ×3 du HUD. Bandeaux d'annonce en temps réel (`runner.realClock`).
- **Carte** : en tête de chaque biome, accordéon « 🎒 Panoplie » (fermé par défaut) (`BiomeSetCard` dans `MapPanel.tsx`) : panoplie dont tombent
  les objets du biome (`setOfBiome`), ses 3 pièces avec leur stat principale (`templateStatText`) et ses bonus 2 et 3 pièces.
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
