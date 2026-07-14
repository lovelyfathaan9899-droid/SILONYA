import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — SILONYA Admin",
};

export default function LoginPage() {
  return (
    <main className="bg-bone flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="font-display text-ink text-2xl">SILONYA Admin</h1>
      <LoginForm />
    </main>
  );
}
