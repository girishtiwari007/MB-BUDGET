import json
import re
import zipfile
from copy import deepcopy
from html import escape
from pathlib import Path
from xml.sax.saxutils import escape as xesc

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "exports"
CURRENT_PPTX = OUT / "Moradabad_Division_Current_Year_Budget_Analysis.pptx"
PPTX = OUT / "Moradabad_Division_DRM_Budget_FR_Analysis.pptx"
XLSX = OUT / "Moradabad_Division_DRM_Budget_FR_Analysis.xlsx"
TEMPLATE_PPTX = Path(r"C:\Users\HP\Dropbox\Revenue PU Laibilities\PPT PORTAL\Moradabad Division Quarty FR and Revenue Budget Analysis DRM.pptx")
SLIDE_W, SLIDE_H = 12192000, 6858000
BLUE = "1F4E79"
NAVY = "003366"
LIGHT = "E8F2F8"
YELLOW = "FFF2CC"
WHITE = "FFFFFF"
BLACK = "000000"


def load_json_assignment(path, name):
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"{re.escape(name)}\s*=\s*(.*?);?\s*$", text, re.S)
    if not match:
        raise RuntimeError(f"Cannot locate {name} in {path}")
    return json.loads(match.group(1))


def load_fr_data():
    text = (ROOT / "pages" / "fr.html").read_text(encoding="utf-8")
    match = re.search(r"const\s+workbookData\s*=\s*(\[.*?\]);\s*const\s+funds", text, re.S)
    if not match:
        raise RuntimeError("Cannot locate FR workbookData")
    return json.loads(match.group(1))


def inr(value, decimals=0):
    try:
        n = float(value or 0)
    except Exception:
        return ""
    return f"{n:,.{decimals}f}" if decimals else f"{round(n):,}"


def money(value):
    try:
        n = float(value or 0)
    except Exception:
        n = 0
    return f"{inr(n)}\nCr. {n / 10000:.2f}"


def pct(value):
    try:
        return f"{round(float(value or 0))}"
    except Exception:
        return "0"


def row_name(row):
    return row.get("Name") or row.get("PU") or row.get("Demand") or ""


def is_total(row):
    return row_name(row).strip().lower() == "total"


def number_value(value):
    try:
        return float(value or 0)
    except Exception:
        return 0


def code_from_label(label, prefix):
    match = re.search(rf"{re.escape(prefix)}\s*-\s*([0-9A-Z]+)", str(label or ""), re.I)
    return match.group(1).upper() if match else ""


def demand_key(label):
    match = re.search(r"Demand\s+([0-9A-Z]+)", str(label or ""), re.I)
    return match.group(1).upper() if match else ""


def is_demand_suspense(row):
    name = row_name(row).upper()
    department = str(row.get("Department") or "").upper()
    return bool(re.search(r"\b(12N|10N)\b", name)) or "SUSPENSE" in department


def detail_rows(rows):
    return [row for row in rows or [] if not is_total(row)]


def normal_total_rows(rows):
    return [row for row in detail_rows(rows) if not is_demand_suspense(row)]


def demand_suspense_rows(rows):
    return [row for row in detail_rows(rows) if is_demand_suspense(row)]


def latest_report_year(reports, offset=0):
    years = reports.get("years") or []
    idx = max(0, len(years) - 1 - offset)
    return (years[idx] or {}).get("fy", "")


def match_monthly_key(scope, label, bucket):
    keys = list((bucket or {}).keys())
    if label in bucket:
        return label
    if scope == "pu":
        code = code_from_label(label, "PU")
        return next((key for key in keys if code_from_label(key, "PU") == code), "")
    if scope == "demand":
        demand = demand_key(label)
        smh_match = re.search(r"/\s*([0-9A-Z]+)", str(label or ""), re.I)
        smh = smh_match.group(1).upper() if smh_match else ""
        return next((key for key in keys if demand_key(key) == demand and (not smh or f"SMH {smh}" in key.upper())), "")
    return next((key for key in keys if key == label), "")


def month_actual(reports, scope, label, fy, count):
    bucket = ((reports.get("monthly") or {}).get(scope) or {})
    key = match_monthly_key(scope, label, bucket)
    values = (bucket.get(key) or {}).get(fy) if key else None
    if not isinstance(values, list):
        return None
    return sum(number_value(value) for value in values[:count])


