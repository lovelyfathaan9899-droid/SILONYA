import type { Metadata } from "next";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ResendVerificationButton } from "./ResendVerificationButton";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);
  const session = await caller.customerAuth.session();

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-display text-ink text-2xl">Settings</h1>

      <div>
        <h2 className="font-display text-ink mb-3 text-lg">Email verification</h2>
        {session.emailVerifiedAt ? (
          <p className="text-stone font-sans text-sm">Your email is verified.</p>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-stone font-sans text-sm">Your email isn&apos;t verified yet.</p>
            <ResendVerificationButton />
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-ink mb-3 text-lg">Change password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
