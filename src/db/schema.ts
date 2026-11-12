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
  // תגיות נוספות של הקבוצה (חנ"מ, חמ"ד, ממלכתי...). נשלחות עם כל פריט שמפרסמים מהרצף לחומר פתוח.
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
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
  // הנושא שפתוח במסך המורה; נשמר כדי לחזור אליו בפעם הבאה.
  currentTopicId: integer("current_topic_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// נושא = קבוצת שיעורים רצופה ברצף (יחידה), עם צבע משלו בסרגל הנושאים.
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id")
    .notNull()
    .references(() => sequences.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id")
    .notNull()
    .references(() => sequences.id),
  topicId: integer("topic_id").references(() => topics.id),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  // כשהשיעור פורסם כאוסף בחומר פתוח: מזהה האוסף וכתובתו. פרסום חוזר מעדכן את אותו אוסף.
  publishedCollectionId: integer("published_collection_id"),
  publishedCollectionUrl: text("published_collection_url"),
  publishedAt: timestamp("published_at"),
  // "מה נלמד היום" (שקופית הפתיחה) ו"אז מה למדנו" (הסיכום). טקסט חופשי, שורה לכל נקודה.
  goals: text("goals").notNull().default(""),
  recap: text("recap").notNull().default(""),
  // מתי השיעור נפתח לתלמידים. ריק = עדיין מוסתר מהם.
  openedAt: timestamp("opened_at"),
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
  // סוג התוכן, באותן קטגוריות של חומר פתוח: סרטון, מצגת, להדפסה, מערך שיעור, פעילות, כלי דיגיטלי, תבנית, אחר.
  // מפוסט של חומר פתוח נגזר מהקטגוריה שלו; לקישור חיצוני מנוחש לפי הסוג, והמורה יכולה לשנות.
  contentType: text("content_type"),
  openstuffPostId: integer("openstuff_post_id"),
  // תיוג שנשלף אוטומטית: { classes: string[], subjects: string[], author: string }
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  // כשפורסם מהרצף לחומר פתוח: מזהה הפוסט (ממתין לאישור) ומתי נשלח.
  publishedPostId: integer("published_post_id"),
  publishedAt: timestamp("published_at"),
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
  // משך מתוכנן, באותה סקאלה כמו טופס ההעלאה בחומר פתוח: quarter | half | lesson | double | unit
  duration: text("duration"),
  // המורה הסכימה שהערת השימוש תופיע בחומר פתוח ("איך משתמשים"). ברירת מחדל: פרטית.
  shareNote: boolean("share_note").notNull().default(false),
  // הוחלף ב-duration. נשאר בסכמה כדי לא למחוק עמודה בייצור; אפשר להסיר במיגרציה עתידית.
  minutes: integer("minutes"),
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
  // שיוך לנושא. ריק = חל על כל הנושאים.
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  // "unit" = יחידה ארוכה (נפרסת על כמה מפגשים). מתאים לקישורים כלליים בלבד, לא לפריט בשיעור.
  duration: text("duration"),
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

// תלמיד: מזוהה רק לפי חשבון Google הארגוני. לא נשמרים שם או כתובת מייל, רק מזהה החשבון והדומיין.
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  googleSub: text("google_sub").notNull().unique(),
  domain: text("domain").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// שיוך תלמיד לקבוצת לימוד, עם כינוי שהתלמיד בחר (והמורה יכולה לערוך). כינוי נפרד לכל קבוצה.
export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("memberships_student_group_idx").on(t.studentId, t.groupId)],
);

// סימון "הגשתי" של תלמיד על פריט שהוגדר כמטלת הגשה.
export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    membershipId: integer("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    lessonItemId: integer("lesson_item_id")
      .notNull()
      .references(() => lessonItems.id, { onDelete: "cascade" }),
    doneAt: timestamp("done_at").defaultNow().notNull(),
    // מה שהתלמיד מגיש: תשובה בטקסט, קישור לעבודה, כמה היה קשה (1 קל, 2 בסדר, 3 קשה) ובקשת עזרה.
    answer: text("answer").notNull().default(""),
    link: text("link"),
    rating: integer("rating"),
    needsHelp: boolean("needs_help").notNull().default(false),
    // משוב קצר מהמורה, שהתלמיד רואה ליד ההגשה.
    feedback: text("feedback").notNull().default(""),
    feedbackAt: timestamp("feedback_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("submissions_member_item_idx").on(t.membershipId, t.lessonItemId)],
);

// "תצוגת לוח": תמונה של מה שהמורה ציירה על המסך במצב שיעור, שנשמרת לתלמידים.
export const lessonBoards = pgTable("lesson_boards", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  // תמונה מוקטנת כ-data URL (webp), כדי לא לנהל אחסון קבצים נפרד בשלב הזה.
  image: text("image").notNull(),
  caption: text("caption").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// קבצים שהמורה העלתה (בשלב הזה תמונות בלבד). נשמרים במסד עצמו, כדי שיגובו איתו ולא יידרש אחסון נפרד.
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  // מזהה אקראי בכתובת הקובץ: הקובץ ציבורי למי שיש לו את הכתובת (תלמידים צריכים לראות אותו), אבל אי אפשר לנחש אותה.
  token: text("token").notNull().unique(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachers.id),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  // התוכן ב-base64.
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
