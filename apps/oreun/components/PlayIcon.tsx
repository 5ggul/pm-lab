import type { CSSProperties } from "react";
export type PlayIconName = "game" | "home" | "spark" | "book" | "chat" | "party" | "user" | "rise" | "arrow" | "search" | "help" | "megaphone" | "code";
const paths: Record<PlayIconName, string[]> = {
  game: ["M7 7h10l3 10a2 2 0 0 1-3 2l-3-3h-4l-3 3a2 2 0 0 1-3-2L7 7Z", "M7 11h4m-2-2v4", "M16 10h.01m2 3h.01"],
  home: ["m3 11 9-8 9 8", "M5 10v11h5v-7h4v7h5V10"],
  spark: ["m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"],
  book: ["M12 6v15", "M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Z"],
  chat: ["M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 4V5a2 2 0 0 1 2-2Z", "M7 8h10M7 12h6"],
  party: ["M8 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M1 21v-2a6 6 0 0 1 12 0v2", "M16 5a4 4 0 0 1 0 8m0 3c4 0 6 2 6 5"],
  user: ["M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M3 22v-2a9 9 0 0 1 18 0v2"],
  rise: ["m3 17 6-6 4 4 8-11", "M15 4h6v6"],
  arrow: ["M4 12h16m-7-7 7 7-7 7"],
  search: ["M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m15 15 7 7"],
  help: ["M9.5 9a3 3 0 1 1 5 2.2c-1.4 1.2-2.5 1.7-2.5 3.8", "M12 19h.01"],
  megaphone: ["M3 11v2l11 4V7L3 11Z", "M14 9l5-2v10l-5-2", "M5 14l1 5h4l-2-4"],
  code: ["M4 7h16v10H4z", "M8 11h4", "M8 14h7"],
};
export default function PlayIcon({ name, className, style }: { name: PlayIconName; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name].map((d,i)=><path key={i} d={d}/>)}</svg>;
}
