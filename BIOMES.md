# Plan des biomes — de la Forêt de Jade au Plateau Indigo

Document de conception. Objectif : décider, **une bonne fois et par le calcul**, combien de biomes il
faut pour (1) couvrir une progression de niveau crédible jusqu'à **Nv.100** et (2) rendre les **151**
Pokémon obtenables en solo (pas de trade dans ce jeu). Rien n'est codé tant que ce document n'est pas
validé par Arno.

## Méthode retenue

Le jeu source ses données (capacités, noms) des CSV Rouge/Bleu, et le biome 1 reproduit déjà très
fidèlement le début du jeu original : « Forêt de Jade » = Route 2 + Forêt de Jade, arène « Pierre » =
Brock (Roche). On garde cette logique plutôt que d'inventer une structure arbitraire :

1. **1 biome = 1 badge**, dans l'ordre du jeu original (8 badges), **+ 2 biomes de fin de jeu**
   (Route Victoire, puis Ligue Pokémon/postgame) → **10 biomes** au total.
2. **Niveaux** : on part du niveau de fin du biome 1 déjà codé (arène Nv.18) et on applique le même
   facteur d'échelle aux paliers de badges du jeu original (Bulbapedia), pour que le dernier biome
   atteigne pile Nv.100. Calcul détaillé plus bas — pas de chiffres sortis du chapeau.
3. **Espèces** : les 151 sont réparties une fois pour toutes sur les 10 biomes. Une évolution est
   acquise automatiquement en montant de niveau (`evolve()` marque déjà le Pokédex) — on ne place donc
   que la **forme de base** de chaque lignée dans un biome ; ses évolutions suivent sans placement
   séparé, du moment que le niveau requis est atteignable dans ce biome ou un biome ultérieur (le
   joueur garde son équipe d'un biome à l'autre).
4. Les espèces sans équivalent « rencontre sauvage normale » dans le jeu original (légendaires,
   fossiles, starters non choisis) sont traitées à part — voir « Cas particuliers ».
5. **Composition de chaque biome — type dominant, pas ordre du Pokédex** (changé le 2026-09-21, voir
   plus bas) : chaque biome 2-8 est dominé par le type de son arène (déjà fixé par le badge qu'il
   représente), pour que le joueur doive vraiment adapter son équipe. Biomes de taille égale (~11-13
   espèces) : si un type a trop de représentants (Eau, 23 espèces) ou pas assez (Psychic, 2), le calcul
   plafonne/complète — détail plus bas.

## Courbe de niveau (calcul)

Paliers de badges du jeu original (Bulbapedia, Pokémon le plus fort de chaque leader) :
Brock 14, Ondine 21 (+7), Major Bob 24 (+3), Erika 29 (+5), Koga 40 (+11), Morgane 43 (+3),
Auguste 47 (+4), Giovanni 50 (+3), Conseil 4 ~57 (+7), Champion ~63 (+6).

Écart total Brock→Champion = 49 niveaux, pour un écart cible Nv.18→Nv.100 = 82 niveaux.
**Facteur d'échelle = 82 / 49 ≈ 1,67.** On applique ce facteur aux écarts (pas aux valeurs brutes),
cumulés depuis le Nv.18 déjà atteint :

| # | Biome | Type dominant | Badge / palier | Écart original | Niveau de fin |
|---|-------|:-:|-----------------|:-:|:-:|
| 1 | Forêt de Jade | Insecte/Normal (mixte) | Pierre (Roche) — **fait** | — | **18** |
| 2 | Biome Aquatique | Eau | Ondine | +7 | **30** |
| 3 | Biome Électrique | Électrik | Major Bob | +3 | **35** |
| 4 | Biome Verdoyant | Plante | Erika | +5 | **43** |
| 5 | Marais Toxique | Poison | Koga | +11 | **61** |
| 6 | Sanctuaire Psy | Psy | Morgane | +3 | **66** |
| 7 | Terres de Feu | Feu | Auguste | +4 | **73** |
| 8 | Plaines Rocheuses | Sol | Giovanni | +3 | **78** |
| 9 | Route Victoire | mixte (réserve) | Conseil des 4 | +7 | **90** |
| 10 | Ligue Pokémon (Plateau Indigo) | mixte (réserve) | Champion + postgame | +6 | **100** |

Les noms changent (thème par type plutôt que géographie précise du jeu original), mais **le nombre de
biomes et la courbe de niveau ne bougent pas**.

