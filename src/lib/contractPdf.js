import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont'
import { docSoThanhChu } from './numberToWords'

const INK = [31, 36, 48]
const SOFT = [70, 76, 90]

// Bên bán mặc định (VNF) — panel cho phép ghi đè
export const DEFAULT_SELLER = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, phường Bắc Giang, tỉnh Bắc Ninh, Việt Nam',
  tax_code: '2400883385',
  account: '19135661522015',
  bank: 'Ngân hàng TMCP Kỹ Thương Việt Nam Techcombank – chi nhánh Bắc Giang',
  rep_name: 'Ông Vũ Văn Cường',
  rep_title: 'Giám Đốc',
}

const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const dmy = (d) => {
  const dt = d ? new Date(d) : new Date()
  return { d: dt.getDate(), m: dt.getMonth() + 1, y: dt.getFullYear() }
}
const stripTitle = (s) => String(s || '').replace(/^\s*(Ông|Bà|Anh|Chị|Ms\.?|Mr\.?)\s+/i, '').trim()

function addFonts(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
}

/* =========================================================
   HỢP ĐỒNG MUA BÁN HÀNG HÓA (+ Phụ lục)
   Bên A = Bên MUA (khách), Bên B = Bên BÁN (VNF)
   ========================================================= */
export function exportContractPDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  addFonts(doc)
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 20
  const CW = W - 2 * M
  const BOTTOM = H - 18
  let y = 18

  const seller = { ...DEFAULT_SELLER, ...(data.seller || {}) }
  const buyer = data.buyer || {}
  const dt = dmy(data.signed_at || data.created_at)

  // Bảo đảm còn chỗ; nếu không thì sang trang mới
  const need = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 22 } }

  // In 1 đoạn văn thường
  const para = (text, opt = {}) => {
    const { bold = false, italic = false, size = 11, gap = 1.5, align = 'left', indent = 0, lh = 5 } = opt
    doc.setFont('Roboto', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...INK)
    const lines = doc.splitTextToSize(text, CW - indent)
    lines.forEach((ln) => {
      need(lh)
      const x = align === 'center' ? W / 2 : M + indent
      doc.text(ln, x, y, { align })
      y += lh
    })
    y += gap
  }

  // Dòng "Nhãn : giá trị" kiểu bảng info (label căn trái, value thụt vào)
  const infoRow = (label, value, opt = {}) => {
    const { bold = false, labelW = 38, lh = 5 } = opt
    doc.setFont('Roboto', 'normal').setFontSize(11).setTextColor(...INK)
    const valLines = doc.splitTextToSize(String(value || ''), CW - labelW)
    need(Math.max(lh, valLines.length * lh))
    const startY = y
    doc.text(label, M, y)
    doc.text(':', M + labelW - 3, y)
    doc.setFont('Roboto', bold ? 'bold' : 'normal')
    valLines.forEach((ln, i) => {
      if (i > 0) { need(lh); }
      doc.text(ln, M + labelW, startY + i * lh)
    })
    y = startY + valLines.length * lh
  }

  /* ---------- Quốc hiệu ---------- */
  doc.setFont('Roboto', 'bold').setFontSize(12).setTextColor(...INK)
  doc.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', W / 2, y, { align: 'center' }); y += 5.5
  doc.setFontSize(11)
  doc.text('Độc lập - Tự do - Hạnh phúc', W / 2, y, { align: 'center' }); y += 8

  /* ---------- Tiêu đề ---------- */
  doc.setFont('Roboto', 'bold').setFontSize(15)
  doc.text('HỢP ĐỒNG MUA BÁN HÀNG HÓA', W / 2, y, { align: 'center' }); y += 6
  doc.setFont('Roboto', 'normal').setFontSize(11)
  doc.text(`Số: ${data.contract_number || ''}`, W / 2, y, { align: 'center' }); y += 8

  /* ---------- Căn cứ ---------- */
  const bases = data.bases && data.bases.length ? data.bases : [
    'Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam thông qua ngày 24/11/2015, có hiệu lực thi hành từ ngày 01/01/2017;',
    'Căn cứ Luật Thương mại số 36/2005/QH11 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam thông qua ngày 14/6/2005, có hiệu lực thi hành từ ngày 01/01/2006 và các văn bản sửa đổi, bổ sung, hướng dẫn thi hành;',
    'Căn cứ Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam thông qua ngày 20/6/2023, có hiệu lực thi hành từ ngày 01/7/2024;',
  ]
  bases.forEach((b) => para('- ' + b, { size: 10.5, gap: 1, lh: 4.8, indent: 4 }))
  y += 1

  para(`Hôm nay, ngày ${String(dt.d).padStart(2, '0')} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}, tại ${data.sign_place || 'Hà Nội'}, chúng tôi gồm có:`, { gap: 3 })

  /* ---------- Bên A (MUA - khách) ---------- */
  infoRow('BÊN MUA (BÊN A)', (buyer.name || '').toUpperCase(), { bold: true, labelW: 42 })
  infoRow('Địa chỉ', buyer.address, { labelW: 42 })
  infoRow('Mã số thuế', buyer.tax_code, { labelW: 42 })
  infoRow('Người đại diện', buyer.rep_name, { bold: true, labelW: 42 })
  infoRow('Chức vụ', buyer.rep_title, { bold: true, labelW: 42 })
  y += 4

  /* ---------- Bên B (BÁN - VNF) ---------- */
  infoRow('BÊN BÁN (BÊN B)', (seller.name || '').toUpperCase(), { bold: true, labelW: 42 })
  infoRow('Địa chỉ', seller.address, { labelW: 42 })
  infoRow('Mã số thuế', seller.tax_code, { labelW: 42 })
  infoRow('Tài khoản', seller.account, { labelW: 42 })
  infoRow('Tại', seller.bank, { labelW: 42 })
  infoRow('Người đại diện', seller.rep_name, { bold: true, labelW: 42 })
  infoRow('Chức vụ', seller.rep_title, { bold: true, labelW: 42 })
  y += 4

  para('Bên A và Bên B sau đây gọi riêng là “Bên”, gọi chung là “Hai Bên”.', { bold: true, gap: 2 })
  para('Hai Bên thống nhất ký kết Hợp đồng mua bán hàng hóa (“Hợp đồng”) với nội dung và điều khoản như sau:', { gap: 3 })

  /* ---------- ĐIỀU 1 ---------- */
  need(14)
  para('ĐIỀU 1. NỘI DUNG HỢP ĐỒNG', { bold: true, gap: 2 })
  para('1.1  Số lượng, mô tả hàng hoá và giá cả:', { gap: 2 })

  const items = data.items || []
  const vatRate = Number(data.vat_percent) || 0
  const useVat = data.use_vat !== false
  const sub = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const vat = useVat ? Math.round(sub * vatRate / 100) : 0
  const grand = sub + vat

  const body = items.map((it, i) => [
    String(i + 1),
    it.name || '',
    it.unit || 'Cái',
    it.color || '',
    fmt(it.qty),
    fmt(it.price),
    fmt((Number(it.qty) || 0) * (Number(it.price) || 0)),
  ])
  const footRows = [
    [{ content: 'TỔNG CỘNG', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(sub), styles: { halign: 'right', fontStyle: 'bold' } }],
  ]
  if (useVat) footRows.push([{ content: `THUẾ GTGT ${vatRate}%`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(vat), styles: { halign: 'right', fontStyle: 'bold' } }])
  footRows.push([{ content: 'TỔNG GIÁ TRỊ HỢP ĐỒNG', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(grand), styles: { halign: 'right', fontStyle: 'bold' } }])

  autoTable(doc, {
    startY: y,
    head: [['TT', 'Yêu cầu sản phẩm', 'ĐVT', 'Màu', 'Số lượng', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)']],
    body,
    foot: footRows,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 2, textColor: INK, lineColor: [130, 130, 130], lineWidth: 0.2, valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [242, 242, 242], textColor: INK, halign: 'center', lineColor: [110, 110, 110], lineWidth: 0.25 },
    footStyles: { font: 'Roboto', fillColor: [255, 255, 255], textColor: INK, lineColor: [130, 130, 130] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { halign: 'left' },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 26 },
    },
  })
  y = doc.lastAutoTable.finalY + 3

  para(`Bằng chữ: ${docSoThanhChu(grand).replace(/\.$/, '')} Việt Nam Đồng./`, { bold: true, italic: true, gap: 4 })

  /* ---------- 1.2 Chất lượng ---------- */
  para('1.2  Chất lượng, quy cách sản phẩm, chính sách bảo hành', { bold: true, gap: 2 })
  para('Tất cả hàng hoá mua bán theo Hợp đồng phải đảm bảo các yêu cầu sau:', { gap: 1.5 })
  const quality = data.quality_terms && data.quality_terms.length ? data.quality_terms : [
    'Màu sắc: Đen, có in logo theo yêu cầu của bên A.',
    'Hàng mới 100%, đảm bảo chất lượng.',
    'Đủ số lượng, đúng màu sắc.',
    'Thời gian bảo hành: 12 tháng.',
    'Quy cách in logo và đóng gói theo bản Phụ lục của hợp đồng này.',
  ]
  quality.forEach((q) => para('•  ' + q, { gap: 0.6, lh: 4.8, indent: 6 }))
  y += 2

  /* ---------- ĐIỀU 2 ---------- */
  need(16)
  para('ĐIỀU 2: THỜI HẠN VÀ PHƯƠNG THỨC THANH TOÁN', { bold: true, gap: 2 })
  para(`2.1.  Tổng giá trị Hợp đồng là: ${fmt(grand)} VNĐ (Bằng chữ: ${docSoThanhChu(grand).replace(/\.$/, '')} Việt Nam Đồng).`, { gap: 2 })
  para('2.2.  Thời hạn thanh toán:', { gap: 1.5 })

  const pct1 = Number(data.advance_percent ?? 70)
  const pct2 = 100 - pct1
  const amt1 = Math.round(grand * pct1 / 100)
  const amt2 = grand - amt1
  const payTerms = data.payment_terms || [
    `Lần 1: Bên A tạm ứng cho Bên B ${pct1}% tổng giá trị Hợp đồng tương ứng với số tiền: ${fmt(amt1)} VNĐ (Bằng chữ: ${docSoThanhChu(amt1).replace(/\.$/, '')} Việt Nam Đồng) sau khi Hợp đồng này được kí kết.`,
    `Lần 2: Bên A thanh toán nốt cho Bên B ${pct2}% tổng giá trị Hợp đồng tương ứng với số tiền: ${fmt(amt2)} VNĐ (Bằng chữ: ${docSoThanhChu(amt2).replace(/\.$/, '')} Việt Nam Đồng) trong vòng 05 ngày làm việc kể từ ngày Bên B giao đủ hàng hóa và chứng từ cho Bên A bao gồm: Biên bản giao nhận hàng hóa; Đề nghị thanh toán; Hóa đơn GTGT.`,
  ]
  payTerms.forEach((p) => para('-  ' + p, { gap: 1.5, lh: 4.8, indent: 4 }))
  para('2.3.  Phương thức thanh toán: Bên A chuyển khoản cho Bên B theo thông tin dưới đây:', { gap: 1 })
  para(`+ Chủ tài khoản: ${seller.name}`, { indent: 4, gap: 0.6, lh: 4.8 })
  para(`+ Số tài khoản: ${seller.account}`, { indent: 4, gap: 0.6, lh: 4.8 })
  para(`+ Tại: ${seller.bank}`, { indent: 4, gap: 3, lh: 4.8 })

  /* ---------- ĐIỀU 3 ---------- */
  need(16)
  para('ĐIỀU 3. THỜI GIAN, ĐỊA ĐIỂM GIAO NHẬN HÀNG HÓA', { bold: true, gap: 2 })
  para(`3.1.  Thời gian giao hàng: ${data.delivery_time || 'không muộn hơn ngày ……/……/……'}.`, { gap: 1, lh: 4.8 })
  para(`3.2.  Địa chỉ giao hàng: ${data.delivery_address || '……………………………………………………'}.`, { gap: 1, lh: 4.8 })
  para(`3.3.  Chi phí vận chuyển: ${data.shipping_by || 'Do Bên B chịu'}.`, { gap: 3, lh: 4.8 })

  /* ---------- ĐIỀU 4 → 8 (cố định, cho phép override toàn khối) ---------- */
  const clauses = data.clauses || DEFAULT_CLAUSES
  clauses.forEach((c) => {
    need(16)
    para(c.title, { bold: true, gap: 2 })
    c.lines.forEach((ln) => para(ln, { gap: 1, lh: 4.8, indent: ln.match(/^\d/) ? 0 : 0 }))
    y += 2
  })

  /* ---------- Chữ ký hợp đồng ---------- */
  need(45)
  y += 4
  const cA = W * 0.28, cB = W * 0.72
  doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
  doc.text('ĐẠI DIỆN BÊN A', cA, y, { align: 'center' })
  doc.text('ĐẠI DIỆN BÊN B', cB, y, { align: 'center' })
  y += 4
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  doc.text('(Ký, ghi rõ họ tên, đóng dấu)', cA, y, { align: 'center' })
  doc.text('(Ký, ghi rõ họ tên, đóng dấu)', cB, y, { align: 'center' })
  y += 28
  doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
  if (buyer.rep_name) doc.text(stripTitle(buyer.rep_name), cA, y, { align: 'center' })
  doc.text(stripTitle(seller.rep_name), cB, y, { align: 'center' })

  /* ---------- PHỤ LỤC ---------- */
  if (data.has_appendix) {
    renderAppendix(doc, data, { W, H, M, CW, para, need: (h) => { if (y + h > H - 18) { doc.addPage(); y = 22 } } })
  }

  /* ---------- Đánh số trang ---------- */
  paginate(doc, W, H)

  doc.save(`HopDong_${(data.contract_number || 'HDMB').replace(/[\/\\]/g, '-')}.pdf`)
}

