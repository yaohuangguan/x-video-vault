import {
  and,
  asc,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  authors,
  localTags,
  media,
  postTags,
  syncHistory,
  xPosts,
} from "@/db/schema";
import { dbOrNull, json } from "@/lib/server";
import {
  getVaultAuthState,
  isVaultAuthenticated,
} from "@/lib/vault-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = dbOrNull();
  if (!db) {
    return json(
      { error: "Database is unavailable. Run the database setup first." },
      { status: 503 },
    );
  }
  const authState = await getVaultAuthState();
  if (authState === "setup") {
    return json({
      auth: { state: "setup", authenticated: false },
      items: [],
      total: 0,
      tags: [],
      lastImport: null,
      hasMore: false,
    });
  }
  if (!(await isVaultAuthenticated())) {
    return json(
      { auth: { state: "login", authenticated: false } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || 24);
  const limit = Math.min(Math.max(requestedLimit || 24, 1), 60);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const query = url.searchParams.get("q")?.trim();
  const favorite = url.searchParams.get("favorite") === "true";
  const tag = url.searchParams.get("tag")?.trim();
  const type = url.searchParams.get("type")?.trim();
  const sort = url.searchParams.get("sort") || "imported";

  const conditions: SQL[] = [];
  if (query) {
    const search = or(
      like(xPosts.text, `%${query}%`),
      like(authors.username, `%${query}%`),
      like(authors.displayName, `%${query}%`),
      sql`${xPosts.id} IN (
        SELECT post_id FROM post_tags
        WHERE tag_id IN (
          SELECT id FROM local_tags WHERE name LIKE ${`%${query}%`}
        )
      )`,
    );
    if (search) conditions.push(search);
  }
  if (favorite) conditions.push(eq(xPosts.isFavorite, true));
  if (tag) {
    conditions.push(sql`${xPosts.id} IN (
      SELECT post_id FROM post_tags
      WHERE tag_id IN (SELECT id FROM local_tags WHERE name = ${tag})
    )`);
  }
  if (type === "video" || type === "animated_gif") {
    conditions.push(eq(media.type, type));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const order =
    sort === "oldest"
      ? asc(xPosts.createdAt)
      : sort === "imported"
        ? desc(xPosts.lastSyncedAt)
        : sort === "author"
          ? asc(authors.username)
          : desc(xPosts.createdAt);

  const rows = await db
    .select({ post: xPosts, author: authors, media })
    .from(media)
    .innerJoin(xPosts, eq(media.postId, xPosts.id))
    .leftJoin(authors, eq(xPosts.authorId, authors.id))
    .where(where)
    .orderBy(order)
    .limit(limit)
    .offset(offset)
    .all();
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(media)
    .innerJoin(xPosts, eq(media.postId, xPosts.id))
    .leftJoin(authors, eq(xPosts.authorId, authors.id))
    .where(where)
    .all();
  const total = Number(countRows[0]?.count ?? 0);

  const rowIds = rows.map(({ post }) => post.id);
  const tagRows = rowIds.length
    ? await db
        .select({
          postId: postTags.postId,
          id: localTags.id,
          name: localTags.name,
        })
        .from(postTags)
        .innerJoin(localTags, eq(postTags.tagId, localTags.id))
        .where(inArray(postTags.postId, rowIds))
        .all()
    : [];
  const tagMap = new Map<number, Array<{ id: number; name: string }>>();
  for (const row of tagRows) {
    tagMap.set(row.postId, [
      ...(tagMap.get(row.postId) ?? []),
      { id: row.id, name: row.name },
    ]);
  }

  const allTags = await db
    .select({ id: localTags.id, name: localTags.name })
    .from(localTags)
    .orderBy(asc(localTags.name))
    .all();
  const latest = await db
    .select({ completedAt: syncHistory.completedAt })
    .from(syncHistory)
    .where(sql`completed_at IS NOT NULL`)
    .orderBy(desc(syncHistory.completedAt))
    .limit(1)
    .all();

  return json({
    auth: { state: "login", authenticated: true },
    items: rows.map(({ post, author, media: item }) => ({
      postId: post.postId,
      text: post.text,
      createdAt: post.createdAt,
      firstSyncedAt: post.firstSyncedAt,
      lastSyncedAt: post.lastSyncedAt,
      originalUrl: post.originalUrl,
      importSource: post.importSource,
      isFavorite: post.isFavorite,
      unavailable: post.unavailable,
      author: author
        ? {
            username: author.username,
            displayName: author.displayName,
            profileImageUrl: author.profileImageUrl,
          }
        : null,
      media: {
        mediaKey: item.mediaKey,
        type: item.type,
        previewImageUrl: item.previewImageUrl,
        unavailable: item.unavailable,
      },
      tags: tagMap.get(post.id) ?? [],
    })),
    total,
    tags: allTags,
    lastImport: latest[0]?.completedAt ?? null,
    hasMore: offset + rows.length < total,
  });
}
