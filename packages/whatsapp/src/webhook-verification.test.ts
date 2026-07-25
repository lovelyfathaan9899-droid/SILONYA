import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyWhatsAppSignature, verifyWhatsAppSubscribeChallenge } from "./webhook-verification";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "test-verify-token";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("verifyWhatsAppSubscribeChallenge", () => {
  it("returns the challenge when mode and token both match", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "test-verify-token",
      "hub.challenge": "12345",
    });
    expect(verifyWhatsAppSubscribeChallenge(params)).toEqual({ challenge: "12345" });
  });

  it("rejects a wrong verify token", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "12345",
    });
    expect(verifyWhatsAppSubscribeChallenge(params)).toBeNull();
  });

  it("rejects a mode other than subscribe", () => {
    const params = new URLSearchParams({
      "hub.mode": "unsubscribe",
      "hub.verify_token": "test-verify-token",
      "hub.challenge": "12345",
    });
    expect(verifyWhatsAppSubscribeChallenge(params)).toBeNull();
  });

  it("rejects when WHATSAPP_WEBHOOK_VERIFY_TOKEN isn't configured", () => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "test-verify-token",
      "hub.challenge": "12345",
    });
    expect(verifyWhatsAppSubscribeChallenge(params)).toBeNull();
  });
});

describe("verifyWhatsAppSignature", () => {
  function sign(body: string): string {
    return `sha256=${createHmac("sha256", "test-app-secret").update(body, "utf8").digest("hex")}`;
  }

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifyWhatsAppSignature(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body signed for different content", () => {
    const body = JSON.stringify({ hello: "world" });
    const signatureForOtherBody = sign(JSON.stringify({ hello: "mallory" }));
    expect(verifyWhatsAppSignature(body, signatureForOtherBody)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWhatsAppSignature("{}", null)).toBe(false);
  });

  it("rejects a signature header missing the sha256= prefix", () => {
    const body = "{}";
    const rawHex = createHmac("sha256", "test-app-secret").update(body, "utf8").digest("hex");
    expect(verifyWhatsAppSignature(body, rawHex)).toBe(false);
  });

  it("rejects when WHATSAPP_APP_SECRET isn't configured", () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const body = "{}";
    expect(verifyWhatsAppSignature(body, sign(body))).toBe(false);
  });

  it("rejects a signature of the wrong length rather than throwing", () => {
    expect(verifyWhatsAppSignature("{}", "sha256=deadbeef")).toBe(false);
  });
});
