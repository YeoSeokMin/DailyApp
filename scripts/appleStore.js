// Only the two read-only Apple endpoints used by competitor research.
// Replaces app-store-scraper's unmaintained request/form-data dependency chain.
const category = { BOOKS:6018, BUSINESS:6000, EDUCATION:6017, ENTERTAINMENT:6016,
  FINANCE:6015, FOOD_AND_DRINK:6023, GAMES:6014, HEALTH_AND_FITNESS:6013, LIFESTYLE:6012,
  MEDICAL:6020, MUSIC:6011, NAVIGATION:6010, NEWS:6009, PHOTO_AND_VIDEO:6008, PRODUCTIVITY:6007,
  REFERENCE:6006, SHOPPING:6024, SOCIAL_NETWORKING:6005, SPORTS:6004, TRAVEL:6003, UTILITIES:6002, WEATHER:6001 };
let tail = Promise.resolve(), lastRequest = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function download(url) {
  const result = tail.then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(Math.max(0, lastRequest + 3100 - Date.now()));
      lastRequest = Date.now();
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (response.ok) return response.json();
      if (response.status !== 429 && response.status < 500) throw new Error(`Apple HTTP ${response.status}`);
      if (attempt === 2) throw new Error(`Apple HTTP ${response.status}`);
    }
  });
  tail = result.catch(() => {});
  return result;
}
function options(country, num) {
  if (!/^[a-z]{2}$/i.test(country) || !Number.isFinite(num)) throw new Error('Invalid Apple store options');
  return { country: country.toLowerCase(), limit: Math.max(1, Math.min(200, Math.floor(num))) };
}
async function search({ term, country = 'kr', num = 20 }) {
  const safe = options(country, num);
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({ term, country: safe.country, media: 'software', entity: 'software', limit: String(safe.limit) });
  const data = await download(url);
  if (!Array.isArray(data.results)) throw new Error('Invalid Apple search response');
  return data.results.filter(row => row.trackId).map(row => ({
    id: String(row.trackId), appId: row.bundleId, title: row.trackName, developer: row.sellerName,
    description: row.description || '', url: row.trackViewUrl, icon: row.artworkUrl512 || row.artworkUrl100,
    primaryGenre: row.primaryGenreName, price: row.price, free: row.price === 0, score: row.averageUserRating || 0,
    reviews: row.userRatingCount || 0, currentVersionReleaseDate: row.currentVersionReleaseDate,
    released: row.releaseDate, size: Number(row.fileSizeBytes) || 0,
  }));
}
async function list({ country = 'kr', num = 20, category: genre }) {
  const safe = options(country, num);
  if (!Number.isInteger(genre) || !Object.values(category).includes(genre)) throw new Error('Invalid Apple genre');
  const data = await download(new URL(`https://itunes.apple.com/${safe.country}/rss/topfreeapplications/limit=${safe.limit}/genre=${genre}/json`));
  if (!data.feed || (data.feed.entry && !Array.isArray(data.feed.entry))) throw new Error('Invalid Apple chart response');
  return (data.feed.entry || []).map(row => ({
    id: row.id?.attributes?.['im:id'], appId: row.id?.attributes?.['im:bundleId'], title: row['im:name']?.label,
    developer: row['im:artist']?.label, description: row.summary?.label || '',
    url: (Array.isArray(row.link) ? row.link : [row.link]).find(link => link?.attributes?.rel === 'alternate')?.attributes?.href,
    icon: row['im:image']?.at(-1)?.label, genre: row.category?.attributes?.label,
    price: Number(row['im:price']?.attributes?.amount) || 0, free: true, released: row['im:releaseDate']?.label,
  })).filter(row => row.id && row.title);
}
module.exports = { search, list, category, collection: { TOP_FREE_IOS: 'topfreeapplications' } };
