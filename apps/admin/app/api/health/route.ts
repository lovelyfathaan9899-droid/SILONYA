import { prisma } from "@silonya/database";
import { NextResponse } from "next/server";

/** DEPLOYMENT.md §6 — uptime/health signal for synthetic monitoring. */
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", database: "unreachable", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
