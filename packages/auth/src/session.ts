import { prisma } from "@silonya/database";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  ADMIN_REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./constants";
import { signAccessToken } from "./jwt";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Creates a new customer session (AUTHENTICATION.md §2.2). Called on
 * successful login/registration. Note: this is a pragmatic MVP rotation
 * scheme — each session is a single row whose refreshTokenHash is replaced
 * on every rotation, rather than a token-family chain. A stolen token used
 * after the legitimate client has already rotated simply fails to match
 * any row (forcing re-login) rather than triggering family-wide revocation.
 * Revisit if fraud signals ever require stronger reuse detection.
 */
export async function createCustomerSession(
  userId: string,
  meta: RequestMeta = {},
): Promise<IssuedTokens> {
  const { raw, hash } = generateRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hash,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  const accessToken = await signAccessToken(
    { sub: userId, sid: session.id },
    ACCESS_TOKEN_TTL_SECONDS,
  );
  return { accessToken, refreshToken: raw };
}

export async function rotateCustomerSession(refreshTokenRaw: string): Promise<IssuedTokens | null> {
  const hash = hashRefreshToken(refreshTokenRaw);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  const { raw, hash: newHash } = generateRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  const accessToken = await signAccessToken(
    { sub: session.userId, sid: session.id },
    ACCESS_TOKEN_TTL_SECONDS,
  );
  return { accessToken, refreshToken: raw };
}

export async function revokeCustomerSession(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/** Revokes every session for a user — used on password reset (AUTHENTICATION.md §2.4). */
export async function revokeAllCustomerSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createAdminSession(
  adminUserId: string,
  roleName: string,
  meta: RequestMeta = {},
): Promise<IssuedTokens> {
  const { raw, hash } = generateRefreshToken();
  const session = await prisma.adminSession.create({
    data: {
      adminUserId,
      refreshTokenHash: hash,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt: new Date(Date.now() + ADMIN_REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  const accessToken = await signAccessToken(
    { sub: adminUserId, sid: session.id, role: roleName },
    ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  );
  return { accessToken, refreshToken: raw };
}

/** Mirrors rotateCustomerSession — see that function's doc comment for the rotation-scheme caveat, which applies identically here. */
export async function rotateAdminSession(refreshTokenRaw: string): Promise<IssuedTokens | null> {
  const hash = hashRefreshToken(refreshTokenRaw);
  const session = await prisma.adminSession.findUnique({
    where: { refreshTokenHash: hash },
    include: { adminUser: { include: { role: true } } },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.adminUser.deactivatedAt
  ) {
    return null;
  }
  const { raw, hash: newHash } = generateRefreshToken();
  await prisma.adminSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      expiresAt: new Date(Date.now() + ADMIN_REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  const accessToken = await signAccessToken(
    { sub: session.adminUserId, sid: session.id, role: session.adminUser.role.name },
    ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  );
  return { accessToken, refreshToken: raw };
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  await prisma.adminSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}
