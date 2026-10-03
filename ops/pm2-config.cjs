const path = require('node:path');
const root = process.env.APP_RELEASE;
const kind = process.env.APP_KIND;
const script = kind === 'worker' ? 'src/index.js' : kind === 'backend' ? 'backend/dist/index.js' :
  process.env.APP_ID === 'opcodey-dashboard' ? 'scripts/start.cjs' : 'node_modules/next/dist/bin/next';
const args = kind === 'next' ? [...(process.env.APP_ID === 'opcodey-dashboard' ? [] : ['start']), '-H', '127.0.0.1', '-p', process.env.APP_PORT] : [];
const cwd = kind === 'backend' ? path.join(root, 'backend') : root;
const executable = path.join(root, script);
// PM2 reload merges these resolved fields; script/cwd alone only affect a new process.
console.log(JSON.stringify({ apps: [{ name: process.env.APP_ID, cwd, pm_cwd: cwd,
  script: executable, pm_exec_path: executable, args, interpreter: process.execPath, instances: 1, exec_mode: 'fork',
  min_uptime: '30s', max_restarts: 5, kill_timeout: 10000,
  env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: process.env.APP_PORT, PATH: process.env.PATH, AI_USAGE_APP: process.env.APP_ID,
    AIFEED_DATA_DIR: process.env.SHARED_DATA_DIR, CODEX_CLI_PATH: process.env.CODEX_CLI_PATH, CLAUDE_CLI_PATH: process.env.CLAUDE_CLI_PATH } }] }));
