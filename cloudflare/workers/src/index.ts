/** DraBornSeries private Stream gateway. No public origin video URLs. */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  STREAM_CUSTOMER_CODE: string;
  DBS_ALLOWED_ORIGINS: string;
  RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin") || "";
    const allowed = env.DBS_ALLOWED_ORIGINS.split(",").map((value) =>
      value.trim(),
    );
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin)
        ? origin
        : allowed[0],
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      Vary: "Origin",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    };
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: cors });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (
      request.method !== "POST" ||
      new URL(request.url).pathname !== "/playback"
    )
      return reply({ error: "NOT_FOUND" }, 404);
    if (origin && !allowed.includes(origin))
      return reply({ error: "ORIGIN_DENIED" }, 403);
    try {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer "))
        return reply({ error: "AUTH_REQUIRED" }, 401);
      const authHeaders = {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: authorization,
      };
      const userResponse = await fetch(env.SUPABASE_URL + "/auth/v1/user", {
        headers: authHeaders,
      });
      if (!userResponse.ok) return reply({ error: "AUTH_REQUIRED" }, 401);
      const user = (await userResponse.json()) as { id: string };
      if (
        !env.RATE_LIMITER ||
        !(await env.RATE_LIMITER.limit({ key: user.id })).success
      )
        return reply({ error: "RATE_LIMITED" }, 429);
      const { episode } = (await request.json()) as { episode: string };
      if (!/^[0-9a-f-]{36}$/i.test(episode))
        return reply({ error: "INVALID_EPISODE" }, 400);
      const permission = await fetch(
        env.SUPABASE_URL + "/rest/v1/rpc/dbs_episode_access",
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
            "Content-Profile": "drabornseries",
          },
          body: JSON.stringify({ episode }),
        },
      );
      if (!permission.ok || (await permission.json()) !== true)
        return reply({ error: "ACCESS_DENIED" }, 403);
      const privateHeaders = {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Accept-Profile": "drabornseries",
      };
      const assetResponse = await fetch(
        env.SUPABASE_URL +
          `/rest/v1/dbs_video_assets?episode_id=eq.${episode}&provider=eq.cloudflare&ready=eq.true&select=stream_uid`,
        { headers: privateHeaders },
      );
      const assets = (await assetResponse.json()) as { stream_uid: string }[];
      const uid = assets[0]?.stream_uid;
      if (!uid || !/^[a-zA-Z0-9-]+$/.test(uid))
        return reply({ error: "VIDEO_NOT_READY" }, 409);
      const cfBase = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`;
      const cfHeaders = {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      };
      const info = (await fetch(cfBase, { headers: cfHeaders }).then(
        (response) => response.json(),
      )) as any;
      if (!info.success || !info.result?.requireSignedURLs)
        return reply({ error: "VIDEO_MUST_REQUIRE_SIGNED_URLS" }, 503);
      const expires = Math.floor(Date.now() / 1000) + 1800;
      const signed = (await fetch(cfBase + "/token", {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({ exp: expires }),
      }).then((response) => response.json())) as any;
      if (!signed.success || !signed.result?.token)
        return reply({ error: "SIGNING_UNAVAILABLE" }, 503);
      return reply({
        provider: "cloudflare",
        url: `https://customer-${env.STREAM_CUSTOMER_CODE}.cloudflarestream.com/${signed.result.token}/manifest/video.m3u8`,
        expires_at: new Date(expires * 1000).toISOString(),
        subtitles: [],
      });
    } catch {
      return reply({ error: "PLAYBACK_UNAVAILABLE" }, 503);
    }
  },
};
