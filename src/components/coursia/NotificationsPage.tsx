"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  Share2,
  Award,
  Flame,
  CreditCard,
  AlertTriangle,
  Trophy,
  CheckCheck,
  Trash2,
  Inbox,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

interface NotificationData {
  courseId?: string;
  shareId?: string;
  courseTitle?: string;
  sharedBy?: string;
  sharedByName?: string;
  certificateId?: string;
  badgeName?: string;
  completedCourses?: number;
  points?: number;
  tierId?: string;
  plan?: string;
  endDate?: string;
  reason?: string;
}

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  course_shared: <Share2 className="w-5 h-5 text-mauve-light" />,
  certificate_earned: <Trophy className="w-5 h-5 text-gold" />,
  badge_earned: <Award className="w-5 h-5 text-gold" />,
  flame_tier_up: <Flame className="w-5 h-5 text-orange-400" />,
  flame_points_earned: <Flame className="w-5 h-5 text-orange-400" />,
  payment_success: <CreditCard className="w-5 h-5 text-green-400" />,
  subscription_expired: <AlertTriangle className="w-5 h-5 text-destructive" />,
  subscription_expiring: <AlertTriangle className="w-5 h-5 text-gold" />,
  subscription_canceled: <AlertTriangle className="w-5 h-5 text-destructive" />,
};

const NOTIF_BG: Record<string, string> = {
  course_shared: "bg-gradient-to-br from-mauve/20 to-purple-500/20",
  certificate_earned: "bg-gradient-to-br from-gold/20 to-yellow-500/20",
  badge_earned: "bg-gradient-to-br from-gold/20 to-yellow-600/20",
  flame_tier_up: "bg-gradient-to-br from-orange-500/20 to-red-500/20",
  flame_points_earned: "bg-gradient-to-br from-orange-500/15 to-amber-500/15",
  payment_success: "bg-gradient-to-br from-green-500/20 to-emerald-500/20",
  subscription_expired: "bg-gradient-to-br from-red-500/20 to-destructive/20",
  subscription_expiring: "bg-gradient-to-br from-gold/20 to-orange-500/20",
  subscription_canceled: "bg-gradient-to-br from-red-500/20 to-destructive/20",
};

