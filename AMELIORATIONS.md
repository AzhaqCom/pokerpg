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

## Idées à faire (notées le 2026-09-24)

- **Pokédex : où trouver ce Pokémon ?** FAIT (`whereToFind` dans `game.ts`, fenêtre dans `DexPanel.tsx`). Toucher un Pokémon dans le Pokédex ouvre une petite fenêtre
  indiquant le(s) biome(s) où on le rencontre en sauvage. S'il n'existe pas en sauvage (évolution
  uniquement), la fenêtre indique où trouver sa forme de base (ou intermédiaire). Il suffit de
  parcourir `pool` des zones de `BIOMES` (et `boss` pour les légendaires) et de remonter la lignée via
  `evolvesTo`/`EVOLUTION_CHOICES`.

- **Performances (à revoir après le build APK)** :
  - Réduire les vignettes `assets/thumbs` de 240 à 144 px (`SIZE` dans `tools/make_thumbs.py`, le docstring prévoit
    144). Décodage ~2,8× plus léger, pixel art un peu moins net : à juger visuellement.
  - Le combat déclenche des mises à jour fréquentes du store (`rev`) qui redessinent les panneaux ouverts : à mesurer
    dans l'APK avant de toucher.
  - Le Pokédex est une `FlatList` virtualisée à cases mémoïsées (`DexCell`) ; Expo Go exagère les lenteurs.
