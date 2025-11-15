// =============================
// components/CurvedNavbar.tsx
// =============================
"use client";

import Image from "next/image";

interface CurvedNavbarProps {
  docCount?: number;
  pageCount?: number;
  newsCount?: number;
  fragCount?: number;
  onReset?: () => void;
  hasMessages?: boolean;
}

export default function CurvedNavbar({
  docCount = 1209,
  pageCount = 40834,
  newsCount = 10388,
  fragCount = 193836,
  onReset,
  hasMessages = false,
}: CurvedNavbarProps) {
  return (
    <div className="w-full bg-[oklch(0.25_0_0)] border-b border-white/10">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 text-white/70 text-sm font-light w-full mx-auto">
        {/* Left: Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Image
            src="/images/indoclimatelogo.png"
            alt="Indoclimate"
            width={48}
            height={48}
            className="object-contain"
          />
          <span className="text-lg font-normal text-white/90 hidden sm:inline">Indoclimate</span>
        </div>

        {/* Center: Stats - hidden on mobile, visible on larger screens */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8">
          <span className="hidden lg:inline text-sm">Document: {docCount.toLocaleString("id-ID")}</span>
          <span className="hidden lg:inline text-sm">Pages: {pageCount.toLocaleString("id-ID")}</span>
          <span className="hidden lg:inline text-sm">News: {newsCount.toLocaleString("id-ID")}</span>
          <span className="hidden lg:inline text-sm">Fragment: {fragCount.toLocaleString("id-ID")}</span>
          {/* Compact stats for md-lg screens */}
          <span className="lg:hidden text-sm">Docs: {docCount.toLocaleString("id-ID")}</span>
          <span className="lg:hidden text-sm">Pages: {pageCount.toLocaleString("id-ID")}</span>
        </div>

        {/* Right: Reset button */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {hasMessages && (
            <button
              onClick={onReset}
              className="text-white/60 hover:text-white/90 transition-colors px-2 sm:px-3 py-1 rounded hover:bg-white/5 text-xs"
            >
              reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
