CREATE TABLE IF NOT EXISTS quote_submissions (
  submission_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  quote_month TEXT NOT NULL,
  region_level1 TEXT NOT NULL,
  pyeong_band TEXT NOT NULL,
  building_age_band TEXT NOT NULL,
  scope TEXT NOT NULL,
  bathroom_count TEXT NOT NULL,
  window_status TEXT NOT NULL,
  vat_status TEXT NOT NULL,
  waste_status TEXT NOT NULL,
  total_amount_manwon INTEGER NOT NULL,
  work_items_json TEXT NOT NULL,
  source_type TEXT NOT NULL,
  quality_grade TEXT NOT NULL,
  quality_flags_json TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_review ON quote_submissions(review_status, quality_grade);
CREATE INDEX IF NOT EXISTS idx_quote_segment ON quote_submissions(pyeong_band, region_level1, scope, quote_month);

-- 의도적으로 저장하지 않는 값: IP, User-Agent, 이름, 업체명, 상세주소, 연락처, 이메일, 계좌, 자유메모, 파일.
-- raw submission 테이블은 공개 API로 조회하지 않는다. 통계는 별도 집계 결과만 공개한다.
