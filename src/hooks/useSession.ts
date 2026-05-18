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
        const savedToken = typeof window !== "undefined"
          ? localStorage.getItem("coursia-auth-token")
          : null;
        if (!savedToken) return;

        // Read userId from saved user data
        let userId: string | null = null;
        const savedUser = localStorage.getItem("coursia-user-data");
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            userId = userData?.id || null;
          } catch {
            // corrupted user data
          }
        }

        const res = await fetch("/api/auth/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: savedToken, userId }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.valid && data?.user) {
            // Restore session from validated server response
            setUser(data.user);
            // Persist validated user data
            if (typeof window !== "undefined") {
              localStorage.setItem("coursia-user-data", JSON.stringify(data.user));
            }
          } else if (!data?.valid) {
            // Token invalid — clear stale session
            useAppStore.getState().setAuthToken(null);
            if (typeof window !== "undefined") {
              localStorage.removeItem("coursia-user-data");
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
