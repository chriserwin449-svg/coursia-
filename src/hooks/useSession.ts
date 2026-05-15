"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export function useSession() {
  const setUser = useAppStore((s) => s.setUser);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.user?.name) {
            setUser(data.user.name, data.user.id, data.user.email);
          }
        }
      } catch {}
    };
    check();
    return () => { cancelled = true; };
  }, [isAuthenticated, setUser]);

  return useAppStore((s) => ({
    user: s.userName ? { id: s.userId, name: s.userName, email: s.userEmail } : null,
    isAuthenticated: s.isAuthenticated,
    logout: s.logout,
  }));
}
