from pathlib import Path
import importlib.util
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r"C:\Users\HP\Downloads\PORTAL DATA")


def load_sync_helpers():
    module_path = REPO_ROOT / "scripts" / "sync-current-year-data.py"
    spec = importlib.util.spec_from_file_location("sync_current_year_data", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    if len(sys.argv) <= 1:
        raise SystemExit("Please provide the current-year source folder path, or use scripts\\local-sync-gui.py to choose it visually.")
    source_root = Path(sys.argv[1]).resolve()
    if not source_root.exists():
        raise SystemExit(f"Source folder not found: {source_root}")

    result = load_sync_helpers().sync_current_year(source_root)
    print(f"Local current-year sync complete for 2026-2027")
    print(f"Source folder: {result['sourceFolder']}")
    print(f"Completed month: {result['completedMonth']}")
    print(f"Running month: {result['runningMonth']}")
    print(f"As on: {result['statusAsOn']}")
    print(f"Backup created: {result['backup'] or 'not needed'}")
    print(result["exportLog"])


if __name__ == "__main__":
    main()
