"use client";

import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundView() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center space-y-5">
      <span className="inline-grid place-items-center size-20 rounded-full bg-secondary text-brand">
        <Compass className="size-10" />
      </span>
      <h1 className="text-3xl font-extrabold">۴۰۴</h1>
      <p className="text-sm text-muted-foreground leading-6">
        صفحه‌ای که دنبالش بودید پیدا نشد؛
        <br />
        شاید آدرس را اشتباه وارد کرده‌اید.
      </p>
      <Button onClick={() => (window.location.hash = "#/")} className="gap-2">
        بازگشت به صفحهٔ اصلی <ArrowLeft className="size-4" />
      </Button>
    </div>
  );
}
