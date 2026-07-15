"use client";

import { Button, Input, Label } from "@silonya/ui";
import { useActionState } from "react";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  if (state.success) {
    return (
      <p className="text-ink font-sans text-sm">
        If an account exists for that email, we&apos;ve sent a link to reset your password.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.error ? (
        <p role="alert" className="text-error text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
