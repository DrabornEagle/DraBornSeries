# Changelog

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
