# SILONYA — Authentication & Authorization Architecture

Defines how identity, sessions, and access control work across the customer storefront (`apps/web`) and admin dashboard (`apps/admin`). Built on **Auth.js (NextAuth)**, per [TECH_STACK.md](./TECH_STACK.md).

---

## 1. Principles

1. **Two separate identity domains.** Customers (`User`) and staff (`AdminUser`) are entirely distinct tables, auth flows, and session scopes — an admin session can never access customer-facing account actions and vice versa. A compromised customer account can never escalate into admin access, by construction.
2. **Guest checkout is first-class**, not a degraded fallback — SILONYA never forces account creation to purchase (DESIGN_SYSTEM.md §4).
3. **Server-side session validation on every protected request.** No trust is placed in client-held tokens beyond what's cryptographically verified on each call.
4. **Least privilege for admin access**, enforced by RBAC (§4), not by convention or UI hiding alone.

---

> **Implementation status (Phase 6):** customer accounts (this section's Auth.js/OAuth flow) aren't built yet — checkout is guest-only, matching principle 2 above. Guest order access uses a signed, expiring token (order id + email — `packages/auth/src/order-access-token.ts`) rather than a login session, per ORDER_MANAGEMENT.md §4's documented guest path. Build this section when customer accounts become a scoped phase.

## 2. Customer Authentication

### 2.1 Supported Methods

- Email + password (credentials)
- Google OAuth
- Apple OAuth (required for a premium global brand — significant share of mobile/iOS shoppers expect it)

### 2.2 Session Strategy

- **httpOnly, Secure, SameSite=Lax cookies** — never `localStorage`/`sessionStorage` tokens, which are vulnerable to XSS exfiltration.
- **Short-lived access token (JWT, ~15 min)** + **long-lived refresh token (opaque, stored hashed in `Session` table, ~30 days)**, rotated on every use (refresh token rotation — a reused/stolen refresh token is detected and the session family is revoked).
- Session validation on every `protectedProcedure` call re-verifies the JWT signature and expiry; refresh happens transparently via a silent client-side refresh flow before expiry.
- Logout revokes the `Session` row server-side (`revokedAt`) — not just a client-side cookie clear — so a stolen refresh token is immediately useless after logout.

### 2.3 Registration & Verification Flow

```
User submits email/password
        │
        ▼
Password strength validated (zxcvbn-based, min score enforced) + hashed (argon2id)
        │
        ▼
User row created, emailVerifiedAt = null
        │
        ▼
Verification email sent (Resend) with signed, expiring token
        │
        ▼
User can browse/purchase immediately (verification does not block checkout)
        │
        ▼
Verification required only for: password reset requests, marketing email eligibility
```

Guest checkout does not create a `User` row at all — the order stores `guestEmail` directly (DATABASE_ARCHITECTURE.md §3.5). A post-purchase prompt offers account creation, pre-filled, to convert the guest with zero re-entry of data.

### 2.4 Password Reset

- Time-limited (15 min), single-use, signed token emailed via Resend.
- On reset, all existing `Session` rows for the user are revoked — a password reset always logs out every other device, since a reset implies the old password may have been compromised.

### 2.5 OAuth Flow

- Standard OAuth2/OIDC authorization code flow via Auth.js providers.
- First-time OAuth login: if the email matches an existing credentials-based `User`, the accounts are linked (same `User.id`, new `AuthIdentity` row) after an email-ownership check — never silently merged without verification.

---

## 3. Admin Authentication

Stricter by default — admins hold access to customer PII, orders, and payment references.

- Email + password only at launch (no social login for staff accounts) + **mandatory TOTP-based 2FA** for all admin accounts before they can perform write actions.
- Session lifetime shorter than customer sessions (8 hours, re-authenticate daily).
- Every admin login and every sensitive admin action (refund, role change, product deletion) is written to `AuditLogEntry` (§5).
- Admin accounts are provisioned by an existing admin (no public admin registration endpoint exists).
- Failed login lockout: 5 attempts → 15-minute lockout, alerting on repeated failures against the same account (possible credential-stuffing target).

---

## 4. Authorization Model (RBAC)

```
AdminUser ──N:1── Role ──N:N── Permission (via RolePermission)
```

**Default roles (seed data, extensible):**

| Role              | Permissions                                                   |
| ----------------- | ------------------------------------------------------------- |
| `super_admin`     | All permissions, including role/permission management         |
| `catalog_manager` | `catalog:read`, `catalog:write`, `inventory:write`            |
| `order_manager`   | `orders:read`, `orders:write`, `refunds:write`                |
| `support`         | `orders:read`, `users:read` (read-only customer service view) |
| `viewer`          | Read-only across all domains, for reporting/analytics use     |

**Permission format:** `domain:action` (e.g., `orders:write`, `catalog:read`, `discounts:write`). Every `adminProcedure` in the tRPC API (API_SPECIFICATION.md §2) declares the exact permission it requires; the middleware checks it against the caller's role — a route is unreachable without the permission, not just hidden in the UI.

**Rule:** authorization is checked server-side on every request, always — UI-level hiding of buttons/menus is a UX nicety, never the security boundary.

---

## 5. Audit Logging

`AuditLogEntry`: id, adminUserId, action, targetType, targetId, metadata (JSON diff of what changed), ipAddress, createdAt.

Logged unconditionally for: login, role/permission changes, order status changes, refunds, product deletion, discount creation, admin user creation/deactivation. Append-only, never edited or deleted, retained indefinitely for compliance and incident investigation.

---

## 6. Threat Model & Mitigations

| Threat                              | Mitigation                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Credential stuffing                 | Rate limiting (API_SPECIFICATION.md §5), lockout after failed attempts, breached-password check (HaveIBeenPwned range API) at registration/reset |
| Session hijacking                   | httpOnly/Secure cookies, short JWT TTL, refresh token rotation with reuse detection                                                              |
| XSS token theft                     | No tokens in localStorage; strict CSP (SECURITY_ARCHITECTURE.md)                                                                                 |
| CSRF                                | SameSite cookies + double-submit CSRF token on state-changing REST endpoints; tRPC mutations are POST-only with origin checking                  |
| Admin privilege escalation          | Strict RBAC, server-side permission checks on every procedure, audit log on every role change                                                    |
| Password database compromise        | argon2id hashing (memory-hard, GPU-resistant), no reversible encryption of passwords ever                                                        |
| Account takeover via password reset | Reset tokens single-use/expiring, all sessions revoked on reset, email notification sent on every password change                                |

Cross-reference: [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) for the full platform-wide threat model this section feeds into.

---

## 7. Future Expansion

- **Passkeys/WebAuthn** — natural next step for a premium brand's UX once Auth.js's WebAuthn support matures further; architected for by keeping `AuthIdentity` provider-agnostic.
- **SSO for admin (SAML/OIDC)** — if/when SILONYA's internal team grows large enough to warrant centralized identity (Okta/Google Workspace) rather than standalone admin credentials.
- **Step-up authentication** — re-prompting for password/2FA before the highest-risk admin actions (e.g., large refunds), planned once transaction volume justifies the added friction.
