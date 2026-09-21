import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "یاسایی | فروشگاه قطعات الکترونیک و لوازم الکتریکی تهران",
  description:
    "فروشگاه تخصصی قطعات الکترونیک و لوازم الکتریکی یاسایی در تهران (نارمک، هفت‌حوض)؛ با ضمانت اصالت کالا، مهلت تست و ارسال به سراسر ایران.",
  keywords: ["یاسایی", "قطعات الکترونیک", "لوازم الکتریکی", "فروشگاه تهران", "نارمک"],
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#0d1520",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        {children}
        <Toaster position="bottom-left" richColors closeButton />
      </body>
    </html>
  );
}
