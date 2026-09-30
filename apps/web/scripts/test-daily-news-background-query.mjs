import assert from 'node:assert/strict';
import { queryParam } from '../api/daily-news-background.js';

assert.equal(queryParam({ query: { date: '2026-10-01' } }, 'date'), '2026-10-01');
assert.equal(queryParam({ query: { response_id: '  resp_abcdefgh  ' } }, 'response_id'), 'resp_abcdefgh');
assert.equal(queryParam({ query: { date: ['2026-10-01', '2026-10-02'] } }, 'date'), '2026-10-01');
assert.equal(queryParam({ query: {} }, 'date'), '');
assert.equal(queryParam({}, 'date'), '');

let urlGetterTouched = false;
const request = {
  query: { date: '2026-10-01' },
  get url() {
    urlGetterTouched = true;
    throw new Error('request.url must not be accessed');
  },
};
assert.equal(queryParam(request, 'date'), '2026-10-01');
assert.equal(urlGetterTouched, false);

const missingRequest = {
  query: {},
  get url() {
    urlGetterTouched = true;
    throw new Error('request.url must not be accessed');
  },
};
urlGetterTouched = false;
assert.equal(queryParam(missingRequest, 'response_id'), '');
assert.equal(urlGetterTouched, false);

console.log('daily news background query contract pass');
