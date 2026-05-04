"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Trash2,
  ChevronRight,
  Library as LibraryIcon,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useAppStore, type CourseData } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function Library() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setView = useAppStore((s) => s.setView);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (res.ok) setCourses(data.courses || []);
    } catch { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, []);

  const deleteCourse = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      setCourses(courses.filter((c) => c.id !== id));
    } catch { /* */ }
    finally { setDeleting(null); }
  };

  const openCourse = (id: string) => { setSelectedCourseId(id); setView("viewer"); };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return "from-gold to-gold-light";
    if (progress >= 50) return "from-mauve to-mauve-light";
    return "from-mauve-dark to-mauve";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-mauve" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Header - with proper margin from sidebar */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
            <span className="gradient-text">{tx.library.title}</span>
          </h1>
          <p className="text-lg font-semibold text-muted-foreground">
            {tx.library.courseCount(courses.length)}
          </p>
        </div>
        <button
          onClick={fetchCourses}
          disabled={loading}
          className="p-3 rounded-2xl glass hover:bg-white/10 transition-all cursor-pointer"
        >
          <RotateCcw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Empty state */}
      {courses.length === 0 && (
        <div className="text-center py-24">
          <div className="w-24 h-24 rounded-3xl bg-mauve/10 flex items-center justify-center mx-auto mb-8">
            <LibraryIcon className="w-12 h-12 text-mauve-light/50" />
          </div>
          <h3 className="text-3xl font-extrabold mb-3">{tx.library.empty}</h3>
          <p className="text-lg font-semibold text-muted-foreground mb-8">{tx.library.emptyDesc}</p>
          <button
            onClick={() => setView("create")}
            className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-xl font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer glow-mauve"
          >
            <BookOpen className="w-6 h-6" />
            {tx.library.createFirst}
          </button>
        </div>
      )}

      {/* Course Grid */}
      {courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="group glass rounded-3xl overflow-hidden hover:border-mauve/30 transition-all duration-300 cursor-pointer"
              onClick={() => openCourse(course.id)}
            >
              <div className="p-6">
                {/* Top row */}
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-mauve to-mauve-dark flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold px-4 py-1.5 rounded-full ${
                        course.overallProgress === 100
                          ? "bg-gold/20 text-gold"
                          : "bg-mauve/20 text-mauve-light"
                      }`}
                    >
                      {course.overallProgress}%
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCourse(course.id); }}
                      disabled={deleting === course.id}
                      className="p-2.5 rounded-xl hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                    >
                      {deleting === course.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-extrabold mb-2 line-clamp-2">{course.title}</h3>
                <p className="text-base font-semibold text-muted-foreground line-clamp-2 mb-5">
                  {course.description || `${course.chapters.length} ${tx.library.chapters}`}
                </p>

                {/* Progress bar */}
                <div className="mb-5">
                  <div className="flex justify-between text-sm font-semibold text-muted-foreground mb-2">
                    <span>{course.chapters.length} {tx.library.chapters}</span>
                    <span>{course.chapters.filter((c) => c.progress?.completed).length} {tx.library.completed}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-night overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(course.overallProgress)} transition-all duration-700`}
                      style={{ width: `${course.overallProgress}%` }}
                    />
                  </div>
                </div>

                {/* Continue button */}
                <div className="flex items-center gap-2 text-mauve-light text-base font-bold group-hover:gap-3 transition-all">
                  {tx.library.continue}
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
