"use server";

import { createServerCaller } from "@/lib/trpc-caller";
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_TTL_SECONDS,
  sessionCookieOptions,
} from "@silonya/auth";
import { TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
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

  try {
    const caller = createServerCaller({ adminSession: null, customerSession: null });
    const result = await caller.adminAuth.login(parsed.data);

    const cookieStore = await cookies();
    cookieStore.set(
      ADMIN_ACCESS_TOKEN_COOKIE,
      result.tokens.accessToken,
      sessionCookieOptions(ADMIN_ACCESS_TOKEN_TTL_SECONDS),
    );
    cookieStore.set(
      ADMIN_REFRESH_TOKEN_COOKIE,
      result.tokens.refreshToken,
      sessionCookieOptions(ADMIN_REFRESH_TOKEN_TTL_SECONDS),
    );
  } catch (err) {
    if (err instanceof TRPCError) {
      return { error: err.message };
    }
    return { error: "Something went wrong. Please try again." };
  }

  // redirect() throws internally — must happen outside the try/catch above
  // or it would be swallowed as a generic error.
  redirect("/");
}
