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
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerCaller } from "@/lib/trpc-caller";

const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  marketingOptIn: z.boolean().default(false),
});

export interface RegisterState {
  error?: string;
}

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const caller = createServerCaller();
    const result = await caller.customerAuth.register(parsed.data);

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

  redirect("/account");
}
