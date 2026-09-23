import { userSelect } from "./rest";
import { uuidPattern, type WriteResult } from "./experience-model";

export type WriteKind = "question" | "answer" | "comment" | "party";
export type Submission = { kind: WriteKind; requestId: string; userId: string; token: string; values: Record<string, string | number | null> };
type Row = Record<string, string | number | null>;
export type Receipt = { id: string; href?: string; same: boolean };
const spec = {
  question: { table: "questions", owner: "author_id", fields: ["game_universe_id", "title", "body"] },
  answer: { table: "answers", owner: "author_id", fields: ["question_id", "body"] },
  comment: { table: "comments", owner: "author_id", fields: ["question_id", "answer_id", "body"] },
  party: { table: "party_posts", owner: "host_id", fields: ["game_universe_id", "title", "note", "playstyle", "max_members", "requested_duration_minutes", "roblox_join_url"] },
} as const;
const names = { question: "질문", answer: "답변", comment: "댓글", party: "파티" };
export function receiptResult(kind: WriteKind, receipt: Receipt): WriteResult {
  if (receipt.same && receipt.href) return { status: "success", message: "이미 등록된 내용을 확인했습니다.", href: receipt.href };
  return { status: "conflict", message: receipt.href
    ? "이전 요청은 등록됐습니다. 지금 수정한 내용은 아직 저장되지 않았으며 이 화면에 그대로 남아 있습니다."
    : "이전 요청은 처리됐지만 해당 글은 지금 볼 수 없습니다. 수정한 초안은 그대로 남아 있습니다.",
    href: receipt.href, hrefLabel: `이미 등록된 ${names[kind]} 보기`, canStartNew: true };
}

// Owner is taken from getCurrentUser in the server action, NEVER from form data.
// Ordinary caller RLS and visible moderation state still apply. Read only the
// payload required for equality, never attach the stored body to an error/URL.
export async function findOwnWriteReceipt(sub: Submission): Promise<Receipt | null> {
  if (!uuidPattern.test(sub.userId) || !uuidPattern.test(sub.requestId)) throw new Error("Invalid receipt identity");
  const def = spec[sub.kind];
  const rows = await userSelect<Row>(def.table, sub.token, {
    select: ["id", ...def.fields, "moderation_status", ...(sub.kind === "party" ? ["status", "expires_at"] : [])].join(","),
    [def.owner]: `eq.${sub.userId}`, client_request_id: `eq.${sub.requestId}`, moderation_status: "eq.visible", limit: 1,
  });
  const row = rows[0];
  if (!row || typeof row.id !== "string" || !uuidPattern.test(row.id)) return null;
  const same = def.fields.every(key => row[key] == null ? sub.values[key] == null : String(row[key]) === String(sub.values[key]));
  let href: string | undefined;
  if (sub.kind === "question") href = `/questions/${row.id}`;
  else if (sub.kind === "party") {
    const games = await userSelect<{ canonical_slug: string }>("games", sub.token, { select: "canonical_slug", universe_id: `eq.${row.game_universe_id}`, limit: 1 });
    const slug = games[0]?.canonical_slug;
    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && ["open", "full"].includes(String(row.status)) && new Date(String(row.expires_at)).getTime() > Date.now()) href = `/game/${slug}/party#party-${row.id}`;
  } else {
    let questionId = row.question_id;
    if (sub.kind === "comment" && row.answer_id) {
      const answers = await userSelect<{ question_id: string; author_id: string | null }>("answers", sub.token, { select: "question_id,author_id", id: `eq.${row.answer_id}`, moderation_status: "eq.visible", limit: 1 });
      questionId = answers[0]?.author_id ? answers[0].question_id : null;
    }
    if (typeof questionId === "string" && uuidPattern.test(questionId)) {
      const questions = await userSelect<{ id: string }>("r1_question_feed", sub.token, { select: "id", id: `eq.${questionId}`, limit: 1 });
      if (questions[0]) href = `/questions/${questionId}#${sub.kind}-${row.id}`;
    }
  }
  return { id: row.id, href, same };
}

export async function submitWithRecovery(
  sub: Submission,
  insert: () => Promise<WriteResult>,
  lookup: (sub: Submission) => Promise<Receipt | null> = findOwnWriteReceipt,
): Promise<WriteResult> {
  const before = await lookup(sub);
  if (before) return receiptResult(sub.kind, before);
  try { return await insert(); }
  catch (error) {
    // Covers both a concurrent matching request and a lost RPC response after
    // COMMIT. If the lookup itself fails, preserve the original error and draft.
    const after = await lookup(sub).catch(() => null);
    if (after) return receiptResult(sub.kind, after);
    throw error;
  }
}
