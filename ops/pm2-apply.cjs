// PM2 6 keeps the old resolved paths when startOrReload reads a new script/cwd.
// Update one exact process through its restart RPC, then verify the stored paths.
const fs = require('node:fs');
const path = require('node:path');
const pm2 = require(process.env.PM2_MODULE_PATH);
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (spec.apps.length !== 1) throw new Error('Exactly one app is required');
const app = spec.apps[0];
if (app.name !== process.env.APP_ID || !path.isAbsolute(app.cwd) || !path.isAbsolute(app.script)) throw new Error('Invalid app target');
const call = (method, ...args) => new Promise((resolve, reject) => pm2[method](...args, (error, result) => error ? reject(error) : resolve(result)));
(async () => {
  await call('connect');
  try {
    const matches = (await call('list')).filter(item => item.name === app.name);
    if (matches.length > 1) throw new Error('App name is ambiguous');
    if (!matches.length) await call('start', app);
    else {
      const old = matches[0];
      const current = {
        pm_exec_path: app.script, pm_cwd: app.cwd, exec_interpreter: app.interpreter,
        args: app.args, exec_mode: 'fork_mode', instances: 1,
        min_uptime: 30000, max_restarts: app.max_restarts, kill_timeout: app.kill_timeout,
        env: { ...old.pm2_env.env, ...app.env }
      };
      await new Promise((resolve, reject) => pm2.Client.executeRemote('restartProcessId',
        { id: old.pm_id, env: { ...app.env, current_conf: current } },
        (error, result) => error ? reject(error) : resolve(result)));
    }
    const actual = (await call('list')).find(item => item.name === app.name)?.pm2_env;
    if (!actual || actual.pm_exec_path !== app.script || actual.pm_cwd !== app.cwd || actual.exec_interpreter !== app.interpreter) throw new Error('PM2 did not apply the requested release');
    console.log(`PM2 execution paths verified: ${app.name}`);
  } finally { pm2.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
