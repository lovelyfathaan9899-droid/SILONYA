import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

const main = { backgroundColor: "#f5f3ef", fontFamily: "Georgia, serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "480px" };
const heading = { fontSize: "22px", color: "#111111", fontWeight: 400 };
const text = { fontSize: "14px", color: "#111111", lineHeight: "1.6" };

/** Sent on registration (CUSTOMER ACCOUNT SYSTEM — "Welcome email"). */
export function WelcomeEmail({
  firstName,
  accountUrl,
}: {
  firstName: string | null;
  accountUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to SILONYA.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            {firstName ? `Welcome, ${firstName}.` : "Welcome."} Your account has been created.
          </Text>
          <Text style={text}>
            Track orders, manage addresses, and revisit your wishlist any time from your account.
          </Text>
          <Text style={text}>
            <Link href={accountUrl}>Go to your account</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** AUTHENTICATION.md §2.4 — 15-minute single-use reset link. */
export function PasswordResetEmail({ resetUrl }: { resetUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Reset your SILONYA password.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            We received a request to reset your password. This link expires in 15 minutes and can
            only be used once.
          </Text>
          <Text style={text}>
            <Link href={resetUrl}>Reset your password</Link>
          </Text>
          <Text style={text}>
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** AUTHENTICATION.md §2.3 — 24-hour single-use verification link. */
export function EmailVerificationEmail({ verifyUrl }: { verifyUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>Please confirm this is your email address.</Text>
          <Text style={text}>
            <Link href={verifyUrl}>Verify email address</Link>
          </Text>
          <Text style={text}>This link expires in 24 hours.</Text>
        </Container>
      </Body>
    </Html>
  );
}

/** SHOPPING FEATURES — sent a few days after delivery, prompting a review of a purchased item. */
export function ReviewReminderEmail({
  productName,
  reviewUrl,
}: {
  productName: string;
  reviewUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>How was your {productName}?</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            You recently received <strong>{productName}</strong>. We&apos;d love to hear what you
            think.
          </Text>
          <Text style={text}>
            <Link href={reviewUrl}>Write a review</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** CUSTOMER EXPERIENCE — "wishlist reminder architecture": nudges about a wishlisted item, e.g. low stock or a price drop. */
export function WishlistReminderEmail({
  productName,
  reason,
  productUrl,
}: {
  productName: string;
  reason: string;
  productUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>
        {productName} — {reason}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>
            <strong>{productName}</strong> is still on your wishlist — {reason}.
          </Text>
          <Text style={text}>
            <Link href={productUrl}>View item</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** PROMOTIONS — "coupon email architecture": notifies a customer of a code issued to them (e.g. a customer-specific discount). */
export function CouponEmail({
  code,
  description,
  shopUrl,
  expiresAt,
}: {
  code: string;
  description: string;
  shopUrl: string;
  expiresAt: string | null;
}) {
  return (
    <Html>
      <Head />
      <Preview>A discount code for you: {code}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA</Heading>
          <Text style={text}>{description}</Text>
          <Text style={{ ...text, fontSize: "20px", letterSpacing: "2px" }}>{code}</Text>
          {expiresAt ? <Text style={text}>Valid until {expiresAt}.</Text> : null}
          <Text style={text}>
            <Link href={shopUrl}>Shop now</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
