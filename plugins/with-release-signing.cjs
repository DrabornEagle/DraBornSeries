const { withAppBuildGradle } = require("expo/config-plugins");
module.exports = config => withAppBuildGradle(config, mod => {
  const marker = "// DraBornSeries private release signing";
  if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += `
${marker}
if (System.getenv("DBS_RELEASE_STORE_FILE")) {
    android.signingConfigs.create("drabornRelease") {
        storeFile file(System.getenv("DBS_RELEASE_STORE_FILE"))
        storePassword System.getenv("DBS_RELEASE_STORE_PASSWORD")
        keyAlias System.getenv("DBS_RELEASE_KEY_ALIAS")
        keyPassword System.getenv("DBS_RELEASE_KEY_PASSWORD")
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.drabornRelease
} else if (gradle.startParameter.taskNames.any { it.toLowerCase().contains("release") }) {
    throw new GradleException("DraBornSeries release keystore is required; debug signing is forbidden.")
}
`;
  return mod;
});
