const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
let result = 200;
const calls = [];
const filename = path.join(__dirname, '../src/lib/submissionGuard.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = loaded.require.bind(loaded);
loaded.require = name => name === '@vercel/kv' ? { kv: { eval: async (...args) => { calls.push(args); if (result instanceof Error) throw result; return result; } } } : originalRequire(name);
loaded._compile(compiled, filename);
const { readSubmission, storeSubmission } = loaded.exports;
const body = value => new Request('https://example.com/api/chat', { method: 'POST', body: value });

test('submission reader rejects malformed, non-object and oversized bodies', async () => {
  assert.deepEqual(await readSubmission(body('{"message":"ok"}')), { message: 'ok' });
  for (const raw of ['{', 'null', '[]', JSON.stringify({ message: 'x'.repeat(8192) })]) await assert.rejects(readSubmission(body(raw)));
});
test('limiter maps duplicate and rate responses and fails closed on Redis errors', async () => {
  const request = new Request('https://example.com');
  for (const status of [200, 409, 429]) {
    result = status;
    const response = await storeSubmission(request, 'chat', { message: 'ok' }, 'ok');
    if (status === 200) assert.equal(response, null);
    else { assert.equal(response.status, status); assert.equal(response.headers.get('Retry-After'), '60'); }
  }
  result = new Error('Redis unavailable');
  await assert.rejects(storeSubmission(request, 'chat', {}, 'ok'), /Redis unavailable/);
});
test('untrusted forwarded headers cannot create new rate buckets off Vercel', async t => {
  const original = process.env.VERCEL;
  t.after(() => { if (original === undefined) delete process.env.VERCEL; else process.env.VERCEL = original; });
  delete process.env.VERCEL;
  result = 200;
  for (const ip of ['1.2.3.4', '5.6.7.8']) await storeSubmission(new Request('https://example.com', { headers: { 'x-forwarded-for': ip } }), 'feedback', {}, 'same');
  assert.deepEqual(calls.at(-1)[1], calls.at(-2)[1]);
  assert.equal(calls.at(-1)[2][0], 5);
});
