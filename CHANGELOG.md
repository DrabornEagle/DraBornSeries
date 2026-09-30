# Changelog

## 0.6.0 · 2026-09-30 · Android versionCode 1

- Fullscreen captions sit closer to the bottom, moving clear of visible controls and Android navigation safe areas. Normal portrait-player captions keep their existing position; Discover captions move 30 px lower. Android and web share the positions and caption clock.
- Colorful genre/info badges, gradient story and license cards, larger dedicated trailer/favorite/share actions and accessible icon tabs modernize series details while retaining every source/license attribution.
- Trailer playback uses published series metadata and the selected video orientation. Landscape trailers use the same repeated fullscreen rotate hint as episodes. Only an exact episode-media match reuses its Turkish caption clock; separate trailer edits never receive unrelated cues.
- Android avoids starting a newly loaded video while backgrounded. Fullscreen controls respect screen safe areas. Detail routes reset state per series; comments clear when the account changes and newly submitted pending comments appear immediately.
- Shared in-app privacy, terms/community rules and account deletion screens plus standalone, public HTML pages for Play Console. Confirmed account deletion also removes the application's registration metadata and local pending progress/photo data while preserving other apps' shared Auth identity.
- Explicit rules acceptance before registration/commenting, account-synced comment-author blocking and an unblock action in Settings. Profile photo selection discloses its public storage link.
- Native config pins compile/target API 36 and blocks unused camera, microphone, broad media/storage, advertising ID, overlay and vibration permissions. EAS production App Bundle configuration and an accurate Data safety inventory are prepared. No APK/AAB or Play submission was created; signed build, device tests and Console declarations remain release steps.
- Local validation: TypeScript, lint, 25 unit tests, web and Android JavaScript exports, plus native manifest/SDK introspection. CI verifies isolated database security and release metadata. See `docs/GOOGLE_PLAY.md`.

## 0.5.0 · 2026-09-30 · Android versionCode 1

- Android previews seek once per source and retain artwork until a decoded frame renders. Stable subscriptions prevent buffering events and parent rerenders from repeatedly resetting playback. Preview and player lifecycle follows foreground state.
- All normal video frames default to portrait 9:16. Only episodes explicitly marked landscape allow landscape fullscreen rotation; every fullscreen entry shows the reduced-motion-aware rotate animation again. Fullscreen fits the whole picture, preserves time and restores the prior orientation lock.
- Discover defaults to audible playback and retains the user's mute preference between scenes. Removed the premature timeout that discarded slow-loading videos. Browser autoplay denial offers tap-to-play; web previews support HLS.
- Discover includes all 18 published series/films regardless of orientation and starts each selected video halfway through its actual duration. Ending restarts at the midpoint; previewing does not overwrite full-episode watch progress.
- Turkish subtitles automatically appear in the player and Discover for Sintel, Elephants Dream, Cosmos Laundromat, Sprite Fright and all five Tears of Steel parts. Nine licensed WebVTT tracks contain 377 timed cues. Android/web share the SRT/WebVTT parser and caption clock; the player can disable captions. Sidecars are returned only after playback entitlement checks, and repeated Studio saves use episode/language uniqueness.
- Web timeline clicks use browser pointer coordinates instead of the native-only locationX field. Invalid seek values are ignored and the displayed time/captions update immediately on seek.
- Animated Google-color sign-in action and larger register/reset-password actions.
- Added 14 full open films, real artwork and 27 verified H.264/AAC files. Published catalog is now 18 films / 28 episodes. Exact sources/licenses live in the manifest; Agent 327 is unchanged and excluded from shortened looping previews.
- Studio repeated season/episode saves use their natural unique keys. Cloudflare tus uploads read bounded native byte ranges, retry lost acknowledgements, report progress and automatically bind verified UIDs when encoding finishes. Failed replacements preserve the prior playable asset; out-of-order callbacks cannot replace newer uploads.
- Deployed isolated upload tracking and catalog migrations, and dbs-api v12. Manual saves reject unready or failed replacements before changing the old video. Stream setup workflow configures server secrets/webhook, imports actual catalog files and verifies signing when account credentials exist. Account access remains blocked/missing; no Cloudflare UIDs are invented.
- Verification: typecheck, lint, unit tests, rollback SQL security tests, web export and Android JavaScript export. Physical Android rotation/decoder testing is pending. No APK was produced.
