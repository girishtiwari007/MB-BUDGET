# MB-BUDGET Future Architecture

The current website is the production-grade static core. Future API, database, design, and admin systems must be built around it without breaking today's validated workflow.

## Target Structure

```text
MB-BUDGET/
  index.html
  pages/
  assets/
  data/
  exports/
  scripts/
  docs/
  future/
    api/
    db/
    design-editor/
    report-builder/
    migration-notes/
```

## Current Core

The current static portal remains the reliable delivery layer:

- fast local/static viewing
- GitHub Pages hosting
- committed export downloads
- validated calculations
- current GUI/script sync workflow

## Future API Layer

The future API should handle:

- upload intake
- authentication
- validation
- staging data
- confirmation workflow
- export refresh jobs
- status logs
- GitHub/static publishing

Recommended stack:

- Python FastAPI
- SQLite first, PostgreSQL later if multi-user/server use grows
- existing Python parser/export scripts reused

## Future Database Layer

Suggested tables:

- `uploads`
- `source_files`
- `financial_years`
- `primary_units`
- `demands_smh`
- `departments`
- `monthly_actuals`
- `budget_proportion`
- `fr_budget_status`
- `export_runs`
- `validation_logs`
- `portal_settings`
- `snapshots`

## Future Design/Admin Layer

Future design tools should update configuration, not calculation logic.

Possible features:

- theme editor
- report title editor
- default view selector
- table visibility settings
- saved filter presets
- authority report pack builder
- mobile/desktop preview
- role-based upload/export permissions

## Migration Approach

Do not rebuild everything at once.

Recommended phases:

1. Freeze current static portal as baseline.
2. Document calculation, sync, and export rules.
3. Add API/database prototype under `future/`.
4. Reuse existing parsers and export scripts.
5. Validate API output against current static output.
6. Add admin/design editor as configuration layer.
7. Only then connect future API to production static files.

## Non-Negotiable Rule

The current validated portal must remain usable after every change.
