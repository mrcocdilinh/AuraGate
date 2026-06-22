import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC, explorerTx } from "./arc";
import type { Receipt } from "./types";

/**
 * AuraGate Receipt Proof — the verifiable wedge Circle's marketplace doesn't have.
 *
 * A proof is a canonical, self-certifying record of a single x402 payment:
 *   - what was paid (payer, seller, amount, asset, network)
 *   - what was delivered (resultHash — keccak256 of the canonical response body)
 *   - the request it answered (requestHash)
 *   - where it settled on-chain (contract, tx, settlementRef)
 *
 * Anyone holding the original response body can recompute resultHash and confirm
 * the data was not altered. When DEPLOYER_PRIVATE_KEY is set, AuraGate also signs
 * the proof digest (EIP-191) so the proof is attributable to this registry.
 *
 * The structure is intentionally EAS-compatible (Ethereum Attestation Service):
 * `schema` + flat `data` fields map 1:1 to an EAS schema, so a proof can later be
 * promoted to an on-chain attestation without reshaping.
 */

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

/** EAS-style schema definition for an AuraGate receipt attestation. */
export const PROOF_SCHEMA = {
  uid: "auragate.receipt.v1",
  definition:
    "address payer,address seller,bytes32 serviceId,uint256 amount,address asset,bytes32 requestHash,bytes32 resultHash,bytes32 settlementRef,uint64 timestamp",
} as const;

export interface ReceiptProof {
  schema: string;
  version: "1";
  receiptId: string;
  data: {
    payer: string;
    seller: string;
    serviceSlug: string;
    serviceId: `0x${string}`;
    amount: string;
    amountAtomic: string;
    asset: string;
    network: string;
    chainId: number;
    requestHash: string;
    resultHash: string;
    settlementRef: string;
    mode: string;
    timestamp: string;
  };
  onchain: {
    registry: string;
    registryVersion: string;
    tx: string | null;
    explorerUrl: string | null;
    recorded: boolean;
  };
  /** keccak256 over the canonical data — the value that gets signed/attested. */
  digest: `0x${string}`;
  /** EIP-191 signature of `digest` by the AuraGate registry key (if configured). */
  signature: string | null;
  signer: string | null;
  /** How a third party independently re-verifies this proof. */
  verifyInstructions: string;
}

function serviceIdOf(slug: string): `0x${string}` {
  return keccak256(toBytes(slug));
}

function atomic(amountUsd: string): string {
  return BigInt(Math.round(Number(amountUsd) * 1_000_000)).toString();
}

/** Canonical digest over the proof data — order-stable, the value we sign/attest. */
export function proofDigest(d: ReceiptProof["data"]): `0x${string}` {
  const canonical = [
    d.payer.toLowerCase(),
    d.seller.toLowerCase(),
    d.serviceId.toLowerCase(),
    d.amountAtomic,
    d.asset.toLowerCase(),
    d.requestHash.toLowerCase(),
    d.resultHash.toLowerCase(),
    d.settlementRef.toLowerCase(),
    d.timestamp,
  ].join("|");
  return keccak256(toBytes(`auragate.receipt.v1:${canonical}`));
}

/** Build the (optionally signed) proof for a receipt. */
export async function buildReceiptProof(r: Receipt): Promise<ReceiptProof> {
  const data: ReceiptProof["data"] = {
    payer: r.payer,
    seller: r.sellerAddress ?? "",
    serviceSlug: r.serviceSlug,
    serviceId: serviceIdOf(r.serviceSlug),
    amount: r.amount,
    amountAtomic: atomic(r.amount),
    asset: ARC.usdcAddress,
    network: ARC.caip2,
    chainId: ARC.chainId,
    requestHash: HEX32.test(r.requestHash ?? "") ? (r.requestHash as string) : ZERO32,
    resultHash: r.resultHash,
    settlementRef: HEX32.test(r.settlementRef ?? "") ? (r.settlementRef as string) : ZERO32,
    mode: r.mode ?? "testnet",
    timestamp: r.createdAt,
  };

  const digest = proofDigest(data);

  let signature: string | null = null;
  let signer: string | null = null;
  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
    try {
      const account = privateKeyToAccount(pk);
      signature = await account.signMessage({ message: { raw: digest } });
      signer = account.address;
    } catch {
      /* signing best-effort */
    }
  }

  const recorded = Boolean(r.onchainTx && HEX32.test(r.onchainTx));
  return {
    schema: PROOF_SCHEMA.uid,
    version: "1",
    receiptId: r.id,
    data,
    onchain: {
      registry: ARC.receiptRegistry,
      registryVersion: ARC.receiptRegistryVersion,
      tx: r.onchainTx ?? null,
      explorerUrl: recorded ? explorerTx(r.onchainTx as string) : null,
      recorded,
    },
    digest,
    signature,
    signer,
    verifyInstructions:
      "Recompute resultHash = keccak256(canonicalJSON(responseBody)) and compare to data.resultHash. " +
      "Recompute digest from data fields (see proofDigest) and verify `signature` against `signer` via EIP-191.",
  };
}

export interface ProofChecks {
  resultHashValid: boolean;
  requestHashPresent: boolean;
  settlementRefPresent: boolean;
  onchainRecorded: boolean;
  signed: boolean;
  sellerKnown: boolean;
}

/** Structural verification a caller can run without the original response body. */
export function verifyProofStructure(p: ReceiptProof): { checks: ProofChecks; verified: boolean } {
  const checks: ProofChecks = {
    resultHashValid: HEX32.test(p.data.resultHash),
    requestHashPresent: p.data.requestHash !== ZERO32,
    settlementRefPresent: p.data.settlementRef !== ZERO32,
    onchainRecorded: p.onchain.recorded,
    signed: Boolean(p.signature),
    sellerKnown: ADDR.test(p.data.seller),
  };
  // A proof is "verified" structurally when the result hash is well-formed and the
  // canonical digest matches the data (recomputed here).
  const digestOk = proofDigest(p.data) === p.digest;
  return { checks, verified: checks.resultHashValid && digestOk };
}
