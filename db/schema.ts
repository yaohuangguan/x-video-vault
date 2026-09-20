import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    xUserId: text("x_user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    profileImageUrl: text("profile_image_url"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("idx_authors_x_user_id").on(table.xUserId),
    index("idx_authors_username").on(table.username),
  ],
);

export const xPosts = sqliteTable(
  "x_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: text("post_id").notNull(),
    text: text("text").notNull().default(""),
    authorId: integer("author_id").references(() => authors.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at"),
    firstSyncedAt: integer("first_synced_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    originalUrl: text("original_url").notNull(),
    importSource: text("import_source").notNull().default("extension"),
    isFavorite: integer("is_favorite", { mode: "boolean" })
      .notNull()
      .default(false),
    unavailable: integer("unavailable", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("idx_x_posts_post_id").on(table.postId),
    index("idx_x_posts_created_at").on(table.createdAt),
    index("idx_x_posts_last_synced_at").on(table.lastSyncedAt),
    index("idx_x_posts_favorite").on(table.isFavorite),
  ],
);

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaKey: text("media_key").notNull(),
    postId: integer("post_id")
      .notNull()
      .references(() => xPosts.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    previewImageUrl: text("preview_image_url"),
    unavailable: integer("unavailable", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("idx_media_media_key").on(table.mediaKey),
    index("idx_media_post_id").on(table.postId),
    index("idx_media_type").on(table.type),
  ],
);

export const localTags = sqliteTable(
  "local_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex("idx_local_tags_name").on(table.name)],
);

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => xPosts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => localTags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("idx_post_tags_tag_id").on(table.tagId),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const vaultSessions = sqliteTable(
  "vault_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("idx_vault_sessions_expires_at").on(table.expiresAt)],
);

export const extensionTokens = sqliteTable(
  "extension_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenHint: text("token_hint").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    uniqueIndex("idx_extension_tokens_hash").on(table.tokenHash),
    index("idx_extension_tokens_revoked").on(table.revoked),
  ],
);

export const viewingHistory = sqliteTable(
  "viewing_history",
  {
    postId: integer("post_id")
      .primaryKey()
      .references(() => xPosts.id, { onDelete: "cascade" }),
    viewCount: integer("view_count").notNull().default(1),
    lastViewedAt: integer("last_viewed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("idx_viewing_history_last_viewed_at").on(table.lastViewedAt),
  ],
);

export const syncHistory = sqliteTable(
  "sync_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mode: text("mode").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    postsFetched: integer("posts_fetched").notNull().default(0),
    videoPosts: integer("video_posts").notNull().default(0),
    newlyAdded: integer("newly_added").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    pagesFetched: integer("pages_fetched").notNull().default(0),
    errorMessage: text("error_message"),
  },
  (table) => [index("idx_sync_history_started_at").on(table.startedAt)],
);

export const schema = {
  authors,
  xPosts,
  media,
  localTags,
  postTags,
  appSettings,
  vaultSessions,
  extensionTokens,
  viewingHistory,
  syncHistory,
};
