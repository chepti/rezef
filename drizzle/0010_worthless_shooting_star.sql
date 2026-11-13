CREATE TABLE "teacher_follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"followed_id" integer NOT NULL,
	"subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_follows" ADD CONSTRAINT "teacher_follows_follower_id_teachers_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_follows" ADD CONSTRAINT "teacher_follows_followed_id_teachers_id_fk" FOREIGN KEY ("followed_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_follows_pair_idx" ON "teacher_follows" USING btree ("follower_id","followed_id");