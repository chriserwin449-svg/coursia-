"use client";

import { useMemo } from "react";

const CONFETTI_COLORS = [
  "#7c5cbf", "#9b7fd4", "#d4a843", "#e8c46a",
  "#ef4444", "#f87171", "#22c55e", "#3b82f6",
  "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4",
];

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

function generatePieces(): ConfettiPiece[] {
  return Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));
}

export default function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(() => (active ? generatePieces() : []), [active]);

  if (!active || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={`${piece.id}-${piece.left}`}
          className="absolute"
          style={{
            left: `${piece.left}%`,
            top: "-20px",
            width: `${piece.size}px`,
            height: `${piece.size * 0.6}px`,
            backgroundColor: piece.color,
            borderRadius: piece.id % 3 === 0 ? "50%" : "2px",
            transform: `rotate(${piece.rotation}deg)`,
            animation: `confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
