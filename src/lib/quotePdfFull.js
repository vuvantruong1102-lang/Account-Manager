// PDF Báo giá đầy đủ — kiểu catalog có ảnh, model, thông tin, link sản phẩm
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont'
import { YOKOOL_LOGO, YOKOOL_LOGO_RATIO } from './logoData'
import { supabase } from './supabase'

const BRAND = [220, 20, 59]
const INK = [31, 36, 48]
const SOFT = [91, 97, 112]

const SELLER = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, phường Bắc Giang, tỉnh Bắc Ninh',
  office: 'VPĐD tại Hà Nội: 18 liền kề 19, khu đô thị Văn Khê, phường Hà Đông, TP Hà Nội',
  taxCode: '2400833385',
  phone: '0822 838 665',
  email: 'contact@yokool.vn',
}
const SIGNER = { name: 'VŨ VĂN CƯỜNG', title: 'GIÁM ĐỐC' }
const FOOTER_NOTE = [
  'Đơn giá đã bao gồm thuế VAT, phí vận chuyển.',
  'Chính sách bảo hành chính hãng 12 tháng.',
  'Đơn giá áp dụng với khách hàng đại lý mua với số lượng từ 05-100 chiếc, đối với đơn hàng số lượng nhiều hơn sẽ được chiết khấu bổ sung theo thông báo kèm theo.',
  'Báo giá có giá trị trong vòng 15 ngày.',
]

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '')

/**
 * Xuất PDF báo giá đầy đủ kiểu catalog.
 * @param {Object} quote - báo giá (company_name, items[{name,model,qty,unit,price,short_name,description,image_url,product_url}])
 * @param {Object} options - { showTotal: boolean }  // có tính tổng cộng hay không
 */
