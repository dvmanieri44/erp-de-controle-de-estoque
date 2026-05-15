import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { UserAccount, UserRole } from "@/lib/user-accounts";
import {
  INITIAL_USER_ACCOUNTS,
  normalizeLoginUsername,
  normalizeUserAccounts,
  parseUserAccountRecord,
} from "@/lib/user-accounts";
import {
  loadAuthCredentialsForAccounts,
  verifyAuthCredentialPassword,
} from "@/lib/server/auth-credentials";
import { readErpResource } from "@/lib/server/erp-state";

const AUTH_SESSION_COOKIE_NAME = "fluxy-auth-session";
const AUTH_SESSION_DURATION_SECONDS = 60 * 60 * 12;
const DEV_FALLBACK_AUTH_SECRET = "fluxy-dev-auth-secret";
const MIN_PRODUCTION_AUTH_SECRET_LENGTH = 32;
const FIXED_ADMIN_USERNAME = "admin123";
const FIXED_ADMIN_PASSWORD = "admin123";
const FIXED_ADMIN_ACCOUNT: UserAccount = {
  id: "conta-admin123",
  name: "Administrador",
  username: FIXED_ADMIN_USERNAME,
  email: "admin123@local",
  role: "administrador",
  unit: "Sistema",
  status: "ativo",
};

type SessionTokenPayload = {
  accountId: string;
  username: string;
  role: UserRole;
  exp: number;
};

export type ServerSession = {
  account: UserAccount;
  username: string;
  role: UserRole;
  expiresAt: number;
};

function getAuthSecret() {
  const configuredSecret = process.env.AUTH_SECRET?.trim();

  if (configuredSecret) {
    if (
      process.env.NODE_ENV === "production" &&
      configuredSecret.length < MIN_PRODUCTION_AUTH_SECRET_LENGTH
    ) {
      throw new Error(
        `AUTH_SECRET precisa ter pelo menos ${MIN_PRODUCTION_AUTH_SECRET_LENGTH} caracteres em producao.`,
      );
    }

    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET obrigatorio em producao.");
  }

  return DEV_FALLBACK_AUTH_SECRET;
}

function getSessionCookieOptions(maxAge = AUTH_SESSION_DURATION_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPayload(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function createSessionToken(payload: SessionTokenPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSessionToken(token: string) {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<SessionTokenPayload>;

    if (
      typeof payload.accountId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload as SessionTokenPayload;
  } catch {
    return null;
  }
}

function isFixedAdminLogin(identifier: string, password: string) {
  return normalizeLoginUsername(identifier) === FIXED_ADMIN_USERNAME && password.trim() === FIXED_ADMIN_PASSWORD;
}

export async function loadServerUserAccounts() {
  try {
    const payload = await readErpResource("user.accounts");
    const accounts = payload.data
      .map((item) =>
        item && typeof item === "object" ? parseUserAccountRecord(item as Record<string, unknown>) : null,
      )
      .filter((item): item is UserAccount => item !== null);
    return accounts.length > 0 ? accounts : normalizeUserAccounts([...INITIAL_USER_ACCOUNTS]);
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    return normalizeUserAccounts([...INITIAL_USER_ACCOUNTS]);
  }
}

export async function authenticateServerUser(identifier: string, password: string) {
  if (isFixedAdminLogin(identifier, password)) {
    return {
      account: FIXED_ADMIN_ACCOUNT,
      username: FIXED_ADMIN_USERNAME,
      role: FIXED_ADMIN_ACCOUNT.role,
    };
  }

  const normalizedIdentifier = normalizeLoginUsername(identifier);
  const normalizedEmail = identifier.trim().toLowerCase();
  const trimmedPassword = password.trim();
  const accounts = await loadServerUserAccounts();
  const account =
    accounts.find(
      (item) =>
        item.status === "ativo" &&
        (item.username === normalizedIdentifier || item.email.toLowerCase() === normalizedEmail),
    ) ?? null;

  if (!account) {
    return null;
  }

  const credentials = await loadAuthCredentialsForAccounts(accounts);
  const credential = credentials[account.id] ?? null;

  if (!credential) {
    return null;
  }

  const validPassword = await verifyAuthCredentialPassword(credential, trimmedPassword);

  if (!validPassword) {
    return null;
  }

  return {
    account,
    username: credential.username,
    role: account.role,
  };
}

export async function readServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = parseSessionToken(token);

  if (!payload) {
    return null;
  }

  if (
    payload.accountId === FIXED_ADMIN_ACCOUNT.id &&
    payload.role === FIXED_ADMIN_ACCOUNT.role &&
    normalizeLoginUsername(payload.username) === FIXED_ADMIN_USERNAME
  ) {
    return {
      account: FIXED_ADMIN_ACCOUNT,
      username: payload.username,
      role: payload.role,
      expiresAt: payload.exp,
    } satisfies ServerSession;
  }

  const accounts = await loadServerUserAccounts();
  const account =
    accounts.find(
      (item) =>
        item.id === payload.accountId && item.status === "ativo" && item.role === payload.role,
    ) ?? null;

  if (!account) {
    return null;
  }

  if (normalizeLoginUsername(payload.username) !== FIXED_ADMIN_USERNAME) {
    return null;
  }

  return {
    account,
    username: payload.username,
    role: payload.role,
    expiresAt: payload.exp,
  } satisfies ServerSession;
}

export async function verifyServerSessionPassword(password: string) {
  const session = await readServerSession();

  if (!session) {
    return false;
  }

  if (normalizeLoginUsername(session.username) === FIXED_ADMIN_USERNAME) {
    return password.trim() === FIXED_ADMIN_PASSWORD;
  }

  const accounts = await loadServerUserAccounts();
  const credentials = await loadAuthCredentialsForAccounts(accounts);
  const credential = credentials[session.account.id] ?? null;

  if (!credential) {
    return false;
  }

  return verifyAuthCredentialPassword(credential, password.trim());
}

export function setServerSessionCookie(
  response: NextResponse,
  session: { account: UserAccount; username: string; role: UserRole },
) {
  const token = createSessionToken({
    accountId: session.account.id,
    username: session.username,
    role: session.role,
    exp: Math.floor(Date.now() / 1000) + AUTH_SESSION_DURATION_SECONDS,
  });

  response.cookies.set(AUTH_SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

export function clearServerSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0),
    expires: new Date(0),
  });
}
