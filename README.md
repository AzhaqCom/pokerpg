# PokéLoot

RPG mobile à combats automatiques : ton équipe de 3 se bat seule, tu joues la préparation (captures, objets,
fusion, talents, ordre des capacités, pension, évolutions à choix). Quatre régions : **Kanto, Johto, Hoenn et
Sinnoh** (493 Pokémon), avec un prestige (« nouveau départ ») d'une région à la suivante, puis une fin de jeu
(Tour de Combat infinie, Chromatique +N).
Projet personnel, non commercial (sprites PMD SpriteCollab CC BY-NC).

## Lancer
```powershell
npm install
npx expo start -c        # puis scanner le QR avec Expo Go
```
APK : `eas build -p android --profile preview` (projet EAS sur le compte `azhaq47`).

## Tests
```powershell
npm run typecheck
npx jest --testPathIgnorePatterns=balance.test.ts   # ~20 s, tests rapides
npx jest balance.test.ts                            # simulations de bout en bout, ~11 min
```

## Documentation
- `CLAUDE.md` : contexte, architecture et règles de jeu actuelles (à lire en premier).
- `SESSION_2026-10-01.md` : passation de la dernière session.
- `REGIONS.md` : fonctionnement des régions et comment en ajouter une.
- `IDEES.md` : pistes et ce qui reste à faire.
- `AUDIT_EQUILIBRAGE.md` : audit chiffré des Pokémon et des bonus (2026-09-24, mis à jour depuis en tête de fichier).
- `BIOMES.md` : plan de conception des biomes de Kanto (document historique, courbe de niveau toujours testée).
