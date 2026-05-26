"use client";

import Image from "next/image";

interface CoursiaLogoProps {
  size?: number;
  className?: string;
}

export default function CoursiaLogo({ size = 40, className = "" }: CoursiaLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Coursia"
      width={size}
      height={size}
      className={`rounded-2xl ${className}`}
      priority
    />
  );
}
