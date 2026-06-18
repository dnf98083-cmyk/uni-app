async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('Invalid JSON: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let imageBase64, prompt;
  try {
    const body = req.body ?? await readBody(req);
    imageBase64 = body.imageBase64;
    prompt = body.prompt;
  } catch (e) {
    return res.status(400).json({ error: 'Body parse error: ' + e.message });
  }

  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'imageBase64 and prompt required' });
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: prompt },
          ],
        }],
        temperature: 0.1,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error?.message ?? 'Groq Vision 오류' });
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
