CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"teacher_id" integer NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "files_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "answer" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "needs_help" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "feedback" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "feedback_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;