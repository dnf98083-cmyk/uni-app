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

  let message, systemInstruction, history = [];
  try {
    const body = req.body ?? await readBody(req);
    message = body.message;
    systemInstruction = body.systemInstruction;
    history = body.history ?? [];
  } catch (e) {
    return res.status(400).json({ error: 'Body parse error: ' + e.message });
  }

  if (!message) { return res.status(400).json({ error: 'message required' }); }

  const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const contents = [...history, { role: 'user', parts: [{ text: message }] }];

  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          contents,
          ...(systemInstruction && {
            systemInstruction: { parts: [{ text: systemInstruction }] },
          }),
          generationConfig: { temperature: 0.9 },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error?.message ?? 'Gemini API 오류' });
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
