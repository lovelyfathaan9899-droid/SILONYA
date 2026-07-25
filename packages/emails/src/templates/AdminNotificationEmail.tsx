import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

const main = { backgroundColor: "#f5f3ef", fontFamily: "Georgia, serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "480px" };
const heading = { fontSize: "22px", color: "#111111", fontWeight: 400 };
const subheading = { fontSize: "16px", color: "#111111", fontWeight: 600 };
const text = { fontSize: "14px", color: "#111111", lineHeight: "1.6" };
const label = { fontSize: "13px", color: "#666666" };

export interface AdminNotificationDetail {
  label: string;
  value: string;
}

/** Internal admin-alert email (NOTIFICATION_ARCHITECTURE.md) — plain key/value detail rows rather than a bespoke layout per event type, since new alert kinds (payments, inventory, reviews) should never need a new template. */
export function AdminNotificationEmail({
  title,
  details,
  linkUrl,
  linkLabel,
}: {
  title: string;
  details: AdminNotificationDetail[];
  linkUrl?: string;
  linkLabel?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>SILONYA Admin</Heading>
          <Text style={subheading}>{title}</Text>
          {details.map((detail) => (
            <Text key={detail.label} style={text}>
              <span style={label}>{detail.label}: </span>
              {detail.value}
            </Text>
          ))}
          {linkUrl ? (
            <Text style={text}>
              <Link href={linkUrl}>{linkLabel ?? "View in admin panel"}</Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
