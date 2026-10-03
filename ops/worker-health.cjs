let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const app = JSON.parse(input).find(p => p.name === process.argv[2]);
  const env = app?.pm2_env;
  process.exitCode = env?.status === 'online' && Date.now() - env.pm_uptime >= 2500 ? 0 : 1;
});
