import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont'
import { YOKOOL_LOGO, YOKOOL_LOGO_RATIO } from './logoData'
import { docSoThanhChu } from './numberToWords'

const BRAND = [220, 20, 59]
const INK = [31, 36, 48]
const SOFT = [91, 97, 112]

const SELLER = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, phường Bắc Giang, tỉnh Bắc Ninh',
  office: 'VPĐD tại Hà Nội: 18LK19, KĐT Văn Khê, phường Hà Đông, TP Hà Nội',
  taxCode: '2400883385',
  email: 'contact@yokool.vn',
  phone: '0822 838 665',
}

const SIGNER = { name: 'Vũ Văn Cường', title: 'Giám đốc' }

// Lý do / căn cứ (đặt ngay dưới "Kính gửi") — {hd} = số hợp đồng, {buyer} = tên KH
export const DEFAULT_PAYMENT_ORDER_DESC =
  'Căn cứ hợp đồng số {hd} giữa Công ty TNHH Thương mại dịch vụ và sản xuất VNF Việt Nam và {buyer}.'

// Nội dung chính — dòng "Bằng số"/"Bằng chữ" sẽ được điền khi nhập số tiền đề nghị
export const DEFAULT_PAYMENT_NOTES =
  'Căn cứ điều khoản thanh toán của hợp đồng, chúng tôi kính đề nghị Quý công ty thanh toán số tiền:\n' +
  'Bằng số: \n' +
  'Bằng chữ: \n' +
  'vào tài khoản của công ty chúng tôi:\n' +
  'Chủ tài khoản: Công ty TNHH thương mại dịch vụ và sản xuất VNF Việt Nam\n' +
  'Số tài khoản: 19135661522015\n' +
  'Tại ngân hàng: Thương mại cổ phần Kỹ thương Việt Nam (Techcombank)\n' +
  '\n' +
  'Xin chân thành cảm ơn sự hợp tác của Quý Công ty!'

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN')
const fmtDate = (d) => {
  const dt = d ? new Date(d) : new Date()
  return `Hà Nội, ngày ${String(dt.getDate()).padStart(2, '0')} tháng ${String(dt.getMonth() + 1).padStart(2, '0')} năm ${dt.getFullYear()}`
}
const imgFmt = (url) => (url && url.startsWith('data:image/png')) ? 'PNG' : 'JPEG'

// Roboto không có bộ glyph Italic riêng nên "nghiêng" hiển thị như chữ thường (không skew để tránh lỗi vẽ)
function italicText(doc, txt, x, y, opts = {}) {
  const prev = doc.getFont()
  doc.setFont('Roboto', /bold/i.test(prev.fontStyle || '') ? 'bold' : 'normal')
  doc.text(txt, x, y, opts)
  doc.setFont('Roboto', prev.fontStyle || 'normal')
}

// Tách 1 dòng markdown thành các đoạn {text, bold}. Hỗ trợ **đậm** và *nghiêng*.
function parseMd(line) {
  const tokens = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0, m
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), bold: false })
    const t = m[0]
    if (t.startsWith('**')) tokens.push({ text: t.slice(2, -2), bold: true })
    else tokens.push({ text: t.slice(1, -1), bold: false, italic: true })
    last = m.index + t.length
  }
  if (last < line.length) tokens.push({ text: line.slice(last), bold: false })
  return tokens.length ? tokens : [{ text: line, bold: false }]
}

// Vẽ đoạn văn có markdown, tự xuống dòng theo maxW. Trả về y mới.
// Font Times có bộ Italic riêng nên *nghiêng* hiển thị nghiêng thật.
function drawMdParagraph(doc, text, x, y, maxW, lh, fontSize, INK) {
  doc.setFontSize(fontSize).setTextColor(...INK)
  String(text).split('\n').forEach((rawLine) => {
    // Thụt dòng: đếm khoảng trắng đầu dòng → chuyển thành lề trái tạm
    const indentMatch = rawLine.match(/^(\s+)/)
    const indent = indentMatch ? doc.getTextWidth(indentMatch[1].replace(/\t/g, '    ')) : 0
    const line = rawLine.replace(/^\s+/, '')
    const tokens = parseMd(line)
    let cursorX = x + indent
    tokens.forEach((tk) => {
      doc.setFont('Roboto', tk.bold ? 'bold' : 'normal')
      const words = tk.text.split(/(\s+)/)
      words.forEach((w) => {
        if (w === '') return
        const ww = doc.getTextWidth(w)
        if (cursorX + ww > x + maxW && w.trim() !== '') { y += lh; cursorX = x + indent }
        if (tk.italic) italicText(doc, w, cursorX, y)
        else doc.text(w, cursorX, y)
        cursorX += ww
      })
    })
    y += lh
  })
  return y
}

