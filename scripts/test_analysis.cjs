'use strict';

// Independent Python reference values come from scripts/extract_source.py.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { mean, analyze } = require(path.join(root, 'analysis.js'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/data.json'), 'utf8'));
const reference = JSON.parse(fs.readFileSync(path.join(root, 'data/analysis_reference.json'), 'utf8'));
const tolerance = 1e-9;
const close = (a, b, message) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance,
  `${message}: ${a} != ${b}`);

assert.equal(data.models.length, 6);
assert.equal(new Set(data.models.map(model => model.name)).size, 6);
assert.equal(reference.length, 18);
assert.deepEqual(Object.keys(data.models[0].genes), ['HMGCR', 'FDFT1', 'SQLE']);
const count = data.models.reduce((total, model) => total + model.control.length +
  Object.values(model.genes).flat().reduce((n, values) => n + values.length, 0), 0);
assert.equal(count, 126);
assert.equal(data.coverage.reported_measurements, count);
const csv = fs.readFileSync(path.join(root, 'data/colony_measurements.csv'), 'utf8').trim().split(/\r?\n/);
assert.equal(csv.length, 127);
assert.equal(new Set(csv.slice(1).map(row => row.split(',')[0])).size, 126);

const originalData = JSON.stringify(data);
const counts = {};
for (const expected of reference) {
  const model = data.models.find(item => item.name === expected.model);
  assert.ok(model, `Missing model ${expected.model}`);
  assert.equal(model.group, expected.group);
  assert.equal(model.control.length, 3);
  const guides = model.genes[expected.gene];
  assert.deepEqual(guides.map(guide => guide.length), [3, 3]);
  const actual = analyze(model.control, guides, 30);
  close(mean(model.control), expected.control_mean, 'Control mean');
  actual.effects.forEach((effect, i) => close(effect, expected.guide_effects[i], 'Guide effect'));
  close(actual.conservative, expected.all_data_minimum_reduction_pct, 'All-data weaker-guide reduction');
  close(actual.worst, expected.conservative_reduction_pct, 'Omission stress-test reduction');
  assert.equal(actual.scenarios.length, 10);
  actual.scenarios.forEach((scenario, i) => close(scenario.effect,
    Math.min(...expected.scenarios[i].effects), 'Stress-test scenario'));
  assert.equal(actual.status.toLowerCase(), expected.default_classification);
  counts[actual.status] = (counts[actual.status] || 0) + 1;
}
assert.deepEqual(counts, { Shortlist: 12, 'Below threshold': 6 });
assert.equal(JSON.stringify(data), originalData, 'Analysis must not mutate source values');

const mia = data.models.find(model => model.name === 'MiaPaCa-2');
assert.equal(analyze(mia.control, mia.genes.HMGCR, 30).status, 'Shortlist');
assert.equal(analyze(mia.control, mia.genes.HMGCR, 50).status, 'Sensitivity review');
assert.equal(analyze(mia.control, mia.genes.HMGCR, 60).status, 'Below threshold');
const boundary = analyze(mia.control, mia.genes.HMGCR, 30);
assert.equal(analyze(mia.control, mia.genes.HMGCR, boundary.worst).status, 'Shortlist');
assert.equal(analyze(mia.control, mia.genes.HMGCR, boundary.conservative).status, 'Sensitivity review');
assert.equal(analyze(mia.control, mia.genes.HMGCR, boundary.conservative + 1e-6).status, 'Below threshold');

const validControl = [90, 100, 110];
const validGuides = [[30, 40, 50], [40, 50, 60]];
for (const invalidControl of [[], [1, 2], [0, 0, 0], [0, 0, 1], [1, 2, null],
  [1, 2, ''], [1, 2, NaN], [1, 2, Infinity], [1, 2, -1]]) {
  assert.throws(() => analyze(invalidControl, validGuides, 30), 'Invalid control must reject');
}
for (const invalidGuides of [[], [[1, 2, 3]], [[1, 2], [1, 2, 3]],
  [[1, 2, ''], [1, 2, 3]], [[1, 2, NaN], [1, 2, 3]], [[1, 2, -1], [1, 2, 3]]]) {
  assert.throws(() => analyze(validControl, invalidGuides, 30), 'Invalid guide measurements must reject');
}
for (const invalidThreshold of ['', '30', null, NaN, Infinity, -1, 101]) {
  assert.throws(() => analyze(validControl, validGuides, invalidThreshold), 'Invalid threshold must reject');
}
assert.doesNotThrow(() => analyze(validControl, validGuides, 0));
assert.doesNotThrow(() => analyze(validControl, validGuides, 100));

const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), browser);
assert.equal(JSON.stringify(browser.window.UNIVERSITY_LAB_DEMO_DATA), JSON.stringify(data),
  'Browser payload must exactly match checked JSON');
console.log('PASS: 126 measurements; 18 cases; 36 guide effects and 180 scenarios agree within 1e-9.');
console.log('PASS: threshold boundaries, blank/invalid inputs, nonmutation and browser data parity.');
