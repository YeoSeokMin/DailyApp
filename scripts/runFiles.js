const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const output = path.join(__dirname, '..', 'output');
const kstDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
async function atomicJSON(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}
async function saveCollection(value) {
  const dir = process.env.PIPELINE_RUN_DIR || path.join(output, 'runs', `${kstDate()}-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  const snapshot = path.join(dir, 'collected_apps.json');
  await fs.writeFile(snapshot, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  await atomicJSON(path.join(output, 'collected_apps.json'), value);
  return snapshot;
}
module.exports = { atomicJSON, saveCollection, kstDate };
