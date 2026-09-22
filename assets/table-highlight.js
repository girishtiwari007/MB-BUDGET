(function () {
  const TABLE_SELECTOR = "table";
  let hoverTable = null;
  let hoverCell = null;
  let pinned = { table: null, cell: null };

  function eachCell(table, fn) {
    Array.from(table.rows || []).forEach((row) => {
      Array.from(row.cells || []).forEach((cell) => fn(cell, row));
    });
  }

  function enable(table) {
    if (!table || table.dataset.highlightReady === "1") return;
    table.dataset.highlightReady = "1";
    table.classList.add("table-highlight-enabled");
    enableSort(table);
  }

  function sortValue(cell) {
    const text = String(cell?.innerText || cell?.textContent || "").replace(/\s+/g, " ").trim();
    const firstLine = String(cell?.innerText || cell?.textContent || "").split(/\n/).map((part) => part.trim()).find(Boolean) || text;
    const numericText = firstLine.replace(/[,%]/g, "").match(/-?\d+(?:\.\d+)?/);
    return {
      raw: text,
      number: numericText ? Number(numericText[0]) : null,
      isPercent: /%/.test(text),
      text: text.toLocaleLowerCase("en-IN")
    };
  }

  function columnType(rows, index) {
    const sample = rows.map((row) => sortValue(row.cells[index])).filter((item) => item.raw);
    if (!sample.length) return "text";
    const numeric = sample.filter((item) => item.number !== null).length;
    const percent = sample.filter((item) => item.isPercent).length;
    if (percent >= Math.ceil(sample.length * 0.45)) return "percent";
    if (numeric >= Math.ceil(sample.length * 0.55)) return "number";
    return "text";
  }

  function isFixedSummaryRow(row) {
    const first = String(row.cells?.[0]?.innerText || row.cells?.[0]?.textContent || "").trim().toLowerCase();
    return first === "total" || first === "grand total" || row.classList.contains("total") || row.classList.contains("total-row");
  }

  function clearSortState(table) {
    table.querySelectorAll("th.table-sort-active").forEach((th) => {
      th.classList.remove("table-sort-active", "table-sort-asc", "table-sort-desc");
      th.removeAttribute("aria-sort");
    });
  }

  function sortTable(table, header) {
    const tbody = table.tBodies?.[0];
    if (!tbody || !header) return;
    const index = header.cellIndex;
    if (index < 0) return;
    const bodyRows = Array.from(tbody.rows || []).filter((row) => row.cells[index]);
    if (bodyRows.length < 2) return;
    const fixedRows = bodyRows.filter(isFixedSummaryRow);
    const sortableRows = bodyRows.filter((row) => !isFixedSummaryRow(row));
    const type = columnType(sortableRows, index);
    const nextDirection = header.dataset.sortDirection === "asc" ? "desc" : "asc";
    const factor = nextDirection === "asc" ? 1 : -1;
    const decorated = sortableRows.map((row, position) => ({ row, position, value: sortValue(row.cells[index]) }));
    decorated.sort((a, b) => {
      let result = 0;
      if (type === "number" || type === "percent") {
        const av = a.value.number ?? Number.NEGATIVE_INFINITY;
        const bv = b.value.number ?? Number.NEGATIVE_INFINITY;
        result = av === bv ? 0 : av > bv ? 1 : -1;
      } else {
        result = a.value.text.localeCompare(b.value.text, "en-IN", { numeric: true, sensitivity: "base" });
      }
      return result ? result * factor : a.position - b.position;
    });
    clearSortState(table);
    header.dataset.sortDirection = nextDirection;
    header.classList.add("table-sort-active", nextDirection === "asc" ? "table-sort-asc" : "table-sort-desc");
    header.setAttribute("aria-sort", nextDirection === "asc" ? "ascending" : "descending");
    [...decorated.map((item) => item.row), ...fixedRows].forEach((row) => tbody.appendChild(row));
  }

  function enableSort(table) {
    const headerRows = Array.from(table.tHead?.rows || []).filter((row) => row.cells.length);
    const headerRow = headerRows.at(-1) || Array.from(table.rows || []).find((row) => Array.from(row.cells || []).some((cell) => cell.tagName === "TH"));
    if (!headerRow) return;
    Array.from(headerRow.cells || []).forEach((cell) => {
      if (cell.dataset.sortReady === "1" || cell.colSpan > 1) return;
      cell.dataset.sortReady = "1";
      cell.classList.add("table-sortable");
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.setAttribute("title", "Click to sort this column");
    });
  }

  function enableAll(root = document) {
    root.querySelectorAll(TABLE_SELECTOR).forEach(enable);
  }

  function clearHover() {
    if (!hoverTable) return;
    Array.from(hoverTable.rows || []).forEach((row) => row.classList.remove("table-hover-row"));
    eachCell(hoverTable, (cell) => cell.classList.remove("table-hover-col", "table-hover-cell"));
    hoverTable = null;
    hoverCell = null;
  }

  function clearPinned() {
    if (!pinned.table) return;
    Array.from(pinned.table.rows || []).forEach((row) => row.classList.remove("table-pinned-row"));
    eachCell(pinned.table, (cell) => cell.classList.remove("table-pinned-col", "table-pinned-cell"));
    pinned = { table: null, cell: null };
  }

  function mark(table, cell, mode) {
    if (!table || !cell) return;
    const rowClass = mode === "pin" ? "table-pinned-row" : "table-hover-row";
    const colClass = mode === "pin" ? "table-pinned-col" : "table-hover-col";
    const cellClass = mode === "pin" ? "table-pinned-cell" : "table-hover-cell";
    const index = cell.cellIndex;
    cell.parentElement?.classList.add(rowClass);
    Array.from(table.rows || []).forEach((row) => {
      const target = row.cells[index];
      if (target) target.classList.add(colClass);
    });
    cell.classList.add(cellClass);
  }

  function cellFromEvent(event) {
    const cell = event.target.closest("td,th");
    if (!cell) return null;
    const table = cell.closest(TABLE_SELECTOR);
    if (!table) return null;
    enable(table);
    return { table, cell };
  }

  function refreshHover(event) {
    const found = cellFromEvent(event);
    if (!found) return;
    if (found.table === hoverTable && found.cell === hoverCell) return;
    clearHover();
    hoverTable = found.table;
    hoverCell = found.cell;
    mark(found.table, found.cell, "hover");
  }

  document.addEventListener("pointerover", refreshHover, true);
  document.addEventListener("pointerout", (event) => {
    if (!hoverTable) return;
    const next = event.relatedTarget;
    if (next && hoverTable.contains(next)) return;
    clearHover();
  }, true);

  document.addEventListener("click", (event) => {
    const sortHeader = event.target.closest("th.table-sortable");
    if (sortHeader) {
      const table = sortHeader.closest(TABLE_SELECTOR);
      sortTable(table, sortHeader);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target.closest("button,a,input,select,textarea,label")) return;
    const found = cellFromEvent(event);
    if (!found) {
      clearPinned();
      return;
    }
    clearPinned();
    pinned = found;
    mark(found.table, found.cell, "pin");
  }, true);

  document.addEventListener("keydown", (event) => {
    const sortHeader = event.target.closest?.("th.table-sortable");
    if (sortHeader && (event.key === "Enter" || event.key === " ")) {
      sortTable(sortHeader.closest(TABLE_SELECTOR), sortHeader);
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      clearHover();
      clearPinned();
    }
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.(TABLE_SELECTOR)) enable(node);
        enableAll(node);
      });
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      enableAll();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    enableAll();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
