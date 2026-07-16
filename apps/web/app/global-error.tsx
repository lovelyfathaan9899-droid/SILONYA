"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself (error.tsx can't, since
 * it renders inside that layout) — must render its own <html>/<body> since
 * the layout that would normally provide them is what crashed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Something went wrong.</h1>
        <p style={{ color: "#666", marginTop: "0.5rem" }}>
          We&apos;ve been notified. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1.25rem",
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
