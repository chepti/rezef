CREATE TABLE "lesson_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"image" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"google_sub" text NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "students_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"membership_id" integer NOT NULL,
	"lesson_item_id" integer NOT NULL,
	"done_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "goals" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "recap" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "opened_at" timestamp;--> statement-breakpoint
ALTER TABLE "lesson_boards" ADD CONSTRAINT "lesson_boards_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_lesson_item_id_lesson_items_id_fk" FOREIGN KEY ("lesson_item_id") REFERENCES "public"."lesson_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_student_group_idx" ON "memberships" USING btree ("student_id","group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_member_item_idx" ON "submissions" USING btree ("membership_id","lesson_item_id");--> statement-breakpoint
INSERT INTO "allowed_domains" ("domain") VALUES ('tzfonet.org.il'),('edu-haifa.org.il'),('educ.org.il'),('taded.org.il'),('jerschools.org.il'),('manhischools.org.il'),('edu-darom.org.il'),('hityash.org.il'),('haredi.org.il'),('ort.edu.gov.il'),('amit.edu.gov.il'),('israschool.org.il'),('tzafon365.org.il'),('haifa365.org.il'),('merkaz365.org.il'),('telaviv365.org.il'),('jerusalem365.org.il'),('manhi365.org.il'),('darom365.org.il'),('hityashvuti365.org.il'),('charedi365.org.il'),('schools.org.il') ON CONFLICT DO NOTHING;