// Phụ lục hợp đồng: quy cách in logo + đóng gói + ảnh minh họa
function renderAppendix(doc, data, ctx) {
  const { W, H, M, CW } = ctx
  doc.addPage()
  let y = 22

  const need = (h) => { if (y + h > H - 18) { doc.addPage(); y = 22 } }
  const para = (text, opt = {}) => {
    const { bold = false, size = 11, gap = 1.5, align = 'left', indent = 0, lh = 5 } = opt
    doc.setFont('Roboto', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...INK)
    doc.splitTextToSize(text, CW - indent).forEach((ln) => {
      need(lh)
      doc.text(ln, align === 'center' ? W / 2 : M + indent, y, { align })
      y += lh
    })
    y += gap
  }

  doc.setFont('Roboto', 'bold').setFontSize(14).setTextColor(...INK)
  doc.text('PHỤ LỤC HỢP ĐỒNG', W / 2, y, { align: 'center' }); y += 7
  doc.setFontSize(12)
  const subtitle = data.appendix_subtitle || 'V/v: Quy cách in logo và đóng gói sản phẩm'
  doc.text(subtitle, W / 2, y, { align: 'center' }); y += 9

  para(`Phụ lục này là một phần không tách rời của Hợp đồng số: ${data.contract_number || ''}${data.signed_at || data.created_at ? `, ký ngày ${dmyStr(data.signed_at || data.created_at)}` : ''}.`, { gap: 4 })
  para('Hai bên thống nhất quy cách thực hiện như sau:', { gap: 4 })

  const sections = data.appendix_sections || []
  sections.forEach((sec, idx) => {
    need(14)
    para(`${idx + 1}. ${sec.title || ''}`, { bold: true, gap: 2 })
    ;(sec.bullets || []).forEach((b) => para('•  ' + b, { gap: 0.6, lh: 4.8, indent: 6 }))
    if (sec.text) para(sec.text, { gap: 2 })
    // Ảnh minh họa (base64)
    if (sec.image) {
      try {
        const props = doc.getImageProperties(sec.image)
        const maxW = 80, maxH = 95
        let iw = props.width, ih = props.height
        const ratio = Math.min(maxW / iw, maxH / ih)
        iw *= ratio; ih *= ratio
        need(ih + 8)
        const fmtType = (props.fileType || 'PNG').toUpperCase()
        doc.addImage(sec.image, fmtType === 'JPG' ? 'JPEG' : fmtType, (W - iw) / 2, y, iw, ih)
        y += ih + 3
        if (sec.caption) { doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...SOFT); need(6); doc.text(sec.caption, W / 2, y, { align: 'center' }); y += 6 }
      } catch (e) { console.error('Ảnh phụ lục lỗi:', e) }
    }
    y += 3
  })
}

