/**
 * iosChartNew.js — iOS "차트 신규 진입" 수집기
 *
 * 배경 (2026-09-22 실측):
 *   Apple 의 NEW_IOS / NEW_FREE_IOS / NEW_PAID_IOS 컬렉션이 2026-07-09 이후 동결됐다.
 *   (app-store-scraper 로 조회 시 최신 항목이 74~75일 전) Marketing Tools 의
 *   new-apps-we-love 피드도 us/kr 모두 0개라, "최근 N일 출시" 방식은 불가능하다.
 *
 * 대안:
 *   살아있는 공식 피드(top-free / top-paid, 매일 갱신 확인)를 매일 스냅샷하고
 *   직전 스냅샷에 없던 앱 = "차트 신규 진입" 을 신호로 쓴다.
 *   "출시됐다" 보다 "실제로 차트에 올라왔다" 가 앱 아이디어로는 더 강한 신호다.
 *
 * ★첫 실행일은 비교 대상이 없어 0건을 반환한다(정상). 다음 날부터 결과가 나온다.
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const SNAPSHOT_DIR = path.join(__dirname, '..', 'output', 'ios_chart');
const FEEDS = ['top-free', 'top-paid'];
const LIMIT = 100;
const FETCH_GAP_MS = 1500;          // 503 방지 — 1.5초 간격이면 안정적(실측)
const FETCH_TIMEOUT_MS = 30000;     // 20초는 짧아 타임아웃이 났다(실측)
const FETCH_RETRIES = 3;            // 실패한 피드는 반드시 복구해야 한다(아래 원자성 참조)
const MAX_AGE_DAYS = 365;           // 1년 넘은 앱의 차트 재진입은 '신규 아이디어'가 아니다
const ENRICH_MAX = 60;              // iTunes lookup 으로 설명을 채울 최대 개수
const SNAPSHOT_KEEP_DAYS = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('JSON 파싱 실패')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('타임아웃')); });
  });
}

async function getJsonRetry(url, label) {
  let lastErr;
  for (let i = 1; i <= FETCH_RETRIES; i++) {
    try {
      return await getJson(url, FETCH_TIMEOUT_MS);
    } catch (e) {
      lastErr = e;
      if (i < FETCH_RETRIES) {
        const wait = 2000 * i;
        console.error(`  ↻ iOS 차트(${label}) ${i}차 실패: ${e.message} — ${wait}ms 후 재시도`);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** 한 국가의 오늘 차트(top-free + top-paid 합집합) */
async function fetchChart(countryCode) {
  const seen = new Map();
  const failed = [];
  for (const feed of FEEDS) {
    const url = `https://rss.marketingtools.apple.com/api/v2/${countryCode}/apps/${feed}/${LIMIT}/apps.json`;
    try {
      const j = await getJsonRetry(url, `${countryCode}/${feed}`);
      const results = (j && j.feed && j.feed.results) || [];
      results.forEach((r, idx) => {
        const id = String(r.id);
        if (seen.has(id)) return;
        seen.set(id, {
          id,
          name: r.name,
          developer: r.artistName,
          icon: r.artworkUrl100,
          category: (r.genres && r.genres[0] && r.genres[0].name) || '',
          url: r.url,
          releaseDate: r.releaseDate || null,
          chart: feed,
          rank: idx + 1,
        });
      });
    } catch (e) {
      console.error(`  ❌ iOS 차트(${countryCode}/${feed}) 최종 실패: ${e.message}`);
      failed.push(feed);
    }
    await sleep(FETCH_GAP_MS);
  }
  // ★부분 실패 여부를 반드시 전달한다. 불완전한 스냅샷을 저장하면
  //   다음 날 '빠졌던 피드 전체'가 신규 진입으로 잡혀 diff 가 통째로 오염된다.
  return { apps: Array.from(seen.values()), failed };
}

async function ensureDir() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
}

function snapFile(countryCode, dateStr) {
  return path.join(SNAPSHOT_DIR, `${dateStr}_${countryCode}.json`);
}

/** 오늘 이전의 가장 최근 스냅샷에 들어있던 id 집합 */
async function loadPrevIds(countryCode, todayStr) {
  await ensureDir();
  let files;
  try { files = await fs.readdir(SNAPSHOT_DIR); } catch { return { ids: null, date: null }; }
  const mine = files
    .filter((f) => f.endsWith(`_${countryCode}.json`))
    .map((f) => f.slice(0, 8))
    .filter((d) => /^\d{8}$/.test(d) && d < todayStr)
    .sort();
  if (!mine.length) return { ids: null, date: null };
  const prev = mine[mine.length - 1];
  try {
    const raw = await fs.readFile(snapFile(countryCode, prev), 'utf-8');
    const arr = JSON.parse(raw);
    return { ids: new Set(arr.map((x) => String(x.id))), date: prev };
  } catch {
    return { ids: null, date: null };
  }
}

