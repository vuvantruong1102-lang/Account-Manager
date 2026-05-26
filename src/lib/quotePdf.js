import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont'

const BRAND = [220, 20, 59] // #dc143b
const INK = [31, 36, 48]
const SOFT = [91, 97, 112]

// ⚠️ CHỈNH THÔNG TIN CÔNG TY BẠN Ở ĐÂY
const SELLER = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, phường Bắc Giang, tỉnh Bắc Ninh',
  phone: '0822 838 665',
  email: 'contact@yokool.vn',
  taxCode: '2400883385',
}

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
  let y = 18

  // ===== Header: tên người bán + nhãn BÁO GIÁ =====
  doc.setFont('Roboto', 'bold').setFontSize(15).setTextColor(...BRAND)
  doc.text(SELLER.name, M, y)
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  doc.text(SELLER.address, M, y + 5)
  doc.text(`ĐT: ${SELLER.phone}  •  Email: ${SELLER.email}`, M, y + 9.5)
  doc.text(`MST: ${SELLER.taxCode}`, M, y + 14)

  doc.setFont('Roboto', 'bold').setFontSize(22).setTextColor(...INK)
  doc.text('BÁO GIÁ', W - M, y + 2, { align: 'right' })
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
  doc.text(`Số: ${quote.quote_number || ''}`, W - M, y + 8, { align: 'right' })
  doc.text(`Ngày: ${fmtDate(quote.created_at || new Date())}`, W - M, y + 12.5, { align: 'right' })
  if (quote.valid_until) doc.text(`Hiệu lực đến: ${fmtDate(quote.valid_until)}`, W - M, y + 17, { align: 'right' })

  y += 24
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

  // ===== Ghi chú =====
  if (quote.notes) {
    ty += 4
    doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
    doc.text('Ghi chú:', M, ty)
    doc.setFont('Roboto', 'normal').setTextColor(...SOFT)
    const split = doc.splitTextToSize(quote.notes, W - 2 * M)
    doc.text(split, M, ty + 5)
    ty += 5 + split.length * 5
  }

  // ===== Chữ ký =====
  ty = Math.max(ty + 14, doc.internal.pageSize.getHeight() - 45)
  doc.setFont('Roboto', 'bold').setFontSize(9.5).setTextColor(...INK)
  doc.text('ĐẠI DIỆN BÊN BÁN', W - M - 45, ty, { align: 'center' })
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text('(Ký, ghi rõ họ tên)', W - M - 45, ty + 5, { align: 'center' })

  doc.save(`${quote.quote_number || 'bao-gia'}.pdf`)
}
