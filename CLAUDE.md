@AGENTS.md

# PokéLoot — contexte projet

RPG mobile à **combats automatiques** façon Lootborn Warriors avec les 151 Pokémon de la 1re génération.
Le joueur ne pilote pas les combats : il joue la **préparation** (capture, équipe de 3, objets, fusion,
talents, ordre des capacités, lancement des boss, pension).
Expo SDK 57 / React Native 0.86 / React 19 / TypeScript, Hermes, New Architecture.
Projet perso non commercial (sprites PMD SpriteCollab CC BY-NC → pas de Play Store, APK perso).
**Tout en français** (UI, commentaires, commits). Dev sous **Windows + PowerShell 5** : pas de `&&`,
une commande par ligne. Arno veut des propositions arrêtées et structurées, pas une liste d'options ouvertes.

État : **V1 jouable et testée par Arno** (biome 1 complet). **Les 10 biomes du plan sont codés et
testés (Jest)** (voir `BIOMES.md`) : les 151 espèces sont toutes couvertes, courbe de niveau Nv.3→100.
**Simulation d'équilibrage bout en bout ajoutée** (`balance.test.ts`) : un joueur efficace termine les
10 biomes en 3h30-6h50 de combat simulé, sans blocage — biomes 6-8 anormalement rapides (~3 min
chacun), à surveiller au test manuel (voir `BIOMES.md`). Biomes 2-10 pas encore validés en jeu par
Arno (haut niveau requis). Boss légendaires (biomes 9-10, `joinsPool: true` sur `ZoneDef.boss`) :
une fois vaincus (capture garantie, jamais chromatique au combat de boss lui-même), ils rejoignent le
pool de sauvages de leur zone (`effectivePool` dans `game.ts`, poids 6 = rare) et deviennent farmables/
chromatisables comme n'importe quel sauvage. Le jeu s'appelle **PokéLoot** depuis le 2026-09-21.
8 améliorations codées le 2026-09-21 (voir `AMELIORATIONS.md`) : perf sac, nettoyage doublons boîte,
tri par type, étoiles de qualité génétique, options de capture auto, pension repensée en XP + nouvel
onglet Exploration. Voir `BIOMES.md` pour le plan des biomes suivants.

**Gen 2 (Johto) en chantier, 2026-09-22** : `species.json`/`moves.json` étendus à 251 espèces
(`tools/gen_data_gen2.py`, les 151 Kanto jamais réécrites), sprites 152-251 récupérés, types
Acier/Ténèbres opérationnels. 10 biomes Johto codés dans `content.ts` (premier jet, niveaux d'arène
approximatifs, pas encore de panoplies dédiées — repli sur le catalogue Kanto dans `rollLoot`).
**Prestige** (`canPrestige`/`startPrestige` dans `game.ts`) : une fois le Champion Kanto battu, une
bannière dans la Carte propose un « nouveau départ » Johto — équipe/boîte/objets/badges repartent à
zéro, nouveau starter (`STARTERS2`), Pokédex/bonbons/zones Kanto conservés (farmables à un niveau
pertinent via `lootLevel`). Palier 6-9 des talents (Spécialité II, saveur du type secondaire, Fureur,
Précision mortelle) et 10 panoplies par biome codés le même jour (Option C : rareté plafonnée en fin de
partie). Reste à faire : panoplies Johto, `wildMult` de base sur les zones Johto, test manuel Arno.

