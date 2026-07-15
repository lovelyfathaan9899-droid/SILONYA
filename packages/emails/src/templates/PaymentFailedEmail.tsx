import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

const main = { backgroundColor: "#f5f3ef", fontFamily: "Georgia, serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "480px" };
const heading = { fontSize: "22px", color: "#111111", fontWeight: 400 };
const text = { fontSize: "14px", color: "#111111", lineHeight: "1.6" };

export function PaymentFailedEmail({
  orderNumber,
  retryUrl,
}: {
  orderNumber: string;
  retryUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>We couldn&apos;t process payment for order {orderNumber}.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            We weren&apos;t able to process payment for order <strong>{orderNumber}</strong>. The
            items in your bag have been released — nothing was charged.
          </Text>
          <Text style={text}>
            <Link href={retryUrl}>Return to your bag to try again</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
