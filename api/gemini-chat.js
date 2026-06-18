import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { message, systemInstruction, history = [] } = req.body;
  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });
    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: systemInstruction ? { systemInstruction } : undefined,
      history,
    });
    const result = await chat.sendMessage({ message });
    res.status(200).json({ text: result.text });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message });
  }
}
