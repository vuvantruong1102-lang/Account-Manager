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

// Lưu ý mặc định (dùng khi báo giá không có ghi chú riêng)
const DEFAULT_NOTES = [
  '- Đơn giá đã bao gồm thuế VAT',
  '- Chính sách bảo hành chính hãng 12 tháng.',
  '- Đối với đơn hàng số lượng lớn hơn, vui lòng liên hệ chúng tôi để có giá tốt hơn.',
  '- Báo giá có giá trị trong vòng 15 ngày.',
  '- Liên hệ: Mr. Trường - Sales Manager: 0906 079 936',
].join('\n')

const SIGNER = { name: 'Vũ Văn Cường', title: 'Giám đốc' }

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : ''
const imgFmt = (url) => (url && url.startsWith('data:image/png')) ? 'PNG' : 'JPEG'

function addFonts(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
}

// Header dùng chung cho cả 2 phần
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
  doc.text(`MST: ${SELLER.taxCode}`, infoLeft, ry); ry += 4
  doc.text(`Email: ${SELLER.email}  •  Website: ${SELLER.website}`, infoLeft, ry)

  return Math.max(ry, y + 6) + 4
}

// Vẽ 1 khối "chi tiết sản phẩm" (ảnh trái + tên/tên hóa đơn/thông số phải).
// Trả về py mới (đã cộng khoảng cách dưới). Tự sang trang nếu tràn.
function drawProductCard(doc, W, H, M, py, item) {
  const contentW = W - 2 * M - 52
  doc.setFont('Roboto', 'normal').setFontSize(8.5)
  const specLines = item.description ? doc.splitTextToSize(item.description, contentW) : []
  const invoiceLines = doc.splitTextToSize(`Tên trên hóa đơn: ${item.invoice_name || item.name || ''}`, contentW)
  const nameLines = doc.splitTextToSize(String(item.name || ''), contentW)

  const textH = 4 + nameLines.length * 5.5 + invoiceLines.length * 4.4 + 2 + (specLines.length ? 5 + specLines.length * 4.4 : 0) + 4
  const imgH = 44
  const cardH = Math.max(textH, imgH)

  if (py + cardH > H - 15) { doc.addPage(); py = drawHeader(doc, W, M) + 8 }

  const cardTop = py
  doc.setDrawColor(225, 225, 223).setLineWidth(0.2)
  doc.roundedRect(M, cardTop, W - 2 * M, cardH, 2, 2)

  // Ảnh (trái)
  const imgX = M + 4, imgY = cardTop + 4, imgBoxW = 40, imgBoxH = cardH - 8
  if (item.image_url) {
    try {
      const props = doc.getImageProperties(item.image_url)
      const ratio = props.width / props.height
      let w = imgBoxW, h = imgBoxW / ratio
      if (h > imgBoxH) { h = imgBoxH; w = imgBoxH * ratio }
      doc.addImage(item.image_url, imgFmt(item.image_url), imgX + (imgBoxW - w) / 2, imgY + (imgBoxH - h) / 2, w, h)
    } catch (e) {}
  } else {
    doc.setFont('Roboto', 'normal').setFontSize(7).setTextColor(...SOFT)
    doc.text('(chưa có ảnh)', imgX + imgBoxW / 2, imgY + imgBoxH / 2, { align: 'center' })
  }

  // Nội dung (phải)
  const tx = M + 52
  let tyy = cardTop + 8
  doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
  nameLines.forEach((ln) => { doc.text(ln, tx, tyy); tyy += 5.5 })
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  invoiceLines.forEach((ln) => { doc.text(ln, tx, tyy); tyy += 4.4 })
  tyy += 2
  if (specLines.length > 0) {
    doc.setFont('Roboto', 'bold').setFontSize(8.5).setTextColor(...INK)
    doc.text('Thông số kỹ thuật:', tx, tyy); tyy += 4.4
    doc.setFont('Roboto', 'normal').setTextColor(...SOFT)
    specLines.forEach((ln) => { doc.text(ln, tx, tyy); tyy += 4.4 })
  }

  return cardTop + cardH + 6
}

