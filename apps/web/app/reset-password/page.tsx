import { Section } from "@silonya/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <Section spacing="lg">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-8">
        <h1 className="font-display text-ink text-3xl">Reset your password</h1>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-stone font-sans text-sm">
            This link is missing its reset token.{" "}
            <Link href="/forgot-password" className="text-ink underline">
              Request a new one
            </Link>
            .
          </p>
        )}
      </div>
    </Section>
  );
}
