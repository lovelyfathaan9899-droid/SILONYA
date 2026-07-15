import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";

const FROM_ADDRESS = "SILONYA <orders@silonya.com>";

/**
 * No RESEND_API_KEY exists yet — logs the rendered email instead of sending
 * it, same "stub until configured" pattern as media.ts's Cloudinary check,
 * except this one doesn't throw: a missing email provider shouldn't fail
 * the checkout flow that triggered it (ORDER_MANAGEMENT.md §9 — email
 * delivery is decoupled from the request path). Swap in the FROM_ADDRESS
 * for a real verified sending domain once Resend is configured.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const html = await render(input.react);

  if (!apiKey) {
    console.warn(
      `[emails] RESEND_API_KEY not set — email not sent. To: ${input.to} | Subject: ${input.subject}`,
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: input.subject,
    html,
  });

  if (error) {
    console.error("[emails] Resend send failed:", error);
  }
}