const dmyStr = (d) => {
  const x = dmy(d)
  return `${String(x.d).padStart(2, '0')}/${String(x.m).padStart(2, '0')}/${x.y}`
}

function paginate(doc, W, H) {
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...SOFT)
    doc.text(`Trang ${i}/${total}`, W / 2, H - 10, { align: 'center' })
  }
}

const DEFAULT_CLAUSES = [
  {
    title: 'ĐIỀU 4. QUYỀN HẠN VÀ TRÁCH NHIỆM CỦA BÊN A',
    lines: [
      '4.1. Thực hiện đúng và đầy đủ nghĩa vụ của Hợp đồng này.',
      '4.2. Từ chối nhận hàng khi Bên B giao hàng không đúng, không đủ theo yêu cầu, thỏa thuận của Hợp đồng này.',
      '4.3. Khiếu nại và yêu cầu Bên B khắc phục những khiếm khuyết của hàng hóa và thực hiện đổi trả hàng hóa có chất lượng tương đương (nếu cần thiết).',
      '4.4. Yêu cầu Bên B bồi thường cho các thiệt hại phát sinh khi Bên B vi phạm Hợp đồng này.',
      '4.5. Yêu cầu Bên B cung cấp đầy đủ hồ sơ, chứng từ, đối với hàng hóa đã nhận.',
      '4.6. Bố trí người phụ trách để Bên B thuận tiện giao hàng, nhận hàng, kiểm tra, ký Biên bản giao nhận hàng hóa.',
      '4.7. Chịu trách nhiệm thanh toán theo đúng quy định của Hợp đồng này.',
    ],
  },
  {
    title: 'ĐIỀU 5. QUYỀN HẠN VÀ TRÁCH NHIỆM CỦA BÊN B',
    lines: [
      '5.1. Yêu cầu Bên A thanh toán theo điều khoản thanh toán trong Hợp đồng này.',
      '5.2. Yêu cầu Bên A chịu trách nhiệm đối với hành vi vi phạm Hợp đồng này.',
      '5.3. Từ chối, tạm ngưng không giao hàng khi Bên A vi phạm nghĩa vụ thanh toán.',
      '5.4. Bên B có trách nhiệm cung cấp đầy đủ cho Bên A các hồ sơ, chứng từ hợp lệ theo quy định của pháp luật và Hợp đồng này.',
      '5.5. Giao hàng cho Bên A theo đúng số lượng, quy cách, chất lượng, thời gian và địa điểm theo quy định của Hợp đồng này.',
      '5.6. Chịu trách nhiệm đối với hành vi vi phạm Hợp đồng và bồi thường thiệt hại cho Bên A khi vi phạm Hợp đồng này.',
      '5.7. Chịu trách nhiệm với chất lượng và số lượng hàng hóa cho đến khi bàn giao cho Bên A và Hai Bên đã ký kết Biên bản nghiệm thu và thanh lý Hợp đồng.',
      '5.8. Chịu phạt 8% cho phần giá trị hàng hóa bàn giao chậm khi Bên B bàn giao hàng hóa chậm hơn so với thời gian giao hàng quy định tại Điều 3 Hợp đồng này.',
    ],
  },
  {
    title: 'ĐIỀU 6. SỰ KIỆN BẤT KHẢ KHÁNG',
    lines: [
      'Sự kiện bất khả kháng là sự kiện xảy ra mang tính khách quan và nằm ngoài tầm kiểm soát của Hai Bên như hỏa hoạn, động đất, bão, lũ, lụt, lốc, sóng thần, lở đất, dịch bệnh, chiến tranh hoặc có nguy cơ xảy ra chiến tranh... và các thảm hoạ khác chưa lường hết được, sự thay đổi chính sách hoặc ngăn cấm của cơ quan có thẩm quyền của Việt Nam… Một sự kiện sẽ chỉ được coi là sự kiện bất khả kháng khi và chỉ khi Bên bị ảnh hưởng bởi sự kiện bất khả kháng thông báo ngay lập tức cho Bên còn lại về sự kiện bất khả kháng. Trong trường hợp này, Hai Bên sẽ được miễn trừ trách nhiệm liên quan đến việc không thực hiện đúng nghĩa vụ theo Hợp đồng này.',
    ],
  },
  {
    title: 'ĐIỀU 7. GIẢI QUYẾT TRANH CHẤP',
    lines: [
      'Trong quá trình thực hiện Hợp đồng này nếu xảy ra bất kỳ sự bất đồng nào, Bên nảy sinh bất đồng sẽ thông báo cho Bên kia bằng văn bản. Hai Bên sẽ thương lượng để giải quyết các bất đồng đó. Trường hợp Hai Bên không tự thương lượng được thì sự việc sẽ được đưa ra giải quyết tại tòa án có thẩm quyền tại Hà Nội và theo quy định của pháp luật Việt Nam. Phán quyết của tòa án là quyết định cuối cùng và có giá trị thi hành với cả Hai Bên. Bên thua kiện phải chịu mọi án phí và các khoản bao gồm chi phí luật sư, các chi phí khác để Bên còn lại tham gia trong quá trình giải quyết tranh chấp.',
    ],
  },
  {
    title: 'ĐIỀU 8. HIỆU LỰC THI HÀNH',
    lines: [
      'Hợp đồng này có hiệu lực kể từ ngày ký ở phần đầu của Hợp đồng, và chỉ được coi là kết thúc khi Hai Bên đã hoàn thành các nghĩa vụ của mình trong Hợp đồng và ký kết Biên bản nghiệm thu và thanh lý Hợp đồng. Trong trường hợp một Bên muốn sửa đổi các điều khoản trong Hợp đồng thì phải thông báo cho Bên kia biết trước ít nhất là 03 ngày và cùng nhau thoả thuận lại những điểm cần thay đổi với sự đồng ý của cả Hai Bên.',
      'Hợp đồng này được lập thành 04 (bốn) bản có giá trị pháp lý như nhau, mỗi Bên giữ 02 (hai) bản để thực hiện.',
    ],
  },
]

export { DEFAULT_CLAUSES }
