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

function addFonts(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
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
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...INK)
  doc.text(fmtDate(req.created_at), W - M, y, { align: 'right' })

  // Kính gửi (khách hàng)
  y += 10
  doc.setFont('Roboto', 'normal').setFontSize(10).setTextColor(...INK)
  const labelX = M
  const valX = M + 22
  doc.text('Kính gửi:', labelX, y)
  doc.setFont('Roboto', 'bold')
  const cname = (req.company_name || '').toUpperCase()
  doc.splitTextToSize(cname, W - M - valX).forEach((ln) => { doc.text(ln, valX, y); y += 5 })

  doc.setFont('Roboto', 'normal')
  if (req.address) {
    doc.text('Địa chỉ:', labelX, y)
    doc.splitTextToSize(req.address, W - M - valX).forEach((ln) => { doc.text(ln, valX, y); y += 5 })
  }
  if (req.tax_code) {
    doc.text('MST:', labelX, y)
    doc.text(String(req.tax_code), valX, y); y += 5
  }

  // Tiêu đề
  y += 6
  doc.setFont('Roboto', 'bold').setFontSize(16).setTextColor(...INK)
  doc.text('GIẤY ĐỀ NGHỊ THANH TOÁN', W / 2, y, { align: 'center' })
  y += 6
  doc.setFont('Roboto', 'bold').setFontSize(10.5)
  doc.text(`Số ${req.doc_number || 'DN03'}`, W / 2, y, { align: 'center' })

  // Nội dung (chỉ hiển thị nội dung ô nhập, không có nhãn "V/v:")
  y += 10
  if (req.order_desc && req.order_desc.trim()) {
    doc.setFont('Roboto', 'normal').setFontSize(10).setTextColor(...INK)
    doc.splitTextToSize(req.order_desc, W - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 5 })
    y += 3
  }

  // Bảng mặt hàng
  const items = req.items || []
  const body = items.map((it, i) => {
    const unit = Number(it.price) || 0
    const qty = Number(it.qty) || 0
    return [
      String(i + 1),
      it.name || '',
      fmt(qty),
      it.unit || '',
      fmt(unit),
      fmt(qty * unit),
    ]
  })
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  // Dòng tổng cộng
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
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2.5, textColor: INK, lineColor: [180, 180, 180], lineWidth: 0.2, valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [245, 245, 245], textColor: INK, fontSize: 9, halign: 'center', valign: 'middle', lineColor: [140, 140, 140], lineWidth: 0.2 },
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

  // Bằng chữ
  doc.setFont('Roboto', 'bold').setFontSize(10).setTextColor(...INK)
  const bcLabel = 'Bằng chữ: '
  doc.text(bcLabel, M, y)
  const bcW = doc.getTextWidth(bcLabel)
  doc.setFont('Roboto', 'normal')
  doc.splitTextToSize(docSoThanhChu(total), W - M - (M + bcW)).forEach((ln, i) => {
    doc.text(ln, M + bcW, y + i * 5); if (i > 0) y += 5
  })
  y += 10

  // Lưu ý (tùy chỉnh)
  const notes = (req.notes && req.notes.trim()) ? req.notes : DEFAULT_PAYMENT_NOTES
  doc.setFontSize(9.5).setTextColor(...INK)
  notes.split('\n').forEach((raw) => {
    const line = raw.replace(/\s+$/, '')
    // Dòng "Lưu ý:" in đậm
    if (/^Lưu ý:/i.test(line)) doc.setFont('Roboto', 'bold')
    else doc.setFont('Roboto', 'normal')
    const wrapped = doc.splitTextToSize(line, W - 2 * M)
    wrapped.forEach((ln) => { doc.text(ln, M, y); y += 5 })
  })

  // Trân trọng + chữ ký — căn phải
  y += 12
  if (y > H - 45) { doc.addPage(); y = 30 }
  const sigX = W - M - 32   // tâm cụm chữ ký nằm về bên phải
  doc.setFont('Roboto', 'normal').setFontSize(10).setTextColor(...INK)
  doc.text('Trân trọng,', sigX, y, { align: 'center' })
  y += 10
  doc.setFont('Roboto', 'normal')
  doc.text(SIGNER.title, sigX, y, { align: 'center' })
  y += 18
  doc.setFont('Roboto', 'bold')
  doc.text(SIGNER.name, sigX, y, { align: 'center' })

  const fileName = `DeNghiThanhToan_${(req.doc_number || 'DN03')}_${(req.company_name || '').replace(/[^\w]+/g, '_').slice(0, 20)}.pdf`
  doc.save(fileName)
}
