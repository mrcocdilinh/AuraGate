import { lookup } from "dns/promises";
import { isIP } from "net";

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function isBlockedIpv4(ip: string): boolean {
  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].some(([base, bits]) => inCidr(ip, String(base), Number(bits)));
}

function isBlockedIpv6(ip: string): boolean {
  const v = ip.toLowerCase();
  return (
    v === "::1" ||
    v === "::" ||
    v.startsWith("fc") ||
    v.startsWith("fd") ||
    v.startsWith("fe80:") ||
    v.startsWith("::ffff:127.") ||
    v.startsWith("::ffff:10.") ||
    v.startsWith("::ffff:192.168.")
  );
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

export async function assertPublicHttpUrl(raw: string): Promise<string> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && process.env.ALLOW_HTTP_SELLER_ENDPOINTS !== "true") {
    throw new Error("Only public HTTPS URLs are allowed");
  }
  if (!["https:", "http:"].includes(u.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (u.username || u.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }

  const hostname = u.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Localhost URLs are not allowed");
  }

  const literal = isIP(hostname);
  const addresses = literal
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new Error("URL must resolve to public internet addresses");
  }

  return u.toString();
}
