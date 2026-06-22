import test from "node:test";
import assert from "node:assert/strict";
import { buildReceiptProof, verifyProofStructure, proofDigest } from "../lib/proof";
import { checkSpendPolicy, refundSpend } from "../lib/spend-policy";
import type { Receipt } from "../lib/types";

const baseReceipt: Receipt = {
  id: "rcpt-1",
  paymentId: "pay-1",
  serviceSlug: "oracle-check",
  payer: "0x1111111111111111111111111111111111111111",
  sellerAddress: "0x2222222222222222222222222222222222222222",
  amount: "0.005",
  resultHash: "0x" + "a".repeat(64),
  requestHash: "0x" + "b".repeat(64),
  mode: "testnet",
  createdAt: "2026-06-22T00:00:00.000Z",
};

test("receipt proof is structurally verifiable and digest is stable", async () => {
  const proof = await buildReceiptProof(baseReceipt);
  const { verified, checks } = verifyProofStructure(proof);
  assert.equal(verified, true);
  assert.equal(checks.resultHashValid, true);
  assert.equal(checks.requestHashPresent, true);
  assert.equal(checks.sellerKnown, true);
  // Digest recomputation matches.
  assert.equal(proofDigest(proof.data), proof.digest);
});

test("tampering with the result hash breaks digest verification", async () => {
  const proof = await buildReceiptProof(baseReceipt);
  const tampered = { ...proof, data: { ...proof.data, resultHash: "0x" + "c".repeat(64) } };
  const { verified } = verifyProofStructure(tampered);
  assert.equal(verified, false);
});

test("spend policy enforces per-transaction cap", () => {
  // Default BUY_MAX_PER_TX_USDC = 1 USDC.
  const wallet = "0x" + "d".repeat(40);
  const seller = "0x" + "e".repeat(40);
  const ok = checkSpendPolicy({ wallet, seller, amountUsd: "0.50" });
  assert.equal(ok.ok, true);
  const tooBig = checkSpendPolicy({ wallet, seller, amountUsd: "5.00" });
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.error, "exceeds_per_tx_limit");
  refundSpend(wallet, "0.50");
});

test("spend policy enforces rolling per-wallet window cap", () => {
  // Default window cap = 5 USDC. Spend 1 USDC five times → 6th blocked.
  const wallet = "0x" + "f".repeat(40);
  const seller = "0x" + "1".repeat(40);
  for (let i = 0; i < 5; i++) {
    assert.equal(checkSpendPolicy({ wallet, seller, amountUsd: "1.00" }).ok, true);
  }
  const blocked = checkSpendPolicy({ wallet, seller, amountUsd: "1.00" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "exceeds_window_limit");
});

test("refund releases reserved spend", () => {
  const wallet = "0x" + "2".repeat(40);
  const seller = "0x" + "3".repeat(40);
  // Fill the window, then refund and re-spend.
  for (let i = 0; i < 5; i++) {
    checkSpendPolicy({ wallet, seller, amountUsd: "1.00" });
  }
  assert.equal(checkSpendPolicy({ wallet, seller, amountUsd: "1.00" }).ok, false);
  refundSpend(wallet, "1.00");
  assert.equal(checkSpendPolicy({ wallet, seller, amountUsd: "1.00" }).ok, true);
});
