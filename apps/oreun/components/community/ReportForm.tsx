import { reportAction } from "@/app/actions/community";

export default function ReportForm({
  targetType,
  targetId,
  questionId,
  returnPath,
}: {
  targetType: "question" | "answer" | "comment" | "profile" | "party";
  targetId: string;
  questionId?: string;
  returnPath?: string;
}) {
  return (
    <details className="report-box">
      <summary>신고</summary>
      <form action={reportAction} className="compact-form">
        <input type="hidden" name="target_type" value={targetType} />
        <input type="hidden" name="target_id" value={targetId} />
        {questionId && (
          <input type="hidden" name="return_question_id" value={questionId} />
        )}
        {returnPath && (
          <input type="hidden" name="return_path" value={returnPath} />
        )}
        <label>
          사유
          <select name="reason" defaultValue="spam">
            <option value="spam">스팸</option>
            <option value="harassment">괴롭힘</option>
            <option value="sexual">성적 콘텐츠</option>
            <option value="personal_info">개인정보</option>
            <option value="scam">사기·거래</option>
            <option value="exploit">핵·Exploit</option>
            <option value="malicious_link">악성 링크</option>
            <option value="other">기타</option>
          </select>
        </label>
        <label>
          상세
          <input
            name="details"
            maxLength={1000}
            placeholder="필요한 경우만 간단히 적어 주세요."
          />
        </label>
        <button type="submit" className="secondary-button">
          신고 접수
        </button>
      </form>
    </details>
  );
}
