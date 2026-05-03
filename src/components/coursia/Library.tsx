"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Trash2,
  ChevronRight,
  Library as LibraryIcon,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useAppStore, type CourseData } from "@/lib/store";

export default function Library() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setView = useAppStore((s) => s.setView);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (res.ok) setCourses(data.courses || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const deleteCourse = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      setCourses(courses.filter((c) => c.id !== id));
    } catch {
      // silently fail
    } finally {
      setDeleting(null);
    }
  };

  const openCourse = (id: string) => {
    setSelectedCourseId(id);
    setView("viewer");
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return "from-gold to-gold-light";
    if (progress >= 50) return "from-mauve to-mauve-light";
    return "from-mauve-dark to-mauve";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
              <span className="gradient-text">Mes Cours</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              {courses.length} cours créé{courses.length !== 1 ? "s" : ""}
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

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-mauve" />
          </div>
        )}

        {/* Empty state */}
        {!loading && courses.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-3xl bg-mauve/10 flex items-center justify-center mx-auto mb-6">
              <LibraryIcon className="w-10 h-10 text-mauve-light/50" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Aucun cours</h3>
            <p className="text-muted-foreground text-lg mb-6">
              Crée ton premier cours pour commencer à apprendre !
            </p>
            <button
              onClick={() => setView("create")}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-lg font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
              Créer un Cours
            </button>
          </motion.div>
        )}

        {/* Course Grid */}
        {!loading && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group glass rounded-3xl overflow-hidden hover:border-mauve/30 transition-all duration-300 cursor-pointer"
                onClick={() => openCourse(course.id)}
              >
                {/* Course card */}
                <div className="p-6">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-mauve to-mauve-dark flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold px-3 py-1 rounded-full ${
                          course.overallProgress === 100
                            ? "bg-gold/20 text-gold"
                            : "bg-mauve/20 text-mauve-light"
                        }`}
                      >
                        {course.overallProgress}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCourse(course.id);
                        }}
                        disabled={deleting === course.id}
                        className="p-2 rounded-xl hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
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
                  <h3 className="text-xl font-bold mb-2 line-clamp-2">{course.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {course.description || `${course.chapters.length} chapitres`}
                  </p>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{course.chapters.length} chapitres</span>
                      <span>{course.chapters.filter((c) => c.progress?.completed).length} terminés</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-night overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${course.overallProgress}%`,
                        }}
                        transition={{ delay: i * 0.05 + 0.2, duration: 0.8 }}
                        className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(
                          course.overallProgress
                        )}`}
                      />
                    </div>
                  </div>

                  {/* Open button */}
                  <div className="flex items-center gap-2 text-mauve-light text-sm font-semibold group-hover:gap-3 transition-all">
                    Continuer
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
