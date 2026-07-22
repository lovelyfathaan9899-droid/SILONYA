"use client";

import { useEffect } from "react";
import { refreshSessionAction } from "@/app/refresh-session-action";

// 45 minutes — inside the 1-hour access-token TTL (AUTHENTICATION.md §3),
// leaving a margin so the token never actually expires while the tab stays
// open.
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

/** Mounted once in AdminShell, which only renders for an already-authenticated admin ((app)/layout.tsx's redirect gate) — see app/refresh-session-action.ts's doc comment for why this exists. Renders nothing. */
export function SessionRefresher() {
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshSessionAction();
    }, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return null;
}
