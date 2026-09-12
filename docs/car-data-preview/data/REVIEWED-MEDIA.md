# Reviewed vehicle media and body styles

The image manifest is the only image source for catalog and family pages. A record covers the photographed generation, not every generation or trim in a family. The caption must retain that scope. Manufacturer specification records and the existing hierarchy establish the family match; photo descriptions/categories and a visual review establish the depicted model. Do not rewrite the hierarchy to fit an image.

Each photo stores its Commons file page, actual thumbnail and original URLs, author, license link, attribution requirement, dimensions, review date, depicted generation, matching basis, description and category evidence. The browser uses contain sizing without cropping or editing; preserve license/source links. A failed image leaves its reserved neutral area and source credit. QA uses local image fixtures, never a Commons availability requirement.

2026-09-06: expanded 8 to 30 families. Replaced the prior `Genesis G80.jpg`: Commons categorizes it as DH, while the reviewed manufacturer data is RG3. No KEA records, generation assignments, calculation inputs or manufacturer numeric specifications were changed.

## Body-style foundation

`body-style-reviewed.json` follows the adjacent schema. Initial explicit manufacturer evidence covers Sorento, G80 and Santa Fe. Missing entries mean unknown. Manufacturer RV marketing groups must not silently become SUV/MPV classifications. Separate SUV/MPV filters require explicit source evidence for each included family and must never use the photograph or an existing category string as evidence.

The public body-style filter remains disabled while coverage is three families. When enabled, label it as covering confirmed vehicles, show verified coverage and unknown status, preserve the full catalog under All, and intersect only reviewed family IDs with other filters. Keep generation scope in each record; a future family with multiple different body styles requires per-generation records before inclusion. Do not hide unknown vehicles from All. Add reload/reset/empty-result QA before enabling it.

Next review batch: remaining 13 of the 16 manufacturer-spec families, using official model descriptions or catalog text with an explicit body-style statement.

## Coverage follow-up (2026-09-11)

Expanded to 383 of 422 normalized model families; 39 remain without a verified photo. Default sorting places verified-photo families first, while manufacturer and model-name sorting remain URL-persistent. Unknown-photo cards reserve a compact neutral area.

Three ST1-based special-purpose and passenger-conversion families reuse a reviewed Hyundai ST1 Cargo photo. Their captions state that cargo bodies, passenger windows and school-transport equipment can differ from the pictured base vehicle. The selected source contains no visible people and is licensed CC BY-SA 4.0.

UI QA uses local photo fixtures to avoid making external uptime a release condition. Run `audit-live-vehicle-photos.mjs` separately to report actual browser image loads, missing-photo coverage and first-page photo counts; its results are advisory, not proof of permanent image availability. Manufacturer dimensions cover all 35 static model articles. The remaining 39 photo gaps are recorded individually and stay empty until an exact, people-free, commercially reusable source is available; public model names no longer use the raw-only fallback.

Full pagination QA also found a legacy URL race: the hidden 50-row table clamped deep links before the 24-card catalog read them. The generated page now grants URL ownership to the consumer catalog from the initial HTML; the legacy writer exits. Tests traverse every current page and delay the consumer script on the last page.
