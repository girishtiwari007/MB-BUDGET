from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import cgi
import json
import os
import shutil
import stat
import sys
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


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

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

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving MB-BUDGET with upload API on http://127.0.0.1:{port}/")
    server.serve_forever()




