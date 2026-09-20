import { eq } from "drizzle-orm";
import { xPosts } from "@/db/schema";
import { dbOrNull, json } from "@/lib/server";
import { isVaultAuthenticated } from "@/lib/vault-auth";

export async function POST(request: Request) {
  const db = dbOrNull();
  if (!db) return json({ error: "Database unavailable" }, { status: 503 });
  if (!(await isVaultAuthenticated())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    postId?: string;
    isFavorite?: boolean;
  };
  if (!body.postId) {
    return json({ error: "postId is required" }, { status: 400 });
  }
  await db
    .update(xPosts)
    .set({ isFavorite: Boolean(body.isFavorite) })
    .where(eq(xPosts.postId, body.postId));
  return json({ ok: true, isFavorite: Boolean(body.isFavorite) });
}
