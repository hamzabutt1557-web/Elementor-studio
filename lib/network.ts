import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
export function publicIP(ip: string) {
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return !(
      p[0] === 0 ||
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 &&
        (p[1] === 168 || p[1] === 0 || (p[1] === 88 && p[2] === 99))) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51)) ||
      (p[0] === 203 && p[1] === 0 && p[2] === 113)
    );
  }
  // Conservatively permit only global unicast IPv6; reject mapped and local addresses.
  return (
    isIP(ip) === 6 &&
    /^[23][0-9a-f]{3}:/i.test(ip) &&
    !ip.toLowerCase().startsWith("2001:db8:") &&
    !ip.toLowerCase().startsWith("2002:")
  );
}
export function normalizeUrl(raw: string) {
  const u = new URL(raw);
  if (
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port))
  )
    throw new Error(
      "Use a public HTTP or HTTPS website URL without credentials or custom ports.",
    );
  const h = u.hostname.replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    (!h.includes(".") && !isIP(h)) ||
    (isIP(h) && !publicIP(h))
  )
    throw new Error("Private and local addresses are blocked.");
  u.hash = "";
  return u;
}
export function pinnedLookup(address: {
  address: string;
  family: number;
}): NonNullable<http.RequestOptions["lookup"]> {
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  };
}
export async function safeFetch(
  raw: string,
  limit = 2_000_000,
  redirects = 0,
): Promise<{ body: Buffer; type: string; url: string; status: number }> {
  if (redirects > 4) throw new Error("Too many redirects.");
  const u = normalizeUrl(raw);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !publicIP(a.address)))
    throw new Error(
      "The website resolves to a private or unsupported network address.",
    );
  const addr = addresses[0];
  const result = await new Promise<{
    body: Buffer;
    type: string;
    status: number;
    location?: string;
  }>((resolve, reject) => {
    const transport = u.protocol === "https:" ? https : http;
    const req = transport.request(
      u,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "ElementorStudio/0.1 (+authorized public-page conversion)",
          "Accept-Encoding": "identity",
        },
        lookup: pinnedLookup(addr),
      },
      (res) => {
        const status = res.statusCode || 500;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({
            body: Buffer.alloc(0),
            type: "",
            status,
            location: res.headers.location,
          });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > limit) {
            res.destroy(
              new Error("Page or asset is too large for this export."),
            );
            return;
          }
          chunks.push(c);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            body: Buffer.concat(chunks),
            type: res.headers["content-type"] || "",
            status,
          }),
        );
      },
    );
    const deadline = setTimeout(() => req.destroy(new Error("The website exceeded the request deadline.")), 15000);
    req.once("close", () => clearTimeout(deadline));
    req.setTimeout(12000, () =>
      req.destroy(new Error("The website took too long to respond.")),
    );
    req.on("error", reject);
    req.end();
  });
  if (result.location)
    return safeFetch(new URL(result.location, u).href, limit, redirects + 1);
  if (result.status >= 400)
    throw new Error(
      `The website returned HTTP ${result.status}. Try another public page.`,
    );
  return { ...result, url: u.href };
}