def relabel_period(text, month="JUN", year=2026, count=3):
    label = f"{month} {year}"
    return (str(text or "")
        .replace("JUL 2026", label)
        .replace("JUL 2025", f"{month} 2025")
        .replace("/ 12 * 4", f"/ 12 * {count}")
        .replace("BP UPTO JUL 2026", f"BP UPTO {label}"))


def summary_row(label, oba, ae, months=3, bp_override=None):
    bp = number_value(bp_override) if bp_override is not None else oba / 12 * months
    return {
        "Name": label,
        "OBA": oba,
        "BP": bp,
        "AE": ae,
        "Variation": ae - bp,
        "BPPercent": ae / bp * 100 if bp else 0,
        "Remaining": oba - ae,
        "OBAPercent": ae / oba * 100 if oba else 0,
        "Months": months,
    }


def add_total(rows):
    normal = normal_total_rows(rows)
    suspense = demand_suspense_rows(rows)
    months = number_value((normal[0] if normal else rows[0] if rows else {}).get("Months") or 3)
    oba = sum(number_value(row.get("OBA")) for row in normal)
    ae = sum(number_value(row.get("AE")) for row in normal)
    bp = sum(number_value(row.get("BP")) for row in normal)
    return normal + [summary_row("Total", oba, ae, months, bp)] + suspense


def filtered_pu_rows(rows, codes):
    wanted = {str(code).zfill(2) for code in codes}
    detail = [row for row in detail_rows(rows) if code_from_label(row_name(row), "PU").zfill(2) in wanted]
    return add_total(detail)


def apply_completed_period(payload):
    reports = json.loads((ROOT / "data" / "reports-data.json").read_text(encoding="utf-8-sig"))
    fy = latest_report_year(reports)
    view = deepcopy(payload)
    period = {"month": "JUN", "year": 2026, "count": 3, "label": "JUN 2026"}
    for key in ("demand", "staff", "nonstaff"):
        tab = view.get(key)
        if not tab or not tab.get("rows"):
            continue
        scope = "demand" if key == "demand" else "pu"
        rows = []
        for row in detail_rows(tab["rows"]):
            next_row = dict(row)
            actual = month_actual(reports, scope, row_name(row), fy, period["count"])
            if actual is not None:
                next_row["AE"] = actual
            next_row["Months"] = period["count"]
            next_row["BP"] = number_value(next_row.get("OBA")) / 12 * period["count"]
            next_row["Variation"] = number_value(next_row.get("AE")) - number_value(next_row.get("BP"))
            next_row["BPPercent"] = number_value(next_row.get("AE")) / number_value(next_row.get("BP")) * 100 if number_value(next_row.get("BP")) else 0
            next_row["Remaining"] = number_value(next_row.get("OBA")) - number_value(next_row.get("AE"))
            next_row["OBAPercent"] = number_value(next_row.get("AE")) / number_value(next_row.get("OBA")) * 100 if number_value(next_row.get("OBA")) else 0
            rows.append(next_row)
        tab["columns"] = [{**col, "label": relabel_period(col.get("label"), period["month"], period["year"], period["count"])} for col in tab.get("columns", [])]
        tab["title"] = f'{tab.get("title", "")} - Completed Month Projection - June 2026 (03 months)'
        tab["rows"] = add_total(rows)
    return view


def utilization_dot(value):
    try:
        v = float(value or 0)
    except Exception:
        v = 0
    if v >= 100:
        return "🔴"
    if v >= 75:
        return "🟠"
    return "🟢"


def display_cell(row, col):
    key, fmt = col["key"], col.get("format")
    val = row.get(key, "")
    if fmt == "money":
        return money(val)
    if key in ("BPPercent", "OBAPercent"):
        return f"{pct(val)} {utilization_dot(val)}"
    if fmt == "int":
        return pct(val)
    return str(val)


def table_from_payload(tab, columns=None, rows=None):
    columns = columns or tab["columns"]
    rows = rows or tab["rows"]
    headers = [c["label"] for c in columns]
    body = [[display_cell(r, c) for c in columns] for r in rows]
    return headers, body


def fr_report_table(sheet):
    headers = ["Plan Head", "Plan Head Name", "SBA 2026-27", "AE", "Variation (AE - SBA)", "% SBA"]
    body = []
    for rec in sheet["records"] + [sheet["total"]]:
        total = rec["funds"]["TOTAL"]
        body.append([
            rec.get("planHead") or "Total",
            rec.get("planName") or "",
            money(total["sba"]),
            money(total["ae"]),
            money(total["ae"] - total["sba"]),
            f"{total.get('spentPct', 0):.2f}",
        ])
    return headers, body