function addFonts(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  // Roboto chỉ có normal + bold; map italic/bolditalic về normal/bold để không lỗi
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'italic')
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bolditalic')
  doc.setFont('Roboto', 'normal')
}

function drawHeader(doc, W, M) {
  let y = 14
  const titleH = 6.5
  const titleLogoW = titleH * YOKOOL_LOGO_RATIO
  try { doc.addImage(YOKOOL_LOGO, 'PNG', M, y - titleH + 1.8, titleLogoW, titleH) } catch (e) {}
  doc.setFont('Roboto', 'bold').setFontSize(13.8).setTextColor(...INK)
  doc.text(' B2B', M + titleLogoW, y)
  doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...SOFT)
  doc.text('Premium Tech gifts for Business', M, y + 6)

  let ry = y
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
  const blockLeft = W - M - W * 0.52
  const nameLines = doc.splitTextToSize(SELLER.name, W - M - blockLeft)
  nameLines.forEach((ln) => { doc.text(ln, W - M, ry, { align: 'right' }); ry += 4.2 })
  ry += 1
  const nameWidth = Math.max(...nameLines.map((ln) => doc.getTextWidth(ln)))
  const infoLeft = (W - M) - nameWidth
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text(`Địa chỉ: ${SELLER.address}`, infoLeft, ry); ry += 4
  doc.text(SELLER.office, infoLeft, ry); ry += 4
  doc.text(`Mã số thuế: ${SELLER.taxCode}`, infoLeft, ry); ry += 4
  doc.text(`Điện thoại: ${SELLER.phone}  •  Email: ${SELLER.email}`, infoLeft, ry)

  return Math.max(ry, y + 6) + 4
}

