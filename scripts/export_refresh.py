from datetime import datetime
from pathlib import Path
import json
import re
import subprocess
import sys
import zipfile


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
    "exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Till_Actual_Month.pptx",
    "exports/Moradabad_Division_DRM_Budget_FR_Analysis_H_Full_FY_2025_26_Actual.pptx",
    "exports/Moradabad_Division_DRM_PPT_With_Yearly_Comparison.pptx",
]
HTML_TARGETS = [
    "index.html",
    "pages/admin.html",
    "pages/current.html",
    "pages/exports.html",
    "pages/fr.html",
    "pages/logic.html",
    "pages/reports.html",
    "pages/status.html",
]
OFFICE_SUFFIXES = {".xlsx", ".pptx"}
PDF_SUFFIXES = {".pdf"}


def refresh_portal_asset_versions(token=None):
    token = token or datetime.now().strftime("%Y%m%d%H%M%S")
    targets = [REPO_ROOT / "index.html", *sorted((REPO_ROOT / "pages").glob("*.html"))]
    pattern = re.compile(r'((?:src|href)="(?!(?:https?:|mailto:|#))[^"]+\?v=)[^"]+(")')
    changed_files = []
    for path in targets:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        updated, count = pattern.subn(rf"\g<1>{token}\2", text)
        if count and updated != text:
            path.write_text(updated, encoding="utf-8")
            changed_files.append(path.relative_to(REPO_ROOT).as_posix())
    return {"token": token, "files": changed_files}


def export_file_info(relative_path):
    path = REPO_ROOT / relative_path
    return {
        "path": relative_path,
        "exists": path.exists(),
        "size": path.stat().st_size if path.exists() else 0,
        "modifiedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds") if path.exists() else "",
    }


def current_payload_meta():
    path = REPO_ROOT / "data" / "current_payload.js"
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.CURRENT_PAYLOAD_META\s*=\s*(\{.*?\});", text, flags=re.S)
    return json.loads(match.group(1)) if match else {}


def validate_current_basis():
    errors = []
    upload_manifest = REPO_ROOT / "data" / "source-files" / "2026-2027" / "upload-manifest.json"
    meta = current_payload_meta()
    if not upload_manifest.exists():
        errors.append("Current-year upload manifest is missing.")
        return errors
    upload = json.loads(upload_manifest.read_text(encoding="utf-8"))
    for key in ("completedMonth", "runningMonth", "statusAsOn"):
        if upload.get(key) and meta.get(key) and upload.get(key) != meta.get(key):
            errors.append(f"Current payload {key} does not match upload manifest: {meta.get(key)} != {upload.get(key)}")
    return errors


def validate_html_cache_token(token):
    errors = []
    if not token:
        errors.append("HTML cache refresh token missing.")
        return errors
    version_pattern = re.compile(r'(?:src|href)="(?!(?:https?:|mailto:|#))[^"]+\?v=([^"]+)"')
    for rel in HTML_TARGETS:
        path = REPO_ROOT / rel
        if not path.exists():
            errors.append(f"HTML page missing: {rel}")
            continue
        tokens = version_pattern.findall(path.read_text(encoding="utf-8"))
        stale = sorted({found for found in tokens if found != token})
        if stale:
            errors.append(f"{rel} has stale asset/data cache tokens: {', '.join(stale[:4])}")
    return errors


def validate_export_file(path, run_started):
    errors = []
    if not path.exists() or path.stat().st_size <= 0:
        return [f"Export missing or empty: {path.relative_to(REPO_ROOT).as_posix()}"]
    if path.stat().st_mtime + 2 < run_started.timestamp():
        errors.append(f"Export is older than this refresh run: {path.relative_to(REPO_ROOT).as_posix()}")
    if path.suffix.lower() in OFFICE_SUFFIXES:
        with zipfile.ZipFile(path) as archive:
            bad = archive.testzip()
        if bad:
            errors.append(f"Office export is corrupt: {path.name} -> {bad}")
    elif path.suffix.lower() in PDF_SUFFIXES and not path.read_bytes().startswith(b"%PDF"):
        errors.append(f"PDF export has invalid header: {path.name}")
    return errors


def smoke_test_manifest(payload, run_started):
    errors = []
    errors.extend(payload.get("missing") or [])
    for rel in EXPECTED_EXPORTS:
        errors.extend(validate_export_file(REPO_ROOT / rel, run_started))
    errors.extend(validate_html_cache_token((payload.get("cacheRefresh") or {}).get("token")))
    errors.extend(validate_current_basis())
    payload["smokeTest"] = {
        "status": "failed" if errors else "success",
        "checkedAt": datetime.now().isoformat(timespec="seconds"),
        "checkedExports": len(EXPECTED_EXPORTS),
        "checkedPages": len(HTML_TARGETS),
        "errors": errors,
    }
    MANIFEST.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    if errors:
        raise RuntimeError("Export refresh smoke test failed:\n- " + "\n- ".join(errors))
    return payload


def write_manifest(trigger, output, cache_refresh=None, run_started=None):
    files = [export_file_info(path) for path in EXPECTED_EXPORTS]
    missing = [item["path"] for item in files if not item["exists"] or item["size"] <= 0]
    payload = {
        "refreshedAt": datetime.now().isoformat(timespec="seconds"),
        "runStartedAt": (run_started or datetime.now()).isoformat(timespec="seconds"),
        "trigger": trigger,
        "status": "success" if not missing else "incomplete",
        "missing": missing,
        "files": files,
        "generator": GENERATOR.relative_to(REPO_ROOT).as_posix(),
        "output": output.strip(),
        "cacheRefresh": cache_refresh or {},
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    if missing:
        raise RuntimeError("Export refresh incomplete. Missing: " + ", ".join(missing))
    return payload


def refresh_exports(trigger="manual"):
    if not GENERATOR.exists():
        raise RuntimeError(f"Export generator not found: {GENERATOR}")
    run_started = datetime.now()
    result = subprocess.run([sys.executable, str(GENERATOR)], cwd=REPO_ROOT, text=True, capture_output=True)
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
    if result.returncode:
        write_manifest(f"{trigger}:failed", output)
        raise RuntimeError(output or "Export refresh failed")
    cache_refresh = refresh_portal_asset_versions()
    manifest = write_manifest(trigger, output, cache_refresh, run_started)
    smoke_test_manifest(manifest, run_started)
    return output or f"Exports refreshed: {manifest['refreshedAt']}"
