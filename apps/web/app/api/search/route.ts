import { NextResponse } from "next/server";
import { createServerCaller } from "@/lib/trpc-caller";

/**
 * Thin JSON endpoint wrapping `catalog.search` for the client-side
 * SearchPalette (debounced as-you-type search needs a plain `fetch`, and
 * apps/web deliberately has no client-side tRPC/react-query setup —
 * SEO_ARCHITECTURE.md §2 keeps every indexable page server-rendered, so this
 * is the one small CSR-only exception).
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const caller = createServerCaller();
  const results = await caller.catalog.search({ query, limit: 8 });
  return NextResponse.json({ results });
}
