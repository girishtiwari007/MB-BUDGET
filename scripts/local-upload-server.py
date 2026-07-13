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
        if self.path != "/api/current-year-upload":
            self.send_json(404, {"error": "Unknown endpoint"})
            return
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


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving MB-BUDGET with upload API on http://127.0.0.1:{port}/")
    server.serve_forever()

