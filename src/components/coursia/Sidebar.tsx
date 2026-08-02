"use client";

import { useState, useMemo, useRef } from "react";
import { BookOpen, Library, Route, PanelLeftClose, PanelLeftOpen, Tag, LogOut, User, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { useAppStore, type AppView } from "@/lib/store";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

export default function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthToken = useAppStore((s) => s.setAuthToken);
  const hasNotification = useAppStore((s) => s.hasNotification);
  const expiryWarning48h = useAppStore((s) => s.expiryWarning48h);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show dot when there's a notification or 48h expiry warning and user is NOT on offers page
  const showDot = (hasNotification || expiryWarning48h) && view !== "offers";

  const NAV_ITEMS = useMemo(() => [
    { view: "create" as const, label: tx.nav.create, icon: BookOpen },
    { view: "library" as const, label: tx.nav.library, icon: Library },
    { view: "journey" as const, label: tx.nav.journey, icon: Route },
  ], [tx.nav]);

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    setUser(null);
    setAuthToken(null);
    setView("landing");
  };

  const handleOffersClick = () => {
    setView("offers");
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(lang === "fr" ? "Format non supporté. Utilise JPEG, PNG ou WebP." : "Unsupported format. Use JPEG, PNG or WebP.");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(lang === "fr" ? "Fichier trop volumineux. Max 2 Mo." : "File too large. Max 2MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Update user in store with new avatar
        setUser({ ...user, avatar: data.avatarUrl });
        toast.success(lang === "fr" ? "Photo de profil mise à jour !" : "Profile photo updated!");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || (lang === "fr" ? "Erreur lors du téléchargement." : "Upload failed."));
      }
    } catch {
      toast.error(lang === "fr" ? "Erreur réseau." : "Network error.");
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-full z-40 flex-col border-r border-border bg-night-light transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? "w-[72px]" : "w-[72px] md:w-64"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <CoursiaLogo size={40} className="flex-shrink-0" />
          {!collapsed && <span className="hidden md:block text-xl font-extrabold gradient-text whitespace-nowrap">
            {tx.app.name}
          </span>}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 md:px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-mauve/20 text-mauve-light glow-mauve"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-mauve-light" : ""}`}
                />
                {!collapsed && <span className="hidden md:block text-base font-semibold truncate">
                  {item.label}
                </span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-2 md:px-3 py-3 border-t border-border space-y-1">
          {/* User info — clickable avatar for photo upload */}
          {user && (
            <div
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-muted-foreground/70 cursor-pointer group"
              title={collapsed
                ? `${lang === "fr" ? "Changer la photo" : "Change photo"}: ${user.firstName}`
                : `${lang === "fr" ? "Cliquez pour changer la photo" : "Click to change photo"}`
              }
              onClick={handleAvatarClick}
            >
              <div className="relative flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.firstName}
                    className="w-8 h-8 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-mauve/15 flex items-center justify-center">
                    <User className="w-4 h-4 text-mauve-light" />
                  </div>
                )}
                {/* Camera overlay on hover */}
                <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
              </div>
              {!collapsed && (
                <div className="hidden md:block min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {user.firstName} {(user.lastName || "").charAt(0) || ""}.
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 truncate">{user.email}</p>
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={collapsed ? tx.nav.logout : undefined}
            className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-2xl text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="hidden md:block text-sm font-semibold truncate">
              {tx.nav.logout}
            </span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? (lang === "fr" ? "Ouvrir" : "Open") : (lang === "fr" ? "Réduire" : "Collapse")}
            className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-2xl text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-200 cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5 flex-shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5 flex-shrink-0" />
                <span className="hidden md:block text-sm font-semibold truncate">
                  {lang === "fr" ? "Réduire" : "Collapse"}
                </span>
              </>
            )}
          </button>

          {/* Offers link — with notification dot */}
          <button
            onClick={handleOffersClick}
            title={collapsed ? tx.nav.offers : undefined}
            className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-2xl transition-all duration-200 cursor-pointer relative ${
              view === "offers"
                ? "bg-gold/10 text-gold"
                : "text-muted-foreground/50 hover:bg-white/5 hover:text-muted-foreground"
            }`}
          >
            <Tag className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="hidden md:block text-sm font-semibold truncate">
              {tx.nav.offers}
            </span>}
            {/* Red blinking dot */}
            {showDot && (
              <span className="notification-dot absolute top-2 right-2 md:top-2.5 md:right-3 w-2.5 h-2.5 rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </aside>

      {/* ── Logout Confirmation Dialog ── */}
      {showLogoutDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-night/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowLogoutDialog(false)}
        >
          <div
            className="bg-night-light border border-border rounded-3xl w-full max-w-sm mx-4 p-8 animate-fade-in-slide-up text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-extrabold text-foreground mb-3">
              {tx.nav.logoutConfirm}
            </h3>
            <p className="text-sm text-muted-foreground mb-8">
              {lang === "fr"
                ? "Ta progression est sauvegardée. Tu pourras te reconnecter plus tard."
                : "Your progress is saved. You can log back in later."}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmLogout}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-destructive to-red-600 text-white font-bold text-sm hover:from-red-500 hover:to-red-700 transition-all duration-300 cursor-pointer shadow-lg shadow-destructive/20"
              >
                {tx.nav.logoutYes}
              </button>
              <button
                onClick={() => setShowLogoutDialog(false)}
                className="w-full py-3.5 rounded-full glass text-foreground font-bold text-sm hover:bg-white/10 transition-all duration-300 cursor-pointer"
              >
                {tx.nav.logoutNo}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
