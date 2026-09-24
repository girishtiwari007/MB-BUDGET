# MB-BUDGET Current Portal Rules

This document freezes the current MB-BUDGET portal as the production-grade static core.

## Production Static Core

The current static portal is the validated user-facing system:

- `index.html`
- `pages/`
- `assets/`
- `data/`
- `exports/`
- `scripts/`

These files must remain GitHub Pages compatible. The portal must continue to open as a static website for viewing reports and downloading committed exports.

## Protected Calculation Rules

Future changes must preserve these rules unless an explicit finance rule change is approved:

- Completed actual month is the default reporting basis.
- Running month is shown only in running/till-date views.
- RG value overrides BG_ISL/OBA when RG is available for the financial year.
- Demand 12N / 10N remains separate and excluded from normal demand totals.
- Important PU list remains 27, 28, 30, 32, 60 unless changed by configuration.
- FR budget status must use the latest confirmed FR upload/source.
- Uploaded/source data must carry data-as-on and last-upload timestamps.

## Protected User Views

Current validated views must keep their calculation meaning:

- Home
- OWE Current Year link
- Current/Previous Year Analysis
- Quarter Review under Current/Previous Year Analysis
- Report and Charts
- FR Budget Status
- Data Export Centre
- Data Health
- Admin Portal
- Formula / Column Remarks

Design refinements may improve spacing, button style, and mobile usability, but must not alter table data, formulas, filters, or export behavior without a specific requirement.

## Export Quality Rule

For every MB-BUDGET portal change that affects data, UI rendering, export logic, or report output, verify that Excel, PDF, and PPT/PPTX exports are not corrupt before completion.

- Excel exports must remain editable `.xlsx` files.
- Use black cell borders, fitted columns, Times New Roman table font where applicable.
- Preserve two-line thousand/Cr amount cells where used.
- PDF and PPT/PPTX exports must be professional, readable, margin-safe, and not cut off.
- Browser/local generated exports and hosted static downloads must be protected by the export password unless admin is unlocked.
- Run smoke tests, file-signature checks, and cache refresh after data/UI/export changes.

## Change Discipline

- Do not mix future API/database experiments into the static portal files until tested.
- Keep calculations centralized and reusable.
- Keep visual/theme work separate from calculation logic.
- Keep current validated portal usable after every commit.
