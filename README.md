# Moradabad Division Budget Portal

GitHub-ready static budget analysis portal with repository-based data files.

## What Is Included

- `index.html` - main portal shell.
- `pages/` - FR, upload, current/previous analysis, and advanced report pages.
- `assets/` - portal CSS and JavaScript.
- `data/current_payload.js` - generated current/previous analysis payload used by the browser.
- `data/reports-data.js` and `data/reports-data.json` - generated advanced-report payloads.
- Browser-generated `.xlsx` and PDF/print exports for Current/Previous Analysis and Advanced Report.
- `data/year-sources.js` and `data/year-sources.json` - year/source manifest.
- `data/source-files/YYYY-YYYY/` - original Excel source files for each financial year.
- `data/source-files/2026-2027/backups/` - latest two current-year backup copies kept for verification.
- `scripts/local-upload-server.py` - local upload/sync server for monthly data replacement.

## Data Folder Layout

Each financial year folder keeps six standard files:

- `pu-budget.xls`
- `pu-month-actual.xls`
- `pu-dept-demand-smh-budget.xls`
- `pu-dept-demand-smh-actual.xls`
- `demand-smh-budget.xls`
- `demand-smh-actual.xls`

Previous year folders are static snapshots. The current update target is `data/source-files/2026-2027/`.

## Local Use

Run the local upload server from the repo root:

```powershell
python .\scripts\local-upload-server.py 8000
```

Open:

```text
http://127.0.0.1:8000/
```

The upload page stores current-year files into `data/source-files/2026-2027/`, refreshes generated data payloads, and keeps only the latest two backup folders.

## GitHub Pages Use

GitHub Pages can host the portal as a static site. The analysis pages read the committed files under `data/`.

Important: browser-only GitHub Pages cannot write uploaded Excel files back to the repository by itself. Monthly uploads should be done locally first, then committed and pushed to GitHub.

## Monthly Sync Workflow

1. Run the portal locally with `scripts/local-upload-server.py`.
2. Upload the latest current-year files from the Upload Data page.
3. Verify Current/Previous Analysis and Advanced Report pages.
4. Commit changed files under:
   - `data/source-files/2026-2027/`
   - `data/source-files/2026-2027/backups/`
   - `data/current_payload.js`
   - `data/reports-data.js`
   - `data/reports-data.json`
   - `data/year-sources.js`
   - `data/year-sources.json`
5. Push to GitHub.

## Do Not Commit

`upload_password.json` is intentionally ignored because it is local-only.
