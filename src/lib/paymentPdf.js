import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { TIMES_REGULAR, TIMES_BOLD, TIMES_ITALIC, TIMES_BOLDITALIC } from './timesFont'
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

export const DEFAULT_PAYMENT_NOTES =
  'Lưu ý:\n' +
  '(i)   Điều khoản thanh toán: Thanh toán 100% đơn hàng sau khi nhận được đề nghị thanh toán\n' +
  '(ii)  Vui lòng thanh toán bằng tiền mặt hoặc chuyển khoản vào tài khoản sau:\n' +
  'Chủ tài khoản: Công ty TNHH thương mại dịch vụ và sản xuất VNF Việt Nam\n' +
  'Số tài khoản: 19135661522015\n' +
  'Tại ngân hàng: Thương mại cổ phần Kỹ thương Việt Nam (Techcombank)\n' +
  '(iii) Vui lòng thanh toán trong vòng năm (05) ngày kể từ ngày đề nghị thanh toán.'

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const fmtDate = (d) => {
  const dt = d ? new Date(d) : new Date()
  return `Hà Nội, ngày ${String(dt.getDate()).padStart(2, '0')} tháng ${String(dt.getMonth() + 1).padStart(2, '0')} năm ${dt.getFullYear()}`
}
const imgFmt = (url) => (url && url.startsWith('data:image/png')) ? 'PNG' : 'JPEG'

// In nghiêng thật (font Times có bộ Italic riêng)
function italicText(doc, txt, x, y, opts) {
  const prev = doc.getFont()
  const bold = /bold/i.test(prev.fontStyle || '')
  doc.setFont('Times', bold ? 'bolditalic' : 'italic')
  doc.text(txt, x, y, opts)
  doc.setFont('Times', prev.fontStyle || 'normal')
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
      doc.setFont('Times', tk.bold ? 'bold' : 'normal')
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
  doc.addFileToVFS('Times-Regular.ttf', TIMES_REGULAR)
  doc.addFont('Times-Regular.ttf', 'Times', 'normal')
  doc.addFileToVFS('Times-Bold.ttf', TIMES_BOLD)
  doc.addFont('Times-Bold.ttf', 'Times', 'bold')
  doc.addFileToVFS('Times-Italic.ttf', TIMES_ITALIC)
  doc.addFont('Times-Italic.ttf', 'Times', 'italic')
  doc.addFileToVFS('Times-BoldItalic.ttf', TIMES_BOLDITALIC)
  doc.addFont('Times-BoldItalic.ttf', 'Times', 'bolditalic')
  doc.setFont('Times', 'normal')
}

function drawHeader(doc, W, M) {
  let y = 14
  const titleH = 6.5
  const titleLogoW = titleH * YOKOOL_LOGO_RATIO
  try { doc.addImage(YOKOOL_LOGO, 'PNG', M, y - titleH + 1.8, titleLogoW, titleH) } catch (e) {}
  doc.setFont('Times', 'bold').setFontSize(13.8).setTextColor(...INK)
  doc.text(' B2B', M + titleLogoW, y)
  doc.setFont('Times', 'normal').setFontSize(9.5).setTextColor(...SOFT)
  doc.text('Premium Tech gifts for Business', M, y + 6)

  let ry = y
  doc.setFont('Times', 'bold').setFontSize(9).setTextColor(...INK)
  const blockLeft = W - M - W * 0.52
  const nameLines = doc.splitTextToSize(SELLER.name, W - M - blockLeft)
  nameLines.forEach((ln) => { doc.text(ln, W - M, ry, { align: 'right' }); ry += 4.2 })
  ry += 1
  const nameWidth = Math.max(...nameLines.map((ln) => doc.getTextWidth(ln)))
  const infoLeft = (W - M) - nameWidth
  doc.setFont('Times', 'normal').setFontSize(8).setTextColor(...SOFT)
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
  doc.setFont('Times', 'normal').setFontSize(11.5).setTextColor(...INK)
  italicText(doc, fmtDate(req.created_at), W - M, y, { align: 'right' })

  // Tiêu đề
  y += 10
  doc.setFont('Times', 'bold').setFontSize(18).setTextColor(...INK)
  doc.text('GIẤY ĐỀ NGHỊ THANH TOÁN', W / 2, y, { align: 'center' })
  y += 6.5
  doc.setFont('Times', 'bold').setFontSize(12.5)
  doc.text(`Số ${req.doc_number || 'DN03'}`, W / 2, y, { align: 'center' })

  // Kính gửi (khách hàng) — đặt TRÊN dòng "Căn cứ...", cách tiêu đề 2 hàng
  y += 21
  doc.setFont('Times', 'normal').setFontSize(12.5).setTextColor(...INK)
  const labelX = M
  const valX = M + 24
  doc.text('Kính gửi:', labelX, y)
  doc.setFont('Times', 'bold')
  const cname = (req.company_name || '').toUpperCase()
  doc.splitTextToSize(cname, W - M - valX).forEach((ln) => { doc.text(ln, valX, y); y += 6 })
  doc.setFont('Times', 'normal')
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

  // Bảng mặt hàng (có thể ẩn)
  const showItems = req.show_items !== false
  const items = req.items || []
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)

  if (showItems && items.length) {
    const body = items.map((it, i) => {
      const unit = Number(it.price) || 0
      const qty = Number(it.qty) || 0
      return [String(i + 1), it.name || '', fmt(qty), it.unit || '', fmt(unit), fmt(qty * unit)]
    })
    body.push([
      { content: 'TỔNG CỘNG', colSpan: 5, styles: { fontStyle: 'bold', halign: 'left' } },
      { content: fmt(total), styles: { fontStyle: 'bold', halign: 'right' } },
    ])
    autoTable(doc, {
      startY: y,
      head: [['STT', 'Tên mặt hàng', 'Số lượng', 'Đơn vị', 'Đơn giá\n(Đã có VAT)', 'Thành tiền\n(VNĐ)']],
      body,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { font: 'Times', fontSize: 11, cellPadding: 2.5, textColor: INK, lineColor: [180, 180, 180], lineWidth: 0.2, valign: 'middle' },
      headStyles: { font: 'Times', fontStyle: 'bold', fillColor: [245, 245, 245], textColor: INK, fontSize: 11, halign: 'center', valign: 'middle', lineColor: [140, 140, 140], lineWidth: 0.2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 30 },
      },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // Nội dung chính (markdown: **đậm**, *nghiêng*)
  const mainText = (req.notes && req.notes.trim()) ? req.notes : ''
  if (mainText) {
    y = drawMdParagraph(doc, mainText, M, y, W - 2 * M, 6.5, 12.5, INK)
    y += 4
  }

  // Trân trọng + chữ ký — căn phải
  y += 12
  if (y > H - 45) { doc.addPage(); y = 30 }
  const sigX = W - M - 32   // tâm cụm chữ ký nằm về bên phải
  doc.setFont('Times', 'normal').setFontSize(12).setTextColor(...INK)
  doc.text('Trân trọng,', sigX, y, { align: 'center' })
  y += 10
  doc.setFont('Times', 'normal')
  doc.text(SIGNER.title, sigX, y, { align: 'center' })
  y += 18
  doc.setFont('Times', 'bold')
  doc.text(SIGNER.name, sigX, y, { align: 'center' })

  const fileName = `DNTT_VNF_${req.doc_number || 'DN03'}.pdf`
  doc.save(fileName)
}
