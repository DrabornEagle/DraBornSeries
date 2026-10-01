import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { assertPlayableStream, naturalConflict, streamUID, verifyStreamWebhook } from "./stream.ts";
import { publicSubtitleTracks } from "./subtitles.ts";
import { verifyCaptionRunner } from "./caption-auth.ts";
import { validateAutoVtt } from "./captions.ts";
import { resolveTrailer } from "./trailer.ts";
import { workerDefault, mediaUrl, normalizeR2Key, probeR2, r2Playback, workerCapabilities } from "./r2.ts";
const env = (key: string) => Deno.env.get(key) || "";
const admin = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { db: { schema: "drabornseries" }, auth: { persistSession: false } },
);
const origins = [
  "https://www.draborneagle.com",
  "https://draborneagle.com",
  "http://localhost:8081",
  "http://localhost:8082",
];
function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "Access-Control-Allow-Origin": origins.includes(origin)
      ? origin
      : "https://www.draborneagle.com",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "X-Content-Type-Options": "nosniff",
  };
}
const send = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: headers(req) });
const checked = async (result: any) => {
  const { data, error } = await result;
  if (error) throw Error(error.message);
  return data;
};
const streamConfigured = () => !!env("CLOUDFLARE_ACCOUNT_ID") && !!env("CLOUDFLARE_API_TOKEN");
const r2Base = () => env("DBS_R2_WORKER_URL") || workerDefault;
const cfBase = () => `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/stream`;
const cfHeaders = () => ({ Authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}`, "Content-Type": "application/json" });
async function getStreamVideo(uid: string) {
  const response = await fetch(cfBase() + "/" + uid, { headers: cfHeaders() });
  const data = await response.json();
  if (!response.ok || !data.success) throw Error("STREAM_STATUS_FAILED");
  return data.result;
}
async function reconcileVideo(video: any) {
  return checked(admin.rpc("dbs_complete_stream_upload", { upload_uid: video.uid, details: video }));
}
async function subtitleTracks(episode: string) {
  const tracks = await checked(admin.from("dbs_subtitles").select("language,label,asset_key").eq("episode_id", episode).order("language"));
  return publicSubtitleTracks(await Promise.all(tracks.map(async (track: any) => {
    if (!/^dbs-auto\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.vtt$/.test(track.asset_key)) return track;
    const result = await admin.storage.from("dbs-auto-subtitles").createSignedUrl(track.asset_key.slice(9), 7200);
    if (result.error || !result.data?.signedUrl) return { ...track, asset_key: "" };
    return { ...track, asset_key: result.data.signedUrl };
  })));
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST")
    return send(req, { error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    if (Number(req.headers.get("content-length") || 0) > 450000)
      return send(req, { error: "BODY_TOO_LARGE" }, 413);
    const raw = await req.text();
    if (raw.length > 450000) return send(req, { error: "BODY_TOO_LARGE" }, 413);
    if (req.headers.has("Webhook-Signature")) {
      if (!(await verifyStreamWebhook(raw, req.headers.get("Webhook-Signature")!, env("DBS_STREAM_WEBHOOK_SECRET"))))
        return send(req, { error: "INVALID_WEBHOOK_SIGNATURE" }, 401);
      const video = JSON.parse(raw);
      if (!streamUID(video.uid)) return send(req, { error: "INVALID_STREAM_UID" }, 400);
      await reconcileVideo(video);
      return send(req, { received: true });
    }
    const body = JSON.parse(raw);
    const authorization = req.headers.get("authorization") || "";
    if (["caption-jobs", "caption-complete"].includes(body.action)) {
      try { await verifyCaptionRunner(authorization); } catch { return send(req, { error: "INVALID_RUNNER" }, 401); }
      if (body.action === "caption-jobs") {
        for (let attempt = 0; attempt < 6; attempt++) {
        const job = await checked(admin.rpc("dbs_claim_caption"));
        if (!job) return send(req, { job: null });
        try {
          const asset = await checked(admin.from("dbs_video_assets").select("r2_key").eq("episode_id", job.episode_id).eq("provider", "r2").maybeSingle());
          if (asset?.r2_key !== job.source_key) {
            await checked(admin.rpc("dbs_finish_caption", { job_id: job.id, lease: job.lease_id, outcome: "no_speech", language: "" }));
            continue;
          }
          const episode = await checked(admin.from("dbs_episodes").select("duration_seconds,status,publish_at,access_type,dbs_series!inner(status)").eq("id", job.episode_id).single());
          const capabilities = await workerCapabilities(r2Base());
          let probe: any;
          if (capabilities.serviceProbe) {
            probe = await probeR2(normalizeR2Key(job.source_key, r2Base()), "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"), r2Base(), true, env("SUPABASE_SERVICE_ROLE_KEY"));
          } else if (job.preview_url && new Date(job.preview_until).getTime() > Date.now() + 30000
            && new URL(job.preview_url).origin === new URL(r2Base()).origin && normalizeR2Key(job.preview_url, r2Base()) === job.source_key) {
            probe = { url: job.preview_url };
          } else if (episode.access_type === "free" && episode.status === "published" && episode.dbs_series.status === "published" && new Date(episode.publish_at) <= new Date()) {
            probe = await r2Playback(job.episode_id, job.source_key, "", "free", r2Base());
          } else throw Error("R2_BACKEND_PROBE_UPDATE_REQUIRED");
          return send(req, { job: { id: job.id, lease: job.lease_id, episode: job.episode_id, url: probe.url, duration: episode.duration_seconds } });
        } catch (error) {
          await checked(admin.rpc("dbs_finish_caption", { job_id: job.id, lease: job.lease_id, outcome: "failed", language: "", cause: error instanceof Error && error.message === "R2_BACKEND_PROBE_UPDATE_REQUIRED" ? "R2_WORKER_UPDATE_REQUIRED" : "Video bağlantısı hazırlanamadı." }));
          continue;
        }
        }
        return send(req, { job: null });
      }
      if (!["completed", "no_speech", "failed"].includes(body.outcome) || !/^[a-f0-9-]{36}$/.test(body.id || "") || !/^[a-f0-9-]{36}$/.test(body.lease || "")) return send(req, { error: "INVALID_CAPTION" }, 400);
      const job = await checked(admin.from("dbs_auto_subtitle_jobs").select("*").eq("id", body.id).single());
      if (job.status !== "processing" || job.lease_id !== body.lease || new Date(job.lease_until) < new Date()) return send(req, { error: "CAPTION_LEASE_EXPIRED" }, 409);
      let objectKey: string | undefined;
      if (body.outcome === "completed") {
        const episode = await checked(admin.from("dbs_episodes").select("duration_seconds").eq("id", job.episode_id).single());
        const duration = Number(body.duration || episode.duration_seconds);
        if (!(duration > 0 && duration <= 7200)) return send(req, { error: "INVALID_CAPTION" }, 400);
        const vtt = validateAutoVtt(body.vtt, duration);
        objectKey = job.episode_id + "/" + job.id + ".vtt";
        const result = await admin.storage.from("dbs-auto-subtitles").upload(objectKey, new TextEncoder().encode(vtt), { contentType: "text/vtt", upsert: true });
        if (result.error) throw Error("CAPTION_UPLOAD_FAILED");
      }
      const mediaBlocked = body.outcome === "failed" && body.cause === "R2_DOWNLOAD_BLOCKED";
      const result = await checked(admin.rpc("dbs_finish_caption", { job_id: job.id, lease: body.lease, outcome: body.outcome,
        language: typeof body.language === "string" ? body.language.slice(0, 20) : "", actual_duration: Number(body.duration) > 0 && Number(body.duration) <= 7200 ? Math.ceil(Number(body.duration)) : null, cause: mediaBlocked ? "R2_DOWNLOAD_BLOCKED" : body.outcome === "failed" ? "Otomatik altyazı hazırlanamadı. Stüdyo’dan yeniden deneyebilirsin." : null }));
      if (mediaBlocked) await checked(admin.from("dbs_auto_subtitle_jobs").update({ attempts: 3 }).eq("id", job.id).eq("status", "failed"));
      if (["completed", "no_speech", "manual", "superseded"].includes(result.status)) await checked(admin.from("dbs_auto_subtitle_jobs").update({ preview_url: null, preview_until: null }).eq("id", job.id));
      if (objectKey && result.status !== "completed") await admin.storage.from("dbs-auto-subtitles").remove([objectKey]);
      return send(req, result);
    }
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      db: { schema: "drabornseries" },
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
    } = authorization ? await client.auth.getUser() : { data: { user: null } };
    if (body.action === "health")
      return send(req, {
        ok: true,
        version: "0.7.2",
        versionCode: 1,
        cloudflare: streamConfigured(),
        worker: !!env("DBS_WORKER_URL"),
        uploads: streamConfigured(),
        webhook: !!env("DBS_STREAM_WEBHOOK_SECRET"),
        video_provider: "r2",
        r2_worker: r2Base(),
        billing: !!env("DBS_GOOGLE_SERVICE_ACCOUNT"),
        ads: true,
        ads_mode: env("DBS_ADMOB_MODE") === "production" && !!env("DBS_ADMOB_AD_UNIT") ? "production" : "test",
        billing_integration: "google_play",
      });
    if (body.action === "ads-config") return send(req, { mode: env("DBS_ADMOB_MODE") === "production" && !!env("DBS_ADMOB_AD_UNIT") ? "production" : "test", rewardedUnit: env("DBS_ADMOB_AD_UNIT") || null });
    if (["billing-account", "ad-ticket", "ad-status"].includes(body.action)) {
      if (!user) return send(req, { error: "AUTH_REQUIRED" }, 401);
      const profile = await checked(client.from("dbs_profiles").select("user_id,status").eq("user_id", user.id).maybeSingle());
      if (!profile || profile.status !== "active") return send(req, { error: "ACCOUNT_UNAVAILABLE" }, 403);
      if (body.action === "billing-account") {
        const accountId = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.id)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
        return send(req, { accountId, configured: !!env("DBS_GOOGLE_SERVICE_ACCOUNT"), package: "com.draborneagle.drabornseries" });
      }
      if (body.action === "ad-status") {
        if (!/^[a-f0-9-]{36}$/.test(body.id || "")) return send(req, { error: "INVALID_AD_TICKET" }, 400);
        const ticket = await checked(admin.from("dbs_ad_tickets").select("status,coins,episode_id").eq("id", body.id).eq("user_id", user.id).single());
        return send(req, { status: ticket.status, coins: ticket.status === "completed" ? ticket.coins : 0, unlocked: ticket.status === "completed" && !!ticket.episode_id });
      }
      if (env("DBS_ADMOB_MODE") !== "production" || !/^ca-app-pub-\d+\/\d+$/.test(env("DBS_ADMOB_AD_UNIT"))) return send(req, { error: "ADS_TEST_MODE" }, 409);
      if (body.episode) {
        if (!/^[a-f0-9-]{36}$/.test(body.episode)) return send(req, { error: "INVALID_EPISODE" }, 400);
        const episode = await checked(admin.from("dbs_episodes").select("access_type,status,publish_at,dbs_series!inner(status)").eq("id", body.episode).single());
        if (episode.access_type !== "ad" || episode.status !== "published" || episode.dbs_series.status !== "published" || new Date(episode.publish_at).getTime() > Date.now()) return send(req, { error: "EPISODE_UNAVAILABLE" }, 409);
        if (await checked(client.rpc("dbs_episode_access", { episode: body.episode }))) return send(req, { error: "ALREADY_UNLOCKED" }, 409);
      }
      const pending = await checked(admin.from("dbs_ad_tickets").select("id").eq("user_id",user.id).eq("status","pending").gte("created_at",new Date(Date.now()-300000).toISOString()).limit(3));
      if (pending.length>=3) return send(req,{error:"AD_RATE_LIMIT"},429);
      const date = new Date(Date.now()+10800000).toISOString().slice(0,10);
      const earned = await checked(admin.from("dbs_ad_events").select("transaction_id").eq("user_id",user.id).eq("reward_date",date).limit(5));
      if (earned.length>=5) return send(req,{error:"AD_DAILY_LIMIT"},409);
      const ticket = await checked(admin.from("dbs_ad_tickets").insert({user_id:user.id,episode_id:body.episode||null,coins:body.episode?0:3,ad_unit:env("DBS_ADMOB_AD_UNIT").split("/").at(-1)}).select("id").single());
      return send(req,ticket);
    }
    if (body.action === "trailer") {
      if (typeof body.series !== "string") return send(req, { error: "INVALID_SERIES" }, 400);
      const series = await checked(admin.from("dbs_series").select("id,status,is_demo,trailer_url,source_credit,video_orientation,r2_trailer_key").eq("id", body.series).single());
      if (series.status !== "published" || !/^https:\/\//i.test(series.trailer_url || ""))
        return send(req, { error: "TRAILER_UNAVAILABLE" }, 404);
      const episodes = await checked(admin.from("dbs_episodes").select("id,orientation,number").eq("series_id", series.id)
        .eq("status", "published").lte("publish_at", new Date().toISOString()).order("number"));
      const allAssets = episodes.length ? await checked(admin.from("dbs_video_assets").select("episode_id,demo_url,renditions,landscape_renditions,r2_key,provider")
        .in("episode_id", episodes.map((episode: any) => episode.id)).eq("ready", true)) : [];
      const assets = allAssets.map((asset: any) => ({ ...asset, demo_url: asset.provider === "r2" ? mediaUrl(asset.r2_key, r2Base()) : asset.demo_url }));
      const resolved = resolveTrailer(series.trailer_url, episodes, assets, series.video_orientation || series.source_credit?.trailer_orientation);
      if (!resolved) return send(req, { error: "TRAILER_UNAVAILABLE" }, 404);
      // Reuse captions only when the trailer is exactly that episode's media.
      // A separate edit has a different clock and must never inherit those cues.
      const subtitles = resolved.matchedEpisodeId ? await subtitleTracks(resolved.matchedEpisodeId) : [];
      let trailerUrl = series.trailer_url;
      const landscapeAsset = allAssets.find((asset: any) => asset.episode_id === resolved.matchedEpisodeId);
      if (series.video_orientation === "landscape" && landscapeAsset?.landscape_renditions?.length) trailerUrl = landscapeAsset.landscape_renditions.at(-1).url;
      const isR2 = new URL(trailerUrl).origin === new URL(r2Base()).origin;
      if (isR2 && (await workerCapabilities(r2Base())).privateMedia) {
        const response = await fetch(r2Base() + "/trailer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ series: series.id }), signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!response.ok || !result.url) throw Error("TRAILER_UNAVAILABLE");
        trailerUrl = result.url;
      }
      return send(req, { url: trailerUrl, provider: isR2 ? "r2" : series.is_demo ? "demo" : "cloudflare", subtitles,
        qualities: series.video_orientation === "landscape" && landscapeAsset?.landscape_renditions?.length ? landscapeAsset.landscape_renditions : resolved.qualities, orientation: resolved.orientation });
    }
    if (body.action === "playback") {
      if (typeof body.episode !== "string")
        return send(req, { error: "INVALID_EPISODE" }, 400);
      const episode = await checked(
        admin
          .from("dbs_episodes")
          .select("*,dbs_series!inner(is_demo,status)")
          .eq("id", body.episode)
          .single(),
      );
      if (
        episode.status !== "published" ||
        new Date(episode.publish_at) > new Date() ||
        episode.dbs_series.status !== "published"
      )
        return send(req, { error: "EPISODE_UNAVAILABLE" }, 403);
      const demoGuest =
        episode.access_type === "free" && !user;
      if (
        !demoGuest &&
        (!user ||
          !(await checked(
            client.rpc("dbs_episode_access", { episode: body.episode }),
          )))
      )
        return send(
          req,
          { error: user ? "ACCESS_DENIED" : "AUTH_REQUIRED" },
          403,
        );
      const asset = await checked(
        admin
          .from("dbs_video_assets")
          .select("*")
          .eq("episode_id", body.episode)
          .single(),
      );
      if (!asset.ready) return send(req, { error: "VIDEO_NOT_READY" }, 409);
      const subtitles = await subtitleTracks(body.episode);
      if (asset.provider === "demo" && episode.dbs_series.is_demo) {
        const landscape = episode.orientation === "landscape" && asset.landscape_renditions?.length ? asset.landscape_renditions : null;
        return send(req, {
          url: landscape ? landscape.at(-1).url : asset.demo_url,
          qualities: landscape || asset.renditions || [],
          provider: "demo",
          subtitles,
        });
      }
      if (asset.provider === "r2") {
        const key = normalizeR2Key(asset.r2_key, r2Base());
        return send(req, { ...await r2Playback(body.episode, key, authorization, episode.access_type, r2Base()), subtitles });
      }
      // The Edge function has already checked the real user's entitlement.
      // It can sign directly too, without requiring a separate Worker/code.
      if (streamConfigured()) {
        if (!streamUID(asset.stream_uid)) return send(req, { error: "INVALID_STREAM_UID" }, 409);
        const video = await getStreamVideo(asset.stream_uid);
        if (!video.readyToStream) return send(req, { error: "VIDEO_NOT_READY" }, 409);
        if (!episode.dbs_series.is_demo && !video.requireSignedURLs)
          return send(req, { error: "VIDEO_MUST_REQUIRE_SIGNED_URLS" }, 503);
        if (!video.requireSignedURLs && episode.dbs_series.is_demo)
          return send(req, { url: video.playback.hls, provider: "cloudflare", subtitles });
        const expires = Math.floor(Date.now() / 1000) + 7200;
        const response = await fetch(cfBase() + "/" + asset.stream_uid + "/token", {
          method: "POST", headers: cfHeaders(), body: JSON.stringify({ exp: expires }),
        });
        const signed = await response.json();
        if (!response.ok || !signed.success || !signed.result?.token) throw Error("SIGNING_UNAVAILABLE");
        return send(req, { provider: "cloudflare", url: `https://videodelivery.net/${signed.result.token}/manifest/video.m3u8`,
          expires_at: new Date(expires * 1000).toISOString(), subtitles });
      }
      if (!env("DBS_WORKER_URL")) return send(req, { error: "STREAM_NOT_CONFIGURED" }, 503);
      const response = await fetch(env("DBS_WORKER_URL") + "/playback", {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ episode: body.episode }),
      });
      const playback = await response.json();
      return send(req, response.ok ? { ...playback, subtitles: subtitles.length ? subtitles : playback.subtitles || [] } : playback, response.status);
    }
    if (!user) return send(req, { error: "AUTH_REQUIRED" }, 401);
    const profile = await checked(
      client
        .from("dbs_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!profile) return send(req, { error: "ACCOUNT_UNAVAILABLE" }, 403);
    if (body.action === "delete-account") {
      if (body.confirm !== "DELETE")
        return send(req, { error: "CONFIRM_REQUIRED" }, 400);
      // Only this application's avatar; the shared Auth account and other apps remain intact.
      const { error: avatarError } = await admin.storage.from("dbs_series_avatars").remove([user.id + "/avatar.jpg"]);
      if (avatarError) throw avatarError;
      // Auth is shared. Remove only this application's registration fields.
      const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { dbs_registration: null },
      });
      if (metadataError) throw metadataError;
      await checked(client.rpc("dbs_delete_account"));
      return send(req, { deleted: true, scope: "DraBornSeries" });
    }
    if (
      body.action === "admin-list" ||
      body.action === "admin-r2-list" ||
      body.action === "admin-r2-probe" ||
      body.action === "admin-series-editor" ||
      body.action === "admin-studio-save" ||
      body.action === "admin-options" ||
      body.action === "admin-upload-video" ||
      body.action === "admin-video-status" ||
      body.action === "admin-video-uploaded" ||
      body.action === "admin-sync-videos" ||
      body.action === "admin-save" ||
      body.action === "admin-grant" ||
      body.action === "admin-users" ||
      body.action === "admin-user" ||
      body.action === "admin-vip-grant" ||
      body.action === "admin-metrics" ||
      body.action === "admin-delete" ||
      body.action === "admin-stream-videos"
      || body.action === "admin-me" || body.action === "admin-caption-retry"
    ) {
      if (!(await checked(client.rpc("dbs_is_admin"))))
        return send(req, { error: "ADMIN_REQUIRED" }, 403);
      const tables = [
        "dbs_series",
        "dbs_seasons",
        "dbs_episodes",
        "dbs_video_assets",
        "dbs_profiles",
        "dbs_borncoins_wallet",
        "dbs_borncoins_transactions",
        "dbs_purchases",
        "dbs_episode_unlocks",
        "dbs_vip_subscriptions",
        "dbs_reports",
        "dbs_content_reports",
        "dbs_comments",
        "dbs_admin_logs",
        "dbs_analytics_events",
        "dbs_watch_progress",
        "dbs_featured_content",
        "dbs_home_sections",
        "dbs_content_schedule",
        "dbs_subtitles",
        "dbs_audio_tracks",
        "dbs_promo_codes",
      ];
      if (body.action === "admin-me") {
        const membership = await checked(admin.from("dbs_admin_users").select("role").eq("user_id", user.id).single());
        return send(req, { role: membership.role });
      }
      if (body.action === "admin-caption-retry") {
        const membership = await checked(admin.from("dbs_admin_users").select("role").eq("user_id", user.id).single());
        if (!["owner", "editor"].includes(membership.role)) return send(req, { error: "EDITOR_REQUIRED" }, 403);
        const job = await checked(admin.from("dbs_auto_subtitle_jobs").select("id,source_key").eq("episode_id", body.episode).in("status", ["failed", "no_speech"]).order("created_at", { ascending: false }).limit(1).maybeSingle());
        if (!job) return send(req, { error: "CAPTION_NOT_RETRYABLE" }, 409);
        const asset = await checked(admin.from("dbs_video_assets").select("r2_key").eq("episode_id", body.episode).eq("provider", "r2").single());
        if (asset.r2_key !== job.source_key) return send(req, { error: "CAPTION_NOT_RETRYABLE" }, 409);
        const preview = await probeR2(job.source_key, authorization, r2Base(), true);
        await checked(admin.from("dbs_auto_subtitle_jobs").update({ status: "queued", attempts: 0, error: null, preview_url: preview.url, preview_until: preview.expires_at, updated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["failed", "no_speech"]));
        return send(req, { status: "queued" });
      }
      if (["admin-r2-list", "admin-r2-probe", "admin-studio-save", "admin-series-editor"].includes(body.action)) {
        const membership = await checked(admin.from("dbs_admin_users").select("role").eq("user_id", user.id).single());
        if (!["owner", "editor"].includes(membership.role)) return send(req, { error: "EDITOR_REQUIRED" }, 403);
        if (body.action === "admin-series-editor") {
          const episodes = await checked(admin.from("dbs_episodes").select("*").eq("series_id", body.series).order("number"));
          const assets = episodes.length ? await checked(admin.from("dbs_video_assets").select("episode_id,provider,r2_key,ready").in("episode_id", episodes.map((item: any) => item.id))) : [];
          const captions = episodes.length ? await checked(admin.from("dbs_auto_subtitle_jobs").select("episode_id,source_key,status,error").in("episode_id", episodes.map((item: any) => item.id))) : [];
          const seasons = await checked(admin.from("dbs_seasons").select("id,number").eq("series_id", body.series));
          return send(req, { episodes: episodes.map((item: any) => ({ ...item, season_number: seasons.find((season: any) => season.id === item.season_id)?.number || 1, ...assets.find((asset: any) => asset.episode_id === item.id), caption: captions.find((job: any) => job.episode_id === item.id && job.source_key === assets.find((asset: any) => asset.episode_id === item.id)?.r2_key) })) });
        }
        const capabilities = await workerCapabilities(r2Base());
        if (body.action === "admin-r2-list") {
          if (!capabilities.listing) return send(req, { configured: false, objects: [], cursor: null,
            message: "Klasör taraması için R2 Worker güncellemesi gerekiyor. Şimdilik dosya yollarını veya video bağlantılarını aşağıya yapıştırabilirsin." });
          const prefix = String(body.prefix || "").trim();
          if (prefix.length > 1000 || /[\\?#\u0000-\u001f]/.test(prefix) || prefix.split("/").includes("..")) throw Error("INVALID_R2_KEY");
          const url = new URL(r2Base() + "/studio/media"); url.searchParams.set("prefix", prefix);
          if (body.cursor) url.searchParams.set("cursor", String(body.cursor));
          const response = await fetch(url, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw Error("R2_LIST_UNAVAILABLE");
          return send(req, await response.json());
        }
        if (body.action === "admin-r2-probe") {
          const key = normalizeR2Key(body.key, r2Base());
          return send(req, await probeR2(key, authorization, r2Base(), capabilities.privateMedia));
        }
        const payload = body.payload;
        if (!payload || !payload.series || !Array.isArray(payload.episodes) || payload.episodes.length > 50) throw Error("INVALID_SERIES");
        if (!capabilities.privateMedia) {
          const protectedIds = payload.episodes.filter((item: any) => item.id && item.access_type && item.access_type !== "free").map((item: any) => item.id);
          if (protectedIds.length && (await checked(admin.from("dbs_video_assets").select("provider").in("episode_id", protectedIds))).some((asset: any) => asset.provider === "r2")) throw Error("R2_PRIVATE_WORKER_REQUIRED");
        }
        // Reject foreign video URLs and confirm every replacement before the atomic save.
        for (const item of payload.episodes) {
          if (item.thumbnail_url && (!/^https:\/\//i.test(item.thumbnail_url) || new URL(item.thumbnail_url).username || new URL(item.thumbnail_url).password)) throw Error("INVALID_MEDIA_URL");
          if (!item.r2_key) continue;
          item.r2_key = normalizeR2Key(item.r2_key, r2Base());
          if ((item.access_type || "free") !== "free" && !capabilities.privateMedia) throw Error("R2_PRIVATE_WORKER_REQUIRED");
        }
        const previews = new Map<string, any>();
        for (let offset = 0; offset < payload.episodes.length; offset += 5) await Promise.all(payload.episodes.slice(offset, offset + 5).map(async (item: any) => {
          if (!item.r2_key) return;
          const probe = await probeR2(item.r2_key, authorization, r2Base(), capabilities.privateMedia);
          previews.set(item.r2_key, probe);
          if (probe.duration > 0) item.duration_seconds = Math.ceil(probe.duration);
        }));
        for (const key of ["poster_url", "banner_url", "trailer_url"]) {
          const value = payload.series[key];
          if (value && (!/^https:\/\//i.test(value) || new URL(value).username || new URL(value).password)) throw Error("INVALID_MEDIA_URL");
        }
        payload.series.r2_trailer_key = payload.series.trailer_url && new URL(payload.series.trailer_url).origin === new URL(r2Base()).origin ? normalizeR2Key(payload.series.trailer_url, r2Base()) : null;
        if (payload.series.r2_trailer_key) {
          await probeR2(payload.series.r2_trailer_key, authorization, r2Base(), capabilities.privateMedia);
          payload.series.trailer_url = mediaUrl(payload.series.r2_trailer_key, r2Base());
        }
        const saved = await checked(admin.rpc("dbs_studio_save_series", { actor: user.id, payload }));
        for (const [key, preview] of previews) {
          if (preview.expires_at) await checked(admin.from("dbs_auto_subtitle_jobs").update({ preview_url: preview.url, preview_until: preview.expires_at }).eq("source_key", key).in("status", ["queued", "failed"]));
        }
        return send(req, saved);
      }
      if (body.action === "admin-metrics")
        return send(req, { metrics: await checked(client.rpc("dbs_admin_metrics")) });
      if (body.action === "admin-users") {
        const page = Math.max(0, Math.min(1000, Number(body.page) || 0));
        const search = String(body.search || "").trim().slice(0, 80);
        let query = admin.from("dbs_profiles")
          .select("user_id,username,full_name,avatar_url,status,created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(page * 25, page * 25 + 24);
        if (search) {
          if (/^[a-f0-9-]{36}$/i.test(search)) query = query.eq("user_id", search);
          else {
            const safe = search.replace(/[^\p{L}\p{N} _-]/gu, "");
            if (safe) query = query.or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`);
          }
        }
        const { data: profiles, error, count } = await query;
        if (error) throw Error(error.message);
        const ids = (profiles || []).map((p: any) => p.user_id);
        if (!ids.length) return send(req, { rows: [], total: count || 0 });
        const [wallets, memberships] = await Promise.all([
          checked(admin.from("dbs_borncoins_wallet").select("user_id,balance").in("user_id", ids)),
          checked(admin.from("dbs_vip_subscriptions")
            .select("user_id,status,expires_at")
            .in("user_id", ids).in("status", ["active", "grace"])
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })),
        ]);
        return send(req, { total: count || 0, rows: profiles.map((p: any) => ({
          ...p,
          balance: wallets.find((w: any) => w.user_id === p.user_id)?.balance || 0,
          vip_until: memberships.find((v: any) => v.user_id === p.user_id)?.expires_at || null,
        })) });
      }
      if (body.action === "admin-user") {
        if (typeof body.user_id !== "string" || !/^[a-f0-9-]{36}$/i.test(body.user_id))
          return send(req, { error: "INVALID_USER" }, 400);
        const id = body.user_id;
        const [profile, wallet, vip, transactions, purchases, unlocks, reports, authUser] = await Promise.all([
          checked(admin.from("dbs_profiles").select("user_id,username,full_name,avatar_url,status,created_at").eq("user_id", id).single()),
          checked(admin.from("dbs_borncoins_wallet").select("balance,updated_at").eq("user_id", id).maybeSingle()),
          checked(admin.from("dbs_vip_subscriptions").select("id,provider,product_id,status,starts_at,expires_at,auto_renew").eq("user_id", id).order("expires_at", { ascending: false }).limit(20)),
          checked(admin.from("dbs_borncoins_transactions").select("id,amount,balance_after,kind,description,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(30)),
          checked(admin.from("dbs_purchases").select("id,product_id,order_id,status,quantity,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(30)),
          checked(admin.from("dbs_episode_unlocks").select("id,episode_id,source,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(30)),
          checked(admin.from("dbs_reports").select("id,kind,body,status,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20)),
          admin.auth.admin.getUserById(id),
        ]);
        return send(req, { profile, email: authUser.data.user?.email || null,
          wallet, vip, transactions, purchases, unlocks, reports });
      }
      if (body.action === "admin-stream-videos") {
        if (!env("CLOUDFLARE_ACCOUNT_ID") || !env("CLOUDFLARE_API_TOKEN"))
          return send(req, { configured: false, videos: [] });
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/stream?per_page=50`, {
          headers: { Authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}` },
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw Error("STREAM_LIST_FAILED");
        return send(req, { configured: true, videos: (result.result || []).map((v: any) => ({
          uid: v.uid, name: v.meta?.name || v.uid, ready: v.readyToStream === true,
        })) });
      }
      if (body.action === "admin-upload-video" || body.action === "admin-video-status" || body.action === "admin-video-uploaded" || body.action === "admin-sync-videos") {
        const membership = await checked(admin.from("dbs_admin_users").select("role").eq("user_id", user.id).single());
        if (!["owner", "editor"].includes(membership.role)) return send(req, { error: "EDITOR_REQUIRED" }, 403);
        if (!streamConfigured()) return send(req, body.action === "admin-sync-videos" ? { configured: false, synced: 0 } : { error: "STREAM_UPLOAD_NOT_CONFIGURED" }, body.action === "admin-sync-videos" ? 200 : 503);
        const base = `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/stream`;
        const authHeaders = { Authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}`, "Content-Type": "application/json" };
        if (body.action === "admin-sync-videos") {
          const pending = await checked(admin.from("dbs_video_uploads").select("uid").in("status", ["processing","pending"]).order("updated_at").limit(20));
          let synced = 0;
          for (const item of pending) { try { const video = await getStreamVideo(item.uid); if (await reconcileVideo(video)) synced++; } catch { /* next visit retries */ } }
          return send(req, { configured: true, synced });
        }
        if (body.action === "admin-video-status" || body.action === "admin-video-uploaded") {
          if (typeof body.uid !== "string" || !/^[a-f0-9]{32}$/.test(body.uid)) return send(req, { error: "INVALID_STREAM_UID" }, 400);
          if (body.action === "admin-video-uploaded") await checked(admin.from("dbs_video_uploads").update({ status: "processing", updated_at: new Date().toISOString() }).eq("uid",body.uid).eq("created_by",user.id).eq("status","pending"));
          const video = await getStreamVideo(body.uid);
          const bound = await reconcileVideo(video);
          return send(req, { ready: video.readyToStream === true, bound, duration: video.duration,
            status: video.status?.state, error: video.status?.errorReasonCode || video.status?.errReasonCode || null,
            publicURL: video.requireSignedURLs ? undefined : video.playback?.hls });
        }
        if (!["episode", "trailer"].includes(body.purpose)) return send(req, { error: "INVALID_UPLOAD_PURPOSE" }, 400);
        if (body.purpose === "episode") await checked(admin.from("dbs_episodes").select("id").eq("id", body.episode).single());
        let grant: { uid: string; uploadURL: string; protocol: "tus" | "multipart" };
        if (body.protocol === "tus") {
          if (!Number.isSafeInteger(body.size) || body.size < 1 || body.size > 30 * 1024 * 1024 * 1024) return send(req, { error: "INVALID_UPLOAD_SIZE" }, 400);
          const encode = (value: string) => btoa(String.fromCharCode(...new TextEncoder().encode(value)));
          const metadata = [`maxDurationSeconds ${encode("3600")}`, `expiry ${encode(new Date(Date.now()+86400000).toISOString())}`, `name ${encode(String(body.name || "DraBornSeries video").slice(0,150))}`, `creator ${encode(user.id)}`];
          if (body.purpose === "episode") metadata.push("requiresignedurls");
          const response = await fetch(base + "?direct_user=true", { method: "POST", headers: { Authorization: authHeaders.Authorization,
            "Tus-Resumable": "1.0.0", "Upload-Length": String(body.size), "Upload-Metadata": metadata.join(",") } });
          const location = response.headers.get("Location"), uid = response.headers.get("stream-media-id");
          if (!response.ok || !location || !streamUID(uid)) throw Error("STREAM_UPLOAD_FAILED");
          grant = { uid, uploadURL: location, protocol: "tus" };
        } else {
        const response = await fetch(base + "/direct_upload", { method: "POST", headers: authHeaders,
          body: JSON.stringify({ maxDurationSeconds: 3600, expiry: new Date(Date.now() + 3600000).toISOString(),
            requireSignedURLs: body.purpose === "episode", creator: user.id, meta: { name: String(body.name || "DraBornSeries video").slice(0,150) } }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw Error("STREAM_UPLOAD_FAILED");
        grant = { uid: result.result.uid, uploadURL: result.result.uploadURL, protocol: "multipart" };
        }
        await checked(admin.from("dbs_video_uploads").insert({ uid: grant.uid, created_by: user.id, purpose: body.purpose, episode_id: body.episode || null }));
        await checked(admin.from("dbs_admin_logs").insert({ admin_id: user.id, action: "video_upload", target: "dbs_video_assets",
          detail: { uid: grant.uid, purpose: body.purpose, episode: body.episode || null } }));
        return send(req, { ...grant, publicURL: body.purpose === "trailer" ? `https://videodelivery.net/${grant.uid}/manifest/video.m3u8` : undefined });
      }
      if (body.action === "admin-grant") {
        return send(
          req,
          await checked(
            client.rpc("dbs_admin_grant", {
              account: body.user_id,
              coins: body.coins,
              reason: body.reason,
              request_id: body.request_id,
            }),
          ),
        );
      }
      if (body.action === "admin-vip-grant") {
        return send(req, { expires_at: await checked(client.rpc("dbs_admin_grant_vip", {
          account: body.user_id, days: body.days, reason: body.reason, request_id: body.request_id,
        })) });
      }
      if (body.action === "admin-delete") {
        if (body.table !== "dbs_series" || body.confirm !== "DELETE")
          return send(req, { error: "CONFIRMATION_REQUIRED" }, 400);
        if (typeof body.id !== "string" || typeof body.title !== "string")
          return send(req, { error: "INVALID_ID" }, 400);
        return send(req, await checked(client.rpc("dbs_admin_delete_series", {
          series: body.id, confirmation: body.title,
        })));
      }
      if (!tables.includes(body.table))
        return send(req, { error: "TABLE_NOT_ALLOWED" }, 400);
      if (body.action === "admin-list" || body.action === "admin-options") {
        const options = body.action === "admin-options";
        if (options && !["dbs_series", "dbs_seasons", "dbs_episodes"].includes(body.table))
          return send(req, { error: "TABLE_NOT_ALLOWED" }, 400);
        const limit = options ? 1000 : Math.max(1, Math.min(50, Number.isInteger(body.limit) ? body.limit : 10));
        const offset = options ? 0 : Math.max(0, Math.min(100000, Number.isInteger(body.offset) ? body.offset : 0));
        const primaryKey = ["dbs_profiles", "dbs_borncoins_wallet"].includes(body.table) ? "user_id" : "id";
        const search = String(body.search || "").trim().slice(0, 100);
        if (!options && body.table === "dbs_series") return send(req, await checked(admin.rpc("dbs_studio_search_series", { search, page_limit: limit, page_offset: offset })));
        let query = admin.from(body.table).select("*", { count: "exact" })
          .order(primaryKey, { ascending: true }).range(offset, offset + limit - 1);
        if (!options && search) {
          const columns: Record<string, string[]> = { dbs_episodes: ["title", "description"], dbs_seasons: ["title"], dbs_video_assets: ["r2_key", "stream_uid"],
            dbs_subtitles: ["label", "language"], dbs_audio_tracks: ["label", "language"], dbs_promo_codes: ["code"], dbs_reports: ["kind", "body"], dbs_content_reports: ["reason"], dbs_comments: ["body"],
            dbs_admin_logs: ["action", "target"], dbs_categories: ["name"], dbs_genres: ["name"], dbs_home_sections: ["name"], dbs_featured_content: ["name"], dbs_content_schedule: ["name"] };
          const safe = search.replace(/[^\p{L}\p{N} _-]/gu, "");
          if (safe && columns[body.table]?.length) query = query.or(columns[body.table].map((name) => name + ".ilike.%" + safe + "%").join(","));
        }
        const result = await query;
        if (result.error) throw result.error;
        let rows = result.data || [];
        if (body.table === "dbs_admin_logs") {
          const ids = [...new Set(rows.map((row: any) => row.admin_id).filter(Boolean))];
          const names = ids.length ? await checked(admin.from("dbs_profiles").select("user_id,username").in("user_id", ids)) : [];
          rows = rows.map((row: any) => ({ ...row, admin_name: names.find((name: any) => name.user_id === row.admin_id)?.username || "Yönetici" }));
        }
        return send(req, { rows, total: result.count || 0, offset, has_more: offset + rows.length < (result.count || 0) });
      }
      const { data: membership } = await admin
        .from("dbs_admin_users")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (!membership || !["owner", "editor"].includes(membership.role))
        return send(req, { error: "EDITOR_REQUIRED" }, 403);
      if (body.table === "dbs_promo_codes") {
        if (!body.row || !Number.isInteger(Number(body.row.coins)) || !Number.isInteger(Number(body.row.vip_days || 0)) || !Number.isInteger(Number(body.row.max_uses)) || !Number.isFinite(Date.parse(body.row.expires_at))) return send(req, { error: "INVALID_PROMO_SETTINGS" }, 400);
        return send(req, { row: await checked(admin.rpc("dbs_studio_save_promo", { actor: user.id, payload: body.row })) });
      }
      const fields: Record<string, string[]> = {
        dbs_series: [
          "id",
          "slug",
          "title",
          "alternative_title",
          "title_en",
          "description",
          "description_en",
          "short_description",
          "poster_url",
          "banner_url",
          "trailer_url",
          "genres",
          "tags",
          "cast_names",
          "director",
          "production_year",
          "country",
          "age_rating",
          "language",
          "status",
          "is_vip",
          "featured_order",
          "total_seasons",
          "total_episodes",
          "average_duration",
          "release_at",
          "video_orientation",
          "r2_folder",
        ],
        dbs_seasons: ["id", "series_id", "number", "title"],
        dbs_episodes: [
          "id",
          "series_id",
          "season_id",
          "number",
          "title",
          "description",
          "duration_seconds",
          "thumbnail_url",
          "orientation",
          "access_type",
          "coin_price",
          "vip_included",
          "status",
          "publish_at",
        ],
        dbs_video_assets: [
          "id",
          "episode_id",
          "provider",
          "stream_uid",
          "r2_key",
          "ready",
        ],
        dbs_comments: ["id", "status"],
        dbs_reports: ["id", "status"],
        dbs_content_reports: ["id", "status"],
        dbs_subtitles: ["id", "episode_id", "language", "label", "asset_key"],
        dbs_audio_tracks: [
          "id",
          "episode_id",
          "language",
          "label",
          "asset_key",
        ],
        dbs_featured_content: [
          "id",
          "name",
          "data",
          "active",
          "starts_at",
          "ends_at",
          "sort_order",
        ],
        dbs_home_sections: ["id", "name", "data", "active", "sort_order"],
        dbs_content_schedule: ["id", "name", "data", "active", "starts_at"],
        dbs_promo_codes: [
          "id",
          "code",
          "coins",
          "max_uses",
          "expires_at",
          "active",
        ],
        dbs_profiles: membership.role === "owner" ? ["user_id", "status"] : [],
      };
      if (
        !fields[body.table]?.length ||
        !body.row ||
        typeof body.row !== "object"
      )
        return send(req, { error: "READ_ONLY_TABLE" }, 403);
      const row = Object.fromEntries(
        Object.entries(body.row).filter(([key]) =>
          fields[body.table].includes(key),
        ),
      );
      if (body.table === "dbs_video_assets" && !["cloudflare", "r2"].includes(String(row.provider)))
        return send(req, { error: "R2_REQUIRED" }, 400);
      let uploadedVideo: any = null;
      let r2Preview: any = null;
      if (body.table === "dbs_video_assets" && row.provider === "r2") {
        const capabilities = await workerCapabilities(r2Base());
        row.r2_key = normalizeR2Key(row.r2_key, r2Base());
        const episode = await checked(admin.from("dbs_episodes").select("access_type").eq("id", row.episode_id).single());
        if (episode.access_type !== "free" && !capabilities.privateMedia) throw Error("R2_PRIVATE_WORKER_REQUIRED");
        r2Preview = await probeR2(String(row.r2_key), authorization, r2Base(), capabilities.privateMedia);
        row.ready = true; row.stream_uid = null;
      }
      if (body.table === "dbs_video_assets" && row.provider === "cloudflare") {
        if (!env("CLOUDFLARE_ACCOUNT_ID") || !env("CLOUDFLARE_API_TOKEN")) return send(req, { error: "STREAM_UPLOAD_NOT_CONFIGURED" }, 503);
        if (typeof row.stream_uid !== "string" || !/^[a-f0-9]{32}$/.test(row.stream_uid)) return send(req, { error: "INVALID_STREAM_UID" }, 400);
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/stream/${row.stream_uid}`, {
          method: "POST", headers: { Authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requireSignedURLs: true }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw Error("STREAM_STATUS_FAILED");
        assertPlayableStream(result.result, row.stream_uid);
        row.ready = result.result.readyToStream === true; uploadedVideo = result.result;
      }
      if (body.table === "dbs_profiles" && row.user_id === user.id)
        return send(req, { error: "SELF_STATUS_CHANGE_DENIED" }, 400);
      const moderationTables = [
        "dbs_profiles",
        "dbs_comments",
        "dbs_reports",
        "dbs_content_reports",
      ];
      const primaryKey = body.table === "dbs_profiles" ? "user_id" : "id";
      if (moderationTables.includes(body.table) && !row[primaryKey])
        return send(req, { error: "ROW_ID_REQUIRED" }, 400);
      const write = moderationTables.includes(body.table)
        ? admin
            .from(body.table)
            .update({ status: row.status })
            .eq(primaryKey, row[primaryKey])
        : admin.from(body.table).upsert(row, { onConflict: naturalConflict(body.table, !!row.id) });
      const saved = await checked(write.select().single());
      if (r2Preview?.expires_at) await checked(admin.from("dbs_auto_subtitle_jobs").update({ preview_url: r2Preview.url, preview_until: r2Preview.expires_at }).eq("episode_id", saved.episode_id).eq("source_key", saved.r2_key).in("status", ["queued", "failed"]));
      let changedSeries = saved.series_id;
      if (uploadedVideo?.readyToStream && uploadedVideo.duration > 0) {
        const values: Record<string, unknown> = { duration_seconds: Math.max(1, Math.ceil(uploadedVideo.duration)) };
        // The author chooses the video direction in the episode form.
        const episode = await checked(admin.from("dbs_episodes").update(values).eq("id", saved.episode_id).select("series_id").single());
        changedSeries = episode.series_id;
      }
      if (changedSeries && ["dbs_seasons", "dbs_episodes", "dbs_video_assets"].includes(body.table)) {
        const [seasons, episodes] = await Promise.all([
          admin.from("dbs_seasons").select("id", { count: "exact", head: true }).eq("series_id", changedSeries),
          admin.from("dbs_episodes").select("id", { count: "exact", head: true }).eq("series_id", changedSeries),
        ]);
        if (seasons.error) throw seasons.error; if (episodes.error) throw episodes.error;
        await checked(admin.from("dbs_series").update({ total_seasons: seasons.count || 0, total_episodes: episodes.count || 0 }).eq("id", changedSeries));
      }
      await checked(
        admin.from("dbs_admin_logs").insert({
          admin_id: user.id,
          action: "save",
          target: body.table,
          detail: { id: saved.id || saved.user_id, fields: Object.keys(row) },
        }),
      );
      return send(req, { row: saved });
    }
    return send(req, { error: "UNKNOWN_ACTION" }, 400);
  } catch (err) {
    console.error("dbs-api", err instanceof Error ? err.message : "unknown");
    return send(
      req,
      { error: err instanceof Error ? err.message : "REQUEST_FAILED" },
      400,
    );
  }
});
