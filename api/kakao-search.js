export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { query, x, y, radius = '3000', size = '20' } = req.query;
  if (!query) { res.status(400).json({ error: 'query required' }); return; }

  const params = new URLSearchParams({ query, size });
  if (x && y) { params.set('x', x); params.set('y', y); params.set('radius', radius); }

  try {
    const r = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
      { headers: { Authorization: `KakaoAK ${process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY}` } }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
