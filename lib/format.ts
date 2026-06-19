export function shortAddr(addr?: string): string {
  if (!addr) return "—";
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function usd(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!isFinite(n)) return "$0";
  const decimals = n < 0.01 ? 4 : 2;
  return `$${n.toFixed(decimals)}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function resultHash(body: unknown): string {
  const str = typeof body === "string" ? body : JSON.stringify(body);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  let out = "";
  let seed = h1 >>> 0;
  for (let i = 0; i < 64; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    out += (seed % 16).toString(16);
  }
  return `0x${out}`;
}