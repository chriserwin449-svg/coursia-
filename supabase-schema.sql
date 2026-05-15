-- ═══════════════════════════════════════════════════
--  COURSIA — Supabase PostgreSQL Schema
-- ═══════════════════════════════════════════════════
-- Run this SQL in your Supabase SQL Editor
-- (Supabase Dashboard → SQL Editor → New query → Paste → Run)
--
-- IMPORTANT: This creates the User table for authentication
-- and all course-related tables automatically.
-- ═══════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User table (authentication)
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT,
  "image" TEXT,
  "role" TEXT NOT NULL DEFAULT 'student',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- App Settings (flame points, subscription)
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT PRIMARY KEY DEFAULT 'main',
  "userId" TEXT NOT NULL UNIQUE,
  "flamePoints" INTEGER NOT NULL DEFAULT 0,
  "hasSubscription" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Flame Transactions
CREATE TABLE IF NOT EXISTS "FlameTransaction" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "courseId" TEXT,
  "chapterId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Courses
CREATE TABLE IF NOT EXISTS "Course" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sourceLinks" TEXT NOT NULL DEFAULT '[]',
  "flameCost" INTEGER NOT NULL DEFAULT 0,
  "userId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Chapters
CREATE TABLE IF NOT EXISTS "Chapter" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Chapter Quizzes
CREATE TABLE IF NOT EXISTS "Quiz" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "questions" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL UNIQUE,
  CONSTRAINT "Quiz_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Chapter Progress
CREATE TABLE IF NOT EXISTS "ChapterProgress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "chapterId" TEXT NOT NULL UNIQUE,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "completedAt" DATETIME,
  "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ChapterProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Course Final Quiz
CREATE TABLE IF NOT EXISTS "CourseQuiz" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "questions" TEXT NOT NULL,
  "courseId" TEXT NOT NULL UNIQUE,
  CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Course Progress
CREATE TABLE IF NOT EXISTS "CourseProgress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "courseId" TEXT NOT NULL UNIQUE,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "score" INTEGER NOT NULL DEFAULT 0,
  "passedAt" DATETIME,
  "flameAwarded" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "CourseProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Study Sessions
CREATE TABLE IF NOT EXISTS "StudySession" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "chapterId" TEXT,
  "courseId" TEXT NOT NULL,
  "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endTime" DATETIME,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StudySession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Course_userId_idx" ON "Course"("userId");
CREATE INDEX IF NOT EXISTS "Chapter_courseId_idx" ON "Chapter"("courseId");
CREATE INDEX IF NOT EXISTS "FlameTransaction_userId_idx" ON "FlameTransaction"("userId");
CREATE INDEX IF NOT EXISTS "StudySession_courseId_idx" ON "StudySession"("courseId");
