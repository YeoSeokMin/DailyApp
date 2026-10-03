require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { atomicJSON, kstDate } = require('./runFiles');
const exec = promisify(execFile);
const hash = value => createHash('sha256').update(value).digest('hex');

async function runPipeline({ root = path.join(__dirname, '..'), runId = kstDate(), retryNotification = false, commands = {}, waitForReport } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}(?:-[a-zA-Z0-9_-]+)?$/.test(runId)) throw new Error('Invalid run ID');
  const stateRoot = process.env.DAILYAPP_STATE_DIR || path.join(root, 'output');
  const dir = path.join(stateRoot, 'runs', runId);
  const stateFile = path.join(dir, 'state.json');
  let state;
  try { state = JSON.parse(await fs.readFile(stateFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = { runId, date: runId.slice(0, 10), steps: {} }; }
  if (state.date !== kstDate()) throw new Error('Historical runs cannot publish or send daily notifications');
  const input = path.join(dir, 'collected_apps.json');
  const report = path.join(dir, 'report.json');
  const env = { ...process.env, TZ: 'Asia/Seoul', AI_USAGE_APP: 'dailyapp', PIPELINE_RUN_DIR: dir,
    PIPELINE_DATE: state.date, COLLECTED_INPUT: input, REPORT_OUTPUT: report };
  const script = name => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', name)], { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${name}: ${signal || code}`)));
  });
  const git = async (...args) => (await exec('git', args, { cwd: root, timeout: 120000, maxBuffer: 1024 * 1024 })).stdout.trim();
  const save = () => atomicJSON(stateFile, state);
  async function step(name, action) {
    if (state.steps[name]?.status === 'completed') return;
    if (name === 'notify' && state.steps[name] && !retryNotification) throw new Error('Notification outcome needs checking; use --retry-notification only after confirming it was not sent');
    state.steps[name] = { status: 'running', startedAt: new Date().toISOString() };
    await save();
    try {
      await (commands[name] || action)({ dir, input, report, state, env });
      state.steps[name].status = 'completed';
      state.steps[name].completedAt = new Date().toISOString();
      await save();
    } catch (error) {
      state.steps[name].status = 'failed';
      state.steps[name].error = error.message;
      await save();
      throw error;
    }
  }
  if (!waitForReport && !process.env.SITE_URL) throw new Error('SITE_URL is required to verify the published report');
  console.log(`파이프라인 시작: ${runId}`);
  await step('collect', async () => {
    try { await fs.access(input); } catch { await script('collect.js'); }
    const raw = await fs.readFile(input);
    if (JSON.parse(raw).collection_date !== state.date) throw new Error('Wrong collection date');
    state.inputHash = hash(raw);
  });
  if (hash(await fs.readFile(input)) !== state.inputHash) throw new Error('Collection snapshot changed');
  await step('analyze', async () => {
    await script('analyze.js');
    const raw = await fs.readFile(report);
    if (JSON.parse(raw).date !== state.date) throw new Error('Wrong report date');
    state.reportHash = hash(raw);
  });
  if (hash(await fs.readFile(report)) !== state.reportHash) throw new Error('Report changed after analysis');
  await step('save', () => script('save-report.js'));
  await step('publish', async () => {
    if (await git('branch', '--show-current') !== 'main') throw new Error('Publisher checkout must be on main');
    if (!state.publishSha) {
      if (await git('diff', '--cached', '--name-only')) throw new Error('Publisher checkout already has staged changes');
      const data = JSON.parse(await fs.readFile(report, 'utf8'));
      const files = [`web/data/reports/${state.date}.json`];
      for (const app of [...(data.ios || []), ...(data.android || [])]) {
        if (!app.deep_report_id) continue;
        if (!/^[a-zA-Z0-9가-힣_-]+$/u.test(app.deep_report_id)) throw new Error('Invalid deep report ID');
        files.push(`web/data/deep-reports/${app.deep_report_id}.md`);
      }
      try { await fs.access(path.join(root, 'output/trends.json')); files.push('output/trends.json'); } catch {}
      await git('add', '--', ...files);
      if (await git('diff', '--cached', '--name-only')) await git('commit', '-m', `Daily report ${state.date}`);
      state.publishSha = await git('rev-parse', 'HEAD');
      await save();
    }
    // A failed push stops the pipeline. Resume retries this same commit.
    await git('push', 'origin', `${state.publishSha}:refs/heads/main`);
  });
  await step('verify', () => waitForReport ? waitForReport(state) : verifyPublishedReport(state));
  await step('notify', () => script('send-kakao.js'));
  state.completedAt = new Date().toISOString();
  await save();
  await atomicJSON(path.join(stateRoot, 'last-success.json'), { runId, date: state.date, completedAt: state.completedAt, commit: state.publishSha });
  console.log(`파이프라인 완료: ${runId}`);
  return state;
}
async function verifyPublishedReport(state) {
  const base = new URL(process.env.SITE_URL);
  if (base.protocol !== 'https:') throw new Error('SITE_URL must use HTTPS');
  const url = new URL(`/api/report-status?date=${state.date}`, base);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.sha256 === state.reportHash) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error('Published site does not yet contain this report');
}
if (require.main === module) {
  if (process.env.DAILYAPP_LOCK_HELD !== '1') throw new Error('Start with run-pipeline.sh to acquire the pipeline lock');
  const args = process.argv.slice(2);
  const index = args.indexOf('--resume');
  runPipeline({ runId: index >= 0 ? args[index + 1] : undefined, retryNotification: args.includes('--retry-notification') })
    .catch(error => { console.error('파이프라인 중단:', error.message); process.exitCode = 1; });
}
module.exports = { runPipeline, hash };