def fr_fund_table(sheet):
    headers = ["Fund", "SBA", "AE", "Available", "Expensed %", "Remaining %"]
    body = []
    for fund, values in sheet["fundAnalysis"].items():
        body.append([fund, money(values["sba"]), money(values["ae"]), money(values["available"]), f"{values.get('spentPct',0):.2f}", f"{values.get('remainPct',0):.2f}"])
    return headers, body


def style_ws(ws):
    black = Side(style="thin", color="000000")
    border = Border(left=black, right=black, top=black, bottom=black)
    for row in ws.iter_rows():
        for cell in row:
            cell.border = border
            cell.alignment = Alignment(wrap_text=True, vertical="center")
            cell.font = Font(name="Times New Roman", size=10)
            if cell.row == 1:
                cell.font = Font(name="Times New Roman", size=14, bold=True, color=BLUE)
            elif cell.row == 2:
                cell.font = Font(name="Times New Roman", size=10, bold=True, color="607080")
            elif cell.row == 4:
                cell.fill = PatternFill("solid", fgColor=BLUE)
                cell.font = Font(name="Times New Roman", size=10, bold=True, color=WHITE)
            elif cell.row % 2 == 0 and cell.row > 4:
                cell.fill = PatternFill("solid", fgColor=LIGHT)
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        width = max(len(str(c.value or "").split("\n")[0]) for c in col) + 3
        ws.column_dimensions[letter].width = min(max(width, 10), 28)
    ws.page_margins.left = ws.page_margins.right = ws.page_margins.top = ws.page_margins.bottom = 0.25
    ws.page_setup.orientation = "landscape"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1


def write_excel(sections):
    wb = Workbook()
    wb.remove(wb.active)
    for title, headers, body in sections:
        ws = wb.create_sheet(re.sub(r"[\\/?*\[\]:]", " ", title)[:31])
        ws.append([title])
        ws.append(["Figures in '000 with Crore shown below. Generated from latest portal data."])
        ws.append([])
        ws.append(headers)
        for row in body:
            ws.append(row)
        style_ws(ws)
    wb.save(XLSX)


def clean_text(value):
    text = str(value if value is not None else "")
    replacements = {"\u2013": "-", "\u2014": "-", "\u2011": "-", "\u00a0": " "}
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return "".join(ch if ch == "\n" or 32 <= ord(ch) <= 126 else " " for ch in text)


def text_runs(text, size=900, bold=False, color=BLACK):
    bold_attr = ' b="1"' if bold else ""
    runs = []
    for idx, part in enumerate(clean_text(text).split("\n")):
        if idx:
            runs.append("<a:br/>")
        runs.append(f'<a:r><a:rPr lang="en-US" sz="{size}"{bold_attr}><a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:latin typeface="Times New Roman"/></a:rPr><a:t>{xesc(part)}</a:t></a:r>')
    return "".join(runs)


def ppt_text_box(shape_id, x, y, w, h, text, size=1200, bold=False, fill=None, color=BLACK, align="ctr"):
    fill_xml = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>' if fill else "<a:noFill/>"
    return f'''<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="Text {shape_id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>{fill_xml}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="50000" rIns="50000" tIns="25000" bIns="25000"/><a:lstStyle/><a:p><a:pPr algn="{align}"/>{text_runs(text, size, bold, color)}</a:p></p:txBody></p:sp>'''


def tc_pr(fill):
    border = f'<a:solidFill><a:srgbClr val="{BLACK}"/></a:solidFill>'
    lines = "".join(f'<a:ln{side} w="12700">{border}</a:ln{side}>' for side in ["L", "R", "T", "B"])
    return f'<a:tcPr marL="12000" marR="12000" marT="8000" marB="8000"><a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>{lines}</a:tcPr>'


def table_cell(text, fill, size, bold=False, color=BLACK, align="ctr"):
    anchor = "ctr"
    return f'''<a:tc><a:txBody><a:bodyPr wrap="square" anchor="{anchor}"/><a:lstStyle/><a:p><a:pPr algn="{align}"/>{text_runs(text, size, bold, color)}</a:p></a:txBody>{tc_pr(fill)}</a:tc>'''


