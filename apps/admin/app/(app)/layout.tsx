import { createServerCaller } from "@/lib/trpc-caller";
import { getAdminContext } from "@/lib/admin-context";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "./AdminShell";

// Auth gate for every page under this route group — centralized here so
// individual pages (Overview, Products, ...) don't each duplicate the
// redirect check (AUTHENTICATION.md §1 — server-side session validation on
// every protected request).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx.adminSession) {
    redirect("/login");
  }

  const caller = createServerCaller(ctx);
  const session = await caller.adminAuth.session();

  return (
    <AdminShell adminEmail={session.email} adminRole={session.role}>
      {children}
    </AdminShell>
  );
}
