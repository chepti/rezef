import { SignJWT } from "jose";
import fs from "node:fs";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const B = "http://localhost:3100";
const enc = (s: string) => new TextEncoder().encode(s);

async function token(opts: { secret?: string; aud?: string; iss?: string; state: string; exp?: string; sub?: string }) {
  return new SignJWT({ name: "מורה בדיקה", state: opts.state })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.sub ?? "777")
    .setAudience(opts.aud ?? "rezef")
    .setIssuer(opts.iss ?? "https://openstuff.co.il")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "2m")
    .sign(enc(opts.secret ?? env.REZEF_BRIDGE_SECRET));
}

function cookieOf(res: Response, name: string) {
  const all = res.headers.getSetCookie();
  const c = all.find((x) => x.startsWith(name + "="));
  return c ? c.split(";")[0] : null;
}

async function main() {
  const noAuth = await fetch(`${B}/api/groups`);
  console.log("1 no cookie ->", noAuth.status, "(expect 401)");

  const start = await fetch(`${B}/api/auth/start`, { redirect: "manual" });
  const loc = start.headers.get("location") ?? "";
  const stateCookie = cookieOf(start, "rezef_state")!;
  const state = decodeURIComponent(stateCookie.split("=")[1]);
  console.log("2 start ->", start.status, loc.startsWith("https://openstuff.co.il/?rezef_login=1&state="), "(expect 307/302 true)");

  const bad: Array<[string, Parameters<typeof token>[0], string]> = [
    ["3 wrong secret", { state, secret: "x".repeat(40) }, "token"],
    ["4 wrong audience", { state, aud: "other" }, "token"],
    ["5 wrong issuer", { state, iss: "https://evil.example" }, "token"],
    ["6 expired", { state, exp: "-10s" }, "token"],
    ["7 wrong state", { state: "different-state-value-123456" }, "state"],
  ];
  for (const [label, opts, want] of bad) {
    const r = await fetch(`${B}/api/auth/callback?token=${await token(opts)}`, { redirect: "manual", headers: { cookie: stateCookie } });
    const to = r.headers.get("location") ?? "";
    console.log(label, "->", to.includes(`login_error=${want}`) ? "rejected OK" : `UNEXPECTED ${r.status} ${to}`, "session cookie:", !!cookieOf(r, "rezef_session"));
  }

  const noState = await fetch(`${B}/api/auth/callback?token=${await token({ state })}`, { redirect: "manual" });
  console.log("8 valid token, no state cookie ->", noState.headers.get("location")?.includes("login_error=state") ? "rejected OK" : "UNEXPECTED");

  const ok = await fetch(`${B}/api/auth/callback?token=${await token({ state })}`, { redirect: "manual", headers: { cookie: stateCookie } });
  const session = cookieOf(ok, "rezef_session");
  console.log("9 valid ->", ok.status, "session set:", !!session, "(expect true)");

  const me = await fetch(`${B}/api/auth/me`, { headers: { cookie: session! } });
  console.log("10 /me with session ->", me.status, await me.text());
  const forged = await fetch(`${B}/api/auth/me`, { headers: { cookie: "rezef_session=abc.def.ghi" } });
  console.log("11 forged session ->", forged.status, "(expect 401)");
}
main();
