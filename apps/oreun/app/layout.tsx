import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import { getPublicSiteUrl, isIndexingReleased } from "@/lib/indexing";

const base = getPublicSiteUrl() ?? "http://localhost:3000";
const preview = !isIndexingReleased();

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: {
    default: "오름 · 뜨는 게임의 기록",
    template: "%s | 오름",
  },
  description:
    "Roblox 공개 경험 데이터를 기록해 지금 많이 하는 게임과 변화 추세를 보여주는 독립 데이터 서비스입니다.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "오름",
    title: "오름 · 뜨는 게임의 기록",
    description:
      "지금 어떤 게임이 뜨고 있는지 현재 플레이 인원과 실제 기록으로 확인합니다.",
    url: base,
  },
  twitter: {
    card: "summary_large_image",
    title: "오름 · 뜨는 게임의 기록",
    description:
      "지금 어떤 게임이 뜨고 있는지 현재 플레이 인원과 실제 기록으로 확인합니다.",
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
      "Roblox 공개 경험 데이터와 오름 Historical Data를 결합한 독립 게임 데이터 서비스",
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
