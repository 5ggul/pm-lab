import Link from "next/link";
import PlayIcon, { type PlayIconName } from "./PlayIcon";
import CommunityArtIcon, { type CommunityArtKind } from "./CommunityArtIcon";

type Tile={key:CommunityArtKind;title:string;description:string;href:string;icon:PlayIconName;tone:string;status?:string};
export default function CommunityTiles({gameSlug,guideCount,updateCount,codeCount}:{gameSlug?:string;guideCount?:number;updateCount?:number;codeCount?:number}){
 const base=gameSlug?"/game/"+gameSlug:"";
 const tiles:Tile[]=[
  {key:"free",title:"자유",description:gameSlug?"이 게임 얘기라면 뭐든지":"게임 얘기, 자랑, 추천을 자유롭게",href:gameSlug?base+"/free":"/community/free",icon:"chat",tone:"pink",status:"자유롭게 이야기해요"},
  {key:"question",title:"질문답변",description:gameSlug?"막힌 부분을 묻고 답해요":"궁금한 건 묻고 아는 건 답해요",href:gameSlug?base+"/questions":"/community",icon:"help",tone:"cyan",status:"서로 도와요"},
  {key:"guide",title:"공략",description:"시작 방법과 플레이 팁 보기",href:gameSlug?base+"/guides":"/guides",icon:"book",tone:"green",status:guideCount!=null?guideCount+"개 공개":"공략 둘러보기"},
  {key:"update",title:"업데이트",description:"게임이 바뀐 시각과 새 소식 확인",href:gameSlug?base+"/updates":"/updates",icon:"megaphone",tone:"violet",status:updateCount!=null?updateCount+"개 감지":"최근 기록 보기"},
  {key:"party",title:"파티 모집",description:"같이 플레이할 사람 찾기",href:gameSlug?base+"/party":"/games?intent=party",icon:"party",tone:"orange",status:"친구와 같이 플레이"},
  {key:"code",title:"공짜 혜택",description:gameSlug?"지금 받을 수 있는 무료 보상 보기":"게임별 무료 보상과 교환 혜택 보기",href:gameSlug?base+"/codes":"/codes",icon:"code",tone:"yellow",status:gameSlug&&codeCount!=null?(codeCount?codeCount+"개 받을 수 있어요":"확인된 혜택 없음"):"무료 보상 모아보기"},
 ];
 return <div className={"community-tile-grid "+(gameSlug?"game-community-tiles":"")}>{tiles.map(tile=><Link prefetch={false} href={tile.href} className={"community-tile tone-"+tile.tone} key={tile.key}><span className="community-tile-icon"><CommunityArtIcon kind={tile.key}/></span><div><strong>{tile.title}</strong><p>{tile.description}</p><small>{tile.status}</small></div><PlayIcon name="arrow" className="community-tile-arrow"/></Link>)}</div>;
}
