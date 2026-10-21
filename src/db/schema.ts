import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const teachers = pgTable(
  "teachers",
  {
    id: serial("id").primaryKey(),
    displayName: text("display_name").notNull(),
    // חיבור לחשבון חומר פתוח (וורדפרס) ולחשבון Google הארגוני. שניהם אופציונליים עד שמחברים.
    wpUserId: integer("wp_user_id"),
    googleEmail: text("google_email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("teachers_wp_user_id_idx").on(t.wpUserId)],
);

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachers.id),
  name: text("name").notNull(),
  // הקשר שמתייג אוטומטית כל פריט שנתלה ברצף של הקבוצה.
  className: text("class_name"),
  subjectName: text("subject_name"),
  schoolYear: text("school_year").notNull(),
  joinCode: text("join_code").notNull().unique(),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sequences = pgTable("sequences", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
  title: text("title").notNull(),
  // נתוני שיתוף בין מורים: private | followable | template
  visibility: text("visibility").notNull().default("private"),
  // מיקום "אנחנו כאן": שיעור שעד אליו הרצף נחשף לתלמידים.
  currentLessonId: integer("current_lesson_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id")
    .notNull()
    .references(() => sequences.id),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// פריט = קישור או קובץ, ללא תלות בשיעור. אותו פריט יכול להופיע בכמה שיעורים.
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachers.id),
  url: text("url").notNull(),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  siteName: text("site_name"),
  // openstuff | youtube | video | slides | doc | file | game | link
  kind: text("kind").notNull().default("link"),
  openstuffPostId: integer("openstuff_post_id"),
  // תיוג שנשלף אוטומטית: { classes: string[], subjects: string[], author: string }
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessonItems = pgTable("lesson_items", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  position: integer("position").notNull(),
  // הקניה | תרגול | הערכה | רקע | העשרה
  phase: text("phase"),
  note: text("note").notNull().default(""),
  // רמת קושי לחומרים מדורגים: base | mid | advanced
  level: text("level"),
  isAssignment: boolean("is_assignment").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// פריטים רוחביים: תכנון יחידה, תרגיל חוזר, בוחן קבוע. שייכים לרצף, לא לשיעור.
export const crossItems = pgTable("cross_items", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id")
    .notNull()
    .references(() => sequences.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  note: text("note").notNull().default(""),
  // none | weekly | monthly: תזכורת חזרה בלבד, בלי לוגיקת תזמון בשלב 1.
  repeat: text("repeat").notNull().default("none"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerTeacherId: integer("follower_teacher_id")
    .notNull()
    .references(() => teachers.id),
  sequenceId: integer("sequence_id")
    .notNull()
    .references(() => sequences.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const allowedDomains = pgTable("allowed_domains", {
  domain: text("domain").primaryKey(),
  region: text("region"),
  note: text("note"),
});
