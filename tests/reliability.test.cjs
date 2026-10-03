const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { identifyApps, validateReport } = require('../scripts/sourceValidation');
const { runPipeline, hash } = require('../scripts/pipeline');
const { kstDate, saveCollection } = require('../scripts/runFiles');
const ios = identifyApps([{ id: 123, name: 'Real app', url: 'https://apps.apple.com/app/id123', icon: 'original.png', developer: 'Original' }], 'ios');
const selection = { source_id: ios[0].source_id, name: 'Invented name', app_url: 'https://evil.example', icon: 'invented.png' };

test('store identity is stable across countries and distinct across platforms', () => {
  const countries = identifyApps([{ id: 123, country: 'kr' }, { id: 123, country: 'us' }], 'ios');
  assert.equal(countries[0].source_id, countries[1].source_id);
  assert.notEqual(countries[0].source_id, identifyApps([{ id: 123 }], 'android')[0].source_id);
});
test('selected source controls app identity and URL', () => {
  const report = validateReport({ ios: [selection], android: [], date: '1900-01-01' }, { ios, android: [] }, kstDate());
  assert.equal(report.ios[0].name, 'Real app');
  assert.equal(report.ios[0].app_url, ios[0].url);
  assert.equal(report.ios[0].icon, 'original.png');
  assert.equal(report.date, kstDate());
});
test('invented, repeated, missing and wrong-platform IDs cannot be published', () => {
  for (const report of [{ ios: [{ source_id: 'fake' }], android: [] }, { ios: [selection, selection], android: [] },
    { ios: [{ name: 'Real app' }], android: [] }, { ios: [], android: [selection] }]) {
    assert.throws(() => validateReport(report, { ios, android: [] }, kstDate()));
  }
});
test('push failure stops notification and resume reuses the collected input', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'dailyapp-pipeline-'));
  const calls = [];
  let failPush = true;
  const commands = {
    collect: async ({ input, state, dir }) => { calls.push('collect'); await fs.mkdir(dir, { recursive: true }); const raw = JSON.stringify({ collection_date: state.date }); await fs.writeFile(input, raw); state.inputHash = hash(raw); },
    analyze: async ({ report, state }) => { calls.push('analyze'); const raw = JSON.stringify({ date: state.date }); await fs.writeFile(report, raw); state.reportHash = hash(raw); },
    save: async () => { calls.push('save'); },
    publish: async () => { calls.push('publish'); if (failPush) throw new Error('push rejected'); },
    notify: async () => { calls.push('notify'); },
  };
  const options = { root, commands, waitForReport: async () => { calls.push('verify'); } };
  await assert.rejects(runPipeline(options), /push rejected/);
  assert.deepEqual(calls, ['collect', 'analyze', 'save', 'publish']);
  failPush = false;
  await runPipeline(options);
  assert.deepEqual(calls, ['collect', 'analyze', 'save', 'publish', 'publish', 'verify', 'notify']);
  await runPipeline(options);
  assert.equal(calls.filter(c => c === 'notify').length, 1);
  await fs.writeFile(path.join(root, 'output/runs', kstDate(), 'collected_apps.json'), '{}');
  await assert.rejects(runPipeline(options), /snapshot changed/);
});
test('uncertain notification failures require explicit reconciliation', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'dailyapp-notify-'));
  const commands = {
    collect: async ({ dir, input, state }) => { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(input, '{}'); state.inputHash = hash('{}'); },
    analyze: async ({ report, state }) => { await fs.writeFile(report, '{}'); state.reportHash = hash('{}'); },
    save: async () => {}, publish: async () => {}, notify: async () => { throw new Error('connection reset'); },
  };
  const options = { root, commands, waitForReport: async () => {} };
  await assert.rejects(runPipeline(options), /connection reset/);
  await assert.rejects(runPipeline(options), /Notification outcome needs checking/);
});
