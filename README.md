# PokéLoot (V1)

RPG à combats automatiques avec les Pokémon de 1re génération : ton équipe se bat seule, tu gagnes en la préparant.
Projet personnel, non commercial.

## Lancer
```powershell
npm install
npx expo start -c        # puis scanner le QR avec Expo Go
```
APK : `eas build -p android --profile preview`

## Contenu de la V1
- Biome Forêt de Jade : 3 zones × 5 étapes × 3 vagues, 3 boss, l'arène d'Argenta (Pierre) et son badge.
- Combat automatique : 15 types réels (double type), capacités ordonnées, 5 statuts, animations PMD de profil.
- Capture après les vagues (3 Balls, boutique), Pokédex vus / capturés / chromatiques, évolutions par niveau.
- Objets tenus (3 emplacements, 7 raretés), recyclage en éclats, amélioration, fusion 3 → 1, panoplie Sylvestre.
- Talents par type (6 talents × 5 rangs, 3 paliers), auras d'équipe, pension (verger, entraînement, fouille ; 8 h max).
- Vitesse ×2 débloquée au badge.

## Tests
`npm test` : moteur de combat, objets, progression, et une simulation complète de la V1 par un joueur automatique.
