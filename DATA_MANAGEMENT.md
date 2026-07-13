# Data Source Management

The portal now keeps source Excel files inside the repository under `data/source-files/`.

## Folder layout

Each year has six stable source files:

- `pu-budget.xls` - Primary Unit wise budget for the year.
- `pu-month-actual.xls` - Primary Unit wise month-wise actual expense.
- `pu-dept-demand-smh-budget.xls` - PU wise, department wise, demand/SMH wise budget.
- `pu-dept-demand-smh-actual.xls` - PU wise, department wise, demand/SMH wise actual expense.
- `demand-smh-budget.xls` - Demand/SMH wise budget.
- `demand-smh-actual.xls` - Demand/SMH wise actual expense.

Previous year folders are static snapshots. The current year folder, currently `2026-2027`, is the monthly update target.

## Monthly update

1. Put the latest current-year files in `C:\Users\HP\Dropbox\Revenue PU Laibilities\PPT\DATA FILES\2026-2027` using the existing source filenames.
2. Run this from the repo root:

```powershell
.\scripts\update-current-year-data.ps1
```

3. Review the app locally at `http://127.0.0.1:8000/`.
4. Commit and push the changed files in `data/source-files/2026-2027`, generated `data/*payload*` / `data/reports-data.*`, and `data/year-sources.*` when needed.

The app reads `data/year-sources.js`. Its current sync keys still exist for the existing upload screen, and the detailed six-category keys are present for further workflows.

## Local upload page storage

For upload-page storage, run the local API server instead of the plain static server:

```powershell
python .\scripts\local-upload-server.py 8000
```

The Upload Data page then stores the six current-year files into `data/source-files/2026-2027`. Before overwriting, it copies the existing current-year files into `data/source-files/2026-2027/backups/<timestamp>` and keeps only the latest two backup folders.

## GitHub sync rule

GitHub Pages is static hosting, so it can display committed data but cannot save uploaded files back into GitHub by itself. Use the local upload server for monthly update, verify the portal locally, then commit and push the changed data and generated payload files.

Keep `upload_password.json` local only. It is ignored by `.gitignore`.
