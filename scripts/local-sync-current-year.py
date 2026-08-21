from pathlib import Path
from datetime import datetime
import importlib.util
import shutil
import sys

from export_refresh import refresh_exports

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r"C:\Users\HP\Downloads\PORTAL DATA")
YEAR = "2026-2027"

SOURCE_FILES = {
    "currPuBudget": ("PU-BUDGET.xls", "pu-budget.xls"),
    "currPuMonth": ("PU-MONTH-ACTUAL.xls", "pu-month-actual.xls"),
    "currPuDeptDemandSmhBudget": ("PU-DEPT-DEMAND-SMH-BUDGET.xls", "pu-dept-demand-smh-budget.xls"),
    "currPuDeptDemandSmhActual": ("PU-DEPT-DEMAND-SMH-ACTUAL.xls", "pu-dept-demand-smh-actual.xls"),
    "currSmhBudget": ("DEMAND-SMH-BUGDET.xls", "demand-smh-budget.xls"),
    "currSmhMonth": ("DEMAND-SMH-ACTUAL.xls", "demand-smh-actual.xls"),
}


def load_upload_helpers():
    module_path = REPO_ROOT / "scripts" / "local-upload-server.py"
    spec = importlib.util.spec_from_file_location("local_upload_server", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    source_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source_root.exists():
        raise SystemExit(f"Source folder not found: {source_root}")

    helpers = load_upload_helpers()
    year_dir = REPO_ROOT / "data" / "source-files" / YEAR
    year_dir.mkdir(parents=True, exist_ok=True)

    missing = [src for src, _target in SOURCE_FILES.values() if not (source_root / src).exists()]
    if missing:
        raise SystemExit("Missing source files: " + ", ".join(missing))

    existing = [year_dir / target for _src, target in SOURCE_FILES.values() if (year_dir / target).exists()]
    backup_name = ""
    if existing:
        backup_name = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_dir = year_dir / "backups" / backup_name
        backup_dir.mkdir(parents=True, exist_ok=True)
        for file_path in existing:
            shutil.copy2(file_path, backup_dir / file_path.name)

    copied = []
    for role, (source_name, target_name) in SOURCE_FILES.items():
        source_path = source_root / source_name
        target_path = year_dir / target_name
        shutil.copy2(source_path, target_path)
        copied.append((role, source_name, target_name, target_path.stat().st_size))

    helpers.keep_two_backups(year_dir / "backups")
    manifest = helpers.write_current_manifest(YEAR, str(source_root), backup_name)
    helpers.patch_data_metadata(manifest)
    print(refresh_exports("current-year-local-sync"))

    print(f"Local current-year sync complete for {YEAR}")
    print(f"Source folder: {source_root}")
    print(f"As on: {manifest['statusAsOn']}")
    print(f"Backup created: {backup_name or 'not needed'}")
    print("Copied files:")
    for role, source_name, target_name, size in copied:
        print(f"  {role}: {source_name} -> {target_name} ({size} bytes)")
    print("Latest backups:")
    for backup in manifest.get("backups", []):
        print(f"  {backup}")


if __name__ == "__main__":
    main()
