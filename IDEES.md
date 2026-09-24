# Idées et pistes

Ce qui reste à faire ou à envisager (le fait est archivé dans `HISTORIQUE.md`).

## Performances (à revoir après le build APK)
- Réduire les vignettes `assets/thumbs` de 240 à 144 px (`SIZE` dans `tools/make_thumbs.py`, le docstring prévoit
  144) : décodage ~2,8× plus léger, pixel art un peu moins net, à juger visuellement.
- Le combat déclenche des mises à jour fréquentes du store (`rev`) qui redessinent les panneaux ouverts : à mesurer
  dans l'APK avant de toucher.
- Le Pokédex est une `FlatList` virtualisée à cases mémoïsées (`DexCell`) ; Expo Go exagère les lenteurs.

## Équilibrage
- Un joueur expérimenté est très puissant en fin de région (équipement, talents, badges, auras) : les derniers biomes
  de chaque région se traversent en quelques minutes sans défaite. Laissé tel quel volontairement (2026-09-24) ; pistes :
  pente de boss plus raide (`BOSS_RAMP`), niveau/gènes des derniers boss, équipes de couverture.
- Hors ligne : XP et butin restent calculés sur l'étape 1 (seule la chasse aux chromatiques farme l'étape en cours).

## Contenu
- Sinnoh est la dernière région codée. Ajouter une région : voir `REGIONS.md`.
- Écarts connus, laissés tels quels : Togetic est Vol pur dans les données (Normal/Vol dans les jeux d'origine) ;
  la 1re zone de la Forêt de Jade (Kanto) n'a que 5 espèces normales ; Johto n'a pas de biome Feu (Salamèche et
  Héricendre sont à la Forêt Fourmillante et aux Prairies de Doré).

## À faire de l'utilisateur
- Tester le build APK (taille ~132 Mo, performances des listes).
