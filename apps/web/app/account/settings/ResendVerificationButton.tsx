"use client";

import { Button, toast } from "@silonya/ui";
import { useState } from "react";
import { resendVerificationAction } from "./actions";

export function ResendVerificationButton() {
  const [sending, setSending] = useState(false);

  async function handleClick() {
    setSending(true);
    try {
      await resendVerificationAction();
      toast({ title: "Verification email sent" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" disabled={sending} onClick={() => void handleClick()}>
      {sending ? "Sending…" : "Resend verification email"}
    </Button>
  );
}
