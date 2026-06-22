import test from "node:test";
import assert from "node:assert/strict";
import { resultHash, requestHash } from "../lib/hash";
import { buildOwnerActionMessage } from "../lib/owner-auth";
import { isTrustedReceipt } from "../lib/trust";
import { assertPublicHttpUrl } from "../lib/safe-url";
import type { Receipt } from "../lib/types";

test("resultHash is deterministic regardless of object key order", () => {
  const a = resultHash({ b: 2, a: 1 });
  const b = resultHash({ a: 1, b: 2 });
  assert.equal(a, b);
  assert.match(a, /^0x[0-9a-f]{64}$/);
});

test("requestHash includes method, path, query, service and payer", () => {
  const h1 = requestHash({
    method: "GET",
    url: "https://auragate.app/api/premium/oracle-check?coins=bitcoin",
    serviceSlug: "oracle-check",
    payer: "0x0000000000000000000000000000000000000001",
  });
  const h2 = requestHash({
    method: "POST",
    url: "https://auragate.app/api/premium/oracle-check?coins=bitcoin",
    serviceSlug: "oracle-check",
    payer: "0x0000000000000000000000000000000000000001",
  });
  assert.notEqual(h1, h2);
});

test("owner action message is canonical", () => {
  const msg = buildOwnerActionMessage({
    action: "service:update",
    subject: "oracle-check",
    ownerAddress: "0x0000000000000000000000000000000000000001",
    nonce: "abc",
    issuedAt: "2026-06-22T00:00:00.000Z",
    extra: { active: true },
  });
  assert.match(msg, /action:service:update/);
  assert.match(msg, /subject:oracle-check/);
  assert.match(msg, /active:true/);
});

test("trusted receipts exclude mock and seed rows", () => {
  const base: Receipt = {
    id: "r1",
    paymentId: "p1",
    serviceSlug: "oracle-check",
    payer: "0x0000000000000000000000000000000000000001",
    amount: "0.01",
    resultHash: "0x" + "1".repeat(64),
    createdAt: new Date().toISOString(),
  };
  assert.equal(isTrustedReceipt(base), true);
  assert.equal(isTrustedReceipt({ ...base, mode: "mock" }), false);
  assert.equal(isTrustedReceipt({ ...base, paymentId: "seed-1" }), false);
});

test("safe URL validation rejects localhost", async () => {
  await assert.rejects(
    () => assertPublicHttpUrl("http://localhost:3000/x402"),
    /Only public HTTPS|Localhost/
  );
});
