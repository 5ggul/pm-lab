"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PlayIcon, { type PlayIconName } from "./PlayIcon";
const items: {href:string;label:string;icon:PlayIconName}[]=[{href:"/",label:"홈",icon:"home"},{href:"/games",label:"게임",icon:"game"},{href:"/guides",label:"공략",icon:"book"},{href:"/community",label:"질문",icon:"chat"},{href:"/me",label:"내 정보",icon:"user"}];
export default function MobileNav(){const path=usePathname();return <nav className="mobile-nav" aria-label="모바일 메뉴">{items.map(i=>{const active=i.href==="/"?path==="/":path===i.href||(i.href==="/games"&&path.startsWith("/game/")&&!path.includes("/guides")&&!path.includes("/questions"))||(i.href==="/guides"&&path.includes("/guides"))||(i.href==="/community"&&(path.startsWith("/questions/")||path.endsWith("/questions")));return <Link key={i.href} href={i.href} aria-current={active?"page":undefined}><PlayIcon name={i.icon}/><span>{i.label}</span></Link>})}</nav>}
