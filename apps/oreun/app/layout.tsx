import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import { getRenderingSiteUrl, isIndexingReleased } from "@/lib/indexing";

const base = getRenderingSiteUrl();
const preview = !isIndexingReleased();

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: {
    default: "오름 · 로블록스 게임 정보",
    template: "%s | 오름",
  },
  description:
    "Roblox 게임 검색, 현재 플레이 인원, 급상승, 공식 미디어, 업데이트와 Q&A를 한곳에서 확인합니다.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "오름",
    title: "오름 · 뜨는 게임의 기록",
    description:
      "Roblox 게임의 현재 인원, 변화 기록, 공략과 질문을 확인합니다.",
    url: base,
  },
  twitter: {
    card: "summary_large_image",
    title: "오름 · 뜨는 게임의 기록",
    description:
      "지금 많이 하는 Roblox 게임과 최근 변화, 공식 이미지·영상을 확인합니다.",
  },
  robots: preview
    ? {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false, noimageindex: true },
      }
    : { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "오름",
    alternateName: "Oreun",
    url: base,
    description:
      "Roblox 게임의 현재 인원, 공략, 업데이트와 질문을 모은 한국어 게임 정보 서비스",
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "오름",
    url: base,
    description:
      "Roblox Corporation과 제휴 또는 공식 관계가 없는 독립 게임 데이터 서비스",
  };

  return (
    <html lang="ko">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <div className="app-shell">
          {children}
          <Footer />
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
