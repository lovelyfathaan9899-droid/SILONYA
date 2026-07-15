"use server";

import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  sessionCookieOptions,
} from "@silonya/auth";
import { TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const ctx = await getCustomerContext();
    const caller = createServerCaller(ctx);
    const result = await caller.customerAuth.changePassword(parsed.data);

    const cookieStore = await cookies();
    cookieStore.set(
      ACCESS_TOKEN_COOKIE,
      result.tokens.accessToken,
      sessionCookieOptions(ACCESS_TOKEN_TTL_SECONDS),
    );
    cookieStore.set(
      REFRESH_TOKEN_COOKIE,
      result.tokens.refreshToken,
      sessionCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
    );
  } catch (err) {
    if (err instanceof TRPCError) {
      return { error: err.message };
    }
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

export async function resendVerificationAction(): Promise<{ success: boolean }> {
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);
  await caller.customerAuth.resendVerification();
  return { success: true };
}