export function exportPaymentPDF(req) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addFonts(doc)

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15

  let y = drawHeader(doc, W, M)

  // Ngày tháng (in nghiêng, phải)
  y += 6
  doc.setFont('Roboto', 'normal').setFontSize(11.5).setTextColor(...INK)
  italicText(doc, fmtDate(req.created_at), W - M, y, { align: 'right' })

  // Tiêu đề (đẩy xuống thấp hơn 1 hàng)
  y += 16
  doc.setFont('Roboto', 'bold').setFontSize(18).setTextColor(...INK)
  doc.text('GIẤY ĐỀ NGHỊ THANH TOÁN', W / 2, y, { align: 'center' })
  y += 6.5
  doc.setFont('Roboto', 'normal').setFontSize(12.5).setTextColor(...INK)
  doc.text(`Số ${req.doc_number || 'DN03'}`, W / 2, y, { align: 'center' })
  doc.setTextColor(...INK)

  // Kính gửi (khách hàng)
  y += 16
  doc.setFont('Roboto', 'normal').setFontSize(12.5).setTextColor(...INK)
  const labelX = M
  const valX = M + 24
  doc.setFont('Roboto', 'bold')
  doc.text('Kính gửi:', labelX, y)
  const cname = (req.company_name || '').toUpperCase()
  doc.splitTextToSize(cname, W - M - valX).forEach((ln) => { doc.text(ln, valX, y); y += 6 })
  doc.setFont('Roboto', 'normal')
  if (req.address) {
    doc.text('Địa chỉ:', labelX, y)
    doc.splitTextToSize(req.address, W - M - valX).forEach((ln) => { doc.text(ln, valX, y); y += 6 })
  }
  if (req.tax_code) {
    doc.text('MST:', labelX, y)
    doc.text(String(req.tax_code), valX, y); y += 6
  }
  y += 4

  // Nội dung "Căn cứ..." — dưới Kính gửi, hỗ trợ markdown
  if (req.order_desc && req.order_desc.trim()) {
    y = drawMdParagraph(doc, req.order_desc, M, y, W - 2 * M, 6.3, 12.5, INK)
    y += 4
  }

  // Bảng mặt hàng (có thể ẩn) — hiển thị ĐƠN GIÁ và THÀNH TIỀN đã bao gồm VAT, làm tròn
  const showItems = req.show_items !== false
  const items = req.items || []
  const rate = req.use_vat !== false ? (Number(req.vat_percent) || 0) : 0
  const vatMul = 1 + rate / 100
  const roundTiny = (n) => {
    const near1000 = Math.round(n / 1000) * 1000
    return Math.abs(n - near1000) <= 3 ? near1000 : Math.round(n)
  }
  const unitVat = (it) => Math.round((Number(it.price) || 0) * vatMul)          // đơn giá có VAT (tròn)
  const lineVat = (it) => roundTiny((Number(it.qty) || 0) * (Number(it.price) || 0) * vatMul) // thành tiền có VAT (tròn)
  const total = items.reduce((s, it) => s + lineVat(it), 0)

  if (showItems && items.length) {
    const body = items.map((it, i) => {
      return [String(i + 1), it.name || '', fmt(it.qty), it.unit || '', fmt(unitVat(it)), fmt(lineVat(it))]
    })
    // Chỉ thêm dòng TỔNG CỘNG khi có nhiều hơn 1 mặt hàng
    if (items.length > 1) {
      body.push([
        { content: 'TỔNG CỘNG', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(total), styles: { fontStyle: 'bold', halign: 'right' } },
      ])
    }
    autoTable(doc, {
      startY: y,
      head: [['STT', 'Tên mặt hàng', 'Số lượng', 'Đơn vị', 'Đơn giá\n(Đã có VAT)', 'Thành tiền\n(Đã có VAT)']],
      body,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 11, cellPadding: 2.5, textColor: INK, lineColor: [180, 180, 180], lineWidth: 0.2, valign: 'middle' },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [245, 245, 245], textColor: INK, fontSize: 11, halign: 'center', valign: 'middle', lineColor: [140, 140, 140], lineWidth: 0.2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'right', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 32 },
      },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // Số tiền đề nghị thanh toán: ưu tiên req.amount (người dùng nhập), nếu không có thì lấy tổng đơn
  const requestAmount = (req.amount != null && req.amount !== '') ? Number(req.amount) : total
  const amountWords = docSoThanhChu(requestAmount).replace(/\.$/, '')

  // ----- Nội dung chính: trình bày có cấu trúc, đẹp & chuyên nghiệp -----
  // Tách notes thành các dòng để nhận biết phần số tiền / tài khoản
  let notesRaw = (req.notes && req.notes.trim()) ? req.notes : ''
  notesRaw = notesRaw
    .replace(/\{bằng_số\}/g, fmt(requestAmount))
    .replace(/\{bằng_chữ\}/g, amountWords)

  const lines = notesRaw.split('\n')
  const isSoLine = (l) => /^Bằng số:/i.test(l.trim())
  const isChuLine = (l) => /^Bằng chữ:/i.test(l.trim())
  const isAcctLine = (l) => /^(Chủ tài khoản|Số tài khoản|Tại ngân hàng):/i.test(l.trim())

  const lh = 6.4
  const contentW = W - 2 * M
  lines.forEach((raw) => {
    const l = raw.replace(/\r/g, '')
    if (l.trim() === '') { y += 3; return }

    if (isSoLine(l) || isChuLine(l)) {
      // Dòng số tiền: không in đậm, thụt vào
      const label = isSoLine(l) ? 'Bằng số:' : 'Bằng chữ:'
      let val = l.replace(/^Bằng (số|chữ):\s*/i, '').trim()
      if (!val) val = isSoLine(l) ? `${fmt(requestAmount)} VNĐ` : amountWords
      if (isSoLine(l) && !/VNĐ|VND/i.test(val)) val += ' VNĐ'
      if (y > H - 40) { doc.addPage(); y = 25 }
      doc.setFont('Roboto', 'normal').setFontSize(12).setTextColor(...INK)
      doc.text(label, M + 4, y)
      doc.splitTextToSize(val, contentW - 32).forEach((ln, i) => { doc.text(ln, M + 32, y); if (i > 0) y += lh })
      y += lh + 0.5
      return
    }

    // Dòng thường (kể cả tài khoản) — nhãn KHÔNG in đậm
    if (y > H - 40) { doc.addPage(); y = 25 }
    if (isAcctLine(l)) {
      const idx = l.indexOf(':')
      const label = l.slice(0, idx + 1)
      const val = l.slice(idx + 1).trim()
      doc.setFont('Roboto', 'normal').setFontSize(12).setTextColor(...INK)
      doc.text(label, M + 4, y)
      const lblW = doc.getTextWidth(label + ' ')
      doc.splitTextToSize(val, contentW - 8 - lblW).forEach((ln, i) => { doc.text(ln, M + 4 + lblW, y); if (i > 0) y += lh })
      y += lh
    } else {
      doc.setFont('Roboto', 'normal').setFontSize(12).setTextColor(...INK)
      doc.splitTextToSize(l, contentW).forEach((ln) => { doc.text(ln, M, y); y += lh })
    }
  })
  y += 4

  // Chữ ký — căn phải (bỏ "Trân trọng")
  y += 12
  if (y > H - 45) { doc.addPage(); y = 30 }
  const sigX = W - M - 32   // tâm cụm chữ ký nằm về bên phải
  doc.setFont('Roboto', 'bold').setFontSize(12).setTextColor(...INK)
  doc.text(SIGNER.title, sigX, y, { align: 'center' })
  y += 26
  doc.setFont('Roboto', 'bold')
  doc.text(SIGNER.name, sigX, y, { align: 'center' })

  const fileName = `DNTT_VNF_${req.doc_number || 'DN03'}.pdf`
  doc.save(fileName)
}
