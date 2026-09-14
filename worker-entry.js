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

function isHealthRequest(request) {
  const url = new URL(request.url);
  return url.pathname === '/__health' || url.pathname === '/__health/';
}

function healthResponse(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...HEALTH_HEADERS, Allow: 'GET, HEAD' },
    });
  }

  const body = JSON.stringify({ ok: true, service: 'edgetunnel' });
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (isHealthRequest(request)) return healthResponse(request);
      return await worker.fetch(request, env, ctx);
    } catch (error) {
      const normalized = normalizeError(error);
      console.error('[WorkerEntry] Unhandled request error:', normalized.message);
      return new Response('Internal Server Error', {
        status: 500,
        headers: ERROR_HEADERS,
      });
    }
  },
};
