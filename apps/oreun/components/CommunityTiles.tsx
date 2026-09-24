import Link from "next/link";
import PlayIcon, { type PlayIconName } from "./PlayIcon";

type Tile={key:string;title:string;description:string;href:string;icon:PlayIconName;tone:string;status?:string};
export default function CommunityTiles({gameSlug,guideCount,updateCount,codeCount}:{gameSlug?:string;guideCount?:number;updateCount?:number;codeCount?:number}){
 const base=gameSlug?"/game/"+gameSlug:"";
 const tiles:Tile[]=[
  {key:"free",title:"자유",description:gameSlug?"이 게임 얘기라면 뭐든지":"게임 얘기, 자랑, 추천을 자유롭게",href:gameSlug?base+"/free":"/community/free",icon:"chat",tone:"pink",status:"자유롭게 이야기해요"},
  {key:"question",title:"질문답변",description:gameSlug?"막힌 부분을 묻고 답해요":"궁금한 건 묻고 아는 건 답해요",href:gameSlug?base+"/questions":"/community",icon:"help",tone:"cyan",status:"서로 도와요"},
  {key:"guide",title:"공략",description:"시작 방법과 플레이 팁 보기",href:gameSlug?base+"/guides":"/guides",icon:"book",tone:"green",status:guideCount!=null?guideCount+"개 공개":"공략 둘러보기"},
  {key:"update",title:"업데이트",description:"게임이 바뀐 시각과 새 소식 확인",href:gameSlug?base+"/updates":"/updates",icon:"megaphone",tone:"violet",status:updateCount!=null?updateCount+"개 감지":"최근 기록 보기"},
  {key:"party",title:"파티 모집",description:"같이 플레이할 사람 찾기",href:gameSlug?base+"/party":"/games?intent=party",icon:"party",tone:"orange",status:"친구와 같이 플레이"},
 ];
 if(gameSlug&&codeCount!=null&&codeCount>0) tiles.push({key:"code",title:"코드",description:"현재 확인된 게임 코드 보기",href:base+"/codes",icon:"code",tone:"yellow",status:codeCount+"개 활성"});
 return <div className={"community-tile-grid "+(gameSlug?"game-community-tiles":"")}>{tiles.map(tile=><Link href={tile.href} className={"community-tile tone-"+tile.tone} key={tile.key}><span className="community-tile-icon"><PlayIcon name={tile.icon}/></span><div><strong>{tile.title}</strong><p>{tile.description}</p><small>{tile.status}</small></div><PlayIcon name="arrow" className="community-tile-arrow"/></Link>)}</div>;
}
