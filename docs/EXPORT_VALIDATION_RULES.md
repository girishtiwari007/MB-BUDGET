# MB-BUDGET Export Validation Rules

Exports are authority-facing deliverables and must be validated before completion.

## Required Export Types

Current required exports include:

- Current/Previous Year Analysis `.xlsx`
- Current/Previous Year Analysis PDF
- Current Year Budget Analysis PPTX
- FR Budget Status `.xlsx`
- FR Budget Status PDF
- DRM Budget/FR Analysis `.xlsx`
- DRM Budget/FR Analysis PPTX variants
- DRM Yearly Comparison PPTX
- SMH PU/Department Matrix PDF

## Corruption Checks

Before closing work that affects exports:

- `.xlsx` and `.pptx` files must start with signature `504B0304`.
- `.pdf` files must start with signature `25504446`.
- Export smoke manifest must report success.
- Expected pages and export files must be present.

## Layout Checks

Exports should be presentation-ready:

- black table borders
- readable table font
- page/slide safe margins
- no cut-off rows, columns, charts, or titles
- appropriate split/fit strategy for wide tables
- charts visible where included
- data-as-on metadata visible where relevant

## Excel Rules

- Use `.xlsx`, not `.xls`, for generated modern exports.
- Files must remain editable.
- Tables should be usable for copy/paste into PPT.
- Use fitted columns where possible.
- Keep two-line thousand/Cr display where required.

## PDF/PPTX Rules

- PDF should be print-ready.
- PPTX should be editable where generated as PowerPoint content.
- Tables and charts should fit within slide/page margins.
- Font size should be readable, normally around 10 where feasible for PPT table content.

## Export Refresh Rule

After every confirmed data sync:

1. regenerate portal payloads
2. regenerate all exports
3. update cache tokens
4. run smoke validation
5. verify signatures
