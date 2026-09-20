import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { extensionTokens } from "@/db/schema";
import { randomUrlSafe, sha256Base64Url } from "@/lib/crypto";
import { dbOrNull, json } from "@/lib/server";
import { isVaultAuthenticated } from "@/lib/vault-auth";

async function authorized() {
  return Boolean(dbOrNull()) && (await isVaultAuthenticated());
}

export async function GET() {
  if (!(await authorized())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const tokens = await getDb()
    .select({
      id: extensionTokens.id,
      name: extensionTokens.name,
      tokenHint: extensionTokens.tokenHint,
      createdAt: extensionTokens.createdAt,
      lastUsedAt: extensionTokens.lastUsedAt,
      revoked: extensionTokens.revoked,
    })
    .from(extensionTokens)
    .orderBy(desc(extensionTokens.createdAt))
    .all();
  return json({ tokens });
}

export async function POST(request: Request) {
  if (!(await authorized())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim().slice(0, 80) || "My browser";
  const token = `xvv_${randomUrlSafe(36)}`;
  const created = await getDb()
    .insert(extensionTokens)
    .values({
      name,
      tokenHash: await sha256Base64Url(token),
      tokenHint: token.slice(-6),
      createdAt: new Date(),
      revoked: false,
    })
    .returning({ id: extensionTokens.id });
  return json({ id: created[0]?.id, token, name });
}

export async function DELETE(request: Request) {
  if (!(await authorized())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { id?: number };
  if (!body.id) return json({ error: "Token id is required" }, { status: 400 });
  await getDb()
    .update(extensionTokens)
    .set({ revoked: true })
    .where(eq(extensionTokens.id, body.id));
  return json({ ok: true });
}
