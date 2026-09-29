# Media sources

`assets/icons/icon.png` — original generated neon S/play ribbon icon. Built-in image generation prompt: original centered S-shaped ribbon with play cutout, magenta/purple/orange gradient, near-black background, no text, no existing brand.

`assets/posters/gece-hatti.png` — original generated fictional concept artwork. Built-in generation prompt: young adult fictional woman and man on a rainy coastal boulevard at midnight; neon magenta/purple/orange, atmospheric space for UI title; no text or existing property. A concept image is not a released film.

`assets/icons/reward.png` — original generated purple gift chest, hot pink ribbon, and gold BornCoins for the reward UI. No other app's artwork is used.

Unreleased concept backgrounds remain separate from playable films. The v0.4 catalog removes the old Blender and Pexels video records.

Playable test films are two **original procedural 2D animation micro-series**: Neon Postası (5 episodes) and Yıldız Tohumu (3 episodes). Every episode is authored at 540×960 (9:16), 24 fps, 24 seconds, H.264/AAC with Turkish integrated story captions and original synthesized music. They are normal vector animations, not AI-generated/live-action films or stock clip compilations.

Stories, characters, artwork and audio are reproducible from `scripts/render-original-series.py`. Sources and published test-media URLs are recorded in `original-series.json`. Videos and frame thumbnails are uploaded to the connected media CDN; large video binaries are neither in GitHub nor Supabase Storage. These public test assets are not protected commercial Cloudflare streams. The production Cloudflare Worker integration remains separate.

Avatar photos use the isolated `dbs_series_avatars` bucket, JPEG only, 2 MB limit; the client prepares 512×512 images. Each account may write only its own `user_id/avatar.jpg` object. Avatars are public profile pictures.
