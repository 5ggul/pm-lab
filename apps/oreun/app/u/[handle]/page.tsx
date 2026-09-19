import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ReportForm from "@/components/community/ReportForm";
import { getGameCatalog } from "@/lib/catalog";
import {
  getAnswersByAuthor,
  getContributionByHandle,
  getQuestionsByAuthor,
} from "@/lib/party/queries";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} 프로필`,
    robots: { index: false, follow: true },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const [profile, games] = await Promise.all([
    getContributionByHandle(handle),
    getGameCatalog(),
  ]);
  if (!profile) notFound();

  const [questions, answers] = await Promise.all([
    getQuestionsByAuthor(profile.id, 10),
    getAnswersByAuthor(profile.id, 10),
  ]);

  return (
    <>
      <Header games={games} />
      <main className="page public-profile">
        <div className="page-title">
          <span className="eyebrow">COMMUNITY PROFILE</span>
          <h1>{profile.display_name}</h1>
          <p>
            @{profile.handle} · 가입 {formatKstDateTime(profile.created_at)}
          </p>
        </div>

        {profile.bio && <p className="profile-bio">{profile.bio}</p>}

        <div className="status-grid contribution-grid">
          <div className="status-cell">
            <strong>{profile.question_count}</strong>
            <span>공개 질문</span>
          </div>
          <div className="status-cell">
            <strong>{profile.answer_count}</strong>
            <span>공개 답변</span>
          </div>
          <div className="status-cell">
            <strong>{profile.accepted_answer_count}</strong>
            <span>채택 답변</span>
          </div>
          <div className="status-cell">
            <strong>{profile.comment_count}</strong>
            <span>공개 댓글</span>
          </div>
        </div>

        <div className="callout">
          이 숫자는 공개 활동 기록을 요약한 값이며 신뢰 점수나 사용자
          “등급”이 아닙니다.
        </div>

        <ReportForm
          targetType="profile"
          targetId={profile.id}
          returnPath={`/u/${profile.handle}`}
        />

        <div className="section-head">
          <h2>최근 질문</h2>
        </div>
        {questions.length ? (
          <div className="profile-activity-list">
            {questions.map((question) => (
              <Link
                key={question.id}
                className="profile-activity-row"
                href={`/questions/${question.id}`}
              >
                <div>
                  <strong>{question.title}</strong>
                  <span>{question.game_name_ko}</span>
                </div>
                <small>
                  답변 {question.answer_count} ·{" "}
                  {formatKstDateTime(question.created_at)}
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="no-data">공개 질문이 없습니다.</div>
        )}

        <div className="section-head">
          <h2>최근 답변</h2>
        </div>
        {answers.length ? (
          <div className="profile-activity-list">
            {answers.map((answer) => (
              <Link
                key={answer.id}
                className="profile-activity-row"
                href={`/questions/${answer.question_id}#answers`}
              >
                <div>
                  <strong>
                    {answer.is_accepted ? "채택된 답변" : "답변"}
                  </strong>
                  <span>{answer.body}</span>
                </div>
                <small>{formatKstDateTime(answer.created_at)}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="no-data">공개 답변이 없습니다.</div>
        )}
      </main>
    </>
  );
}
