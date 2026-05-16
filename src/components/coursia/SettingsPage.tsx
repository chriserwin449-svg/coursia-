"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Trash2,
  Shield,
  Zap,
  Globe,
  Info,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

interface KeyStatus {
  hasKey: boolean;
  name?: string;
  keyPreview?: string;
}

interface ValidationResult {
  valid: boolean;
  provider?: string;
  error?: string;
}

export default function SettingsPage() {
  const lang = useAppStore((s) => s.lang);
  const isFr = lang === "fr";

  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchKeyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeyStatus(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchKeyStatus();
  }, [fetchKeyStatus]);

  const validateKey = async (key: string) => {
    if (!key.trim()) {
      setValidation(null);
      return;
    }
    setValidation({ valid: false }); // loading state
    try {
      const res = await fetch("/api/api-keys/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json();
      setValidation(data);
    } catch {
      setValidation({ valid: false, error: "Validation failed" });
    }
  };

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput.trim(), name: "user-key" }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSuccessMsg(isFr ? "Clé API sauvegardée avec succès !" : "API key saved successfully!");
      setKeyInput("");
      setValidation(null);
      fetchKeyStatus();
    } catch {
      setErrorMsg(isFr ? "Erreur lors de la sauvegarde" : "Error saving key");
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async () => {
    setDeleting(true);
    try {
      await fetch("/api/api-keys", { method: "DELETE" });
      setKeyStatus({ hasKey: false });
      setSuccessMsg(isFr ? "Clé API supprimée" : "API key removed");
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  const providerIcon = (provider: string) => {
    if (provider === "openai") return "🤖";
    if (provider === "google") return "🔮";
    return "⚡";
  };

  const providerLabel = (provider: string) => {
    if (provider === "openai") return "OpenAI GPT-4o";
    if (provider === "google") return "Google Gemini";
    return "AI";
  };

  const providerColor = (provider: string) => {
    if (provider === "openai") return "text-green-400";
    if (provider === "google") return "text-blue-400";
    return "text-mauve-light";
  };

  const providerBg = (provider: string) => {
    if (provider === "openai") return "bg-green-500/10 border-green-500/20";
    if (provider === "google") return "bg-blue-500/10 border-blue-500/20";
    return "bg-mauve/10 border-mauve/20";
  };

  const currentProvider = validation?.provider || (keyStatus?.hasKey ? "unknown" : null);

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-10 pt-20 pb-8 md:pt-24 md:pb-16 fade-in">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
          <span className="gradient-text">{isFr ? "Paramètres" : "Settings"}</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          {isFr
            ? "Configure ta clé API pour améliorer la génération de cours."
            : "Configure your API key to improve course generation."}
        </p>
      </div>

      {/* ── Current Provider Status ── */}
      <div className="glass rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-mauve/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-mauve-light" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {isFr ? "Fournisseur IA actuel" : "Current AI Provider"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isFr ? "Utilisé pour générer les cours" : "Used to generate courses"}
            </p>
          </div>
        </div>

        {keyStatus?.hasKey ? (
          <div className={`p-4 rounded-2xl border ${providerBg(currentProvider || "unknown")}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{providerIcon(currentProvider || "unknown")}</span>
                <div>
                  <p className={`font-bold ${providerColor(currentProvider || "unknown")}`}>
                    {providerLabel(currentProvider || "unknown")}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono mt-0.5">
                    {keyStatus.keyPreview}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-emerald-400 font-bold">
                  {isFr ? "Actif" : "Active"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                {isFr ? "Clé sauvegardée en base de données" : "Key saved in database"}
              </p>
              <button
                onClick={deleteKey}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isFr ? "Supprimer" : "Remove"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-mauve/5 border border-mauve/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-bold text-mauve-light">
                  {isFr ? "Mode Gratuit (Coursia AI)" : "Free Tier (Coursia AI)"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isFr
                    ? "Ajoute ta clé API pour des cours de meilleure qualité (OpenAI ou Google)"
                    : "Add your API key for higher quality courses (OpenAI or Google)"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Add API Key ── */}
      <div className="glass rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {isFr ? "Ajouter une clé API" : "Add API Key"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isFr ? "OpenAI (sk-...) ou Google Gemini (AIza...)" : "OpenAI (sk-...) or Google Gemini (AIza...)"}
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="relative mb-4">
          <input
            type={showKey ? "text" : "password"}
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              if (validation) validateKey(e.target.value);
            }}
            onBlur={() => keyInput.trim() && validateKey(keyInput)}
            placeholder={isFr ? "sk-proj-... ou AIza..." : "sk-proj-... or AIza..."}
            className="w-full px-5 py-4 pr-12 rounded-2xl bg-night border border-border text-foreground font-mono text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all duration-300"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Validation result */}
        {validation && validation.valid && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-emerald-400">
              {validation.provider === "openai"
                ? (isFr ? "Clé OpenAI valide détectée — GPT-4o sera utilisé" : "Valid OpenAI key detected — GPT-4o will be used")
                : (isFr ? "Clé Google Gemini valide détectée" : "Valid Google Gemini key detected")}
            </span>
            <span className="ml-auto text-lg">{providerIcon(validation.provider || "")}</span>
          </div>
        )}

        {validation && !validation.valid && validation.error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4 animate-fade-in">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <span className="text-sm font-semibold text-destructive">
              {validation.error === "Unrecognized key format"
                ? (isFr ? "Format non reconnu. Utilise sk-... pour OpenAI ou AIza... pour Google" : "Unrecognized format. Use sk-... for OpenAI or AIza... for Google")
                : validation.error}
            </span>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={saveKey}
          disabled={!keyInput.trim() || !validation?.valid || saving}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-mauve/25 hover:shadow-mauve/40 hover:scale-[1.01] active:scale-[0.99]"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{isFr ? "Sauvegarde..." : "Saving..."}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>{isFr ? "Sauvegarder la clé API" : "Save API Key"}</span>
            </>
          )}
        </button>

        {/* Success / Error messages */}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-4 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-emerald-400">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 mt-4 animate-fade-in">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <span className="text-sm font-semibold text-destructive">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OpenAI Card */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h4 className="font-bold text-foreground">OpenAI</h4>
              <p className="text-xs text-muted-foreground">GPT-4o</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {isFr
              ? "Cours ultra-détaillés avec des explications complexes et une grande précision."
              : "Ultra-detailed courses with complex explanations and high precision."}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Globe className="w-3.5 h-3.5" />
            <span>platform.openai.com</span>
          </div>
        </div>

        {/* Google Card */}
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🔮</span>
            <div>
              <h4 className="font-bold text-foreground">Google Gemini</h4>
              <p className="text-xs text-muted-foreground">Gemini 2.0 Flash</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {isFr
              ? "Génération rapide et gratuite. Idéal pour un usage quotidien."
              : "Fast and free generation. Perfect for daily use."}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Globe className="w-3.5 h-3.5" />
            <span>aistudio.google.com</span>
          </div>
        </div>
      </div>

      {/* ── Security Note ── */}
      <div className="flex items-start gap-3 mt-6 p-4 rounded-2xl bg-night/50 border border-border/50">
        <Shield className="w-5 h-5 text-mauve-light flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-foreground mb-1">
            {isFr ? "Sécurité" : "Security"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isFr
              ? "Ta clé API est chiffrée et stockée localement dans la base de données. Elle n'est jamais partagée ni envoyée à des tiers."
              : "Your API key is encrypted and stored locally in the database. It is never shared or sent to third parties."}
          </p>
        </div>
      </div>
    </div>
  );
}
