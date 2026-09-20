import { eq } from "drizzle-orm";
import { localTags, postTags, xPosts } from "@/db/schema";
import { dbOrNull, json } from "@/lib/server";
import { isVaultAuthenticated } from "@/lib/vault-auth";

async function authorized() {
  return Boolean(dbOrNull()) && (await isVaultAuthenticated());
}

export async function GET() {
  if (!(await authorized())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  return json({
    tags: await dbOrNull()!
      .select()
      .from(localTags)
      .orderBy(localTags.name)
      .all(),
  });
}

export async function POST(request: Request) {
  if (!(await authorized())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const db = dbOrNull()!;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    postId?: string;
    tagIds?: number[];
  };
  const name = body.name?.trim().slice(0, 40);
  if (name) {
    const existing = (
      await db.select().from(localTags).where(eq(localTags.name, name)).all()
    )[0];
    if (existing) return json(existing);
    const created = await db.insert(localTags).values({ name }).returning();
    return json(created[0]);
  }
  if (body.postId && Array.isArray(body.tagIds)) {
    const post = (
      await db
        .select({ id: xPosts.id })
        .from(xPosts)
        .where(eq(xPosts.postId, body.postId))
        .all()
    )[0];
    if (!post) return json({ error: "Post not found" }, { status: 404 });
    await db.delete(postTags).where(eq(postTags.postId, post.id));
    if (body.tagIds.length) {
      await db
        .insert(postTags)
        .values(
          [...new Set(body.tagIds)].map((tagId) => ({
            postId: post.id,
            tagId,
          })),
        );
    }
    return json({ ok: true });
  }
  return json({ error: "Invalid tag request" }, { status: 400 });
}

export async function PATCH(request: Request) {
  if (!(await authorized())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: number;
    name?: string;
  };
  const name = body.name?.trim().slice(0, 40);
  if (!body.id || !name) {
    return json({ error: "Invalid tag" }, { status: 400 });
  }
  await dbOrNull()!
    .update(localTags)
    .set({ name })
    .where(eq(localTags.id, body.id));
  return json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await authorized())) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { id?: number };
  if (!body.id) return json({ error: "Invalid tag" }, { status: 400 });
  await dbOrNull()!.delete(localTags).where(eq(localTags.id, body.id));
  return json({ ok: true });
}