export function exportQuotePDF(quote) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addFonts(doc)

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15

  // ============ PHẦN 1: BÁO GIÁ ============
  let y = drawHeader(doc, W, M)

  y += 12
  doc.setFont('Roboto', 'bold').setFontSize(22).setTextColor(...BRAND)
  doc.text('BÁO GIÁ', W / 2, y, { align: 'center' })
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
  doc.text(`Số: ${quote.quote_number || ''}`, W - M, y + 8, { align: 'right' })
  doc.text(`Ngày: ${fmtDate(quote.created_at || new Date())}`, W - M, y + 12.5, { align: 'right' })
  if (quote.valid_until) doc.text(`Hiệu lực đến: ${fmtDate(quote.valid_until)}`, W - M, y + 17, { align: 'right' })
  y += (quote.valid_until ? 22 : 17)

  // Kính gửi
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

  cy += 2
  doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...INK)
  doc.splitTextToSize(INTRO, W - 2 * M).forEach((ln) => { doc.text(ln, M, cy); cy += 5 })
  y = cy + 4

  // Bảng: STT | Ảnh | Tên | SL | Đơn giá | VAT | Thành tiền
  const items = quote.items || []
  const body = items.map((it, i) => {
    const base = (Number(it.qty) || 0) * (Number(it.price) || 0)
    const total = base + base * (Number(it.vat) || 0) / 100
    return [
      String(i + 1), '', it.name || '',
      `${fmt(it.qty)} ${it.unit || ''}`.trim(),
      `${fmt(it.price)} đ`, `${Number(it.vat) || 0}%`, `${fmt(total)} đ`,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['STT', 'Ảnh', 'Tên sản phẩm / Set quà', 'SL', 'Đơn giá', 'VAT', 'Thành tiền']],
    body,
    margin: { left: M, right: M },
    theme: 'grid',
    tableLineColor: [210, 210, 208], tableLineWidth: 0.1,
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2.5, textColor: INK, lineColor: [225, 225, 223], lineWidth: 0.1, valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: INK, textColor: [255, 255, 255], fontSize: 9, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 11 },
      1: { halign: 'center', cellWidth: 20, minCellHeight: 20 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const it = items[data.row.index]
        if (it && it.image_url) {
          try {
            const pad = 1.5
            const maxW = data.cell.width - pad * 2
            const maxH = data.cell.height - pad * 2
            const props = doc.getImageProperties(it.image_url)
            const ratio = props.width / props.height
            let w = maxW, h = maxW / ratio
            if (h > maxH) { h = maxH; w = maxH * ratio }
            doc.addImage(it.image_url, imgFmt(it.image_url), data.cell.x + (data.cell.width - w) / 2, data.cell.y + (data.cell.height - h) / 2, w, h)
          } catch (e) {}
        }
      }
    },
    rowPageBreak: 'avoid',
  })

  // Tổng kết
  let sub = 0, vatTotal = 0
  items.forEach((it) => {
    const base = (Number(it.qty) || 0) * (Number(it.price) || 0)
    sub += base
    vatTotal += base * (Number(it.vat) || 0) / 100
  })
  const total = sub + vatTotal

  let ty = doc.lastAutoTable.finalY + 6
  const labelX = W - M - 60
  const valX = W - M
  const line = (label, val, bold = false, color = SOFT) => {
    doc.setFont('Roboto', bold ? 'bold' : 'normal').setFontSize(bold ? 11 : 9.5).setTextColor(...color)
    doc.text(label, labelX, ty)
    doc.text(val, valX, ty, { align: 'right' })
    ty += bold ? 8 : 6
  }
  line('Tạm tính (chưa VAT):', `${fmt(sub)} đ`)
  line('Tiền VAT:', `${fmt(vatTotal)} đ`)
  const ruleY = ty - 2
  doc.setDrawColor(...INK).setLineWidth(0.24).line(labelX, ruleY, valX, ruleY)
  ty = ruleY + 6
  line('TỔNG CỘNG:', `${fmt(total)} đ`, true, INK)
  const afterTotalY = ty

  // ===== Lưu ý (gộp ghi chú + lưu ý) =====
  const noteText = (quote.notes && quote.notes.trim()) ? quote.notes : DEFAULT_NOTES
  let ny = afterTotalY + 8
  if (ny + 45 > H) { doc.addPage(); ny = 20 }
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
  doc.text('Lưu ý:', M, ny)
  ny += 5
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  noteText.split('\n').forEach((raw) => {
    const lines = doc.splitTextToSize(raw, W - 2 * M - 55)
    doc.text(lines, M, ny)
    ny += lines.length * 4.5
  })
  const noteEndY = ny

  // Ký
  const sigLeftX = M
  const sigValX = sigLeftX + 32
  let sigY = noteEndY + 10
  if (sigY + 25 > H) { doc.addPage(); sigY = 25 }
  doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...INK)
  doc.text('Người duyệt báo giá:', sigLeftX, sigY)
  doc.setFont('Roboto', 'bold'); doc.text(SIGNER.name, sigValX, sigY)
  doc.setFont('Roboto', 'normal'); doc.text('Chức vụ:', sigLeftX, sigY + 6)
  doc.setFont('Roboto', 'bold'); doc.text(SIGNER.title, sigValX, sigY + 6)
  doc.setFont('Roboto', 'normal').setTextColor(...INK)
  doc.text('Chữ ký và dấu', sigLeftX, sigY + 14)
  doc.setDrawColor(...INK).setLineWidth(0.3).line(sigValX, sigY + 15, sigValX + 42, sigY + 15)

  // ============ PHẦN 2: THÔNG TIN SẢN PHẨM ============
  const infoItems = items.filter((it) => it.name)
  const sets = infoItems.filter((it) => it.kind === 'set')
  const singles = infoItems.filter((it) => it.kind !== 'set')

  // 2a) Mỗi set quà = 1 trang riêng (tên set + thành phần + ảnh minh họa),
  //     tiếp theo là chi tiết từng sản phẩm thành phần.
  sets.forEach((it) => {
    doc.addPage()
    let py = drawHeader(doc, W, M)
    py += 12
    doc.setFont('Roboto', 'bold').setFontSize(18).setTextColor(...BRAND)
    doc.text('THÔNG TIN SẢN PHẨM', W / 2, py, { align: 'center' })
    py += 10

    // Tên set + tên hóa đơn
    doc.setFont('Roboto', 'bold').setFontSize(13).setTextColor(...INK)
    doc.splitTextToSize(String(it.name || ''), W - 2 * M).forEach((ln) => { doc.text(ln, M, py); py += 6.5 })
    doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
    doc.splitTextToSize(`Tên trên hóa đơn: ${it.invoice_name || it.name || ''}`, W - 2 * M).forEach((ln) => { doc.text(ln, M, py); py += 5 })
    py += 2

    // Thành phần
    const lines = (it.set_lines && it.set_lines.length)
      ? it.set_lines.map((c) => `• ${c.qty}× ${c.name}`)
      : (it.description ? it.description.split('\n') : [])
    if (lines.length) {
      doc.setFont('Roboto', 'bold').setFontSize(9.5).setTextColor(...INK)
      doc.text('Thành phần:', M, py); py += 5.5
      doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
      lines.forEach((ln) => {
        doc.splitTextToSize(ln, W - 2 * M).forEach((l) => { doc.text(l, M, py); py += 5 })
      })
    }
    py += 4

    // Ảnh minh họa set (ảnh đại diện + gallery), xếp hàng ngang
    const gallery = [it.image_url, ...(it.gallery || [])].filter(Boolean)
    if (gallery.length) {
      const boxH = 46, gap = 6
      const boxW = Math.min(70, (W - 2 * M - gap * (gallery.length - 1)) / gallery.length)
      if (py + boxH > H - 15) { doc.addPage(); py = drawHeader(doc, W, M) + 8 }
      let gx = M
      gallery.slice(0, 3).forEach((g) => {
        try {
          const props = doc.getImageProperties(g)
          const ratio = props.width / props.height
          let w = boxW, h = boxW / ratio
          if (h > boxH) { h = boxH; w = boxH * ratio }
          doc.addImage(g, imgFmt(g), gx + (boxW - w) / 2, py + (boxH - h) / 2, w, h)
        } catch (e) {}
        gx += boxW + gap
      })
      py += boxH + 8
    }

    // Chi tiết từng sản phẩm thành phần
    const comps = it.set_components || []
    if (comps.length) {
      doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...BRAND)
      if (py + 12 > H - 15) { doc.addPage(); py = drawHeader(doc, W, M) + 8 }
      doc.text('Chi tiết sản phẩm trong set', M, py); py += 7
      comps.forEach((c) => {
        py = drawProductCard(doc, W, H, M, py, {
          name: c.name, invoice_name: c.invoice_name, description: c.description, image_url: c.image_url,
        })
      })
    }
  })

  // 2b) Sản phẩm lẻ: gộp dạng card (nhiều sản phẩm chung trang)
  if (singles.length) {
    doc.addPage()
    let py = drawHeader(doc, W, M)
    py += 12
    doc.setFont('Roboto', 'bold').setFontSize(18).setTextColor(...BRAND)
    doc.text('THÔNG TIN SẢN PHẨM', W / 2, py, { align: 'center' })
    py += 10
    singles.forEach((it) => { py = drawProductCard(doc, W, H, M, py, it) })
  }

  // ============ ĐÁNH SỐ TRANG (góc dưới phải) ============
  const pageCount = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
    doc.text(`Trang ${p}/${pageCount}`, W - M, H - 8, { align: 'right' })
  }

  doc.save(`${quote.quote_number || 'bao-gia'}.pdf`)
}
