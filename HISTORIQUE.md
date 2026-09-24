# Historique du projet (archive)

Journal des sessions passées, conservé tel quel pour mémoire : **ne pas s'y fier pour l'état courant** (des
chiffres et des règles y sont périmés). L'état à jour est dans `CLAUDE.md`, `REGIONS.md` et `BIOMES.md`.

---

# Archive 1 — anciennes sections de CLAUDE.md (2026-09-21 à 2026-09-24)

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

`src/ui/CrashScreen.tsx` (« TamaPoké » → « Pokeloot ») commité (`cb8a3a8`), plus de diff en suspens.

---

## Fait — suite du 2026-09-23 (2e partie : titres de boss, pools Johto enrichis, sprites géants, mode collectionneur)

- **Titres de boss supprimés** : `ZoneDef.boss` n'a plus de champ `title` (~60 entrées épurées dans
  `content.ts`) — l'UI affiche `species(boss.speciesId).name` directement (`runner.ts`, `Hud.tsx`), plus
  d'épithètes du genre « Coconfort blindé ».
- **4 biomes Johto enrichis à 6 espèces/zone minimum** (Tour Hantée, Phare d'Olivia, Tanière des Dragons,
  Grotte Sombre — chacun canoniquement limité à 4-6 espèces du type dominant en Gen 1-2) : complétés par
  des espèces **jamais utilisées ailleurs dans le jeu**, choisies pour leur cohérence thématique (Zarbi/
  Simularbre/Roigada pour la Tour ; Wattouat/Lainergie, pré-évolutions inédites du véritable gardien
  canon du phare d'Olivine, pour le Phare ; Aquali/Amonistar/Kabutops pour la Tanière ; Embrylex/Ymphect,
  pré-évolutions de Tyranocif déjà présent, pour la Grotte Sombre). Composition différente par zone d'un
  même biome pour varier les rencontres.
- **Sprites démesurés (Onix/Steelix/Lugia) qui poussaient leur barre de vie hors du cadre** : plutôt que
  de réduire leur taille (essayé puis abandonné, Arno préférait les garder immenses), la barre de vie et
  le label niveau sont désormais « clampés » à une position plancher (`HUD_MIN_TOP_BY_SLOT` dans
  `BattleView.tsx`, un plancher distinct par emplacement avant/arrière-haut/arrière-bas pour que deux
  géants côte à côte au même X ne se retrouvent jamais avec des barres superposées). Le sprite garde sa
  taille réelle, tête coupée par le cadre si besoin.
  Nouveau bouton debug (`__DEV__`) dans Réglages : « Onix/Steelix/Lugia en équipe (test sprites géants) ».
- **Bug corrigé + nouveau réglage sur `excessMons`/`releaseExcess` (nettoyage des doublons)** : la version
  « garde 1 seul exemplaire » codée plus tôt dans la journée ne réservait plus de matière pour les étages
  d'évolution manquants — repéré par Arno sur 14 Bulbizarre chromatiques (aucun Herbizarre/Florizarre
  chromatique) ramenés à 1 seul exemplaire au lieu de 3. Corrigé : garde 1 exemplaire par étage déjà
  possédé (équipe/pension/exploration/boîte, peu importe où) + 1 de réserve par étage **manquant** de la
  lignée — matière pour `completeDex` plus tard. Nouveau réglage `keepEvolutionMaterial`
  (`store/settings.ts`, **activé par défaut**) : off = « mode léger », ne garde plus que ce qui est déjà
  possédé sans réserve (pour un joueur qui se fiche de garder du stock d'évolution, ex. la copine d'Arno).
