"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The Stripe webhook (PAYMENT_ARCHITECTURE.md §2) may not have landed yet when the browser redirects back — this refreshes the page once so the status updates without the customer having to reload manually. */
export function PendingOrderRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.refresh();
    }, 2500);
    return () => {
      clearTimeout(timer);
    };
  }, [router]);

  return null;
}
