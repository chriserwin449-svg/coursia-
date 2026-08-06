"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  BookOpen,
  Clock,
  Target,
  Loader2,
  ChevronLeft,
  Flame,
  Award,
  Star,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getCurrentFlameType, formatFlamePoints } from "@/lib/flames";

interface TargetUser {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
}

interface UserJourneyData {
  user: TargetUser & { username?: string | null; memberSince: string };
  stats: {
    totalCourses: number;
    completedCourses: number;
    activeCourses: number;
    totalChapters: number;
    completedChapters: number;
    totalStudyTime: number;
    averageScore: number;
    totalFlamePoints: number;
  };
  badges: {
    earned: Array<{ id: string; name: string; nameEn: string; description: string; descriptionEn: string; icon: string; threshold: number }>;
    all: Array<{ id: string; name: string; nameEn: string; description: string; descriptionEn: string; icon: string; threshold: number; earned: boolean }>;
    next: { id: string; name: string; nameEn: string; description: string; descriptionEn: string; icon: string; threshold: number } | null;
    progress: { current: number; next: number; percentage: number };
  };
  courses: Array<{
    id: string;
    title: string;
    description: string;
    level: number;
    chapterCount: number;
    completedChapters: number;
    overallProgress: number;
    courseCompleted: boolean;
    createdAt: string;
  }>;
}

