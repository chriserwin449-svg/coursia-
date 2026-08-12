"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Share2, Award, Flame, CreditCard, AlertTriangle, Trophy, CheckCheck, Trash2 } from "lucide-react";
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
  course_shared: <Share2 className="w-4 h-4 text-mauve-light" />,
  certificate_earned: <Trophy className="w-4 h-4 text-gold" />,
  badge_earned: <Award className="w-4 h-4 text-gold" />,
  flame_tier_up: <Flame className="w-4 h-4 text-orange-400" />,
  flame_points_earned: <Flame className="w-4 h-4 text-orange-400" />,
  payment_success: <CreditCard className="w-4 h-4 text-green-400" />,
  subscription_expired: <AlertTriangle className="w-4 h-4 text-destructive" />,
  subscription_expiring: <AlertTriangle className="w-4 h-4 text-gold" />,
  subscription_canceled: <AlertTriangle className="w-4 h-4 text-destructive" />,
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
      const res = await fetch("/api/notifications?limit=30", { headers });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
        setUnreadNotificationCount(data.unreadCount || 0);
      }
    } catch {
      // silent
    }
  }, [userId, setNotifications, setUnreadNotificationCount]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

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

  const deleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    if (!userId) return;
    try {
      const headers: Record<string, string> = {};
      headers["Authorization"] = `Bearer ${userId}`;
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: "DELETE",
        headers,
      });
      const wasUnread = notifications.find((n) => n.id === notificationId)?.isRead === false;
      setNotifications(notifications.filter((n) => n.id !== notificationId));
      if (wasUnread) {
        setUnreadNotificationCount(Math.max(0, unreadCount - 1));
      }
    } catch {
      // silent
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

  const handleNotificationClick = async (notif: typeof notifications[0]) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }

    if (notif.type === "course_shared") {
      try {
        const data: NotificationData = notif.data ? JSON.parse(notif.data) : {};
        if (data.courseId) {
          useAppStore.getState().setSelectedCourseId(data.courseId);
          useAppStore.getState().setView("viewer");
          setOpen(false);
        }
      } catch { /* ignore */ }
    } else if (notif.type === "flame_tier_up" || notif.type === "badge_earned" || notif.type === "flame_points_earned") {
      useAppStore.getState().setView("journey");
      setOpen(false);
    } else if (notif.type === "payment_success" || notif.type === "subscription_expired" || notif.type === "subscription_canceled") {
      useAppStore.getState().setView("offers");
      setOpen(false);
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

  const getNotificationLabel = (notif: typeof notifications[0]) => {
    if (notif.type === "course_shared") {
      return <><span className="text-mauve-light">{notif.title}</span> {lang === "fr" ? "t'a partagé un cours" : "shared a course with you"}</>;
    }
    if (notif.type === "flame_tier_up") {
      return <>{lang === "fr" ? "Nouveau palier de flammes !" : "New flame tier!"}</>;
    }
    if (notif.type === "flame_points_earned") {
      return <>{lang === "fr" ? "Points de flamme gagnés !" : "Flame points earned!"}</>;
    }
    if (notif.type === "badge_earned") {
      return <>{lang === "fr" ? "Nouveau badge débloqué !" : "New badge unlocked!"}</>;
    }
    if (notif.type === "certificate_earned") {
      return <>{lang === "fr" ? "Certificat obtenu !" : "Certificate earned!"}</>;
    }
    if (notif.type === "payment_success") {
      return <>{lang === "fr" ? "Abonnement activé" : "Subscription activated"}</>;
    }
    if (notif.type === "subscription_expired") {
      return <>{lang === "fr" ? "Abonnement expiré" : "Subscription expired"}</>;
    }
    if (notif.type === "subscription_canceled") {
      return <>{lang === "fr" ? "Abonnement annulé" : "Subscription canceled"}</>;
    }
    return <>{notif.title}</>;
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

      {/* Dropdown panel — mobile-friendly, compact */}
      {open && (
        <div className="absolute right-0 sm:right-0 top-12 z-50 w-[calc(100vw-3rem)] sm:w-80 max-w-sm rounded-2xl glass border border-border shadow-2xl animate-fade-in-slide-up overflow-hidden max-h-[70vh] sm:max-h-[28rem]">
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
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-mauve-light transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-white/5"
                  title={lang === "fr" ? "Tout marquer comme lu" : "Mark all as read"}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {lang === "fr" ? "Tout lire" : "Read all"}
                  </span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-destructive/5"
                  title={lang === "fr" ? "Tout supprimer" : "Clear all"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[60vh] sm:max-h-72 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
                <Bell className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm font-semibold">
                  {lang === "fr" ? "Aucune notification" : "No notifications"}
                </p>
                <p className="text-xs mt-1 opacity-60">
                  {lang === "fr"
                    ? "Tes accomplissements apparaîtront ici"
                    : "Your achievements will appear here"}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer border-b border-border/50 last:border-0 group ${
                    notif.isRead
                      ? "hover:bg-white/5"
                      : "bg-mauve/5 hover:bg-mauve/10"
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    NOTIF_BG[notif.type] || "bg-mauve/10"
                  }`}>
                    {NOTIF_ICONS[notif.type] || <Bell className="w-4 h-4 text-mauve-light" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {getNotificationLabel(notif)}
                    </p>
                    {notif.message && (
                      <p className="text-xs text-muted-foreground font-semibold truncate mt-0.5">
                        {notif.message}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 font-semibold mt-1">
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
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        title={lang === "fr" ? "Marquer comme lu" : "Mark as read"}
                      >
                        <div className="w-2 h-2 rounded-full bg-mauve" />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteNotification(e, notif.id)}
                      className="p-1 rounded-lg hover:bg-destructive/20 text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title={lang === "fr" ? "Supprimer" : "Delete"}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
