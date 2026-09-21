import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { authors, media, syncHistory, xPosts } from "../db/schema";

export type ImportedXPost = {
  url: string;
  postId?: string;
  text?: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string | null;
  previewImageUrl?: string | null;
  mediaUrl?: string | null;
  createdAt?: string | null;
  mediaType?: "video" | "animated_gif";
};

const POST_URL =
  /https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/([^/?#\s]+)\/status\/(\d+)/i;

function safeHttpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeVideoUrl(value?: string | null) {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  try {
    return new URL(url).hostname === "video.twimg.com" ? url : null;
  } catch {
    return null;
  }
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeXPostUrl(value: string) {
  const match = value.match(POST_URL);
  if (!match) return null;
  const username = match[1].toLowerCase() === "i" ? "i" : match[1];
  const postId = match[2];
  return {
    postId,
    username: username === "i" ? null : username.replace(/^@/, ""),
    url:
      username === "i"
        ? `https://x.com/i/status/${postId}`
        : `https://x.com/${username}/status/${postId}`,
  };
}

function clean(value: string | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

export async function importXPosts(
  input: ImportedXPost[],
  source: "extension" | "link" | "share",
) {
  const db = getDb();
  const now = new Date();
  const history = await db
    .insert(syncHistory)
    .values({ mode: source, startedAt: now })
    .returning({ id: syncHistory.id });
  let newlyAdded = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of input.slice(0, 100)) {
    const normalized = normalizeXPostUrl(raw.url ?? "");
    if (!normalized || (raw.postId && raw.postId !== normalized.postId)) {
      skipped += 1;
      continue;
    }

    const username =
      clean(raw.username, 50).replace(/^@/, "") ||
      normalized.username ||
      "unknown";
    const displayName = clean(raw.displayName, 100) || `@${username}`;
    const authorKey = `handle:${username.toLowerCase()}`;
    let author = (
      await db
        .select()
        .from(authors)
        .where(eq(authors.xUserId, authorKey))
        .all()
    )[0];

    if (author) {
      await db
        .update(authors)
        .set({
          username,
          displayName:
            displayName === "@unknown" ? author.displayName : displayName,
          profileImageUrl:
            safeHttpsUrl(raw.profileImageUrl) ?? author.profileImageUrl,
          updatedAt: now,
        })
        .where(eq(authors.id, author.id));
    } else {
      author = (
        await db
          .insert(authors)
          .values({
            xUserId: authorKey,
            username,
            displayName,
            profileImageUrl: safeHttpsUrl(raw.profileImageUrl),
            updatedAt: now,
          })
          .returning()
      )[0];
    }

    const existing = (
      await db
        .select()
        .from(xPosts)
        .where(eq(xPosts.postId, normalized.postId))
        .all()
    )[0];
    const text = clean(raw.text, 5000);
    const values = {
      text: text || existing?.text || "",
      authorId: author?.id ?? existing?.authorId ?? null,
      createdAt: safeDate(raw.createdAt) ?? existing?.createdAt ?? null,
      lastSyncedAt: now,
      originalUrl: normalized.url,
      importSource: source,
      unavailable: false,
    };

    let databasePostId = existing?.id;
    if (existing) {
      await db.update(xPosts).set(values).where(eq(xPosts.id, existing.id));
      updated += 1;
    } else {
      databasePostId = (
        await db
          .insert(xPosts)
          .values({
            postId: normalized.postId,
            ...values,
            firstSyncedAt: now,
          })
          .returning({ id: xPosts.id })
      )[0]?.id;
      newlyAdded += 1;
    }
    if (!databasePostId) continue;

    const mediaKey = `${normalized.postId}:primary`;
    const existingMedia = (
      await db
        .select()
        .from(media)
        .where(eq(media.mediaKey, mediaKey))
        .all()
    )[0];
    const mediaValues = {
      postId: databasePostId,
      type: raw.mediaType === "animated_gif" ? "animated_gif" : "video",
      previewImageUrl:
        safeHttpsUrl(raw.previewImageUrl) ??
        existingMedia?.previewImageUrl ??
        null,
      sourceUrl:
        safeVideoUrl(raw.mediaUrl) ??
        existingMedia?.sourceUrl ??
        null,
      unavailable: false,
      updatedAt: now,
    };
    if (existingMedia) {
      await db
        .update(media)
        .set(mediaValues)
        .where(eq(media.id, existingMedia.id));
    } else {
      await db.insert(media).values({ mediaKey, ...mediaValues });
    }
  }

  const historyId = history[0]?.id;
  if (historyId) {
    await db
      .update(syncHistory)
      .set({
        completedAt: new Date(),
        postsFetched: input.length,
        videoPosts: input.length - skipped,
        newlyAdded,
        updated,
        pagesFetched: 1,
      })
      .where(eq(syncHistory.id, historyId));
  }
  return { received: input.length, newlyAdded, updated, skipped };
}
