import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './robotoFont'
import { docSoThanhChu } from './numberToWords'

const INK = [31, 36, 48]
const SOFT = [70, 76, 90]

// Bên bán mặc định (VNF)
export const DEFAULT_SELLER = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, phường Bắc Giang, tỉnh Bắc Ninh, Việt Nam',
  tax_code: '2400883385',
  account: '19135661522015',
  bank: 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank) - Chi nhánh Bắc Giang',
  rep_name: 'Ông Vũ Văn Cường',
  rep_title: 'Giám Đốc',
}

// Nội dung mặc định các điều khoản có thể tùy chỉnh (dùng chung cho form nhập & PDF)
export const DEFAULT_CLAUSES = {
  clause_1_2: 'Đơn giá nêu trên đã bao gồm chi phí in logo, hộp bán lẻ, đai giấy, đóng gói và vận chuyển đến địa điểm quy định tại Điều 3; đã bao gồm thuế GTGT.',
  clause_1_3: 'Hàng hóa phải mới 100%, đúng model, số lượng, màu sắc, thông số và mẫu đã được Bên A xác nhận; hình thức nguyên vẹn, không có hư hỏng ảnh hưởng đến công năng. Logo và bao bì thực hiện theo Phụ lục số 01.',
  clause_1_4: 'Bên B chỉ sản xuất hàng loạt sau khi Bên A xác nhận mẫu qua văn bản, email, tin nhắn hoặc hình thức điện tử khác của người phụ trách. Mọi thay đổi sau khi duyệt mẫu phải được Bên B chấp thuận; Bên A chịu chi phí và thời gian phát sinh. Sai lệch nhỏ về sắc độ do vật liệu, mực in hoặc thiết bị hiển thị, nếu phù hợp với mẫu đã duyệt và không ảnh hưởng đáng kể đến hình thức, công năng, không được coi là lỗi.',
  clause_1_5: 'Hàng hóa được bảo hành 12 tháng kể từ ngày ký Biên bản giao nhận theo Điều 3 của Hợp đồng.',
  clause_2_4: 'Nghĩa vụ thanh toán hoàn thành khi tiền được ghi có vào tài khoản của Bên B. Nếu Bên A chậm thanh toán, Bên B có quyền tạm ngừng sản xuất hoặc giao hàng, điều chỉnh tiến độ tương ứng và yêu cầu lãi chậm trả theo Luật Thương mại cùng các chi phí hợp lý phát sinh trực tiếp.',
  clause_3_3: 'Khi giao hàng, Hai Bên ký Biên bản giao nhận. Số lượng, chủng loại, tình trạng bao bì và hư hỏng bên ngoài phải được kiểm tra, ghi nhận ngay khi nhận hàng. Lỗi có thể nhận biết bằng kiểm tra thông thường phải được Bên A thông báo bằng văn bản hoặc email trong 03 ngày làm việc; hết thời hạn này, hàng hóa được coi là đã nghiệm thu đối với các lỗi đó.',
  clause_3_4: 'Rủi ro mất mát, hư hỏng chuyển sang Bên A khi ký Biên bản giao nhận; quyền sở hữu chuyển sang Bên A sau khi Bên B nhận đủ tiền.',
}

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN')
// Đơn giá: giữ tối đa 2 số thập phân (462.962,96); nếu là số nguyên thì không hiện phần thập phân
const fmt2 = (n) => {
  const v = Number(n) || 0
  return v.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
const dmy = (d) => {
  const dt = d ? new Date(d) : new Date()
  return { d: dt.getDate(), m: dt.getMonth() + 1, y: dt.getFullYear() }
}
const dmyStr = (d) => {
  const x = dmy(d)
  return `${String(x.d).padStart(2, '0')}/${String(x.m).padStart(2, '0')}/${x.y}`
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

  const need = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 22 } }

  const para = (text, opt = {}) => {
    const { bold = false, size = 11, gap = 1.5, align = 'left', indent = 0, lh = 5 } = opt
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

  const infoRow = (label, value, opt = {}) => {
    const { bold = false, labelW = 42, lh = 5 } = opt
    doc.setFont('Roboto', 'normal').setFontSize(11).setTextColor(...INK)
    const valLines = doc.splitTextToSize(String(value || ''), CW - labelW)
    need(Math.max(lh, valLines.length * lh))
    const startY = y
    doc.text(label, M, y)
    doc.text(':', M + labelW - 3, y)
    doc.setFont('Roboto', bold ? 'bold' : 'normal')
    valLines.forEach((ln, i) => {
      if (i > 0) { need(lh) }
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
  doc.setFont('Roboto', 'bold').setFontSize(14)
  doc.text('HỢP ĐỒNG MUA BÁN HÀNG HÓA', W / 2, y, { align: 'center' }); y += 6
  doc.setFont('Roboto', 'normal').setFontSize(11)
  doc.text(`Số: ${data.contract_number || ''}`, W / 2, y, { align: 'center' }); y += 8

  /* ---------- Căn cứ ---------- */
  const bases = [
    '- Căn cứ Bộ luật Dân sự số 91/2015/QH13 và các văn bản hướng dẫn thi hành;',
    '- Căn cứ Luật Thương mại số 36/2005/QH11 và các văn bản sửa đổi, bổ sung, hướng dẫn thi hành;',
    '- Căn cứ nhu cầu mua hàng của Bên A và khả năng cung cấp hàng hóa của Bên B;',
  ]
  bases.forEach((b) => para(b, { size: 10.5, gap: 1, lh: 4.8, indent: 0 }))
  y += 1

  para(`Hôm nay, ngày ${String(dt.d).padStart(2, '0')} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}, tại ${data.sign_place || 'Hà Nội'}, chúng tôi gồm có:`, { gap: 3 })

  /* ---------- Bên A (MUA - khách) ---------- */
  infoRow('BÊN MUA (BÊN A)', (buyer.name || '').toUpperCase(), { bold: true, labelW: 42 })
  infoRow('Địa chỉ', buyer.address, { labelW: 42 })
  infoRow('Mã số thuế', buyer.tax_code, { labelW: 42 })
  infoRow('Người đại diện', buyer.rep_name, { labelW: 42 })
  infoRow('Chức vụ', buyer.rep_title, { labelW: 42 })
  y += 4

  /* ---------- Bên B (BÁN - VNF) ---------- */
  infoRow('BÊN BÁN (BÊN B)', (seller.name || '').toUpperCase(), { bold: true, labelW: 42 })
  infoRow('Địa chỉ', seller.address, { labelW: 42 })
  infoRow('Mã số thuế', seller.tax_code, { labelW: 42 })
  infoRow('Người đại diện', seller.rep_name, { labelW: 42 })
  infoRow('Chức vụ', seller.rep_title, { labelW: 42 })
  y += 4

  para('Bên A và Bên B sau đây gọi riêng là "Bên", gọi chung là "Hai Bên".', { bold: true, gap: 1.5 })
  para('Hai Bên thống nhất ký kết Hợp đồng mua bán hàng hóa ("Hợp đồng") với nội dung và điều khoản như sau:', { gap: 3 })

  /* ---------- ĐIỀU 1 ---------- */
  need(14)
  para('ĐIỀU 1. NỘI DUNG HỢP ĐỒNG', { bold: true, gap: 2 })
  para('1.1. Hàng hóa mua bán', { gap: 1.5 })
  para('Bên A đồng ý mua và Bên B đồng ý cung cấp hàng hóa với nội dung như sau:', { gap: 2 })

  const items = data.items || []
  const vatRate = Number(data.vat_percent) || 0
  const useVat = data.use_vat !== false
  const lineTotal = (it) => Math.round((Number(it.qty) || 0) * (Number(it.price) || 0))
  const sub = items.reduce((s, it) => s + lineTotal(it), 0)
  // VAT & tổng tính từ giá trị chính xác rồi khử sai số làm tròn nhỏ (<=2đ) do đơn giá chia ngược
  const roundTiny = (n) => {
    const r = Math.round(n)
    const near1000 = Math.round(n / 1000) * 1000
    // Nếu rất gần bội số 1000 (chênh <=2đ) thì lấy bội số 1000 cho "đẹp"
    if (Math.abs(n - near1000) <= 3) return near1000
    return r
  }
  const vatExact = useVat ? sub * vatRate / 100 : 0
  const grand = roundTiny(sub + vatExact)
  const vat = grand - sub

  const body = items.map((it, i) => [
    String(i + 1),
    it.name || '',
    it.unit || 'Cái',
    it.code || '',
    it.color || '',
    fmt(it.qty),
    fmt2(Number(it.price) || 0),
    fmt(lineTotal(it)),
  ])
  const footRows = [
    [{ content: 'TỔNG CỘNG', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(sub), styles: { halign: 'right', fontStyle: 'bold' } }],
  ]
  if (useVat) footRows.push([{ content: `THUẾ GTGT ${vatRate}%`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(vat), styles: { halign: 'right', fontStyle: 'bold' } }])
  footRows.push([{ content: 'TỔNG GIÁ TRỊ HỢP ĐỒNG', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt(grand), styles: { halign: 'right', fontStyle: 'bold' } }])

  autoTable(doc, {
    startY: y,
    head: [['TT', 'Yêu cầu sản phẩm', 'ĐVT', 'Model', 'Màu', 'Số Lượng', 'Đơn Giá (VNĐ)', 'Thành Tiền (VNĐ)']],
    body,
    foot: footRows,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 2, textColor: INK, lineColor: [130, 130, 130], lineWidth: 0.2, valign: 'middle' },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [242, 242, 242], textColor: INK, halign: 'center', lineColor: [110, 110, 110], lineWidth: 0.25 },
    footStyles: { font: 'Roboto', fillColor: [255, 255, 255], textColor: INK, lineColor: [130, 130, 130] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left' },
      2: { halign: 'center', cellWidth: 11 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 11 },
      5: { halign: 'center', cellWidth: 13 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 24 },
    },
  })
  y = doc.lastAutoTable.finalY + 7

  para(`Bằng chữ: ${docSoThanhChu(grand)}`, { bold: true, gap: 3 })

  /* ---------- 1.2 ---------- */
  need(10)
  para('1.2. ' + (data.clause_1_2 || DEFAULT_CLAUSES.clause_1_2), { gap: 2, lh: 4.8 })

  /* ---------- 1.3 ---------- */
  const quality = data.quality_terms && data.quality_terms.length ? data.quality_terms : [
    DEFAULT_CLAUSES.clause_1_3,
  ]
  para('1.3. ' + quality[0], { gap: 1.5, lh: 4.8 })
  quality.slice(1).forEach((q) => para(q, { gap: 1, lh: 4.8, indent: 6 }))

  /* ---------- 1.4 ---------- */
  para('1.4. ' + (data.clause_1_4 || DEFAULT_CLAUSES.clause_1_4), { gap: 1.5, lh: 4.8 })

  /* ---------- 1.5 ---------- */
  para('1.5. ' + (data.clause_1_5 || DEFAULT_CLAUSES.clause_1_5), { gap: 4, lh: 4.8 })

  /* ---------- ĐIỀU 2 ---------- */
  need(16)
  para('ĐIỀU 2. THANH TOÁN', { bold: true, gap: 2 })
  para(`2.1. Tổng giá trị thanh toán là ${fmt(grand)} đồng (Bằng chữ: ${docSoThanhChu(grand).replace(/\.$/, '')} đồng), đã bao gồm thuế GTGT ${useVat ? vatRate : 0}%.`, { gap: 2, lh: 4.8 })

  para('2.2. Bên A thanh toán thành 02 lần:', { gap: 1 })
  const pct1 = Number(data.advance_percent ?? 70)
  const pct2 = 100 - pct1
  const amt1 = Math.round(grand * pct1 / 100)
  const amt2 = grand - amt1
  para(`a) Lần 1: Thanh toán ${pct1}% giá trị Hợp đồng, tương ứng ${fmt(amt1)} đồng (Bằng chữ: ${docSoThanhChu(amt1).replace(/\.$/, '')} đồng) trong vòng 02 ngày làm việc kể từ ngày Hợp đồng được ký và Bên A nhận được đề nghị thanh toán hợp lệ. Bên B triển khai sản xuất sau khi nhận đủ khoản này và mẫu cuối cùng đã được Bên A xác nhận.`, { gap: 1.5, lh: 4.8, indent: 4 })
  para(`b) Lần 2: Thanh toán ${pct2}% giá trị Hợp đồng còn lại, tương ứng ${fmt(amt2)} đồng (Bằng chữ: ${docSoThanhChu(amt2).replace(/\.$/, '')} đồng) trong vòng 05 ngày làm việc kể từ ngày Bên B giao đủ hàng và cung cấp Biên bản giao nhận, Đề nghị thanh toán và hóa đơn GTGT hợp lệ.`, { gap: 2, lh: 4.8, indent: 4 })

  para('2.3. Thanh toán bằng chuyển khoản vào tài khoản của Bên B:', { gap: 0.5 })
  para(`- Chủ tài khoản: ${seller.name};`, { indent: 4, gap: 0.5, lh: 4.8 })
  para(`- Số tài khoản: ${seller.account};`, { indent: 4, gap: 0.5, lh: 4.8 })
  para(`- Ngân hàng: ${seller.bank}.`, { indent: 4, gap: 2, lh: 4.8 })

  para('2.4. ' + (data.clause_2_4 || DEFAULT_CLAUSES.clause_2_4), { gap: 4, lh: 4.8 })

  /* ---------- ĐIỀU 3 ---------- */
  need(16)
  para('ĐIỀU 3. GIAO HÀNG VÀ NGHIỆM THU', { bold: true, gap: 2 })
  para('3.1. ' + (data.clause_3_1 || `Bên B giao hàng ${data.delivery_time || 'không muộn hơn ngày ……/……/……'}, với điều kiện đã nhận đủ khoản thanh toán lần 1 và Bên A xác nhận mẫu cuối cùng đúng thời hạn. Nếu Bên A chậm thanh toán, chậm cung cấp thông tin hoặc chậm duyệt mẫu, thời hạn giao hàng được gia hạn tương ứng.`), { gap: 1.5, lh: 4.8 })
  para(`3.2. Địa điểm giao hàng: ${data.delivery_address || '……………………………………………………'}. ${data.shipping_by || 'Chi phí vận chuyển do Bên B chịu.'}`, { gap: 1.5, lh: 4.8 })
  para('3.3. ' + (data.clause_3_3 || DEFAULT_CLAUSES.clause_3_3), { gap: 1.5, lh: 4.8 })
  para('3.4. ' + (data.clause_3_4 || DEFAULT_CLAUSES.clause_3_4), { gap: 4, lh: 4.8 })

  /* ---------- ĐIỀU 4 ---------- */
  need(14)
  para('ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A', { bold: true, gap: 2 })
  const d4 = [
    '4.1. Thanh toán đầy đủ, đúng hạn; cung cấp chính xác, kịp thời file logo, nội dung in, thông tin nhận hàng và các tài liệu cần thiết.',
    '4.2. Cam kết có quyền sử dụng hợp pháp logo, nhãn hiệu, hình ảnh và nội dung cung cấp; tự giải quyết và bồi hoàn cho Bên B các thiệt hại nếu phát sinh tranh chấp với bên thứ ba.',
    '4.3. Kiểm tra và xác nhận mẫu trong vòng 02 ngày làm việc kể từ khi nhận được đề nghị của Bên B. Xác nhận qua email, tin nhắn hoặc hình thức điện tử của đầu mối được coi là hợp lệ.',
    '4.4. Bố trí người nhận hàng, kiểm tra và ký chứng từ; có quyền yêu cầu Bên B sửa chữa, in lại, bổ sung hoặc đổi phần hàng không phù hợp do lỗi của Bên B.',
    '4.5. Mọi thay đổi hoặc hủy đơn sau khi duyệt mẫu phải được Bên B chấp thuận. Bên A thanh toán giá trị hàng đã hoàn thành, nguyên vật liệu không thể dùng cho khách hàng khác, cùng các chi phí thực tế, hợp lý không thể thu hồi.',
  ]
  d4.forEach((l) => para(l, { gap: 1, lh: 4.8 }))
  y += 2

  /* ---------- ĐIỀU 5 ---------- */
  need(14)
  para('ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B', { bold: true, gap: 2 })
  const d5 = [
    '5.1. Yêu cầu Bên A thanh toán, cung cấp thông tin và xác nhận mẫu đúng hạn; được tạm ngừng thực hiện Hợp đồng khi Bên A chậm thực hiện các nghĩa vụ này sau khi đã thông báo.',
    '5.2. Cung cấp và giao hàng đúng Hợp đồng, Phụ lục và mẫu đã duyệt; cung cấp Biên bản giao nhận, Đề nghị thanh toán, hóa đơn GTGT và các tài liệu khác đã được Hai Bên thỏa thuận.',
    '5.3. Nếu hàng hóa không phù hợp do lỗi của Bên B, Bên B được ưu tiên sửa chữa, in lại, bổ sung, đổi sản phẩm tương đương, giảm giá hoặc hoàn trả giá trị phần không thể khắc phục. Thời hạn xử lý là 07 ngày làm việc kể từ khi nhận đủ hàng lỗi và thông tin cần thiết.',
    '5.4. Bảo hành lỗi kỹ thuật do sản xuất trong 12 tháng kể từ ngày giao nhận. Không bảo hành trường hợp rơi vỡ, va đập, vào nước, cháy nổ hoặc biến dạng do tác động bên ngoài; sử dụng sai hướng dẫn hoặc tự ý tháo sửa; hao mòn tự nhiên.',
    '5.5. Nếu Bên B giao hàng chậm do lỗi của mình, mức phạt là 0,05% giá trị phần hàng giao chậm cho mỗi ngày chậm, tối đa 8% giá trị phần nghĩa vụ bị vi phạm. Không áp dụng nếu chậm do Bên A, do Hai Bên gia hạn hoặc do bất khả kháng.',
    '5.6. Chỉ sử dụng logo, nhãn hiệu, hình ảnh và nội dung của Bên A để thực hiện Hợp đồng, trừ khi được Bên A đồng ý bằng văn bản.',
  ]
  d5.forEach((l) => para(l, { gap: 1, lh: 4.8 }))
  y += 2

  /* ---------- ĐIỀU 6 ---------- */
  need(14)
  para('ĐIỀU 6. BẤT KHẢ KHÁNG', { bold: true, gap: 2 })
  const d6 = [
    '6.1. Bất khả kháng là sự kiện xảy ra khách quan, không thể lường trước và không thể khắc phục dù Bên bị ảnh hưởng đã áp dụng biện pháp cần thiết, hợp lý, như thiên tai, hỏa hoạn lớn, dịch bệnh do cơ quan có thẩm quyền công bố, chiến tranh, bạo loạn, đình công diện rộng, gián đoạn nghiêm trọng giao thông hoặc điện, hoặc quyết định của cơ quan nhà nước làm một Bên không thể thực hiện nghĩa vụ. Thiếu vốn, biến động giá thông thường hoặc lỗi của nhà cung cấp có thể thay thế hợp lý không đương nhiên là bất khả kháng.',
    '6.2. Bên bị ảnh hưởng phải thông báo bằng văn bản hoặc email trong vòng 03 ngày làm việc kể từ khi xảy ra sự kiện, nêu nghĩa vụ bị ảnh hưởng, thời gian dự kiến và biện pháp hạn chế thiệt hại; đồng thời cung cấp chứng cứ theo yêu cầu hợp lý.',
    '6.3. Bên bị ảnh hưởng được miễn trách nhiệm đối với phần nghĩa vụ bị ảnh hưởng trực tiếp; thời hạn thực hiện được gia hạn tương ứng. Nếu sự kiện bất khả kháng kéo dài liên tục quá 30 ngày, Hai Bên thương lượng phương án tiếp tục hoặc chấm dứt phần Hợp đồng chưa thực hiện.',
  ]
  d6.forEach((l) => para(l, { gap: 1, lh: 4.8 }))
  y += 2

  /* ---------- ĐIỀU 7 ---------- */
  need(14)
  para('ĐIỀU 7. VI PHẠM, CHẤM DỨT VÀ GIẢI QUYẾT TRANH CHẤP', { bold: true, gap: 2 })
  const d7 = [
    '7.1. Bên vi phạm phải khắc phục trong vòng 05 ngày làm việc kể từ khi nhận được thông báo bằng văn bản. Nếu không khắc phục hoặc vi phạm làm mục đích Hợp đồng không đạt được, Bên bị vi phạm có quyền tạm ngừng hoặc chấm dứt phần Hợp đồng chưa thực hiện, yêu cầu phạt vi phạm và bồi thường thiệt hại thực tế theo quy định.',
    '7.2. Tranh chấp trước hết được thương lượng trong vòng 30 ngày kể từ ngày một Bên nhận thông báo tranh chấp. Nếu không giải quyết được, tranh chấp được đưa ra Tòa án có thẩm quyền nơi Bên B đặt trụ sở. Bản án có hiệu lực pháp luật có giá trị bắt buộc với Hai Bên.',
  ]
  d7.forEach((l) => para(l, { gap: 1, lh: 4.8 }))
  y += 2

  /* ---------- ĐIỀU 8 ---------- */
  need(14)
  para('ĐIỀU 8. HIỆU LỰC VÀ ĐIỀU KHOẢN CHUNG', { bold: true, gap: 2 })
  const d8 = [
    '8.1. Hợp đồng có hiệu lực từ ngày đại diện có thẩm quyền của Hai Bên ký và tự động chấm dứt khi các nghĩa vụ đã hoàn thành, trừ nghĩa vụ bảo hành, thanh toán, bồi thường và giải quyết tranh chấp còn tiếp tục theo nội dung Hợp đồng.',
    '8.2. Phụ lục, mẫu được duyệt và các sửa đổi, bổ sung bằng văn bản là bộ phận không tách rời của Hợp đồng. Xác nhận qua email, tin nhắn hoặc hình thức điện tử của đầu mối do mỗi Bên chỉ định có giá trị đối với việc duyệt mẫu, tiến độ, giao nhận và các vấn đề thực hiện Hợp đồng, trừ việc sửa đổi giá trị Hợp đồng hoặc chấm dứt Hợp đồng phải do người có thẩm quyền xác nhận.',
    '8.3. Hợp đồng được lập thành 04 bản có giá trị pháp lý như nhau, mỗi Bên giữ 02 bản để thực hiện.',
  ]
  d8.forEach((l) => para(l, { gap: 1, lh: 4.8 }))
  y += 4

  /* ---------- Chữ ký hợp đồng ---------- */
  need(45)
  const cA = W * 0.28, cB = W * 0.72
  doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
  doc.text('ĐẠI DIỆN BÊN A', cA, y, { align: 'center' })
  doc.text('ĐẠI DIỆN BÊN B', cB, y, { align: 'center' }); y += 4
  doc.setFont('Roboto', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  doc.text('(Ký, ghi rõ họ tên, đóng dấu)', cA, y, { align: 'center' })
  doc.text('(Ký, ghi rõ họ tên, đóng dấu)', cB, y, { align: 'center' }); y += 28
  doc.setFont('Roboto', 'bold').setFontSize(11).setTextColor(...INK)
  if (buyer.rep_name) doc.text(stripTitle(buyer.rep_name).toUpperCase(), cA, y, { align: 'center' })
  doc.text(stripTitle(seller.rep_name).toUpperCase(), cB, y, { align: 'center' })

  /* ---------- PHỤ LỤC ---------- */
  if (data.has_appendix) {
    renderAppendix(doc, data, { W, H, M, CW })
  }

  paginate(doc, W, H)
  doc.save(`HopDong_${(data.contract_number || 'HDMB').replace(/[\/\\]/g, '-')}.pdf`)
}

function renderAppendix(doc, data, ctx) {
  const { W, H, M, CW } = ctx
  doc.addPage()
  let y = 22
  const INK = [31, 36, 48]
  const SOFT = [70, 76, 90]
  const BOTTOM = H - 18

  const need = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 22 } }
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

  const sigDate = data.signed_at || data.created_at
  para(`Phụ lục này là một phần không tách rời của Hợp đồng số: ${data.contract_number || ''}${sigDate ? `, ký ngày ${dmyStr(sigDate)}` : ''}.`, { gap: 3 })
  para('Hai bên thống nhất quy cách thực hiện như sau:', { gap: 4 })

  const sections = data.appendix_sections || []
  sections.forEach((sec, idx) => {
    need(14)
    para(`${idx + 1}. ${sec.title || ''}`, { bold: true, gap: 2 })
    ;(sec.bullets || []).forEach((b) => para('●  ' + b, { gap: 0.6, lh: 4.8, indent: 6 }))
    if (sec.text) para(sec.text, { gap: 2 })
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
        if (sec.caption) {
          doc.setFont('Roboto', 'normal').setFontSize(9.5).setTextColor(...SOFT)
          need(6); doc.text(sec.caption, W / 2, y, { align: 'center' }); y += 6
        }
      } catch (e) { console.error('Ảnh phụ lục lỗi:', e) }
    }
    y += 3
  })
}

function paginate(doc, W, H) {
  const total = doc.internal.getNumberOfPages()
  const INK = [31, 36, 48]
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(...INK)
    doc.text(`Trang ${i}/${total}`, W / 2, H - 10, { align: 'center' })
  }
}
