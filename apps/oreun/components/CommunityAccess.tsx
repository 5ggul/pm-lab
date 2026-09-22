import Link from "next/link";
import type { WriteAccess } from "@/lib/community/experience-model";
export default function CommunityAccess({ access, next }: { access: WriteAccess; next: string }) {
  if (access === "ready") return null;
  const details = {
    guest: { title: "질문 작성은 로그인 후 가능합니다.", text: "Google 계정으로 로그인하고 공개 프로필을 확인해 주세요.", href: `/login?next=${encodeURIComponent(next)}`, cta: "로그인하고 질문하기" },
    age: { title: "로그인은 완료됐습니다.", text: "질문을 작성하려면 프로필에서 만 14세 이상 여부를 확인해 주세요.", href: `/me?next=${encodeURIComponent(next)}`, cta: "프로필 확인하고 돌아오기" },
    restricted: { title: "현재 글을 작성할 수 없는 계정입니다.", text: "다시 로그인할 필요는 없습니다. 계정 이용에 관한 문의를 남겨 주세요.", href: "/contact", cta: "계정 이용 문의" },
    unavailable: { title: "계정 상태를 확인하지 못했습니다.", text: "일시적인 연결 문제일 수 있습니다. 잠시 뒤 다시 확인해 주세요.", href: next, cta: "상태 다시 확인" },
  }[access];
  return <div className="callout" data-access-state={access}><strong>{details.title}</strong><p>{details.text}</p><Link className="secondary-button" href={details.href}>{details.cta}</Link></div>;
}
