import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont'
import { docSoThanhChu } from './numberToWords'

const INK = [31, 36, 48]
const SOFT = [70, 76, 90]

const SELLER = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, Phường Bắc Giang, Tỉnh Bắc Ninh, Việt Nam',
  taxCode: '2400883385',
  bank: '19135661522015 tại Ngân hàng Thương mại cổ phần Kỹ thương Việt Nam – Chi nhánh Bắc Giang',
}
const SIGNER = { name: 'Vũ Văn Cường', title: 'Giám Đốc' }

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const dmy = (d) => {
  const dt = d ? new Date(d) : new Date()
  return { d: dt.getDate(), m: dt.getMonth() + 1, y: dt.getFullYear() }
}

function addFonts(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
}

/* =========================================================
   PHIẾU XUẤT KHO BÁN HÀNG
   ========================================================= */
export function exportWarehousePDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addFonts(doc)
  const W = doc.internal.pageSize.getWidth()
  const M = 15
  let y = 16

  // Header công ty (trái)
  doc.setFont('Roboto', 'bold').setFontSize(9.5).setTextColor(...INK)
  doc.splitTextToSize(SELLER.name, 110).forEach((ln) => { doc.text(ln, M, y); y += 4.5 })
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.splitTextToSize(SELLER.address, 110).forEach((ln) => { doc.text(ln, M, y); y += 4 })

  // Tiêu đề
  y += 6
  doc.setFont('Roboto', 'bold').setFontSize(15).setTextColor(...INK)
  doc.text('PHIẾU XUẤT KHO BÁN HÀNG', W / 2, y, { align: 'center' })
  y += 6
  const dt = dmy(data.created_at)
  doc.setFont('Roboto', 'normal').setFontSize(9.5)
  doc.text(`Ngày ${dt.d} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}`, W / 2, y, { align: 'center' })
  y += 5
  doc.setFont('Roboto', 'bold').setFontSize(10)
  doc.text(`Số: ${data.doc_number || ''}`, W / 2, y, { align: 'center' })

  // Khối thông tin: trái (người mua...) / phải (Nợ/Có/Loại tiền)
  y += 9
  const leftX = M, rightX = W - M - 40
  doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...INK)
  const L = (label, val) => { doc.text(`${label}${val || ''}`, leftX, y); }
  const R = (label, val) => { doc.text(`${label}${val || ''}`, rightX, y); }
  L('Người mua: '); R('Nợ: ', data.debit || '131'); y += 5
  L('Tên khách hàng: ', data.company_name || ''); R('Có: ', data.credit || '5111'); y += 5
  L('Địa chỉ: ', data.address || ''); R('Loại tiền: ', data.currency || 'VND'); y += 5
  L('Điện thoại: ', data.phone || ''); y += 5
  L('Mã số thuế: ', data.tax_code || ''); y += 5
  if (data.note) { L('Diễn giải: ', data.note); y += 5 }
  L('Nhân viên bán hàng: ', data.staff || ''); y += 6

  // Bảng hàng
  const items = data.items || []
  const useVat = !!data.use_vat
  const vatRate = Number(data.vat_percent) || 0
  const body = items.map((it, i) => {
    const price = Number(it.price) || 0
    const qty = Number(it.qty) || 0
    return [String(i + 1), it.code || '', it.name || '', it.unit || '', fmt(qty), fmt(price), fmt(qty * price)]
  })
  const sub = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const vat = useVat ? Math.round(sub * vatRate / 100) : 0
  const total = sub + vat

  autoTable(doc, {
    startY: y,
    head: [['STT', 'Mã hàng', 'Tên hàng', 'Đơn vị', 'Số lượng', 'Đơn giá', 'Thành tiền']],
    body,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 2, textColor: INK, lineColor: [150, 150, 150], lineWidth: 0.2, valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: INK, fontSize: 8.5, halign: 'center', lineColor: [120, 120, 120], lineWidth: 0.25 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 24 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 26 },
    },
  })
  y = doc.lastAutoTable.finalY

  // Dòng tổng (Cộng / Cộng tiền hàng / Thuế / Tổng thanh toán) dạng bảng gọn
  const sumRows = [['Cộng tiền hàng', fmt(sub)]]
  if (useVat) sumRows.push([`Thuế suất thuế GTGT: ${vatRate}%   —   Tiền thuế GTGT:`, fmt(vat)])
  sumRows.push([{ content: 'Tổng tiền thanh toán', styles: { fontStyle: 'bold' } }, { content: fmt(total), styles: { fontStyle: 'bold' } }])
  autoTable(doc, {
    startY: y,
    body: sumRows,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2, textColor: INK, lineColor: [150, 150, 150], lineWidth: 0.2 },
    columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right', cellWidth: 40 } },
  })
  y = doc.lastAutoTable.finalY + 7

  // Bằng chữ
  doc.setFont('Roboto', 'bold').setFontSize(9.5).setTextColor(...INK)
  const bc = 'Số tiền bằng chữ: '
  doc.text(bc, M, y)
  const bcW = doc.getTextWidth(bc)
  doc.setFont('Roboto', 'normal')
  doc.splitTextToSize(docSoThanhChu(total), W - M - (M + bcW)).forEach((ln, i) => { doc.text(ln, M + bcW, y + i * 5); if (i > 0) y += 5 })
  y += 6
  doc.text('Số chứng từ gốc kèm theo: ...', M, y)

  // Ngày + 3 chữ ký
  y += 10
  doc.setFont('Roboto', 'normal').setFontSize(9.5)
  doc.text(`Ngày ${dt.d} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}`, W - M, y, { align: 'right' })
  y += 8
  const col = [W * 0.22, W * 0.5, W * 0.78]
  doc.setFont('Roboto', 'bold').setFontSize(9.5)
  doc.text('Người mua hàng', col[0], y, { align: 'center' })
  doc.text('Kế toán trưởng', col[1], y, { align: 'center' })
  doc.text('Giám đốc', col[2], y, { align: 'center' })
  y += 4.5
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text('(Ký, họ tên)', col[0], y, { align: 'center' })
  doc.text('(Ký, họ tên)', col[1], y, { align: 'center' })
  doc.text('(Ký, họ tên, đóng dấu)', col[2], y, { align: 'center' })

  doc.save(`PhieuXuatKho_${data.doc_number || 'PXK'}.pdf`)
}

