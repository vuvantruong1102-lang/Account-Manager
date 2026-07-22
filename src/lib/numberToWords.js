// Đọc số tiền tiếng Việt (số → chữ), dùng cho Giấy đề nghị thanh toán / báo giá.
// Ví dụ: 5400000 → "Năm triệu, bốn trăm ngàn đồng."

const DONVI = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

// Đọc 3 chữ số (0..999). full=true để đọc đủ "không trăm..." khi ở nhóm sau.
function docBaSo(so, full) {
  let tram = Math.floor(so / 100)
  let chuc = Math.floor((so % 100) / 10)
  let donvi = so % 10
  let out = ''
  if (full || tram > 0) {
    out += DONVI[tram] + ' trăm'
    if (full && tram === 0) out = 'không trăm'
    if (chuc === 0 && donvi > 0) out += ' lẻ'
  }
  if (chuc > 1) {
    out += ' ' + DONVI[chuc] + ' mươi'
    if (donvi === 1) out += ' mốt'
    else if (donvi === 5) out += ' lăm'
    else if (donvi > 0) out += ' ' + DONVI[donvi]
  } else if (chuc === 1) {
    out += ' mười'
    if (donvi === 5) out += ' lăm'
    else if (donvi > 0) out += ' ' + DONVI[donvi]
  } else if (donvi > 0) {
    out += ' ' + DONVI[donvi]
  }
  return out.trim()
}

const HANG = ['', ' ngàn', ' triệu', ' tỷ']

export function docSoThanhChu(amount) {
  let n = Math.round(Number(amount) || 0)
  if (n === 0) return 'Không đồng.'

  // Tách thành các nhóm 3 chữ số từ phải qua trái
  const nhom = []
  while (n > 0) { nhom.unshift(n % 1000); n = Math.floor(n / 1000) }

  let parts = []
  const total = nhom.length
  for (let i = 0; i < total; i++) {
    const so = nhom[i]
    const hangIdx = (total - 1 - i) % 4  // tỷ lặp lại
    // Với nhóm đầu tiên không cần đọc đủ "không trăm"; các nhóm sau đọc đủ nếu >0
    const isFirst = i === 0
    if (so === 0) continue
    const text = docBaSo(so, !isFirst)
    parts.push(text + HANG[hangIdx])
  }

  let result = parts.join(', ').trim()
  // Viết hoa chữ cái đầu
  result = result.charAt(0).toUpperCase() + result.slice(1)
  return result + ' đồng.'
}
