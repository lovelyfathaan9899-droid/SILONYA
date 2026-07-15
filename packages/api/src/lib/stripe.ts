import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

// Same "throw a clear error until configured" pattern as media.ts's
// requireCloudinaryEnv — this file typechecks/builds with no Stripe
// credentials present; only calling getStripeClient() at runtime requires
// them.
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Checkout isn't configured yet (missing Stripe credentials).",
    });
  }
  return new Stripe(secretKey);
}
