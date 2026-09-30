import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const project = "xpdiwyxnnrmyvpcqwuyb";
const endpoint = `https://${project}.supabase.co/functions/v1/dbs-api`;
const uidValid = (value) => typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
const sqlText = (value) => "'" + String(value).replaceAll("'", "''") + "'";

/** Account-scoped setup. Never log credentials or replace another app's webhook. */
export async function configureStream({ account, token, supabaseToken, request = fetch, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), rounds = 60 }) {
  if (!/^[a-f0-9]{32}$/.test(account || "") || !token || !supabaseToken) throw Error("STREAM_CREDENTIALS_MISSING");
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/stream`;
  const cf = async (path, method = "GET", body) => {
    const response = await request(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw Error(`STREAM_SETUP_HTTP_${response.status}`);
    const json = await response.json();
    if (!json.success) throw Error("STREAM_SETUP_API_FAILED");
    return json.result;
  };
  const manage = async (path, body) => {
    const response = await request(`https://api.supabase.com/v1/projects/${project}` + path, { method: "POST", headers: { Authorization: `Bearer ${supabaseToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw Error(`SUPABASE_SETUP_HTTP_${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  const sql = (query) => manage("/database/query", { query });
  const secrets = [{ name: "CLOUDFLARE_ACCOUNT_ID", value: account }, { name: "CLOUDFLARE_API_TOKEN", value: token }];
  // Only one Stream webhook is allowed per account. Keep unrelated apps intact.
  let webhook = await cf("/webhook"), webhookEnabled = false;
  if (!webhook?.notificationUrl || webhook.notificationUrl === endpoint) {
    if (!webhook?.notificationUrl) webhook = await cf("/webhook", "PUT", { notificationUrl: endpoint });
    if (!webhook?.secret) throw Error("STREAM_WEBHOOK_SECRET_MISSING");
    secrets.push({ name: "DBS_STREAM_WEBHOOK_SECRET", value: webhook.secret }); webhookEnabled = true;
  } else console.log("Existing account webhook preserved; Studio status polling remains enabled.");
  await manage("/secrets", secrets);
  const owner = (await sql("select user_id::text from drabornseries.dbs_admin_users where role='owner' order by user_id limit 1"))[0]?.user_id;
  if (!owner) throw Error("STUDIO_OWNER_MISSING");
  const demos = await sql("select e.id::text as episode_id,s.slug,e.number,a.demo_url from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id join drabornseries.dbs_video_assets a on a.episode_id=e.id where s.is_demo and s.status='published' and e.status='published' and a.provider='demo' and a.ready and a.demo_url is not null order by s.slug,e.number");
  for (const demo of demos) {
    let uid = (await sql(`select uid from drabornseries.dbs_video_uploads where episode_id=${sqlText(demo.episode_id)}::uuid and status in ('pending','processing','ready') order by created_at desc limit 1`))[0]?.uid;
    if (!uid) {
      const name = `DraBornSeries / ${demo.slug} / ${demo.number}`;
      // Recover a copy if a previous run disconnected before recording its UID.
      const existing = await cf(`?search=${encodeURIComponent(name)}`);
      const owned = (existing || []).filter((v) => v.meta?.dbs_episode_id === demo.episode_id && v.meta?.dbs_source_url === demo.demo_url && v.status?.state !== "error");
      const video = owned[0] || await cf("/copy", "POST", { url: demo.demo_url, requireSignedURLs: true, meta: { name, dbs_episode_id: demo.episode_id, dbs_source_url: demo.demo_url } });
      uid = video.uid;
      if (!uidValid(uid)) throw Error("INVALID_STREAM_UID");
      await sql(`insert into drabornseries.dbs_video_uploads(uid,episode_id,created_by,purpose,status) values(${sqlText(uid)},${sqlText(demo.episode_id)}::uuid,${sqlText(owner)}::uuid,'episode','processing') on conflict(uid) do nothing`);
    }
  }
  const pendingQuery = "select u.uid from drabornseries.dbs_video_uploads u join drabornseries.dbs_episodes e on e.id=u.episode_id join drabornseries.dbs_series s on s.id=e.series_id where u.status in ('pending','processing') and s.is_demo and s.status='published' and e.status='published' order by u.created_at limit 500";
  let pending = [], failed = 0;
  for (let round = 0; round < rounds; round++) {
    pending = await sql(pendingQuery);
    if (!pending.length) break;
    for (const item of pending) {
      if (!uidValid(item.uid)) throw Error("INVALID_STREAM_UID");
      const video = await cf("/" + item.uid);
      if (video.uid !== item.uid) throw Error("STREAM_UID_MISMATCH");
      await sql(`select drabornseries.dbs_complete_stream_upload(${sqlText(item.uid)},${sqlText(JSON.stringify(video))}::jsonb)`);
      if (video.status?.state === "error") failed++;
    }
    if (round < rounds - 1) await pause(20000);
  }
  pending = await sql(pendingQuery);
  // Check a real signing request before marking the service configured.
  const assets = await sql("select stream_uid from drabornseries.dbs_video_assets where provider='cloudflare' and ready limit 1");
  if (assets.length) {
    if (!uidValid(assets[0].stream_uid)) throw Error("INVALID_STREAM_UID");
    const signed = await cf("/" + assets[0].stream_uid + "/token", "POST", { exp: Math.floor(Date.now() / 1000) + 7200 });
    if (!signed.token) throw Error("STREAM_SIGNING_FAILED");
  }
  await sql("update drabornseries.dbs_app_settings set value=value||'{\"cloudflare\":true}'::jsonb where key='integrations'");
  const summary = { uploaded: demos.length, pending: pending.length, failed, webhook: webhookEnabled };
  console.log("Stream setup:", JSON.stringify(summary));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\nCloudflare Stream: ${demos.length} catalog assets, ${pending.length} still processing, ${failed} encoding failures. Webhook: ${webhookEnabled}.\n`);
  if (pending.length || failed) throw Error("STREAM_CATALOG_NOT_YET_READY");
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await configureStream({ account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN, supabaseToken: process.env.SUPABASE_ACCESS_TOKEN }); }
  catch (error) { console.error(error instanceof Error ? error.message : "STREAM_SETUP_FAILED"); process.exitCode = 1; }
}
