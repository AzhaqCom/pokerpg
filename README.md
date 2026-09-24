# PokéLoot

RPG mobile à combats automatiques : ton équipe de 3 se bat seule, tu joues la préparation (captures, objets,
fusion, talents, ordre des capacités, pension, évolutions à choix). Quatre régions : **Kanto, Johto, Hoenn et
Sinnoh** (493 Pokémon), avec un prestige (« nouveau départ ») d'une région à la suivante.
Projet personnel, non commercial (sprites PMD SpriteCollab CC BY-NC).

## Lancer
```powershell
npm install
npx expo start -c        # puis scanner le QR avec Expo Go
```
APK : `eas build -p android --profile preview`

## Tests
```powershell
npm run typecheck
npx jest --testPathIgnorePatterns=balance.test.ts   # ~20 s, tests rapides
npx jest balance.test.ts                            # simulations de bout en bout, plusieurs minutes
```

## Documentation
- `CLAUDE.md` : contexte, architecture et règles de jeu actuelles (à lire en premier).
- `REGIONS.md` : fonctionnement des régions et comment en ajouter une.
- `BIOMES.md` : plan de conception des biomes de Kanto et notes par région.
- `IDEES.md` : pistes et ce qui reste à faire.
- `HISTORIQUE.md` : archive des sessions passées (ne reflète pas l'état courant).
