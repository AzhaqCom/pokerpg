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
- Tour : le duo Giratina + Kyogre domine (tous les meilleurs trios l'incluent, `tools/scratch/tower100.ts`, confirmé le
  2026-10-02 par `tools/scratch/tower_meta.ts trios` : Giratina devant, Kyogre derrière, Heatran, Dialga, Blizzaroi ou
  Ho-Oh au milieu, à 1 point près).
- **Panoplies de fin de jeu à rééquilibrer** (mesure du 2026-10-02, `tools/scratch/tower_meta.ts sets`, Giratina →
  Heatran → Kyogre en Chromatique +4 Nv.200, étage 134, même panoplie pour les 3) : Brume Toxique 45 % de victoires,
  Voile des Ombres 36 %, mais les panoplies dont l'objet offensif est un objet **Attaque** (Tenue Sylvestre, Cendres
  Ardentes, Poussière Aride, Titre de Champion, Essaim Fourmillant, Alliage du Phare, Écailles de la Tanière, Titre de
  Champion Johto) entre 0 et 2 % (Marée Vivante 9 %, grâce au Vol de vie). Cause : les dégâts multiplient l'Attaque par
  le bonus des critiques ; le bonus d'Attaque est déjà énorme en fin de jeu (talents, badges, auras), un objet Attaque de
  plus n'ajoute presque rien, alors que les Dégâts critiques (multiplicateur à part, peu rempli) et le Vol de vie pèsent
  beaucoup. Pistes : baisser les Dégâts critiques des objets Critique de fin de jeu, ou donner aux panoplies Attaque un
  bonus qui multiplie les dégâts à part. Objectif : chaque panoplie offensive à quelques étages de la meilleure.
  Méthode : mesurer avec le script (`sets`, `policy`), puis simulation longue (la progression en région ne doit pas
  bouger). À traiter dans une session dédiée : ça touche l'équilibrage de tout l'équipement.

## Contenu
- Sinnoh est la dernière région codée. Ajouter une région : voir `REGIONS.md`.
- Écarts connus, laissés tels quels : Togetic est Vol pur dans les données (Normal/Vol dans les jeux d'origine) ;
  la 1re zone de la Forêt de Jade (Kanto) n'a que 5 espèces normales ; Johto n'a pas de biome Feu (Salamèche et
  Héricendre sont à la Forêt Fourmillante et aux Prairies de Doré).

## Build APK
- Projet EAS sur le compte `azhaq47` (`app.json` : `owner`, `extra.eas.projectId`). Si la limite de builds est encore
  atteinte : `eas logout`, `eas login` (autre compte), remplacer `owner`, retirer `projectId`, `eas init`, puis
  `eas build -p android --profile preview`.
