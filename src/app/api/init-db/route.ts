import { NextResponse } from "next/server";

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL, "email" TEXT NOT NULL, "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Course" (
    "id" TEXT NOT NULL, "userId" TEXT, "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '', "sourceLinks" TEXT NOT NULL DEFAULT '[]',
    "level" INTEGER NOT NULL DEFAULT 0, "flameCost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Chapter" (
    "id" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '', "order" INTEGER NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ChapterProgress" (
    "id" TEXT NOT NULL, "chapterId" TEXT NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0, "completedAt" TIMESTAMP(3), "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ChapterProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChapterProgress_chapterId_key" ON "ChapterProgress"("chapterId");
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CourseQuiz" (
    "id" TEXT NOT NULL, "questions" TEXT NOT NULL, "courseId" TEXT NOT NULL,
    CONSTRAINT "CourseQuiz_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CourseQuiz_courseId_key" ON "CourseQuiz"("courseId");
ALTER TABLE "CourseQuiz" ADD CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CourseProgress" (
    "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0, "passedAt" TIMESTAMP(3), "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CourseProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CourseProgress_courseId_key" ON "CourseProgress"("courseId");
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Quiz" (
    "id" TEXT NOT NULL, "questions" TEXT NOT NULL, "chapterId" TEXT NOT NULL,
    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Quiz_chapterId_key" ON "Quiz"("chapterId");
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StudySession" (
    "id" TEXT NOT NULL, "userId" TEXT, "chapterId" TEXT, "courseId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL, "endTime" TIMESTAMP(3), "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_course_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_courseProgress_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseProgress"("courseId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'main', "flamePoints" INTEGER NOT NULL DEFAULT 0,
    "hasSubscription" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlameTransaction" (
    "id" TEXT NOT NULL, "amount" INTEGER NOT NULL, "reason" TEXT NOT NULL,
    "courseId" TEXT, "chapterId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlameTransaction_pkey" PRIMARY KEY ("id")
);
`;

export async function POST() {
  try {
    const { db } = await import("@/lib/db");

    // Test connection
    await db.$queryRaw`SELECT 1 as test`;

    // Check which tables exist
    const tables = await db.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    const existing = (tables as { table_name: string }[]).map((t) => t.table_name);

    const required = ["User", "Course", "Chapter", "Quiz", "ChapterProgress", "CourseQuiz", "CourseProgress", "StudySession", "AppSettings", "FlameTransaction"];
    const missing = required.filter((t) => !existing.includes(t));

    if (missing.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All tables already exist!",
        tables: existing,
      });
    }

    // Tables are missing — return SQL for manual execution
    return NextResponse.json({
      success: false,
      message: `${missing.length} table(s) missing. Run the SQL in Supabase SQL Editor.`,
      missing,
      existing,
      sql: CREATE_TABLES_SQL,
    });
  } catch (error) {
    console.error("Init DB error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: msg, sql: CREATE_TABLES_SQL },
      { status: 500 },
    );
  }
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return NextResponse.json({
    configured: !!(dbUrl && dbUrl.startsWith("postgres")),
    supabaseConfigured: !!supabaseUrl,
    dbUrlPrefix: dbUrl ? dbUrl.substring(0, 30) + "..." : "not set",
  });
}
