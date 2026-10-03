const { test } = require('node:test');
const assert = require('node:assert/strict');
test('Apple search and charts preserve store identity and reject invalid responses', async t => {
  const requests = [];
  const replies = [{ results: [{ trackId: 123, trackName: 'Fixture', sellerName: 'Seller', price: 0,
    trackViewUrl: 'https://apps.apple.com/app/id123' }] }, { feed: { entry: [{
    id: { attributes: { 'im:id': '456' } }, 'im:name': { label: 'Chart fixture' },
    link: { attributes: { rel: 'alternate', href: 'https://apps.apple.com/app/id456' } }
  }] } }, {}];
  let clock = Date.now();
  t.mock.method(Date, 'now', () => { clock += 4000; return clock; });
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok: true, json: async () => replies.shift() };
  });
  const store = require('../scripts/appleStore');
  const found = await store.search({ term: 'fixture', country: 'KR' });
  assert.equal(found[0].id, '123');
  assert.equal(found[0].title, 'Fixture');
  assert.equal(requests[0].url.searchParams.get('country'), 'kr');
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal((await store.list({ category: store.category.PRODUCTIVITY }))[0].id, '456');
  await assert.rejects(store.search({ term: 'fixture' }), /Invalid Apple search/);
  await assert.rejects(store.list({ category: 1 }), /Invalid Apple genre/);
});
