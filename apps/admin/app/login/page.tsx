import type { Metadata } from "next";
import { Wordmark } from "@silonya/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — SILONYA Admin",
};

export default function LoginPage() {
  return (
    <main className="bg-bone flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex items-center gap-2">
        <Wordmark className="text-2xl" />
        <span className="text-stone font-sans text-xs uppercase tracking-wide">Admin</span>
      </div>
      <LoginForm />
    </main>
  );
}
