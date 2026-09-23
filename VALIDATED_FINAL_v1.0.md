# Validated Final v1.0

Validated on 23 September 2026 for the MB-BUDGET portal.

## Operating model

- The live site is a read-only GitHub Pages portal. Data updates are performed only through the local GUI launcher, `Launch MB-BUDGET Local Sync.bat`.
- The GUI uses `py -3`, accepts current-year source folders and FR workbooks, auto-senses completed and running periods, refreshes data payloads, recalculates reports, regenerates managed exports, and opens the local portal for review.
- Completed-month actuals and running-month figures remain separate reporting bases. Yearly Review uses completed actuals only.
- Admin and upload operations remain local-only. Public hosted downloads remain available.

## Export rules

- Page-level Excel exports contain the displayed report title, selected filters, and visible table data. Each visible table is placed on its own worksheet.
- Page-level PDF exports contain the displayed report title, selected filters, and visible table data in landscape print layout.
- Page-level PowerPoint exports use `.pptx` report slides based on the visible report tables.
- Data Export Centre managed downloads are separate and are not altered by page-level export logic.

## Validation performed

- All portal routes were served locally with HTTP 200 responses.
- Period calculation tests passed, including completed/running separation, prior-year matching, totals, labels, and zero handling.
- Eleven managed Excel, PDF, and PPTX files were regenerated and checked. The preserved yearly-comparison PPTX retained its template structure: 24 slides, 32 charts, and 70 relationship parts.
- Browser smoke testing confirmed navigation, Yearly Review filters, Department/PU separate reports, AI remarks, charts, and export controls.

## Known reporting safeguard

Rows without a comparable Budget Proportion do not show an artificial percentage utilization. They show a variance note instead.