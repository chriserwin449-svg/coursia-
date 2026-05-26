-- ============================================
-- Coursia - Supabase Database Setup (SAFE)
-- Ignore les tables et contraintes qui existent déjà
-- ============================================

-- 1. Table User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Table AppSettings
CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "flamePoints" INTEGER NOT NULL DEFAULT 0,
    "hasSubscription" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 3. Table FlameTransaction
CREATE TABLE IF NOT EXISTS "FlameTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "courseId" TEXT,
    "chapterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table Course
CREATE TABLE IF NOT EXISTS "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sourceLinks" TEXT NOT NULL DEFAULT '[]',
    "level" INTEGER NOT NULL DEFAULT 0,
    "flameCost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 5. Table Chapter
CREATE TABLE IF NOT EXISTS "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. Table Quiz
CREATE TABLE IF NOT EXISTS "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questions" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    CONSTRAINT "Quiz_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_chapterId_key" UNIQUE ("chapterId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. Table ChapterProgress
CREATE TABLE IF NOT EXISTS "ChapterProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ChapterProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_chapterId_key" UNIQUE ("chapterId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. Table CourseQuiz
CREATE TABLE IF NOT EXISTS "CourseQuiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questions" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "CourseQuiz" ADD CONSTRAINT "CourseQuiz_courseId_key" UNIQUE ("courseId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 9. Table CourseProgress
CREATE TABLE IF NOT EXISTS "CourseProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "passedAt" TIMESTAMP(3),
    "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DO $$ BEGIN ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_courseId_key" UNIQUE ("courseId"); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 10. Table StudySession
CREATE TABLE IF NOT EXISTS "StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "chapterId" TEXT,
    "courseId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StudySession_course_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudySession_courseProgress_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseProgress" ("courseId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ✅ Terminé !
