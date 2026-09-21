@AGENTS.md

# Pokémon Lootborn — contexte projet

RPG mobile à **combats automatiques** façon Lootborn Warriors avec les 151 Pokémon de la 1re génération.
Le joueur ne pilote pas les combats : il joue la **préparation** (capture, équipe de 3, objets, fusion,
talents, ordre des capacités, lancement des boss, pension).
Expo SDK 57 / React Native 0.86 / React 19 / TypeScript, Hermes, New Architecture.
Projet perso non commercial (sprites PMD SpriteCollab CC BY-NC → pas de Play Store, APK perso).
**Tout en français** (UI, commentaires, commits). Dev sous **Windows + PowerShell 5** : pas de `&&`,
une commande par ligne. Arno veut des propositions arrêtées et structurées, pas une liste d'options ouvertes.

État : **V1 jouable et testée par Arno** (biome 1 complet, biome 2 « Biome Aquatique » et biome 3
« Biome Électrique » codés et testés, pas encore validés en jeu par Arno).
8 améliorations codées le 2026-09-21 (voir `AMELIORATIONS.md`) : perf sac, nettoyage doublons boîte,
tri par type, étoiles de qualité génétique, options de capture auto, pension repensée en XP + nouvel
onglet Exploration. Reste le test manuel Expo Go par Arno. Voir `BIOMES.md` pour le plan des biomes
suivants.

## Commandes
```
npm install
npx expo start          # Expo Go / dev client
npm test                # Jest (25 tests, dont simulation d'équilibrage complète)
npm run typecheck       # tsc --noEmit
npx expo prebuild       # puis build APK Android
```
Modules natifs : toujours `npx expo install <pkg>`. Skia 2.6.2 (épinglé) **exige**
`react-native-reanimated` 4.5.1 + `react-native-worklets` 0.10.1 (sinon crash au lancement).

