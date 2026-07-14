from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import cgi
import json
import os
import shutil
import stat
import sys
import zipfile
from io import BytesIO
from datetime import datetime

REPO_ROOT = Path(__file__).resolve().parents[1]
ROLE_TARGETS = {
    "currPuBudget": "pu-budget.xls",
    "currPuMonth": "pu-month-actual.xls",
    "currPuDeptDemandSmhBudget": "pu-dept-demand-smh-budget.xls",
    "currPuDeptDemandSmhActual": "pu-dept-demand-smh-actual.xls",
    "currSmhBudget": "demand-smh-budget.xls",
    "currSmhMonth": "demand-smh-actual.xls",
}

FR_UPLOAD_ROOT = REPO_ROOT / "data" / "fr"
FR_TARGET_BASENAME = "FR_Budget_Status"
FR_ALLOWED_EXTENSIONS = {".xls", ".xlsx"}
FR_MANIFEST_NAME = "fr-upload-manifest.json"
UPLOAD_PASSWORD = "Moradabad@2026"
MBRLR_REPO_ROOT = Path(os.environ.get("MBRLR_REPO_ROOT", REPO_ROOT.parent / "MBRLR")).resolve()
MBRLR_SYNC_ROOT = MBRLR_REPO_ROOT / "data" / "mb-budget-sync"
CURRENT_SYNC_YEAR = "2026-2027"
SYNC_CORE_FILES = [
    "current_payload.js",
    "reports-data.js",
    "reports-data.json",
    "year-sources.js",
    "year-sources.json",
    "year-sources.local.js",
    "year-sources.local.json",
]

def safe_year(value):
    year = str(value or "2026-2027").strip()
    if not year.replace("-", "").isdigit() or ".." in year or "/" in year or "\\" in year:
        raise ValueError("Invalid year")
    return year


def remove_readonly(func, path, _exc):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        raise


