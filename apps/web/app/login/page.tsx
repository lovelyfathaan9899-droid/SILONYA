import { Section } from "@silonya/ui";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <Section spacing="lg">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-8">
        <h1 className="font-display text-ink text-3xl">Sign in</h1>
        <LoginForm {...(next ? { next } : {})} />
      </div>
    </Section>
  );
}
