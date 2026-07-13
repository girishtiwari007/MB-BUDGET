# GitHub Desktop Sync Ready

Repository:

```text
C:\Users\HP\OneDrive\Documents\GitHub\MB-BUDGET
```

Remote:

```text
https://github.com/girishtiwari007/MB-BUDGET.git
```

Branch:

```text
main
```

## Current sync status

The portal is ready for GitHub Desktop sync.

Local branch status before this note was added:

```text
main...origin/main [ahead 1]
```

Ready commit:

```text
5da06a9 Prepare GitHub-ready budget portal with data sync
```

After committing this note file, GitHub Desktop should show one additional local commit ready to push.

## What will sync

- Portal shell and pages.
- Current / Previous Analysis page.
- Advanced Report page with Important PU filters.
- Generated browser data:
  - `data/current_payload.js`
  - `data/reports-data.js`
  - `data/reports-data.json`
  - `data/year-sources.js`
  - `data/year-sources.json`
- Original source Excel data in:
  - `data/source-files/2023-2024/`
  - `data/source-files/2024-2025/`
  - `data/source-files/2025-2026/`
  - `data/source-files/2026-2027/`
- Latest two current-year backup copies in:
  - `data/source-files/2026-2027/backups/`
- Local upload/sync scripts in:
  - `scripts/local-upload-server.py`
  - `scripts/update-current-year-data.ps1`
- Documentation:
  - `README.md`
  - `DATA_MANAGEMENT.md`
  - `.gitignore`

## What will not sync

`upload_password.json` is local only. It is ignored and removed from Git tracking.

## GitHub Desktop steps

1. Open GitHub Desktop.
2. Select repository `MB-BUDGET`.
3. Confirm the changed files / commits are shown.
4. Click `Push origin`.

GitHub Pages can then serve the committed portal and data files. Monthly uploads should still be done locally first with:

```powershell
python .\scripts\local-upload-server.py 8000
```

Then verify locally, commit the changed data payload/source files, and push again from GitHub Desktop.
