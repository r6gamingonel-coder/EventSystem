// Local stand-ins for Google (OAuth, YouTube Data/Analytics, resumable upload) and Anthropic (Messages SSE).
import http from 'node:http';

const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const readBody = (req) => new Promise((resolve) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))); });

export async function startGoogleMock({ failChunkOnce = true } = {}) {
  const state = { refreshTokens: ['rt-secret-REFRESH-0123456789'], uploads: {}, calls: [], thumbs: 0, playlistItems: [], insertBody: null, tokenRefreshes: 0, failedOnce: false, authFailures: 0 };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const body = await readBody(req);
    state.calls.push(`${req.method} ${url.pathname}`);
    const json = (code, o, h = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/token') {
      const p = new URLSearchParams(body.toString());
      if (p.get('grant_type') === 'authorization_code') { if (p.get('code') !== 'good-code' || !p.get('code_verifier')) return json(400, { error: 'invalid_grant' }); return json(200, { access_token: 'ya29.access-token-AAAAAAAAAAAAAAAAAAAA', refresh_token: state.refreshTokens[0], expires_in: 3600, scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly' }); }
      if (p.get('grant_type') === 'refresh_token') { state.tokenRefreshes++; return json(200, { access_token: `ya29.refreshed-${state.tokenRefreshes}-BBBBBBBBBBBBBBBB`, expires_in: 3600 }); }
      return json(400, { error: 'unsupported_grant_type' });
    }
    // Resumable session URIs are pre-authenticated (no Authorization header needed); everything else must carry a Bearer token.
    if (!url.pathname.startsWith('/upload/session/') && !/^Bearer ya29\./.test(req.headers.authorization || '')) { state.authFailures++; return json(401, { error: { message: 'bad token' } }); }
    if (url.pathname === '/youtube/v3/channels') return json(200, { items: [{ id: 'UC_EAKIDS', snippet: { title: 'EA KIDS' }, statistics: { subscriberCount: '12' } }] });
    if (url.pathname === '/upload/youtube/v3/videos' && req.method === 'POST') {
      state.insertBody = JSON.parse(body.toString()); state.insertHeaders = req.headers;
      const id = `sess${Object.keys(state.uploads).length}`; state.uploads[id] = { total: Number(req.headers['x-upload-content-length']), received: 0, chunks: 0 };
      return json(200, {}, { location: `http://127.0.0.1:${server.address().port}/upload/session/${id}` });
    }
    if (url.pathname.startsWith('/upload/session/')) {
      const u = state.uploads[url.pathname.split('/').pop()]; const cr = req.headers['content-range'] || '';
      if (/^bytes \*\//.test(cr)) return u.received >= u.total && u.total ? json(200, { id: 'VID123', status: { privacyStatus: 'private' } }) : (res.writeHead(308, u.received ? { range: `bytes=0-${u.received - 1}` } : {}), res.end());
      const m = cr.match(/bytes (\d+)-(\d+)\/(\d+)/);
      if (failChunkOnce && u.chunks === 1 && !state.failedOnce) { state.failedOnce = true; return json(503, { error: { message: 'backend error' } }); }
      if (Number(m[1]) !== u.received) return json(400, { error: { message: 'bad offset' } });
      u.received = Number(m[2]) + 1; u.chunks++;
      if (u.received >= u.total) return json(200, { id: 'VID123', status: { privacyStatus: state.forcePrivacy || state.insertBody?.status?.privacyStatus || 'private' } });
      res.writeHead(308, { range: `bytes=0-${u.received - 1}` }); return res.end();
    }
    if (url.pathname === '/upload/youtube/v3/thumbnails/set') { state.thumbs++; state.thumbBytes = body.length; return json(200, { items: [{}] }); }
    if (url.pathname === '/youtube/v3/playlists') return json(200, { id: 'PL123' });
    if (url.pathname === '/youtube/v3/playlistItems') { state.playlistItems.push(JSON.parse(body.toString())); return json(200, { id: 'PLI1' }); }
    if (url.pathname === '/v2/reports') {
      const dims = url.searchParams.get('dimensions');
      if (dims === 'elapsedVideoTimeRatio') return json(200, { columnHeaders: [{ name: 'elapsedVideoTimeRatio' }, { name: 'audienceWatchRatio' }], rows: [[0.01, 1.0], [0.5, 0.62], [0.99, 0.31]] });
      const names = url.searchParams.get('metrics').split(',');
      return json(200, { columnHeaders: [{ name: 'day' }, ...names.map((n) => ({ name: n }))], rows: [['2026-10-01', ...names.map((n, i) => 100 + i)], ['2026-10-02', ...names.map((n, i) => 200 + i)]] });
    }
    json(404, { error: { message: `mock: unhandled ${url.pathname}` } });
  });
  const port = await listen(server);
  return { port, base: `http://127.0.0.1:${port}`, state, close: () => new Promise((r) => server.close(r)) };
}

/** Mock of POST /v1/messages (streaming). `reply(requestBody)` returns {text, stop_reason?, usage?} or {status}. */
export async function startAnthropicMock(reply) {
  const seen = [];
  const server = http.createServer(async (req, res) => {
    const body = JSON.parse((await readBody(req)).toString() || '{}'); seen.push({ headers: req.headers, body });
    const r = await reply(body);
    if (r.status) { res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })); }
    const ev = (name, data) => `event: ${name}\ndata: ${JSON.stringify({ type: name, ...data })}\n\n`;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write(ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: r.usage?.input ?? 120, output_tokens: 1 } } }));
    res.write(ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }));
    res.write(ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: r.text || '' } }));
    res.write(ev('content_block_stop', { index: 0 }));
    res.write(ev('message_delta', { delta: { stop_reason: r.stop_reason || 'end_turn', stop_sequence: null }, usage: { output_tokens: r.usage?.output ?? 800 } }));
    res.write(ev('message_stop', {})); res.end();
  });
  const port = await listen(server);
  return { base: `http://127.0.0.1:${port}`, seen, close: () => new Promise((r) => server.close(r)) };
}
