"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Plus,
  X,
  Link as LinkIcon,
  Loader2,
  Shuffle,
  Wand2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { CourseData } from "@/lib/store";

export default function CreateCourse() {
  const [title, setTitle] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [randomTopic, setRandomTopic] = useState<string | null>(null);
  const [loadingRandom, setLoadingRandom] = useState(false);

  const setView = useAppStore((s) => s.setView);
  const setSelectedCourseId = useAppStore((s) => s.setSelectedCourseId);
  const setIsGenerating = useAppStore((s) => s.setIsGenerating);

  const addLink = () => {
    const trimmed = linkInput.trim();
    if (trimmed && !links.includes(trimmed)) {
      setLinks([...links, trimmed]);
      setLinkInput("");
    }
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const generateCourse = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    setIsGenerating(true);

    try {
      const res = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), sourceLinks: links }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");

      const course = data.course as CourseData;
      setSelectedCourseId(course.id);
      setView("viewer");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const generateRandom = async () => {
    setLoadingRandom(true);
    try {
      const res = await fetch("/api/courses/random", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRandomTopic(data.topic.title);
      setTitle(data.topic.title);
    } catch {
      setError("Impossible de générer un sujet aléatoire");
    } finally {
      setLoadingRandom(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-16">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
          <span className="gradient-text">Créer un Cours</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Donne un sujet et l&apos;IA va générer un cours complet pour toi.
        </p>
      </div>

      {/* Main card */}
      <div className="glass rounded-3xl p-6 md:p-8">
        {/* Title input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-muted-foreground">
            Titre du cours
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Apprendre Python, Histoire de France..."
            className="w-full px-5 py-4 rounded-2xl bg-night border border-border text-foreground text-lg font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all"
            onKeyDown={(e) => e.key === "Enter" && generateCourse()}
            disabled={loading}
          />
        </div>

        {/* Source links */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-muted-foreground">
            <LinkIcon className="w-4 h-4 inline mr-1" />
            Liens de référence (optionnel)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Colle un lien ici..."
              className="flex-1 px-5 py-3 rounded-2xl bg-night border border-border text-foreground font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-mauve focus:ring-2 focus:ring-mauve/20 transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addLink(); }
              }}
              disabled={loading}
            />
            <button
              onClick={addLink}
              disabled={!linkInput.trim() || loading}
              className="px-5 py-3 rounded-2xl bg-mauve/20 text-mauve-light font-semibold hover:bg-mauve/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {links.length > 0 && (
            <div className="mt-3 space-y-2">
              {links.map((link, i) => (
                <div key={link} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-night/50 border border-border text-sm">
                  <LinkIcon className="w-3.5 h-3.5 text-mauve-light flex-shrink-0" />
                  <span className="truncate flex-1 text-muted-foreground">{link}</span>
                  <button onClick={() => removeLink(i)} className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={generateCourse}
            disabled={!title.trim() || loading}
            className="flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white text-lg font-bold hover:from-mauve-light hover:to-mauve transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Génération en cours...</> : <><Sparkles className="w-5 h-5" /> Générer le Cours</>}
          </button>
          <button
            onClick={generateRandom}
            disabled={loading || loadingRandom}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gold/10 text-gold border border-gold/20 text-base font-bold hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loadingRandom ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Shuffle className="w-5 h-5" /> <span className="hidden sm:inline">Sujet Aléatoire</span><Wand2 className="w-5 h-5 sm:hidden" /></>}
          </button>
        </div>
      </div>

      {randomTopic && (
        <div className="mt-4 p-4 rounded-2xl glass text-center">
          <p className="text-sm text-muted-foreground mb-1">Sujet suggéré</p>
          <p className="text-lg font-bold gradient-text">{randomTopic}</p>
        </div>
      )}
    </div>
  );
}
