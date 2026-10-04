# DraBornSeries v0.7.7.2 — version code 5

Weekly/monthly/yearly plan changes use the verified existing Google Play purchase token with product-level `with-time-proration` replacement. The same plan, pending payments, held/paused purchases, foreign receipts and a missing original token never launch another independent payment. The server serializes subscription writes per account, permits only linked replacements, and rejects late callbacks from replaced tokens.

The Google `testPurchase` receipt marker is copied to the read-only membership record. Five-minute weekly/monthly license-test renewals retain the actual verified expiry and show a clear test label. Production durations remain governed by Google Play, never a locally invented seven-day grant.

VIP checkout now has four compact benefits (1080p/4K, unlimited viewing, ad-free, Android + Web). Membership feature chips and restore/reload controls share a row. The existing Google Play subscribe CTA and VIP world section are preserved. Reward claim buttons are static. Profile Support opens the existing help route. Web/mobile metadata use v0.7.7.2 / code 5.

Local checks: TypeScript, ESLint, 83 JavaScript tests + caption queue Python test, web export and Android JS export passed. Release CI, isolated database tests, browser layout checks, production synchronization and owner-signed AAB verification are pending.
