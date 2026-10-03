// Verifies a reviewed snapshot of the existing guards. This does not replace their policy.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = fs.realpathSync(process.argv[2]);
const raw = fs.readFileSync(path.join(root, 'manifest.json'));
if (createHash('sha256').update(raw).digest('hex') !== process.argv[3]) throw new Error('Unapproved guard manifest');
const manifest = JSON.parse(raw);
if (!manifest.revision || !manifest.files || Object.keys(manifest.files).length < 3) throw new Error('Incomplete guard snapshot');
for (const required of ['codex', 'claude', 'tap.py']) if (!manifest.files[required]) throw new Error(`Missing ${required}`);
for (const [relative, digest] of Object.entries(manifest.files)) {
  const file = fs.realpathSync(path.join(root, relative));
  const inside = path.relative(root, file);
  if (inside.startsWith('..') || path.isAbsolute(inside)) throw new Error('Snapshot links outside its version directory');
  if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== digest) throw new Error(`Guard snapshot changed: ${relative}`);
}
console.log(`AI guard snapshot verified: ${manifest.revision}`);
