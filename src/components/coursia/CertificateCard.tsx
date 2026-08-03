"use client";

import {
  Trophy,
  Layers,
  Calendar,
  Award,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

export interface CertificateData {
  id: string;
  courseTitle: string;
  certificateId: string;
  score: number;
  totalLevels: number;
  issuedAt: string;
}

interface CertificateCardProps {
  certificate: CertificateData;
  onClick: () => void;
}

export default function CertificateCard({
  certificate,
  onClick,
}: CertificateCardProps) {
  const lang = useAppStore((s) => s.lang);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(
        lang === "fr" ? "fr-FR" : "en-US",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return dateStr;
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-[2px] cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10"
      style={{
        background:
          "linear-gradient(135deg, #a855f7, #ec4899, #a855f7)",
      }}
    >
      {/* Inner card */}
      <div className="rounded-[14px] bg-[#12132a] p-5 relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-full" />

        {/* Top row: badge + cert ID */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/20">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                <Award className="w-3 h-3" />
                {lang === "fr" ? "Certificat" : "Certificate"}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#9b9bb0]/60">
            {certificate.certificateId}
          </span>
        </div>

        {/* Course title */}
        <h3 className="font-bold text-sm text-[#f0eef6] mb-4 leading-snug line-clamp-2 group-hover:text-purple-200 transition-colors">
          {certificate.courseTitle}
        </h3>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          {/* Score */}
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-bold text-gold">
              {certificate.score}%
            </span>
          </div>

          {/* Levels */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-[#9b9bb0]">
              {lang === "fr"
                ? `${certificate.totalLevels} niveaux`
                : `${certificate.totalLevels} levels`}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#9b9bb0]/60" />
            <span className="text-xs text-[#9b9bb0]">
              {formatDate(certificate.issuedAt)}
            </span>
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </div>
      </div>
    </button>
  );
}
