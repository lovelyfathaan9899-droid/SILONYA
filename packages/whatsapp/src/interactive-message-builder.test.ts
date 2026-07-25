import { describe, expect, it } from "vitest";
import {
  buildCancelPayload,
  buildConfirmPayload,
  buildHelpWaLink,
  parseButtonPayload,
} from "./interactive-message-builder";

describe("buildConfirmPayload / buildCancelPayload / parseButtonPayload", () => {
  it("round-trips a confirm payload back to its order id", () => {
    const payload = buildConfirmPayload("order-123");
    expect(parseButtonPayload(payload)).toEqual({ action: "confirm", orderId: "order-123" });
  });

  it("round-trips a cancel payload back to its order id", () => {
    const payload = buildCancelPayload("order-456");
    expect(parseButtonPayload(payload)).toEqual({ action: "cancel", orderId: "order-456" });
  });

  it("returns null for a payload that isn't one of ours", () => {
    expect(parseButtonPayload("SOME_OTHER_PAYLOAD")).toBeNull();
  });

  it("returns null for a confirm/cancel prefix with no order id", () => {
    expect(parseButtonPayload("CONFIRM_ORDER_")).toBeNull();
    expect(parseButtonPayload("CANCEL_ORDER_")).toBeNull();
  });
});

describe("buildHelpWaLink", () => {
  it("builds a wa.me link with the exact pre-filled message from the spec", () => {
    const link = buildHelpWaLink("923001234567", "SIL-123456");
    expect(link).toBe(
      "https://wa.me/923001234567?text=Hello%20SILONYA%2C%20I%20need%20help%20regarding%20Order%20SIL-123456.",
    );
  });
});
