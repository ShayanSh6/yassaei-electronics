"use client";

// ── Fullscreen product-image lightbox ──
// Keyboard: Escape closes · ArrowLeft = next / ArrowRight = prev (RTL flow)
// Click image to toggle 2× zoom; click backdrop to close.

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/store/router";

export function Lightbox({
  images,
  index,
  alt,
  onClose,
  onIndexChange,
}: {
  images: string[];
  index: number | null; // null = closed
  alt: string;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const open = index !== null;
  // zoom is keyed to the current slide: changing the slide auto-resets zoom
  // (derived state — avoids setState-in-effect lint error)
  const [zoom, setZoom] = useState<{ idx: number | null; on: boolean }>({ idx: null, on: false });
  const zoomed = zoom.on && zoom.idx === index;
  const toggleZoom = () => setZoom({ idx: index, on: !(zoom.on && zoom.idx === index) });

  const go = useCallback(
    (dir: 1 | -1) => {
      if (index === null || images.length < 2) return;
      const next = (index + dir + images.length) % images.length;
      onIndexChange(next);
    },
    [index, images.length, onIndexChange],
  );
  // keyboard controls + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(1); // RTL: left arrow moves forward
      else if (e.key === "ArrowRight") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, go, onClose]);

  return (
    <AnimatePresence>
      {open && images[index] && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex flex-col print:hidden"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`نمایش تصویر ${alt}`}
        >
          {/* top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white/90"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold num">
              {toFa((index ?? 0) + 1)} / {toFa(images.length)}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleZoom}
                className="grid place-items-center size-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                aria-label={zoomed ? "کوچک‌نمایی" : "بزرگ‌نمایی"}
              >
                {zoomed ? <ZoomOut className="size-4.5" /> : <ZoomIn className="size-4.5" />}
              </button>
              <button
                onClick={onClose}
                className="grid place-items-center size-9 rounded-lg bg-white/10 hover:bg-red-500/80 transition-colors"
                aria-label="بستن"
              >
                <X className="size-4.5" />
              </button>
            </div>
          </div>

          {/* main image */}
          <div
            className="relative flex-1 grid place-items-center overflow-hidden min-h-0 px-14 sm:px-20"
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <>
                <button
                  onClick={() => go(-1)}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 grid place-items-center size-10 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                  aria-label="تصویر قبلی"
                >
                  <ChevronRight className="size-5" />
                </button>
                <button
                  onClick={() => go(1)}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 grid place-items-center size-10 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                  aria-label="تصویر بعدی"
                >
                  <ChevronLeft className="size-5" />
                </button>
              </>
            )}
            <AnimatePresence mode="wait">
              <motion.img
                key={`${index}-${images[index]}`}
                src={images[index]}
                alt={alt}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                onClick={toggleZoom}
                className={cn(
                  "max-h-full max-w-full object-contain rounded-xl select-none",
                  zoomed
                    ? "cursor-zoom-out scale-[1.9] transition-transform duration-300"
                    : "cursor-zoom-in transition-transform duration-200",
                )}
                draggable={false}
              />
            </AnimatePresence>
            <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-black/50 px-2.5 py-1 text-[10px] text-white/70">
              {zoomed ? "برای کوچک‌نمایی کلیک کنید" : "برای بزرگ‌نمایی کلیک کنید"}
            </span>
          </div>

          {/* thumbnail strip */}
          {images.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 px-4 py-3"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => onIndexChange(i)}
                  className={cn(
                    "size-14 rounded-lg overflow-hidden border-2 transition-all bg-white/5",
                    i === index
                      ? "border-white/90 scale-105"
                      : "border-transparent opacity-55 hover:opacity-90",
                  )}
                  aria-label={`تصویر ${toFa(i + 1)}`}
                >
                  <img src={img} alt="" className="size-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
