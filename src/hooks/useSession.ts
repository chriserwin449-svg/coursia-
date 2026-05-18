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
        // Use /api/auth/me (existing route) instead of /api/auth/session (doesn't exist)
        const savedToken = typeof window !== "undefined"
          ? localStorage.getItem("coursia-auth-token")
          : null;
        if (!savedToken) return;

        const res = await fetch("/api/auth/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: savedToken }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.valid && savedToken) {
            // Restore user from token - the auth/me endpoint validates the token
            // User data is stored in localStorage from login
            const savedUser = localStorage.getItem("coursia-user-data");
            if (savedUser) {
              try {
                const userData = JSON.parse(savedUser);
                setUser(userData);
              } catch {
                // If user data is corrupted, clear token
                useAppStore.getState().setAuthToken(null);
              }
            }
          }
        }
      } catch {
        // Silently fail - user will need to log in again
      }
    };
    check();
    return () => { cancelled = true; };
  }, [isAuthenticated, setUser]);

  return useAppStore((s) => ({
    user: s.user,
    isAuthenticated: s.isAuthenticated,
    logout: s.logout,
  }));
}
