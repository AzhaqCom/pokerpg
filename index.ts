import { registerRootComponent } from 'expo';
import { installGlobalErrorHandler } from './src/ui/CrashScreen';

// En cas d'erreur JS, afficher un écran d'erreur au lieu de fermer l'app.
installGlobalErrorHandler();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const App = require('./App').default;
registerRootComponent(App);
