import { createHash } from 'node:crypto';
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// One Redis operation checks the rate, deduplicates and stores the submission.
export const SUBMIT_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then return 429 end
if redis.call('EXISTS', KEYS[2]) == 1 then return 409 end
redis.call('INCR', KEYS[1])
if count == 0 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
redis.call('LPUSH', KEYS[3], ARGV[3])
redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[4]) - 1)
return 200
`;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export async function storeSubmission(request: Request, kind: 'chat' | 'feedback', payload: unknown, fingerprint: string) {
  // Vercel replaces this header. Self-hosted deployments share a bucket until a trusted proxy is configured.
  const ip = process.env.VERCEL === '1' ? (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')) : null;
  const identity = digest(ip || 'shared');
  const seconds = kind === 'chat' ? 60 : 600;
  const key = kind === 'chat' ? 'chat:messages' : 'feedback:list';
  const result = await kv.eval<(number | string)[], number>(SUBMIT_SCRIPT,
    [`limit:${kind}:${identity}`, `duplicate:${kind}:${identity}:${digest(fingerprint.normalize('NFKC'))}`, key],
    [kind === 'chat' ? 10 : 5, seconds, JSON.stringify(payload), kind === 'chat' ? 50 : 1000]);
  if (result === 200) return null;
  return NextResponse.json({ success: false, message: result === 409 ? '이미 접수한 내용입니다.' : '요청이 많습니다. 잠시 후 다시 시도해 주세요.', error: result === 409 ? 'duplicate' : 'rate_limit' },
    { status: result, headers: { 'Retry-After': String(seconds) } });
}

export async function readSubmission(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid submission');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 8192) { await reader.cancel(); throw new Error('Submission too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid submission');
  return body;
}
