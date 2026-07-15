"use server";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@silonya/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";

export async function logoutAction(): Promise<void> {
  const ctx = await getCustomerContext();

  if (ctx.customerSession) {
    const caller = createServerCaller(ctx);
    await caller.customerAuth.logout();
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);

  redirect("/");
}
