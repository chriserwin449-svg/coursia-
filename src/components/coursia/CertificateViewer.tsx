"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";

export interface CertificateViewerData {
  id: string;
  courseTitle: string;
  certificateId: string;
  score: number;
  totalLevels: number;
  issuedAt: string;
  userName: string;
}

interface CertificateViewerProps {
  certificate: CertificateViewerData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CertificateViewer({
  certificate,
  open,
  onOpenChange,
}: CertificateViewerProps) {
  const lang = useAppStore((s) => s.lang);
  const [copied, setCopied] = useState(false);

  if (!certificate) return null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(
        lang === "fr" ? "fr-FR" : "en-US",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      );
    } catch {
      return dateStr;
    }
  };

  const verificationUrl = `coursia.app/cert/${certificate.certificateId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${verificationUrl}`);
      setCopied(true);
      toast.success(
        lang === "fr" ? "Lien copié !" : "Link copied!"
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(
        lang === "fr"
          ? "Impossible de copier le lien."
          : "Could not copy link."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/70 backdrop-blur-sm" />
      <DialogContent
        className="sm:max-w-3xl w-[calc(100%-2rem)] max-h-[95vh] overflow-y-auto p-0 bg-transparent border-none shadow-none focus:outline-none [&>button]:hidden"
        showCloseButton={false}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap');
        `}</style>

        {/* ── Share Button (absolute overlay) ── */}
        <div className="flex justify-end mb-3 px-1">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white/80 text-sm font-semibold hover:bg-white/20 transition-all cursor-pointer border border-white/10"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">
                  {lang === "fr" ? "Copié" : "Copied"}
                </span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>{lang === "fr" ? "Partager" : "Share"}</span>
              </>
            )}
          </button>
        </div>

        {/* ── Certificate Body ── */}
        <div className="bg-white rounded-2xl shadow-2xl relative overflow-hidden">
          {/* Decorative border frame */}
          <div className="absolute inset-3 rounded-xl border-2 pointer-events-none"
            style={{
              borderImage: "linear-gradient(135deg, #b8860b, #a855f7, #b8860b, #a855f7, #b8860b) 1",
            }}
          />
          <div className="absolute inset-4 rounded-lg border border-purple-200/50 pointer-events-none" />

          <div className="relative p-8 sm:p-12">
            {/* ── Top Section ── */}
            <div className="flex items-start justify-between mb-8 sm:mb-12">
              {/* Logo & tagline */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent">
                  Coursia
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-400 italic tracking-wide mt-0.5">
                  Apprendre. Comprendre. Maîtriser.
                </p>
              </div>

              {/* Ribbon badge */}
              <div className="flex-shrink-0">
                <div
                  className="relative px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    borderRadius: "8px 8px 8px 0",
                    boxShadow: "0 2px 8px rgba(124, 52, 237, 0.3)",
                  }}
                >
                  <span className="flex items-center gap-1">
                    <span className="text-sm">🎓</span>
                    {lang === "fr" ? "IA Certifiée" : "AI Certified"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Center Section ── */}
            <div className="text-center mb-8 sm:mb-10">
              {/* Intro text */}
              <p className="text-gray-400 text-xs sm:text-sm tracking-wide uppercase mb-4 sm:mb-6">
                {lang === "fr"
                  ? "Ce certificat est fièrement décerné à"
                  : "This certificate is proudly awarded to"}
              </p>

              {/* User name - elegant italic serif */}
              <h2
                className="text-3xl sm:text-5xl font-bold text-gray-800 mb-4 sm:mb-6 leading-tight"
                style={{
                  fontFamily:
                    "'Playfair Display', 'Georgia', 'Times New Roman', serif",
                  fontStyle: "italic",
                }}
              >
                {certificate.userName}
              </h2>

              {/* Description */}
              <p className="text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4">
                {lang === "fr"
                  ? "pour avoir terminé avec succès le cours"
                  : "for successfully completing the course"}
              </p>

              {/* Course title */}
              <h3 className="text-lg sm:text-2xl font-extrabold text-purple-600 leading-snug">
                {certificate.courseTitle}
              </h3>
            </div>

            {/* ── Level Badge ── */}
            <div className="flex justify-center mb-8 sm:mb-10">
              <div
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-widest text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #b8860b, #daa520, #b8860b)",
                  boxShadow: "0 2px 12px rgba(184, 134, 11, 0.3)",
                }}
              >
                <span>★</span>
                {lang === "fr"
                  ? "Tous les niveaux complétés"
                  : "All levels completed"}
                <span>★</span>
              </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="flex items-center justify-center gap-4 sm:gap-8 mb-8 sm:mb-12 text-gray-500">
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">
                  {lang === "fr" ? "Date d'émission" : "Issue Date"}
                </p>
                <p className="text-xs sm:text-sm font-semibold text-gray-600">
                  {formatDate(certificate.issuedAt)}
                </p>
              </div>

              <div
                className="w-px h-8"
                style={{ background: "linear-gradient(to bottom, transparent, #d1d5db, transparent)" }}
              />

              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">
                  {lang === "fr" ? "ID du certificat" : "Certificate ID"}
                </p>
                <p className="text-xs sm:text-sm font-mono font-semibold text-gray-600">
                  {certificate.certificateId}
                </p>
              </div>

              <div
                className="w-px h-8"
                style={{ background: "linear-gradient(to bottom, transparent, #d1d5db, transparent)" }}
              />

              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">
                  {lang === "fr" ? "Score" : "Score"}
                </p>
                <p className="text-xs sm:text-sm font-semibold text-gray-600">
                  {certificate.score}%
                </p>
              </div>
            </div>

            {/* ── Bottom Section ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4">
              {/* QR placeholder */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50"
                >
                  <div className="grid grid-cols-5 gap-[2px] opacity-30">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-[6px] sm:w-[7px] h-[6px] sm:h-[7px] bg-gray-400 rounded-[1px]"
                        style={{
                          opacity:
                            i % 3 === 0 || i % 7 === 0 ? 1 : 0.3,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[9px] sm:text-[10px] text-gray-400 text-center leading-tight">
                  {lang === "fr"
                    ? "Scannez pour vérifier"
                    : "Scan to verify"}
                </p>
                <p className="text-[8px] sm:text-[9px] text-gray-300 font-mono">
                  {verificationUrl}
                </p>
              </div>

              {/* Circular seal */}
              <div className="flex flex-col items-center gap-2 order-first sm:order-none">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center relative"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #7c3aed, #b8860b, #7c3aed, #b8860b, #7c3aed)",
                    padding: "3px",
                  }}
                >
                  <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-[9px] sm:text-[10px] font-bold text-purple-700 uppercase tracking-wider leading-tight">
                      {lang === "fr" ? "IA" : "AI"}
                      <br />
                      {lang === "fr" ? "CERTIFIÉE" : "CERTIFIED"}
                    </span>
                    <div className="flex gap-[1px] mt-0.5">
                      <span className="text-[8px] text-gold-600">★</span>
                      <span className="text-[8px] text-gold-600">★</span>
                      <span className="text-[8px] text-gold-600">★</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-0.5">
                  <span className="text-[10px]">🏆</span>
                  <span className="text-[10px]">🎓</span>
                  <span className="text-[10px]">⭐</span>
                </div>
              </div>

              {/* Signature */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-center">
                  <p
                    className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent"
                    style={{
                      fontFamily:
                        "'Playfair Display', 'Georgia', serif",
                      fontStyle: "italic",
                    }}
                  >
                    Coursia AI
                  </p>
                  <div className="w-24 sm:w-32 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mt-1" />
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5">
                    {lang === "fr"
                      ? "Plateforme d'apprentissage IA"
                      : "AI Learning Platform"}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Decorative corner flourishes ── */}
            {/* Top-left */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-purple-300/40 rounded-tl-md" />
            {/* Top-right */}
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-purple-300/40 rounded-tr-md" />
            {/* Bottom-left */}
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-purple-300/40 rounded-bl-md" />
            {/* Bottom-right */}
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-purple-300/40 rounded-br-md" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
