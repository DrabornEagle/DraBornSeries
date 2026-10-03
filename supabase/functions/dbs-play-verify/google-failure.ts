/** Preserve actionable upstream failures without exposing credentials or purchase tokens. */
export function playApiFailure(status: number, body: any) {
  const reasons = body?.error?.errors?.map((item: any) => item.reason) || [];
  if (reasons.includes("permissionDenied") || reasons.includes("insufficientPermissions") || status === 403)
    return { error: "PLAY_VERIFICATION_PERMISSION", status: 503, retry: true };
  if (status === 401) return { error: "GOOGLE_AUTH_FAILED", status: 503, retry: true };
  if (status === 429 || status >= 500) return { error: "PLAY_TEMPORARILY_UNAVAILABLE", status: 503, retry: true };
  return { error: "PURCHASE_NOT_VERIFIED", status: 409, retry: status === 404 };
}