export default function UserJourneyView() {
  const lang = useAppStore((s) => s.lang);
  const journeyTargetUser = useAppStore((s) => s.journeyTargetUser);
  const setJourneyTargetUser = useAppStore((s) => s.setJourneyTargetUser);

  const [data, setData] = useState<UserJourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!journeyTargetUser) return;
    const fetchJourney = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/users/${journeyTargetUser.id}/journey`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchJourney();
  }, [journeyTargetUser]);

  const handleBack = () => {
    setJourneyTargetUser(null);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return `0 ${lang === "fr" ? "min" : "min"}`;
    if (minutes < 60) return `${Math.round(minutes)} ${lang === "fr" ? "min" : "min"}`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) return `${hours}${lang === "fr" ? "h" : "h"}`;
    return `${hours}${lang === "fr" ? "h" : "h"} ${mins}${lang === "fr" ? "min" : "min"}`;
  };

  const renderAvatar = (user: TargetUser) => {
    if (user.avatar) {
      return (
        <img
          src={user.avatar}
          alt={user.firstName}
          className="w-16 h-16 rounded-2xl object-cover border-2 border-mauve/30"
        />
      );
    }
    return (
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-mauve to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
        {user.firstName.charAt(0).toUpperCase()}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
          {lang === "fr" ? "Retour" : "Back"}
        </button>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-mauve" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
          {lang === "fr" ? "Retour" : "Back"}
        </button>
        <div className="text-center py-12">
          <p className="text-xl font-bold text-muted-foreground">
            {lang === "fr"
              ? "Impossible de charger le parcours"
              : "Unable to load journey"}
          </p>
        </div>
      </div>
    );
  }

  const flamePoints = data.stats.totalFlamePoints;
  const flameType = getCurrentFlameType(flamePoints);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16 fade-in">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 cursor-pointer group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-semibold">
          {lang === "fr" ? "Retour à mon parcours" : "Back to my journey"}
        </span>
      </button>

      {/* User Profile Header */}
      <div className="glass rounded-3xl p-6 sm:p-8 mb-8 border border-mauve/20">
        <div className="flex items-center gap-4 sm:gap-6">
          {renderAvatar(data.user)}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">
              <span className="gradient-text">
                {data.user.firstName} {data.user.lastName}
              </span>
            </h1>
            {data.user.username && (
              <p className="text-sm text-muted-foreground font-semibold">
                @{data.user.username}
              </p>
            )}
            <p className="text-sm text-muted-foreground/70 mt-1">
              {lang === "fr" ? "Membre depuis" : "Member since"}{" "}
              {new Date(data.user.memberSince).toLocaleDateString(
                lang === "fr" ? "fr-FR" : "en-US",
                { month: "long", year: "numeric" }
              )}
            </p>
          </div>
          {/* Flame badge */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <span className="text-2xl">{flameType.emoji}</span>
            </div>
            <span className="text-xs font-bold text-red-400">
              {formatFlamePoints(flamePoints)} FP
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          {
            icon: BookOpen,
            label: lang === "fr" ? "Cours créés" : "Courses created",
            value: data.stats.totalCourses,
            color: "text-mauve-light",
            bgColor: "bg-mauve/10",
          },
          {
            icon: Trophy,
            label: lang === "fr" ? "Terminés" : "Completed",
            value: data.stats.completedCourses,
            color: "text-gold",
            bgColor: "bg-gold/10",
          },
          {
            icon: Clock,
            label: lang === "fr" ? "Temps d'étude" : "Study time",
            value: formatTime(data.stats.totalStudyTime),
            color: "text-blue-400",
            bgColor: "bg-blue-500/10",
          },
          {
            icon: Target,
            label: lang === "fr" ? "Score moyen" : "Avg score",
            value: `${data.stats.averageScore}%`,
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-2xl p-4 text-center border border-transparent"
          >
            <div
              className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center mx-auto mb-2`}
            >
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold mb-0.5">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      {data.badges.earned.length > 0 && (
        <div className="glass rounded-3xl p-6 sm:p-8 mb-8">
          <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-gold" />
            {lang === "fr" ? "Badges obtenus" : "Earned Badges"}
          </h2>
          <div className="flex flex-wrap gap-3">
            {data.badges.earned.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold/10 border border-gold/20"
              >
                <span className="text-xl">{badge.icon}</span>
                <span className="text-sm font-bold text-gold">
                  {lang === "fr" ? badge.name : badge.nameEn}
                </span>
              </div>
            ))}
          </div>
          {data.badges.next && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">
                  {lang === "fr" ? "Prochain badge" : "Next badge"}:{" "}
                  <span className="font-bold text-foreground">
                    {data.badges.next.icon}{" "}
                    {lang === "fr" ? data.badges.next.name : data.badges.next.nameEn}
                  </span>
                </p>
                <span className="text-xs font-bold text-muted-foreground">
                  {data.badges.progress.percentage}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-night overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-light transition-all duration-700"
                  style={{ width: `${data.badges.progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Courses List */}
      {data.courses.length > 0 ? (
        <div>
          <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-mauve-light" />
            {lang === "fr"
              ? `${data.courses.length} cours`
              : `${data.courses.length} courses`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.courses.map((course) => (
              <div
                key={course.id}
                className="glass rounded-3xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-transparent hover:border-mauve/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mauve to-purple-600 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  {course.courseCompleted && (
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-gold/20 text-gold flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {lang === "fr" ? "Terminé" : "Done"}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold mb-2 line-clamp-2">
                  {course.title}
                </h3>
                {course.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {course.description}
                  </p>
                )}
                {/* Progress */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1">
                    <span>
                      {course.completedChapters}/{course.chapterCount}{" "}
                      {lang === "fr" ? "chap." : "ch."}
                    </span>
                    <span>{course.overallProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-night overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        course.overallProgress === 100
                          ? "bg-gradient-to-r from-gold to-gold-light"
                          : "bg-gradient-to-r from-mauve to-mauve-light"
                      }`}
                      style={{ width: `${course.overallProgress}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/50">
                  {new Date(course.createdAt).toLocaleDateString(
                    lang === "fr" ? "fr-FR" : "en-US",
                    { day: "numeric", month: "short", year: "numeric" }
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-8 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-semibold">
            {lang === "fr"
              ? "Aucun cours pour le moment"
              : "No courses yet"}
          </p>
        </div>
      )}
    </div>
  );
}
