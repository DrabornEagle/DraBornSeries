# DraBornSeries v0.4.0 · versionCode 1

Checkpoint: shared Android/Web sources, Expo Go 58. No APK generated.

Implemented: one-video-per-gesture Discover, no up/down controls, horizontal featured swipe, real account activity counters, modern error popup, dynamic Help version, fullscreen viewport sizing, device profile photos (registration optional), isolated avatar bucket, owner-only atomic published-series deletion with explicit title confirmation and retained financial/audit records.

Catalog: all six legacy demo records removed. Original portrait animation series Neon Postası (5×24 s) and Yıldız Tohumu (3×24 s), 540×960, Turkish integrated captions and original music, public test CDN. Reproducible sources and metadata in scripts/render-original-series.py and docs/original-series.json.

Verification: TypeScript, lint, gesture/domain tests, web/Android exports; transaction rollback database tests cover photo RLS, unauthorized deletion, wrong confirmation, published-series cascade, retry idempotency, financial records, reports/audit, counted play deduplication, wallet/purchase/session protections. Physical Expo Go swipe/photo/fullscreen behavior should be checked on the user's phone.

External production integrations (Cloudflare account/Stream/R2/Workers, Google OAuth, Google Play Billing/RTDN/refunds, AdMob SSV, push) still require the owner's account configuration. docs/OWNER_SETUP_TR.md contains the setup steps. Chrome's fullscreen exit notice is browser-controlled and cannot be disabled by this application.
