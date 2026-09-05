const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['data/current_payload.js', 'data/reports-data.js', 'assets/period-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const { BudgetPeriods: api, CURRENT_PAYLOAD: source, REPORTS_DATA: reports } = context.window;
const before = JSON.stringify(source);
const completed = api.build(source, reports, api.period('AUG 2026'));
const running = api.build(source, reports, api.period('SEP 2026'));
const total = (view, key) => view[key].rows.find(row => row.Name === 'Total');
assert.equal(total(completed, 'demand').BP, total(completed, 'demand').OBA / 12 * 5);
assert.equal(total(running, 'demand').BP, total(running, 'demand').OBA / 12 * 6);
assert.equal(completed.demand_prev.rows.find(row => row.Name === 'Demand 03 / 01').AEPrevious, 267838);
assert.equal(total(completed, 'pu_prev').AE ?? total(completed, 'pu_prev').AECurrent,
  total(completed, 'staff').AE + total(completed, 'nonstaff').AE);
assert.equal(total(completed, 'demand_prev').AE ?? total(completed, 'demand_prev').AECurrent,
  total(completed, 'demand').AE);
assert.equal(api.relabel('BG_ISL 2026-27; RG 2025-26; Actuals up to JUL 2026', api.period('SEP 2026')),
  'BG_ISL 2026-27; RG 2025-26; Actuals up to SEP 2026');
// Prefer a valid exact-year zero over an older alias; distinguish absent data from zero.
const fixture = { monthly: { demand: {
  'Demand 03 / 01': { '2026-27': [0, 0] },
  'Demand 03 / SMH 01': { '2026-27': [99], '2025-26': [10, 20] }
} } };
assert.equal(api.actual(fixture, 'demand', 'Demand 03 / 01', '2026-27', 2), 0);
assert.equal(api.actual(fixture, 'demand', 'Demand 03 / 01', '2025-26', 2), 30);
assert.equal(api.actual(fixture, 'demand', 'Demand 03 / 01', '2024-25', 2), null);
for (const view of [completed, running]) {
  for (const key of Object.keys(view)) {
    const rows = view[key].rows;
    if (!rows) continue;
    const normal = rows.filter(row => row.Name !== 'Total' && !/12N|10N/.test(row.Name));
    const metric = key.endsWith('_prev') ? 'AECurrent' : 'AE';
    assert.equal(total(view, key)[metric], normal.reduce((sum, row) => sum + row[metric], 0));
    for (const row of rows) {
      assert.equal(row.BP, row.OBA / 12 * row.Months);
      assert.equal(row.Remaining, row.OBA - row[metric]);
    }
  }
}
assert.equal(JSON.stringify(source), before, 'Period views must not mutate source data');
console.log('PASS: separate periods, prior-year aliases, totals, rounding consistency, labels, zero handling and source immutability');
