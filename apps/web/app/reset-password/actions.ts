"use server";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createServerCaller } from "@/lib/trpc-caller";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export interface ResetPasswordState {
  error?: string;
  success?: boolean;
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const caller = createServerCaller();
    await caller.customerAuth.resetPassword(parsed.data);
  } catch (err) {
    if (err instanceof TRPCError) {
      return { error: err.message };
    }
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}
