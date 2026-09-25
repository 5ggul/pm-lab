import { randomUUID } from "node:crypto";
import DraftForm from "./DraftForm";
import CommunityAccess from "./CommunityAccess";
import { submitCommunityGuide } from "@/app/actions/extra-composers";
import type { GameView } from "@/lib/types";
import type { WriteAccess } from "@/lib/community/experience-model";

export default function CommunityGuideComposer({
  games,
  userId,
  access,
  presetGameSlug = "",
  open = false,
  next,
}: {
  games: GameView[];
  userId: string | null;
  access: WriteAccess;
  presetGameSlug?: string;
  open?: boolean;
  next: string;
}) {
  if (!userId || access !== "ready") {
    return (
      <div id="write">
        <CommunityAccess access={access} mode="post" next={next} />
      </div>
    );
  }

  return (
    <details className="panel community-guide-compose" id="write" open={open}>
      <summary>내 공략 올리기</summary>
      <p className="community-guide-compose-intro">
        직접 해본 방법을 단계와 이유가 보이게 적어 주세요. 계정 정보나 외부 연락처는 올리지 마세요.
      </p>
      <DraftForm
        userId={userId}
        scope={presetGameSlug || "global"}
        kind="communityGuide"
        initialRequestId={randomUUID()}
        fields={["game_slug", "guide_type", "title", "body"]}
        action={submitCommunityGuide}
        submitLabel="공략 등록"
      >
        <label>
          게임
          {presetGameSlug ? (
            <>
              <input type="hidden" name="game_slug" value={presetGameSlug} />
              <strong className="locked-form-value">
                {games.find((game) => game.slug === presetGameSlug)?.nameKo ?? presetGameSlug}
              </strong>
            </>
          ) : (
            <select name="game_slug" required defaultValue="">
              <option value="" disabled>게임을 선택하세요</option>
              {games.map((game) => (
                <option value={game.slug} key={game.universeId}>
                  {game.nameKo}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          유형
          <select name="guide_type" defaultValue="guide">
            <option value="beginner">입문</option>
            <option value="mechanic">조작·규칙</option>
            <option value="progression">성장</option>
            <option value="troubleshooting">문제 해결</option>
            <option value="faq">FAQ</option>
            <option value="guide">일반</option>
          </select>
        </label>
        <label>
          제목
          <input
            name="title"
            minLength={5}
            maxLength={120}
            required
            placeholder="예: 초반 10분에 먼저 해야 할 3가지"
          />
        </label>
        <label>
          공략 내용
          <textarea
            name="body"
            minLength={100}
            maxLength={10000}
            rows={10}
            required
            placeholder="어떤 순서로 무엇을 해야 하는지, 왜 그렇게 하는지 구체적으로 적어 주세요."
          />
          <small>100~10,000자 · 실제 플레이에 바로 쓸 수 있는 내용을 권장합니다.</small>
        </label>
      </DraftForm>
    </details>
  );
}
