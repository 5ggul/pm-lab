import type { GameIdentity, GameView } from "./types";
export function normalizeQuery(input:string){return input.normalize("NFKC").toLowerCase().replace(/[\s\-_·:!.'’()[\]{}]/g,"").trim();}
function trigramSet(s:string){const p=`  ${s}  `; const out=new Set<string>(); for(let i=0;i<p.length-2;i++) out.add(p.slice(i,i+3)); return out;}
export function trigramSimilarity(a:string,b:string){if(!a||!b)return 0; const A=trigramSet(a),B=trigramSet(b); let hit=0; for(const x of A)if(B.has(x))hit++; return (2*hit)/(A.size+B.size);}
export function rankGameSearch<T extends GameIdentity & Partial<Pick<GameView,"playing"|"name">>>(games:T[], raw:string){
  const q=normalizeQuery(raw); if(!q)return [];
  return games.map(game=>{const names=[game.nameKo,(game as any).name??"",...game.aliases]; const norms=names.map(normalizeQuery).filter(Boolean); let tier=9,sim=0;
    if(norms[0]===q || normalizeQuery((game as any).name??"")===q) tier=0;
    else if(norms.some(x=>x===q)) tier=1;
    else if(norms.some(x=>x.startsWith(q))) tier=2;
    else {sim=Math.max(...norms.map(x=>trigramSimilarity(q,x))); tier=sim>=.25?3:9;}
    return {game,tier,sim};
  }).filter(x=>x.tier<9).sort((a,b)=>a.tier-b.tier || b.sim-a.sim || ((b.game.playing??0)-(a.game.playing??0))).map(x=>x.game);
}
