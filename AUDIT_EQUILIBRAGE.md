# Audit d'équilibrage des Pokémon (2026-09-24)

Méthode : tournoi 1 contre 1 entre toutes les formes finales avec le vrai moteur (`tools/scratch/duels.ts`, non versionné),
Nv.100, gènes parfaits, sans objets ni talents, chaque paire jouée dans les deux sens (~70 000 à 83 000 combats par
passe). Deux kits : « par défaut » (4 dernières capacités apprises, celui des captures) et « joueur » (meilleures
attaques de types différents, + sommeil et soin s'il y en a). Valeur des bonus : duels « +20 points » contre « sans ».
Limite : le 1 contre 1 surestime sommeil/soin et ignore les capacités de zone ; à confirmer en 3 contre 3.

## Déjà corrigé
- 15 bébés reliés à leur forme adulte (`BABY_EVOLUTIONS`, `data.ts`).
- 24 évolutions inter-générations reliées (`CROSS_GEN_EVOLUTIONS`), bloquées tant que la cible n'est pas dans le
  Pokédex de la région (`evolutionTargets(id, dexMax)`, `canEvolve(mon, dexMax)`, `lineChain`).

- Les deux Affinités peuvent viser le même type.
- **Capacités de Platine pour les 493** (`tools/gen_learnsets_pt.py`) + héritage des pré-évolutions + Baston/Explosion/
  Destruction corrigées (propositions 1, 2 et 4 appliquées). Effet (kit par défaut) : formes finales sous 15 % de
  victoires 24 → 19, sous 25 % 51 → 43 ; Dracaufeu 8 → 51 %, Dracolosse 66 → 83 %, Tortank 51 → 67 %. Kit joueur :
  Nidoking 17 → 47 %, Florizarre 73 → 96 %, Raichu 20 → 38 %, Alakazam 46 → 63 %. Simulations des 4 régions (2 graines) :
  aucun blocage, défaites seulement dans le 1er biome de chaque région (et un peu à Sinnoh b34). Restent faibles surtout
  des Pokémon aux stats basses (Rattatac, Persian, Linéon, Fouinar, Hélédelle…) et les cas spéciaux.

## Constats (avant corrections)
### Données
- Types peu fournis en formes finales : Dragon 6, Spectre 12, Acier 13 (Normal 45, Eau 45).
- Sans aucune capacité : Métamorph, Queulorior (Morphing, Gribouille non codés). Zarbi : 1 capacité. Qulbutoké : Riposte
  et Voile Miroir seulement.
- Baston (Farfuret) : puissance 300 (erreur de conversion). Explosion 250 et Destruction 200 : aucun K.O. du lanceur
  dans le moteur, donc sans contrepartie.
- Recharge `clamp(2,12,(puissance−20)/10)` : une attaque de 40 fait 20 dégâts/s, une de 120 en fait 12. Les petites
  attaques ont le meilleur débit.
- 57 formes finales ont un movepool faible (pas d'attaque de leur type ≥ 60, ou < 3 attaques). Causes : capacités de
  Kanto issues de Rouge/Bleu (très peu d'apprentissages par niveau) et **aucun héritage des pré-évolutions** (un Raichu
  ne peut pas réapprendre les attaques de Pikachu).

### Tournoi
- Corrélation total de stats ↔ victoires : 0,48 (kit par défaut) à 0,57 (kit joueur). Les capacités pèsent autant que
  les stats.
- Le kit par défaut piège le joueur : Dracaufeu 8 % de victoires avec ses 4 dernières capacités.
- Plus faibles (kit joueur, 0-15 %) : Queulorior, Caratroc, Métamorph, Cadoizo, Zarbi, Lovdisc, Qulbutoké, Lumivole,
  Morphéo, Insolourdo, Coxyclaque, Rattatac, Tengalice, Arbok, Persian, Papinox, Canarticho, Linéon, M. Mime,
  Sablaireau, Ludicolo, Castorno, Posipi, Munja, Hélédelle.
- Sous-performent leurs stats : Insécateur, Wailord, Staross, Nidoking, Nidoqueen, Ninjask, Tentacruel, Arbok, Persian.
- Légendaires moyens : Mew 57 %, Deoxys 53 %, Créhelf 51 %, Phione 43 %.
- Test « héritage des pré-évolutions + Baston/Explosion corrigées » : Roserade 35 → 94 %, Tengalice 10 → 60 %,
  Grodoudou 28 → 61 %, Delcatty 28 → 58 %, Ludicolo 13 → 44 %, Raichu 20 → 32 %. Électrode 44 → 14 % (vivait
  d'Explosion).

### Valeur des bonus (+20 points, 1 contre 1, référence 50,8 %)
| Bonus | Victoires | Valeur relative (Attaque = 1) |
|---|---|---|
| Esquive | 60,8 % | 1,2 |
| Attaque, PV, Défense | 59,3 % | 1 |
| Vol de vie | 59,2 % | 1 |
| Dégâts du type | 56,6 % | 0,7 |
| Critique | 55,4 % | 0,5 |
| Recharge | 54,0 % | 0,4 |
| Vitesse | 52,4 % | 0,2 |
| Dégâts contre statut, dégâts critiques, attaque de base, chance de statut, zone | 51,0 à 51,6 % | ≈ 0 à 0,1 |

Conséquences :
- **Spécialités (palier 3, rang 5)** très inégales : Roche/Acier (Défense +30), Eau (Défense +25), Spectre (Esquive +20),
  Dragon (Attaque +20), Vol (Esquive +15), Plante (Vol de vie +15) valent 15 à 30 « points d'attaque » ; Feu, Poison,
  Électrik, Glace, Normal, Combat, Ténèbres valent ≈ 1 à 2.
- **Réflexes** (Vitesse +20 %) vaut environ 5 fois moins que Garde (Défense +20 %).
- **Auras** : Eau (PV +4), Roche/Acier/Dragon (+4) valent ~4 ; Poison (statut +5), Combat/Ténèbres (dégâts critiques
  +6), Sol (zone +5) ≈ 0 en 1 contre 1.

## Propositions (à valider par Arno)
1. Héritage des capacités des pré-évolutions (`learnedMoves`/`movesAtLevel`).
2. Baston → 60 / 4 s ; Explosion → 130, Destruction → 110 (pas de K.O. du lanceur codé).
3. Kit des captures : les 4 meilleures capacités au lieu des 4 dernières.
4. Capacités de Kanto reprises d'un jeu plus récent (Or/Argent ou Diamant/Perle) pour les 151.
5. Cas spéciaux : donner un vrai kit à Métamorph, Queulorior, Zarbi, Qulbutoké (ou coder Morphing/Gribouille).
6. Talents/auras : rééquilibrer pour qu'une spécialité ou une aura vaille à peu près la même chose d'un type à l'autre
   (revoir Vitesse, dégâts critiques, chance de statut, dégâts contre statut, attaque de base) — à confirmer en 3 contre 3.
7. Formule de recharge : débit à peu près constant quelle que soit la puissance — gros impact, simulation longue requise.
