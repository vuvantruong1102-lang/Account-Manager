// Gọi AI qua serverless function (api/ai.js) để không lộ API key ở frontend.
export async function aiGenerate(prompt) {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return `[Lỗi AI] ${err.error || res.statusText}. Hãy kiểm tra biến môi trường OPENAI_API_KEY trên Vercel.`
    }
    const data = await res.json()
    return data.text || '(AI không trả về nội dung)'
  } catch (e) {
    return `[Lỗi kết nối AI] ${e.message}`
  }
}
