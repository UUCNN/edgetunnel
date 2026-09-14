import worker from './_worker.js';

const ERROR_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Retry-After': '1',
};

const HEALTH_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

function normalizeError(error) {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown worker error');
}

function createRequestId() {
  try {
    return crypto.randomUUID();
  } catch (_) {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isHealthRequest(request) {
  const url = new URL(request.url);
  return url.pathname === '/__health' || url.pathname === '/__health/';
}

function healthResponse(request, requestId) {
  const headers = { ...HEALTH_HEADERS, 'X-Request-Id': requestId };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...headers, Allow: 'GET, HEAD' },
    });
  }

  const body = JSON.stringify({ ok: true, service: 'edgetunnel' });
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers,
  });
}

function addRequestIdHeader(response, requestId) {
  if (!response || response.status === 101) return response;
  try {
    const headers = new Headers(response.headers);
    headers.set('X-Request-Id', requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (_) {
    return response;
  }
}

export default {
  async fetch(request, env, ctx) {
    const requestId = createRequestId();
    const requestURL = new URL(request.url);
    const startedAt = performance.now();
    try {
      if (isHealthRequest(request)) return healthResponse(request, requestId);
      const response = await worker.fetch(request, env, ctx);
      const durationMs = (performance.now() - startedAt).toFixed(1);
      console.log(`[WorkerEntry] ${requestId} ${request.method} ${requestURL.pathname} -> ${response.status} (${durationMs}ms)`);
      return addRequestIdHeader(response, requestId);
    } catch (error) {
      const normalized = normalizeError(error);
      const durationMs = (performance.now() - startedAt).toFixed(1);
      console.error(`[WorkerEntry] ${requestId} ${request.method} ${requestURL.pathname} failed after ${durationMs}ms:`, normalized.message);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { ...ERROR_HEADERS, 'X-Request-Id': requestId },
      });
    }
  },
};
