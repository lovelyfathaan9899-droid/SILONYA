import { generateReport, reportToCsv, reportToExcelBuffer } from "@silonya/api";
import { ADMIN_ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@silonya/auth";
import { prisma } from "@silonya/database";
import { NextResponse, type NextRequest } from "next/server";

/**
 * REST route (API_SPECIFICATION.md §3) rather than a tRPC procedure —
 * report downloads are binary/text file responses, not JSON. Gated inline
 * (cookie → JWT → RBAC permission check) since it sits outside the tRPC
 * context/middleware pipeline.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  if (!payload?.role) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }

  const grant = await prisma.rolePermission.findFirst({
    where: { role: { name: payload.role }, permission: { key: "analytics:read" } },
  });
  if (!grant) {
    return NextResponse.json(
      { error: "Missing required permission: analytics:read" },
      { status: 403 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get("period");
  const format = searchParams.get("format") ?? "csv";
  const dateParam = searchParams.get("date");

  if (period !== "daily" && period !== "weekly" && period !== "monthly") {
    return NextResponse.json(
      { error: "period must be one of: daily, weekly, monthly" },
      { status: 400 },
    );
  }
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "format must be one of: csv, xlsx" }, { status: 400 });
  }

  const anchor = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const summary = await generateReport(period, anchor);
  const filenameBase = `silonya-${period}-report-${summary.startsAt.toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(reportToCsv(summary), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  const buffer = await reportToExcelBuffer(summary);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  });
}
