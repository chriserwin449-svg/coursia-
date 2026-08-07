"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Trash2,
  ChevronRight,
  Library as LibraryIcon,
  Loader2,
  Search,
  Share2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
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
  const courses = useAppStore((s) => s.courses);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showShared, setShowShared] = useState(false);
  const [sharedCourses, setSharedCourses] = useState<Array<{
    id: string;
    courseId: string;
    courseTitle: string;
    courseDescription: string;
    chapterCount: number;
    overallProgress: number;
    courseCompleted: boolean;
    message: string;
    sharedBy: string;
    sharedByName: string;
    sharedAt: string;
    wasUnread: boolean;
  }>>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [deleteShareTarget, setDeleteShareTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingShare, setDeletingShare] = useState<string | null>(null);

  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setView = useAppStore((s) => s.setView);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const userId = useAppStore.getState().userId;
      const res = await fetch(`/api/courses?userId=${userId || ''}`);
      const data = await res.json();
      if (res.ok) useAppStore.getState().setCourses(data.courses || []);
    } catch { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, []);

  const fetchSharedCourses = async () => {
    setLoadingShared(true);
    try {
      const userId = useAppStore.getState().userId;
      const res = await fetch(`/api/courses/shared?userId=${userId}`);
      const data = await res.json();
      if (res.ok) setSharedCourses(data.sharedCourses || []);
    } catch { /* */ }
    finally { setLoadingShared(false); }
  };

  useEffect(() => {
    if (showShared) fetchSharedCourses();
  }, [showShared]);

  const deleteSharedCourse = async (shareId: string) => {
    setDeletingShare(shareId);
    setDeleteShareTarget(null);
    try {
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      await fetch(`/api/courses/shared/${shareId}`, { method: "DELETE", headers });
      setSharedCourses((prev) => prev.filter((sc) => sc.id !== shareId));
      toast.success(lang === "fr" ? "Cours partagé supprimé" : "Shared course removed");
    } catch {
      toast.error(lang === "fr" ? "Erreur lors de la suppression" : "Failed to remove");
    } finally {
      setDeletingShare(null);
    }
  };

  const deleteCourse = async (id: string) => {
    setDeleting(id);
    setDeleteTarget(null);
    try {
      const userId = useAppStore.getState().userId;
      const headers: Record<string, string> = {};
      if (userId) headers["Authorization"] = `Bearer ${userId}`;
      await fetch(`/api/courses/${id}`, { method: "DELETE", headers });
      useAppStore.getState().removeCourse(id);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2">
          <span className="gradient-text">{tx.library.title}</span>
        </h1>
        <p className="text-base sm:text-lg font-semibold text-muted-foreground">
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

      {/* Shared courses toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setShowShared(false)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
            !showShared ? "bg-mauve/20 text-mauve-light" : "glass text-muted-foreground hover:bg-white/5"
          }`}
        >
          <LibraryIcon className="w-4 h-4" />
          {lang === "fr" ? "Mes cours" : "My Courses"}
        </button>
        <button
          onClick={() => setShowShared(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
            showShared ? "bg-mauve/20 text-mauve-light" : "glass text-muted-foreground hover:bg-white/5"
          }`}
        >
          <Users className="w-4 h-4" />
          {lang === "fr" ? "Cours partagés" : "Shared Courses"}
          {sharedCourses.length > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-mauve text-white text-[10px] font-bold flex items-center justify-center">
              {sharedCourses.length}
            </span>
          )}
        </button>
      </div>

      {showShared && (
        loadingShared ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-mauve" /></div>
        ) : sharedCourses.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-extrabold mb-2">{lang === "fr" ? "Aucun cours partagé" : "No shared courses"}</h3>
            <p className="text-muted-foreground font-semibold">
              {lang === "fr" ? "Quand un ami te partage un cours, il apparaîtra ici" : "When a friend shares a course with you, it will appear here"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {sharedCourses.map((sc) => (
              <div
                key={sc.id}
                className="group glass rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-mauve/40"
                onClick={() => openCourse(sc.courseId)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-mauve to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Share2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-mauve/10 text-mauve-light">
                      {lang === "fr" ? "Partagé" : "Shared"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteShareTarget({ id: sc.id, title: sc.courseTitle });
                      }}
                      disabled={deletingShare === sc.id}
                      className="p-2.5 rounded-xl hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                      title={lang === "fr" ? "Supprimer" : "Remove"}
                    >
                      {deletingShare === sc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-extrabold mb-2 line-clamp-2">{sc.courseTitle}</h3>
                  <p className="text-sm text-muted-foreground font-semibold mb-1">
                    {lang === "fr"
                      ? `Par ${sc.sharedByName}`
                      : `By ${sc.sharedByName}`}
                  </p>
                  {sc.message && (
                    <p className="text-xs text-mauve-light/80 italic mb-2">"{sc.message}"</p>
                  )}
                  {sc.chapterCount > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                        <span>{sc.chapterCount} {lang === "fr" ? "chapitres" : "chapters"}</span>
                        <span>{sc.overallProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-night overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(sc.overallProgress)} transition-all duration-700`}
                          style={{ width: `${sc.overallProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60 font-semibold">
                    {new Date(sc.sharedAt).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!showShared && (
      <>
      {/* Empty state — no courses at all */}
      {courses.length === 0 && (
        <div className="text-center py-12 sm:py-24">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-3xl bg-mauve/10 flex items-center justify-center mx-auto mb-6 sm:mb-8">
            <LibraryIcon className="w-8 h-8 sm:w-12 sm:h-12 text-mauve-light/50" />
          </div>
          <h3 className="text-xl sm:text-3xl font-extrabold mb-3">{tx.library.empty}</h3>
          <p className="text-base sm:text-lg font-semibold text-muted-foreground mb-6 sm:mb-8">{tx.library.emptyDesc}</p>
          <button
            onClick={() => setView("create")}
            className="inline-flex items-center gap-3 px-8 py-4 sm:px-10 sm:py-5 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-base sm:text-xl font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer glow-mauve min-h-[44px]"
          >
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="group glass rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-mauve/40 hover:bg-mauve/5"
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
                <h3 className="text-lg sm:text-xl font-extrabold mb-2 line-clamp-2">{course.title}</h3>
                <p className="text-sm sm:text-base font-semibold text-muted-foreground line-clamp-2 mb-4 sm:mb-5">
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
      </>
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

      {/* ── Delete Shared Course Confirmation Dialog ── */}
      <AlertDialog
        open={!!deleteShareTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteShareTarget(null);
        }}
      >
        <AlertDialogContent className="glass rounded-3xl border-border sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl font-extrabold text-foreground">
                {lang === "fr" ? "Retirer ce cours ?" : "Remove this course?"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed pt-1">
              {lang === "fr" ? (
                <>
                  Tu es sur le point de retirer <span className="font-bold text-foreground">&ldquo;{deleteShareTarget?.title}&rdquo;</span> de tes cours partagés.
                  <br />
                  Cette action est <span className="font-bold text-destructive">irréversible</span>. Le cours sera retiré de ta bibliothèque.
                </>
              ) : (
                <>
                  You are about to remove <span className="font-bold text-foreground">&ldquo;{deleteShareTarget?.title}&rdquo;</span> from your shared courses.
                  <br />
                  This action is <span className="font-bold text-destructive">irreversible</span>. The course will be removed from your library.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3 pt-2">
            <AlertDialogCancel
              onClick={() => setDeleteShareTarget(null)}
              className="rounded-full px-6 py-3 font-bold cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {lang === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteShareTarget && deleteSharedCourse(deleteShareTarget.id)}
              disabled={!!deletingShare}
              className="rounded-full px-6 py-3 font-bold cursor-pointer bg-destructive text-white hover:bg-destructive/90 border-0"
            >
              {deletingShare ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang === "fr" ? "Suppression..." : "Removing..."}
                </span>
              ) : (
                lang === "fr" ? "Oui, retirer" : "Yes, remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
