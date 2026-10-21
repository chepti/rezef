import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "rezef_session";
export const STATE_COOKIE = "rezef_state";
const SESSION_DAYS = 30;

function secretKey(name: "REZEF_BRIDGE_SECRET" | "SESSION_SECRET"): Uint8Array {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} חסר או קצר מדי (נדרשים 32 תווים לפחות)`);
  }
  return new TextEncoder().encode(value);
}

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function appUrl(req: Request): string {
  return (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

export async function createSessionToken(teacherId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(teacherId))
    .setAudience("rezef-session")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey("SESSION_SECRET"));
}

export async function readSessionToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey("SESSION_SECRET"), {
      algorithms: ["HS256"],
      audience: "rezef-session",
    });
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export type BridgeClaims = { wpUserId: number; name: string; state: string };

export async function verifyBridgeToken(token: string): Promise<BridgeClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey("REZEF_BRIDGE_SECRET"), {
      algorithms: ["HS256"],
      audience: "rezef",
      issuer: process.env.WP_URL ?? "https://openstuff.co.il",
    });
    const wpUserId = Number(payload.sub);
    if (!Number.isInteger(wpUserId) || wpUserId < 1 || typeof payload.state !== "string") return null;
    return { wpUserId, name: String(payload.name ?? "מורה"), state: payload.state };
  } catch {
    return null;
  }
}

// פיילוט: PILOT_WP_USER_IDS="12,34" מגביל כניסה למורים מסוימים. ריק = פתוח לכל מורה מחובר.
export function isPilotAllowed(wpUserId: number): boolean {
  const raw = process.env.PILOT_WP_USER_IDS?.trim();
  if (!raw) return true;
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .includes(wpUserId);
}
