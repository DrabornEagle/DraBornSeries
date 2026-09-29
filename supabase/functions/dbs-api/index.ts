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
        version: "0.4.0",
        versionCode: 1,
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
      // Only this application's avatar; the shared Auth account and other apps remain intact.
      const { error: avatarError } = await admin.storage.from("dbs_series_avatars").remove([user.id + "/avatar.jpg"]);
      if (avatarError) throw avatarError;
      await checked(client.rpc("dbs_delete_account"));
      return send(req, { deleted: true, scope: "DraBornSeries" });
    }
    if (
      body.action === "admin-list" ||
      body.action === "admin-save" ||
      body.action === "admin-grant" ||
      body.action === "admin-users" ||
      body.action === "admin-user" ||
      body.action === "admin-vip-grant" ||
      body.action === "admin-metrics" ||
      body.action === "admin-delete" ||
      body.action === "admin-stream-videos"
      || body.action === "admin-me"
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
      if (body.action === "admin-list") {
        let query = admin.from(body.table).select("*").limit(100);
        if (
          body.table === "dbs_borncoins_transactions" ||
          body.table === "dbs_admin_logs"
        )
          query = query.order("created_at", { ascending: false });
        const rows = await checked(query);
        if (body.table === "dbs_admin_logs") {
          const ids = [...new Set(rows.map((row: any) => row.admin_id).filter(Boolean))];
          const names = ids.length ? await checked(admin.from("dbs_profiles")
            .select("user_id,username").in("user_id", ids)) : [];
          return send(req, { rows: rows.map((row: any) => ({ ...row,
            admin_name: names.find((name: any) => name.user_id === row.admin_id)?.username || "Yönetici",
          })) });
        }
        return send(req, { rows });
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
        : admin.from(body.table).upsert(row);
      const saved = await checked(write.select().single());
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
