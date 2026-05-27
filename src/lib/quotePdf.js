import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont'
import { YOKOOL_LOGO, YOKOOL_LOGO_RATIO } from './logoData'

const BRAND = [220, 20, 59] // #dc143b
const INK = [31, 36, 48]
const SOFT = [91, 97, 112]

// ⚠️ Thông tin công ty (hiện trên báo giá)
const SELLER = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, phường Bắc Giang, tỉnh Bắc Ninh',
  office: 'VPĐD tại Hà Nội: 18LK19, KĐT Văn Khê, phường Hà Đông, TP Hà Nội',
  taxCode: '2400833385',
  email: 'contact@yokool.vn',
  website: 'https://yokool.vn/b2b',
}

const INTRO = 'Cảm ơn Quý Công ty đã quan tâm và dành thời gian trao đổi với chúng tôi về các sản phẩm của Yokool. Chúng tôi xin được giới thiệu chi tiết sản phẩm kèm báo giá. Rất mong có cơ hội được hợp tác với Quý Công ty!'

const FOOTER_NOTE = [
  'Đơn giá đã bao gồm thuế VAT và phí vận chuyển.',
  'Chính sách bảo hành chính hãng 12 tháng.',
  'Đối với đơn hàng số lượng lớn hơn, vui lòng liên hệ chúng tôi để có giá tốt hơn.',
  'Báo giá có giá trị trong vòng 15 ngày.',
  'Liên hệ: Mr. Trường - Sales Manager: 0906 079 936',
]

const SIGNER = { name: 'Vũ Văn Cường', title: 'Giám đốc' }

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : ''

