import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../db";
import {
  appSettings,
  extensionTokens,
  vaultSessions,
} from "../db/schema";
import { randomUrlSafe, sha256Base64Url } from "./crypto";

const PASSWORD_KEY = "vault_password";
const SESSION_COOKIE = "xvv_vault_session";
const SESSION_DAYS = 30;
const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const saltBuffer = Uint8Array.from(salt).buffer;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const iterations = 100_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, iterations);
  return `${iterations}.${bytesToBase64(salt)}.${bytesToBase64(hash)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [iterationText, saltText, hashText] = encoded.split(".");
  const iterations = Number(iterationText);
  if (!iterations || !saltText || !hashText) return false;
  try {
    const actual = await derivePassword(
      password,
      base64ToBytes(saltText),
      iterations,
    );
    return equalBytes(actual, base64ToBytes(hashText));
  } catch {
    return false;
  }
}

export async function getVaultAuthState() {
  const row = (
    await getDb()
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, PASSWORD_KEY))
      .all()
  )[0];
  return row ? "login" : "setup";
}

export async function createVaultSession(request: Request) {
  const token = randomUrlSafe(40);
  const tokenHash = await sha256Base64Url(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(vaultSessions).values({
    tokenHash,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  const url = new URL(request.url);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function isVaultAuthenticated() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const tokenHash = await sha256Base64Url(token);
  const now = new Date();
  const session = (
    await getDb()
      .select()
      .from(vaultSessions)
      .where(
        and(
          eq(vaultSessions.tokenHash, tokenHash),
          gt(vaultSessions.expiresAt, now),
        ),
      )
      .all()
  )[0];
  if (!session) return false;
  if (now.getTime() - session.lastSeenAt.getTime() > 6 * 60 * 60 * 1000) {
    await getDb()
      .update(vaultSessions)
      .set({ lastSeenAt: now })
      .where(eq(vaultSessions.tokenHash, tokenHash));
  }
  return true;
}

export async function saveInitialPassword(password: string, request: Request) {
  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters");
  }
  if ((await getVaultAuthState()) !== "setup") {
    throw new Error("Vault has already been set up");
  }
  await getDb().insert(appSettings).values({
    key: PASSWORD_KEY,
    value: await hashPassword(password),
    updatedAt: new Date(),
  });
  await createVaultSession(request);
}

export async function loginWithPassword(password: string, request: Request) {
  const row = (
    await getDb()
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, PASSWORD_KEY))
      .all()
  )[0];
  if (!row || !(await verifyPassword(password, row.value))) return false;
  await createVaultSession(request);
  return true;
}

export async function logoutVault() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb()
      .delete(vaultSessions)
      .where(eq(vaultSessions.tokenHash, await sha256Base64Url(token)));
  }
  store.delete(SESSION_COOKIE);
}

export async function verifyExtensionRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return false;
  const tokenHash = await sha256Base64Url(token);
  const record = (
    await getDb()
      .select()
      .from(extensionTokens)
      .where(
        and(
          eq(extensionTokens.tokenHash, tokenHash),
          eq(extensionTokens.revoked, false),
        ),
      )
      .all()
  )[0];
  if (!record) return false;
  await getDb()
    .update(extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionTokens.id, record.id));
  return true;
}

export { PASSWORD_KEY, SESSION_COOKIE };
