const { createHash } = require('node:crypto');

function identifyApps(apps, platform) {
  return apps.map(app => {
    if (!app.id && !app.url) throw new Error('Collected app has no store identity');
    const key = [platform, String(app.id || app.url)].join(':');
    return { ...app, source_id: createHash('sha256').update(key).digest('hex').slice(0, 24) };
  });
}
function validateReport(report, sources, date) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Invalid report');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Invalid collection date');
  const result = { ...report, date, data_status: { ...report.data_status } };
  for (const platform of ['ios', 'android']) {
    const catalog = new Map(sources[platform].map(app => [app.source_id, app]));
    const selected = report[platform];
    if (!Array.isArray(selected)) throw new Error(`${platform} must be an array`);
    if (catalog.size && !selected.length) throw new Error(`${platform} has input but no selected apps`);
    const seen = new Set();
    result[platform] = selected.map((app, index) => {
      const original = catalog.get(app?.source_id);
      if (!original || seen.has(app.source_id)) throw new Error(`Unknown or repeated ${platform} source_id`);
      seen.add(app.source_id);
      // The model chooses IDs and writes analysis; identity and links come from collection.
      return { ...app, rank: index + 1, source_id: original.source_id, name: original.name,
        developer: original.developer || '', app_url: original.url || '', icon: original.icon || '', country: original.country || 'kr' };
    });
    if (!catalog.size) result.data_status[platform] = 'unavailable';
  }
  if (!result.ios.length && !result.android.length) throw new Error('Both platforms are empty');
  return result;
}
module.exports = { identifyApps, validateReport };
