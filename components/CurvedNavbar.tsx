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
        {/* Left: Logo and text - visible on all screen sizes */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Image
            src="/images/indoclimatelogo.png"
            alt="Indoclimate"
            width={48}
            height={48}
            className="object-contain"
          />
          <span className="text-lg font-normal text-white/90">Indoclimate</span>
        </div>

        {/* Right: Stats and Reset button */}
        <div className="flex items-center gap-4">
          {/* Stats - now visible on all screen sizes, more compact on mobile */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4 text-xs sm:text-sm">
            <span className="hidden lg:inline text-xs sm:text-sm">Doc: {docCount.toLocaleString("id-ID")}</span>
            <span className="hidden lg:inline text-xs sm:text-sm">Pg: {pageCount.toLocaleString("id-ID")}</span>
            <span className="hidden lg:inline text-xs sm:text-sm">News: {newsCount.toLocaleString("id-ID")}</span>
            <span className="hidden lg:inline text-xs sm:text-sm">Frag: {fragCount.toLocaleString("id-ID")}</span>
            {/* Compact stats for md-lg screens */}
            <span className="lg:hidden text-xs sm:text-sm">D: {docCount.toLocaleString("id-ID")}</span>
            <span className="lg:hidden text-xs sm:text-sm">P: {pageCount.toLocaleString("id-ID")}</span>
          </div>
          
          {/* Stats for mobile - show compact versions */}
          <div className="md:hidden flex items-center gap-1 text-xs">
            <span>D: {docCount.toLocaleString("id-ID")}</span>
            <span>•</span>
            <span>Pg: {pageCount.toLocaleString("id-ID")}</span>
            <span>•</span>
            <span>N: {newsCount.toLocaleString("id-ID")}</span>
            <span>•</span>
            <span>F: {fragCount.toLocaleString("id-ID")}</span>
          </div>

          {/* Reset button */}
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
    </div>
  );
}
