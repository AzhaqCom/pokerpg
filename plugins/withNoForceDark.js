/**
 * Empêche Android d'assombrir de force l'appli quand le mode sombre du téléphone est activé (« forcer le mode
 * sombre », mode sombre des applis Xiaomi/Samsung…) : le jeu a déjà ses propres couleurs sombres, et l'assombrissement
 * automatique faussait les couleurs claires (badge Électrik jaune devenu brun). Ajoute
 * `android:forceDarkAllowed="false"` au thème de l'appli. Natif : pris en compte au prochain `eas build`, pas dans Expo Go.
 */
const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

module.exports = function withNoForceDark(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:forceDarkAllowed',
      value: 'false',
      targetApi: '29',
    });
    return cfg;
  });
};
