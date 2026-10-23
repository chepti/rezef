import { createHash, createHmac } from "node:crypto";

const WP = () => (process.env.WP_URL ?? "https://openstuff.co.il").replace(/\/$/, "");

export type BridgeResult = { status: number; json: unknown };

// בקשה חתומה אל התוסף openstuff-rezef-bridge. חתימה: HMAC-SHA256 על timestamp.user.sha256(body),
// עם הסוד המשותף. userId=0 לבקשות מערכת (סנכרון שימוש).
export async function signedPost(path: string, userId: number, body: unknown): Promise<BridgeResult> {
  const secret = process.env.REZEF_BRIDGE_SECRET;
  if (!secret || secret.length < 32) throw new Error("REZEF_BRIDGE_SECRET חסר");
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${ts}.${userId}.${createHash("sha256").update(raw).digest("hex")}`)
    .digest("hex");

  const res = await fetch(`${WP()}/wp-json/rezef/v1/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rezef-timestamp": String(ts),
      "x-rezef-user": String(userId),
      "x-rezef-signature": signature,
    },
    body: raw,
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
