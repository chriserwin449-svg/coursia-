"use client";

import Image from "next/image";

interface CoursiaLogoProps {
  size?: number;
  className?: string;
  /** Use 'wide' for horizontal layout (hero, banner) */
  variant?: "square" | "wide";
}

export default function CoursiaLogo({ size = 40, className = "", variant = "square" }: CoursiaLogoProps) {
  const height = size;
  const width = variant === "wide" ? Math.round(size * 1.88) : size;

  return (
    <Image
      src="/logo.png"
      alt="Coursia"
      width={width}
      height={height}
      className={className}
      priority
      style={{ objectFit: variant === "wide" ? "contain" : "cover" }}
    />
  );
}
