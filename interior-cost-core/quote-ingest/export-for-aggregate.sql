SELECT
  q.submission_id,
  q.schema_version,
  q.quote_month,
  q.region_level1,
  q.pyeong_band,
  q.building_age_band,
  q.scope,
  q.bathroom_count,
  q.window_status,
  q.vat_status,
  q.waste_status,
  q.total_amount_manwon,
  q.work_items_json,
  q.source_type,
  q.quality_grade,
  q.quality_flags_json,
  q.review_status,
  COALESCE(r.reviewer_status, 'pending') AS reviewer_status,
  q.received_at
FROM quote_submissions q
LEFT JOIN quote_reviews r ON r.submission_id = q.submission_id
ORDER BY q.received_at ASC, q.submission_id ASC;
