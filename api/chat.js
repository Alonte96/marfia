// Vercel serverless version of the proxy (server.js is the local-dev twin).
// One job: forward chat requests to the Anthropic API with a server-side key,
// so the key never reaches the browser.
//
// Key resolution: the ANTHROPIC_API_KEY env var (Vercel dashboard) wins; a
// deploy-time-only api/_secret.js helper is the fallback. That helper is not
// in the repo (gitignored) and Vercel never serves api/ files as raw source.
async function resolveKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const mod = await import('./_secret.js');
    return mod.ANTHROPIC_API_KEY || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const key = await resolveKey();
  if (!key) {
    res.json({ error: 'No API key configured. Set ANTHROPIC_API_KEY in the Vercel project settings.' });
    return;
  }
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  const { model, max_tokens, messages } = body;
  if (!model || !messages) {
    res.json({ error: 'model and messages are required' });
    return;
  }
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: max_tokens || 1000, messages }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('upstream error', upstream.status, JSON.stringify(data).slice(0, 300));
      res.json({ error: data?.error || data });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('proxy error', err);
    res.json({ error: String(err) });
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
