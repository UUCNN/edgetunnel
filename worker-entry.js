import worker from './_worker.js';

const ERROR_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Retry-After': '1',
};

function normalizeError(error) {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown worker error');
}

export default {
  async fetch(request, env, ctx) {
    try {
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