Chaque biome garde la structure actuelle : **3 zones × 5 étapes × 3 vagues + 1 arène**. Le détail des
3 zones (bornes de niveau exactes, pool par zone) se précisera au moment de coder ce biome — inutile de
le figer 8 biomes à l'avance.

## Répartition des 151 espèces

**Biome 1 (fait)** : 21 espèces placées (pools + boss), dont les lignées Chenipan/Aspicot/Roucool/
Rattata/Nidoran×2/Abo/Pikachu/Mystherbe/Paras/Abra/Chétiflor/Racaillou — leurs évolutions restantes
(Roucarnage, Rattatac, Arbok, Raichu, Nidoqueen, Nidoking, Rafflesia, Parasect, Aéromite, Alakazam,
Empiflor, Grolem…) tombent automatiquement en montant de niveau dans les biomes suivants.

**Starters** : les 3 lignées (Bulbizarre/Salamèche/Carapuce) sont acquises pour la ligne choisie via
`chooseStarter`. Sans trade, il faut un moyen d'obtenir les 2 non choisies pour le Pokédex — **validé** :
les 3 formes de base apparaissent en rencontre sauvage très rare dès le biome 2 (poids ~3, comme une
espèce rare de zone).

**Biomes 2 à 8 — méthode** : on ne compte que les lignées qui ne sont pas déjà couvertes (biome 1 +
starters + réserve postgame ci-dessous) — 84 espèces à placer, réparties sur 7 biomes (~12 chacun).
Chaque biome reçoit d'abord toutes les lignées de son type dominant (plafonné à ~12) ; le surplus
(l'Eau a 23 espèces, largement plus que 12) part dans le pot commun. Ce pot commun (surplus + Normal,
qui n'a pas de badge dédié dans le jeu original et sert justement de « on en croise partout » + petits
types Fantôme/Insecte/Glace/Roche) est ensuite réparti dans les biomes encore sous la moyenne, en
priorité par affinité de type (Poison+Fantôme, Plante+Insecte, Psy+Combat comme dans le jeu original où
le Dojo Combat est juste à côté de l'arène Psy de Safrania, Feu+Roche+Glace). Résultat (11 à 13 espèces
par biome, donc quasi égal) :

| Biome | Dominante | Lignées (forme de base) |
|---|---|---|
| 2 · Aquatique | Eau (6) + surplus Eau non utilisé ailleurs | Psykokwak, Ptitard, Tentacool, Ramoloss, Otaria, Kokiyas |
| 3 · Électrique | Électrik (4) + filler | Magnéti, Voltorbe, Élektek, Voltali, Rondoudou, Canarticho, Krabby, Évoli |
| 4 · Verdoyant | Plante (2) + Insecte (2) + filler | Noeunoeuf, Saquedeneu, Insécateur, Scarabrute, Mélofée, Miaouss, Excelangue, Poissirène |
| 5 · Toxique | Poison (3) + Fantôme (1) + filler | Nosferapti, Tadmorv, Smogo, Fantominus, Leveinard, Stari |
| 6 · Sanctuaire Psy | Psy (1) + Combat (4, dojo voisin) + filler | Soporifik, Férosinge, Machoc, Kicklee, Tygnon, Kangourex, Tauros |
| 7 · Terres de Feu | Feu (5) + Glace (1) + filler | Goupix, Caninos, Ponyta, Magmar, Pyroli, Lippoutou, Hypotrempe |
| 8 · Plaines Rocheuses | Sol (4) + filler | Sabelette, Taupiqueur, Osselait, Rhinocorne, Doduo, Magicarpe |

Quelques placements « filler » sont un peu forcés (Krabby en biome Électrique, Hypotrempe en Terres de
Feu) faute d'assez d'espèces du type dominant — acceptable, Arno a validé que ce n'est pas grave si ce
n'est pas parfaitement thématique partout, l'essentiel est la dominante de chaque biome.

**Biomes 9-10 (réserve postgame, 18 espèces)** : Amonita→Amonistar, Kabuto→Kabutops, Ptéra, Ronflex,
Artikodin, Électhor, Sulfura, Minidraco→Draco→Dracolosse, Lokhlass, M. Mime, Métamorph, Porygon,
Mewtwo, Mew. Répartition fine à trancher — voir Cas particuliers.

## Cas particuliers — validés avec Arno le 2026-09-21

Règle de base pour tout le document : **les 151 doivent être obtenables ET chromatiques** (Chromatique-Dex
à 151 doit rester atteignable). C'est ce qui a tranché le point 2 ci-dessous.

