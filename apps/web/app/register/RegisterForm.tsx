"use client";

import { Button, Checkbox, Input, Label } from "@silonya/ui";
import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="marketingOptIn" name="marketingOptIn" />
        <Label htmlFor="marketingOptIn">Send me news and offers</Label>
      </div>
      {state.error ? (
        <p role="alert" className="text-error text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-stone font-sans text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
