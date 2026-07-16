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
