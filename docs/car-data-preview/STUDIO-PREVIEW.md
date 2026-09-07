# Vehicle studio preview — 2026-09-07

The home headline and supporting sentence are removed. Home and the vehicle catalogue now use a white workspace with blue controls, a left search/filter column, a vehicle list and a separate selected-vehicle inspector. Mobile users open the inspector with “미리보기” and return with “목록으로”; the original detail-page links remain available. Existing photo credits, six static home cards and all 592 catalogue families are retained.

The size comparison at `/compare/dimensions/` includes eight models in nine explicitly scoped configurations. It uses stored reviewed manufacturer dimensions. Carnival normal-roof gasoline/diesel (1,775 mm) and hybrid (1,785 mm) are separate entries. EV6 excludes GT-Line. Unresolved ranges and models without exact conditions are not selectable.

The diagrams compare rectangular outside dimensions at a common scale and ground baseline, with front/side/back directions, overlay or side-by-side layout, opacity and vehicle swapping. They are **not vehicle silhouettes or calibrated photographic overlays**. Front and rear show the same published width and height. Real photo overlays require appropriately licensed, matching-generation orthographic front/side/rear assets and calibration. Body width must not be interpreted as mirror-to-mirror parking clearance.

The inspector does not present unknown fuel types or ambiguous PHEV aggregate efficiency as a single km/L figure. Unsupported size links open the comparison selector without pretending that another vehicle is the selected model.

Validation: studio interaction/geometry regression suite added to the existing preview workflow; existing catalogue desktop assertions now check list + inspector layout. Preview noindex remains enabled. No domain configuration or indexing change is included.