export async function exportQuotePDFFull(quote, options = {}) {
  const { showTotal = true } = options

  // === Lấy thêm thông tin sản phẩm từ DB nếu items có sku/model nhưng thiếu hình/desc ===
  const items = quote.items || []
  const enriched = await enrichItems(items)

  // Khổ ngang A4 vì nhiều cột
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR); doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD); doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto')

  const W = doc.internal.pageSize.getWidth() // 297mm
  const M = 12
  let y = 14

  // === Header — logo trái, thông tin công ty phải ===
  const titleH = 6.5
  const titleLogoW = titleH * YOKOOL_LOGO_RATIO
  try { doc.addImage(YOKOOL_LOGO, 'PNG', M, y - titleH + 1.8, titleLogoW, titleH) } catch (e) {}
  doc.setFont('Roboto', 'bold').setFontSize(13.8).setTextColor(...INK); doc.text(' B2B', M + titleLogoW, y)
  doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...SOFT)
  doc.text('Premium Tech gifts for Business', M, y + 6)

  let ry = y
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK)
  const blockLeft = W - M - W * 0.40
  const nameLines = doc.splitTextToSize(SELLER.name, W - M - blockLeft)
  nameLines.forEach((ln) => { doc.text(ln, W - M, ry, { align: 'right' }); ry += 4.2 }); ry += 1
  const nameWidth = Math.max(...nameLines.map((ln) => doc.getTextWidth(ln)))
  const infoLeft = (W - M) - nameWidth
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text(`Địa chỉ: ${SELLER.address}`, infoLeft, ry); ry += 4
  doc.text(SELLER.office, infoLeft, ry); ry += 4
  doc.text(`MST: ${SELLER.taxCode}`, infoLeft, ry); ry += 4
  doc.text(`Điện thoại: ${SELLER.phone}  •  Email: ${SELLER.email}`, infoLeft, ry)

  y = Math.max(ry, y + 6) + 6

  // === Tiêu đề BÁO GIÁ ===
  doc.setFont('Roboto', 'bold').setFontSize(22).setTextColor(...BRAND)
  doc.text('BÁO GIÁ', W / 2, y, { align: 'center' })
  doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
  doc.text(`Ngày: ${fmtDate(quote.created_at || new Date())}`, W - M, y + 7, { align: 'right' })
  y += 12

  // === Kính gửi ===
  doc.setFont('Roboto', 'bold').setFontSize(9.5).setTextColor(...INK)
  if (quote.company_name && quote.company_name.trim()) {
    doc.text('KÍNH GỬI:', M, y)
    doc.setFont('Roboto', 'bold').setFontSize(11); doc.text(quote.company_name, M, y + 6)
    doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
    let cy = y + 11
    if (quote.address) { doc.text(`Địa chỉ: ${quote.address}`, M, cy); cy += 5 }
    if (quote.tax_code) { doc.text(`MST: ${quote.tax_code}`, M, cy); cy += 5 }
    if (quote.contact_person) { doc.text(`Người liên hệ: ${quote.contact_person}`, M, cy); cy += 5 }
    y = cy + 2
  } else {
    doc.text('Kính gửi: Quý Khách hàng', M, y); y += 8
  }

  // === Bảng đầy đủ: STT, Ảnh, Tên rút gọn, SL, Giá bán, Thành tiền, Model, Thông tin, Link ===
  // Cấu hình cột (khổ ngang 297 - 2*12 = 273mm khả dụng)
  const tableStartY = y
  const cols = [
    { key: 'stt',    title: 'STT',           width: 10  },
    { key: 'img',    title: 'Ảnh',           width: 24  },
    { key: 'name',   title: 'Tên sản phẩm',  width: 38  },
    { key: 'qty',    title: 'SL',            width: 14  },
    { key: 'price',  title: 'Giá bán (VAT)', width: 24  },
    { key: 'total',  title: 'Thành tiền',    width: 28  },
    { key: 'model',  title: 'Model',         width: 18  },
    { key: 'info',   title: 'Thông tin sản phẩm', width: 78 },
    { key: 'link',   title: 'Link',          width: 38  },
  ]

  const head = [cols.map((c) => c.title)]
  const body = enriched.map((it, i) => ([
    String(i + 1),
    '',                                                       // ảnh - vẽ trong didDrawCell
    it.short_name || it.name || '',
    `${fmt(it.qty)} ${it.unit || ''}`.trim(),
    `${fmt(it.price)} đ`,
    `${fmt((Number(it.qty) || 0) * (Number(it.price) || 0))} đ`,
    it.model || it.sku || '',
    it.description || '',
    it.product_url || '',
  ]))

  autoTable(doc, {
    startY: y,
    head, body,
    margin: { left: M, right: M },
    theme: 'grid',
    tableLineColor: [180, 180, 178], tableLineWidth: 0.15,
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2, textColor: INK, lineColor: [220, 220, 218], lineWidth: 0.1, valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: INK, textColor: [255, 255, 255], fontSize: 8.5, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: cols[0].width },
      1: { halign: 'center', cellWidth: cols[1].width, minCellHeight: 22 },
      2: { halign: 'left',   cellWidth: cols[2].width, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: cols[3].width },
      4: { halign: 'right',  cellWidth: cols[4].width },
      5: { halign: 'right',  cellWidth: cols[5].width, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: cols[6].width },
      7: { halign: 'left',   cellWidth: cols[7].width, fontSize: 7.5 },
      8: { halign: 'left',   cellWidth: cols[8].width, fontSize: 7, textColor: [70, 110, 200] },
    },
    didDrawCell: (data) => {
      // Vẽ ảnh ở cột 1 (Ảnh sản phẩm)
      if (data.section === 'body' && data.column.index === 1) {
        const it = enriched[data.row.index]
        if (it.image_url) {
          try {
            const padding = 1.5
            const maxW = data.cell.width - padding * 2
            const maxH = data.cell.height - padding * 2
            // Lấy kích thước thật của ảnh để giữ tỷ lệ
            const props = doc.getImageProperties(it.image_url)
            const ratio = props.width / props.height
            let w = maxW, h = maxW / ratio
            if (h > maxH) { h = maxH; w = maxH * ratio }
            const x = data.cell.x + (data.cell.width - w) / 2
            const yImg = data.cell.y + (data.cell.height - h) / 2
            const fmt = it.image_url.startsWith('data:image/png') ? 'PNG' : 'JPEG'
            doc.addImage(it.image_url, fmt, x, yImg, w, h)
          } catch (e) { /* bỏ qua nếu ảnh lỗi */ }
        }
      }
    },
    // Để cột thông tin có thể cao tùy ý
    rowPageBreak: 'avoid',
  })

  let ty = doc.lastAutoTable.finalY
  // === Tổng cộng (tùy chọn) ===
  if (showTotal) {
    const sub = enriched.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    // Giá nhập đã có VAT → không cộng VAT thêm trên Tổng cộng
    ty += 6
    const labelX = W - M - 60, valX = W - M
    doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
    doc.text('TỔNG CỘNG:', labelX, ty)
    doc.text(`${fmt(sub)} đ`, valX, ty, { align: 'right' })
    ty += 5
    doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
    doc.text('(Giá bán đã bao gồm VAT)', valX, ty, { align: 'right' })
    ty += 4
  }

  // === Lưu ý ===
  let ny = ty + 8
  // Nếu sắp tràn trang, sang trang mới
  const pageH = doc.internal.pageSize.getHeight()
  if (ny + 40 > pageH) { doc.addPage(); ny = 14 }
  doc.setFont('Roboto', 'bold').setFontSize(9).setTextColor(...INK); doc.text('Lưu ý:', M, ny); ny += 5
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  FOOTER_NOTE.forEach((n) => {
    const ls = doc.splitTextToSize(`-  ${n}`, W - 2 * M)
    doc.text(ls, M, ny); ny += ls.length * 4.5
  })

  // === Ký ===
  let sigY = ny + 10
  if (sigY + 25 > pageH) { doc.addPage(); sigY = 30 }
  const sigX = W - M - 50
  doc.setFont('Roboto', 'bold').setFontSize(10).setTextColor(...INK)
  doc.text(SIGNER.title, sigX, sigY, { align: 'center' })
  doc.text(SIGNER.name, sigX, sigY + 22, { align: 'center' })

  doc.save(`${quote.quote_number || 'bao-gia-day-du'}.pdf`)
}

// Bổ sung dữ liệu sản phẩm (ảnh, mô tả, link) từ bảng crm_products, ghép theo sku hoặc model
async function enrichItems(items) {
  if (!items.length) return items
  const codes = [...new Set(items.map((it) => (it.model || it.sku || '').trim()).filter(Boolean))]
  if (!codes.length) return items
  const { data } = await supabase.from('crm_products').select('*').or(codes.map((c) => `sku.eq.${c}`).join(','))
  const bySku = {}
  ;(data || []).forEach((p) => { if (p.sku) bySku[p.sku.toLowerCase()] = p })
  return items.map((it) => {
    const code = (it.model || it.sku || '').toLowerCase()
    const p = bySku[code]
    return {
      ...it,
      sku: it.sku || p?.sku || '',
      description: it.description || p?.description || '',
      image_url: it.image_url || p?.image_url || '',
      product_url: it.product_url || p?.product_url || '',
    }
  })
}
