const { default: worker } = await import('../worker-entry.js');

const base = 'https://example.com';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertJsonHealth(path) {
  const response = await worker.fetch(new Request(`${base}${path}`), {}, {});
  assert(response.status === 200, `GET ${path} returned ${response.status}`);
  assert((response.headers.get('content-type') || '').toLowerCase().includes('application/json'), `${path} is not JSON`);
  assert((response.headers.get('cache-control') || '').includes('no-store'), `${path} is cacheable`);
  const requestId = response.headers.get('x-request-id') || '';
  assert(requestId.trim(), `${path} is missing X-Request-Id`);
  const body = await response.json();
  assert(body.ok === true && body.service === 'edgetunnel', `${path} body is invalid`);
  return requestId;
}

const firstId = await assertJsonHealth('/__health');
const secondId = await assertJsonHealth('/__health/');
assert(firstId !== secondId, 'Request IDs are not unique across requests');

const headResponse = await worker.fetch(new Request(`${base}/__health`, { method: 'HEAD' }), {}, {});
assert(headResponse.status === 200, `HEAD /__health returned ${headResponse.status}`);
assert((headResponse.headers.get('x-request-id') || '').trim(), 'HEAD /__health is missing X-Request-Id');
assert((await headResponse.text()) === '', 'HEAD /__health returned a response body');

const postResponse = await worker.fetch(new Request(`${base}/__health`, { method: 'POST' }), {}, {});
assert(postResponse.status === 405, `POST /__health returned ${postResponse.status}`);
assert(postResponse.headers.get('allow') === 'GET, HEAD', 'Health Allow header is invalid');
assert((postResponse.headers.get('cache-control') || '').includes('no-store'), '405 response is cacheable');
const postBody = await postResponse.json();
assert(postBody.ok === false && postBody.error === 'Method Not Allowed', '405 body is invalid');

console.log('Health endpoint smoke test passed');
