import type { WhatsAppOutboundMessage, WhatsAppSendResult } from "./types";

const GRAPH_API_VERSION = "v21.0";

/**
 * True once the three Meta-issued values needed to call the Cloud API are
 * present. Same "stub until configured" convention as packages/emails'
 * RESEND_API_KEY check — the app boots and every non-WhatsApp code path
 * works with none of these set; only an actual send attempt is affected.
 */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  );
}

/** Meta's convention: E.164 with no leading "+" (e.g. "923001234567", not "+923001234567"). */
export function toMetaPhoneFormat(e164Phone: string): string {
  return e164Phone.replace(/^\+/, "").replace(/[^0-9]/g, "");
}

interface GraphSuccessResponse {
  messaging_product: "whatsapp";
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string }[];
}

interface GraphErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

function isGraphErrorResponse(value: unknown): value is GraphErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "object"
  );
}

function extractMessageId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const messages = (value as GraphSuccessResponse).messages;
  return messages?.[0]?.id ?? null;
}

/**
 * One send = one Cloud API call. Never throws — every failure mode
 * (unconfigured, Meta rejects the request, network error) resolves to a
 * `WhatsAppSendResult` with `success: false`, so callers (the outbox
 * writer, the retry queue) always have a uniform shape to persist and act
 * on rather than needing try/catch at every call site.
 */
export async function sendWhatsAppMessage(
  message: WhatsAppOutboundMessage,
): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) {
    console.warn(
      `[whatsapp] not configured — message not sent. To: ${message.to} | Template: ${message.templateName}`,
    );
    return {
      success: false,
      providerMessageId: null,
      errorCode: "NOT_CONFIGURED",
      errorMessage: "WhatsApp Business Cloud API is not configured.",
      rawResponse: null,
    };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${String(phoneNumberId)}/messages`;

  const body = {
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to: message.to,
    type: "template" as const,
    template: {
      name: message.templateName,
      language: { code: message.languageCode },
      components: message.components,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${String(accessToken)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json: unknown = await response.json();

    if (!response.ok || isGraphErrorResponse(json)) {
      const err = isGraphErrorResponse(json) ? json.error : null;
      return {
        success: false,
        providerMessageId: null,
        errorCode: err ? String(err.code) : `HTTP_${String(response.status)}`,
        errorMessage: err?.message ?? "WhatsApp Cloud API returned an error.",
        rawResponse: json,
      };
    }

    return {
      success: true,
      providerMessageId: extractMessageId(json),
      errorCode: null,
      errorMessage: null,
      rawResponse: json,
    };
  } catch (err) {
    return {
      success: false,
      providerMessageId: null,
      errorCode: "NETWORK_ERROR",
      errorMessage: err instanceof Error ? err.message : "Unknown network error.",
      rawResponse: null,
    };
  }
}
