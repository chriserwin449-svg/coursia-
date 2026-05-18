"use client";

import { useMemo } from "react";

const CONFETTI_COLORS = [
  "#7c5cbf", "#9b7fd4", "#d4a843", "#e8c46a",
  "#ef4444", "#f87171", "#22c55e", "#3b82f6",
  "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4",
  "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
];

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
  horizontalDrift: number;
}

function generatePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 30 + Math.random() * 40, // center-weighted
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    delay: Math.random() * 0.8,
    duration: 2.5 + Math.random() * 2,
    size: 5 + Math.random() * 10,
    rotation: Math.random() * 360,
    horizontalDrift: (Math.random() - 0.5) * 200,
  }));
}

export default function Confetti({ active, big = false }: { active: boolean; big?: boolean }) {
  const pieces = useMemo(() => (active ? generatePieces(big ? 120 : 80) : []), [active, big]);

  if (!active || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={`${piece.id}-${piece.left}-${piece.delay}`}
          className="absolute"
          style={{
            left: `${piece.left}%`,
            top: big ? "35%" : "-20px",
            width: `${piece.size}px`,
            height: `${piece.size * 0.6}px`,
            backgroundColor: piece.color,
            borderRadius: piece.id % 3 === 0 ? "50%" : piece.id % 3 === 1 ? "2px" : "0",
            transform: `rotate(${piece.rotation}deg)`,
            animation: big
              ? `confetti-explode ${piece.duration}s ease-out ${piece.delay}s forwards`
              : `confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
            "--drift": `${piece.horizontalDrift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