- **Pension : taux d'XP rafraîchi à chaque récolte** au lieu d'être figé pour toujours au moment du
  premier envoi (Arno devait retirer/reposter pour suivre la progression de l'équipe). `harvestPension(s,
  freshRate, now?)` prend maintenant le taux frais en paramètre (calculé par `PensionPanel` via
  `teamXpPerHour × PENSION_XP_SHARE`, même formule qu'au premier envoi) : la période déjà écoulée est
  comptée à l'ancien taux, le nouveau s'applique ensuite pour tous les postes.
- **Recherche par nom** dans le picker « Qui envoyer en pension ? » (`PensionPanel`), combinable avec le
  filtre par étoiles — préfixe uniquement (`startsWith`, pas `includes`) : « cara » trouve Carabaffe mais
  pas Scarabrute.

---

## Fait — suite du 2026-09-23 (3e partie : talents simplifiés, sous-stats, page Aide, équiper le meilleur, rééquilibrage objets)

- **Talents** : labels « Palier 1 », « Palier 2 (5 points) »… retirés de `MonSheet.tsx` (le verrouillage
  reste visible via le bouton grisé). Toutes les sous-stats de combat (pas seulement critique) sont
  vérifiées câblées dans `battle.ts`/`stats.ts` — aucune n'est décorative.
- **Sous-stats affichées** sur la fiche Pokémon : dégâts critiques (×1.5 de base + bonus) toujours
  visibles, et un tiroir dépliable « ▸ Sous-stats » liste tout ce qui est actif (dégâts de type, dégâts
  de zone, vol de vie, esquive, recharge, affinités…), masqué par défaut pour ne pas surcharger la fiche.
- **Page « Aide »** (`HelpScreen.tsx`, nouveau fichier), accessible depuis ⚙ Réglages : tableaux
  récapitulatifs des auras par type et des Spécialités I/II (paliers 3/6) par type, plus un rappel des
  talents communs à tous les types.
- **Sac (`BagPanel.tsx`) repensé par Arno** : la ligne « Ressources » et la ligne « Achat de Balls »
  fusionnées en une seule — les icônes de Ball sont devenues elles-mêmes les boutons d'achat (tap = +1,
  appui long = rafale), chacune en `flex: 1` pour occuper toute la largeur restante à côté du texte
  « X éclats » qui garde sa largeur minimale. Un texte « Clique sur les Balls pour acheter » au-dessus.
- **`autoEquipBest`** (nouveau, `game.ts`) : bouton « Équiper le meilleur » au-dessus des objets tenus
  dans `MonSheet.tsx`. Compare le total de la meilleure combinaison **indépendante** (meilleur objet
  libre par emplacement) à celui de **chaque panoplie complétable** avec les objets disponibles (bonus de
  panoplie inclus, converti sur la même échelle que `itemScore` via `STAT_WEIGHT`, nouvellement exporté
  depuis `items.ts`) — ne vole jamais un objet porté par un autre Pokémon, aucune règle spéciale liée au
  type du porteur (les panoplies n'ont jamais été réservées à un type). 3 tests dédiés dans
  `game.test.ts`, dont un qui vérifie qu'une panoplie complète l'emporte sur un mélange dépareillé grâce
  au bonus, avec de vraies valeurs du jeu (pas des chiffres inventés).
- **Rééquilibrage des objets offensifs/défensifs** (15 `TEMPLATES` sur 40, dans `items.ts`) : seuls
  `%Attaque` (offensif) et `%Déf`/`%PV` (défensif) progressaient vraiment avec le biome depuis le début ;
  `critPct`, `cdrPct`, `spePct`, `typeDmgPct` avaient une `base` quasi figée, recopiée sans être réajustée
  d'un biome à l'autre — au point qu'à rareté égale, un objet Critique de fin de partie valait pareil
  qu'un objet Critique de tout début de partie, alors qu'un objet Attaque avait presque doublé.
  Corrigé via une courbe de score cible par biome (dérivée d'`%Attaque`/`%Déf`+`%PV`, déjà bien calées),
  en recalculant `base = cible ÷ poids` pour les stats à la traîne. `critDmgPct` traité à part : le
  rattrapage à 100 % aurait fait grimper son plafond de ~22 % à ~45 % en Chromatique (trop risqué combiné
  aux talents crit) — seule la moitié de l'écart a été appliquée (~35 % de plafond). Le biome 11 (1er
  biome Johto, juste après un prestige — donc un vrai redémarrage, pas une continuation) a été calé
  **exactement** sur le biome 1 plutôt que sur la 11e marche d'une progression continue. Sous-stats
  (`SUB_BASE`) vérifiées déjà bien équilibrées (score 2.4–3.2 selon la stat) : aucun changement nécessaire.
  Simulation d'équilibrage complète relancée après coup (~8 min) : toujours dans la fourchette attendue.

---

## Fait — suite du 2026-09-23 (4e partie : temps de recharge réel affiché, attaque de base, aura bi-type)

- **Temps de recharge réel affiché** à côté de chaque capacité sur la fiche Pokémon (`MonSheet.tsx`) :
  `m.cd` seul n'était que la base, jamais ce qui se passe vraiment en combat une fois Vitesse et
  `cdrPct` appliqués. `cdFactor(spe, cdrPct)` exporté de `battle.ts` pour que l'UI puisse le recalculer
  hors combat (`(100/(100+Vitesse)) × (1 − min(40%, Recharge))` — la Vitesse à elle seule fait souvent
  l'essentiel de la réduction, pas juste le bonus « Recharge »).
- **Attaque de base (`basicAttack`)** : tentative de lui donner le type principal du Pokémon (au lieu de
  Normal fixe) pour corriger le cas où elle fait 0 dégâts contre un Spectre (Normal → Spectre = ×0) —
  **abandonnée après coup** : ça a cassé la simulation d'équilibrage dès le tout début de partie (même le
  1er badge n'était plus atteint sur certaines graines), parce que l'attaque de base est utilisée bien
  plus souvent qu'il n'y paraît en tout début de partie (peu de capacités encore apprises), et selon le
  matchup elle devenait parfois *pire* qu'avant (ex. starter Eau contre repaire Plante : ×0.5 au lieu de
  ×1 neutre). Solution retenue à la place : l'attaque de base (`m.id === 0`) est désormais **neutre par
  construction** dans `damage()` — jamais de STAB, jamais ×0/×2 via la table des types, quel que soit le
  Pokémon ou l'adversaire. Un vrai filet de sécurité qui ne peut plus totalement rater. Toujours vérifier
  la simulation longue après tout changement touchant `battle.ts`, même un changement qui semble mineur.
- **Aura bi-type** (`auraBonuses` dans `stats.ts`) : un Pokémon à deux types donnait avant sa pleine aura
  du seul type principal, le 2e type n'ayant jamais d'effet (retour d'Arno sur Roucoups Normal/Vol, qui
  ne donnait que PV +3 % sans jamais toucher à Vitesse). Donne désormais les deux auras, chacune divisée
  par 2 (même ordre de grandeur total qu'un mono-type) ; même règle en pension/exploration (déjà à moitié,
  la division bi-type s'applique en plus). Affichage (`auraDisplay` dans `ui/helpers.ts`) mis à jour dans
  `TeamPanel`/`ExplorationPanel` pour lister les deux auras. Trouvaille en passant : un seul Pokémon du
  jeu est Vol pur dans les données (Togetic) — vraisemblablement une erreur de génération, Togepi/Togetic
  sont Normal pur dans les vrais jeux Gen 2 (le Vol n'arrive qu'en Gen 6) ; non corrigé, hors périmètre.

---

## Règle de contenu — régions autonomes (Arno, 2026-09-24)

Chaque région (Johto, Hoenn, Sinnoh…) doit être **autonome** : après un prestige on ne revient pas sur les
régions précédentes, donc le Pokédex complet (jusqu'à `dexMax`) doit être obtenable dans les seuls biomes
de la région courante. Johto et Hoenn le respectent ; **Sinnoh devra le respecter aussi** (voir
`PLAN_GEN3_GEN4.md` et `ETAT_GEN3_GEN4.md`). Le test de couverture par région (`test.each(REGIONS)`)
est le garde-fou.

## Panoplies des régions Hoenn et suivantes (2026-09-24)

Pas de nouvelles panoplies : `BIOME_SET` (`items.ts`) associe chaque biome de Hoenn à la panoplie existante
du même thème, `setOfBiome(biome)` la donne à `rollLoot` et à `starterItems`. Un objet réutilisé ne garde
pas sa `base` d'origine : `biomeTier()` pose `Item.tier` pour que le 1er biome de la région vaille Kanto 1
et le dernier ≈ +60 % (`mainValue` multiplie par `tier`, la fusion le conserve). Pour Sinnoh : ajouter ses
biomes à `BIOME_SET`.

---

## Hoenn jouable et refonte de la difficulté (2026-09-24)

- **Hoenn (biomes 20-31)** codé, 12 biomes, Pokédex 1-386 autonome. `REGIONS` (`content.ts`) décrit chaque
  région (`name, start, starters, dexMax`), `regionOf(prestige)`, `regionLastBiome(prestige)`. Générateur :
  `npx tsx tools/gen_region.ts tools/regions/hoenn.json`. Le champion Glace de Johto s'appelle Frédo.
  Chefs de route : noms d'anciens champions. Sinnoh (32-46) pas encore codé.
- **Difficulté des sauvages = une seule courbe par région** (`DIFFICULTY`/`zoneWildMult` dans `game.ts`),
  plus aucun `wildMult` par zone : ×0,60 au départ de la région (Nv.5 après un prestige), jusqu'à ×1,6
  (Kanto) / ×1,9 (Johto) / ×2,2 (Hoenn) au dernier biome, exposant 1,2. Boss et arènes : PV ×5 / ×2
  multipliés par `bossRamp` (×0,5 → ×1,2 sur la région). `regionProgress` donne l'avancement (0-1).
- **Début de partie adouci** : `START_BALLS` = 25 (nouvelle partie et chaque prestige), Poké Ball à 50 %
  (`EARLY_POKE_CHANCE`) tant que l'équipe a moins de 3 Pokémon, pitié de capture (`CAPTURE_PITY` = 3
  échecs de suite → capture garantie, champ `missStreak`).
- **`completeDex`** suit le mode collectionneur (`keepEvolutionMaterial`) : décoché, un exemplaire unique
  peut évoluer si l'étage suivant manque dans le Pokédex.
- **Bot (`bot.ts`)** : `simulate(rng, secondes, trace, region)`. `region` > 0 démarre au 1er biome de la
  région (comme après un prestige). Comportement « humain » : change d'équipe après 2 défaites de boss,
  attend d'être à 4 niveaux du boss/de l'arène (45 min de farm max), range la boîte en pension/exploration,
  récolte et achète des Balls (`chores`). Un bot humain finit chaque région en ~3 h - 3 h 30 avec peu de
  défaites après le 1er biome : le joueur est fort en fin de région (équipement, talents, badges).
- **Simulation** (`balance.test.ts`) : Kanto, Johto et Hoenn. Scripts de mesure locaux dans `tools/scratch/`
  (non versionnés).
- **UI** : modale d'absence groupée (×N), talents et Balls en appui long, filtre par type dans la boîte
  (remplace le tri par type), bouton « Poster » en haut de Pension/Exploration.

## Évolutions à choix (2026-09-24)

`EVOLUTION_CHOICES` (`data.ts`) : 11 espèces peuvent évoluer en plusieurs formes (Évoli en 7, Ortide, Têtarte,
Ramoloss, Debugant, Chenipotte, Kirlia, Ningale, Stalgamin, Coquiperl, Cheniti), la 1re cible étant toujours
`evolvesTo` (utilisée par le bot, `completeDex`, `excessMons`). `evolutionTargets(id, dexMax)` filtre par
région en cours ; `evolve(s, uid, target?)` ; la fiche Pokémon affiche un bouton par forme. Les formes
alternatives ont été retirées de certaines zones sauvages seulement quand la zone garde ≥ 6 espèces et que
la forme de base existe dans la région (biomes 13, 14, 15, 18, 22, 29) ; les espèces « signature » d'un
biome (Voltali biome 2, Pyroli biome 6) restent sauvages. Le test de couverture tient compte des choix.

## Sinnoh jouable (2026-09-24)

4e région (`REGIONS[3]`, biomes 32-46, dexMax 493, starters 387/390/393) : 15 biomes, 8 champions (Pierrick,
Flo, Mélina, Lovis, Kiméra, Charles, Gladys, Tanguy), Conseil des 4 et Cynthia (équipe imposée). Généré par
`npx tsx tools/gen_region.ts tools/regions/sinnoh.json` (le générateur complète désormais les zones de moins
de 6 espèces par des formes évoluées, et tient compte de `EVOLUTION_CHOICES`). Les 14 légendaires de Sinnoh
sont des boss `joinsPool` sur les 5 derniers biomes, les 21 anciens sont semés très rares. Panoplies : mapping
`BIOME_SET` 32-46. Difficulté : `DIFFICULTY.end[3]` = 2,5. Simulation (3 graines) : 3 h 27 - 4 h, défaites
seulement dans le 1er biome. Les chefs des biomes de route (sans badge) reprennent des noms d'anciens champions (Blanche, Koga, Auguste,
Morty, Guirande à Sinnoh ; Barbara, Giovanni à Hoenn). Le prestige Hoenn → Sinnoh est débloqué par le Champion Hoenn + Pokédex complet /386.

## Hors ligne : chasse aux chromatiques à l'étape en cours (2026-09-24)

`idleShinyKills` (`idle.ts`) : pour les tirages de chromatiques uniquement, l'idle farme l'**étape en cours**
(pas la 1) et regrimpe après un K.O. (retour à l'étape 1, remontée jusqu'à l'étape débloquée), échantillon
réel par étape. XP et butin hors ligne restent calculés sur l'étape 1 comme avant (décision d'Arno : ne
pas les augmenter pour l'instant).

## Légendaires : poids 20 partout (2026-09-24)

Tous les légendaires ont un poids de 20 dans leur zone : `BOSS_POOL_WEIGHT` = 20 pour les boss `joinsPool` vaincus,
et les anciens légendaires semés dans les régions suivantes sont à 20 aussi (plus 3). Objectif d'Arno : chasser
tous les chromatiques en hors ligne en 5 h (Kanto), 9 h (Johto), 18 h (Hoenn), 40 h (Sinnoh) environ, calcul
`tools/scratch` : 256 ennemis ÷ probabilité, 3 ennemis/vague. Effet de bord : plus « rares » (poids ≥ 10),
donc capture normale à 30 % en Poké Ball.

## Starters répartis par type (2026-09-24)

Les starters ne sont plus tous dans la 1re zone du 1er biome : chaque starter est un sauvage (poids 10) dans un biome
de son type (Plante, Feu, Eau) de sa région, hors 1er biome et hors 3 derniers. Kanto : 3 ; Johto : 6 (Kanto +
Johto, pas ceux de Sinnoh) ; Hoenn : 9 ; Sinnoh : 12. Les 1res zones de Johto/Hoenn/Sinnoh ont été refaites à 6
espèces normales minimum (formes évoluées ou formes de base dupliquées de leur type). Script de la refonte :
`tools/scratch/spread_starters.py` (non versionné).


---

# Archive 2 — récap de session du 2026-09-21 (ex `recap.md`)

# Récap de session — 2026-09-21

Résumé de tout ce qui a été fait dans cette session, pour se remettre dans le bain rapidement la
prochaine fois. Voir aussi `CLAUDE.md` (état courant + règles), `BIOMES.md` (plan des biomes, décisions
d'équilibrage) et `AMELIORATIONS.md` (lot du matin, avant cette session).

## Contexte

Reprise du projet **PokéLoot** (ex « Pokémon Lootborn ») cloné depuis GitHub
(https://github.com/AzhaqCom/pokerpg), rendu public temporairement pour le clonage. Travail mené sur
une seule branche `main`, un commit par sujet, poussé au fur et à mesure.

## 1. Équilibrage du début de partie

- **Malus renforcé tant que l'équipe n'a pas ses 3 membres** (`SOLO_MALUS` dans `game.ts`) : sauvages à
  -32 % PV/Atq à 1 Pokémon, -23,5 % à 2, retour à la normale (-15 %) à 3 — un K.O. sans remplaçant
  faisait perdre l'étape.
- **Starter équipé au départ** : Lunettes Choix (atk%, choisi après calcul comparé à la Griffe Rasoir),
  Écharpe Vitalité (PV%, meilleur choix défensif que déf%/vitesse%), Baie Oran.

## 2. Audit des 151 espèces + plan des 10 biomes terminé

- **Bug Onix** trouvé par audit manuel : présent uniquement dans l'équipe d'arène du biome 1, jamais
  capturable (les combats d'arène n'offrent jamais de capture). Corrigé : ajouté en pool rare à
  Clairière.
- **Biomes 3 à 10 codés** (le plan `BIOMES.md` prévoyait 10 biomes, seul le 1 et le 2 existaient avant
  cette session) :
  - Biome 3 « Biome Électrique » (Major Bob) — + correctif de la courbe de niveau (arène montait à
    Nv.39 au lieu du Nv.35 documenté, découvert en préparant le biome 4).
  - Biome 4 « Biome Verdoyant » (Erika), Biome 5 « Marais Toxique » (Koga).
  - Biome 6 « Sanctuaire Psy » (Morgane), Biome 7 « Terres de Feu » (Auguste), Biome 8 « Plaines
    Rocheuses » (Giovanni) — les 8 badges de la ligue Kanto complets.
  - Biome 9 « Route Victoire », Biome 10 « Ligue Pokémon » — **mécanisme des boss légendaires
    rejouables** câblé (`ZoneDef.boss.repeatable`, prévu dans le type mais jamais utilisé) : Artikodin,
    Électhor, Sulfura, Mewtwo, Mew tirent leur chromatique comme un sauvage à chaque tentative,
    contrairement à un boss de zone classique (jamais chromatique).
  - **Bug Racaillou** trouvé par un test générique d'audit (même symptôme qu'Onix) : corrigé au passage.
  - Nouveaux décors de combat ajoutés au fil des biomes : `electric`, `swamp`, `temple`, `volcano`,
    `desert` (`ZoneDef.biome` + `SKIES` dans `BattleView.tsx`).
- **Résultat** : les 151 espèces sont toutes couvertes et farmables en chromatique, courbe de niveau
  Nv.3 → Nv.100 conforme au calcul de `BIOMES.md`.
- **Test générique** ajouté dans `game.test.ts` : vérifie pour chaque biome codé que l'arène finit pile
  au niveau documenté, que le biome suivant démarre pile où le précédent finit, et que les 151 espèces
  sont couvertes — garde-fou pour tout futur ajustement de contenu.

## 3. Simulation d'équilibrage bout en bout

`bot.ts`/`balance.test.ts` ne simulaient qu'un seul badge (biome 1) — étendu jusqu'au badge du
Champion (10 biomes). Résultat sondé sur 10 seeds : le jeu complet se termine toujours, entre 3h30 et
6h50 de combat simulé, sans blocage.

**Point noté, pas corrigé** (décision d'équilibrage à trancher avec Arno, pas un bug) : les biomes 6-8
se traversent en ~3-4 min chacun contre 77 min pour le biome 1 — en partie explicable par leurs paliers
de niveau volontairement courts dans la courbe calculée, mais l'écart reste marqué. À surveiller au
test manuel.

## 4. Options de recyclage

- Réglages → seuil de rareté choisi pour le recyclage groupé du Sac (remplace le seuil fixe « communs
  et peu communs »).
- Réglage séparé pour activer/désactiver le recyclage auto hors ligne, avec son propre seuil de rareté
  (indépendant de celui du Sac).
- `computeIdleGains` (idle.ts) prend des options `autoRecycle`/`recycleMaxRarity` ; comportement par
  défaut inchangé si absentes.

## 5. Rebranding : PokéLoot

- Nom changé partout où visible (écran starter, README, app.json, package.json) — package Android et
  clés de sauvegarde AsyncStorage laissés inchangés (aucun bénéfice à casser la compatibilité).
- Nouvelle icône (Poké Ball rouge/blanc, cœur doré, étincelles) : `icon.png` + les 3 couches de l'icône
  adaptative Android (foreground/background/monochrome) + favicon, générées par `tools/make_icon.js`
  (Node + `sharp`, remplace un script Python qui référençait un fichier inexistant).

## 6. Musique de fond

- Composition chiptune originale d'Arno (`assets/music/combat.wav`), synthétisée en onde carrée/pulse
  via `tools/gen_music.js` (Node, même technique que `tools/gen_sfx.py` mais sans dépendance Python).
- **Important** : on a refusé de reproduire une mélodie existante (le thème de combat de Pokémon
  Rouge/Bleu) même avec des notes changées — droit d'auteur. La composition finale est originale.
- `src/audio/music.ts` : lecture en boucle, réglage « Musique » indépendant de « Sons ».
- Bug corrigé : le lecteur tentait de jouer avant la fin du chargement asynchrone du fichier (attend
  maintenant `isLoaded`/`playbackStatusUpdate`).
- Bug corrigé : `playsInSilentMode` passé à `true` — l'app ne jouait aucun son en mode « Ne pas
  déranger » (bruitages compris), comme la plupart des jeux mobiles l'app doit s'entendre même en
  silencieux.

## 7. Corrections de bugs UI

- **Scroll cassé dans le menu Réglages** : un `Pressable` englobant toute la boîte captait le toucher
  dès le contact, empêchant la `ScrollView` de détecter un geste de défilement démarré sur du texte
  brut. Fond et boîte sont maintenant deux calques superposés indépendants au lieu d'un `Pressable`
  imbriqué dans un autre.
- **Équipe bloquée par des uid fantômes** : un Pokémon relâché/supprimé jamais retiré du tableau
  `team` (bug historique) faisait croire l'équipe pleine alors qu'elle affichait moins de 3 membres.
  `migrateSave` nettoie désormais les uid fantômes/doublons au chargement.
- **Échange d'équipe qui se redéclenchait sans jamais s'afficher** (présent depuis le tout premier
  commit) : `MonSheet` est une instance unique et persistante (pas remontée à chaque Pokémon ouvert) —
  le sélecteur « Qui remplacer ? » ne se refermait jamais après un échange réussi, restant armé en
  mémoire et se redéclenchant silencieusement au Pokémon suivant.
- **Objet déjà équipé sur un coéquipier, pas assez visible** : badge orange bien visible en haut de la
  carte objet (au lieu d'un texte gris minuscule) + confirmation obligatoire avant de transférer
  l'objet.

## 8. Outillage de test

Bouton **Debug** dans les Réglages (« +10 Pokémon dans la boîte »), protégé par `__DEV__` — absent des
builds de production (EAS), pour tester sans repasser par des heures de farm à chaque reset de
sauvegarde.

## 9. Plancher de qualité génétique par badge

Idée d'Arno : dès 4 badges, toute nouvelle capture (sauvage, boss, chromatique idle — partout dans le
jeu, même en repartant farmer un biome antérieur) garantit au moins 2★ (gènes ≥8/15 chacun) ; dès 8
badges, au moins 3★ (gènes ≥12/15 chacun). `s.badges` ne redescend jamais donc le palier est acquis
pour de bon. `genesMinForBadges` dans `game.ts`.

## État des tests

79 tests Jest (contre 25 en début de session), tous verts. `npm run typecheck` propre à chaque commit.

## Prochaine étape

Build APK en cours (`eas build -p android --profile preview`), lancé juste après ce récap. Reste après
ça : test manuel complet dans Expo Go / l'APK par Arno (tous les biomes n'ont été vérifiés que par les
tests automatisés, jamais joués en vrai à part le biome 1).


---

# Archive 3 — lot d'améliorations avant le biome 3 (ex `AMELIORATIONS.md`)

# Améliorations V1 — avant le biome 3

Document de conception, discuté avec Arno le 2026-09-21. **Les 8 points sont codés et testés**
(47 tests, `npm run typecheck` OK) — voir le détail de chacun ci-dessous pour ce qui a changé
concrètement. Reste le test manuel dans Expo Go par Arno.

## 1. Étoiles de qualité génétique (préalable aux points 3 et 8)

Les gènes d'un Pokémon (`mon.genes` : PV/Atq/Déf/Vit, 0 à 15 chacun) sont tirés **une seule fois à la
capture** (`makeMon`) et ne changent plus jamais — contrairement au PC affiché, qui lui grimpe avec le
niveau/objets/talents/badges mais reste plafonné par ces gènes. Deux Pokémon de même espèce et même
niveau peuvent donc avoir un potentiel définitivement différent.

Système d'étoiles (façon Pokémon GO) sur la qualité = somme des 4 gènes / 60 :
- **4★ (graal)** : gènes parfaits, 15/15/15/15 (qualité 100 %).
- **3★ (bon)** : qualité ≥ 80 %.
- **2★ (moyen)** : qualité ≥ 50 %.
- **1★ (faible)** : en dessous.

Affiché sur la fiche Pokémon et les cartes équipe/boîte (sinon la règle reste invisible). Sert de base
aux points 3 et 8 ci-dessous.

## 2. Boîte : nettoyage automatique des doublons

Bouton **« Nettoyer les doublons »** dans l'onglet Équipe.
- Garde = nombre d'évolutions restantes depuis l'espèce actuelle + 1 (Paras, 1 évolution restante →
  garde 2 ; Aspicot, 2 évolutions restantes → garde 3 ; forme finale → garde 1).
- Calcul **séparé pour chromatique et normal** de la même espèce (tes 7 Paras chromatiques et tes Paras
  normaux ont chacun leur propre quota).
- Dans chaque groupe, trie par PC croissant, garde les plus forts, relâche le reste.
- N'touche jamais à l'équipe active.
- Popup de confirmation avant validation (« X Pokémon relâchés, Y bonbons gagnés »), cohérent avec le
  reste de l'appli (`Dialog`).

## 3. Boîte : tri par type

Regroupe/trie la boîte par type principal (`primaryType()`, déjà utilisée pour talents/aura — même
règle pour les doubles types : seul le premier compte).

## 4. Perf : Sac et récupération idle

Bug de perf identifié : `fusionCandidates()` (et le calcul des objets recyclables `junk`) appellent
`holder()` — qui boucle sur **tous** les Pokémon — pour **chaque objet** du sac, recalculé à chaque
re-rendu. Avec beaucoup de Pokémon en boîte, ça devient coûteux (lag observé sur « Acheter Hyperball » et
sur « Récupérer » après idle). Correctif : calculer une seule fois l'ensemble des objets portés (un seul
passage sur les Pokémon), puis vérifier l'appartenance à cet ensemble au lieu de rechercher dans tous les
Pokémon à chaque objet.

## 5. Carte : exclure les boss de zone du Chromatique-Dex de zone

Un boss de zone classique n'est battu qu'une fois (`bossesBeaten`) et n'est jamais chromatique
(`makeMon(..., false, ...)`) — l'indiquer comme « chromatique manquant » dans la popup de zone est
trompeur puisqu'il n'est pas farmable. Retiré de `zoneSpecies()` (utilisée par la popup et les barres de
progression %). La plupart des boss restent de toute façon accessibles en chromatique via leur
pré-évolution capturable sauvage (ex. Coconfort via un Aspicot sauvage chromatique évolué).

Point technique pour les biomes 9-10 (BIOMES.md) : les 5 boss légendaires (oiseaux + Mewtwo + Mew) seront
**rejouables** pour le farm chromatique — on ajoute dès maintenant un champ `repeatable` (optionnel,
`false`/absent partout pour l'instant) sur la définition de boss, pour que ces futurs boss restent comptés
dans le Chromatique-Dex sans revenir sur cette règle plus tard.

## 6. Pension repensée : XP au lieu de ressources

La pension actuelle (3 métiers Verger/Entraînement/Fouille) n'était pas claire pour Arno, et ne remplit
pas le vrai besoin : monter en niveau des Pokémon hors équipe pour compléter le Pokédex par évolution.

- **Pension** devient mono-fonction : un Pokémon posté y gagne de l'XP passive, point — plus de choix de
  métier. Taux : même rythme que l'actuel « Entraînement » (~50 XP/h, au lieu d'un bonbon toutes les 2h),
  à ajuster après test. Plafond 8h d'accumulation et nombre de places (3 + badges) inchangés.
- **Verger/Entraînement/Fouille** déménagent tels quels vers un nouvel onglet **Exploration**, avec son
  propre système de créneaux (même mécanique de slots/récolte, juste détachée de la pension et renommée).
- Impact technique : `GameState.pension` scindé en deux listes → migration de save nécessaire, comme pour
  le biome 2 (`migrateSave`).

## 7. Option : capture automatique des Pokémon manquants

Deux réglages dans Options, le second visible seulement si le premier est actif :
- **« Capturer automatiquement les Pokémon manquants »** : quand une offre de capture apparaît en jeu
  actif (écran allumé, pas l'idle), et que le Pokémon proposé est manquant — `offer.shiny || !dex.caught`
  (un chromatique jamais obtenu compte comme manquant même si l'espèce normale est déjà possédée) — la
  capture se fait automatiquement, sans passer par la barre de capture.
- **« Toujours utiliser la meilleure Ball »** : si actif, choisit la Ball la plus forte en stock
  (Hyper > Super > Poké). Si inactif (comportement par défaut), choisit la **moins chère** en stock —
  comme un joueur qui économise ses bonnes Balls, avec le même risque d'échec.
- Aucune Ball en stock → pas d'auto-capture, l'offre normale s'affiche pour laisser la main au joueur.
- Comportement inchangé et assumé : une capture (auto ou manuelle) rejoint l'équipe si elle a moins de
  3 membres, comme aujourd'hui.

## 8. Option : ne pas proposer une capture déjà possédée en bonne qualité

Nouvelle option, indépendante du point 7 (peut s'activer même sans capture auto — elle filtre quelles
offres apparaissent, capture auto ou manuelle). Ne masque **pas** dès que l'espèce est simplement
possédée (un premier exemplaire faible ne doit pas fermer la porte à un meilleur), mais seulement si le
joueur possède déjà un exemplaire **3★ ou mieux** de cette espèce (voir point 1). En dessous de 3★, les
offres continuent d'apparaître pour laisser une chance d'améliorer la génétique.

## Fait — 2026-09-21, dans cet ordre

1. **Point 4 (perf)** — `heldBy(s)` dans `game.ts` (map objet→porteur en un seul passage sur les
   Pokémon), utilisée par `fusionCandidates`, `recycle` et `BagPanel` au lieu de `holder()` par objet.
2. **Points 2+3 (boîte)** — `remainingEvolutions`/`excessMons`/`releaseExcess` dans `game.ts`, bouton
   « Nettoyer les doublons » + confirmation dans `TeamPanel.tsx`. Tri de la boîte par `primaryType()`.
3. **Point 5 (Carte)** — `zoneSpecies()` (`ZoneDex.tsx`) ne compte plus le boss de zone sauf s'il porte
   `repeatable: true` (champ ajouté sur `ZoneDef.boss` dans `content.ts`, inutilisé pour l'instant).
4. **Point 1 (étoiles)** — `geneQuality`/`monStars` dans `stats.ts`, composant `Stars.tsx`, affiché dans
   `TeamPanel` (équipe + boîte) et `MonSheet`.
5. **Points 7+8 (options de capture)** — 4 réglages dans `settings.ts` (`autoCapture`,
   `autoCaptureBestBall`, `autoCaptureUpgrade`, `hideOwnedOffers`), toggles dans `Hud.tsx`, logique
   d'interception dans `runner.ts` (`onRewards`) : `bestStarsOf`/`autoCaptureBall` dans `game.ts`. Bonus
   au passage : le toast « ✨ chromatique » ne se déclenchait en réalité jamais (une capture chromatique
   est toujours `guaranteed`, donc ne passait jamais par la branche qui affichait ce toast) — corrigé.
   - **Ajout du 2026-09-21 (suite)** : `autoCaptureUpgrade` — l'auto-capture se redéclenche aussi pour
     une espèce déjà possédée tant qu'elle est sous 3★ (pas seulement pour les espèces jamais eues),
     pour viser une collection entièrement 3★+ combinée à l'option « ne pas proposer si déjà 3★+ ».
     Coûte plus de Balls, assumé.
6. **Point 6 (pension → XP + Exploration)** — `GameState.pension` devient `{uid, since, xpPerHour}[]`
   (XP passive, `harvestPension` sans RNG). Nouveau `GameState.exploration` reprend l'ancien mécanisme à
   métiers tel quel (`assignExploration`/`harvestExploration`/`JOBS`). Nouvel onglet **Exploration** dans
   `App.tsx` (`ExplorationPanel.tsx`), `PensionPanel.tsx` réécrit pour l'XP. `migrateSave()` convertit les
   anciennes entrées de pension (avec `job`) en exploration ; la nouvelle pension démarre vide sur les
   vieilles saves. L'aura à moitié donnée à l'équipe s'applique maintenant aux deux listes (pension +
   exploration).
   - **Retouche du 2026-09-21 (suite)** : le taux fixe (`50 XP/h`) était ridicule comparé au combat actif
     (un Nidoran Nv.8 ne montait pas de niveau en 2h). Remplacé par un taux **dynamique**, une part
     (`PENSION_XP_SHARE = 40 %`) de ce que l'équipe actuelle encaisse réellement par heure au combat —
     calculé par le même échantillonnage réel que l'idle (`teamXpPerHour` dans `idle.ts`), figé au moment
     où le Pokémon est posté (pas de resimulation à chaque affichage). Scale automatiquement avec la
     progression du joueur (nouveaux biomes compris), aucun chiffre à retoucher à la main.

Tests dans `src/game/__tests__/{game,stats}.test.ts` (47 au total), `npm run typecheck` OK, simulation
d'équilibrage toujours dans la fourchette 30 min – 3 h.

**Reste à faire par Arno** : test manuel dans Expo Go, en particulier vérifier que la nouvelle pension
(ex-Verger/Entraînement/Fouille) apparaît bien sous l'onglet Exploration avec les postes déjà en cours.

---

---

# Archive 4 — plan Gen 3 / Gen 4 (ex `PLAN_GEN3_GEN4.md`)

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


---

# Archive 5 — état Gen 3 / Gen 4 (ex `ETAT_GEN3_GEN4.md`)

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

## Sinnoh : FAIT le 2026-09-24

Région complète (biomes 32-46, Pokédex 1-493 autonome), générée par `tools/regions/sinnoh.json`, courbe de
difficulté, `BIOME_SET`, test de couverture et simulation bout en bout (~3 h 30). Reste : test manuel par Arno
du prestige Hoenn → Sinnoh, relecture des équipes d'arène et des noms provisoires.

---

## Reste à faire (historique, avant Sinnoh)

### Règle à respecter : chaque région est autonome
Hoenn l'est déjà (Pokédex 1-386 obtenable dans ses seuls biomes). **Sinnoh doit l'être aussi** : tout le
Pokédex 1-493 obtenable dans les seuls biomes 32-46, sans repasser par Kanto, Johto ni Hoenn. Le test de
couverture par région (`test.each(REGIONS)`) doit passer avant de considérer Sinnoh comme terminé.

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
- **Panoplies** : FAIT pour Hoenn, sans créer de nouvel objet. Chaque biome 20-31 réutilise la panoplie
  du même thème (`BIOME_SET` dans `items.ts`, `setOfBiome()`), et `biomeTier()` recale la puissance sur la
  région (1er biome = Kanto 1, dernier ≈ +60 %, champ `Item.tier`). Le starter reçoit la panoplie du
  1er biome de sa région. Sinnoh : ajouter ses biomes dans `BIOME_SET`, rien d'autre.
- **Équilibrage** : FAIT pour Hoenn — courbe de difficulté unique par région (`DIFFICULTY` dans `game.ts`),
  simulation bout en bout étendue (`simulate(..., region)`). Sinnoh : ajouter sa valeur dans `DIFFICULTY.end`.
- **Doc** : `CLAUDE.md` (Hoenn codé, `REGIONS`, générateur), `BIOMES.md` (courbes Hoenn/Sinnoh),
  cocher `PLAN_GEN3_GEN4.md`.
- **Détail de nom** : FAIT (Frédo).
- **Taille de l'APK** : +29 Mo de sprites. À surveiller au prochain build EAS.

### Test manuel par Arno
- Prestige Kanto → Johto → Hoenn : FAIT le 2026-09-24, fonctionne.
- Même chose vers Sinnoh une fois codé.

