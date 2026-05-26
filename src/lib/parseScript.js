// Parse nội dung kịch bản sales thành các khối hiển thị đẹp.
// Quy ước AI xuất ra: mỗi lời thoại bắt đầu bằng "NV:" (nhân viên) hoặc "KH:" (khách hàng).
// Dòng dạng "## Tiêu đề" hoặc "[Tiêu đề]" được coi là tiêu đề phần.
export function parseScript(content) {
  if (!content) return []
  const lines = content.split('\n')
  const blocks = []
  for (let raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Tiêu đề phần: bắt đầu bằng #, hoặc dạng (1) ..., hoặc [..]
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push({ kind: 'heading', text: line.replace(/^#{1,3}\s+/, '') })
      continue
    }
    if (/^\(?\d+[\).]\s*[A-ZĐÀ-Ỹ]/.test(line) && line.length < 80 && !/:/.test(line.slice(0, 6))) {
      blocks.push({ kind: 'heading', text: line })
      continue
    }

    // Lời thoại
    const mNV = line.match(/^(NV|Nhân viên|Sales|NVKD)\s*[:\-]\s*(.*)$/i)
    const mKH = line.match(/^(KH|Khách|Khách hàng)\s*[:\-]\s*(.*)$/i)
    if (mNV) { blocks.push({ kind: 'nv', text: mNV[2] }); continue }
    if (mKH) { blocks.push({ kind: 'kh', text: mKH[2] }); continue }

    blocks.push({ kind: 'text', text: line })
  }
  return blocks
}
