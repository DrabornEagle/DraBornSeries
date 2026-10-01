const { expo } = require("./app.json");
// Production AdMob IDs belong in build environment variables, not source edits.
module.exports = () => {
  const test = process.env.EXPO_PUBLIC_ADMOB_TEST_MODE !== "false";
  const appId = process.env.EXPO_PUBLIC_ADMOB_APP_ID;
  if (!test && (!appId || !/^ca-app-pub-\d{16}~\d{10}$/.test(appId))) throw Error("Production AdMob requires EXPO_PUBLIC_ADMOB_APP_ID.");
  return { ...expo, extra: { ...expo.extra, admobTestMode: test }, plugins: expo.plugins.map(plugin => Array.isArray(plugin) && plugin[0] === "react-native-google-mobile-ads" ? [plugin[0], { ...plugin[1], ...(appId ? { androidAppId: appId } : {}) }] : plugin) };
};
