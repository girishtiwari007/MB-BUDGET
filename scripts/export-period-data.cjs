// Use the same completed-period calculations for saved exports and browser views.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['data/current_payload.js', 'data/reports-data.js', 'assets/period-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const data = context.window;
const period = data.BudgetPeriods.period(data.CURRENT_PAYLOAD_META.completedMonth);
period.title = `Completed Actual Basis - ${period.label} (${String(period.count).padStart(2, '0')} months)`;
process.stdout.write(JSON.stringify(data.BudgetPeriods.build(data.CURRENT_PAYLOAD, data.REPORTS_DATA, period)));
