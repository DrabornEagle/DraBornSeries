import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { calendarDays, localPublishTime } from "../packages/shared/calendar";
import { originalQuality, videoFit } from "../packages/shared/player-layout";
import { subscriptionSnapshot } from "../supabase/functions/dbs-play-verify/receipt";
import { ssvContent, verifySsv } from "../supabase/functions/dbs-ad-verify/signature";

test("calendar handles leap years and Istanbul publication time without exposing ISO entry", () => {
  assert.equal(calendarDays(2028, 1).filter(Boolean).length, 29);
  assert.equal(calendarDays(2027, 1).filter(Boolean).length, 28);
  assert.deepEqual(calendarDays(2026, 9).slice(0, 4), [null, null, null, 1]);
  for (const input of [[2026, 1, 29, "12", "00"], [2026, 9, 1, "24", "00"], [2026, 9, 1, "12", "60"], [2026, 9, 1, "-1", "00"]] as const) {
    assert.throws(() => localPublishTime(input[0], input[1], input[2], input[3], input[4]));
  }
  const output = execFileSync(process.execPath, ["--import", "tsx", "-e", 'const {localPublishTime} = require("./packages/shared/calendar.ts"); process.stdout.write(localPublishTime(2026,9,1,"21","30"))'], { env: { ...process.env, TZ: "Europe/Istanbul" } });
  assert.equal(output.toString(), "2026-10-01T18:30:00.000Z");
});

test("actual resolution and rotated media preserve the full landscape frame", () => {
  assert.equal(originalQuality(1920, 1080), "1080p · Orijinal");
  assert.equal(originalQuality(1080, 1920), "1080p · Orijinal");
  assert.equal(originalQuality(1728, 720), "720p · Orijinal");
  assert.equal(videoFit(true, false, true, false), "cover");
  assert.equal(videoFit(true, false, true, true), "cover");
  assert.equal(videoFit(true, true, false, true, "contain"), "contain");
  assert.equal(videoFit(false, false, false, false, "cover"), "cover");
});

test("Play lifecycle uses current expiry and never grants VIP for hold, paused or pending", () => {
  const now = Date.parse("2026-10-01T10:00:00Z");
  const receipt = (state: string, expiry = "2026-10-02T10:00:00Z") => ({ subscriptionState: "SUBSCRIPTION_STATE_" + state, lineItems: [{ productId: "dbs_vip_monthly", expiryTime: expiry, autoRenewingPlan: { autoRenewEnabled: true } }] });
  for (const state of ["ACTIVE", "IN_GRACE_PERIOD", "CANCELED"]) assert.equal(subscriptionSnapshot(receipt(state), "dbs_vip_monthly", now).entitled, true);
  for (const state of ["ON_HOLD", "PAUSED", "PENDING", "EXPIRED", "PENDING_PURCHASE_CANCELED"]) assert.equal(subscriptionSnapshot(receipt(state), "dbs_vip_monthly", now).entitled, false);
  assert.equal(subscriptionSnapshot(receipt("ACTIVE", "2026-10-01T09:59:59Z"), "dbs_vip_monthly", now).status, "expired");
  assert.throws(() => subscriptionSnapshot(receipt("ACTIVE"), "dbs_vip_weekly", now), /INVALID_SUBSCRIPTION_RECEIPT/);
  assert.throws(() => subscriptionSnapshot(receipt("ACTIVE", "invalid"), "dbs_vip_monthly", now), /INVALID_SUBSCRIPTION_RECEIPT/);
  assert.throws(() => subscriptionSnapshot(receipt("UNKNOWN"), "dbs_vip_monthly", now), /INVALID_SUBSCRIPTION_STATE/);
});

test("AdMob SSV verifies real DER signatures and rejects raw-query tampering", async () => {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = pair.publicKey.export({ type: "spki", format: "der" });
  const content = "ad_network=5450213213286189855&ad_unit=1234567890&custom_data=ticket%2Btest&reward_amount=3&reward_item=BornCoins&timestamp=1790848800000&transaction_id=fixture_123&user_id=fixture_user";
  const signature = sign("sha256", Buffer.from(content), pair.privateKey).toString("base64url");
  const query = content + "&signature=" + signature + "&key_id=42";
  const result = await verifySsv(query, spki);
  assert.equal(result.get("reward_amount"), "3");
  assert.equal(result.get("custom_data"), "ticket+test");
  for (const changed of [query.replace("reward_amount=3", "reward_amount=99"), query.replace("fixture_user", "another_user"), query.replace("%2B", "%2b")]) await assert.rejects(verifySsv(changed, spki), /INVALID_SSV_SIGNATURE/);
  for (const changed of [query + "&extra=unsigned", query.replace("&signature=", "&reward_amount=3&signature="), query.replace("&key_id=42", "&key_id=42&key_id=43")]) assert.throws(() => ssvContent(changed), /INVALID_SSV/);
  await assert.rejects(verifySsv(content + "&signature=AAAA&key_id=42", spki), /INVALID_SSV_SIGNATURE/);
});
