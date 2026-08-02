"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

export default function AuthPage() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const tx = t(lang);
  const setView = useAppStore((s) => s.setView);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthToken = useAppStore((s) => s.setAuthToken);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [showConfirmCode, setShowConfirmCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Validation helpers
  const isValid = code.length >= 4 && code === confirmCode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Frontend validation for registration
      if (!isLogin) {
        if (code.length < 4) {
          setError(tx.auth.codeMin4Error);
          return;
        }
        if (code !== confirmCode) {
          setError(tx.auth.codesMismatchError);
          return;
        }
      }

      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin
        ? { email, password: code }
        : { email, password: code, firstName, lastName };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "user_not_found") {
          setError("user_not_found");
        } else if (data.error === "wrong_password") {
          setError(tx.auth.wrongCode);
        } else if (data.error === "email_not_confirmed") {
          setError(tx.auth.checkEmailConfirm);
        } else {
          const debugInfo = data.debug ? `\n\n[${data.debug}]` : "";
          setError(data.error + debugInfo || tx.common.error);
          if (data.debug) {
            console.error("[AuthPage] Server debug:", data.debug);
          }
        }
        return;
      }

      // Save auth data
      setUser(data.user);
      if (data.token) {
        setAuthToken(data.token);
      }

      // Persist user data for session restoration
      if (typeof window !== "undefined" && data.user) {
        localStorage.setItem("coursia-user-data", JSON.stringify(data.user));
      }

      // ── Handle pending invite: redirect to shared course after auth ──
      const pendingInvite = typeof window !== "undefined"
        ? localStorage.getItem("coursia-pending-invite")
        : null;

      if (pendingInvite && data.user) {
        try {
          // Accept the invite (creates CourseShare) and get the courseId
          const inviteRes = await fetch(`/api/invite/${pendingInvite}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${data.user.id}` },
          });
          const inviteData = await inviteRes.json();

          if (inviteRes.ok && inviteData.courseId) {
            // Clear pending invite
            localStorage.removeItem("coursia-pending-invite");
            // Navigate directly to the shared course
            setSelectedCourseId(inviteData.courseId);
            setView("viewer");
            // Track conversion
            trackEvent({ name: isLogin ? "login" : "signup" });
            return;
          }
        } catch {
          // If invite fails, fall through to normal navigation
        }
      }

      // Default navigation: go to create page
      setView("create");

      // Track conversion event
      trackEvent({ name: isLogin ? "login" : "signup" });
    } catch {
      setError(tx.auth.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setConfirmCode("");
  };

  return (
    <div className="min-h-screen bg-night flex flex-col">
      {/* Language toggle - top right */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          title={lang === "fr" ? "Switch to English" : "Passer en Français"}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer text-sm font-bold"
        >
          <span>{lang === "fr" ? "EN" : "FR"}</span>
        </button>
      </div>

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-mauve/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gold/5 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center glow-mauve mb-4 rounded-2xl">
              <CoursiaLogo size={64} className="rounded-2xl" />
            </div>
            <h1 className="text-3xl font-extrabold mb-2">
              <span className="gradient-text">{tx.app.name}</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {isLogin ? tx.auth.signInToContinue : tx.auth.createToGetStarted}
            </p>
          </div>

          {/* Form Card */}
          <div className="glass rounded-3xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name fields (register only) */}
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {tx.auth.firstName}
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={tx.auth.firstNamePlaceholder}
                        required
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {tx.auth.lastName}
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={tx.auth.lastNamePlaceholder}
                        required
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tx.auth.emailPlaceholder}
                    required
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  {tx.auth.accessCode}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={tx.auth.accessCodePlaceholder}
                    required
                    minLength={4}
                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (register only) */}
              {!isLogin && (
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    {tx.auth.confirmCode}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                      type={showConfirmCode ? "text" : "password"}
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      placeholder={tx.auth.confirmCodePlaceholder}
                      required
                      minLength={4}
                      className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmCode(!showConfirmCode)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showConfirmCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && error === "user_not_found" && (
                <div className="p-4 rounded-2xl bg-mauve/10 border border-mauve/20 animate-fade-in">
                  <p className="text-sm font-bold text-mauve-light mb-2">
                    {tx.auth.noAccountFound}
                  </p>
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mauve/20 text-mauve-light text-sm font-bold hover:bg-mauve/30 transition-all duration-200 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {tx.auth.createAccount}
                  </button>
                </div>
              )}
              {error && error !== "user_not_found" && (
                <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-fade-in whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {/* Email confirmation notice */}
              {error && error.includes("email") && lang === "en" && (
                <div className="p-3.5 rounded-2xl bg-mauve/10 border border-mauve/20 text-mauve-light text-sm font-semibold animate-fade-in">
                  {tx.auth.confirmationEmail}
                </div>
              )}
              {error && error.includes("Vérifie") && (
                <div className="p-3.5 rounded-2xl bg-mauve/10 border border-mauve/20 text-mauve-light text-sm font-semibold animate-fade-in">
                  {tx.auth.confirmationEmail}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || (!isLogin && !isValid)}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-mauve/25 hover:shadow-mauve/40 hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{tx.common.loading}</span>
                  </>
                ) : (
                  <>
                    {isLogin ? (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>{tx.auth.signIn}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>{tx.auth.createMyAccount}</span>
                      </>
                    )}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle login/register */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? tx.auth.noAccountYet : tx.auth.alreadyHaveAccount}
                {" "}
                <button
                  onClick={toggleMode}
                  className="text-mauve-light font-bold hover:text-foreground transition-colors cursor-pointer"
                >
                  {isLogin ? tx.auth.signUp : tx.auth.signIn}
                </button>
              </p>
            </div>
          </div>

          {/* Back to home */}
          <div className="text-center mt-6">
            <button
              onClick={() => setView("landing")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <span className="mr-1">←</span>
              {tx.auth.backToHome}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-muted-foreground/10 py-6 px-4 text-center">
        <p className="text-xs text-muted-foreground/50">{tx.app.footer}</p>
      </footer>
    </div>
  );
}