export function exportQuotePDF(quote) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // Nhúng font tiếng Việt
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')

  const W = doc.internal.pageSize.getWidth()
  const M = 15
  let y = 14

  // ===== KHỐI TRÁI: logo YOKOOL + B2B (dòng 1), slogan (dòng 2) =====
  const titleH = 5.4 // chiều cao logo (mm) — giảm 40% từ 9
  const titleLogoW = titleH * YOKOOL_LOGO_RATIO
  try { doc.addImage(YOKOOL_LOGO, 'PNG', M, y - titleH + 1.5, titleLogoW, titleH) } catch (e) { /* noop */ }
  doc.setFont('Roboto', 'bold').setFontSize(11.5).setTextColor(...INK) // giảm từ 19
  doc.text(' B2B', M + titleLogoW, y)
  // Slogan xuống dưới logo
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT) // giảm từ 13
  doc.text('Premium Tech gifts for Business', M, y + 5)

  // ===== KHỐI PHẢI: thông tin công ty, căn LỀ PHẢI (mép phải thẳng đuôi vạch đỏ) =====
  // Dòng tên công ty NGANG HÀNG (cùng baseline) với "YOKOOL B2B"
  let ry = y
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
  const nameLines = doc.splitTextToSize(SELLER.name, W - M - W * 0.40)
  nameLines.forEach((ln) => { doc.text(ln, W - M, ry, { align: 'right' }); ry += 4.2 })
  ry += 1
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text(`Địa chỉ: ${SELLER.address}`, W - M, ry, { align: 'right' }); ry += 4
  doc.text(SELLER.office, W - M, ry, { align: 'right' }); ry += 4
  doc.text(`MST: ${SELLER.taxCode}`, W - M, ry, { align: 'right' }); ry += 4
  doc.text(`Email: ${SELLER.email}  •  Website: ${SELLER.website}`, W - M, ry, { align: 'right' })

  // ===== Vạch kẻ đỏ — mảnh (50% độ đậm), sát ngay dưới dòng email =====
  y = Math.max(ry, y + 5) + 2
  doc.setDrawColor(...BRAND).setLineWidth(0.3).line(M, y, W - M, y)

  // ===== "BÁO GIÁ" xuống dưới vạch đỏ ~2cm (căn giữa) + Số/Ngày lệch phải =====
  y += 20 // ~2cm dưới vạch đỏ (thấp hơn 1cm so với trước)
  doc.setFont('Roboto', 'bold').setFontSize(22).setTextColor(...BRAND)
  doc.text('BÁO GIÁ', W / 2, y, { align: 'center' })
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
  doc.text(`Số: ${quote.quote_number || ''}`, W - M, y + 8, { align: 'right' })
  doc.text(`Ngày: ${fmtDate(quote.created_at || new Date())}`, W - M, y + 12.5, { align: 'right' })
  if (quote.valid_until) doc.text(`Hiệu lực đến: ${fmtDate(quote.valid_until)}`, W - M, y + 17, { align: 'right' })

  y += (quote.valid_until ? 22 : 17)

  // ===== Thông tin khách hàng =====
  doc.setFont('Roboto', 'bold').setFontSize(9.5).setTextColor(...INK)
  doc.text('KÍNH GỬI:', M, y)
  doc.setFont('Roboto', 'bold').setFontSize(11)
  doc.text(quote.company_name || '', M, y + 6)
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
  let cy = y + 11
  if (quote.address) { doc.text(`Địa chỉ: ${quote.address}`, M, cy); cy += 5 }
  if (quote.tax_code) { doc.text(`MST: ${quote.tax_code}`, M, cy); cy += 5 }
  if (quote.contact_person) { doc.text(`Người liên hệ: ${quote.contact_person}`, M, cy); cy += 5 }
  if (quote.contact_email) { doc.text(`Email: ${quote.contact_email}`, M, cy); cy += 5 }

  // ===== Lời cảm ơn / giới thiệu =====
  cy += 2
  doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...INK)
  const introLines = doc.splitTextToSize(INTRO, W - 2 * M)
  introLines.forEach((ln) => { doc.text(ln, M, cy); cy += 5 })

  y = cy + 4

  // ===== Bảng mặt hàng =====
  const items = quote.items || []
  const rows = items.map((it, i) => [
    String(i + 1),
    it.name,
    it.model || '',
    `${fmt(it.qty)} ${it.unit || ''}`,
    `${fmt(it.price)} đ`,
    `${fmt((Number(it.qty) || 0) * (Number(it.price) || 0))} đ`,
  ])

  autoTable(doc, {
    startY: y,
    head: [['STT', 'Mặt hàng', 'Model', 'Số lượng', 'Đơn giá', 'Thành tiền']],
    body: rows,
    margin: { left: M, right: M },
    theme: 'grid', // có viền các ô
    tableLineColor: [210, 210, 208],
    tableLineWidth: 0.1,
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2.5, textColor: INK, lineColor: [225, 225, 223], lineWidth: 0.1 },
    // Tiêu đề căn giữa cho cân xứng
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: INK, textColor: [255, 255, 255], fontSize: 9, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },           // STT
      1: { halign: 'left' },                             // Mặt hàng (co giãn)
      2: { halign: 'center', cellWidth: 26 },            // Model
      3: { halign: 'center', cellWidth: 22 },            // Số lượng
      4: { halign: 'right', cellWidth: 28 },             // Đơn giá
      5: { halign: 'right', cellWidth: 32 },             // Thành tiền
    },
    alternateRowStyles: { fillColor: [250, 250, 249] },
  })

  // ===== Tổng kết =====
  const sub = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const disc = Number(quote.discount) || 0
  const afterDisc = sub - disc
  const vat = afterDisc * (Number(quote.vat_percent) || 0) / 100
  const total = afterDisc + vat

  let ty = doc.lastAutoTable.finalY
  ty += 6
  const labelX = W - M - 60
  const valX = W - M

  const line = (label, val, bold = false, color = SOFT) => {
    doc.setFont('Roboto', bold ? 'bold' : 'normal').setFontSize(bold ? 11 : 9.5).setTextColor(...color)
    doc.text(label, labelX, ty)
    doc.text(val, valX, ty, { align: 'right' })
    ty += bold ? 8 : 6
  }
  line('Tạm tính:', `${fmt(sub)} đ`)
  if (disc > 0) line('Chiết khấu:', `- ${fmt(disc)} đ`)
  line(`VAT (${quote.vat_percent || 0}%):`, `${fmt(vat)} đ`)
  // Gạch ngang đỏ: cách dòng VAT phía trên ~4mm
  const ruleY = ty - 2
  doc.setDrawColor(...BRAND).setLineWidth(0.4).line(labelX, ruleY, valX, ruleY)
  // TỔNG CỘNG cách gạch đỏ một khoảng bằng khoảng cách từ gạch tới dòng trên (~4mm)
  ty = ruleY + 6
  line('TỔNG CỘNG:', `${fmt(total)} đ`, true, BRAND)

  const afterTotalY = ty // mốc ngay dưới dòng Tổng cộng

  // (Viền ô bảng hàng hóa do theme 'grid' của autoTable lo; phần tổng cộng KHÔNG bo viền)

  // ===== Ghi chú thêm (nếu user nhập) =====
  let gy = afterTotalY
  if (quote.notes) {
    gy += 4
    doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
    doc.text('Ghi chú thêm:', M, gy)
    doc.setFont('Roboto', 'normal').setTextColor(...SOFT)
    const split = doc.splitTextToSize(quote.notes, W - 2 * M)
    doc.text(split, M, gy + 5)
    gy += 5 + split.length * 5
  }

  // ===== Khối "Lưu ý" — lui xuống thấp hơn dòng Tổng cộng khoảng 2cm =====
  let ny = Math.max(afterTotalY + 20, gy + 4) // 20mm ≈ 2cm dưới Tổng cộng
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
  doc.text('Lưu ý:', M, ny)
  ny += 5
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  FOOTER_NOTE.forEach((n) => {
    const lines = doc.splitTextToSize(`-  ${n}`, W - 2 * M - 55)
    doc.text(lines, M, ny)
    ny += lines.length * 4.5
  })
  const noteEndY = ny // mốc kết thúc khối Lưu ý (dòng "Liên hệ: Mr. Trường...")

  // ===== Phần ký — nằm DƯỚI khối Lưu ý ~1cm, căn về LỀ TRÁI (thẳng hàng "Lưu ý") =====
  const sigLeftX = M
  const sigValX = sigLeftX + 32 // cột giá trị thẳng hàng
  let sigY = noteEndY + 10 // 10mm ≈ 1cm dưới dòng cuối phần Lưu ý

  // Dòng "Người làm báo giá:" — giá trị in đậm
  doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...INK)
  doc.text('Người làm báo giá:', sigLeftX, sigY)
  doc.setFont('Roboto', 'bold')
  doc.text(SIGNER.name, sigValX, sigY)

  // Dòng "Chức vụ:" — giá trị in đậm
  doc.setFont('Roboto', 'normal')
  doc.text('Chức vụ:', sigLeftX, sigY + 6)
  doc.setFont('Roboto', 'bold')
  doc.text(SIGNER.title, sigValX, sigY + 6)

  // Dòng "Chữ ký và dấu" + đường kẻ ký
  doc.setFont('Roboto', 'normal').setTextColor(...INK)
  doc.text('Chữ ký và dấu', sigLeftX, sigY + 14)
  doc.setDrawColor(...INK).setLineWidth(0.3)
  doc.line(sigValX, sigY + 15, sigValX + 42, sigY + 15)

  doc.save(`${quote.quote_number || 'bao-gia'}.pdf`)
}
