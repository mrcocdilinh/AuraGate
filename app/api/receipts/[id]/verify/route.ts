import { NextRequest, NextResponse } from "next/server";
import { getReceipt } from "@/lib/store";
import { buildReceiptProof, verifyProofStructure } from "@/lib/proof";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * Public receipt verification + proof export.
 *
 *   GET /api/receipts/:id/verify             → JSON { verified, checks, proof }
 *   GET /api/receipts/:id/verify?download=1  → downloadable proof JSON file
 *
 * No auth — proofs are meant to be publicly checkable. This is the wedge:
 * a self-certifying, signed payment proof anyone can verify off the registry.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const receipt = await getReceipt(id);
  if (!receipt) {
    return withCors(NextResponse.json({ error: "not_found" }, { status: 404 }));
  }

  const proof = await buildReceiptProof(receipt);
  const { checks, verified } = verifyProofStructure(proof);

  const download = req.nextUrl.searchParams.get("download");
  if (download) {
    return withCors(
      new NextResponse(JSON.stringify(proof, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="auragate-proof-${id}.json"`,
        },
      }) as unknown as NextResponse
    );
  }

  return withCors(
    NextResponse.json({
      verified,
      checks,
      proof,
    })
  );
}
