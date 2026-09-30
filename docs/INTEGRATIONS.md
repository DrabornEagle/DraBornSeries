# Production integrations

These source adapters do **not** mean the production services are connected. The Expo Go release keeps store products inactive. Never enable products until RTDN/refund lifecycle tests, native Billing and Play Console setup pass.

## Cloudflare

v0.5 uses the authenticated `dbs-api` as the upload, reconciliation and signed playback backend. In the DraBornSeries GitHub repository's `production` environment, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (account-scoped Stream Edit) and `SUPABASE_ACCESS_TOKEN` enable the automatic service workflow. `scripts/configure-stream.mjs` installs server secrets, configures the signed webhook when available, copies verified catalog sources to Stream, records real returned UIDs and waits for encoding. Another application's webhook is preserved; Studio polling provides reconciliation instead. Credentials never enter source or client bundles.

After the account is connected, select an episode and a local video in Studio. The resumable tus uploader reports progress; encoding is checked automatically, and the completed signed video is bound to the episode without copying a UID by hand. A failed or still-processing replacement keeps the previously playable asset. Manual UID saves also require a signed, ready asset. The episode's selected portrait/landscape direction is preserved.

Current account state: `cloudflare=false`, `uploads=false`, `webhook=false`, with no real Stream UIDs. Account access is unavailable and the Cloudflare panel is blocked at browser security verification. The 18-film test catalog plays from verified public media sources. Automatic setup cannot run without account credentials.

The Worker below remains an optional separate playback gateway. Direct signed playback through `dbs-api` supports the v0.5 Studio flow without requiring `DBS_WORKER_URL` or `STREAM_CUSTOMER_CODE`. R2 source/subtitle ingest is a separate pending integration.

`cloudflare/workers/src/index.ts` validates the Supabase user and `dbs_episode_access`, limits requests per user, checks Stream `requireSignedURLs`, and signs a 30 minute HLS URL. Permanent Cloudflare video IDs stay in the protected `dbs_video_assets` table. R2 is for private source media, posters and subtitle ingest; no raw paid-video R2 public URL belongs in the client.

Required Worker secrets: `SUPABASE_SECRET_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `STREAM_CUSTOMER_CODE`. Set `DBS_WORKER_URL` in Supabase Edge secrets after deploying the Worker. Configure allowed origins on each Stream asset. Native apps have no Origin header, so Origin is an additional browser control, never the authorization mechanism.

Full DRM and screenshot prevention are not provided. Signed tokens remain bearer credentials until expiry. Test HLS refresh for any episode approaching 30 minutes before publishing it. R2 upload UI and private subtitle URL issuance are pending.

## Google Play

Server verifier: `dbs-play-verify`. Secret `DBS_GOOGLE_SERVICE_ACCOUNT` must contain a Play-authorized service account JSON. Native Billing must set `obfuscatedAccountId = SHA256(Supabase user UUID)`. The verifier checks the authoritative product, purchase state, owning account, quantity and expiry. Atomic ledger operations prevent duplicate credit. Consumables are consumed after credit; subscriptions are acknowledged after grant. Pending purchases never grant entitlement.

Products: `dbs_coins_50`, `dbs_coins_100`, `dbs_coins_250`, `dbs_coins_500`, `dbs_coins_1000`, `dbs_coins_2500`, `dbs_vip_weekly`, `dbs_vip_monthly`, `dbs_vip_yearly`. The six coin cards show base plus proposed bonus amounts; the verified server catalog credits the configured total, once. No currency amount is hardcoded in the checkout; prices must come from Play Billing product details. All nine products are inactive until native Billing and lifecycle reconciliation work.

**Not yet connected:** native Billing (Expo Go cannot load it), Play products, Google service account, Pub/Sub RTDN with authenticated push, renewal and refund/chargeback reconciliation. The verifier must remain disabled until the lifecycle is complete; an initial verified purchase alone is not a complete billing system. No real checkout is exposed in this release.

## Rewarded ads

No client callback can add coins or unlock an ad episode. Before enabling ads, configure AdMob, add the native SDK in a development build, validate Google ECDSA SSV callbacks over the original signed query bytes, validate key id and timestamp, whitelist ad unit/reward type, map one-time server-issued nonces, and apply daily limits atomically. An ad completion simulation is intentionally not used. SSV and native ad integration are pending.

## Auth, push, links

Email Auth is active. Google provider was disabled in the shared Supabase project's settings when verified. Add a Google OAuth client and allow web and native callback URLs without removing other apps' redirects. Email confirmations and SMTP are shared project settings; this change does not alter them.

Remote push and native billing/ads require a development build, not Expo Go. Push token registration, delivery worker and notification retry queue are pending. In-app notifications work.

Web links use `?series=slug` / `?episode=uuid` to avoid GitHub Pages rewrite requirements. Android intent filters are ready; verified App Links require the eventual release signing certificate in the site's `.well-known/assetlinks.json`. The certificate cannot be invented before signing the application.

Primary references: https://docs.expo.dev/guides/in-app-purchases/ ; https://docs.expo.dev/versions/latest/sdk/video/ ; https://developer.android.com/google/play/billing/security ; https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/ ; https://developers.google.com/admob/android/ssv
