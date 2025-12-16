// Vercel Serverless Function: api/generate.js
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    res.status(400).send('Missing prompt in request body');
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      res.status(500).json({ error: 'AI API Error', details: errorBody });
      return;
    }

    const data = await response.json();
    const aiStory = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ story: aiStory });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', details: error.toString() });
  }
}
