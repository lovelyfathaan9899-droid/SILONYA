import { Section } from "@silonya/ui";
import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <Section spacing="lg">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-8">
        <h1 className="font-display text-ink text-3xl">Create your account</h1>
        <RegisterForm />
      </div>
    </Section>
  );
}
