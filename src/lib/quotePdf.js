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
  'Đơn giá chưa bao gồm thuế VAT (VAT được tính riêng theo từng mặt hàng).',
  'Chính sách bảo hành chính hãng 12 tháng.',
  'Đối với đơn hàng số lượng lớn hơn, vui lòng liên hệ chúng tôi để có giá tốt hơn.',
  'Báo giá có giá trị trong vòng 15 ngày.',
  'Liên hệ: Mr. Trường - Sales Manager: 0906 079 936',
]

const SIGNER = { name: 'Vũ Văn Cường', title: 'Giám đốc' }

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : ''

function addFonts(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
}

// Header dùng chung cho cả 2 trang
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
  const introLines = doc.splitTextToSize(INTRO, W - 2 * M)
  introLines.forEach((ln) => { doc.text(ln, M, cy); cy += 5 })
  y = cy + 4

  // Bảng: STT | Ảnh | Tên sản phẩm/set | SL | Đơn giá | VAT | Thành tiền
  const items = quote.items || []
  const body = items.map((it, i) => {
    const base = (Number(it.qty) || 0) * (Number(it.price) || 0)
    const total = base + base * (Number(it.vat) || 0) / 100
    return [
      String(i + 1),
      '', // ảnh - vẽ trong didDrawCell
      it.name || '',
      `${fmt(it.qty)} ${it.unit || ''}`.trim(),
      `${fmt(it.price)} đ`,
      `${Number(it.vat) || 0}%`,
      `${fmt(total)} đ`,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['STT', 'Ảnh', 'Tên sản phẩm / Set quà', 'SL', 'Đơn giá', 'VAT', 'Thành tiền']],
    body,
    margin: { left: M, right: M },
    theme: 'grid',
    tableLineColor: [210, 210, 208],
    tableLineWidth: 0.1,
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
            const x = data.cell.x + (data.cell.width - w) / 2
            const yi = data.cell.y + (data.cell.height - h) / 2
            const f = it.image_url.startsWith('data:image/png') ? 'PNG' : 'JPEG'
            doc.addImage(it.image_url, f, x, yi, w, h)
          } catch (e) {}
        }
      }
    },
    rowPageBreak: 'avoid',
  })

  // Tổng kết: đơn giá chưa VAT → cộng VAT từng dòng
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

  // Ghi chú (hiện dưới bảng)
  let gy = afterTotalY
  if (quote.notes) {
    gy += 4
    doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
    doc.text('Ghi chú:', M, gy)
    doc.setFont('Roboto', 'normal').setTextColor(...SOFT)
    const split = doc.splitTextToSize(quote.notes, W - 2 * M)
    doc.text(split, M, gy + 5)
    gy += 5 + split.length * 5
  }

  // Lưu ý
  let ny = Math.max(afterTotalY + 20, gy + 4)
  if (ny + 45 > H) { doc.addPage(); ny = 20 }
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
  doc.text('Lưu ý:', M, ny)
  ny += 5
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  FOOTER_NOTE.forEach((n) => {
    const lines = doc.splitTextToSize(`-  ${n}`, W - 2 * M - 55)
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

  // ============ PHẦN 2: THÔNG TIN SẢN PHẨM (trang tiếp theo) ============
  const infoItems = items.filter((it) => it.name)
  if (infoItems.length > 0) {
    doc.addPage()
    let py = drawHeader(doc, W, M)
    py += 12
    doc.setFont('Roboto', 'bold').setFontSize(18).setTextColor(...BRAND)
    doc.text('THÔNG TIN SẢN PHẨM', W / 2, py, { align: 'center' })
    py += 10

    const CARD_GAP = 6
    infoItems.forEach((it, idx) => {
      // Ước lượng chiều cao card
      doc.setFont('Roboto', 'normal').setFontSize(8.5)
      const specLines = it.description ? doc.splitTextToSize(it.description, W - 2 * M - 52) : []
      const textH = 14 + specLines.length * 4.4 // tên + tên hóa đơn + specs
      const imgH = 40
      const cardH = Math.max(textH, imgH) + 8

      // Sang trang nếu tràn
      if (py + cardH > H - 15) { doc.addPage(); py = drawHeader(doc, W, M) + 8 }

      const cardTop = py
      // Khung card
      doc.setDrawColor(225, 225, 223).setLineWidth(0.2)
      doc.roundedRect(M, cardTop, W - 2 * M, cardH, 2, 2)

      // Ảnh minh họa (bên trái)
      const imgX = M + 4, imgY = cardTop + 4, imgBoxW = 40, imgBoxH = cardH - 8
      if (it.image_url) {
        try {
          const props = doc.getImageProperties(it.image_url)
          const ratio = props.width / props.height
          let w = imgBoxW, h = imgBoxW / ratio
          if (h > imgBoxH) { h = imgBoxH; w = imgBoxH * ratio }
          const x = imgX + (imgBoxW - w) / 2
          const yi = imgY + (imgBoxH - h) / 2
          const f = it.image_url.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          doc.addImage(it.image_url, f, x, yi, w, h)
        } catch (e) {}
      } else {
        doc.setFont('Roboto', 'normal').setFontSize(7).setTextColor(...SOFT)
        doc.text('(chưa có ảnh)', imgX + imgBoxW / 2, imgY + imgBoxH / 2, { align: 'center' })
      }

      // Nội dung (bên phải)
      const tx = M + 52
      let tyy = cardTop + 8
      doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
      doc.text(String(it.name || ''), tx, tyy)
      tyy += 6
      doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
      doc.text(`Tên trên hóa đơn: ${it.invoice_name || it.name || ''}`, tx, tyy)
      tyy += 6
      if (specLines.length > 0) {
        doc.setFont('Roboto', 'bold').setFontSize(8.5).setTextColor(...INK)
        doc.text('Thông số kỹ thuật:', tx, tyy)
        tyy += 4.4
        doc.setFont('Roboto', 'normal').setTextColor(...SOFT)
        specLines.forEach((ln) => { doc.text(ln, tx, tyy); tyy += 4.4 })
      }

      py = cardTop + cardH + CARD_GAP
    })
  }

  doc.save(`${quote.quote_number || 'bao-gia'}.pdf`)
}