def keep_two_backups(backups_root):
    if not backups_root.exists():
        return
    backups = sorted([p for p in backups_root.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True)
    for old in backups[2:]:
        shutil.rmtree(old, onerror=remove_readonly)


def fr_target_name(filename):
    ext = Path(str(filename or "")).suffix.lower()
    if ext not in FR_ALLOWED_EXTENSIONS:
        ext = ".xls"
    return f"{FR_TARGET_BASENAME}{ext}"


def fr_backup_listing(backups_root):
    if not backups_root.exists():
        return []
    rows = []
    for backup_dir in sorted([p for p in backups_root.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True)[:2]:
        files = [str(file_path.relative_to(REPO_ROOT)).replace(os.sep, "/") for file_path in sorted(backup_dir.glob(f"{FR_TARGET_BASENAME}.*"))]
        rows.append({"name": backup_dir.name, "files": files})
    return rows


def write_fr_manifest(uploaded_at, active_file, original_name, backup_name):
    manifest = {
        "uploadedAt": uploaded_at,
        "activeFile": str(active_file.relative_to(REPO_ROOT)).replace(os.sep, "/"),
        "originalName": original_name,
        "backup": backup_name,
        "backups": fr_backup_listing(FR_UPLOAD_ROOT / "backups"),
    }
    manifest_path = FR_UPLOAD_ROOT / FR_MANIFEST_NAME
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    return manifest



def rel_repo(path, root=REPO_ROOT):
    return str(path.relative_to(root)).replace(os.sep, "/")


def file_info(path, root=REPO_ROOT):
    stat_result = path.stat()
    return {
        "name": path.name,
        "relativePath": rel_repo(path, root),
        "size": stat_result.st_size,
        "modifiedAt": datetime.fromtimestamp(stat_result.st_mtime).isoformat(timespec="seconds"),
    }


def mbrlr_sync_plan(year=CURRENT_SYNC_YEAR):
    year = safe_year(year)
    source_year_dir = REPO_ROOT / "data" / "source-files" / year
    source_files = []
    if source_year_dir.exists():
        for target_name in ROLE_TARGETS.values():
            file_path = source_year_dir / target_name
            if file_path.exists():
                source_files.append({**file_info(file_path), "targetPath": f"data/mb-budget-sync/source-files/{year}/{file_path.name}"})
    processed_files = []
    for name in SYNC_CORE_FILES:
        file_path = REPO_ROOT / "data" / name
        if file_path.exists():
            processed_files.append({**file_info(file_path), "targetPath": f"data/mb-budget-sync/processed/{file_path.name}"})
    fr_files = []
    fr_manifest = FR_UPLOAD_ROOT / FR_MANIFEST_NAME
    if fr_manifest.exists():
        fr_files.append({**file_info(fr_manifest), "targetPath": f"data/mb-budget-sync/fr/{FR_MANIFEST_NAME}"})
    for fr_file in sorted(FR_UPLOAD_ROOT.glob(f"{FR_TARGET_BASENAME}.*")):
        if fr_file.is_file():
            fr_files.append({**file_info(fr_file), "targetPath": f"data/mb-budget-sync/fr/{fr_file.name}"})
    generated_at = datetime.now().isoformat(timespec="seconds")
    plan = {
        "ok": True,
        "mode": "preview",
        "sourceRepo": str(REPO_ROOT),
        "targetRepo": str(MBRLR_REPO_ROOT),
        "targetFolder": str(MBRLR_SYNC_ROOT),
        "financialYear": year,
        "generatedAt": generated_at,
        "counts": {
            "sourceFiles": len(source_files),
            "processedFiles": len(processed_files),
            "frFiles": len(fr_files),
            "totalFiles": len(source_files) + len(processed_files) + len(fr_files) + 2,
        },
        "sourceFiles": source_files,
        "processedFiles": processed_files,
        "frFiles": fr_files,
        "generatedFiles": [
            {"name": "sync-manifest.json", "targetPath": "data/mb-budget-sync/sync-manifest.json"},
            {"name": "sync-log.json", "targetPath": "data/mb-budget-sync/sync-log.json"},
        ],
        "warnings": [],
    }
    missing_roles = [name for name in ROLE_TARGETS.values() if not (source_year_dir / name).exists()]
    if missing_roles:
        plan["warnings"].append("Missing current-year source files: " + ", ".join(missing_roles))
    if not MBRLR_REPO_ROOT.exists():
        plan["warnings"].append("MBRLR repo folder was not found; confirm path before sync.")
    return plan


def selected_sync_items(plan, selected_targets=None):
    groups = ["sourceFiles", "processedFiles", "frFiles"]
    items = []
    selected = set(selected_targets or [])
    for group in groups:
        for item in plan[group]:
            if not selected or item["targetPath"] in selected:
                items.append(item)
    return items


def copy_mbrlr_sync_files(plan, selected_targets=None):
    target_root = MBRLR_SYNC_ROOT.resolve()
    repo_root = MBRLR_REPO_ROOT.resolve()
    if not repo_root.exists():
        raise ValueError(f"MBRLR repo not found: {repo_root}")
    if repo_root not in target_root.parents:
        raise ValueError("Resolved MBRLR sync folder is outside MBRLR repo")
    for folder_name in ["source-files", "processed", "fr"]:
        folder = target_root / folder_name
        if folder.exists():
            resolved_folder = folder.resolve()
            if target_root not in resolved_folder.parents:
                raise ValueError("Refusing to clean folder outside MBRLR sync root")
            shutil.rmtree(folder, onerror=remove_readonly)
    copied = []
    selected_items = selected_sync_items(plan, selected_targets)
    if not selected_items:
        raise ValueError("No files selected for MBRLR sync")

    def copy_group(items):
        for item in items:
            src = REPO_ROOT / item["relativePath"]
            dest = target_root / item["targetPath"].replace("data/mb-budget-sync/", "")
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            copied.append({"source": item["relativePath"], "target": str(dest.relative_to(repo_root)).replace(os.sep, "/"), "size": dest.stat().st_size})

    copy_group(selected_items)
    manifest = dict(plan)
    manifest["mode"] = "synced"
    manifest["syncedAt"] = datetime.now().isoformat(timespec="seconds")
    manifest["selectedTargets"] = [item["targetPath"] for item in selected_items]
    manifest["copied"] = copied
    manifest_path = target_root / "sync-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    log_path = target_root / "sync-log.json"
    log = []
    if log_path.exists():
        try:
            with log_path.open("r", encoding="utf-8") as handle:
                existing = json.load(handle)
                if isinstance(existing, list):
                    log = existing
        except Exception:
            log = []
    log.insert(0, {
        "syncedAt": manifest["syncedAt"],
        "financialYear": plan["financialYear"],
        "sourceRepo": str(REPO_ROOT),
        "targetRepo": str(MBRLR_REPO_ROOT),
        "copiedFiles": len(copied),
        "selectedFiles": len(selected_items),
        "warnings": plan["warnings"],
    })
    with log_path.open("w", encoding="utf-8") as handle:
        json.dump(log[:20], handle, indent=2)
    return {"ok": True, "mode": "synced", "targetFolder": str(target_root), "selectedFiles": len(selected_items), "copiedFiles": copied, "manifest": str(manifest_path), "log": str(log_path), "warnings": plan["warnings"]}
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path == "/api/current-year-upload":
            self.handle_current_year_upload()
            return
        if self.path == "/api/fr-upload":
            self.handle_fr_upload()
            return
        if self.path == "/api/upload-auth":
            self.handle_upload_auth()
            return
        if self.path == "/api/portal-backup":
            self.handle_portal_backup()
            return
        if self.path == "/api/mbrlr-sync-preview":
            self.handle_mbrlr_sync(confirm=False)
            return
        if self.path == "/api/mbrlr-sync-confirm":
            self.handle_mbrlr_sync(confirm=True)
            return
        self.send_json(404, {"error": "Unknown endpoint"})

    def handle_current_year_upload(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            })
            year = safe_year(form.getfirst("year", "2026-2027"))
            year_dir = (REPO_ROOT / "data" / "source-files" / year).resolve()
            source_root = (REPO_ROOT / "data" / "source-files").resolve()
            if source_root not in year_dir.parents:
                raise ValueError("Resolved year folder is outside data/source-files")
            missing = [role for role in ROLE_TARGETS if role not in form or not getattr(form[role], "filename", "")]
            if missing:
                self.send_json(400, {"error": "Missing upload roles: " + ", ".join(missing)})
                return
            year_dir.mkdir(parents=True, exist_ok=True)
            existing = [year_dir / name for name in ROLE_TARGETS.values() if (year_dir / name).exists()]
            backup_name = ""
            if existing:
                backup_name = datetime.now().strftime("%Y%m%d-%H%M%S")
                backup_dir = year_dir / "backups" / backup_name
                backup_dir.mkdir(parents=True, exist_ok=True)
                for file_path in existing:
                    shutil.copy2(file_path, backup_dir / file_path.name)
            saved = []
            for role, target_name in ROLE_TARGETS.items():
                item = form[role]
                target = year_dir / target_name
                with target.open("wb") as handle:
                    shutil.copyfileobj(item.file, handle)
                saved.append({"role": role, "file": str(target.relative_to(REPO_ROOT)).replace(os.sep, "/")})
            keep_two_backups(year_dir / "backups")
            self.send_json(200, {"ok": True, "year": year, "backup": backup_name, "saved": saved})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})


    def handle_upload_auth(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            })
            if form.getfirst("password", "") != UPLOAD_PASSWORD:
                self.send_json(403, {"error": "Incorrect upload password"})
                return
            self.send_json(200, {"ok": True})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def send_zip(self, filename, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f"attachment; filename={filename}")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_portal_backup(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            })
            if form.getfirst("password", "") != UPLOAD_PASSWORD:
                self.send_json(403, {"error": "Incorrect upload password"})
                return
            excluded_dirs = {".git", "__pycache__"}
            excluded_suffixes = {".pyc"}
            buffer = BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                for file_path in REPO_ROOT.rglob("*"):
                    if not file_path.is_file():
                        continue
                    rel = file_path.relative_to(REPO_ROOT)
                    if any(part in excluded_dirs for part in rel.parts):
                        continue
                    if file_path.suffix.lower() in excluded_suffixes:
                        continue
                    archive.write(file_path, rel.as_posix())
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            self.send_zip(f"MB-BUDGET-portal-backup-{stamp}.zip", buffer.getvalue())
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})
    def handle_fr_upload(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            })
            if form.getfirst("password", "") != UPLOAD_PASSWORD:
                self.send_json(403, {"error": "Incorrect upload password"})
                return
            if "frFile" not in form or not getattr(form["frFile"], "filename", ""):
                self.send_json(400, {"error": "Missing FR upload file"})
                return
            item = form["frFile"]
            target_name = fr_target_name(item.filename)
            FR_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
            resolved_root = FR_UPLOAD_ROOT.resolve()
            data_root = (REPO_ROOT / "data").resolve()
            if data_root not in resolved_root.parents:
                raise ValueError("Resolved FR folder is outside data")

            existing = [p for p in FR_UPLOAD_ROOT.glob(f"{FR_TARGET_BASENAME}.*") if p.is_file()]
            backup_name = ""
            if existing:
                backup_name = datetime.now().strftime("%Y%m%d-%H%M%S")
                backup_dir = FR_UPLOAD_ROOT / "backups" / backup_name
                backup_dir.mkdir(parents=True, exist_ok=True)
                for file_path in existing:
                    shutil.copy2(file_path, backup_dir / file_path.name)
                    file_path.unlink()

            target = FR_UPLOAD_ROOT / target_name
            with target.open("wb") as handle:
                shutil.copyfileobj(item.file, handle)
            keep_two_backups(FR_UPLOAD_ROOT / "backups")
            uploaded_at = datetime.now().isoformat(timespec="seconds")
            manifest = write_fr_manifest(uploaded_at, target, item.filename, backup_name)
            self.send_json(200, {"ok": True, "saved": manifest})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def handle_mbrlr_sync(self, confirm=False):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            })
            if form.getfirst("password", "") != UPLOAD_PASSWORD:
                self.send_json(403, {"error": "Incorrect upload password"})
                return
            year = safe_year(form.getfirst("year", CURRENT_SYNC_YEAR))
            plan = mbrlr_sync_plan(year)
            if not confirm:
                self.send_json(200, plan)
                return
            raw_selected = form.getfirst("selectedTargets", "")
            selected_targets = []
            if raw_selected:
                try:
                    parsed = json.loads(raw_selected)
                    if isinstance(parsed, list):
                        selected_targets = [str(item) for item in parsed]
                except Exception:
                    selected_targets = [item.strip() for item in raw_selected.split(",") if item.strip()]
            result = copy_mbrlr_sync_files(plan, selected_targets)
            self.send_json(200, result)
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})
if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving MB-BUDGET with upload API on http://127.0.0.1:{port}/")
    server.serve_forever()








