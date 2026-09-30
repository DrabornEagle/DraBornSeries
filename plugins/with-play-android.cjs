const { withGradleProperties } = require("expo/config-plugins");
// Native builds must target API 36 (Android 16). Expo Go uses its own manifest.
module.exports = (config) => withGradleProperties(config, (mod) => {
  for (const key of ["android.compileSdkVersion", "android.targetSdkVersion"]) {
    mod.modResults = mod.modResults.filter((item) => item.type !== "property" || item.key !== key);
    mod.modResults.push({ type: "property", key, value: "36" });
  }
  return mod;
});