1. **Starters non choisis** : rencontre sauvage ultra-rare dès le biome 2 — validé, voir plus haut.
2. **Oiseaux légendaires (Artikodin/Électhor/Sulfura) + Mewtwo + Mew** : présentés comme un boss de fin
   de biome (9 ou 10), **mais contrairement à un boss de zone classique, ce combat reste rejouable à
   volonté après la première victoire** — sinon impossible de les farmer pour le chromatique. Mécanisme
   retenu :
   - Même flux que la capture garantie des boss actuels (`guaranteed: true`, capture à 100 %), mais sans
     le verrou `bossesBeaten` qui bloque un rechallenge côté `MapPanel` : un nouveau champ (ex.
     `repeatable: true` sur la définition du boss) laisse le bouton « Défier » actif après la première
     victoire.
   - Contrairement au boss de zone actuel (`makeMon(..., false, ...)`, jamais chromatique — volontaire
     pour ne pas trivialiser le farm d'un boss unique), ces 5 combats tirent le chromatique au taux
     normal (1/256) à **chaque** tentative, comme un Pokémon sauvage.
   - Implication : le joueur peut accumuler plusieurs exemplaires (pas un problème, cf. `release()` déjà
     pensé pour ça).
3. **Fossiles (Amonita/Kabuto) et Ptéra** : capture sauvage normale — validé, pas de système de
   ranimation à construire.
4. **Dracolosse** : placé en biome 9 (Route Victoire) — validé.
5. **Courbe XP jusqu'à Nv.100** : pas bloquant maintenant, à vérifier par simulation quand on codera les
   biomes proches de Nv.100.

## Biome 2 — fait (2026-09-21)

**Biome Aquatique** codé dans `content.ts` (`BIOMES[1]`) : Berges Claires (Nv 18-21, boss Têtarte 23),
Récif Corallien (21-24, boss Crustabri 27), Fosse Profonde (24-28, boss Tartard 29), arène de Céruline
— Ondine (Eau), équipe Stari/Stari/Staross Nv 27-30. Starters non choisis en rencontre rare (poids 5)
dans le pool de Berges Claires.

**Refonte moteur nécessaire** (le jeu n'était câblé que pour un seul biome) : `GameState.zone`/`stage`
sont maintenant complétés par `biome` ; `unlocked`/`bossesBeaten` sont passés de tableaux plats (par
zone) à des tableaux imbriqués `[biome][zone]` ; `arenaBeaten` est passé d'un simple booléen à un
tableau par biome. `migrateSave()` convertit les sauvegardes d'avant cette refonte au chargement (les
anciennes clés à plat sont réinterprétées comme le biome 0, le biome 1 démarre verrouillé). Battre
l'arène d'un biome débloque désormais automatiquement le biome suivant (`biomeAvailable()`), comme un
boss de zone débloque la zone suivante. `MapPanel` affiche tous les biomes, grisés/verrouillés tant que
l'arène précédente n'est pas battue.

Tests ajoutés dans `game.test.ts` : traversée complète d'un biome jusqu'à l'arène → transition vers le
biome suivant, `selectStage` refuse un biome verrouillé, cohérence des niveaux du biome 2.

## Correctif — audit de couverture des 151 (2026-09-21)

Vérification systématique : sur 151 espèces, 81 formes de base/sans évolution doivent être placées
explicitement (les autres suivent automatiquement en montant de niveau). **1 manquait** : **Onix**
(#95), présent uniquement dans l'équipe de l'arène de Pierre — or un combat d'arène (`kind === 'arena'`)
n'offre jamais de capture (`waveRewards` dans `game.ts`), donc Onix était incapturable, chromatique
inclus. Corrigé : ajouté en rencontre sauvage rare (poids 5) dans le pool de Clairière (biome 1), en plus
de rester dans l'équipe du leader. Reste des 80 autres espèces : couverture confirmée (biome 1 codé,
biome 2 codé, biomes 3-8 et réserve 9-10 par la liste de ce document, starters non choisis en rencontre
rare dès le biome 2). Test de non-régression : `game.test.ts`.

## Biome 3 — fait (2026-09-21)

**Biome Électrique** codé dans `content.ts` (`BIOMES[2]`) : Sous-station (Nv 30-31, boss Krabboss 32),
Salle des Générateurs (31-33, boss Magnéton 33), Centrale Principale (33-34, boss Électrode 34), arène
de Carmin-sur-Mer — Major Bob (Électrik), équipe Voltorbe/Magnéton/Raichu Nv 32-35 (Raichu en clin
d'œil au starter Pikachu du biome 1, même logique que Stari/Staross en biome 2). Les 8 espèces prévues
(Magnéti, Voltorbe, Élektek, Voltali, Rondoudou, Canarticho, Krabby, Évoli) sont chacune présentes dans
au moins un pool de zone (jamais seulement en boss), pour rester farmables en chromatique.

Nouveau décor de combat `electric` (violet/métal) ajouté dans `ZoneDef.biome` et `SKIES`
(`BattleView.tsx`), les 4 décors existants (forest/meadow/cave/water) ne convenaient à aucune zone de ce
biome.

**Correctif niveaux (même jour, avant de coder le biome 4)** : l'arène montait initialement à Nv.39 au
lieu du Nv.35 documenté plus haut (§ Courbe de niveau) — écart découvert en préparant le biome 4, dont le
point de départ dépend du niveau de fin exact du biome 3. Corrigé (niveaux resserrés 30→35 au lieu de
30→39) avant de coder la suite, sinon toute la courbe dérive de biome en biome. Un test générique dans
`game.test.ts` vérifie désormais, pour chaque biome codé : le niveau max de l'arène tombe pile sur le
niveau documenté dans ce fichier, et le biome suivant démarre pile où le précédent finit.

Tests ajoutés dans `game.test.ts` : courbe de niveau (cohérence + continuité + valeurs documentées),
couverture des 8 espèces prévues en rencontre sauvage.

## Biome 4 — fait (2026-09-21)

**Biome Verdoyant** (`BIOMES[3]`, Nv 35→43, Plante + Insecte) : Clos Fleuri (35-37, boss Persian 38),
Ronce Profonde (37-39, boss Noadkoko 40), Canopée Verdoyante (39-42, boss Poissoroy 42), arène de
Céladopole — Erika (Plante, Badge Prisme), équipe Rafflesia/Empiflor/Parasect Nv 40-43 (finales du
biome 1, même logique de réutilisation que Raichu en biome 3). Espèces prévues (Noeunoeuf, Saquedeneu,
Insécateur, Scarabrute, Mélofée, Miaouss, Excelangue, Poissirène) toutes en pool.

Tests ajoutés : couverture des espèces prévues, inclus dans le test générique de courbe de niveau
(4 biomes codés à ce stade).

## Biome 5 — fait (2026-09-21)

**Marais Toxique** (`BIOMES[4]`, Nv 43→61, Poison + Fantôme) : Marais Embrumé (43-48, boss Nosferalto
50), Tourbière Toxique (48-55, boss Grotadmorv 57), Cœur du Marécage (55-59, boss Smogogo 60), arène de
Parmanie — Koga (Poison, Badge Âme), équipe Grotadmorv/Smogogo/Ectoplasma Nv 58-61 (les propres boss de
ce biome, cohérent avec un maître Poison/Spectre). Espèces prévues (Nosferapti, Tadmorv, Smogo,
Fantominus, Leveinard, Stari) toutes en pool. Nouveau décor `swamp` (vert marécageux).

Tests ajoutés : couverture des espèces prévues, inclus dans le test générique de courbe de niveau
(5 biomes codés à ce stade).

## Biome 6 — fait (2026-09-21)

**Sanctuaire Psy** (`BIOMES[5]`, Nv 61→66, Psy + Combat) : Torii Embrumé (61-62, boss Colossinge 63),
Dojo de la Prévoyance (62-64, boss Hypnomade 65), Sanctuaire Intérieur (64-65, boss Mackogneur 65),
arène de Safrania — Morgane (Psy, Badge Marais), équipe Kadabra/Alakazam/Hypnomade Nv 63-66 (Alakazam
en clin d'œil à Abra du biome 1). Espèces prévues (Soporifik, Férosinge, Machoc, Kicklee, Tygnon,
Kangourex, Tauros) toutes en pool. Nouveau décor `temple` (violet mystique).

Tests ajoutés : couverture des espèces prévues, inclus dans le test générique de courbe de niveau
(6 biomes codés à ce stade).

## Biome 7 — fait (2026-09-21)

**Terres de Feu** (`BIOMES[6]`, Nv 66→73, Feu + Glace) : Contrefort Cendré (66-68, boss Feunard 69),
Champ de Lave (68-70, boss Arcanin 71), Caldeira Ardente (70-72, boss Galopa 72), arène de l'Île
Cannelle — Auguste (Feu, Badge Volcan), équipe Arcanin/Magmar/Dracaufeu Nv 70-73 (Dracaufeu en clin
d'œil au starter Salamèche du biome 1, même logique que Raichu/Alakazam). Espèces prévues (Goupix,
Caninos, Ponyta, Magmar, Pyroli, Lippoutou, Hypotrempe) toutes en pool. Nouveau décor `volcano`
(rouge/noir cendré).

Tests ajoutés : couverture des espèces prévues, inclus dans le test générique de courbe de niveau
(7 biomes codés à ce stade).

## Biome 8 — fait (2026-09-21)

**Plaines Rocheuses** (`BIOMES[7]`, Nv 73→78, Sol) : Carrière Aride (73-74, boss Sablaireau 75),
Crevasse Rocheuse (74-76, boss Triopikeur 76), Plateau Desséché (76-77, boss Ossatueur 77), arène de
Jadielle — Giovanni (Sol, Badge Terre), équipe Rhinoféros/Dodrio/Nidoking Nv 75-78 (Nidoking en clin
d'œil à la lignée Nidoran♂ du biome 1). Espèces prévues (Sabelette, Taupiqueur, Osselait, Rhinocorne,
Doduo, Magicarpe) toutes en pool. Nouveau décor `desert` (ocre aride).

Tests ajoutés : couverture des espèces prévues, inclus dans le test générique de courbe de niveau
(8 biomes codés à ce stade — les 8 badges de la ligue Kanto sont maintenant tous couverts).

## Biome 9 — fait (2026-09-21)

**Route Victoire** (`BIOMES[8]`, Nv 78→90, réserve postgame) : Entrée de la Route Victoire (78-82, boss
Dracolosse 84, classique), Passage Rocheux (82-86, boss **Artikodin 87, rejouable**), Sommet Balayé par
les Vents (86-89, boss **Électhor 90, rejouable**), « arène » Conseil des 4 (équipe Léviator/Mackogneur/
Grolem Nv 88-90, réutilise Magicarpe biome 8, Machoc biome 6, Racaillou biome 1). Espèces couvertes en
pool : Minidraco (pré-évolution de Dracolosse, indispensable pour le chromatique du boss), Ptéra,
Lokhlass, Kabuto, Ronflex, Amonita, M. Mime — Métamorph et Porygon restent à placer au biome 10.

**Mécanisme des boss rejouables** (`repeatable: true`, prévu dans `ZoneDef` mais jamais câblé avant) :
- `makeWaves` (game.ts) : un boss `repeatable` tire son chromatique comme un sauvage (1/256) à **chaque**
  tentative ; un boss classique reste toujours non-chromatique (inchangé, pour ne pas trivialiser le
  farm d'un boss unique).
- `waveRewards` : l'offre de capture du boss reflète désormais le vrai statut chromatique du Pokémon
  généré (`b.shiny`) au lieu d'un `false` en dur — sans incidence sur les boss classiques (toujours
  `false` puisque jamais chromatiques).
- `MapPanel` et le raccourci `HudBottom` : le bouton « Défier » reste actif après une victoire si
  `boss.repeatable`, au lieu de disparaître comme pour un boss de zone classique.

Tests ajoutés : couverture des espèces prévues (hors Métamorph/Porygon, biome 10), Artikodin/Électhor
marqués `repeatable`, tirage chromatique du boss rejouable vs jamais pour un boss classique, offre de
capture qui reflète le tirage, bouton Défier non verrouillé après une victoire.

## Biome 10 — fait (2026-09-21) — plan complet des 10 biomes terminé

**Ligue Pokémon** (`BIOMES[9]`, Nv 90→100, réserve postgame) : Antichambre du Plateau (90-93, boss
**Sulfura 94, rejouable**), Grotte Bleue (93-96, boss **Mewtwo 97, rejouable**), Antre de Mew (96-99,
boss **Mew 99, rejouable**), arène du Plateau Indigo — Champion (équipe Florizarre/Dracaufeu/Tortank
Nv 96-100, les 2 lignées de starters non choisies + un clin d'œil au starter du joueur, écho de la
sélection du tout début du biome 1). Espèces couvertes en pool : Métamorph, Porygon (dernières
manquantes), Lokhlass/Ronflex/Amonita/M. Mime/Kabuto/Ptéra réapparaissent à plus haut niveau.

**Correctif découvert en même temps (audit final)** : un nouveau test générique qui vérifie
automatiquement les 151 espèces sur l'ensemble des 10 biomes a détecté que **Racaillou** (#74, biome 1)
avait exactement le même bug qu'Onix (#95) début septembre : présent uniquement dans l'équipe de
l'arène de Pierre, jamais dans un pool, donc incapturable — raté par l'audit manuel de l'époque, qui ne
vérifiait que la présence du nom dans ce document et pas le code réel. Corrigé : ajouté en rencontre
rare (poids 10) dans le pool de Clairière, aux côtés d'Onix.

**Plan des 10 biomes terminé** : les 151 espèces sont désormais toutes couvertes (formes de base en
rencontre sauvage ou boss rejouable, évolutions automatiques en montant de niveau), et la courbe de
niveau va du Nv.3 (biome 1) au Nv.100 (biome 10) exactement comme calculé en tête de ce document. Reste
à valider chaque biome en jeu par Arno, et éventuellement retoucher l'équilibrage une fois testé en
conditions réelles (comme pour le lot du 2026-09-21 sur le biome 1).

Test ajouté : audit exhaustif des 151 espèces (81 formes de base/sans évolution, toutes en rencontre
sauvage ou boss rejouable) sur l'ensemble des biomes codés — sert de garde-fou pour tout futur ajustement
de contenu.

## Simulation d'équilibrage bout en bout (2026-09-21)

`bot.ts`/`balance.test.ts` ne simulaient qu'un badge (biome 1) — étendu maintenant que les 10 biomes
existent : le bot joue jusqu'au badge du Champion (`s.arenaBeaten[BIOMES.length - 1]`), jalons
`biomeN-bossZ`/`biomeN-badge` par biome (au lieu d'un seul `boss1..3`/`badge` global, qui n'aurait
enregistré que la première occurrence toutes biomes confondues).

**Résultat, sondé sur 10 seeds** : le jeu complet se termine toujours, entre **3h30 et 6h50** de combat
pur simulé (aucun blocage). Test committé sur 3 seeds, bornes larges (1h30-10h) pour ne pas devenir
friable au moindre ajustement futur.

**Observation notable, pas encore traitée** : les biomes 6, 7 et 8 se traversent en ~3-4 min chacun
(contre 77 min pour le biome 1, 41 min pour le biome 5), alors que le badge 1er biome vise 30 min-3h.
En partie explicable par la courbe de niveau elle-même (écarts originaux Bulbapedia +3/+4/+3 pour ces
biomes contre +11 pour le biome 5, donc des paliers volontairement courts — voir § Courbe de niveau) et
par un joueur déjà suréquipé/talents avancés à ce stade. Mais l'écart est marqué ; à surveiller au test
manuel en jeu, et éventuellement retravailler la difficulty de ces 3 zones si ça se confirme trop facile
en conditions réelles (pas fait ici : décision d'équilibrage à trancher avec Arno, pas une correction de
bug comme Onix/Racaillou).

---

## Hoenn (biomes 20-31) et courbe de difficulté (2026-09-24)

12 biomes, Nv.5 → 100 : Mérouville, Myokara, Bois de Clémenti, Lavandia, Mont Chimnée, Clémenti-Ville,
Route du Désert, Cimetronelle, Algatia, Atalanopolis, Route Victoire, Éternara. Le détail des équipes et
des pools vient du générateur (`tools/gen_region.ts`, `tools/regions/hoenn.json`). La difficulté des
sauvages suit une seule courbe par région (`DIFFICULTY` dans `game.ts`) : ×0,60 au départ → ×1,6 Kanto /
×1,9 Johto / ×2,2 Hoenn ; boss et arènes via `bossRamp`. Durée de simulation d'un joueur « humain » :
~3 h à 3 h 30 par région.

---

## Sinnoh (biomes 32-46, 2026-09-24)

Roche (Charbourg) → Plante/Insecte (Bonville) → route Normal/Vol → Combat (Voilaroc) → Eau (Verchamps) → route
Poison/Sol → Spectre/Psy (Unionpolis) → route Feu → Acier (Canalave) → route Ténèbres → Glace (Frimapic) →
Électrik (Rivamar) → Mont Couronné (Dragon) → Route Victoire → Ligue (Cynthia). Nv.5 → 100, courbe de
difficulté ×0,6 → ×2,5. 3 h 30 - 4 h en simulation.
