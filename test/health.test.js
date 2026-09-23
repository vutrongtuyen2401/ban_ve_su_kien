const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../app');

const fakeDb = () => ({ select: async () => [] });
fakeDb.raw = async () => ({ rows: [{ '?column?': 1 }] });

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = createApp(fakeDb).listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('GET / trả về HTTP 200', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('GET /health/ready kiểm tra được database', async () => {
  const response = await fetch(`${baseUrl}/health/ready`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ready');
});

