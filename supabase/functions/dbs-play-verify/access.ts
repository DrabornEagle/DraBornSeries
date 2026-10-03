import { googleHeaders, googleRoot } from "./google.ts";
import { playApiFailure } from "./google-failure.ts";
let cached: { ready: boolean; error?: string; until: number } | undefined;
/** Reject a new payment before opening Play's sheet when receipt access is unavailable. */
export async function playBillingAccess(credentials: string) {
  if (!credentials) return { ready: false, error: "BILLING_NOT_CONFIGURED" };
  if (cached && cached.until > Date.now()) return cached;
  try {
    const headers = await googleHeaders(credentials);
    // A deliberately invalid token probes API permission without creating/consuming an order.
    const result = await fetch(googleRoot + "/products/dbs_coins_50/tokens/dbs-access-check-invalid-token", { headers, signal: AbortSignal.timeout(10000) });
    const ready = [400, 404, 409, 410].includes(result.status);
    const failure = ready ? undefined : playApiFailure(result.status, await result.json().catch(() => ({}))).error;
    cached = { ready, ...(failure ? { error: failure } : {}), until: Date.now() + (ready ? 300000 : 30000) };
  } catch { cached = { ready: false, error: "PLAY_TEMPORARILY_UNAVAILABLE", until: Date.now() + 10000 }; }
  return cached;
}
