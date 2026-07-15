import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { formatPriceForDisplay } from "@silonya/utils";
import type { OrderEmailData } from "../types";

const main = { backgroundColor: "#f5f3ef", fontFamily: "Georgia, serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "480px" };
const heading = { fontSize: "22px", color: "#111111", fontWeight: 400 };
const text = { fontSize: "14px", color: "#111111", lineHeight: "1.6" };
const muted = { fontSize: "12px", color: "#8a8681" };
const row = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "13px",
  color: "#111111",
};

export function OrderConfirmationEmail({ order }: { order: OrderEmailData }) {
  return (
    <Html>
      <Head />
      <Preview>Your SILONYA order {order.orderNumber} is confirmed.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            Thank you for your order — <strong>{order.orderNumber}</strong> is confirmed and being
            prepared.
          </Text>

          <Hr />

          {order.items.map((item) => (
            <Section key={`${item.productNameSnapshot}-${item.variantLabelSnapshot}`}>
              <table role="presentation" width="100%">
                <tbody>
                  <tr>
                    <td style={row}>
                      {item.productNameSnapshot}
                      {item.variantLabelSnapshot ? ` (${item.variantLabelSnapshot})` : ""} ×{" "}
                      {item.quantity}
                    </td>
                    <td style={{ ...row, textAlign: "right" }}>
                      {formatPriceForDisplay(item.lineTotal, order.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          ))}

          <Hr />

          <SummaryRow label="Subtotal" amount={order.subtotal} currency={order.currency} />
          <SummaryRow label="Shipping" amount={order.shippingTotal} currency={order.currency} />
          {order.taxTotal > 0 ? (
            <SummaryRow label="Tax" amount={order.taxTotal} currency={order.currency} />
          ) : null}
          {order.discountTotal > 0 ? (
            <SummaryRow label="Discount" amount={-order.discountTotal} currency={order.currency} />
          ) : null}
          <SummaryRow label="Total" amount={order.grandTotal} currency={order.currency} bold />

          <Hr />

          <Text style={muted}>Shipping to</Text>
          <Text style={text}>
            {order.shippingAddress.line1}
            <br />
            {order.shippingAddress.line2 ? (
              <>
                {order.shippingAddress.line2}
                <br />
              </>
            ) : null}
            {order.shippingAddress.city}, {order.shippingAddress.region ?? ""}{" "}
            {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.countryCode}
          </Text>

          <Text style={text}>
            <Link href={order.orderTrackingUrl}>Track your order</Link>
          </Text>

          <Text style={muted}>SILONYA — this link expires in 30 days.</Text>
        </Container>
      </Body>
    </Html>
  );
}

function SummaryRow({
  label,
  amount,
  currency,
  bold = false,
}: {
  label: string;
  amount: number;
  currency: string;
  bold?: boolean;
}) {
  return (
    <table role="presentation" width="100%">
      <tbody>
        <tr>
          <td style={{ ...row, fontWeight: bold ? 700 : 400 }}>{label}</td>
          <td style={{ ...row, textAlign: "right", fontWeight: bold ? 700 : 400 }}>
            {formatPriceForDisplay(amount, currency)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