export default function NotificationsPage() {
  const lang = useAppStore((s) => s.lang);
  const userId = useAppStore((s) => s.userId);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const unreadCount = useAppStore((s) => s.unreadNotificationCount);
  const setUnreadNotificationCount = useAppStore((s) => s.setUnreadNotificationCount);
  const setView = useAppStore((s) => s.setView);

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const headers: Record<string, string> = {};
      headers["Authorization"] = `Bearer ${userId}`;
      const res = await fetch("/api/notifications?limit=100", { headers });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
        setUnreadNotificationCount(data.unreadCount || 0);

        // Auto-mark all as read when opening notifications page (clears badge)
        if (data.unreadCount > 0) {
          try {
            const patchHeaders: Record<string, string> = { "Content-Type": "application/json" };
            patchHeaders["Authorization"] = `Bearer ${userId}`;
            await fetch("/api/notifications", {
              method: "PATCH",
              headers: patchHeaders,
              body: JSON.stringify({ markAllRead: true }),
            });
            setNotifications((data.notifications || []).map((n: { id: string; type: string; title: string; message: string | null; data: string | null; isRead: boolean; createdAt: string }) => ({ ...n, isRead: true })));
            setUnreadNotificationCount(0);
          } catch { /* silent */ }
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId, setNotifications, setUnreadNotificationCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
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

  const deleteNotification = async (notificationId: string) => {
    setDeleting(notificationId);
    try {
      const headers: Record<string, string> = {};
      headers["Authorization"] = `Bearer ${userId}`;
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: "DELETE",
        headers,
      });
      const wasUnread =
        notifications.find((n) => n.id === notificationId)?.isRead === false;
      setNotifications(
        notifications.filter((n) => n.id !== notificationId)
      );
      if (wasUnread) {
        setUnreadNotificationCount(Math.max(0, unreadCount - 1));
      }
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  const clearAllNotifications = async () => {
    if (!userId) return;
    try {
      const headers: Record<string, string> = {};
      headers["Authorization"] = `Bearer ${userId}`;
      await fetch("/api/notifications?clearAll=true", {
        method: "DELETE",
        headers,
      });
      setNotifications([]);
      setUnreadNotificationCount(0);
    } catch {
      // silent
    }
  };

  const handleNotificationClick = async (notif: (typeof notifications)[0]) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }

    if (notif.type === "course_shared") {
      try {
        const data: NotificationData = notif.data
          ? JSON.parse(notif.data)
          : {};
        if (data.courseId) {
          useAppStore.getState().setSelectedCourseId(data.courseId);
          useAppStore.getState().setView("viewer");
          return;
        }
      } catch {
        /* ignore */
      }
    } else if (
      notif.type === "flame_tier_up" ||
      notif.type === "badge_earned" ||
      notif.type === "flame_points_earned"
    ) {
      useAppStore.getState().setView("journey");
      return;
    } else if (
      notif.type === "payment_success" ||
      notif.type === "subscription_expired" ||
      notif.type === "subscription_canceled"
    ) {
      useAppStore.getState().setView("offers");
      return;
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
      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getNotificationLabel = (notif: (typeof notifications)[0]) => {
    if (notif.type === "course_shared") {
      return (
        <>
          <span className="text-mauve-light">{notif.title}</span>{" "}
          {lang === "fr"
            ? "t'a partagé un cours"
            : "shared a course with you"}
        </>
      );
    }
    if (notif.type === "flame_tier_up") {
      return (
        <>
          {lang === "fr"
            ? "Nouveau palier de flammes !"
            : "New flame tier unlocked!"}
        </>
      );
    }
    if (notif.type === "flame_points_earned") {
      return (
        <>
          {lang === "fr"
            ? "Points de flamme gagnés !"
            : "Flame points earned!"}
        </>
      );
    }
    if (notif.type === "badge_earned") {
      return (
        <>
          {lang === "fr"
            ? "Nouveau badge débloqué !"
            : "New badge unlocked!"}
        </>
      );
    }
    if (notif.type === "certificate_earned") {
      return (
        <>
          {lang === "fr" ? "Certificat obtenu !" : "Certificate earned!"}
        </>
      );
    }
    if (notif.type === "payment_success") {
      return (
        <>{lang === "fr" ? "Abonnement activé" : "Subscription activated"}</>
      );
    }
    if (notif.type === "subscription_expired") {
      return (
        <>{lang === "fr" ? "Abonnement expiré" : "Subscription expired"}</>
      );
    }
    if (notif.type === "subscription_expiring") {
      return (
        <>
          {lang === "fr"
            ? "Abonnement expire bientôt"
            : "Subscription expiring soon"}
        </>
      );
    }
    if (notif.type === "subscription_canceled") {
      return (
        <>
          {lang === "fr"
            ? "Abonnement annulé"
            : "Subscription canceled"}
        </>
      );
    }
    return <>{notif.title}</>;
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-mauve" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-10 pt-14 sm:pt-20 pb-8 md:pt-24 md:pb-16">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-mauve/15 flex items-center justify-center">
            <Bell className="w-6 h-6 text-mauve-light" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">
              <span className="gradient-text">
                {lang === "fr" ? "Notifications" : "Notifications"}
              </span>
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground font-semibold">
                {unreadCount}{" "}
                {lang === "fr"
                  ? unreadCount === 1
                    ? "non lue"
                    : "non lues"
                  : unreadCount === 1
                    ? "unread"
                    : "unread"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
            filter === "all"
              ? "bg-mauve/20 text-mauve-light"
              : "glass text-muted-foreground hover:bg-white/5"
          }`}
        >
          <Inbox className="w-4 h-4" />
          {lang === "fr" ? "Toutes" : "All"}
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-white/10">
            {notifications.length}
          </span>
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
            filter === "unread"
              ? "bg-mauve/20 text-mauve-light"
              : "glass text-muted-foreground hover:bg-white/5"
          }`}
        >
          <Bell className="w-4 h-4" />
          {lang === "fr" ? "Non lues" : "Unread"}
          {unreadCount > 0 && (
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-mauve text-white">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="flex-1" />

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer glass text-muted-foreground hover:text-mauve-light hover:bg-white/5"
          >
            <CheckCheck className="w-4 h-4" />
            <span className="hidden sm:inline">
              {lang === "fr" ? "Tout marquer comme lu" : "Mark all as read"}
            </span>
          </button>
        )}
        {notifications.length > 0 && (
          <button
            onClick={clearAllNotifications}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer glass text-muted-foreground hover:text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">
              {lang === "fr" ? "Tout supprimer" : "Clear all"}
            </span>
          </button>
        )}
      </div>

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-16 sm:py-24">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-3xl bg-mauve/10 flex items-center justify-center mx-auto mb-6 sm:mb-8">
            <Bell className="w-8 h-8 sm:w-12 sm:h-12 text-mauve-light/50" />
          </div>
          <h3 className="text-xl sm:text-3xl font-extrabold mb-3">
            {filter === "unread"
              ? lang === "fr"
                ? "Aucune notification non lue"
                : "No unread notifications"
              : lang === "fr"
                ? "Aucune notification"
                : "No notifications"}
          </h3>
          <p className="text-base sm:text-lg font-semibold text-muted-foreground">
            {lang === "fr"
              ? filter === "unread"
                ? "Tu es à jour !"
                : "Tes accomplissements apparaîtront ici"
              : filter === "unread"
                ? "You're all caught up!"
                : "Your achievements will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`group flex items-start gap-4 p-4 sm:p-5 rounded-2xl glass transition-all duration-200 cursor-pointer border ${
                notif.isRead
                  ? "border-border/50 hover:border-border hover:bg-white/[0.03]"
                  : "border-mauve/20 hover:border-mauve/40 bg-mauve/[0.05] hover:bg-mauve/[0.08]"
              }`}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  NOTIF_BG[notif.type] || "bg-mauve/10"
                }`}
              >
                {NOTIF_ICONS[notif.type] || (
                  <Bell className="w-5 h-5 text-mauve-light" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm sm:text-base font-bold text-foreground">
                    {getNotificationLabel(notif)}
                  </p>
                  {!notif.isRead && (
                    <div className="w-2.5 h-2.5 rounded-full bg-mauve flex-shrink-0" />
                  )}
                </div>
                {notif.message && (
                  <p className="text-xs sm:text-sm text-muted-foreground font-semibold line-clamp-2">
                    {notif.message}
                  </p>
                )}
                <p className="text-[10px] sm:text-xs text-muted-foreground/50 font-semibold mt-1.5">
                  {formatTimeAgo(notif.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!notif.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notif.id);
                    }}
                    className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground/50 hover:text-mauve-light"
                    title={
                      lang === "fr" ? "Marquer comme lu" : "Mark as read"
                    }
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif.id);
                  }}
                  disabled={deleting === notif.id}
                  className="p-2 rounded-xl hover:bg-destructive/20 text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer"
                  title={lang === "fr" ? "Supprimer" : "Delete"}
                >
                  {deleting === notif.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
