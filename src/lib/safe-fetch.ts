import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

export class UnsafeUrlError extends Error {}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const n = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    // IPv4 ממופה: ::ffff:a.b.c.d
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return (
      lower.startsWith("fc") || // unique local
      lower.startsWith("fd") ||
      lower.startsWith("fe8") || // link-local
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff") // multicast
    );
  }
  return true;
}

// הבדיקה נעשית בזמן החיבור עצמו (לא לפני), כדי לסגור DNS rebinding.
const guardedLookup: typeof dns.lookup = ((
  hostname: string,
  options: dns.LookupOptions | number | undefined,
  callback: (...args: unknown[]) => void,
) => {
  const opts = typeof options === "object" && options ? options : {};
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    const safe = list.filter((a) => !isBlockedAddress(a.address));
    if (safe.length === 0) {
      return callback(new UnsafeUrlError("כתובת פנימית או חסומה"));
    }
    if (opts.all) return callback(null, safe);
    return callback(null, safe[0].address, safe[0].family);
  });
}) as typeof dns.lookup;

export type SafeResponse = {
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
};

function requestOnce(url: URL, accept: string): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "RezefBot/1.0 (+https://openstuff.co.il)",
          accept,
          "accept-encoding": "identity",
          "accept-language": "he,en;q=0.8",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BYTES) {
            // די לנו ב-512KB הראשונים: התגיות נמצאות בראש המסמך.
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        const done = () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(rawUrl: string, accept = "text/html,*/*;q=0.8"): Promise<SafeResponse> {
  let current = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new UnsafeUrlError("פרוטוקול לא נתמך");
    }
    // כתובת IP ישירה בקישור: חוסמים לפני שמגיעים ל-lookup.
    const bareHost = current.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(bareHost) && isBlockedAddress(bareHost)) {
      throw new UnsafeUrlError("כתובת פנימית או חסומה");
    }
    const res = await requestOnce(current, accept);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, current);
      continue;
    }
    return {
      status: res.status,
      finalUrl: current.toString(),
      contentType: String(res.headers["content-type"] ?? ""),
      body: res.body,
    };
  }
  throw new Error("יותר מדי הפניות");
}
