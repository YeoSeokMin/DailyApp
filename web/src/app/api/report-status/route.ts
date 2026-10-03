import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: 'invalid_date' }, { status: 400 });
  try {
    const raw = await readFile(path.join(process.cwd(), 'data', 'reports', `${date}.json`));
    return Response.json({ date, sha256: createHash('sha256').update(raw).digest('hex') }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'not_found' }, { status: 404 }); }
}