## Commandes
```
npm install
npx expo start          # Expo Go / dev client
npm test                # Jest (76 tests, dont simulation d'équilibrage bout en bout, ~20 s)
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
  PokéAPI (capacités Rouge/Bleu, noms FR ; type Fée retiré ; Atq = max(Atq, Atq Spé), Déf = moyenne ;
  recharge = `clamp(2,12,(puissance−20)/10)` +3 s si zone). Retoucher un JSON à la main est écrasé si on
  relance le script. **Acier et Ténèbres sont dans le moteur** (`PType`, table des types, 4 tables de
  talents `SPECIALTY`/`SPECIALTY2`/`AURA`/`TYPE_COLOR`) en préparation d'une Gen 2 future, mais aucune des
  151 espèces actuelles ne les porte (inexistants avant la Gen 2 dans les jeux d'origine).
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
- Niveau des sauvages : niveau de l'étape ou −1 ; `WILD_MALUS` PV/Atq ×0,85. Zones où la simulation
  d'équilibrage montre que le joueur roule sur le contenu sans jamais perdre (`ZoneDef.wildMult`,
  biomes 3/4/6/7/8/9) : remplace `WILD_MALUS` par un multiplicateur propre à la zone (1 à 2,6 selon
  combien de retard le joueur y a habituellement pris), calé empiriquement via `bot.ts`/`simulate()`
  plutôt que recalculer toute la courbe de niveau.
- Capture : après une vague gagnée d'étape normale, 35 % d'offre (`CAPTURE_OFFER_CHANCE`) ; chromatique
  (1/256) toujours proposé et garanti ; boss vaincu capturé d'office. Taux : Poké 30 %, Super 55 %,
  Hyper 80 %, ×0,5 pour une espèce rare de la zone. L'offre expire après la vague suivante. Niveau du
  capturé plafonné au meilleur Pokémon de l'équipe (`captureLevel`/`teamMaxLevel`, jamais en dessous de 2).
- Butin : 11 %/sauvage (`LOOT_CHANCE`), boss 3 objets. Niveau du butin = `max(niveau de l'ennemi, meilleur
  Pokémon de l'équipe)` (`waveRewards`/`sampleWaves`) — jamais en dessous du niveau de l'équipe, pour que
  farmer un ancien biome (chromatique, gènes parfaits) reste pertinent. Recyclage = `recycleValue()` en éclats.
- Hors ligne (`src/game/idle.ts`) : farm auto de l'étape 1 de la zone en cours pendant l'absence (plafond
  8 h, `IDLE_CAP_MS`), même règles d'XP/butin qu'en jouant, sans offre de capture sauf chromatique
  (capturé d'office, niveau plafonné). Calcul par échantillon réel (`computeIdleGains`, pur, ne modifie
  pas l'état) puis encaissement déterministe (`applyIdleGains`). Déclenché au lancement et au retour au
  premier plan si absence ≥ 1 min ; combat affiché en pause le temps du calcul, résumé affiché avant
  d'encaisser (`IdleSummary.tsx`).
- Qualité génétique : gènes (PV/Atq/Déf/Vit, 0-15 chacun) tirés une fois à la capture, jamais modifiés
  ensuite — plafond réel du Pokémon même si le PC affiché grimpe avec niveau/objets/talents/badges.
  Étoiles (`monStars` dans `stats.ts`) : 4★ gènes parfaits (15/15/15/15), 3★ ≥80 %, 2★ ≥50 %, 1★ en dessous.
  Plancher garanti par badge (`genesMinForBadges` dans `game.ts`, appliqué à toute capture — sauvage,
  boss, chromatique idle) : dès 4 badges, gènes ≥8/15 chacun (2★ minimum garanti, 3-4★ toujours possibles
  par chance) ; dès 8 badges, gènes ≥12/15 chacun (3★ minimum garanti). `s.badges` ne redescend jamais,
  même en repartant farmer un biome antérieur — objectif rejouabilité/complétion (tout en 4★+chromatique).
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

---

## À faire — prochaine session (après le gros chantier Gen 2/prestige du 2026-09-22)

Énorme volume de code ajouté en une seule session (251 espèces, 10 biomes Johto, mécanisme de prestige,
20 panoplies, talents paliers 6-9, Option C, wildMult) sans la relecture approfondie habituelle au fil
de l'eau — seulement une passe ciblée juste avant le build EAS (qui a déjà trouvé et corrigé un bug
bloquant : `startPrestige` ne débloquait pas `unlocked[10][0]`, voir commit `4b0bad5`). **Prochaine
session : pousser une relecture plus complète** de tout ce chantier, en particulier :
- Le flux complet prestige (`canPrestige`/`startPrestige` dans `game.ts`, `runner.ts`, `App.tsx`,
  `PrestigeOffer.tsx`) — un seul bug y a déjà été trouvé après coup, il peut y en avoir d'autres du même
  genre (état qui se resynchronise tout seul en marche normale mais incohérent à un instant T).
  Note utile pour l'analyse : **le `runner` ne consulte jamais `unlocked`** pour savoir s'il a le droit
  de lancer un combat (contrairement à `selectStage`/la Carte, qui eux le font) — toute future
  téléportation directe de `s.biome/zone/stage` (hors `selectStage`) doit explicitement débloquer la
  zone visée, sinon la Carte affiche un état verrouillé incohérent avec le combat réellement en cours.
- Le contenu Johto (`content.ts` biomes 10-19) : niveaux d'équipe d'arène approximatifs (jamais vérifiés
  contre une source, contrairement à la table des types Acier/Ténèbres qui elle l'a été), `wildMult` de
  base pas encore posé (zones Johto au malus standard Kanto).
- `balance.test.ts` : le test bout-en-bout ne couvre que Kanto ; Johto reste bloquant au-delà de 10h de
  simulation sur certaines graines (premier jet non équilibré) — à réintégrer une fois réglé.

---

## Fait — retours de test d'Arno (et de sa femme) du 2026-09-23

11 retours d'ergonomie après une soirée de test (APK partagé), tous codés et testés (100 tests Jest OK,
y compris la simulation d'équilibrage bout en bout) :

1. **Vitesse ×2** : le message « débloquée » ne s'affiche plus qu'au tout premier badge (`s.badges === 1`
   dans `runner.ts`), et la vitesse s'active désormais d'office à ce moment-là (au lieu de laisser un
   bouton caché dans le HUD à découvrir).
2. **Popup de capture** (`CaptureBar`) déplacée en overlay `position: absolute` sur la zone de combat
   (`BattleView.tsx`, plus dans `HudBottom`) : n'affecte plus jamais la mise en page du Sac/de la Boîte
   quand elle apparaît/disparaît.
3. **Nettoyage des doublons** (`excessMons`/`releaseExcess` dans `game.ts`) repensé : garde le strict
   minimum (1 exemplaire par espèce, normal/chromatique à part) au lieu de `remainingEvolutions + 1`, qui
   gardait plusieurs exemplaires non évolués même quand les formes évoluées existaient déjà séparément en
   boîte. Protège désormais aussi les Pokémon postés en pension/exploration (jamais relâchés par ce bouton).
4. **`unequipBox`** (nouveau) : bouton « Déséquiper la boîte » dans `TeamPanel` — retire tous les objets
   des Pokémon hors équipe pour reconsolider l'équipement dans le sac.
5. **Farm hors ligne intelligent** (`idleFarmTarget` dans `game.ts`, branché dans `idle.ts`) : si la zone
   en cours est intégralement farmée (boss vaincu, tous les sauvages vus en normal ET chromatique) et que
   la zone suivante est déjà débloquée, l'idle simule et récolte sur cette zone suivante à la place — et
   la position affichée (`s.biome`/`s.zone`/`s.stage`) suit au retour. Ne touche jamais une zone non
   débloquée ; le combat au premier plan n'est pas concerné (page hors ligne uniquement).
6. **Filtre par étoiles** (Tous/2★+/3★+/4★+) sur la liste des Pokémon postables en pension (`PensionPanel`).
7. **`releaseBelowStars`/`releaseNotShiny`** (nouveau) : boutons « Ne garder que 3★+ » et « Ne garder que
   les chromatiques » dans `TeamPanel`, mêmes garde-fous que le nettoyage des doublons (jamais l'équipe/
   pension/exploration).
8. **Achat de Balls en maintenant le bouton** (`BuyBallButton` dans `BagPanel`, `Button.tsx` étendu avec
   `onLongPress`/`onPressOut`/`delayLongPress`) : un tap achète 1 Ball, un appui long en achète en rafale
   (utile en fin de partie avec des milliers d'éclats).
9. **Bug panoplie starter Johto corrigé** : `chooseStarter` équipait toujours la panoplie Sylvestre
   (biome 0, Kanto) même au « nouveau départ » Johto. Équipe désormais la panoplie du premier biome de la
   région courante (`REGION_START[s.prestige]` → `SETS[...].biome` correspondant), Kanto comme Johto —
   et scalable pour une future Gen 3 sans y retoucher.
10. **`completeDex`** (nouveau) : bouton « Compléter le Pokédex » dans `TeamPanel` — fait évoluer le
    strict minimum de doublons de la boîte pour combler les lignées manquantes (normal et chromatique
    traités séparément), en garantissant toujours qu'1 exemplaire de chaque étage déjà possédé (équipe/
    pension/exploration/boîte) reste intact ; ne consomme que les exemplaires réellement en trop.

---

## Fait — suite du 2026-09-23 (réordonnancement équipe, exploration repensée, aura, réglage chromatique)

- **Réordonnancement de l'équipe** (`TeamPanel`) : flèches ▲▼ sur chaque carte, échange la position avec
  le voisin via `setTeam` (déjà existant). Le 1er de la liste est bien celui que les sauvages ciblent en
  priorité (70 % du temps, `battle.ts:pickTarget`) — texte du panneau reformulé en conséquence.
- **Bug corrigé (`BattleView.tsx`)** : `Cannot read property 'battle' of null`, race condition
  préexistante (pas liée aux changements du jour) entre le chargement asynchrone du sprite (`useImage`
  Skia) et la fin de combat — `FighterDraw` accédait à `runner.run!` sans vérifier qu'il n'était pas
  redevenu `null` entretemps. Guard ajouté (`if (!anim || !run) return null;`), même pattern que la
  vérification `anim` déjà en place.
- **Boutons de la boîte réunis sur une ligne à défilement horizontal** (`ScrollView horizontal`, comme
  les onglets de biomes de la Carte), dans l'ordre : Compléter le Pokédex, Nettoyer les doublons,
  Déséquiper la boîte, Ne garder que 3★+, Ne garder que les chromatiques.
- **Exploration repensée** : Arno ne l'utilisait pas (récompenses peu lisibles/attractives — Verger/
  Entraînement/Fouille avaient des taux fixes indépendants du niveau du Pokémon posté, seul Verger avait
  un bonus de type). Remplacé par un mécanisme unique, focalisé sur le vrai manque en début de partie :
  **`SHARDS_PER_MIN = 3` éclats/minute par Pokémon posté** (donc 9/min avec 3 postes, une Poké Ball
  ~toutes les 2 min), plafond 8 h inchangé. `JOBS`/`Job` supprimés de `game.ts` ; `GameState.exploration`
  n'a plus de champ `job` (les anciennes sauvegardes convergent simplement vers le nouveau taux, sans
  migration nécessaire — le champ `job` résiduel est juste ignoré). Panneau simplifié sur le modèle de la
  Pension (un seul bouton « + Poster un Pokémon »).
- **Mécanique d'aura clarifiée** : elle ne servait qu'à l'Exploration côté affichage, alors qu'elle
  s'applique en combat à **toute l'équipe active**, pas juste au porteur — valeur pleine (`AURA[type].value`)
  pour un membre de l'équipe, moitié pour un Pokémon posté en pension/exploration (`auraBonuses` dans
  `stats.ts`, cumulée entre tous, appliquée à chaque combattant via `allyFighter`). Désormais affichée
  aussi sur chaque carte de `TeamPanel` (valeur pleine, puisqu'en équipe).
- **Réglage `skipOwnedShiny`** (`store/settings.ts`, off par défaut) : « Ne pas capturer un chromatique
  déjà obtenu » — ignore la capture garantie d'un chromatique dont l'espèce est déjà dans `dex.shiny`, en
  combat (`runner.ts`) comme hors ligne (`idle.ts`, nouvel opt `skipOwnedShiny` de `computeIdleGains`).

**Reste ouvert** : `src/ui/CrashScreen.tsx` a toujours un diff local non commité (« TamaPoké » → « Pokerpg »
dans le message de crash) — jamais écrit par Claude, signalé à Arno à plusieurs reprises, toujours pas
résolu ni intentionnellement écarté.
