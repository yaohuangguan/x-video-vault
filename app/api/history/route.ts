import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { viewingHistory, xPosts } from "@/db/schema";
import { dbOrNull, json } from "@/lib/server";
import { isVaultAuthenticated } from "@/lib/vault-auth";

export async function POST(request: Request) {
  if (!dbOrNull()) return json({ error: "Database unavailable" }, { status: 503 });
  if (!(await isVaultAuthenticated())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { postId?: string };
  if (!body.postId) return json({ error: "postId is required" }, { status: 400 });
  const post = (
    await getDb()
      .select({ id: xPosts.id })
      .from(xPosts)
      .where(eq(xPosts.postId, body.postId))
      .all()
  )[0];
  if (!post) return json({ error: "Post not found" }, { status: 404 });
  await getDb()
    .insert(viewingHistory)
    .values({ postId: post.id, viewCount: 1, lastViewedAt: new Date() })
    .onConflictDoUpdate({
      target: viewingHistory.postId,
      set: {
        viewCount: sql`${viewingHistory.viewCount} + 1`,
        lastViewedAt: new Date(),
      },
    });
  return json({ ok: true });
}
