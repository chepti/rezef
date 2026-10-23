ALTER TABLE "cross_items" ADD COLUMN "duration" text;
--> statement-breakpoint
UPDATE "lesson_items" SET "duration" = NULL WHERE "duration" = 'unit';
