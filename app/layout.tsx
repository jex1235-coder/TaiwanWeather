import type { Metadata } from "next";
import { Space_Grotesk, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: '--font-space' });
const notoSansTC = Noto_Sans_TC({ subsets: ["latin"], weight: ['400', '500', '700'], variable: '--font-noto' });

export const metadata: Metadata = {
  title: "TaiwanWeather | 幻境戰情室",
  description: "Next.js + Vercel Serverless 台灣氣象地圖",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${spaceGrotesk.variable} ${notoSansTC.variable}`}>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
