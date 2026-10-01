const { withGradleProperties } = require("expo/config-plugins");
// React Native 0.88 builds against API 37; the app targets API 36.
module.exports = (config) => withGradleProperties(config, (mod) => {
  const properties = {
    "android.compileSdkVersion": "37",
    "android.targetSdkVersion": "36",
    // Explicitly select the classic AdMob SDK. v17.2.0's app-json.gradle
    // leaves googleMobileAdsJson undefined in Expo projects without a root
    // react-native-google-mobile-ads block; this supported selector avoids
    // that fallback while the Expo plugin supplies the application ID.
    "RNGMA_ANDROID_BACKEND": "classic",
  };
  for (const [key, value] of Object.entries(properties)) {
    mod.modResults = mod.modResults.filter((item) => item.type !== "property" || item.key !== key);
    mod.modResults.push({ type: "property", key, value });
  }
  return mod;
});
