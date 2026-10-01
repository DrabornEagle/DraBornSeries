import test from "node:test";
import assert from "node:assert/strict";
import { assertCaptionClaims, captionAudience, verifyCaptionRunner } from "../supabase/functions/dbs-api/caption-auth";
import { validateAutoVtt } from "../supabase/functions/dbs-api/captions";
import { videoFit } from "../packages/shared/player-layout";
const now = 1800000000;
const claims = { iss: "https://token.actions.githubusercontent.com", aud: captionAudience,
  repository: "DrabornEagle/DraBornSeries", repository_id: "1393825232", repository_owner_id: "209698513", ref: "refs/heads/main",
  sub: "repo:DrabornEagle/DraBornSeries:ref:refs/heads/main", workflow_ref: "DrabornEagle/DraBornSeries/.github/workflows/subtitles.yml@refs/heads/main",
  event_name: "push", exp: now + 300, iat: now, nbf: now - 5 };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
test("only the main branch caption workflow can access private R2 jobs", async () => {
  assert.doesNotThrow(() => assertCaptionClaims(claims, now));
  assert.doesNotThrow(() => assertCaptionClaims({ ...claims, sub: "repo:DrabornEagle@209698513/DraBornSeries@1393825232:ref:refs/heads/main" }, now));
  for (const change of [{ repository_id: "1" }, { repository_owner_id: "1" }, { sub: "repo:DrabornEagle@1/DraBornSeries@1393825232:ref:refs/heads/main" }, { aud: "another-app" }, { ref: "refs/pull/1/merge" },
    { workflow_ref: claims.workflow_ref.replace("subtitles.yml", "validate.yml") }, { event_name: "pull_request_target" }, { exp: now - 1 }]) {
    assert.throws(() => assertCaptionClaims({ ...claims, ...change }, now), /INVALID_RUNNER/);
  }
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "test", alg: "RS256" };
  const input = encode({ kid: "test", alg: "RS256" }) + "." + encode(claims);
  const signature = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(input))).toString("base64url");
  await verifyCaptionRunner("Bearer " + input + "." + signature, [jwk], now);
  await assert.rejects(verifyCaptionRunner("Bearer " + input + "." + signature.slice(0, -4) + "AAAA", [jwk], now), /INVALID_RUNNER/);
  await assert.rejects(verifyCaptionRunner("Bearer " + input.replace(encode(claims), encode({ ...claims, exp: now + 400 })) + "." + signature, [jwk], now), /INVALID_RUNNER/);
});
test("generated captions must contain correctly ordered cues within the actual video", () => {
  const vtt = "WEBVTT\n\nNOTE Model attribution\n\n00:00:01.000 --> 00:00:03.000\nMerhaba dünya.\n";
  assert.equal(validateAutoVtt(vtt, 4), vtt);
  for (const invalid of ["WEBVTT\n\nNOTE No speech", vtt.replace("03.000", "01.000"), vtt.replace("03.000", "30.000"), vtt + "\n00:00:00.000 --> 00:00:02.000\nOut of order\n"]) {
    assert.throws(() => validateAutoVtt(invalid, 4), /INVALID_CAPTION/);
  }
});
test("fullscreen fills a matching orientation and keeps the full image before rotation", () => {
  assert.equal(videoFit(true, true, false), "cover");
  assert.equal(videoFit(true, false, true), "cover");
  assert.equal(videoFit(true, false, false), "contain");
  assert.equal(videoFit(true, true, true), "contain");
});
