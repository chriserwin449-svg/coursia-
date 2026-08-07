"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BookOpen, Check, CheckCheck, X, Share2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface NotificationData {
  courseId?: string;
  shareId?: string;
  courseTitle?: string;
  sharedBy?: string;
  sharedByName?: string;
}

export default function NotificationBell() {
  const lang = useAppStore((s) => s.lang);
  const userId = useAppStore((s) => s.userId);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const unreadCount = useAppStore((s) => s.unreadNotificationCount);
  const setUnreadNotificationCount = useAppStore((s) => s.setUnreadNotificationCount);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const headers: Record<string, string> = {};
      headers["Authorization"] = `Bearer ${userId}`;
      const res = await fetch("/api/notifications?limit=20", { headers });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
        setUnreadNotificationCount(data.unreadCount || 0);
      }
    } catch {
      // silent
    }
  }, [userId, setNotifications, setUnreadNotificationCount]);

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000); // Every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Also refetch when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers["Authorization"] = `Bearer ${userId}`;
      await fetch("/api/notifications", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ notificationId }),
      });
      // Update local state
      setNotifications(notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadNotificationCount(Math.max(0, unreadCount - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers["Authorization"] = `Bearer ${userId}`;
      await fetch("/api/notifications", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      setUnreadNotificationCount(0);
    } catch {
      // silent
    }
  };

  const handleNotificationClick = async (notif: typeof notifications[0]) => {
    // Mark as read
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }

    // Handle navigation based on type
    if (notif.type === "course_shared") {
      try {
        const data: NotificationData = notif.data ? JSON.parse(notif.data) : {};
        if (data.courseId) {
          useAppStore.getState().setSelectedCourseId(data.courseId);
          useAppStore.getState().setView("viewer");
          setOpen(false);
        }
      } catch {
        // ignore parse errors
      }
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (lang === "fr") {
      if (diffMins < 1) return "À l'instant";
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      if (diffDays < 7) return `Il y a ${diffDays}j`;
      return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    }
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-10 h-10 rounded-2xl glass text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200 cursor-pointer"
        title={lang === "fr" ? "Notifications" : "Notifications"}
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-mauve text-white text-[10px] font-bold flex items-center justify-center px-1 animate-fade-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 z-50 glass rounded-2xl border border-border shadow-2xl animate-fade-in-slide-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-mauve-light" />
              <span className="text-sm font-extrabold text-foreground">
                {lang === "fr" ? "Notifications" : "Notifications"}
              </span>
              {unreadCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-mauve/15 text-mauve-light">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-mauve-light transition-colors cursor-pointer"
                title={lang === "fr" ? "Tout marquer comme lu" : "Mark all as read"}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === "fr" ? "Tout lire" : "Read all"}
                </span>
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
                <Bell className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm font-semibold">
                  {lang === "fr" ? "Aucune notification" : "No notifications"}
                </p>
                <p className="text-xs mt-1 opacity-60">
                  {lang === "fr"
                    ? "Quand quelqu'un te partagera un cours, tu le verras ici"
                    : "When someone shares a course with you, you'll see it here"}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                let notifData: NotificationData = {};
                try {
                  notifData = notif.data ? JSON.parse(notif.data) : {};
                } catch { /* ignore */ }

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer border-b border-border/50 last:border-0 ${
                      notif.isRead
                        ? "hover:bg-white/5"
                        : "bg-mauve/5 hover:bg-mauve/10"
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      notif.type === "course_shared"
                        ? "bg-gradient-to-br from-mauve/20 to-purple-500/20"
                        : "bg-mauve/10"
                    }`}>
                      {notif.type === "course_shared" ? (
                        <Share2 className="w-4 h-4 text-mauve-light" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-mauve-light" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {notif.type === "course_shared" && (
                          <span className="text-mauve-light">{notif.title}</span>
                        )}
                        {notif.type === "course_shared" && (
                          lang === "fr"
                            ? " t'a partagé un cours"
                            : " shared a course with you"
                        )}
                        {notif.type !== "course_shared" && notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground font-semibold truncate mt-0.5">
                        {notif.type === "course_shared"
                          ? (notif.message || notifData.courseTitle || "")
                          : notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 font-semibold mt-1">
                        {formatTimeAgo(notif.createdAt)}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notif.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        className="flex-shrink-0 mt-0.5 p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        title={lang === "fr" ? "Marquer comme lu" : "Mark as read"}
                      >
                        <div className="w-2 h-2 rounded-full bg-mauve" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
