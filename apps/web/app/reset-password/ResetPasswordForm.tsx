"use client";

import { Button, Input, Label } from "@silonya/ui";
import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-ink font-sans text-sm">Your password has been reset.</p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-error text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
