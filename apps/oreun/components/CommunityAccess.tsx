import Link from "next/link";
import type { WriteAccess } from "@/lib/community/experience-model";

export default function CommunityAccess({
  access,
  next,
  mode = "question",
}: {
  access: WriteAccess;
  next: string;
  mode?: "question" | "answer";
}) {
  if (access === "ready") return null;
  const noun = mode === "answer" ? "답변" : "질문";
  const details = {
    guest: {
      title: `${noun}을 쓰려면 로그인해 주세요.`,
      text: "Google 계정으로 로그인하면 원래 페이지로 돌아옵니다.",
      href: `/login?next=${encodeURIComponent(next)}`,
      cta: "Google 로그인",
    },
    age: {
      title: "프로필 확인이 필요합니다.",
      text: `${noun}을 쓰기 전에 만 14세 이상 여부를 확인해 주세요.`,
      href: `/me?next=${encodeURIComponent(next)}`,
      cta: "프로필 확인",
    },
    restricted: {
      title: "현재 글을 작성할 수 없는 계정입니다.",
      text: "다시 로그인할 필요는 없습니다. 계정 이용에 관한 문의를 남겨 주세요.",
      href: "/contact",
      cta: "문의하기",
    },
    unavailable: {
      title: "계정 상태를 확인하지 못했습니다.",
      text: "잠시 뒤 다시 확인해 주세요.",
      href: next,
      cta: "다시 확인",
    },
  }[access];

  return (
    <div className="callout" data-access-state={access}>
      <strong>{details.title}</strong>
      <p>{details.text}</p>
      <Link className="secondary-button" href={details.href}>{details.cta}</Link>
    </div>
  );
}
