'use client';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { draftKey, loadDraft, persistDraft, type QuestionDraft } from "@/lib/community/question-draft";
import type { QuestionResult } from "@/lib/community/experience-model";
import WriteConflict from "./WriteConflict";
import styles from "./community-experience.module.css";

type Props = { userId: string; gameSlug: string; universeId: number; initialRequestId: string; action: (data: FormData) => Promise<QuestionResult> };
export default function QuestionComposer({ userId, gameSlug, universeId, initialRequestId, action }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [requestId, setRequestId] = useState(initialRequestId);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [storageNotice, setStorageNotice] = useState("초안을 준비하고 있습니다.");
  const [result, setResult] = useState<QuestionResult | null>(null);
  const lock = useRef(false);
  const latest = useRef<QuestionDraft>({ version: 1, userId, gameSlug, requestId, title, body, savedAt: Date.now() });
  latest.current = { version: 1, userId, gameSlug, requestId, title, body, savedAt: Date.now() };

  useEffect(() => {
    try {
      const draft = loadDraft(window.sessionStorage, userId, gameSlug);
      if (draft) {
        setTitle(draft.title); setBody(draft.body); setRequestId(draft.requestId);
        setStorageNotice("이 탭에 저장된 초안을 불러왔습니다.");
      } else setStorageNotice("입력한 글은 이 탭에 임시 저장됩니다.");
    } catch { setStorageNotice("이 브라우저에서는 임시저장을 사용할 수 없습니다. 이동하기 전 내용을 복사해 주세요."); }
    setReady(true);
  }, [userId, gameSlug]);

  function save(showNotice = false) {
    try {
      persistDraft(window.sessionStorage, { ...latest.current, savedAt: Date.now() });
      if (showNotice) setStorageNotice(latest.current.title || latest.current.body ? "이 탭에 임시 저장했습니다." : "입력한 글은 이 탭에 임시 저장됩니다.");
    } catch { if (showNotice) setStorageNotice("임시저장을 사용할 수 없습니다. 현재 입력은 유지됩니다. 이동 전 내용을 복사해 주세요."); }
  }
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => save(true), 350);
    return () => window.clearTimeout(timer);
  }, [ready, title, body, requestId]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => save();
    window.addEventListener("pagehide", flush);
    return () => { flush(); window.removeEventListener("pagehide", flush); };
  }, [ready, userId, gameSlug]);

  function discard() {
    if (sending || !window.confirm("작성 중인 초안을 지울까요?")) return;
    const freshId = window.crypto.randomUUID();
    latest.current = { ...latest.current, title: "", body: "", requestId: freshId };
    setTitle(""); setBody(""); setRequestId(freshId); setResult(null);
    try { window.sessionStorage.removeItem(draftKey(userId, gameSlug)); } catch {}
    setStorageNotice("초안을 지웠습니다.");
  }
  function startNewRequest() {
    if (sending || lock.current) return;
    const id = window.crypto.randomUUID();
    latest.current = { ...latest.current, requestId: id };
    setRequestId(id); setResult(null); save(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || lock.current) return;
    lock.current = true;
    const data = new FormData(event.currentTarget);
    save(); setSending(true); setResult(null);
    try {
      const response = await action(data);
      setResult(response);
      if (response.status === "success" && response.href) {
        // Clear only after a confirmed commit; redirects/errors never erase text.
        latest.current = { ...latest.current, title: "", body: "" };
        try { window.sessionStorage.removeItem(draftKey(userId, gameSlug)); } catch {}
        setTitle(""); setBody(""); setRequestId(window.crypto.randomUUID());
        router.push(response.href);
      }
    } catch {
      setResult({ status: "error", message: "연결이 끊어졌습니다. 입력한 글은 유지됩니다. 같은 요청으로 다시 등록해 주세요." });
    } finally { lock.current = false; setSending(false); }
  }

  return <section className={`panel ask-panel ${styles.composer}`} aria-labelledby="question-composer-heading">
    <h2 id="question-composer-heading">질문하기</h2>
    <p className={styles.hint}>어느 화면에서 무엇을 하다가 막혔는지 적어 주세요. 시도해 본 방법도 알려주면 답변하기 쉽습니다.</p>
    <form onSubmit={submit} className="stack-form" aria-busy={sending} data-testid="question-composer">
      <input type="hidden" name="game_universe_id" value={universeId} />
      <input type="hidden" name="game_slug" value={gameSlug} />
      <input type="hidden" name="draft_user_id" value={userId} />
      <input type="hidden" name="request_id" value={requestId} />
      <label>제목<input name="title" minLength={5} maxLength={120} required value={title} onChange={event => setTitle(event.target.value)} readOnly={sending} placeholder="무엇이 궁금한가요?" aria-describedby="question-title-count" /><small id="question-title-count">{title.length}/120자</small></label>
      <label>내용<textarea name="body" minLength={10} maxLength={5000} required rows={7} value={body} onChange={event => setBody(event.target.value)} readOnly={sending} placeholder="막힌 상황과 시도해 본 방법을 적어 주세요." aria-describedby="question-body-count" /><small id="question-body-count">{body.length.toLocaleString("ko-KR")}/5,000자 · 연락처와 계정 인증정보는 적지 마세요.</small></label>
      {result && result.status !== "conflict" && <div className={result.status === "success" ? "callout" : "callout danger"} role={result.status === "success" ? "status" : "alert"}>{result.message}{result.href && <p><a href={result.href}>{result.status === "success" ? "등록한 질문 보기" : "확인하고 돌아오기"} →</a></p>}</div>}
      <WriteConflict result={result} disabled={sending} onNewRequest={startNewRequest} />
      <div className={styles.formActions}><button className="primary-button" type="submit" disabled={!ready || sending}>{sending ? "등록 중…" : "질문 등록"}</button><button className="secondary-button" type="button" onClick={discard} disabled={!ready || sending || (!title && !body)}>초안 지우기</button></div>
      <small role="status" aria-live="polite">{sending ? "등록 중입니다. 한 번만 눌러 주세요." : storageNotice}</small>
      <small>초안은 계정·게임별로 이 탭에만 저장됩니다. 다른 기기로 동기화되지 않으며 24시간이 지나면 만료됩니다.</small>
      <noscript><p>질문 등록에는 자바스크립트가 필요합니다. 브라우저 설정을 확인해 주세요.</p></noscript>
    </form>
  </section>;
}
