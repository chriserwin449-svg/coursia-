"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Trash2,
  ChevronRight,
  Library as LibraryIcon,
  Loader2,
  Search,
} from "lucide-react";
import { useAppStore, type CourseData } from "@/lib/store";
import { t } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export default function Library() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

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
    setDeleteTarget(null);
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

  // Filter courses by search query
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase().trim();
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [courses, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-mauve" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 pt-20 pb-8 md:pt-24 md:pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
          <span className="gradient-text">{tx.library.title}</span>
        </h1>
        <p className="text-lg font-semibold text-muted-foreground">
          {tx.library.courseCount(courses.length)}
        </p>
      </div>

      {/* Search bar */}
      {courses.length > 0 && (
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tx.library.search}
            className="w-full pl-12 pr-6 py-4 rounded-2xl bg-night border border-border text-foreground text-base font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Empty state — no courses at all */}
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

      {/* No search results */}
      {courses.length > 0 && filteredCourses.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 opacity-40">🔍</div>
          <h3 className="text-xl font-extrabold mb-2">
            {tx.library.noResults} &ldquo;{searchQuery}&rdquo;
          </h3>
          <p className="text-muted-foreground font-semibold">
            {lang === "fr"
              ? "Essaie un autre terme de recherche"
              : "Try a different search term"}
          </p>
        </div>
      )}

      {/* Course Grid */}
      {filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
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
                      {course.chapters.filter((c) => c.progress?.completed).length}/{course.chapters.length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: course.id, title: course.title });
                      }}
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
                    <span>{lang === "fr" ? "Progression" : "Progress"}</span>
                    <span>{course.overallProgress}%</span>
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

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="glass rounded-3xl border-border sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl font-extrabold text-foreground">
                {lang === "fr" ? "Supprimer ce cours ?" : "Delete this course?"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed pt-1">
              {lang === "fr" ? (
                <>
                  Tu es sur le point de supprimer <span className="font-bold text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span>.
                  <br />
                  Cette action est <span className="font-bold text-destructive">irréversible</span>. Tous les chapitres, quiz et ta progression seront définitivement supprimés.
                </>
              ) : (
                <>
                  You are about to delete <span className="font-bold text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span>.
                  <br />
                  This action is <span className="font-bold text-destructive">irreversible</span>. All chapters, quizzes and your progress will be permanently deleted.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3 pt-2">
            <AlertDialogCancel
              onClick={() => setDeleteTarget(null)}
              className="rounded-full px-6 py-3 font-bold cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {lang === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteCourse(deleteTarget.id)}
              disabled={!!deleting}
              className="rounded-full px-6 py-3 font-bold cursor-pointer bg-destructive text-white hover:bg-destructive/90 border-0"
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang === "fr" ? "Suppression..." : "Deleting..."}
                </span>
              ) : (
                lang === "fr" ? "Oui, supprimer" : "Yes, delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
