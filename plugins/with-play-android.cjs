const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");
// React Native 0.88 builds against API 37; the app targets API 36.
module.exports = (config) => {
  config = withGradleProperties(config, (mod) => {
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
  return withAppBuildGradle(config, (mod) => {
    const marker = "// DraBornSeries WorkManager release startup fix";
    // GMA still pulls WorkManager 2.7 / Room 2.2.5, whose reflective
    // WorkDatabase fails with AGP 9's release optimizer before React starts.
    // Use the corrected AndroidX dependency and retain normal R8 shrinking.
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += `
${marker}
dependencies {
    implementation("androidx.work:work-runtime:2.11.2")
}
`;
    return mod;
  });
};
