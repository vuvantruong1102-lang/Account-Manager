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
  let y = 16

  // ===== Dòng tiêu đề trên cùng: [logo YOKOOL] B2B - Premium Tech gifts for Business =====
  const titleH = 6 // chiều cao logo trong dòng tiêu đề (mm)
  const titleLogoW = titleH * YOKOOL_LOGO_RATIO
  try { doc.addImage(YOKOOL_LOGO, 'PNG', M, y - titleH + 1, titleLogoW, titleH) } catch (e) { /* noop */ }
  doc.setFont('Roboto', 'bold').setFontSize(13).setTextColor(...INK)
  doc.text(' B2B', M + titleLogoW, y)
  const afterB2B = M + titleLogoW + doc.getTextWidth(' B2B')
  doc.setFont('Roboto', 'normal').setFontSize(11).setTextColor(...SOFT)
  doc.text('  -  Premium Tech gifts for Business', afterB2B, y)

  y += 8

  // ===== Thông tin công ty (trái) + nhãn BÁO GIÁ (phải) =====
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
  const nameLines = doc.splitTextToSize(SELLER.name, W - 2 * M - 50)
  doc.text(nameLines, M, y)
  let sy = y + nameLines.length * 4.2 + 1
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text(`Địa chỉ: ${SELLER.address}`, M, sy); sy += 4
  doc.text(SELLER.office, M, sy); sy += 4
  doc.text(`MST: ${SELLER.taxCode}`, M, sy); sy += 4
  doc.text(`Email: ${SELLER.email}  •  Website: ${SELLER.website}`, M, sy); sy += 4

  doc.setFont('Roboto', 'bold').setFontSize(22).setTextColor(...BRAND)
  doc.text('BÁO GIÁ', W - M, y + 2, { align: 'right' })
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
  doc.text(`Số: ${quote.quote_number || ''}`, W - M, y + 8, { align: 'right' })
  doc.text(`Ngày: ${fmtDate(quote.created_at || new Date())}`, W - M, y + 12.5, { align: 'right' })
  if (quote.valid_until) doc.text(`Hiệu lực đến: ${fmtDate(quote.valid_until)}`, W - M, y + 17, { align: 'right' })

  y = Math.max(sy, y + 19) + 3
  doc.setDrawColor(...BRAND).setLineWidth(0.6).line(M, y, W - M, y)
  y += 8

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
  doc.text(introLines, M, cy)
  cy += introLines.length * 5

  y = cy + 4

  // ===== Bảng mặt hàng =====
  const items = quote.items || []
  const rows = items.map((it, i) => [
    String(i + 1),
    it.name,
    `${fmt(it.qty)} ${it.unit || ''}`,
    `${fmt(it.price)} đ`,
    `${fmt((Number(it.qty) || 0) * (Number(it.price) || 0))} đ`,
  ])

  autoTable(doc, {
    startY: y,
    head: [['STT', 'Mặt hàng', 'Số lượng', 'Đơn giá', 'Thành tiền']],
    body: rows,
    margin: { left: M, right: M },
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2.5, textColor: INK, lineColor: [236, 236, 234] },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: INK, textColor: [255, 255, 255], fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 35 },
    },
    alternateRowStyles: { fillColor: [250, 250, 249] },
  })

  // ===== Tổng kết =====
  const sub = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const disc = Number(quote.discount) || 0
  const afterDisc = sub - disc
  const vat = afterDisc * (Number(quote.vat_percent) || 0) / 100
  const total = afterDisc + vat

  let ty = doc.lastAutoTable.finalY + 6
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
  doc.setDrawColor(...BRAND).setLineWidth(0.4).line(labelX, ty - 2, valX, ty - 2)
  ty += 2
  line('TỔNG CỘNG:', `${fmt(total)} đ`, true, BRAND)

  const afterTotalY = ty // mốc ngay dưới dòng Tổng cộng

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

  // ===== Chữ ký (bên phải, ngang khối Lưu ý) =====
  const sigX = W - M - 40
  let sigY = Math.max(afterTotalY + 20, ny - (FOOTER_NOTE.length * 4.5 + 5))
  doc.setFont('Roboto', 'bold').setFontSize(9.5).setTextColor(...INK)
  doc.text('ĐẠI DIỆN BÊN BÁN', sigX, sigY, { align: 'center' })
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text('(Ký, ghi rõ họ tên)', sigX, sigY + 5, { align: 'center' })
  // "(Đã ký)" ngay dưới
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
  doc.text('(Đã ký)', sigX, sigY + 11, { align: 'center' })
  // Tên giám đốc cách "(Đã ký)" khoảng 1cm (10mm)
  doc.setFont('Roboto', 'bold').setFontSize(10).setTextColor(...INK)
  doc.text(SIGNER.name, sigX, sigY + 21, { align: 'center' })
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  doc.text(`(${SIGNER.title})`, sigX, sigY + 26, { align: 'center' })

  doc.save(`${quote.quote_number || 'bao-gia'}.pdf`)
}
