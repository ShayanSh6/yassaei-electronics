"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { api } from "@/lib/store/api";

const TITLES: Record<string, string> = {
  about: "دربارهٔ یاسایی",
  guide: "راهنمای خرید",
  service: "خدمات فروشگاه",
  faq: "پرسش‌های متداول",
  terms: "قوانین و مقررات",
  privacy: "حریم خصوصی",
  insurance: "گارانتی و بیمه",
  ticketRules: "قوانین پشتیبانی",
  bugReport: "گزارش خطا",
  contact: "تماس با ما",
};

function renderBlock(block: unknown, i: number): React.ReactNode {
  if (typeof block === "string") {
    return <p key={i} className="text-sm leading-7 text-muted-foreground">{block}</p>;
  }
  if (block && typeof block === "object") {
    const b = block as Record<string, unknown>;
    if (b.title) {
      return (
        <div key={i} className="space-y-2">
          <h3 className="font-bold text-brand">{String(b.title)}</h3>
          {typeof b.body === "string" && <p className="text-sm leading-7 text-muted-foreground">{b.body}</p>}
          {Array.isArray(b.body) &&
            (b.body as unknown[]).map((line, j) => (
              <p key={j} className="text-sm leading-7 text-muted-foreground">{String(line)}</p>
            ))}
        </div>
      );
    }
  }
  return null;
}

export function PageView({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["page", slug],
    queryFn: () => api.page(slug),
    staleTime: 10 * 60_000,
  });

  const title = TITLES[slug] ?? "صفحه";
  const hero = data?.hero as Record<string, unknown> | undefined;
  const body = data?.body as unknown[] | undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <a href="#/" className="hover:text-brand">خانه</a>
        <span>←</span>
        <span className="text-foreground">{title}</span>
      </div>

      <h1 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
        <FileText className="size-6 text-brand" /> {String(hero?.title ?? title)}
      </h1>
      {hero?.subtitle && (
        <p className="text-sm text-brand/90 leading-7 mb-8">{String(hero.subtitle)}</p>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-secondary rounded w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.isArray(body) && body.map((block, i) => renderBlock(block, i))}
        </div>
      )}
    </div>
  );
}
