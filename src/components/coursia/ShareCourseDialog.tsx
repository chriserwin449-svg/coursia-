"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Loader2,
  UserPlus,
  CheckCircle2,
  Users,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ShareCourseDialogProps {
  courseId: string;
  courseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username?: string | null;
  avatar?: string | null;
}

interface SharedUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  username?: string | null;
  avatar?: string | null;
  sharedAt: string;
}

type ShareState = "searching" | "selected" | "sending" | "sent";

export default function ShareCourseDialog({
  courseId,
  courseTitle,
  open,
  onOpenChange,
}: ShareCourseDialogProps) {
  const lang = useAppStore((s) => s.lang);
  const authToken = useAppStore((s) => s.authToken);

  // Invite friend state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<SearchResult | null>(null);
  const [shareState, setShareState] = useState<ShareState>("searching");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared with state
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsSearching(false);
    setSelectedFriend(null);
    setShareState("searching");
  }, []);

  useEffect(() => {
    if (open) {
      reset();
      // Fetch shared users list
      fetchSharedWith();
    }
  }, [open, reset]);

  const authHeaders = useCallback(
    () =>
      authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    [authToken]
  );

  // ── Fetch shared with list ──
  const fetchSharedWith = useCallback(async () => {
    setLoadingShared(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/shares`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSharedWith(data.sharedWith || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingShared(false);
    }
  }, [courseId, authHeaders]);

  // ── User search ──
  const searchUsers = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 2) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { headers: authHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          setResults((data.users || []).slice(0, 5));
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [authHeaders]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Search immediately if >= 2 chars, with a short debounce for typing
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => searchUsers(value), 200);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  };

  const handleSelectFriend = (friend: SearchResult) => {
    setSelectedFriend(friend);
    setShareState("selected");
  };

  const handleBack = () => {
    setSelectedFriend(null);
    setShareState("searching");
  };

  const handleSendInvite = async () => {
    if (!selectedFriend) return;
    setShareState("sending");
    try {
      const res = await fetch(`/api/courses/${courseId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          sharedWith: selectedFriend.id,
        }),
      });
      if (res.ok) {
        setShareState("sent");
        toast.success(
          lang === "fr"
            ? `Cours partagé avec ${selectedFriend.firstName} !`
            : `Course shared with ${selectedFriend.firstName}!`
        );
        // Refresh shared list
        fetchSharedWith();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data.error ||
            (lang === "fr"
              ? "Impossible d'envoyer l'invitation."
              : "Could not send invitation.")
        );
        setShareState("selected");
      }
    } catch {
      toast.error(
        lang === "fr"
          ? "Erreur réseau. Réessaie."
          : "Network error. Please try again."
      );
      setShareState("selected");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg bg-[#12132a] border border-[rgba(124,92,191,0.2)] text-[#f0eef6] p-0 overflow-hidden max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => {
          if (shareState === "sending") e.preventDefault();
        }}
      >
        {/* ── Header ── */}
        <DialogHeader className="p-5 pb-0 flex-shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-purple-400" />
            </div>
            {lang === "fr" ? "Partager le cours" : "Share this course"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-4 space-y-5">
          {/* ═══════════════════════════════════════
              SECTION 1: Invite a friend
              ═══════════════════════════════════════ */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              {lang === "fr" ? "Inviter un ami" : "Invite a Friend"}
            </h3>

            {/* SEARCH STATE */}
            {(shareState === "searching" || shareState === "sent") && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9b9bb0]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder={
                      lang === "fr"
                        ? "Rechercher par nom, email ou pseudo..."
                        : "Search by name, email or username..."
                    }
                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-[rgba(124,92,191,0.1)] border border-[rgba(124,92,191,0.2)] text-[#f0eef6] placeholder:text-[#9b9bb0]/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-400" />
                  )}
                </div>

                {/* Results */}
                <div className="mt-2 max-h-56 overflow-y-auto custom-scrollbar">
                  {isSearching && results.length === 0 && query.length >= 2 && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    </div>
                  )}

                  {!isSearching && query.length >= 2 && results.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-sm text-[#9b9bb0]">
                        {lang === "fr"
                          ? "Aucun utilisateur trouvé."
                          : "No users found."}
                      </p>
                    </div>
                  )}

                  {results.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectFriend(user)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150 hover:bg-[rgba(124,92,191,0.12)] cursor-pointer group"
                    >
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.firstName}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 border-purple-500/30"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                          {user.firstName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-purple-300 transition-colors">
                          {user.firstName} {user.lastName}
                          {user.username && (
                            <span className="text-[#9b9bb0] text-xs ml-1.5">
                              @{user.username}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#9b9bb0] truncate">
                          {user.email}
                        </p>
                      </div>
                    </button>
                  ))}

                  {!isSearching && query.length < 2 && (
                    <div className="text-center py-6">
                      <p className="text-sm text-[#9b9bb0]/60">
                        {lang === "fr"
                          ? "Tape au moins 2 caractères pour rechercher."
                          : "Type at least 2 characters to search."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* SELECTED FRIEND STATE */}
            {shareState === "selected" && selectedFriend && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[rgba(124,92,191,0.1)] border border-[rgba(124,92,191,0.2)]">
                  {selectedFriend.avatar ? (
                    <img
                      src={selectedFriend.avatar}
                      alt={selectedFriend.firstName}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-purple-500/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold">
                      {selectedFriend.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">
                      {selectedFriend.firstName} {selectedFriend.lastName}
                      {selectedFriend.username && (
                        <span className="text-[#9b9bb0] text-xs ml-1.5">
                          @{selectedFriend.username}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#9b9bb0]">
                      {selectedFriend.email}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="flex-1 rounded-xl border border-[rgba(124,92,191,0.2)] text-[#9b9bb0] hover:text-[#f0eef6] hover:bg-[rgba(124,92,191,0.1)] cursor-pointer"
                  >
                    {lang === "fr" ? "Retour" : "Back"}
                  </Button>
                  <Button
                    onClick={handleSendInvite}
                    disabled={shareState === "sending"}
                    className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold hover:from-purple-500 hover:to-pink-400 transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
                  >
                    {lang === "fr"
                      ? "Partager le cours"
                      : "Share Course"}
                  </Button>
                </div>
              </div>
            )}

            {/* SENDING STATE */}
            {shareState === "sending" && (
              <div className="flex items-center justify-center py-6 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span className="text-sm text-[#9b9bb0]">
                  {lang === "fr" ? "Envoi en cours..." : "Sending..."}
                </span>
              </div>
            )}

            {/* SENT STATE */}
            {shareState === "sent" && (
              <div className="flex items-center justify-center py-4 gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">
                  {lang === "fr" ? "Partage envoyé !" : "Share sent!"}
                </span>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════
              DIVIDER
              ═══════════════════════════════════════ */}
          <div className="border-t border-[rgba(124,92,191,0.15)]" />

          {/* ═══════════════════════════════════════
              SECTION 2: Shared with
              ═══════════════════════════════════════ */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              {lang === "fr" ? "Partagé avec" : "Shared with"}
            </h3>

            {loadingShared ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              </div>
            ) : sharedWith.length === 0 ? (
              <p className="text-sm text-[#9b9bb0]/60 italic">
                {lang === "fr"
                  ? "Ce cours n'a pas encore été partagé."
                  : "This course hasn't been shared yet."}
              </p>
            ) : (
              <div className="space-y-1.5">
                {sharedWith.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-[rgba(124,92,191,0.06)]"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.firstName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-purple-500/20"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/70 to-pink-500/70 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                        {user.firstName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {user.firstName} {user.lastName}
                      </p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400/60 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
