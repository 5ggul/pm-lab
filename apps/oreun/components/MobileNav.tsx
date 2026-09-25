"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PlayIcon, { type PlayIconName } from "./PlayIcon";

const items:{href:string;label:string;icon:PlayIconName}[]=[
 {href:"/",label:"홈",icon:"home"},
 {href:"/community/free",label:"자유",icon:"chat"},
 {href:"/community",label:"질문",icon:"help"},
 {href:"/guides",label:"공략",icon:"book"},
 {href:"/me",label:"내 정보",icon:"user"},
];

export default function MobileNav(){
 const path=usePathname();
 return <nav className="mobile-nav" aria-label="모바일 메뉴">{items.map(i=>{
  const active=i.href==="/"?path==="/":path===i.href||(i.href==="/community/free"&&(path.startsWith("/community/free")||path.endsWith("/free")))||(i.href==="/community"&&(path==="/community"||path.startsWith("/questions/")||path.endsWith("/questions")))||(i.href==="/guides"&&path.includes("/guides"));
  return <Link prefetch={false} key={i.href} href={i.href} aria-current={active?"page":undefined}>
   {i.href==="/me"?<img className="mobile-profile-avatar" src="/brand/roblejam-avatar-v2.svg" alt="" width={28} height={28}/>:<PlayIcon name={i.icon}/>}
   <span>{i.label}</span>
  </Link>
 })}</nav>;
}
