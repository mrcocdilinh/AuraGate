import { NextResponse } from "next/server";
import { getSellers } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sellers: await getSellers() });
}
