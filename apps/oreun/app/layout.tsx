import type { Metadata } from "next";import "./globals.css";import Footer from "@/components/Footer";import MobileNav from "@/components/MobileNav";
const base=process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000";
export const metadata:Metadata={metadataBase:new URL(base),title:{default:"오름 · 뜨는 게임의 기록",template:"%s | 오름"},description:"Roblox 공개 경험 데이터를 기록해 지금 많이 하는 게임과 변화 추세를 보여주는 독립 데이터 서비스입니다.",robots:process.env.R1_PREVIEW_NO_INDEX!=="0"?{index:false,follow:false}:{index:true,follow:true}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body><div className="app-shell">{children}<Footer/></div><MobileNav/></body></html>}
