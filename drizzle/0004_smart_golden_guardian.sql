ALTER TABLE "groups" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "published_post_id" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "lesson_items" ADD COLUMN "share_note" boolean DEFAULT false NOT NULL;