from datetime import datetime
from pathlib import Path
import json
import subprocess
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST = REPO_ROOT / "data" / "export-refresh-manifest.json"
GENERATOR = REPO_ROOT / "scripts" / "generate_drm_exports.py"
EXPECTED_EXPORTS = [
    "exports/Current_Previous_Year_PU_Demand_Analysis.xlsx",
    "exports/Current_Previous_Year_PU_Demand_Analysis.pdf",
    "exports/FR_Budget_Status.xlsx",
    "exports/FR_Budget_Status.pdf",
    "exports/Moradabad_Division_Current_Year_Budget_Analysis.pptx",
    "exports/Moradabad_Division_DRM_Budget_FR_Analysis.xlsx",
    "exports/Moradabad_Division_DRM_Budget_FR_Analysis.pptx",
    "exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Till_JUL_2025_Actual.pptx",
    "exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Full_FY_2025_26_Actual.pptx",
]


def export_file_info(relative_path):
    path = REPO_ROOT / relative_path
    return {
        "path": relative_path,
        "exists": path.exists(),
        "size": path.stat().st_size if path.exists() else 0,
        "modifiedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds") if path.exists() else "",
    }


def write_manifest(trigger, output):
    files = [export_file_info(path) for path in EXPECTED_EXPORTS]
    missing = [item["path"] for item in files if not item["exists"] or item["size"] <= 0]
    payload = {
        "refreshedAt": datetime.now().isoformat(timespec="seconds"),
        "trigger": trigger,
        "status": "success" if not missing else "incomplete",
        "missing": missing,
        "files": files,
        "generator": GENERATOR.relative_to(REPO_ROOT).as_posix(),
        "output": output.strip(),
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    if missing:
        raise RuntimeError("Export refresh incomplete. Missing: " + ", ".join(missing))
    return payload


def refresh_exports(trigger="manual"):
    if not GENERATOR.exists():
        raise RuntimeError(f"Export generator not found: {GENERATOR}")
    result = subprocess.run([sys.executable, str(GENERATOR)], cwd=REPO_ROOT, text=True, capture_output=True)
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
    if result.returncode:
        write_manifest(f"{trigger}:failed", output)
        raise RuntimeError(output or "Export refresh failed")
    manifest = write_manifest(trigger, output)
    return output or f"Exports refreshed: {manifest['refreshedAt']}"
