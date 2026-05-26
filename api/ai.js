// Vercel Serverless Function — gọi OpenAI an toàn phía server.
// Cần đặt biến môi trường OPENAI_API_KEY trên Vercel.
// (Tùy chọn) OPENAI_MODEL, mặc định gpt-4o-mini.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình OPENAI_API_KEY' })
  }

  try {
    const { prompt } = req.body || {}
    if (!prompt) return res.status(400).json({ error: 'Thiếu prompt' })

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Bạn là trợ lý bán hàng chuyên nghiệp cho công ty quà tặng công nghệ tại Việt Nam. Trả lời bằng tiếng Việt tự nhiên, súc tích.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    })

    if (!r.ok) {
      const t = await r.text()
      return res.status(502).json({ error: `OpenAI lỗi: ${t.slice(0, 200)}` })
    }
    const data = await r.json()
    const text = data.choices?.[0]?.message?.content?.trim() || ''
    return res.status(200).json({ text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
