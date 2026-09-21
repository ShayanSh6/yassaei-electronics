"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};
/** SSR-safe "mounted" flag (no setState-in-effect). */
const useMounted = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/** Light/dark toggle — mounted-safe so SSR markup always matches the first client render. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  // Pre-mount (SSR + hydration): theme-independent static label → no hydration mismatch.
  // Post-mount: reflects the resolved theme.
  const isDark = (resolvedTheme ?? "dark") === "dark";
  const label = !mounted
    ? "تغییر پوسته روشن/تیره"
    : isDark
      ? "تغییر به حالت روشن"
      : "تغییر به حالت تیره";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative size-9 rounded-lg hover:bg-brand/10 hover:text-brand", className)}
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {!mounted ? (
        // pre-mount placeholder keeps size stable and avoids hydration mismatch
        <Sun className="size-[18px] opacity-0" />
      ) : isDark ? (
        <Sun key="sun" className="size-[18px] animate-in fade-in zoom-in-50 duration-300" />
      ) : (
        <Moon key="moon" className="size-[18px] animate-in fade-in zoom-in-50 duration-300" />
      )}
    </Button>
  );
}
