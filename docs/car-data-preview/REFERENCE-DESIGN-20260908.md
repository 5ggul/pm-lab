# Page reference adaptation — 2026-09-08

The photo expansion was deployed before starting this change (PR #68).

| Surface | Reference and adaptation |
| --- | --- |
| Home | [Cars-Data](https://cars-data.com/en): search and practical entry points around licensed editorial photography. White surfaces, dark type, restrained blue actions. |
| Finder | [Carnoon](https://www.carnoon.co.kr/newcar/search): condition-based browsing and compact model rows. Existing filters, sort, pagination, photo credits and inspector preserved. |
| Static comparisons | [Danawa](https://mauto.danawa.com/compare/) and [Edmunds](https://www.edmunds.com/car-comparisons/): aligned specification rows and separate selection / result areas. Ten matrices use the existing exact variant values. Keyboard-operable differences-only filter; full static table without JS. |
| Comparison identity | [CarSandbox](https://carsandbox.com/comparison) and [Carsized](https://www.carsized.com/en/cars/compare/): distinct A/B identities. No simulation or size-comparison feature added. |
| Detail and calculators | In-page section links, clearer input/result contrast, consistent numeric alignment. Existing calculation and source data preserved. |
| Rankings, recalls, guides | Readable ranked rows, separate notice blocks, editorial guide links; shared typography and spacing. |
| Visual reference | [Dribbble dashboard](https://dribbble.com/shots/26509767-Vehicle-Comparison-Tool-Dashboard): public description/palette only. Browser showed human verification. The [search collection](https://dribbble.com/search/shots/popular?q=car-website-design) was unavailable. Neither was copied or treated as fully inspected. |

Reference images, code, prices and vehicle specifications are not imported. Existing independently sourced photo licenses and credits remain. Domain and indexing settings remain deferred by the user.

Generation: `build-reference-design.mjs` runs at the end of `finish-public-ui.mjs`, after photo credits. CSS and JS receive content versions. Static sections are replaced idempotently.

Validation: `reference-design-qa.mjs` checks 11 representative routes at 375, 390, 430 and 1280 pixels, section targets, duplicate IDs, horizontal overflow, keyboard filtering and no-JS table content. Existing studio, decision, media, delivery and arithmetic checks remain required.
