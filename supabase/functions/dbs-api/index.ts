import { createClient } from "npm:@supabase/supabase-js@2.117.2";
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST")
    return send(req, { error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    if (Number(req.headers.get("content-length") || 0) > 100000)
      return send(req, { error: "BODY_TOO_LARGE" }, 413);
    const body = await req.json();
    const authorization = req.headers.get("authorization") || "";
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
        version: "0.1.0",
        cloudflare: !!env("DBS_WORKER_URL"),
        billing: !!env("DBS_GOOGLE_SERVICE_ACCOUNT"),
        ads: !!env("DBS_ADMOB_AD_UNIT"),
      });
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
        episode.dbs_series.is_demo && episode.access_type === "free" && !user;
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
      if (asset.provider === "demo" && episode.dbs_series.is_demo) {
        return send(req, {
          url: asset.demo_url,
          provider: "demo",
          subtitles: [],
        });
      }
      if (!env("DBS_WORKER_URL"))
        return send(req, { error: "STREAM_NOT_CONFIGURED" }, 503);
      const response = await fetch(env("DBS_WORKER_URL") + "/playback", {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ episode: body.episode }),
      });
      return send(req, await response.json(), response.status);
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
      await checked(client.rpc("dbs_delete_account"));
      return send(req, { deleted: true, scope: "DraBornSeries" });
    }
    if (
      body.action === "admin-list" ||
      body.action === "admin-save" ||
      body.action === "admin-grant"
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
      if (!tables.includes(body.table))
        return send(req, { error: "TABLE_NOT_ALLOWED" }, 400);
      if (body.action === "admin-list") {
        let query = admin.from(body.table).select("*").limit(100);
        if (
          body.table === "dbs_borncoins_transactions" ||
          body.table === "dbs_admin_logs"
        )
          query = query.order("created_at", { ascending: false });
        return send(req, { rows: await checked(query) });
      }
      const { data: membership } = await admin
        .from("dbs_admin_users")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (!membership || !["owner", "editor"].includes(membership.role))
        return send(req, { error: "EDITOR_REQUIRED" }, 403);
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
      if (body.table === "dbs_video_assets" && row.provider !== "cloudflare")
        return send(req, { error: "CLOUDFLARE_REQUIRED" }, 400);
      if (body.table === "dbs_profiles" && row.user_id === user.id)
        return send(req, { error: "SELF_STATUS_CHANGE_DENIED" }, 400);
      const saved = await checked(
        admin.from(body.table).upsert(row).select().single(),
      );
      await checked(
        admin
          .from("dbs_admin_logs")
          .insert({
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
