const { withAppBuildGradle, withGradleProperties, withAndroidStyles, withMainActivity } = require("expo/config-plugins");
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
  config = withAndroidStyles(config, (mod) => {
    const themes = mod.modResults.resources.style;
    if (!themes.some((item) => item.$.name === "AppTheme")) throw Error("Android AppTheme is missing.");
    for (const theme of themes.filter((item) => ["AppTheme", "Theme.App.SplashScreen"].includes(item.$.name))) {
      const values = { "android:enforceNavigationBarContrast": "false", "android:navigationBarColor": "@android:color/transparent", "android:windowLightNavigationBar": "false" };
      theme.item = (theme.item || []).filter((item) => !(item.$.name in values));
      for (const [name, value] of Object.entries(values)) theme.item.push({ $: { name }, _: value });
    }
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    const marker = "// DraBornSeries transparent system navigation";
    if (!mod.modResults.contents.includes(marker)) {
      const point = "super.onCreate(null)";
      if (!mod.modResults.contents.includes(point)) throw Error("Android onCreate hook is missing.");
      mod.modResults.contents = mod.modResults.contents.replace(point, point + `
    ${marker}
    @Suppress("DEPRECATION")
    window.navigationBarColor = android.graphics.Color.TRANSPARENT
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    androidx.core.view.WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = false`);
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
