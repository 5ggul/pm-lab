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

CREATE TABLE IF NOT EXISTS quote_reviews (
  submission_id TEXT PRIMARY KEY,
  payload_fingerprint TEXT,
  duplicate_of TEXT,
  suggested_status TEXT NOT NULL,
  review_flags_json TEXT NOT NULL DEFAULT '[]',
  reviewer_status TEXT NOT NULL DEFAULT 'pending',
  reviewer_note_code TEXT,
  reviewed_at TEXT,
  FOREIGN KEY(submission_id) REFERENCES quote_submissions(submission_id)
);

CREATE TABLE IF NOT EXISTS quote_aggregate_runs (
  run_id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  input_count INTEGER NOT NULL,
  approved_candidate_count INTEGER NOT NULL,
  eligible_after_outlier_count INTEGER NOT NULL,
  published_segment_count INTEGER NOT NULL,
  methodology_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_review ON quote_submissions(review_status, quality_grade);
CREATE INDEX IF NOT EXISTS idx_quote_segment ON quote_submissions(pyeong_band, region_level1, scope, quote_month);
CREATE INDEX IF NOT EXISTS idx_quote_review_suggested ON quote_reviews(suggested_status, reviewer_status);
CREATE INDEX IF NOT EXISTS idx_quote_fingerprint ON quote_reviews(payload_fingerprint);

-- 의도적으로 저장하지 않는 값: IP, User-Agent, 이름, 업체명, 상세주소, 연락처, 이메일, 계좌, 자유메모, 파일.
-- raw submission 테이블과 quote_reviews의 submission_id 단위 레코드는 공개 API로 조회하지 않는다.
-- 공개 Git/정적 사이트에는 최소 표본 기준을 충족한 집계 JSON만 배포한다.