def column_weights(headers):
    weights = []
    has_department = len(headers) > 1 and "department" in clean_text(headers[1]).lower()
    for index, header in enumerate(headers):
        label = clean_text(header).lower()
        if index == 0:
            weights.append(1.35 if has_department else 1.65)
        elif "department" in label or "name" in label:
            weights.append(2.05)
        elif "%" in label or "percent" in label:
            weights.append(0.72)
        elif "variation" in label or "remaining" in label:
            weights.append(1.18)
        elif "oba" in label or "bp" in label or "actual" in label or "ae" in label or "sba" in label:
            weights.append(1.08)
        else:
            weights.append(1.05)
    total = sum(weights) or 1
    return [weight / total for weight in weights]


def ppt_table(shape_id, x, y, w, h, headers, rows):
    col_count = len(headers)
    row_count = len(rows) + 1
    row_h = int(h / max(row_count, 1))
    header_size = 820 if col_count <= 8 else (760 if col_count <= 9 else 620)
    if col_count <= 8:
        body_size = 780 if len(rows) <= 10 else 710
    elif col_count <= 9:
        body_size = 710 if len(rows) <= 13 else 640
    else:
        body_size = 560
    col_widths = [int(w * weight) for weight in column_weights(headers)]
    col_widths[-1] += int(w) - sum(col_widths)
    grid = "".join(f'<a:gridCol w="{col_w}"/>' for col_w in col_widths)
    trs = [
        f'<a:tr h="{row_h}">' + "".join(table_cell(head, BLUE, header_size, True, WHITE, "ctr") for head in headers) + "</a:tr>"
    ]
    for r_idx, row in enumerate(rows):
        first = clean_text(row[0]).strip().lower() if row else ""
        fill = "C8D6E8" if first == "total" else ("D9EAF7" if r_idx % 2 else WHITE)
        cells = []
        for c_idx, value in enumerate(row):
            align = "l" if c_idx == 1 and ("department" in clean_text(headers[c_idx]).lower() or "name" in clean_text(headers[c_idx]).lower()) else "ctr"
            bold = first == "total" or c_idx in (0, col_count - 1)
            size = body_size + 120 if first == "total" and col_count <= 9 else body_size
            cells.append(table_cell(value, fill, size, bold, BLACK, align))
        trs.append(f'<a:tr h="{row_h}">' + "".join(cells) + "</a:tr>")
    return f'''<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{shape_id}" name="Table {shape_id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{{5940675A-B579-460E-94D1-54222C63F5DA}}</a:tableStyleId></a:tblPr><a:tblGrid>{grid}</a:tblGrid>{''.join(trs)}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>'''


