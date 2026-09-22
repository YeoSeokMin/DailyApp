import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // ★metadataBase 가 없으면 OG/canonical 이 상대경로로 나가 크롤러가 해석하지 못한다
  metadataBase: new URL("https://dailyapp.opcodey.com"),
  title: {
    default: "오늘의 앱 아이디어 — 매일 발굴하는 iOS·Android 신규 앱",
    template: "%s | 오늘의 앱 아이디어",
  },
  description:
    "매일 한국·미국·일본 앱스토어의 신규 출시 앱을 수집해 수익 구조·기술 난이도·시장 기회로 분석합니다. 개인 개발자가 만들 만한 앱 아이디어를 찾는 리포트.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://dailyapp.opcodey.com",
    siteName: "오늘의 앱 아이디어",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var stored = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (stored === 'dark' || (!stored && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
