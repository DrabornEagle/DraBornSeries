# Production integrations

These source adapters do **not** mean the production services are connected. The Expo Go release keeps store products inactive. Never enable products until RTDN/refund lifecycle tests, native Billing and Play Console setup pass.

## Cloudflare R2 · v0.7

New media uses the owner's existing R2 Worker at `https://drabornseries.draborneagle.workers.dev`. R2 account: `073b0f4e7f33bf2ce56fe8f60dbe6067`. The S3 API is for authenticated bucket uploads, not a browser/Android playback URL. No R2 access key belongs in the application.

Upload video files into a series folder in R2. Studio accepts a key such as `Dizi Adı/Bolum-01.mp4` or that Worker's `/media/` URL. One series editor handles series/artwork/episodes/access/status, verifies each R2 object and detects duration before saving the whole change atomically. Published free episodes use the same web/native player, subtitle tracks, progress and fullscreen behavior as existing episodes. Series direction propagates to all current and future episodes. Existing catalog assets and Stream compatibility remain intact.

`cloudflare/r2-worker.js` is a standalone module for the existing Worker. It detects the existing R2 binding, checks editor privileges for folder listing/preview, resolves published free/entitled playback via Supabase RPC, signs media URLs, streams byte ranges and provides CORS. Paid/VIP imports are refused while the Worker exposes public unsigned files. Signing is bearer access with a two-hour expiry, not DRM. Disable any separate public bucket access before publishing paid media.

`scripts/configure-r2.mjs` in the service workflow uses `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit on the owner's account and optional `CLOUDFLARE_ACCOUNT_ID` (defaults to the supplied account). It preserves the existing bucket binding and secret bindings; a missing signing secret is generated inside the deployment process. `SUPABASE_ACCESS_TOKEN` separately enables API deploy through Actions. Without the account token the Worker step reports a pending deployment, rather than pretending the connection is complete. No videos are copied to Stream.

At implementation time the existing Worker serves the supplied MP4 and Range 206, but `/health` is plain text and no authenticated folder API is available. Manual file-key integration works for free videos; folder listing and protected playback become available after deploying the new module. Cloudflare's panel challenged this cloud browser, so its settings could not be changed through that panel. See [R2_SETUP.md](R2_SETUP.md) for the exact remaining account setup and usage.

## Turkish captions

The five current films with intelligible speech have licensed Turkish sidecars: Sintel, Elephants Dream, Cosmos Laundromat, Sprite Fright and Tears of Steel. `npm run prepare:subtitles` validates source timings and complete translations, emits nine WebVTT files and shifts/clamps Tears of Steel cues to the actual five episode cuts. Web export publishes them under `/DraBornSeries/media/subtitles/`. Source attribution and licenses are in `assets/subtitles/README.md` and each published WebVTT notice.

The isolated `drabornseries.dbs_subtitles` table stores one HTTPS track per episode/language. `dbs-api` resolves these only after episode-access checks. Native and web playback automatically select Turkish, keep captions synchronized through seeking/quality changes/fullscreen, and allow switching them off. Discover uses the same sidecars without recording preview progress as full-episode progress. Private R2 object keys are never exposed as caption URLs.

Speech recognition for future uploaded videos requires an actual transcription service; this release does not claim one is connected. Sound effects, grunts and Glass Half's fictional speech are not given invented translations.

## Google Play

Server verifier: `dbs-play-verify`. Secret `DBS_GOOGLE_SERVICE_ACCOUNT` must contain a Play-authorized service account JSON. Native Billing must set `obfuscatedAccountId = SHA256(Supabase user UUID)`. The verifier checks the authoritative product, purchase state, owning account, quantity and expiry. Atomic ledger operations prevent duplicate credit. Consumables are consumed after credit; subscriptions are acknowledged after grant. Pending purchases never grant entitlement.

Products: `dbs_coins_50`, `dbs_coins_100`, `dbs_coins_250`, `dbs_coins_500`, `dbs_coins_1000`, `dbs_coins_2500`, `dbs_vip_weekly`, `dbs_vip_monthly`, `dbs_vip_yearly`. The six coin cards show base plus proposed bonus amounts; the verified server catalog credits the configured total, once. No currency amount is hardcoded in the checkout; prices must come from Play Billing product details. All nine products are inactive until native Billing and lifecycle reconciliation work.

**Not yet connected:** native Billing (Expo Go cannot load it), Play products, Google service account, Pub/Sub RTDN with authenticated push, renewal and refund/chargeback reconciliation. The verifier must remain disabled until the lifecycle is complete; an initial verified purchase alone is not a complete billing system. No real checkout is exposed in this release.

## Rewarded ads

No client callback can add coins or unlock an ad episode. Before enabling ads, configure AdMob, add the native SDK in a development build, validate Google ECDSA SSV callbacks over the original signed query bytes, validate key id and timestamp, whitelist ad unit/reward type, map one-time server-issued nonces, and apply daily limits atomically. An ad completion simulation is intentionally not used. SSV and native ad integration are pending.

## Auth, push, links

Email Auth is active; the owner has connected Google OAuth. The first Google bootstrap imports the full email as username, full name and a validated Google avatar. Existing generated usernames are repaired on the next login; manual changes are retained. Shared Auth redirects, confirmations and SMTP are preserved. Google-generated account-access emails use the connected OAuth client's Google Auth Platform Branding configuration. Setting DraBornSeries and verifying/publishing that branding is an external account action, not a Supabase project-name or email-template change. See [R2_SETUP.md](R2_SETUP.md).

Remote push and native billing/ads require a development build, not Expo Go. Push token registration, delivery worker and notification retry queue are pending. In-app notifications work.

Web links use `?series=slug` / `?episode=uuid` to avoid GitHub Pages rewrite requirements. Android intent filters are ready; verified App Links require the eventual release signing certificate in the site's `.well-known/assetlinks.json`. The certificate cannot be invented before signing the application.

Primary references: https://docs.expo.dev/guides/in-app-purchases/ ; https://docs.expo.dev/versions/latest/sdk/video/ ; https://developer.android.com/google/play/billing/security ; https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/ ; https://developers.google.com/admob/android/ssv
