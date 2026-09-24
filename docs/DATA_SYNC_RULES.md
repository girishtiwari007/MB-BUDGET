# MB-BUDGET Data Sync Rules

This document defines the safe sync workflow for current and future upload systems.

## Current Trusted Workflow

The current trusted update path is the local GUI/script sync flow:

1. Select source folder or file.
2. Parse and sense the uploaded data.
3. Confirm completed month and running month.
4. Rebuild active portal data files.
5. Refresh export files.
6. Run smoke tests and signature checks.
7. Commit only after review.

## Required Sync Metadata

Every confirmed sync must preserve:

- financial year
- completed actual month
- running month
- data-as-on date/time
- upload/sync timestamp
- source file names
- parser/sync trigger
- validation result
- export refresh result

## Source Versioning

At minimum, keep:

- latest active source
- previous source copy
- second previous source copy when available
- manifest showing active file and backup dates

The future database/API system should preserve daily snapshots, not only latest files.

## Future API Sync Boundary

Future API/database sync must not directly overwrite validated static portal files without validation.

Recommended future sequence:

1. API receives upload.
2. Raw file is stored.
3. Parser creates normalized staging data.
4. Validation checks run.
5. User/admin confirms.
6. Active data payload is generated.
7. Exports are refreshed.
8. Static portal files are updated.

## GitHub Pages Limitation

GitHub Pages is static and cannot write repository files directly. Hosted uploads may parse data in browser memory, but permanent repository updates require one of:

- local GUI sync tool
- local upload server
- backend API
- GitHub API workflow with authentication

Until an API/backend is built, local sync remains the authoritative repository update method.
