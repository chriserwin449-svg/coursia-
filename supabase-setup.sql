-- ═══════════════════════════════════════════════
-- COURSIA - Supabase Database Setup
-- Paste this entire script in Supabase SQL Editor and click RUN
-- ═══════════════════════════════════════════════

-- 1. Users table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. App Settings
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
  "flamePoints" INTEGER NOT NULL DEFAULT 0,
  "hasSubscription" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Courses
CREATE TABLE IF NOT EXISTS "Course" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sourceLinks" TEXT NOT NULL DEFAULT '[]',
  "level" INTEGER NOT NULL DEFAULT 0,
  "flameCost" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 4. Chapters
CREATE TABLE IF NOT EXISTS "Chapter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. Quizzes (per chapter)
CREATE TABLE IF NOT EXISTS "Quiz" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "questions" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL UNIQUE,
  CONSTRAINT "Quiz_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. Chapter Progress
CREATE TABLE IF NOT EXISTS "ChapterProgress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chapterId" TEXT NOT NULL UNIQUE,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ChapterProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7. Course Quiz (final)
CREATE TABLE IF NOT EXISTS "CourseQuiz" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "questions" TEXT NOT NULL,
  "courseId" TEXT NOT NULL UNIQUE,
  CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 8. Course Progress
CREATE TABLE IF NOT EXISTS "CourseProgress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL UNIQUE,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "passedAt" TIMESTAMP(3),
  "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "CourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 9. Flame Transactions
CREATE TABLE IF NOT EXISTS "FlameTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "courseId" TEXT,
  "chapterId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlameTransaction_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FlameTransaction_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 10. Study Sessions
CREATE TABLE IF NOT EXISTS "StudySession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "chapterId" TEXT,
  "courseId" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endTime" TIMESTAMP(3),
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudySession_course_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudySession_courseProgress_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseProgress"("courseId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ═══════════════════════════════════════════════
-- Indexes for performance
-- ═══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "Course_userId_idx" ON "Course"("userId");
CREATE INDEX IF NOT EXISTS "Chapter_courseId_idx" ON "Chapter"("courseId");
CREATE INDEX IF NOT EXISTS "Chapter_order_idx" ON "Chapter"("courseId", "order");
CREATE INDEX IF NOT EXISTS "StudySession_courseId_idx" ON "StudySession"("courseId");
CREATE INDEX IF NOT EXISTS "StudySession_userId_idx" ON "StudySession"("userId");
CREATE INDEX IF NOT EXISTS "FlameTransaction_courseId_idx" ON "FlameTransaction"("courseId");

-- ═══════════════════════════════════════════════
-- UpdatedAt triggers (auto-update)
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION "updateUpdatedAtColumn"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER "User_updatedAt" BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION "updateUpdatedAtColumn"();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "Course_updatedAt" BEFORE UPDATE ON "Course" FOR EACH ROW EXECUTE FUNCTION "updateUpdatedAtColumn"();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "AppSettings_updatedAt" BEFORE UPDATE ON "AppSettings" FOR EACH ROW EXECUTE FUNCTION "updateUpdatedAtColumn"();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ═══════════════════════════════════════════════
-- Done! All 10 tables created successfully.
-- ═══════════════════════════════════════════════
