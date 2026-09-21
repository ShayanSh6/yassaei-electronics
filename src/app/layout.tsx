import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "یاسایی | فروشگاه قطعات الکترونیک و لوازم الکتریکی تهران",
  description:
    "فروشگاه تخصصی قطعات الکترونیک و لوازم الکتریکی یاسایی در تهران (نارمک، هفت‌حوض)؛ با ضمانت اصالت کالا، مهلت تست و ارسال به سراسر ایران.",
  keywords: ["یاسایی", "قطعات الکترونیک", "لوازم الکتریکی", "فروشگاه تهران", "نارمک"],
  manifest: "/manifest.json",
  applicationName: "یاسایی",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "یاسایی | فروشگاه قطعات الکترونیک تهران",
    description:
      "۱۲۱ کالای اصل با ضمانت اصالت، مهلت تست ۷ روزه و ارسال به سراسر ایران — از مقاومت تا کنتاکتور صنعتی.",
    locale: "fa_IR",
    type: "website",
    siteName: "یاسایی الکترونیک",
  },
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
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="bottom-left" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
