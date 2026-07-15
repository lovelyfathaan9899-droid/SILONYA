"use server";

import { z } from "zod";
import { createServerCaller } from "@/lib/trpc-caller";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.") });

export interface ForgotPasswordState {
  error?: string;
  success?: boolean;
}

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const caller = createServerCaller();
  await caller.customerAuth.requestPasswordReset(parsed.data);

  // Always the same response regardless of whether the email exists
  // (AUTHENTICATION.md §2.4 — never leak account existence).
  return { success: true };
}
