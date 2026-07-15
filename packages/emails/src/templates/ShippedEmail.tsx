import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";
import { formatPriceForDisplay } from "@silonya/utils";

const main = { backgroundColor: "#f5f3ef", fontFamily: "Georgia, serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "480px" };
const heading = { fontSize: "22px", color: "#111111", fontWeight: 400 };
const text = { fontSize: "14px", color: "#111111", lineHeight: "1.6" };

export function ShippedEmail({
  orderNumber,
  trackingNumber,
  carrier,
  orderTrackingUrl,
}: {
  orderNumber: string;
  trackingNumber: string;
  carrier: string | null;
  orderTrackingUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Order {orderNumber} has shipped.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            Your order <strong>{orderNumber}</strong> is on its way.
          </Text>
          <Text style={text}>
            {carrier ? `${carrier} tracking number: ` : "Tracking number: "}
            <strong>{trackingNumber}</strong>
          </Text>
          <Text style={text}>
            <Link href={orderTrackingUrl}>Track your order</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function DeliveredEmail({
  orderNumber,
  orderTrackingUrl,
}: {
  orderNumber: string;
  orderTrackingUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Order {orderNumber} has been delivered.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            Your order <strong>{orderNumber}</strong> has been delivered. We hope you love it.
          </Text>
          <Text style={text}>
            <Link href={orderTrackingUrl}>View order details</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function CancelledEmail({
  orderNumber,
  refunded,
  orderTrackingUrl,
}: {
  orderNumber: string;
  refunded: boolean;
  orderTrackingUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Order {orderNumber} has been cancelled.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            Your order <strong>{orderNumber}</strong> has been cancelled.
            {refunded ? " A full refund has been issued to your original payment method." : ""}
          </Text>
          <Text style={text}>
            <Link href={orderTrackingUrl}>View order details</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function RefundIssuedEmail({
  orderNumber,
  amount,
  currency,
  orderTrackingUrl,
}: {
  orderNumber: string;
  amount: number;
  currency: string;
  orderTrackingUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>A refund has been issued for order {orderNumber}.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            A refund of <strong>{formatPriceForDisplay(amount, currency)}</strong> has been issued
            for order <strong>{orderNumber}</strong>. It may take a few business days to appear on
            your statement.
          </Text>
          <Text style={text}>
            <Link href={orderTrackingUrl}>View order details</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
