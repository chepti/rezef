ALTER TABLE "items" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "published_collection_id" integer;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "published_collection_url" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "published_at" timestamp;