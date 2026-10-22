CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_id" integer NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cross_items" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "sequences" ADD COLUMN "current_topic_id" integer;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_items" ADD CONSTRAINT "cross_items_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;