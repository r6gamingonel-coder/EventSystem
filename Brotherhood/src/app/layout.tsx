import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "أخوية طريق المحبة | كنيسة مار كوركيس الكلدانية",
    template: "%s | أخوية طريق المحبة",
  },
  description:
    "أخوية طريق المحبة التابعة لكنيسة مار كوركيس الكلدانية — معاً في طريق المحبة والإيمان والخدمة.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
