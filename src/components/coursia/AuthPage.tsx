"use client";

import { useState, useMemo } from "react";
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
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import CoursiaLogo from "@/components/coursia/CoursiaLogo";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Faible", color: "bg-red-500" };
  if (score <= 2) return { score: 2, label: "Moyen", color: "bg-orange-500" };
  if (score <= 3) return { score: 3, label: "Bon", color: "bg-yellow-500" };
  if (score <= 4) return { score: 4, label: "Fort", color: "bg-emerald-400" };
  return { score: 5, label: "Excellent", color: "bg-emerald-500" };
}

export default function AuthPage() {
  const lang = useAppStore((s) => s.lang);
  const tx = t(lang);
  const setView = useAppStore((s) => s.setView);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthToken = useAppStore((s) => s.setAuthToken);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isFr = lang === "fr";
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin
        ? { email, password }
        : { email, password, firstName, lastName };

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
          setError(isFr ? "Mot de passe incorrect" : "Wrong password");
        } else if (data.error === "email_not_confirmed") {
          setError(isFr ? "Vérifie ton email pour confirmer ton compte" : "Check your email to confirm your account");
        } else {
          // Show error + debug info if available
          const debugInfo = data.debug ? `\n\n[${data.debug}]` : "";
          setError(data.error + debugInfo || (isFr ? "Une erreur est survenue" : "An error occurred"));
          // Log debug info to console for developer
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

      // Navigate to create page
      setView("create");

      // Track conversion event
      trackEvent({ name: isLogin ? "login" : "signup" });
    } catch {
      setError(isFr ? "Erreur de connexion" : "Connection error");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
  };

  return (
    <div className="min-h-screen bg-night flex flex-col">
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
              {isLogin
                ? (isFr ? "Connecte-toi pour continuer" : "Sign in to continue")
                : (isFr ? "Crée ton compte pour commencer" : "Create your account to get started")
              }
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
                      {isFr ? "Prénom" : "First Name"}
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={isFr ? "Marie" : "Jane"}
                        required
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {isFr ? "Nom" : "Last Name"}
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={isFr ? "Dupont" : "Doe"}
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
                    placeholder="exemple@email.com"
                    required
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  {isFr ? "Mot de passe" : "Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isFr ? "Au moins 6 caractères" : "At least 6 characters"}
                    required
                    minLength={6}
                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-night border border-border text-foreground font-semibold placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength indicator (register only) */}
                {!isLogin && password.length > 0 && (
                  <div className="mt-3 animate-fade-in">
                    <div className="flex gap-1.5 mb-1.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            level <= passwordStrength.score
                              ? passwordStrength.color
                              : "bg-muted-foreground/15"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-semibold transition-colors duration-300 ${
                        passwordStrength.score <= 1 ? "text-red-400" :
                        passwordStrength.score <= 2 ? "text-orange-400" :
                        passwordStrength.score <= 3 ? "text-yellow-400" :
                        "text-emerald-400"
                      }`}>
                        {isFr ? passwordStrength.label : (
                          passwordStrength.score <= 1 ? "Weak" :
                          passwordStrength.score <= 2 ? "Fair" :
                          passwordStrength.score <= 3 ? "Good" :
                          passwordStrength.score <= 4 ? "Strong" : "Excellent"
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        {passwordStrength.score >= 4 ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        ) : passwordStrength.score <= 1 && password.length > 0 ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && error === "user_not_found" && (
                <div className="p-4 rounded-2xl bg-mauve/10 border border-mauve/20 animate-fade-in">
                  <p className="text-sm font-bold text-mauve-light mb-2">
                    {isFr
                      ? "Aucun compte trouvé avec cette adresse email"
                      : "No account found with this email address"}
                  </p>
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mauve/20 text-mauve-light text-sm font-bold hover:bg-mauve/30 transition-all duration-200 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isFr ? "Créer un compte" : "Create an account"}
                  </button>
                </div>
              )}
              {error && error !== "user_not_found" && (
                <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-fade-in whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {/* Email confirmation notice */}
              {error && error.includes("Vérifie") && (
                <div className="p-3.5 rounded-2xl bg-mauve/10 border border-mauve/20 text-mauve-light text-sm font-semibold animate-fade-in">
                  {isFr
                    ? "Un email de confirmation a été envoyé. Vérifie ta boîte mail et clique sur le lien."
                    : "A confirmation email was sent. Check your inbox and click the link."
                  }
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-mauve/25 hover:shadow-mauve/40 hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isFr ? "Chargement..." : "Loading..."}</span>
                  </>
                ) : (
                  <>
                    {isLogin ? (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>{isFr ? "Se Connecter" : "Sign In"}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>{isFr ? "Créer mon Compte" : "Create Account"}</span>
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
                {isLogin
                  ? (isFr ? "Pas encore de compte ?" : "Don't have an account?")
                  : (isFr ? "Déjà un compte ?" : "Already have an account?")
                }
                {" "}
                <button
                  onClick={toggleMode}
                  className="text-mauve-light font-bold hover:text-foreground transition-colors cursor-pointer"
                >
                  {isLogin
                    ? (isFr ? "Créer un compte" : "Sign Up")
                    : (isFr ? "Se connecter" : "Sign In")
                  }
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
              {isFr ? "Retour à l'accueil" : "Back to home"}
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
