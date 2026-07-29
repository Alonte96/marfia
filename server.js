// Werewolf Night — API proxy.
// One job: forward chat requests to the Anthropic API with the key from .env,
// so the key never reaches the browser.
import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8787;

// Always answers 200 with either the upstream message payload or an {error}
// body — the client validates the payload and falls back on {error}, and a
// 200 keeps the browser console free of resource-load noise when degraded.
app.post('/api/chat', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.json({
      error: 'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key from console.anthropic.com.',
    });
    return;
  }
  const { model, max_tokens, messages } = req.body || {};
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
      console.error('[werewolf-night] upstream error', upstream.status, JSON.stringify(data).slice(0, 300));
      res.json({ error: data?.error || data });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('[werewolf-night] proxy error', err);
    res.json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`[werewolf-night] proxy listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[werewolf-night] WARNING: no ANTHROPIC_API_KEY in .env — AI characters will fall back to random moves.');
  }
});
