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

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const next = formData.get("next");
  const redirectTo = typeof next === "string" && next.startsWith("/") ? next : "/account";

  try {
    const caller = createServerCaller();
    const result = await caller.customerAuth.login(parsed.data);

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

  redirect(redirectTo);
}
