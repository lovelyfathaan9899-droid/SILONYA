import { Button, Section } from "@silonya/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { createServerCaller } from "@/lib/trpc-caller";

export const metadata: Metadata = { title: "Verify your email" };

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  let verified = false;
  if (token) {
    const caller = createServerCaller();
    verified = await caller.customerAuth
      .verifyEmail({ token })
      .then(() => true)
      .catch(() => false);
  }

  return (
    <Section spacing="lg">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="font-display text-ink text-3xl">
          {verified ? "Email verified" : "Verification link invalid"}
        </h1>
        <p className="text-stone font-sans text-sm">
          {verified
            ? "Thanks for confirming your email address."
            : "This link is invalid or has expired. You can request a new one from your account settings."}
        </p>
        <Button asChild>
          <Link href={verified ? "/account" : "/login"}>
            {verified ? "Go to your account" : "Sign in"}
          </Link>
        </Button>
      </div>
    </Section>
  );
}
