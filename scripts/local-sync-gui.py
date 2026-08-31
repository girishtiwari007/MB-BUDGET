from pathlib import Path
import importlib.util
import json
import subprocess
import sys
import threading
import tkinter as tk
import zipfile
from tkinter import filedialog, messagebox, ttk


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BROWSE_ROOT = Path.home()


def load_current_sync():
    module_path = REPO_ROOT / "scripts" / "sync-current-year-data.py"
    spec = importlib.util.spec_from_file_location("sync_current_year_data", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LocalSyncApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("MB-BUDGET Local Data Sync")
        self.geometry("880x620")
        self.minsize(760, 520)
        self.current_folder = tk.StringVar(value="")
        self.fr_file = tk.StringVar(value="")
        self.status = tk.StringVar(value="Ready. Choose a current-year folder or FR file; sync starts automatically.")
        self._build()

    def _build(self):
        self.columnconfigure(0, weight=1)
        self.rowconfigure(4, weight=1)
        header = ttk.Frame(self, padding=14)
        header.grid(row=0, column=0, sticky="ew")
        ttk.Label(header, text="MB-BUDGET Local Data Sync", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(header, text="Updates repository data, simulates calculations, and refreshes Excel/PDF/PPTX exports after every successful sync.").pack(anchor="w", pady=(4, 0))

        current = ttk.LabelFrame(self, text="Current Year Data - 2026-2027", padding=12)
        current.grid(row=1, column=0, sticky="ew", padx=14, pady=8)
        current.columnconfigure(1, weight=1)
        ttk.Label(current, text="Folder containing six portal files").grid(row=0, column=0, sticky="w")
        ttk.Entry(current, textvariable=self.current_folder).grid(row=0, column=1, sticky="ew", padx=8)
        ttk.Button(current, text="Choose Folder", command=self.choose_current_folder).grid(row=0, column=2, padx=(0, 8))
        ttk.Button(current, text="Re-sync Current Year", command=self.sync_current).grid(row=0, column=3)

        fr = ttk.LabelFrame(self, text="FR Budget Status", padding=12)
        fr.grid(row=2, column=0, sticky="ew", padx=14, pady=8)
        fr.columnconfigure(1, weight=1)
        ttk.Label(fr, text="FR Excel file").grid(row=0, column=0, sticky="w")
        ttk.Entry(fr, textvariable=self.fr_file).grid(row=0, column=1, sticky="ew", padx=8)
        ttk.Button(fr, text="Choose FR File", command=self.choose_fr_file).grid(row=0, column=2, padx=(0, 8))
        ttk.Button(fr, text="Re-sync FR", command=self.sync_fr).grid(row=0, column=3)

        actions = ttk.Frame(self, padding=(14, 4))
        actions.grid(row=3, column=0, sticky="ew")
        ttk.Button(actions, text="Re-sync Selected Data + Simulate", command=self.sync_selected_and_simulate).pack(side="left")
        ttk.Button(actions, text="Refresh Existing Exports Only", command=self.refresh_exports).pack(side="left", padx=(8, 0))
        ttk.Button(actions, text="Open Local Portal", command=self.open_portal).pack(side="left", padx=8)
        ttk.Label(actions, textvariable=self.status).pack(side="left", padx=12)

        log_frame = ttk.LabelFrame(self, text="Sync Log", padding=10)
        log_frame.grid(row=4, column=0, sticky="nsew", padx=14, pady=(8, 14))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        self.log = tk.Text(log_frame, wrap="word", font=("Consolas", 10))
        self.log.grid(row=0, column=0, sticky="nsew")
        scroll = ttk.Scrollbar(log_frame, command=self.log.yview)
        scroll.grid(row=0, column=1, sticky="ns")
        self.log.configure(yscrollcommand=scroll.set)
        self.write("Ready. This local GUI is the supported write/update path; GitHub Pages remains read-only.")
        self.write("No folder is fixed in the app. Use Choose Folder or Choose FR File to locate the latest source data.")
        self.write("After selection, sync starts automatically and refreshes portal data, calculations, views and all exports.")

    def write(self, text):
        self.log.insert("end", text.rstrip() + "\n")
        self.log.see("end")
        self.update_idletasks()

    def choose_current_folder(self):
        folder = filedialog.askdirectory(initialdir=self.current_folder.get() or str(DEFAULT_BROWSE_ROOT), title="Choose folder with current-year files")
        if folder:
            self.current_folder.set(folder)
            self.write(f"Selected current-year folder: {folder}")
            self.sync_current()

    def choose_fr_file(self):
        file_path = filedialog.askopenfilename(initialdir=str(DEFAULT_BROWSE_ROOT), title="Choose FR file", filetypes=[("Excel files", "*.xls *.xlsx"), ("All files", "*.*")])
        if file_path:
            self.fr_file.set(file_path)
            self.write(f"Selected FR file: {file_path}")
            self.sync_fr()

    def run_background(self, label, worker):
        def wrapped():
            self.status.set(label)
            self.write("")
            self.write(label)
            try:
                output = worker()
                if output:
                    self.write(str(output))
                self.write(self.validation_summary())
                self.status.set("Done.")
                messagebox.showinfo("MB-BUDGET Local Sync", "Completed successfully.")
            except Exception as exc:
                self.status.set("Failed.")
                self.write("ERROR: " + str(exc))
                messagebox.showerror("MB-BUDGET Local Sync", str(exc))
        threading.Thread(target=wrapped, daemon=True).start()

    def sync_current(self):
        if not self.current_folder.get().strip():
            messagebox.showwarning("Choose folder", "Please choose the current-year data folder first.")
            return
        folder = Path(self.current_folder.get()).resolve()
        if not folder.exists():
            messagebox.showwarning("Folder not found", "Please choose a valid current-year data folder.")
            return
        self.run_background("Syncing current-year files, rebuilding payload, and refreshing exports...", lambda: load_current_sync().sync_current_year(folder))

    def sync_fr(self):
        file_path = Path(self.fr_file.get()).resolve()
        if not file_path.exists():
            messagebox.showwarning("Select FR file", "Please select a valid FR Excel file first.")
            return
        def worker():
            result = subprocess.run([sys.executable, str(REPO_ROOT / "scripts" / "sync-fr-data.py"), str(file_path), file_path.name], cwd=REPO_ROOT, text=True, capture_output=True)
            if result.returncode:
                raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "FR sync failed")
            return result.stdout.strip()
        self.run_background("Syncing FR file and refreshing exports...", worker)

    def sync_selected_and_simulate(self):
        folder_text = self.current_folder.get().strip()
        fr_text = self.fr_file.get().strip()
        if not folder_text and not fr_text:
            messagebox.showwarning("Select data", "Choose a current-year folder and/or FR file first.")
            return

        def worker():
            messages = []
            if folder_text:
                folder = Path(folder_text).resolve()
                if not folder.exists():
                    raise RuntimeError(f"Current-year folder not found: {folder}")
                messages.append("Current-year sync:")
                messages.append(str(load_current_sync().sync_current_year(folder)))
            if fr_text:
                file_path = Path(fr_text).resolve()
                if not file_path.exists():
                    raise RuntimeError(f"FR file not found: {file_path}")
                result = subprocess.run([sys.executable, str(REPO_ROOT / "scripts" / "sync-fr-data.py"), str(file_path), file_path.name], cwd=REPO_ROOT, text=True, capture_output=True)
                if result.returncode:
                    raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "FR sync failed")
                messages.append("FR sync:")
                messages.append(result.stdout.strip())
            return "\n\n".join(messages)

        self.run_background("Syncing selected data and simulating portal/export refresh...", worker)

    def refresh_exports(self):
        def worker():
            from export_refresh import refresh_exports
            return refresh_exports("local-sync-gui-simulation")
        self.run_background("Running calculation/export simulation...", worker)

    def validation_summary(self):
        lines = ["", "Portal refresh validation:"]
        current_manifest = REPO_ROOT / "data" / "source-files" / "2026-2027" / "upload-manifest.json"
        fr_manifest = REPO_ROOT / "data" / "fr" / "fr-upload-manifest.json"
        export_manifest = REPO_ROOT / "data" / "export-refresh-manifest.json"
        if current_manifest.exists():
            payload = json.loads(current_manifest.read_text(encoding="utf-8"))
            lines.append(f"- Current year as on: {payload.get('statusAsOn') or payload.get('uploadedAt')}")
            lines.append(f"- Completed month: {payload.get('completedMonth')} | Running month: {payload.get('runningMonth')}")
            lines.append(f"- Current source folder: {payload.get('sourceFolder')}")
        else:
            lines.append("- Current year manifest missing.")
        if fr_manifest.exists():
            payload = json.loads(fr_manifest.read_text(encoding="utf-8"))
            lines.append(f"- FR source: {payload.get('originalName')} | Data as on: {payload.get('dataAsOn') or payload.get('uploadedAt')}")
        else:
            lines.append("- FR manifest missing.")
        if export_manifest.exists():
            payload = json.loads(export_manifest.read_text(encoding="utf-8"))
            missing = payload.get("missing") or []
            lines.append(f"- Export refresh: {payload.get('status')} | Trigger: {payload.get('trigger')} | Missing: {len(missing)}")
            checked = 0
            for item in payload.get("files", []):
                path = REPO_ROOT / item.get("path", "")
                if path.suffix.lower() in {".xlsx", ".pptx"} and path.exists():
                    with zipfile.ZipFile(path) as archive:
                        bad = archive.testzip()
                    if bad:
                        raise RuntimeError(f"Export integrity failed: {path.name} -> {bad}")
                    checked += 1
            lines.append(f"- Office export integrity checked: {checked} files OK")
        else:
            lines.append("- Export refresh manifest missing.")
        return "\n".join(lines)

    def open_portal(self):
        self.write("Open the portal from local server: http://127.0.0.1:8000/")
        self.write("If it is not running, start: py -3 scripts\\local-upload-server.py 8000")


if __name__ == "__main__":
    LocalSyncApp().mainloop()
