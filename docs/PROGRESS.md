# DraBornSeries progress

2026-09-29 — v0.2.0 Miami / vertical early-access update.

- Authenticated `draborneagle@gmail.com` admin after owner-role and requested password repair; verified a real login and `dbs_is_admin()` result without saving a password to the repo.
- Redesigned header, bottom navigation, animated splash, authentication collage, home hero and Rails, Store/VIP/wallet/rewards/profile screens. The original neon logo and new BornCoins art are owned assets.
- Replaced published horizontal demos with four Pexels-licensed portrait demo collections containing eight 720×1280 MP4 scenes; old records archived without deleting any watch/unlock history. Source URLs and license are documented separately.
- Added silent 7-second previews with pause when hidden, scrolling portrait Discover feed, direct “Tümünü izle”, rewards modal, profile preview/auto-unlock preferences.
- Added six configured coin packages (base plus bonus), weekly/monthly/yearly VIP catalog cards with disabled purchase UI until Play Billing, and welcome/favorite/profile reward claims enforced by Supabase wallet locks and once-only ledger references.
- Applied isolated `dbs_vertical_store_rewards` migration remotely. Database transaction/security test passed including duplicate/uneared task denial and all existing RLS/ledger/account tests. App typecheck, lint, web build and Android JS export are the release gates.
- GitHub and live web deployment commit/results are recorded after publication. Remaining third-party production connections are in `INTEGRATIONS.md`.

2026-09-29 — v0.1.0 early access foundation.

- GitHub repository was empty.
- Found dbs_ naming collision with DraBornStyle in the shared project; created isolated `drabornseries` and `dbs_series_private` schemas.
- Deployed 59 tables with RLS, safe RPC wrappers, account controls, ledger, scheduled publishing, sample catalog.
- Deployed `dbs-api` and disabled-until-configured `dbs-play-verify`.
- Auth email enabled; Google provider disabled in existing settings. Did not change shared auth configuration.
- SQL transaction tests passed: duplicate daily claim, coin unlock idempotency, stale progress rejection, wallet mutation denial, fake purchase denial, protected profile columns, RLS isolation, session revocation. All SQL fixtures rolled back.
- App TypeScript, unit, lint, exports and browser validation are tracked in the final verification update.
- Production blockers and unfinished full-plan features are documented in FEATURE_STATUS.md and INTEGRATIONS.md.
