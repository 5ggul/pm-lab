import type { GameView } from "./types";
export const genreLabels: Record<string,string> = { Shooter:"슈팅", Action:"액션", RPG:"RPG", Roleplay:"역할 놀이", "Roleplay & Avatar Sim":"역할 놀이", Simulation:"시뮬레이션", Survival:"생존", Adventure:"모험", Sports:"스포츠", "Sports & Racing":"스포츠·레이싱", "Obby & Platformer":"점프·장애물", Strategy:"전략", Puzzle:"퍼즐", Social:"소셜", "Party & Casual":"캐주얼" };
export function genreLabel(value?: string | null) { return value ? genreLabels[value] ?? value : "게임"; }
export function discoveryGenres(games: Pick<GameView,"genreL1">[]) {
  const counts = new Map<string,number>();
  for (const g of games) if(g.genreL1) counts.set(g.genreL1,(counts.get(g.genreL1)??0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,6).map(([value,count])=>({value,count,label:genreLabel(value)}));
}
