CREATE TABLE "activity_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"membership_id" integer NOT NULL,
	"lesson_item_id" integer NOT NULL,
	"client_key" text NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"progress" integer,
	"finished" boolean DEFAULT false NOT NULL,
	"score" integer,
	"max_score" integer,
	"summary" text DEFAULT '' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "html_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"teacher_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"html" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "html_activities_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_lesson_item_id_lesson_items_id_fk" FOREIGN KEY ("lesson_item_id") REFERENCES "public"."lesson_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "html_activities" ADD CONSTRAINT "html_activities_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "html_activities" ADD CONSTRAINT "html_activities_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_attempts_key_idx" ON "activity_attempts" USING btree ("membership_id","lesson_item_id","client_key");