def editable_slide_xml(title, subtitle="", headers=None, rows=None):
    shapes = [
        ppt_text_box(2, 220000, 70000, SLIDE_W - 440000, 360000, title, 1760, True, None, "22A7D8"),
    ]
    if subtitle:
        shapes.append(ppt_text_box(3, 220000, 450000, SLIDE_W - 440000, 230000, subtitle, 860, False, None, BLACK, "r"))
    if headers and rows is not None:
        shapes.append(ppt_table(4, 220000, 720000, SLIDE_W - 440000, SLIDE_H - 960000, headers, rows))
    sp_tree = "".join(shapes)
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>{sp_tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''


def split_section(title, headers, rows):
    slides = []
    col_count = len(headers)
    if col_count <= 6:
        max_rows = 16
    elif col_count <= 9:
        max_rows = 13
    else:
        max_rows = 10
    for r_idx in range(0, len(rows), max_rows):
        part_rows = rows[r_idx:r_idx + max_rows]
        slide_title = title if len(rows) <= max_rows else f"{title} (Rows {r_idx + 1}-{r_idx + len(part_rows)})"
        slides.append(editable_slide_xml(slide_title, "Figures in thousands.", headers, part_rows))
    return slides


def build_pptx_from_template(output_path, sections, subtitle):
    if not TEMPLATE_PPTX.exists():
        raise RuntimeError(f"Template PPTX not found: {TEMPLATE_PPTX}")
    slides = [editable_slide_xml("Moradabad Division", subtitle)]
    for title, headers, rows in sections:
        slides.extend(split_section(title, headers, rows))
    with zipfile.ZipFile(TEMPLATE_PPTX, "r") as src:
        content = src.read("[Content_Types].xml").decode("utf-8")
        pres = src.read("ppt/presentation.xml").decode("utf-8")
        pres_rels = src.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
        slide_rel = src.read("ppt/slides/_rels/slide1.xml.rels")
        content = re.sub(r'<Override PartName="/ppt/slides/slide\d+\.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide\+xml"/>', "", content)
        slide_overrides = "".join(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(1, len(slides) + 1))
        content = content.replace("</Types>", f"{slide_overrides}</Types>")
        sld_ids = "".join(f'<p:sldId id="{255 + i}" r:id="rId{i + 1}"/>' for i in range(1, len(slides) + 1))
        pres = re.sub(r"<p:sldIdLst>.*?</p:sldIdLst>", f"<p:sldIdLst>{sld_ids}</p:sldIdLst>", pres, flags=re.S)
        pres_rels = re.sub(r'<Relationship Id="rId\d+" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide\d+\.xml"/>', "", pres_rels)
        slide_rels = "".join(f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>' for i in range(1, len(slides) + 1))
        pres_rels = pres_rels.replace("</Relationships>", f"{slide_rels}</Relationships>")
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as dst:
            for item in src.infolist():
                name = item.filename
                if name == "[Content_Types].xml" or name in {"ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"}:
                    continue
                if re.match(r"ppt/slides/(?:_rels/)?slide\d+\.xml(?:\.rels)?$", name):
                    continue
                dst.writestr(item, src.read(name))
            dst.writestr("[Content_Types].xml", content)
            dst.writestr("ppt/presentation.xml", pres)
            dst.writestr("ppt/_rels/presentation.xml.rels", pres_rels)
            for i, xml in enumerate(slides, 1):
                dst.writestr(f"ppt/slides/slide{i}.xml", xml)
                dst.writestr(f"ppt/slides/_rels/slide{i}.xml.rels", slide_rel)


def build():
    payload = apply_completed_period(load_json_assignment(ROOT / "data" / "current_payload.js", "window.CURRENT_PAYLOAD"))
    fr = load_fr_data()
    demand_cols = payload["demand"]["columns"]
    staff_cols = payload["staff"]["columns"]
    nonstaff_cols = payload["nonstaff"]["columns"]
    current_sections = [
        ("Demand SMH Wise", *table_from_payload(payload["demand"], demand_cols, payload["demand"]["rows"])),
        ("PU Staff Current Year", *table_from_payload(payload["staff"], staff_cols, payload["staff"]["rows"])),
        ("PU Non Staff Current Year", *table_from_payload(payload["nonstaff"], nonstaff_cols, payload["nonstaff"]["rows"])),
        ("PU Previous Year Comparison", *table_from_payload(payload["pu_prev"])),
        ("Demand Previous Year Comparison", *table_from_payload(payload["demand_prev"])),
    ]
    drm_staff_rows = filtered_pu_rows(payload["staff"]["rows"], ["01", "02", "03", "04", "07", "10", "11", "12", "13", "15", "16", "25"])
    drm_nonstaff_rows = filtered_pu_rows(payload["nonstaff"]["rows"], ["27", "28", "30", "32", "60"])
    drm_sections = [
        ("Demand SMH Wise", *table_from_payload(payload["demand"], demand_cols, payload["demand"]["rows"])),
        ("PU Wise - Staff", *table_from_payload(payload["staff"], staff_cols, drm_staff_rows)),
        ("PU Wise - Non-Staff Part 1", *table_from_payload(payload["nonstaff"], nonstaff_cols, drm_nonstaff_rows)),
        ("Open Line FR Report", *fr_report_table(fr[0])),
        ("Open Line FR Fund Wise", *fr_fund_table(fr[0])),
    ]
    write_excel(drm_sections)
    build_pptx_from_template(CURRENT_PPTX, current_sections, "Accounts Dept | FY 2026-2027 | Current / Previous Year Budget Analysis | Completed JUN 2026")
    build_pptx_from_template(PPTX, drm_sections, "Accounts Dept | FY 2026-2027 | DRM Budget & FR Analysis | Completed JUN 2026")
    for path in (CURRENT_PPTX, PPTX):
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            assert "ppt/presentation.xml" in z.namelist()
    print(f"Generated {XLSX}")
    print(f"Generated {CURRENT_PPTX}")
    print(f"Generated {PPTX}")


if __name__ == "__main__":
    build()
