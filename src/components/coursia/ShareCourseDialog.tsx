"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Send,
  Loader2,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
// translations are inline (lang === 'fr')
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<SearchResult | null>(null);
  const [message, setMessage] = useState("");
  const [shareState, setShareState] = useState<ShareState>("searching");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsSearching(false);
    setSelectedFriend(null);
    setMessage("");
    setShareState("searching");
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

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
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          }
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
    [authToken]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const handleSelectFriend = (friend: SearchResult) => {
    setSelectedFriend(friend);
    setShareState("selected");
  };

  const handleBack = () => {
    setSelectedFriend(null);
    setMessage("");
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
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          sharedWith: selectedFriend.id,
          message: message.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShareState("sent");
        toast.success(
          lang === "fr"
            ? `Invitation envoyée à ${selectedFriend.firstName} !`
            : `Invitation sent to ${selectedFriend.firstName}!`
        );
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        toast.error(
          lang === "fr"
            ? "Impossible d'envoyer l'invitation. Réessaie."
            : "Could not send invitation. Please try again."
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
        className="sm:max-w-md bg-[#12132a] border border-[rgba(124,92,191,0.2)] text-[#f0eef6] p-0 overflow-hidden"
        onPointerDownOutside={(e) => {
          if (shareState === "sending") e.preventDefault();
        }}
      >
        {/* ── Header ── */}
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-purple-400" />
            </div>
            {lang === "fr" ? "Inviter un ami" : "Invite a Friend"}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#9b9bb0]">
            {shareState === "searching" &&
              (lang === "fr"
                ? "Cherche un utilisateur pour lui partager ce cours."
                : "Search for a user to share this course with.")}
            {shareState === "selected" &&
              (lang === "fr"
                ? `Envoyer "${courseTitle}" à ${selectedFriend.firstName} ?`
                : `Send "${courseTitle}" to ${selectedFriend.firstName}?`)}
            {shareState === "sending" &&
              (lang === "fr" ? "Envoi en cours..." : "Sending...")}
            {shareState === "sent" &&
              (lang === "fr" ? "Invitation envoyée !" : "Invitation sent!")}
          </DialogDescription>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="p-6 pt-4">
          {/* SEARCH STATE */}
          {shareState === "searching" && (
            <>
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9b9bb0]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder={
                    lang === "fr"
                      ? "Rechercher par nom ou email..."
                      : "Search by name or email..."
                  }
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-[rgba(124,92,191,0.1)] border border-[rgba(124,92,191,0.2)] text-[#f0eef6] placeholder:text-[#9b9bb0]/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-400" />
                )}
              </div>

              {/* Results */}
              <div className="mt-3 max-h-64 overflow-y-auto custom-scrollbar">
                {isSearching && results.length === 0 && query.length >= 2 && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                )}

                {!isSearching && query.length >= 2 && results.length === 0 && (
                  <div className="text-center py-8">
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
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150 hover:bg-[rgba(124,92,191,0.12)] cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                      {user.firstName.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-purple-300 transition-colors">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-[#9b9bb0] truncate">
                        {user.email}
                      </p>
                    </div>
                    {/* Arrow */}
                    <ArrowLeft className="w-4 h-4 text-[#9b9bb0]/40 rotate-180 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                  </button>
                ))}

                {!isSearching && query.length < 2 && (
                  <div className="text-center py-8">
                    <UserPlus className="w-10 h-10 text-[#9b9bb0]/20 mx-auto mb-3" />
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
            <div className="space-y-4">
              {/* Selected friend card */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-[rgba(124,92,191,0.1)] border border-[rgba(124,92,191,0.2)]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
                  {selectedFriend.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    {selectedFriend.firstName} {selectedFriend.lastName}
                  </p>
                  <p className="text-xs text-[#9b9bb0]">{selectedFriend.email}</p>
                </div>
              </div>

              {/* Confirmation */}
              <div className="flex items-center gap-2 text-sm text-[#9b9bb0]">
                <Send className="w-4 h-4 flex-shrink-0" />
                <span>
                  {lang === "fr"
                    ? `Envoyer "${courseTitle}" ?`
                    : `Send "${courseTitle}"?`}
                </span>
              </div>

              {/* Optional message */}
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  lang === "fr"
                    ? "Message optionnel (facultatif)..."
                    : "Optional message..."
                }
                className="min-h-[80px] resize-none rounded-xl bg-[rgba(124,92,191,0.1)] border border-[rgba(124,92,191,0.2)] text-[#f0eef6] placeholder:text-[#9b9bb0]/60 text-sm focus:ring-purple-500/40 focus:border-purple-500/40"
              />

              {/* Actions */}
              <div className="flex gap-3">
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
                  {lang === "fr" ? "Envoyer l'invitation" : "Send Invite"}
                </Button>
              </div>
            </div>
          )}

          {/* SENDING STATE */}
          {shareState === "sending" && selectedFriend && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
              <p className="text-sm text-[#9b9bb0]">
                {lang === "fr"
                  ? "Envoi de l'invitation..."
                  : "Sending invitation..."}
              </p>
            </div>
          )}

          {/* SENT STATE */}
          {shareState === "sent" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="font-bold text-emerald-400">
                {lang === "fr" ? "Invitation envoyée !" : "Invitation sent!"}
              </p>
              <p className="text-sm text-[#9b9bb0] text-center">
                {selectedFriend?.firstName}{" "}
                {lang === "fr"
                  ? "recevra une notification."
                  : "will receive a notification."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
