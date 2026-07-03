"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

interface FeedbackType {
  id: string;
  label: string;
  labelEn: string;
  icon: React.ReactNode;
  color: string;
}

const FEEDBACK_TYPES: FeedbackType[] = [
  { id: "bug_report", label: "Bug", labelEn: "Bug", icon: <Bug className="w-4 h-4" />, color: "text-red-400 bg-red-400/10 border-red-400/30 hover:bg-red-400/20" },
  { id: "feature_request", label: "Idée", labelEn: "Idea", icon: <Lightbulb className="w-4 h-4" />, color: "text-amber-400 bg-amber-400/10 border-amber-400/30 hover:bg-amber-400/20" },
  { id: "question", label: "Question", labelEn: "Question", icon: <HelpCircle className="w-4 h-4" />, color: "text-sky-400 bg-sky-400/10 border-sky-400/30 hover:bg-sky-400/20" },
  { id: "general", label: "Général", labelEn: "General", icon: <MessageSquare className="w-4 h-4" />, color: "text-mauve-light bg-mauve/10 border-mauve/30 hover:bg-mauve/20" },
];

export default function FeedbackWidget() {
  const lang = useAppStore((s) => s.lang);
  const userId = useAppStore((s) => s.userId);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const view = useAppStore((s) => s.view);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowTypeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const selectedTypeInfo = FEEDBACK_TYPES.find((t) => t.id === selectedType) || FEEDBACK_TYPES[3];

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          subject: subject.trim(),
          message: message.trim(),
          email: email.trim() || undefined,
          page: view || undefined,
          userId: userId || undefined,
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
        setSubject("");
        setMessage("");
        setEmail("");
        setTimeout(() => {
          setIsSuccess(false);
          setIsOpen(false);
        }, 2500);
      }
    } catch {
      // silent
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubject("");
    setMessage("");
    setEmail("");
    setSelectedType("general");
    setIsSuccess(false);
    setShowTypeDropdown(false);
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          ref={triggerRef}
          onClick={() => { resetForm(); setIsOpen(true); }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-mauve text-white shadow-lg shadow-mauve/30 hover:shadow-mauve/50 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer group"
          aria-label={lang === "fr" ? "Ouvrir le feedback" : "Open feedback"}
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Feedback panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[380px] glass rounded-2xl border border-border shadow-2xl shadow-mauve/10 overflow-hidden animate-[fadeInSlideUp_0.3s_ease-out]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-mauve/15 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-mauve-light" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {lang === "fr" ? "Ton feedback" : "Your feedback"}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {lang === "fr" ? "On lit chaque message" : "We read every message"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Success state */}
          {isSuccess ? (
            <div className="p-8 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">
                {lang === "fr" ? "Merci pour ton feedback !" : "Thanks for your feedback!"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "fr" ? "On s'en occupe rapidement." : "We'll take care of it quickly."}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Type selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer ${selectedTypeInfo.color}`}
                >
                  <span className="flex items-center gap-2">
                    {selectedTypeInfo.icon}
                    {lang === "fr" ? selectedTypeInfo.label : selectedTypeInfo.labelEn}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showTypeDropdown ? "rotate-180" : ""}`} />
                </button>

                {showTypeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl border border-border/50 overflow-hidden z-10 animate-[fadeIn_0.15s_ease-out]">
                    {FEEDBACK_TYPES.map((ft) => (
                      <button
                        key={ft.id}
                        type="button"
                        onClick={() => { setSelectedType(ft.id); setShowTypeDropdown(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                          ft.id === selectedType
                            ? "bg-mauve/10 text-mauve-light"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        }`}
                      >
                        {ft.icon}
                        {lang === "fr" ? ft.label : ft.labelEn}
                        {ft.id === selectedType && (
                          <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-mauve-light" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject */}
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={lang === "fr" ? "Sujet de ton message..." : "Subject..."}
                maxLength={200}
                className="w-full px-3 py-2.5 rounded-xl bg-night border border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve/50 focus:ring-1 focus:ring-mauve/20 transition-all duration-200"
              />

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={lang === "fr" ? "Décris ton feedback en détail..." : "Describe your feedback in detail..."}
                rows={4}
                maxLength={5000}
                className="w-full px-3 py-2.5 rounded-xl bg-night border border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve/50 focus:ring-1 focus:ring-mauve/20 transition-all duration-200 resize-none"
              />

              {/* Email (optional, shown if not authenticated) */}
              {!isAuthenticated && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang === "fr" ? "Email (optionnel)" : "Email (optional)"}
                  className="w-full px-3 py-2.5 rounded-xl bg-night border border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve/50 focus:ring-1 focus:ring-mauve/20 transition-all duration-200"
                />
              )}

              {/* Submit button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!subject.trim() || !message.trim() || isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-mauve text-white text-sm font-bold hover:from-mauve-light hover:to-mauve transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isSubmitting
                  ? (lang === "fr" ? "Envoi en cours..." : "Sending...")
                  : (lang === "fr" ? "Envoyer le feedback" : "Send feedback")
                }
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}