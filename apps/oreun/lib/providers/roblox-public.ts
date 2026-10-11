import type { ProviderGame } from "../types";
export class ProviderRateLimitError extends Error { constructor(public retryAfterSeconds:number|null){super("Roblox provider rate limited");} }
export interface GameProvider { getGames(universeIds:number[]):Promise<ProviderGame[]>; }
type ApiGame={id:number;rootPlaceId:number;name:string;description:string;creator?:{name?:string};playing?:number;visits?:number;favoritedCount?:number;updated?:string};
export class RobloxPublicGamesProvider implements GameProvider {
  readonly endpoint="https://games.roblox.com/v1/games";
  async getGames(universeIds:number[]):Promise<ProviderGame[]>{
    if(!universeIds.length)return[]; const url=`${this.endpoint}?universeIds=${universeIds.join(",")}`;
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
    try{const res=await fetch(url,{headers:{Accept:"application/json","User-Agent":"Oreun-R1-Preview/0.1"},signal:controller.signal,next:{revalidate:120}});
      if(res.status===429){const raw=res.headers.get("retry-after");throw new ProviderRateLimitError(raw?Number(raw):null);} if(!res.ok)throw new Error(`Roblox API ${res.status}`);
      const json=(await res.json()) as {data:ApiGame[]}; const fetchedAt=new Date().toISOString();
      return (json.data??[]).filter(g=>g.id>0).map(g=>({universeId:g.id,rootPlaceId:g.rootPlaceId,name:g.name,description:g.description??"",creatorName:g.creator?.name??"알 수 없음",playing:Number.isFinite(g.playing)?g.playing!:null,visits:Number.isFinite(g.visits)?g.visits!:null,favorites:Number.isFinite(g.favoritedCount)?g.favoritedCount!:null,sourceUpdatedAt:g.updated??null,fetchedAt,sourceProvider:"roblox_public_games",sourceEndpoint:this.endpoint,sourceClass:"ROBLOX_PUBLIC_API",sourceStatus:"live"}));
    } finally {clearTimeout(timer);}
  }
}
