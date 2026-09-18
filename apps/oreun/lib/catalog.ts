import { GAME_IDENTITIES, VERIFIED_FALLBACKS } from "./seed";
import { RobloxPublicGamesProvider } from "./providers/roblox-public";
import { getFreshnessState } from "./freshness";
import type { GameView, ProviderGame } from "./types";
export async function getGameCatalog():Promise<GameView[]>{
  const provider=new RobloxPublicGamesProvider(); let live:ProviderGame[]=[]; let error="";
  try{live=await provider.getGames(GAME_IDENTITIES.map(g=>g.universeId));}catch(e){error=e instanceof Error?e.message:"provider error";}
  const map=new Map(live.map(x=>[x.universeId,x]));
  return GAME_IDENTITIES.map(identity=>{const source=map.get(identity.universeId)??VERIFIED_FALLBACKS[identity.universeId];
    if(!source){return {...identity,universeId:identity.universeId,rootPlaceId:identity.rootPlaceId,name:identity.nameKo,description:"",creatorName:"알 수 없음",playing:null,visits:null,favorites:null,sourceUpdatedAt:null,fetchedAt:"",sourceProvider:"roblox_public_games",sourceEndpoint:"https://games.roblox.com/v1/games",sourceClass:"ROBLOX_PUBLIC_API",sourceStatus:"fallback",freshnessState:"unavailable",fallbackReason:error||"no snapshot"};}
    return {...identity,...source,rootPlaceId:identity.rootPlaceId,freshnessState:getFreshnessState(source.fetchedAt),fallbackReason:source.sourceStatus==="fallback"?(error||"실시간 제공자 응답 없음; 마지막 검증 스냅샷 사용"):undefined};
  });
}
export async function getGameBySlug(slug:string){return (await getGameCatalog()).find(g=>g.slug===slug)??null;}