async function saveSnapshot(countryCode, dateStr, entries) {
  await ensureDir();
  const slim = entries.map((e) => ({ id: e.id, name: e.name, chart: e.chart, rank: e.rank }));
  await fs.writeFile(snapFile(countryCode, dateStr), JSON.stringify(slim), 'utf-8');
}

async function pruneSnapshots() {
  try {
    const files = await fs.readdir(SNAPSHOT_DIR);
    const cutoff = new Date(Date.now() - SNAPSHOT_KEEP_DAYS * 86400000);
    const cut = `${cutoff.getFullYear()}${String(cutoff.getMonth() + 1).padStart(2, '0')}${String(cutoff.getDate()).padStart(2, '0')}`;
    for (const f of files) {
      const d = f.slice(0, 8);
      if (/^\d{8}$/.test(d) && d < cut) await fs.unlink(path.join(SNAPSHOT_DIR, f)).catch(() => {});
    }
  } catch { /* 무시 */ }
}

/** iTunes lookup 으로 설명 보강 (한 번에 여러 id 조회 가능) */
async function enrich(apps, countryCode) {
  const target = apps.slice(0, ENRICH_MAX);
  if (!target.length) return apps;
  const CHUNK = 20;
  for (let i = 0; i < target.length; i += CHUNK) {
    const chunk = target.slice(i, i + CHUNK);
    const ids = chunk.map((a) => a.id).join(',');
    try {
      const j = await getJson(`https://itunes.apple.com/lookup?id=${ids}&country=${countryCode}`);
      const byId = new Map((j.results || []).map((r) => [String(r.trackId), r]));
      for (const a of chunk) {
        const r = byId.get(a.id);
        if (!r) continue;
        a.description = (r.description || '').slice(0, 1200);
        if (!a.releaseDate && r.releaseDate) a.releaseDate = r.releaseDate;
        if (r.primaryGenreName) a.category = r.primaryGenreName;
      }
    } catch (e) {
      console.error(`  ⚠️ iOS 설명 보강 실패(${countryCode}): ${e.message}`);
    }
    await sleep(600);
  }
  return apps;
}

/**
 * @param {Array<{code:string,name:string}>} countries
 * @param {string} todayStr YYYYMMDD
 * @returns {Promise<Object>} { kr: [...], us: [...], jp: [...] }
 */
async function collectIOSChartNew(countries, todayStr) {
  console.log('🍎 iOS 차트 신규 진입 수집... (Apple 신규앱 피드 동결로 방식 변경)');
  const out = {};
  let total = 0;
  let firstRun = false;

  for (const c of countries) {
    const { apps: today, failed } = await fetchChart(c.code);

    // ★원자성: 피드 하나라도 실패하면 스냅샷을 저장하지 않는다.
    //   저장하면 내일 그 피드의 앱 전부가 '신규 진입' 오탐이 된다.
    //   저장을 건너뛰면 내일은 '마지막 완전한 스냅샷'과 비교하므로 안전하다.
    if (failed.length > 0) {
      console.log(`  📍 ${c.name}: 피드 실패(${failed.join(', ')}) → 스냅샷 저장 안 함, 0개`);
      out[c.code] = [];
      continue;
    }
    if (!today.length) {
      console.log(`  📍 ${c.name}: 차트 0개 → 0개`);
      out[c.code] = [];
      continue;
    }

    const { ids: prevIds, date: prevDate } = await loadPrevIds(c.code, todayStr);
    await saveSnapshot(c.code, todayStr, today);

    if (!prevIds) {
      firstRun = true;
      console.log(`  📍 ${c.name}: 차트 ${today.length}개 저장 — 비교할 이전 스냅샷 없음(첫 실행) → 0개`);
      out[c.code] = [];
      continue;
    }

    let fresh = today.filter((a) => !prevIds.has(a.id));
    const beforeAge = fresh.length;
    fresh = fresh.filter((a) => {
      const age = daysSince(a.releaseDate);
      return age === null || age <= MAX_AGE_DAYS;
    });
    const droppedOld = beforeAge - fresh.length;

    fresh = await enrich(fresh, c.code);
    fresh.forEach((a) => {
      a.country = c.code;
      a.description = a.description || '';
    });

    out[c.code] = fresh;
    total += fresh.length;
    console.log(
      `  📍 ${c.name}: 차트 ${today.length}개 / ${prevDate} 대비 신규 ${beforeAge}개` +
      (droppedOld ? ` (1년 초과 ${droppedOld}개 제외)` : '') +
      ` → ${fresh.length}개`
    );
  }

  await pruneSnapshots();
  if (firstRun) {
    console.log('  ℹ️ 첫 실행이라 비교 대상이 없습니다. 내일부터 신규 진입이 집계됩니다.');
  }
  console.log(`  ✅ iOS 총: ${total}개 (차트 신규 진입)`);
  return out;
}

module.exports = { collectIOSChartNew, fetchChart };
