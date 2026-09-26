"use client";
import type { WriteResult } from "@/lib/community/experience-model";
export default function WriteConflict({ result, disabled, onNewRequest }: { result: WriteResult | null; disabled: boolean; onNewRequest: () => void }) {
  if (result?.status !== "conflict") return null;
  return <div className="callout" role="alert" data-testid="write-conflict">
    <p>{result.message}</p>
    {result.href && <a className="secondary-button" href={result.href} target="_blank" rel="noopener noreferrer">{result.hrefLabel ?? "이미 등록된 글 보기"} (새 탭)</a>}
    {result.canStartNew && <button type="button" className="text-button" disabled={disabled} onClick={() => {
      if (window.confirm("현재 내용을 새 글로 등록할 준비를 할까요? 기존 글은 바뀌지 않으며, 등록 버튼을 다시 눌러야 저장됩니다.")) onNewRequest();
    }}>현재 내용으로 새 글 작성하기</button>}
  </div>;
}
