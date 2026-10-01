import { SignJWT, importPKCS8 } from "npm:jose@6.1.0";
export const packageName = "com.draborneagle.drabornseries";
export const googleRoot = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases`;
export const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
let cached: { accessToken: string; expires: number } | undefined;
export async function googleHeaders(credentialsJson: string) {
  if (cached && cached.expires > Date.now() + 60000) return { Authorization: "Bearer " + cached.accessToken, "Content-Type": "application/json" };
  const credentials = JSON.parse(credentialsJson);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" }).setProtectedHeader({ alg: "RS256" }).setIssuer(credentials.client_email)
    .setAudience("https://oauth2.googleapis.com/token").setIssuedAt().setExpirationTime("5m").sign(await importPKCS8(credentials.private_key, "RS256"));
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(15000) });
  const data = await response.json(); if (!response.ok || !data.access_token) throw Error("GOOGLE_AUTH_FAILED");
  cached = { accessToken: data.access_token, expires: Date.now() + Math.min(3600, Number(data.expires_in) || 3600) * 1000 };
  return { Authorization: "Bearer " + cached.accessToken, "Content-Type": "application/json" };
}
