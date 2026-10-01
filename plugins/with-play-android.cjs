const { withGradleProperties } = require("expo/config-plugins");
// React Native 0.88 builds against API 37; the app targets API 36.
module.exports = (config) => withGradleProperties(config, (mod) => {
  for (const key of ["android.compileSdkVersion", "android.targetSdkVersion"]) {
    mod.modResults = mod.modResults.filter((item) => item.type !== "property" || item.key !== key);
    mod.modResults.push({ type: "property", key, value: key === "android.compileSdkVersion" ? "37" : "36" });
  }
  return mod;
});