## Architecture
- `src/game/` : **moteur pur TS, sans React, testé**. Toute règle de jeu vit ici.
  - `battle.ts` : classe `Battle`, combat temps réel à recharges, déterministe (Rng injecté).
    `step(dt)` par pas de 50 ms, `drain()` renvoie les événements pour l'UI, `runToEnd()` pour les tests.
    PV ×4 en combat (`HP_SCALE`), `MAX_BATTLE_TIME` 120 s = défaite.
    Choix d'action : première capacité prête et utile dans l'ordre du Pokémon, sinon attaque de base.
    Dégâts : `((0.4·niv+2)·puissance·atq/déf)/50+2` × STAB 1.5 × type × crit × bonus × 0.85–1.
  - `game.ts` : `GameState` sérialisable + toutes les actions (équipe, objets, fusion, talents, évolution,
    pension, boutique, capture). `StageRun` = une étape (3 vagues) ; `finishWave()` → `waveRewards()`
    (XP, butin, offre de capture) ; `onStageWon` avance automatiquement d'étape ; `onStageLost` recule.
  - `content.ts` : `BIOMES: BiomeDef[]` — plan complet dans `BIOMES.md` (10 biomes prévus, un par badge
    + Route Victoire + Ligue, courbe de niveau calculée, répartition des 151 par type dominant).
    Biome 1 « Forêt de Jade » (Nv 3–18) : Lisière/Sous-bois/Clairière, arène de Pierre (Roche).
    Biome 2 « Biome Aquatique » (Nv 18–30) : Berges Claires/Récif Corallien/Fosse Profonde, arène
    d'Ondine (Eau). 5 étapes par zone, 3 vagues par étape, dans chaque biome.
  - `items.ts` (catalogue, 7 raretés, loot, fusion 3→1, amélioration, recyclage), `talents.ts`
    (arbre par type, 5 paliers — voir « Talents » ci-dessous), `stats.ts` (stats finales,
    `xpForLevel = 30·N²`), `data.ts` (accès typé aux JSON), `rng.ts`, `bot.ts` (joueur automatique pour
    la simulation d'équilibrage).
- `src/data/` : `species.json`, `moves.json`, `types.json` **générés** par `tools/gen_data.py` depuis les CSV
  PokéAPI (capacités Rouge/Bleu, noms FR ; types Acier/Ténèbres/Fée retirés ; Atq = max(Atq, Atq Spé),
  Déf = moyenne ; recharge = `clamp(2,12,(puissance−20)/10)` +3 s si zone). Retoucher un JSON à la main est
  écrasé si on relance le script.
- Sprites : atlas PMD par espèce (`assets/sprites/p025.png`, `ps025.png` chromatique), manifeste
  `src/data/sprites.json` + `spriteAssets.ts` (require statiques). Directions de combat `idleR/L`,
  `attackR/L`, `hurtR/L`. Pipeline `tools/fetch-sprites.ts`, miniatures `tools/make_thumbs.py`.
- UI : `App.tsx` ; `src/ui/battle/runner.ts` (singleton hors React qui pilote le combat affiché, avance la
  simulation au rythme de l'écran, gère offres de capture — auto-capture et filtre 3★ selon réglages —
  et bandeaux), `BattleView.tsx` (Skia), `Hud.tsx` (réglages : sons, vibrations, capture auto),
  `CaptureBar.tsx`, `panels/` (Équipe, Sac, Carte, Pension, Exploration, Pokédex), `MonSheet.tsx`
  (fiche Pokémon).
- État : zustand + AsyncStorage (`src/store/game.ts`, clé `pokelootborn/save/v1`, `act(fn)` modifie + sauve).
  `load()` fusionne la sauvegarde avec `newGame()` → un nouveau champ doit avoir une valeur par défaut
  dans `newGame()`.

## Règles actuelles utiles
- XP : chaque sauvage vaincu = 2 × son niveau (×5 boss), total de la vague partagé à parts égales
  entre les membres de l'équipe, puis pondéré par Pokémon via `xpGapMult(niveauDuPokémon,
  niveauMoyenEnnemis)` = `clamp(0.5, 2, 1 + 0.2 × écart)` (`waveRewards`).
- Niveau des sauvages : niveau de l'étape ou −1 ; `WILD_MALUS` PV/Atq ×0,85.
- Capture : après une vague gagnée d'étape normale, 35 % d'offre (`CAPTURE_OFFER_CHANCE`) ; chromatique
  (1/256) toujours proposé et garanti ; boss vaincu capturé d'office. Taux : Poké 30 %, Super 55 %,
  Hyper 80 %, ×0,5 pour une espèce rare de la zone. L'offre expire après la vague suivante. Niveau du
  capturé plafonné au meilleur Pokémon de l'équipe (`captureLevel`/`teamMaxLevel`, jamais en dessous de 2).
- Butin : 11 %/sauvage (`LOOT_CHANCE`), boss 3 objets. Recyclage = `recycleValue()` en éclats.
- Hors ligne (`src/game/idle.ts`) : farm auto de l'étape 1 de la zone en cours pendant l'absence (plafond
  8 h, `IDLE_CAP_MS`), même règles d'XP/butin qu'en jouant, sans offre de capture sauf chromatique
  (capturé d'office, niveau plafonné). Calcul par échantillon réel (`computeIdleGains`, pur, ne modifie
  pas l'état) puis encaissement déterministe (`applyIdleGains`). Déclenché au lancement et au retour au
  premier plan si absence ≥ 1 min ; combat affiché en pause le temps du calcul, résumé affiché avant
  d'encaisser (`IdleSummary.tsx`).
- Qualité génétique : gènes (PV/Atq/Déf/Vit, 0-15 chacun) tirés une fois à la capture, jamais modifiés
  ensuite — plafond réel du Pokémon même si le PC affiché grimpe avec niveau/objets/talents/badges.
  Étoiles (`monStars` dans `stats.ts`) : 4★ gènes parfaits (15/15/15/15), 3★ ≥80 %, 2★ ≥50 %, 1★ en dessous.
- Pension (XP passive, taux dynamique = 40 % de l'XP/h réelle de l'équipe actuelle — `teamXpPerHour`
  dans `idle.ts`, figé au moment où le Pokémon est posté —, plafond 8 h) vs Exploration (ex-pension : Verger/
  Entraînement/Fouille, ressources) : deux listes séparées dans `GameState`, un Pokémon ne peut être
  que dans l'une des deux (jamais l'équipe). Les deux donnent la moitié de leur aura à l'équipe.
- Options de capture (réglages, `Hud.tsx`) : capture auto des espèces manquantes (`autoCapture`,
  meilleure Ball ou la moins chère selon `autoCaptureBestBall`), et/ou ne pas proposer une espèce déjà
  possédée à 3★+ (`hideOwnedOffers`). Un chromatique est toujours capturé d'office (`guaranteed`),
  ces réglages ne s'appliquent qu'aux offres normales.
- Talents (`talents.ts`) : 1 arbre par type primaire, `talentPoints(level) = (level − 1) + (1 si Nv.100)`
  (100 points pile au Nv.100, plus de plafond à 30). 5 paliers (points dépensés requis 0/5/10/20/40) :
  paliers 1-3 = les 6 talents d'origine (Puissance, Vigueur, Garde, Réflexes, Spécialité par type,
  Maîtrise), rang max 5 chacun (`MAX_RANK`). Paliers 4-5 = `affinity1`/`affinity2`, talents « au choix » :
  le joueur sélectionne un type hors des siens mais présent dans le movepool complet de l'espèce
  (`eligibleAffinityTypes`), figé au 1er rang (`mon.talentTypeChoices`), rang max 15 (`AFFINITY_MAX_RANK`).
  Stockés à part dans `BattleBonuses.affinities` (tableau `{type, pct}`, `sumBonuses` les concatène plutôt
  que de les additionner) et appliqués dans `battle.ts` uniquement si le type de la capacité correspond.

## Règles de travail
- Toute modif de règle de jeu = test Jest dans `src/game/__tests__/`, puis `npm test` (la simulation
  d'équilibrage doit passer : badge en 30 min – 3 h de combat pur) et `npm run typecheck`.
- Garder le moteur (`src/game/`) indépendant de React et déterministe (toujours passer un `Rng`).

---

## Fait — lot Arno du 2026-09-21

Constat d'Arno en test : équipe Salamèche Nv.7, Roucool Nv.6, Aspicot Nv.6 à Sous-bois 5/5 face à des
Nv.8–9. Les captures arrivent Nv.8–9 → il a intérêt à jeter ses Pokémon pour les capturés. Défaut
d'équilibrage : l'avance automatique d'étape va plus vite que l'XP, et capturer rapporte plus de niveaux
que combattre.

1. **XP selon l'écart de niveau** — `xpGapMult` dans `game.ts`, appliquée par Pokémon dans `waveRewards`.
2. **Capture plafonnée** — `teamMaxLevel`/`captureLevel` dans `game.ts`, appliquée dans `tryCapture`
   (donc aussi à la capture garantie de boss) et affichée dans `CaptureBar`.
3. **Idle (gains hors ligne)** — `src/game/idle.ts` (`computeIdleGains` pur + `applyIdleGains`
   déterministe), `GameState.lastActive`, déclenchement au lancement/retour au premier plan dans
   `App.tsx`, résumé `src/ui/IdleSummary.tsx`. Chromatique croisé en idle capturé d'office (niveau
   plafonné), reste sans capture.
4. Tests dans `src/game/__tests__/{game,idle}.test.ts` (34 tests), `npm run typecheck` OK, simulation
   d'équilibrage (`balance.test.ts`) toujours dans la fourchette 30 min – 3 h sans retouche de `bot.ts`.

**Reste à faire par Arno** : test manuel dans Expo Go (jouer une vague, fermer l'app quelques minutes,
revenir, vérifier le résumé et le bouton Récupérer).
