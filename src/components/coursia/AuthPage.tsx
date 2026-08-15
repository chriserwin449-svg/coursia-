"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
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

const GOOGLE_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // Validation helpers
  const isValid = code.length >= 4 && code === confirmCode;

  // ── Google OAuth via NextAuth (direct redirect, no intermediate page) ──
  const handleGoogleSignIn = useCallback(() => {
    setGoogleLoading(true);
    setError("");
    signIn("google", {
      callbackUrl: `${window.location.origin}/?googleAuth=1`,
      redirect: true,
    });
  }, []);

  // Handle redirect back from Google OAuth — get session then create/link user
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("googleAuth") === "1") {
      const doGoogleCallback = async () => {
        try {
          const sessionRes = await fetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          if (sessionData.session?.user) {
            const gUser = sessionData.session.user;
            const nameParts = (gUser.name || "").split(" ");
            const cbRes = await fetch("/api/auth/google/callback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: gUser.email,
                name: gUser.name,
                given_name: gUser.firstName || nameParts[0],
                family_name: gUser.lastName || nameParts.slice(1).join(" "),
                picture: gUser.image,
              }),
            });
            const cbData = await cbRes.json();
            if (cbRes.ok && cbData.user) {
              setUser(cbData.user);
              if (cbData.token) setAuthToken(cbData.token);
              if (typeof window !== "undefined") {
                localStorage.setItem("coursia-user-data", JSON.stringify(cbData.user));
              }
              setView("create");
              trackEvent({ name: cbData.isNewUser ? "signup_google" : "login_google" });
              window.history.replaceState({}, "", "/");
            } else {
              setError(cbData.error || (lang === "fr" ? "Erreur Google Auth" : "Google Auth error"));
            }
          }
        } catch {
          setError(lang === "fr" ? "Erreur Google Auth" : "Google Auth error");
        }
      };
      doGoogleCallback();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isLogin) {
        if (code.length < 4) { setError(tx.auth.codeMin4Error); return; }
        if (code !== confirmCode) { setError(tx.auth.codesMismatchError); return; }
      }

      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin ? { email, password: code } : { email, password: code, firstName, lastName };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "user_not_found") { setError("user_not_found"); }
        else if (data.error === "wrong_password") { setError(tx.auth.wrongCode); }
        else if (data.error === "email_not_confirmed") { setError(tx.auth.checkEmailConfirm); }
        else {
          const debugInfo = data.debug ? `\n\n[${data.debug}]` : "";
          setError(data.error + debugInfo || tx.common.error);
          if (data.debug) console.error("[AuthPage] Server debug:", data.debug);
        }
        return;
      }

      setUser(data.user);
      if (data.token) setAuthToken(data.token);

      if (typeof window !== "undefined" && data.user) {
        localStorage.setItem("coursia-user-data", JSON.stringify(data.user));
      }

      const pendingInvite = typeof window !== "undefined" ? localStorage.getItem("coursia-pending-invite") : null;
      if (pendingInvite && data.user) {
        try {
          const inviteRes = await fetch(`/api/invite/${pendingInvite}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${data.user.id}` },
          });
          const inviteData = await inviteRes.json();
          if (inviteRes.ok && inviteData.courseId) {
            localStorage.removeItem("coursia-pending-invite");
            setSelectedCourseId(inviteData.courseId);
            setView("viewer");
            trackEvent({ name: isLogin ? "login" : "signup" });
            return;
          }
        } catch { /* fall through */ }
      }

      setView("create");
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
      {/* Language toggle */}
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
            backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
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
                  <p className="text-sm font-bold text-mauve-light mb-2">{tx.auth.noAccountFound}</p>
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
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>{tx.common.loading}</span></>
                ) : (
                  <>
                    {isLogin ? (
                      <><Sparkles className="w-5 h-5" /><span>{tx.auth.signIn}</span></>
                    ) : (
                      <><Sparkles className="w-5 h-5" /><span>{tx.auth.createMyAccount}</span></>
                    )}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Google Sign-In Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-x-0 h-px bg-white/10" />
                <span className="relative bg-night px-4 text-[11px] font-bold text-white/60">
                  {lang === "fr" ? "ou continuer avec" : "or continue with"}
                </span>
              </div>

              {/* Google Button — White */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full bg-white text-neutral-800 font-semibold hover:bg-white/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-black/10"
              >
                {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-neutral-500" /> : GOOGLE_ICON}
                <span className="text-sm">{lang === "fr" ? "Continuer avec Google" : "Continue with Google"}</span>
              </button>

              {/* Legal notice — register only */}
              {!isLogin && (
                <p className="text-[11px] text-muted-foreground/50 text-center leading-relaxed mt-1">
                  {tx.auth.legalNotice}
                  <button
                    type="button"
                    onClick={() => { useAppStore.getState().setLegalPage("terms"); }}
                    className="text-muted-foreground/70 hover:text-mauve-light underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    {tx.auth.termsLink}
                  </button>
                  {tx.auth.legalAnd}
                  <button
                    type="button"
                    onClick={() => { useAppStore.getState().setLegalPage("privacy"); }}
                    className="text-muted-foreground/70 hover:text-mauve-light underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    {tx.auth.privacyLink}
                  </button>
                  {tx.auth.legalSuffix}
                </p>
              )}
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
