'use client';

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  answerDraftKey,
  loadAnswerDraft,
  persistAnswerDraft,
  type AnswerDraft,
} from "@/lib/community/answer-draft";
import type { AnswerResult } from "@/lib/community/experience-model";
import styles from "./community-experience.module.css";

export default function AnswerComposer({
  userId,
  questionId,
  initialRequestId,
  action,
}: {
  userId: string;
  questionId: string;
  initialRequestId: string;
  action: (form: FormData) => Promise<AnswerResult>;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [requestId, setRequestId] = useState(initialRequestId);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const lock = useRef(false);
  const latest = useRef<AnswerDraft>({
    version: 1,
    userId,
    questionId,
    requestId,
    body,
    savedAt: Date.now(),
  });
  latest.current = { version: 1, userId, questionId, requestId, body, savedAt: Date.now() };

  useEffect(() => {
    try {
      const draft = loadAnswerDraft(window.sessionStorage, userId, questionId);
      if (draft) {
        setBody((current) => current || draft.body);
        setRequestId(draft.requestId);
        setNotice("저장된 답변을 불러왔습니다.");
      }
    } catch {
      setNotice("임시저장을 사용할 수 없습니다. 현재 입력은 그대로 유지됩니다.");
    }
    setReady(true);
  }, [userId, questionId]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        persistAnswerDraft(window.sessionStorage, { ...latest.current, savedAt: Date.now() });
      } catch {}
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ready, body, requestId]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      try {
        persistAnswerDraft(window.sessionStorage, { ...latest.current, savedAt: Date.now() });
      } catch {}
    };
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
    };
  }, [ready, userId, questionId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || lock.current) return;
    lock.current = true;
    setSending(true);
    setResult(null);
    try {
      try {
        persistAnswerDraft(window.sessionStorage, { ...latest.current, savedAt: Date.now() });
      } catch {}
      const response = await action(new FormData(event.currentTarget));
      setResult(response);
      if (response.status === "success" && response.href) {
        try { window.sessionStorage.removeItem(answerDraftKey(userId, questionId)); } catch {}
        setBody("");
        setRequestId(window.crypto.randomUUID());
        router.push(response.href);
      }
    } catch {
      setResult({
        status: "error",
        message: "연결이 끊어졌습니다. 작성한 답변은 유지됩니다. 다시 등록해 주세요.",
      });
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  return (
    <section className="panel answer-form" aria-labelledby="answer-composer-heading">
      <h2 id="answer-composer-heading">답변하기</h2>
      <form onSubmit={submit} className="stack-form" aria-busy={sending}>
        <input type="hidden" name="question_id" value={questionId} />
        <input type="hidden" name="draft_user_id" value={userId} />
        <input type="hidden" name="request_id" value={requestId} />
        <label>
          답변
          <textarea
            name="body"
            minLength={2}
            maxLength={5000}
            rows={7}
            required
            value={body}
            readOnly={sending}
            onChange={(event) => setBody(event.target.value)}
            placeholder="직접 해본 방법이나 확인한 내용을 적어 주세요."
          />
          <small>{body.length.toLocaleString("ko-KR")}/5,000자</small>
        </label>
        {result && (
          <div className={result.status === "success" ? "callout" : "callout danger"} role={result.status === "success" ? "status" : "alert"}>
            {result.message}
            {result.href && <p><a href={result.href}>확인하기 →</a></p>}
          </div>
        )}
        <button className="primary-button" type="submit" disabled={!ready || sending}>
          {sending ? "등록 중…" : "답변 등록"}
        </button>
        {notice && <small className={styles.note}>{notice}</small>}
        <small>작성 중인 답변은 이 탭에 24시간 보관됩니다.</small>
      </form>
    </section>
  );
}
