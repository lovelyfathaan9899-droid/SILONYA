import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

// Same "throw a clear error until configured" pattern as media.ts's
// requireCloudinaryEnv — this file typechecks/builds and the app boots with
// no Stripe credentials present; only calling getStripeClient() from a
// payment route requires them, so every non-payment page (home, PLP/PDP,
// auth, admin dashboard) is unaffected by Stripe being unconfigured.
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe is not configured.",
    });
  }
  return new Stripe(secretKey);
}
