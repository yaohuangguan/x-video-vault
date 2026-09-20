CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `authors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`x_user_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`profile_image_url` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authors_x_user_id` ON `authors` (`x_user_id`);--> statement-breakpoint
CREATE INDEX `idx_authors_username` ON `authors` (`username`);--> statement-breakpoint
CREATE TABLE `extension_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_hint` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_used_at` integer,
	`revoked` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_extension_tokens_hash` ON `extension_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_extension_tokens_revoked` ON `extension_tokens` (`revoked`);--> statement-breakpoint
CREATE TABLE `local_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_local_tags_name` ON `local_tags` (`name`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_key` text NOT NULL,
	`post_id` integer NOT NULL,
	`type` text NOT NULL,
	`preview_image_url` text,
	`unavailable` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `x_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_media_key` ON `media` (`media_key`);--> statement-breakpoint
CREATE INDEX `idx_media_post_id` ON `media` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_media_type` ON `media` (`type`);--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `x_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `local_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_post_tags_tag_id` ON `post_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `sync_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`posts_fetched` integer DEFAULT 0 NOT NULL,
	`video_posts` integer DEFAULT 0 NOT NULL,
	`newly_added` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`pages_fetched` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `idx_sync_history_started_at` ON `sync_history` (`started_at`);--> statement-breakpoint
CREATE TABLE `vault_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vault_sessions_expires_at` ON `vault_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `viewing_history` (
	`post_id` integer PRIMARY KEY NOT NULL,
	`view_count` integer DEFAULT 1 NOT NULL,
	`last_viewed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `x_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_viewing_history_last_viewed_at` ON `viewing_history` (`last_viewed_at`);--> statement-breakpoint
CREATE TABLE `x_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`author_id` integer,
	`created_at` text,
	`first_synced_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_synced_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`original_url` text NOT NULL,
	`import_source` text DEFAULT 'extension' NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`unavailable` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_x_posts_post_id` ON `x_posts` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_x_posts_created_at` ON `x_posts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_x_posts_last_synced_at` ON `x_posts` (`last_synced_at`);--> statement-breakpoint
CREATE INDEX `idx_x_posts_favorite` ON `x_posts` (`is_favorite`);
--> statement-breakpoint
PRAGMA optimize;
