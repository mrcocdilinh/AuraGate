import type { Receipt } from "./types";

export function isTrustedReceipt(r: Receipt): boolean {
  return r.mode !== "mock" && !String(r.paymentId).startsWith("seed-");
}