/* =========================================================
   BIÊN BẢN BÀN GIAO HÀNG HÓA
   ========================================================= */
export function exportDeliveryPDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addFonts(doc)
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 15
  let y = 18

  // Quốc hiệu
  doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
  doc.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', W / 2, y, { align: 'center' }); y += 5.5
  doc.text('Độc lập - Tự do - Hạnh phúc', W / 2, y, { align: 'center' }); y += 4
  doc.setFont('Roboto', 'normal').setFontSize(10)
  doc.text('**********', W / 2, y, { align: 'center' }); y += 10

  // Tiêu đề
  doc.setFont('Roboto', 'bold').setFontSize(15)
  doc.text('BIÊN BẢN BÀN GIAO HÀNG HÓA', W / 2, y, { align: 'center' }); y += 10

  const dt = dmy(data.created_at)
  doc.setFont('Roboto', 'normal').setFontSize(10).setTextColor(...INK)
  doc.text(`Hôm nay, ngày ${dt.d} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}, chúng tôi gồm:`, M, y); y += 7

  const line = (label, val, bold) => {
    doc.setFont('Roboto', bold ? 'bold' : 'normal').setFontSize(10)
    const lblW = 42
    doc.text(label, M, y)
    doc.setFont('Roboto', bold ? 'bold' : 'normal')
    doc.splitTextToSize(String(val || ''), W - M - (M + lblW)).forEach((ln, i) => { doc.text(ln, M + lblW, y); if (i < 100 && i > 0) y += 5 })
    y += 5
  }

  // Bên A (VNF - cố định)
  doc.setFont('Roboto', 'bold').setFontSize(10)
  doc.text('Bên bán hàng (Bên A):', M, y)
  doc.splitTextToSize(SELLER.name, W - M - (M + 42)).forEach((ln, i) => { doc.text(ln, M + 42, y); if (i > 0) y += 5 }); y += 5
  line('Địa chỉ:', SELLER.address)
  line('Mã số thuế:', SELLER.taxCode)
  line('Số tài khoản:', SELLER.bank)
  line('Đại diện:', `Ông ${SIGNER.name}                    Chức vụ: ${SIGNER.title}`)
  y += 2

  // Bên B (khách - nhập)
  doc.setFont('Roboto', 'bold').setFontSize(10)
  doc.text('Bên mua hàng (Bên B):', M, y)
  doc.splitTextToSize((data.company_name || '').toUpperCase(), W - M - (M + 42)).forEach((ln, i) => { doc.text(ln, M + 42, y); if (i > 0) y += 5 }); y += 5
  line('Địa chỉ:', data.address || '……………………………………')
  line('Mã số thuế:', data.tax_code || '……………………')
  line('Đại diện:', `${data.rep_name || '………………………………'}          Chức vụ: ${data.rep_title || '……………'}`)
  y += 2

  // Địa điểm giao hàng
  doc.setFont('Roboto', 'normal').setFontSize(10)
  doc.splitTextToSize(`Tại địa điểm giao hàng: ${data.location || '………………………………………………'}`, W - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 5 })
  doc.text('Bên A đã bàn giao cho Bên B số lượng hàng như sau:', M, y); y += 6

  // Bảng hàng: STT | Tên hàng | Đơn vị | Mã hàng | Số lượng
  const items = data.items || []
  const body = items.map((it, i) => [String(i + 1), it.name || '', it.unit || '', it.code || '', fmt(it.qty)])
  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  body.push([{ content: 'Tổng', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(totalQty), styles: { fontStyle: 'bold' } }])

  autoTable(doc, {
    startY: y,
    head: [['STT', 'Tên hàng', 'Đơn vị', 'Mã hàng', 'Số lượng']],
    body,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 2, textColor: INK, lineColor: [140, 140, 140], lineWidth: 0.2, valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: INK, halign: 'center', lineColor: [110, 110, 110], lineWidth: 0.25 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left' },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 24 },
    },
  })
  y = doc.lastAutoTable.finalY + 6

  // Kết luận
  doc.setFont('Roboto', 'normal').setFontSize(10).setTextColor(...INK)
  const concl = [
    `Tình trạng hàng hóa: ${data.condition || 'Nguyên đai, nguyên kiện, không hỏng'}`,
    'Bên B xác nhận Bên A đã giao cho Bên B đúng chủng loại và đủ số lượng hàng như trên.',
    'Hai bên đồng ý, thống nhất ký tên, Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.',
  ]
  concl.forEach((p) => { doc.splitTextToSize(p, W - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 5 }) })
  y += 10
  if (y > H - 40) { doc.addPage(); y = 30 }

  // 2 chữ ký
  const cA = W * 0.27, cB = W * 0.73
  doc.setFont('Roboto', 'bold').setFontSize(10)
  doc.text('ĐẠI DIỆN BÊN A', cA, y, { align: 'center' })
  doc.text('ĐẠI DIỆN BÊN B', cB, y, { align: 'center' })
  y += 4.5
  doc.setFont('Roboto', 'normal').setFontSize(8).setTextColor(...SOFT)
  doc.text('(Ký, ghi rõ họ tên, đóng dấu)', cA, y, { align: 'center' })
  doc.text('(Ký, ghi rõ họ tên, đóng dấu)', cB, y, { align: 'center' })
  y += 22
  doc.setFont('Roboto', 'bold').setFontSize(10).setTextColor(...INK)
  doc.text(SIGNER.name.toUpperCase(), cA, y, { align: 'center' })

  doc.save(`BienBanBanGiao_${data.doc_number || 'BBBG'}.pdf`)
}
