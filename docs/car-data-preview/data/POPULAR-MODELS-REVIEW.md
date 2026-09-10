# Popular manufacturer model pages — 2026-09-07

Added nine static pages and expanded Avante at its existing URL. The model directory, home and vehicle catalogue contain ordinary HTML links to all ten pages. All pages remain noindex.

## Source scope

`popular-models-reviewed.json` records the official source URL, PDF page where applicable, SHA-256 of the reviewed source, review date, model scope and 117 specification rows/groups.

- Hyundai: Avante 13, Santa Fe 18, Tucson 15, Palisade 15. Official PDF specification tables were extracted and visually checked. An erroneous `.pdf.pdf` Avante source link was corrected.
- Kia: Sportage 21, Carnival 9, EV3 6, EV9 12. Official specification-page tables; Carnival excludes high-roof conversions. Explicit current model years are retained where provided.
- Genesis: GV70 4 and GV80 4 manufacturer efficiency ranges. No exact wheel-to-efficiency mapping is inferred. Energy costs preserve the range and reverse efficiency bounds correctly.

This registry is independent of historical KEA records. It does not promote uncertain generations, remove any of the 4,203 source rows, or claim all historical variants are covered. Existing legacy calculator choices remain intact.

## Page behavior

Manufacturer efficiency, city/highway values, EV range and new-car annual tax are present in initial HTML. The first specification has static 10k/30k/50k-km fuel-cost scenarios. EV prices start blank. Changing fuel updates the default unit price; manually changing price is supported. Tax uses the shared non-commercial passenger-car calculation including local education tax before age and prepayment discounts. Insurance, maintenance, tolls and purchase price are excluded.

Ten existing licensed photos are reused with original credit/license links. Network failure replaces the image with readable text. Mobile tables scroll horizontally within the page. Home retains its original six public calculator cards plus a separate ten-model directory.

## Verification

`popular-models-ui-qa.mjs` covers all ten models at 375/390/430/1280px, no-JS content, source metadata, noindex, navigation, photo fallback, explicit Avante/EV3 numeric cost anchors, GV70 range bounds, LPG price changes and invalid inputs. Source counts and independent official-value anchors are checked. The existing full data and UI regression suites remain required in Actions.
