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
**Dernière passation : `SESSION_2026-10-02.md`.** (L'ancien journal `HISTORIQUE.md` a été retiré : l'historique est dans git.)

## Commandes
```
npm install
npx expo start -c       # Expo Go / dev client (mode développement : lent, pour déboguer)
npx expo start -c --no-dev --minify   # Expo Go en mode production : à utiliser pour juger les performances
                                      # (le mode développement lague partout, l'APK et ce mode sont fluides)
npm run typecheck       # tsc --noEmit
npx jest --testPathIgnorePatterns=balance.test.ts   # tests rapides (~250, ~20 s)
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
  **Fenêtres (`Modal`)** : fond qui ferme au toucher posé derrière le contenu (`components/ModalBackdrop.tsx`, ou
  `backdrop` + `centerWrap` comme l'aide), **jamais** un `Pressable` autour d'une liste défilante : sur Android, un geste
  commencé sur un endroit non tactile de la liste était capté et le défilement passait mal (corrigé le 2026-10-02 dans
  9 fenêtres : zone de la Carte, fiche d'un objet, choix d'une capacité / d'un objet / d'une évolution / d'un échange,
  « où le trouver », Pension, Exploration).
  PC affichés = `monPower` (le Pokémon seul : objets, talents, badges, **sans les auras** de l'équipe/pension, pour
  qu'ils ne bougent pas quand on change d'équipe). PC colorés par palier (`CP_TIERS`/`cpColor` dans `ui/helpers.ts` : gris < 250, vert, bleu 600, violet 1 200, orange
  2 000, rouge 3 000, doré ≥ 4 000) sur la fiche, les cartes d'équipe et la liste d'échange.
  Boutique (`ShopPanel`, refaite le 2026-10-01) : sa propre zone de défilement (comme le Sac) pour garder le solde
  d'éclats fixé en haut ; les 3 Balls sur une ligne (stock, taux, prix) et le méga bonbon universel (2026-10-02) : toucher
  = +1, maintenir = fenêtre d'achat en quantité aussitôt (`BulkModal` : +1 — maintenir = achat en continu `useHoldRepeat` —,
  ×10, ×100 ; reste ouverte jusqu'à « Fermer » ; une fenêtre ouverte interrompt l'appui en cours sur Android, d'où la
  rafale dans la fenêtre) ; bonus en grille 2×2 avec jauge de réserve (8 h) ; un bouton inaccessible affiche ce qui manque
  (« −6 750 »). Fenêtre et bouton partagés : `components/QuantityModal.tsx` (`QuantityModal`, `BuyButton`). Le Sac
  n'affiche plus que le stock de Balls.
  Cartes d'objets (`ItemCard`, 2026-10-01) : compactes par défaut (nom sur 2 lignes, « Nv. » sans la panoplie, rareté portée
  par la couleur (`itemColor` : rareté, ou palier du cran +N), sous-stats en pastilles abrégées `STAT_SHORT`, colorées par `subTier` (vert : PV, Type, Vitesse, Attaque ; jaune : Défense ; d'après `SUB_WORTH` et `SUB_TIER`), porteur en
  pastille miniature sur le coin haut-droit, jamais une ligne de plus) ;
  `full` dans la fiche d'un objet (`ItemDetail`) : fourchette de chaque sous-stat (`subRange` : jet à 70 % – 100 % à son
  niveau et à son cran) ; objet porté : « Panoplie 2/3 portées », bonus débloqués en vert (`setWorn`, `wornSets`).
  Fiche d'un objet (2026-10-02) : « Améliorer » touché = +1, maintenu = fenêtre +1 / +10 (`UpgradeModal`,
  `upgradeItemTimes` tout ou rien, `upgradeCostFor` ; « +N (max) » à moins de 10 niveaux du Nv.100) ; message de fusion =
  le nom seul, à la couleur de l'objet obtenu (`itemColor`), la rareté n'est pas écrite (aussi « Fusionner » du Sac).
  Fiche Pokémon : sous les 3 objets, « 🎒 Panoplie 2/3 : bonus ✓ » en vert dès 2 pièces ; sélecteur d'objet : panoplie
  de chaque carte et, en vert, le bonus que l'équiper activerait avec les 2 autres objets (`setHintFor`).
  Sac : filtre par panoplie (puces défilantes) et « ♻ Recycler <panoplie> » avec confirmation (`setRecycleCandidates` :
  toutes raretés, jamais les objets verrouillés 🔒 ni portés). « ♻ Petits crans » (2026-10-07, dès qu'il y a un
  Chromatique dans le Sac) : fenêtre `PlusRecycleModal`, Chromatiques de +0 jusqu'au cran choisi (−/+, dernier choix
  retenu dans le réglage `recyclePlusMax`, +6 par défaut), limités à la panoplie filtrée s'il y en a une
  (`plusRecycleCandidates` : jamais verrouillés ni portés), décompte et éclats en direct, double toucher pour confirmer.
  Lisibilité du combat (2026-09-25) : zone de combat haute de 72 % de la largeur ; messages 1,6 s, 2 max à l'écran
  (`TOAST_MS`/`TOAST_MAX`, `store/ui.ts`), un seul par événement (butin groupé par vague, capacités groupées par
  Pokémon, « ✨ X chromatique capturé ! ») ; offre de capture `CaptureBar` sur une seule ligne compacte.
  Chiffres flottants (2026-10-07) : dégâts, brûlure, poison et soins abrégés par `fmtShort` (`ui/helpers.ts` : tel quel
  jusqu'à 9 999, puis « 12,3K », « 1,23M », B, T, Qa, Qi) ; une immunité (×0, seulement possible sur une attaque de zone)
  affiche « Immunisé » au lieu de « 0 » ; critique = orange et en grand, sans « ! ».
  Animations en combat (2026-10-07) : sprites PMD extraits en entier (Idle, Walk, Sleep, Hurt, Attack, Pose, une
  direction ; aucune animation n'atteint la limite de 24 images) mais le combat les coupait (~840 ms d'attaque en
  médiane pour une action toutes les 700 ms, moins avec de la Vitesse, chaque action la relançait). Maintenant
  l'animation est indépendante de la cadence : l'attaque se joue en entier à sa vitesse normale, une action pendant
  qu'elle se joue ne la relance pas (un Pokémon rapide fait un geste pour 2-3 coups, les chiffres montrent chaque
  coup) ; un coup reçu n'interrompt plus une
  attaque (animation de blessure seulement si le Pokémon ne fait rien) ; plus de flash blanc : un petit recul
  (`recoilUntil`, `RECOIL_MS`). Attaques PMD qui pivotent (Pokémon de dos) : seul Dracaufeu est limité
  (`ATTACK_FRAME_LIMIT`), repérage des autres mis de côté.
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
  `tower100.ts` ; du 2026-10-02 : `tower_meta.ts` — méta de la Tour, panoplies, valeurs des sous-stats, Sacs réalistes,
  « ★ Ordre » — `auto_bench.ts` — fidélité du banc d'essai d'« ★ Auto » — et `order_bench.ts`, `order_bench2.ts`).

## Règles de jeu actuelles
- **Difficulté des sauvages** : une courbe unique par région (`DIFFICULTY`/`zoneWildMult` dans `game.ts`), plus aucun
  multiplicateur par zone : ×0,60 au départ (Nv.5 après un prestige) → ×2 Kanto / ×2,5 Johto / ×2,9 Hoenn / ×3,3 Sinnoh
  au dernier biome, exposant 1,2, sur PV et Atq. Boss (PV ×5) et arènes (PV ×2) sont multipliés par `bossRamp`
  (×0,5 → ×1,2 sur la région). `SOLO_MALUS` ×0,8 / ×0,9 tant que l'équipe a 1 / 2 Pokémon (hors ligne aussi depuis le 2026-10-02). Sauvage = niveau de l'étape ou −1.
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
  **poids mesurés** (`STAT_WEIGHT`, 2026-09-24 ; Vitesse et Recharge recalées le 2026-10-01). Trois valeurs d'équipement, les deux premières dans le contexte du Pokémon
  (`monBaseBonuses` : talents, auras, badges) : `quickEquipValue` (`combatValue` des bonus, poids fixes, + soin de la
  baie), `equipValue` (duel `duelMult` d'`optimize.ts` : multiplicateur tenu à égalité contre un adversaire moyen,
  Vol de vie et kit réel compris) et `measuredEquipValue` (valeurs mesurées `SUB_WORTH`). Chacune se trompe de 10 points
  ou plus sur certains Pokémon. **« ★ Auto » des objets** (`autoEquipBest`, recherche `autoEquipSearch` refaite le
  2026-10-02) : candidats = l'optimum de chaque calcul (`bestEquipCombo` : combinaisons des 6 meilleurs objets par
  emplacement + panoplies à 2-3 pièces, complétées par les 3 meilleurs objets pour « ★ Auto », `AUTO_EQUIP_SET_FILL`,
  6 pour le bot), les 3 panoplies complètes les mieux classées, et le remplacement d'un objet à la
  fois par les 3 meilleurs du Sac selon 2 calculs ; tri sur 32 combats (`BENCH_SHORT`), finale sur 160 (`BENCH_WAVES`)
  où les 3 optimums sont toujours qualifiés ; puis un tour de remplacements autour du gagnant, objets que les flèches
  marqueraient ▲ compris. Avant, seuls les 3 optimums étaient comparés : un équipement qu'aucun calcul ne plaçait
  premier n'était jamais essayé. Banc d'essai `teamBench` (aussi celui de « ★ Ordre ») : l'équipe réelle contre des
  formes finales/légendaires de son niveau, difficulté calée à ~50 % de victoires, graines fixes (déterministe) ; score
  = **marge** de chaque combat (`fightMargin` : log de la difficulté encore tenable, d'après les PV restants après une
  victoire ou les PV adverses retirés après une défaite ; sans le saut victoire/défaite, l'erreur de choix est
  divisée par ~2 à nombre de combats égal). Rien n'est rejoué : vagues générées une fois et gardées d'un appui à l'autre
  (`benchWaves`), adversaires préparés une fois par appui, marge de chaque combat gardée par candidat (passer de 32 à
  160 vagues ne joue que les 128 qui manquent). Mesuré (`tools/scratch/auto_bench.ts` : chaque équipement possible d'un
  Pokémon jugé sur 4 000 vrais combats de Tour ; Sac de 196 Chromatiques des 20 panoplies, coéquipiers équipés) : le
  meilleur des 153 à 255 équipements possibles pour Giratina, Heatran et Kyogre (après l'allègement : pour Heatran et
  Kyogre ; Giratina le 2e, à 0,7 point, dans le bruit de la mesure). `tower_meta.ts bag` (3 Sacs réalistes, validation
  sur 10 000 combats neufs) : en 2 passes sur l'équipe, le meilleur équipement d'équipe trouvé dans les 3, avant comme
  après l'allègement (Sac des 20 panoplies : l'équipement qui fait 55 % là où l'ancien « ★ Auto » faisait 50 %, étage
  125). 63 à 80 ms par Pokémon sur PC (100 à 140 avant l'allègement, `tools/scratch/auto_cost.ts`).
  **Limite** : un Pokémon à la fois, sans jamais prendre l'objet d'un coéquipier ;
  une seule passe sur une équipe sans objets peut rester 3 à 6 points sous la 2e (le premier équipé est jugé avec des
  coéquipiers nus et prend ce qui servirait mieux à un autre). Le bot garde `autoEquipBest(…, 'quick')` (ancien calcul seul,
  équilibrage inchangé). Flèches du sélecteur (`equipGain`) : le calcul dont l'optimum a gagné (`Mon.equipModel`,
  absent = `quickEquipValue`), et jamais ▲ sur un objet déjà départagé par les combats tant que l'équipement d'« ★ Auto »
  est porté (`Mon.equipAuto` : uid retenus + objets essayés) ; un objet porté par un coéquipier peut afficher ▲
  (échange à faire soi-même).
  **« ★ Ordre »** (2026-10-02, bouton à côté du titre « Équipe », `autoTeamOrder`) : les ennemis visent le 1er Pokémon
  (70 % de leurs coups) et l'ordre pèse plus que l'équipement (Tour, étage 120, même équipe et même équipement : 85 %
  de victoires dans le meilleur ordre, 66 % dans le pire). Le bouton essaie les 6 ordres (2 à 2 Pokémon) sur le banc
  d'essai d'« ★ Auto » (240 combats chacun, `ORDER_WAVES`, difficulté calée sur un ordre fixe : même résultat quel que soit l'ordre de
  départ, un 2e appui ne change rien) et garde le meilleur (« Nouvel ordre : A → B → C » ou « Déjà le meilleur ordre »).
  Mesuré (`tower_meta.ts order`, 4 équipes, 4 000 combats de Tour par ordre) : toujours l'un des 2 meilleurs ordres, au
  plus 1,3 point sous le meilleur (15 à 20 points entre le meilleur et le pire) ; ~40 ms sur PC. Deux ordres à 1-2
  points l'un de l'autre ne se départagent pas de façon fiable, même sur 3 840 combats (`order_bench.ts`).
  **Jets de sous-stats (2026-10-02)** : butin et fusion à 70-100 % du maximum (`SUB_ROLL_MIN`), « Changer une
  sous-stat » à **85-100 %** (`REROLL_ROLL_MIN`) et avec le bonus du cran +N (oublié avant). **Fusion recalée** : chaque
  sous-stat gardée est d'abord remise au niveau de l'objet obtenu (comme `upgrade`) ; avant, celle d'une pièce plus basse
  gardait sa petite valeur. Pas de simulation longue relancée (choix d'Arno : effet faible, le bot fusionne).
  **Sous-stats gardées à 3 décimales** (`roundSub`, 2026-10-02), affichées au dixième (`statText`) : avant, chaque
  amélioration arrondissait au dixième et les arrondis s'accumulaient (jusqu'à 33 points de jet décalés de Nv.1 à 300,
  ~100 à Nv.1 000 : la Vitesse montait trop vite puis restait bloquée ; des sous-stats sortaient de leur fourchette ou
  perdaient de la valeur). Maintenant 0,25 point au pire jusqu'à Nv.1 500 (`tools/scratch/sub_drift4.ts`), et une
  sous-stat est ramenée dans sa fourchette après chaque amélioration, fusion ou cran +N (`clampSub`).
  Anciennes sauvegardes : sous-stats converties une fois (`balanceVersion` ; 4 = sous-stat sous son jet minimum remontée
  à ce minimum, `subRange` ; 5 = sous-stat sortie de sa fourchette par les arrondis ramenée dedans, les autres
  intactes : une sous-stat déjà descendue par les arrondis sans sortir de sa fourchette garde sa valeur, son jet
  d'origine n'étant enregistré nulle part). Recyclage en éclats (`recycleValue` = `recycleBase` + `recycleRefund`, 2026-10-01) : la plus grande entre
  2 × (rareté + 1 + cran)² + niveau et 10 % du coût d'un niveau d'amélioration (Chromatique Nv.200 : 700 au lieu de 298),
  + 50 % des éclats dépensés à la main en améliorations (`Item.invested`, additionné à la fusion, compté depuis le
  2026-10-01).
  **Critique (2026-09-25)** : la chance de critique au-delà de 100 % est convertie 1 pour 1 en Dégâts critiques
  (`critOverflow`, en combat et dans `combatValue`). Les 5 objets Critique sont **mixtes** (`bonusCrit`) : Critique fixe par
  rareté (`CRIT_BY_RARITY` 8→25 %) + Dégâts critiques qui grimpent avec le niveau (`CRIT_HYBRID_BASE`, calés pour valoir
  l'objet Attaque équivalent à ~30 % de Critique) ; les objets déjà possédés suivent (valeur recalculée depuis le modèle).
- **Baies** (2026-10-07) : soin = 25 % × multiplicateur de rareté, **plafonné à 100 %** (`BERRY_HEAL_CAP`, atteint en
  Chromatique +8). Chaque cran au-delà donne des PV % (`berryHpPct`, stat principale des baies, via `mainValue` et
  `addItemBonuses`) : `BERRY_HP_BASE` (objet défensif PV du dernier biome, ≈ 8,45) × `lvlMult` × 0,2 par cran au-delà,
  soit autant qu'un cran sur un objet défensif PV de la Tour (Pêcha Nv.1 300 +17 : ~+1 600 %, ~31 % d'une Cape
  équivalente). Compté dans `berryScore`. Le combat ne change pas (un soin au-delà de 100 % était déjà perdu).
- **Fin de jeu** (`endgameUnlocked` : dernier Champion battu, 2026-09-30) : **Chromatique +N** (`Item.plus`) = fusion de 3
  Chromatiques +N identiques (`fuseKey` : objet, rareté, cran) → +N+1, sans plafond ; stat principale +0,2 au
  multiplicateur de rareté par cran (`rarityMult`, ×2,4 → ×2,6…), secondaires +10 % par cran (`PLUS_SUB_STEP`),
  recyclage/amélioration plus chers. Niveau des objets déplafonné (`itemLevelCap`). Cartes +N : **un look par cran, jamais
  partagé** (`chromaTier` dans `ui/helpers.ts`, 2026-10-01) : +1 Aurore, +2 Lagon, +3 Émeraude, +4 Améthyste, +5 Brasier,
  +6 Or, +7 Diamant, +8 Cosmos, +9 Éclipse, +10 Arc-en-ciel (avant : tous les +N), puis une matière par cran
  (2026-10-07 ; avant, Légende dorée commune + liseré du cran − 10, indiscernable) : +11 Rubis, +12 Saphir, +13 Jade,
  +14 Onyx, +15 Platine (3,5 px), +16 Magma, +17 Sakura, +18 Abysse, +19 Néant (4 px), +20 Divin (or 5 px, liseré
  arc-en-ciel), chacune avec un liseré d'un 2e ton (`inner`) ; au-delà de +20, le Divin avec un halo plus fort et une
  pastille sombre cerclée d'or (`BEYOND`, `glowBlur`, `pillBorder`). Bordure dégradée (`RainbowBorder`, fixe dans les listes, tournante seulement dans la fiche
  détaillée ; halo flouté dès l'Or), pastille « +N » à cheval sur le coin haut-gauche (`ChromaPill`), nom de l'objet et
  « Chromatique +N » de la fiche aux couleurs du palier (`ChromaText`).
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
  des étages ne rapporte que leurs éclats et leur Chromatique (avant, un +5 au choix toutes les 10 victoires vers l'étage 120). Récompenses (`towerFloorRewards`) : `towerShards` éclats
  (1 000 + 100 × étage depuis le 2026-10-07 ; avant, 500 + 50 × étage), 1 objet
  **Chromatique** Nv.100 + étage au cran `towerDropPlus` (2026-10-07 : coffre − `TOWER_DROP_GAP` (6), paliers fixes,
  +0 jusqu'à l'étage 149, +1 dès 150, +3 dès 190, +8 dès 290, +11 dès 350 ; une nuit hors ligne donne ~3 crans sous le
  coffre de l'étage rejoué avec 3 panoplies, ~2 avec 1 ; calé avec Arno, record 366 et équipement +14 à +17 : écart 1
  trop généreux, moitié du coffre inutile ; `makeTowerItem`, aussi celui des coffres) tiré parmi les 60 objets des **20 panoplies du jeu** (`towerLootTemplates`, 2026-10-02 ;
  avant, les 15 de Sinnoh : la Tour n'a plus qu'une liste de panoplies, celle du coffre et des panoplies visées ;
  puissance identique quelle que soit la panoplie, créés au niveau du dernier biome), tous les 10 étages (premier
  passage) un Chromatique +`towerRewardPlus`
  (+1 tous les 20 étages, 10 % de chance d'un cran de plus) à choisir objet par objet (`towerRewards`, `claimTowerReward`).
  **Panoplies visées** (2026-10-02, carte « 🎯 » de l'onglet de la Tour, `GameState.towerSets`, `toggleTowerSet`) :
  1 à 3 parmi les 20 (`towerFocusChoices` ; exactement 3 avant le 2026-10-07) → chaque Chromatique de la Tour, en combat
  comme hors ligne, ne tombe plus que dans leurs 3 à 9 objets au lieu de 60 (`towerDropPool`). Aucune = tirage sur les
  20. 1 panoplie = les 3 objets d'un seul Pokémon : ~1 cran de plus par nuit sur eux, rien pour les 2 autres (pas de
  contrepartie, le choix se compense de lui-même). Toucher une panoplie ouvre sa
  fiche (`SetInfoModal` : 3 objets avec leur stat principale, bonus 2 et 3 pièces, chiffrés pour un Chromatique au
  niveau du record via `towerPreviewItem`, figés à l'ouverture) d'où on la vise ou la retire. Sous les puces, les bonus
  des panoplies visées sans valeur (`setBonusLabel`) ; la carte (`TowerFocusCard`, mémorisée) ne lit que la sélection
  et ne se redessine pas à chaque étage. Pas de simulation (le bot ne joue pas la Tour).
  **Entraînement hors ligne** (`towerIdle`, activé par défaut, interrupteur dans l'onglet de la Tour) : dès un étage
  franchi, l'absence se passe dans la Tour au lieu de farmer la zone, en deux modes (`towerIdleClimb`, puces de la carte
  « 🌙 Hors ligne ») : **🧗 Grimper** (défaut, 2026-10-07 : Arno ne joue qu'hors ligne et son record ne bougeait jamais)
  part du dernier palier de 10 sous le record (`towerClimbStart`) et grimpe sans plafond ; un étage gagné au-delà du
  record le fait monter, et chaque palier de 10 ainsi franchi donne son coffre (`towerChest`, partagé avec le jeu
  actif), encaissé au retour (`IdleGains.tower` : `prevBest`, `best`, `rewards` ; résumé « 🏆 Nouveau record » et
  « 🎁 coffres à choisir ») ; **📌 Étage fixe** rejoue `towerIdleFloor` (dernier palier ou `towerIdlePick`, jamais
  au-delà du record). Une défaite fait redescendre d'un étage, 10 au plus sous le plus haut étage atteint : 1 Chromatique Nv.100 + étage, au cran
  `towerDropPlus` de l'étage, tous les `TOWER_IDLE_ITEM_EVERY` (5 depuis le 2026-10-07, 10 avant) étages gagnés, mêmes
  éclats qu'en combat (÷ 2 avant), ni XP, ni chromatiques, ni captures, ni coffre (`towerIdleGains` dans `idle.ts`).
  Mesuré avant le passage à 5 : 230 à 390 Chromatiques par nuit de 8 h (donc ~460 à 780 maintenant ; ~200 Ko de
  sauvegarde par nuit si on ne fusionne pas).
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
  **Valeurs des sous-stats** (`SUB_WORTH`, recalées le 2026-10-02 par l'équipe qu'on obtient vraiment,
  `tools/scratch/tower_meta.ts policy` : mêmes drops de Tour fusionnés avec chaque jeu de valeurs, équipe équipée par
  « ★ Auto », étage tenu à 50 %) : PV = Dégâts du type = Vitesse = Attaque = 10, Défense 7, D.crit 5, Critique 3,
  Recharge 3. Rendement décroissant : un classement strict fait garder les 3 mêmes sous-stats partout, qui saturent
  (PV/Vitesse/Attaque d'avant, ou Type/PV/Défense : 1 à 4 étages de moins) ; 4 valeurs égales font garder les meilleurs
  jets parmi elles, donc un mélange (+2 étages). Valeurs voisines (±2) : même résultat à 1 étage près. La vraie valeur
  d'un jet dépend du rôle (PV ~7 points pour le Pokémon de devant, ~1 pour les autres, `tower_meta.ts subs`) et de
  l'équipement (Critique quasi nul dans une panoplie Critique, énorme dans une panoplie Attaque) : pour un Pokémon
  précis, les flèches ▲▼ du sélecteur font foi. Couleurs (`SUB_TIER`) : vert PV, Type, Vitesse, Attaque ; jaune
  Défense ; gris le reste. Servent
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
- **« Besoin d'XP »** (filtre de la Boîte et de la fenêtre « Poster » de la Pension, `needsXp` dans `collection.ts`, refait
  le 2026-10-02) : suit l'objectif de collection, et ne propose **que le nombre nécessaire**.
  Boîte / Boîte + ✨ (`boxPlan`) : par espèce et par version, autant d'exemplaires que le besoin de ses évolutions
  (2 Bulbizarre pour Herbizarre ET Florizarre) ; celui qui reste = le meilleur en gènes parmi ceux qui ne gagnent pas
  d'XP ; la matière (`matterOrder`) = ceux déjà au niveau d'abord, puis ceux qui gagnent de l'XP (équipe, pension :
  `gainsXp`), puis les meilleurs en gènes, jamais un verrouillé qu'on n'a pas posté soi-même. Un seul calcul pour le
  filtre (matière sous le niveau), « Compléter la boîte » (matière au niveau, en pension et en exploration comprises,
  jamais l'équipe) et « Nettoyer les doublons » (`boxExcess` garde celui qui reste + la matière). Bug corrigé : un
  Pokémon mis en pension devenait « celui qui reste » et le filtre en proposait un autre à sa place (3 en pension pour 2
  utiles, ceux en pension absents du filtre, « Compléter » ignorait la pension).
  Aucune / Pokédex (`dexArrivals`) : 1 exemplaire par lignée simple (un Bulbizarre enregistre Herbizarre puis Florizarre),
  1 par branche (Évoli), moins ce qu'on possède déjà plus bas dans la lignée ; avant, tous les exemplaires (15 Bulbizarre).
  Boîte, filtre actif : l'équipe apparaît aussi (⚔), ceux à placer d'abord, puis pension 🏡, puis équipe ; ligne de
  résumé « Pour la boîte + ✨ : N à faire monter · x en équipe · y en pension · z à placer » (l'exploration compte « à
  placer » : elle ne donne pas d'XP).
- **Verrou 🔒** (`Mon.locked`, `toggleLock`) : un verrouillé n'est jamais relâché (`release` refuse), ni nettoyé
  (doublons, 3★+, chromatiques), ni utilisé par `completeDex`. Posé d'office sur tout 4★ (`addMon`, méga bonbon qui rend
  parfait, et 4★ des anciennes sauvegardes via `migrateSave` quand `locked` est absent). Cadenas à côté du nom dans la fiche,
  🔒 en bas à gauche de la vignette dans la boîte (🎯 en bas à droite, ✨ en haut à droite, numéro de Pokédex en petit en
  haut à gauche de la case depuis le 2026-10-02).
- **Pension** (XP passive, 50 % de l'XP/h de l'équipe (`PENSION_XP_SHARE`), taux rafraîchi à chaque récolte) et **Exploration**
  (`SHARDS_PER_MIN` = 3 éclats/min par Pokémon) : plafond 12 h (`PENSION_CAP_MS`, 8 h avant le 2026-10-07), un Pokémon ne peut être que dans l'une des deux.
  Retirer un Pokémon (bouton, mise en équipe via `setTeam`) encaisse d'abord son XP / ses éclats (`removePension`,
  `removeExploration`, 2026-10-01 : avant, tout était perdu).
- **Hors ligne** (`idle.ts`) : plafond 12 h (`IDLE_CAP_MS` = `PENSION_CAP_MS`, 8 h avant le 2026-10-07, sans réduction
  de rendement ; la réserve des bonus de la Boutique reste à 8 h), calcul par échantillon réel de combats, gains encaissés tout de
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
- **Mode veille** (bouton 🔋 du HUD, `useUi.sleep`, `SleepScreen.tsx`, 2026-10-07, économie de batterie) : `App.tsx`
  démonte tout l'écran de jeu (combat Skia, onglets, pastilles) et affiche un écran noir ; une minuterie fait avancer le
  combat 4 fois par seconde (par tranches de 100 ms, `runner.update`), sans rien dessiner ; sons, musique et messages
  coupés (`toast` ignoré) ; luminosité de l'appli au minimum (`expo-brightness`, module natif : nouvel APK, rétablie au
  réveil par `restoreSystemBrightnessAsync`) ; écran gardé allumé (`useKeepAwake`, sinon Android met l'appli en pause) ;
  une ligne gris sombre (étage et record, ou zone et étape) déplacée chaque minute ; réveil en faisant glisser le
  curseur jusqu'au bout (`WakeSlider`). Ce qui consomme en jeu : l'écran et le dessin (30 images/s React + Skia,
  halos), pas les calculs du combat (< 0,1 % du processeur).
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
  Fenêtre d'une zone (`ZoneDex`) : Pokédex, Chromatiques, puis **Boîte** (2026-10-02) : chaque espèce de la zone dont il
  faut encore des exemplaires (« Évoli · 2 en boîte · encore 6 à capturer », `collectionNeeds`) et les formes de sa
  lignée absentes de la boîte (`missingForms`) ; « Boîte ✨ » en plus avec l'objectif Boîte + ✨.
- **Pokédex** : n'affiche que les espèces ≤ `dexMax` de la région ; toucher une espèce vue ouvre « où la trouver »
  (`whereToFind`, y compris la route par évolution). 📦 en haut à gauche du sprite (2026-10-02) : espèce possédée dans la
  version de l'onglet (boîte, équipe, pension ou exploration) ; filtre « 📦 Absents de la boîte » : capturées au Pokédex
  de l'onglet mais possédées nulle part.

## Règles de travail
- Toute modif de règle de jeu = test Jest dans `src/game/__tests__/`, puis tests rapides + `npm run typecheck`.
  Toute modif de `battle.ts`, des courbes de difficulté, des pools ou du bot demande aussi la simulation longue
  (`balance.test.ts`, jamais de « changement mineur » sans vérifier : l'attaque de base typée avait cassé le début de partie).
- Garder le moteur indépendant de React et déterministe.
- Ne commiter/pousser que sur demande d'Arno. `CODEMAP.md` est dans `.gitignore` et ne doit **jamais** être poussé.
- Les messages personnels d'Arno dans l'UI (écran de départ, crédits du HUD) sont de lui : ne pas les retoucher.
- Simulations : lentes (~10 min pour une région). Arno préfère tester en vrai ; ne pas en relancer sans nécessité.
