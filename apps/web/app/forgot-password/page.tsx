import { Section } from "@silonya/ui";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Section spacing="lg">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-8">
        <h1 className="font-display text-ink text-3xl">Forgot your password?</h1>
        <p className="text-stone text-center font-sans text-sm">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
        <ForgotPasswordForm />
      </div>
    </Section>
  );
}
