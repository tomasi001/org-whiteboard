import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { orgBuilderRequestSchema } from "@/lib/schemas";
import { runOrgBuilderAgent } from "@/lib/orgBuilderAgent";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`org-builder:${getClientIp(request)}`, 40, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = orgBuilderRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid org builder request payload." }, { status: 400 });
    }

    const result = await runOrgBuilderAgent(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Org builder API error:", error);
    return NextResponse.json({ error: "Failed to process org builder request." }, { status: 500 });
  }
}
