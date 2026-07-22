"use client";

import { useEffect } from "react";
import { refreshSessionAction } from "@/app/refresh-session-action";
import { useIsLoggedIn } from "@/lib/customer-session-client";

// 10 minutes — inside the 15-minute access-token TTL (AUTHENTICATION.md
// §2.2), leaving a margin so the token never actually expires while the
// tab stays open, without refreshing so often it's wasteful.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/** Mounted once in AppShell — see app/refresh-session-action.ts's doc comment for why this exists. Renders nothing; only a logged-in visitor has a session worth extending. */
export function SessionRefresher() {
  const loggedIn = useIsLoggedIn();

  useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(() => {
      void refreshSessionAction();
    }, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [loggedIn]);

  return null;
}
