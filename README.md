# Moradabad Division Budget & FR Analysis

GitHub Pages ready static portal.

## Structure
- `index.html`: lightweight shell and home page.
- `assets/`: CSS and JavaScript.
- `pages/`: FR and Current/Previous analysis pages.
- `data/`: current data payload and future year source configuration.
- `exports/`: PDF, Excel, and PPTX export files.

For future yearly data, add GitHub Raw URLs or CORS-enabled direct Google Drive workbook links in `data/year-sources.json`.

Use these role keys under `years -> 2026-2027 -> files`:
- `fr`
- `currPuBudget`
- `prevPuBudget`
- `currPuMonth`
- `prevPuMonth`
- `currSmhBudget`
- `prevSmhBudget`
- `currSmhMonth`
- `prevSmhMonth`

After updating links, open `Current / Previous Analysis -> Upload Data` and use `Sync / Refresh From Link`.
