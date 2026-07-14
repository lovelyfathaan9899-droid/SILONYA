"use server";

import { getAdminContext } from "@/lib/admin-context";
import { createServerCaller } from "@/lib/trpc-caller";
import { ADMIN_ACCESS_TOKEN_COOKIE, ADMIN_REFRESH_TOKEN_COOKIE } from "@silonya/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction(): Promise<void> {
  const ctx = await getAdminContext();

  if (ctx.adminSession) {
    const caller = createServerCaller(ctx);
    await caller.adminAuth.logout();
  }

  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(ADMIN_REFRESH_TOKEN_COOKIE);

  redirect("/login");
}
