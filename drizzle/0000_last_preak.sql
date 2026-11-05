CREATE TABLE `council_commands` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`result` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
