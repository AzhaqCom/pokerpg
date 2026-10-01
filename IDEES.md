# Idées et pistes

Ce qui reste à faire ou à envisager (ce qui est fait est dans `CLAUDE.md` et la dernière passation `SESSION_*.md`).

## Sauvegarde (fin de jeu)
- La sauvegarde est un seul bloc JSON (~130-200 octets par objet) ; la Tour hors ligne ajoute 230 à 390 Chromatiques par
  nuit, jamais recyclés. Le joueur est prévenu au-delà de 1,5 Mo (`saveIssue`, `src/store/game.ts`). Si ça arrive :
  1. **fusion automatique** des Chromatiques identiques de la Tour hors ligne (par 3, jamais les verrouillés ni les
     portés, réglage pour la couper) — pas de recyclage automatique : tout Chromatique est de la matière de fusion ;
  2. **sauvegarde scindée** en 3 clés (progression, Pokémon, objets), écrites d'un seul `multiSet`, seulement celles qui
     ont changé ;
  3. SQLite (`expo-sqlite`) seulement si ça ne suffit pas.

## Revue de code (2026-10-01) — points mineurs non corrigés
- Hors ligne : `sampleWaves` (`idle.ts`) n'applique pas l'adoucissement des équipes de 1-2 Pokémon (`SOLO_MALUS`) :
  l'absence est un peu plus dure qu'en jouant tant que l'équipe n'a pas 3 membres.
- `grantDailyBalls` compare le jour avec `===` : reculer l'horloge du téléphone redonne les 5 Balls (utiliser `>`).
- `completeDex` : boucle `while (mon.speciesId !== target) evolve(...)` sans garde-fou ; sûre avec les données actuelles
  (vérifié), à protéger si une évolution incohérente apparaît un jour.

## Performances (à revoir sur l'APK)
- « Équiper le meilleur » avec un très gros Sac : ~0,3 s sur PC pour 5 000 objets, sans doute 1 à 3 s sur téléphone.
- Réduire les vignettes `assets/thumbs` de 240 à 144 px (`SIZE` dans `tools/make_thumbs.py`) : décodage ~2,8× plus
  léger, pixel art un peu moins net, à juger visuellement.
- Le combat déclenche des mises à jour fréquentes du store (`rev`) qui redessinent les panneaux ouverts : à mesurer.
- Le Pokédex est une `FlatList` virtualisée à cases mémoïsées (`DexCell`) ; Expo Go exagère les lenteurs.

## Équilibrage
- Un joueur expérimenté est très puissant en fin de région : les derniers biomes se traversent en quelques minutes sans
  défaite. Laissé tel quel volontairement (2026-09-24) ; pistes : `BOSS_RAMP` plus raide, niveau/gènes des derniers boss.
- Formule de recharge `clamp(2, 12, (puissance − 20) / 10)` : les petites attaques ont le meilleur débit (une attaque de
  40 fait 20 dégâts/s, une de 120 en fait 12). Le bouton « ★ Auto » des capacités en tire parti ; corriger la formule
  changerait tout l'équilibrage (simulation longue).
- `SUB_WORTH` (valeur des sous-stats) est mesuré en fin de jeu ; en début de partie l'ordre diffère (Recharge et Défense
  y valent plus). Sans effet notable aujourd'hui (fusions de début de partie à 1-2 sous-stats).
- En fin de jeu, un jet de Vitesse vaut encore un peu moins qu'un jet d'Attaque (Tour, Chromatique Nv.120) : à monter
  d'un cran (`SUB_BASE.spePct`) si ça se ressent en jouant.
- Tour : le duo Giratina + Kyogre domine (tous les meilleurs trios l'incluent, `tools/scratch/tower100.ts`).

## Contenu
- Sinnoh est la dernière région codée. Ajouter une région : voir `REGIONS.md`.
- Écarts connus, laissés tels quels : Togetic est Vol pur dans les données (Normal/Vol dans les jeux d'origine) ;
  la 1re zone de la Forêt de Jade (Kanto) n'a que 5 espèces normales ; Johto n'a pas de biome Feu (Salamèche et
  Héricendre sont à la Forêt Fourmillante et aux Prairies de Doré).

## Build APK
- Projet EAS sur le compte `azhaq47` (`app.json` : `owner`, `extra.eas.projectId`). Si la limite de builds est encore
  atteinte : `eas logout`, `eas login` (autre compte), remplacer `owner`, retirer `projectId`, `eas init`, puis
  `eas build -p android --profile preview`.
