# DraBornSeries v0.7.7.2 — version code 5

Weekly/monthly/yearly plan changes use the verified existing Google Play purchase token with product-level `with-time-proration` replacement. The same plan, pending payments, held/paused purchases, foreign receipts and a missing original token never launch another independent payment. The server serializes subscription writes per account, permits only linked replacements, and rejects late callbacks from replaced tokens.

The Google `testPurchase` receipt marker is copied to the read-only membership record. Five-minute weekly/monthly license-test renewals retain the actual verified expiry and show a clear test label. Production durations remain governed by Google Play, never a locally invented seven-day grant.

VIP checkout now has four compact benefits (1080p/4K, unlimited viewing, ad-free, Android + Web). Membership feature chips and restore/reload controls share a row. The existing Google Play subscribe CTA and VIP world section are preserved. Reward claim buttons are static. Profile Support opens the existing help route. Web/mobile metadata use v0.7.7.2 / code 5.

Validation completed:

- [Application, Edge and database CI](https://github.com/DrabornEagle/DraBornSeries/actions/runs/37168327198): TypeScript, ESLint, 83 JavaScript tests, caption queue Python test, web/Android JS exports and nine SQL suites passed. Twelve 393×851 browser screenshots, zero page errors and no horizontal overflow cover same-plan blocking, replacement preview, static reward claims, single-row chips/tools, test periods, support, restore and coin cards. Two follow-up commits changed only browser selectors for decorative icons and duplicate background text.
- [Native release validation](https://github.com/DrabornEagle/DraBornSeries/actions/runs/37167909086) passed. Embedded Hermes package opened on Android API 36, rendered real R2 video and advanced playback at 01:34:49 UTC; official AdMob rewarded test ad loaded/opened at 01:35:18 UTC. [Expo Go playback](https://github.com/DrabornEagle/DraBornSeries/actions/runs/37167909098) passed as well.
- Production migration and rollback-only security fixtures passed. `dbs-api` v53 (13 files), `dbs-play-verify` v16 (7 files), and `dbs-play-rtdn` v10 (6 files) match the committed deployed files exactly. Health/settings show 0.7.7.2 / code 5; all nine products remain active. All three existing Play subscriptions carry the verified test marker. Unauthenticated billing/verification/RTDN calls return 401. Client subscription writes remain denied.
- [Web sync](https://github.com/DrabornEagle/DrabornEagle_Web/actions/runs/37167974761) and [Pages publication](https://github.com/DrabornEagle/DrabornEagle_Web/actions/runs/37168032875) passed. Live source is `fda9f4995a0984b63d9dcad8c16775303105907d`, identical to the native release's application source. The live JavaScript contains the new test label, replacement, compact benefits, restore tools and support route.
- `DraBornSeries-v0.7.7.2-release.aab`: 40,222,787 bytes, versionName 0.7.7.2, versionCode 5, package `com.draborneagle.drabornseries`, minSdk 24, targetSdk 36. Owner-uploaded key matches the pinned certificate. Strict JAR verification and bundletool validation passed. All 1,621 non-signature compiled entries equal the CI bundle, including embedded Hermes. All 36 native libraries use at least 16 KiB ELF alignment; bundle configuration explicitly requests PAGE_ALIGNMENT_16K for arm64-v8a/x86_64.

AAB SHA-256: `9639120049a2b235beda0b995aac3fc4f7951befcddca5da9452ea303a3f1f5c`.
Upload certificate SHA-256: `ad35ced92a96551d972e2c44d4e9c34985a76528631c75a520981cc0f88f8ead`.

No new paid Google Play purchase was made during automated verification; actual checkout confirmation remains with the user's Play account. APK was used internally for emulator validation; only the requested signed AAB is delivered.
