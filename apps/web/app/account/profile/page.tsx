import type { Metadata } from "next";
import { getCustomerContext } from "@/lib/customer-context";
import { createServerCaller } from "@/lib/trpc-caller";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const ctx = await getCustomerContext();
  const caller = createServerCaller(ctx);
  const profile = await caller.account.profile.get();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-ink text-2xl">Profile</h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
