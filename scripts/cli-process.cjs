// Vendored per project so one shared file cannot stop every worker at once.
const { spawn, execFile } = require('node:child_process');
const { tmpdir } = require('node:os');
function runCli(binary, args, input, { timeout = 120000, maxBytes = 2 * 1024 * 1024, app } = {}) {
  return new Promise(resolve => {
    const child = spawn(binary, args, { cwd: tmpdir(), shell: false, windowsHide: true,
      detached: process.platform !== 'win32', stdio: ['pipe','pipe','pipe'],
      env: { ...process.env, AI_USAGE_APP: app || process.env.AI_USAGE_APP || 'unknown' } });
    let output = '', stderr = '', settled = false, inputError = false;
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
      else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
        const force = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 2000);
        force.unref();
      }
    };
    const timer = setTimeout(() => { stop(); finish({ success: false, output: '', error: 'CLI timeout', retryable: true }); }, timeout);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (settled) return;
      output += chunk;
      if (Buffer.byteLength(output) > maxBytes) { stop(); finish({ success: false, output: '', error: 'CLI output limit exceeded', retryable: true }); }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
    child.stdin.on('error', () => { inputError = true; });
    child.on('error', error => finish({ success: false, output: '', error: `CLI spawn failed: ${error.code || error.message}`, retryable: true }));
    child.on('close', code => finish(code === 0 && output.trim() && !inputError ? { success: true, output: output.trim() }
      : { success: false, output: '', error: stderr.trim().slice(-300) || `CLI failed or empty (exit ${code})`, retryable: true }));
    child.stdin.end(input);
  });
}
module.exports = { runCli };
