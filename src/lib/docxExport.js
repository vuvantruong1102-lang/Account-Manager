// Xuất file .docx (Word / Google Docs) cho Hợp đồng, Phiếu xuất kho, Biên bản bàn giao, Báo giá
// Dùng thư viện docx (chạy hoàn toàn trong trình duyệt) + file-saver để tải về.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, HeadingLevel, VerticalAlign,
} from 'docx'
import { saveAs } from 'file-saver'
import { docSoThanhChu } from './numberToWords'
import { DEFAULT_SELLER, DEFAULT_CLAUSES } from './contractPdf'

/* ============ Helpers dùng chung ============ */
const FONT = 'Times New Roman'
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN')
const fmt2 = (n) => {
  const v = Number(n) || 0
  return v % 1 === 0 ? v.toLocaleString('vi-VN') : v.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const dmy = (d) => {
  const x = d ? new Date(d) : new Date()
  return { d: x.getDate(), m: x.getMonth() + 1, y: x.getFullYear() }
}
const stripTitle = (s) => String(s || '').replace(/^\s*(Ông|Bà|Anh|Chị|Ms\.?|Mr\.?|Mrs\.?)\s+/i, '').trim()

// Đoạn văn thường
const P = (text, opt = {}) => {
  const { bold = false, italics = false, size = 24, align = AlignmentType.JUSTIFIED, spacingAfter = 100, indent = 0 } = opt
  return new Paragraph({
    alignment: align,
    spacing: { after: spacingAfter, line: 276 },
    indent: indent ? { left: indent } : undefined,
    children: [new TextRun({ text, bold, italics, size, font: FONT })],
  })
}
// Đoạn nhiều run (để in đậm 1 phần)
const PRuns = (runs, opt = {}) => {
  const { align = AlignmentType.JUSTIFIED, spacingAfter = 100, indent = 0 } = opt
  return new Paragraph({
    alignment: align,
    spacing: { after: spacingAfter, line: 276 },
    indent: indent ? { left: indent } : undefined,
    children: runs.map((r) => new TextRun({ text: r.text, bold: !!r.bold, italics: !!r.italics, size: r.size || 24, font: FONT })),
  })
}
const H = (text) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120, before: 120 },
  children: [new TextRun({ text, bold: true, size: 32, font: FONT })],
})

// Ô bảng
const cell = (children, opt = {}) => {
  const { width, align = AlignmentType.LEFT, bold = false, size = 22, fill } = opt
  const paras = Array.isArray(children) ? children : [
    new Paragraph({ alignment: align, spacing: { after: 0, line: 252 }, children: [new TextRun({ text: String(children ?? ''), bold, size, font: FONT })] }),
  ]
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: fill ? { fill } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: paras,
  })
}
const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
}

const download = async (doc, fileName) => {
  const blob = await Packer.toBlob(doc)
  saveAs(blob, fileName)
}

/* ============ 1. HỢP ĐỒNG ============ */
export async function exportContractDOCX(data) {
  const seller = { ...DEFAULT_SELLER, ...(data.seller || {}) }
  const buyer = data.buyer || {}
  const dt = dmy(data.signed_at || data.created_at)
  const items = data.items || []
  const vatRate = Number(data.vat_percent) || 0
  const useVat = data.use_vat !== false

  const roundTiny = (n) => {
    const near = Math.round(n / 1000) * 1000
    return Math.abs(n - near) <= 3 ? near : Math.round(n)
  }
  const vatMul = useVat ? (1 + vatRate / 100) : 1
  const unitVat = (it) => roundTiny((Number(it.price) || 0) * vatMul)
  const lineVatTotal = (it) => unitVat(it) * (Number(it.qty) || 0)
  const lineTotal = (it) => Math.round((Number(it.qty) || 0) * (Number(it.price) || 0))
  const sub = items.reduce((s, it) => s + lineTotal(it), 0)
  const grand = items.reduce((s, it) => s + lineVatTotal(it), 0)
  const vat = grand - sub

  const C = { ...DEFAULT_CLAUSES, ...Object.fromEntries(Object.entries(data).filter(([k, v]) => k.startsWith('clause_') && v)) }
  const bangChu = docSoThanhChu(grand).replace(/\.$/, '')

  const info = (label, value, bold = false) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, margins: { top: 10, bottom: 10 }, children: [new Paragraph({ children: [new TextRun({ text: label, size: 24, font: FONT })] })] }),
      new TableCell({ width: { size: 300, type: WidthType.DXA }, margins: { top: 10, bottom: 10 }, children: [new Paragraph({ children: [new TextRun({ text: ':', size: 24, font: FONT })] })] }),
      new TableCell({ margins: { top: 10, bottom: 10 }, children: [new Paragraph({ children: [new TextRun({ text: String(value || ''), bold, size: 24, font: FONT })] })] }),
    ] })],
  })

  // Bảng hàng hóa
  const headRow = new TableRow({
    tableHeader: true,
    children: ['TT', 'Yêu cầu sản phẩm', 'ĐVT', 'Model', 'Màu', 'Số Lượng', 'Đơn Giá (VNĐ)', 'Thành Tiền (VNĐ)']
      .map((t) => cell(t, { align: AlignmentType.CENTER, bold: true, fill: 'F2F2F2', size: 20 })),
  })
  const bodyRows = items.map((it, i) => new TableRow({ children: [
    cell(String(i + 1), { align: AlignmentType.CENTER, size: 20 }),
    cell(it.name || '', { size: 20 }),
    cell(it.unit || 'Cái', { align: AlignmentType.CENTER, size: 20 }),
    cell(it.code || '', { align: AlignmentType.CENTER, size: 20 }),
    cell(it.color || '', { align: AlignmentType.CENTER, size: 20 }),
    cell(fmt(it.qty), { align: AlignmentType.CENTER, size: 20 }),
    cell(fmt2(it.price), { align: AlignmentType.RIGHT, size: 20 }),
    cell(fmt(lineTotal(it)), { align: AlignmentType.RIGHT, size: 20 }),
  ] }))
  const footRow = (label, val) => new TableRow({ children: [
    new TableCell({ columnSpan: 7, margins: { top: 40, bottom: 40, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: label, bold: true, size: 20, font: FONT })] })] }),
    cell(val, { align: AlignmentType.RIGHT, bold: true, size: 20 }),
  ] })
  const foot = [footRow('TỔNG CỘNG', fmt(sub))]
  if (useVat) foot.push(footRow(`THUẾ GTGT ${vatRate}%`, fmt(vat)))
  foot.push(footRow('TỔNG GIÁ TRỊ HỢP ĐỒNG', fmt(grand)))

  const goodsTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorders, columnWidths: [500, 3200, 700, 900, 700, 900, 1500, 1700], rows: [headRow, ...bodyRows, ...foot] })

  // Điều 2 placeholder
  const fill21 = (C.clause_2_1 || DEFAULT_CLAUSES.clause_2_1).replace(/\{tong\}/g, fmt(grand)).replace(/\{bangchu\}/g, bangChu).replace(/\{vat\}/g, String(useVat ? vatRate : 0))
  const pct1 = Number(data.advance_percent ?? 70); const pct2 = 100 - pct1
  const amt1 = Math.round(grand * pct1 / 100); const amt2 = grand - amt1
  const fillAB = (t) => t.replace(/\{pct1\}/g, String(pct1)).replace(/\{pct2\}/g, String(pct2)).replace(/\{amt1\}/g, fmt(amt1)).replace(/\{amt2\}/g, fmt(amt2)).replace(/\{bangchu1\}/g, docSoThanhChu(amt1).replace(/\.$/, '')).replace(/\{bangchu2\}/g, docSoThanhChu(amt2).replace(/\.$/, ''))

  const multi = (txt, indent = 0) => String(txt || '').split('\n').map((s) => s.trim()).filter(Boolean).map((l) => P(l, { indent }))

  const children = [
    P('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: AlignmentType.CENTER, bold: true, spacingAfter: 0 }),
    P('Độc lập - Tự do - Hạnh phúc', { align: AlignmentType.CENTER, bold: true, spacingAfter: 200 }),
    H('HỢP ĐỒNG MUA BÁN HÀNG HÓA'),
    P(`Số: ${data.contract_number || ''}`, { align: AlignmentType.CENTER, spacingAfter: 150 }),
    P('- Căn cứ Bộ luật Dân sự và Luật Thương mại hiện hành của nước Cộng hòa xã hội chủ nghĩa Việt Nam;'),
    P('- Căn cứ nhu cầu mua hàng của Bên A và khả năng cung cấp hàng hóa của Bên B;'),
    P(`Hôm nay, ngày ${dt.d} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}, tại ${data.sign_place || 'Hà Nội'}, chúng tôi gồm có:`, { spacingAfter: 150 }),
    // Bên A
    PRuns([{ text: 'BÊN MUA (BÊN A)', bold: false }]),
    info('BÊN MUA (BÊN A)', buyer.name, true),
    info('Địa chỉ', buyer.address),
    info('Mã số thuế', buyer.tax_code),
    info('Người đại diện', buyer.rep_name),
    info('Chức vụ', buyer.rep_title),
    new Paragraph({ spacing: { after: 80 }, children: [] }),
    // Bên B
    info('BÊN BÁN (BÊN B)', seller.name, true),
    info('Địa chỉ', seller.address),
    info('Mã số thuế', seller.tax_code),
    info('Người đại diện', seller.rep_name),
    info('Chức vụ', seller.rep_title),
    new Paragraph({ spacing: { after: 80 }, children: [] }),
    P('Bên A và Bên B sau đây gọi riêng là "Bên", gọi chung là "Hai Bên".', { bold: true }),
    P('Hai Bên thống nhất ký kết Hợp đồng mua bán hàng hóa ("Hợp đồng") với nội dung và điều khoản như sau:', { spacingAfter: 150 }),
    // Điều 1
    P('ĐIỀU 1. NỘI DUNG HỢP ĐỒNG', { bold: true }),
    P('1.1. Hàng hóa mua bán'),
    P('Bên A đồng ý mua và Bên B đồng ý cung cấp hàng hóa với nội dung như sau:'),
    goodsTable,
    P(`Bằng chữ: ${docSoThanhChu(grand)}`, { bold: true, spacingAfter: 150 }),
    P('1.2. ' + (C.clause_1_2 || DEFAULT_CLAUSES.clause_1_2)),
  ]
  // 1.3 nhiều dòng
  const l13 = String(C.clause_1_3 || DEFAULT_CLAUSES.clause_1_3).split('\n').map((s) => s.trim()).filter(Boolean)
  children.push(P('1.3. ' + (l13[0] || '')))
  l13.slice(1).forEach((q) => children.push(P(q, { indent: 300 })))
  children.push(P('1.4. ' + (C.clause_1_4 || DEFAULT_CLAUSES.clause_1_4)))
  children.push(P('1.5. ' + (C.clause_1_5 || DEFAULT_CLAUSES.clause_1_5), { spacingAfter: 150 }))
  // Điều 2
  children.push(P('ĐIỀU 2. THANH TOÁN', { bold: true }))
  children.push(P('2.1. ' + fill21))
  children.push(P('2.2. ' + (C.clause_2_2_intro || DEFAULT_CLAUSES.clause_2_2_intro)))
  children.push(P(fillAB(C.clause_2_2_a || DEFAULT_CLAUSES.clause_2_2_a), { indent: 300 }))
  children.push(P(fillAB(C.clause_2_2_b || DEFAULT_CLAUSES.clause_2_2_b), { indent: 300 }))
  children.push(P('2.3. ' + (C.clause_2_3_intro || DEFAULT_CLAUSES.clause_2_3_intro)))
  children.push(P(`- Chủ tài khoản: ${seller.name};`, { indent: 300 }))
  children.push(P(`- Số tài khoản: ${seller.account};`, { indent: 300 }))
  children.push(P(`- Ngân hàng: ${seller.bank}.`, { indent: 300 }))
  children.push(P('2.4. ' + (C.clause_2_4 || DEFAULT_CLAUSES.clause_2_4), { spacingAfter: 150 }))
  // Điều 3
  children.push(P('ĐIỀU 3. GIAO HÀNG VÀ NGHIỆM THU', { bold: true }))
  const c31 = C.clause_3_1 || `Bên B giao hàng ${data.delivery_time || 'không muộn hơn ngày ……/……/……'}, với điều kiện đã nhận đủ khoản thanh toán lần 1 và Bên A xác nhận mẫu cuối cùng đúng thời hạn. Nếu Bên A chậm thanh toán, chậm cung cấp thông tin hoặc chậm duyệt mẫu, thời hạn giao hàng được gia hạn tương ứng.`
  children.push(P('3.1. ' + c31))
  children.push(P(`3.2. Địa điểm giao hàng: ${data.delivery_address || '……'}. ${data.shipping_by || 'Chi phí vận chuyển do Bên B chịu.'}`))
  children.push(P('3.3. ' + (C.clause_3_3 || DEFAULT_CLAUSES.clause_3_3)))
  children.push(P('3.4. ' + (C.clause_3_4 || DEFAULT_CLAUSES.clause_3_4), { spacingAfter: 150 }))
  // Điều 4-8
  const dieu = [
    ['ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A', C.clause_4 || DEFAULT_CLAUSES.clause_4],
    ['ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B', C.clause_5 || DEFAULT_CLAUSES.clause_5],
    ['ĐIỀU 6. BẤT KHẢ KHÁNG', C.clause_6 || DEFAULT_CLAUSES.clause_6],
    ['ĐIỀU 7. VI PHẠM, CHẤM DỨT VÀ GIẢI QUYẾT TRANH CHẤP', C.clause_7 || DEFAULT_CLAUSES.clause_7],
    ['ĐIỀU 8. HIỆU LỰC VÀ ĐIỀU KHOẢN CHUNG', C.clause_8 || DEFAULT_CLAUSES.clause_8],
  ]
  dieu.forEach(([title, body]) => {
    children.push(P(title, { bold: true }))
    multi(body).forEach((p) => children.push(p))
    children.push(new Paragraph({ spacing: { after: 60 }, children: [] }))
  })
  // Chữ ký
  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐẠI DIỆN BÊN A', bold: true, size: 24, font: FONT })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐẠI DIỆN BÊN B', bold: true, size: 24, font: FONT })] })] }),
      ] }),
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên, đóng dấu)', italics: true, size: 20, font: FONT })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên, đóng dấu)', italics: true, size: 20, font: FONT })] })] }),
      ] }),
      new TableRow({ children: [
        new TableCell({ margins: { top: 700 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: stripTitle(buyer.rep_name).toUpperCase(), bold: true, size: 24, font: FONT })] })] }),
        new TableCell({ margins: { top: 700 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: stripTitle(seller.rep_name).toUpperCase(), bold: true, size: 24, font: FONT })] })] }),
      ] }),
    ],
  })
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }))
  children.push(sigTable)

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
  })
  await download(doc, `HopDong_${(data.contract_number || 'HD').replace(/\//g, '-')}.docx`)
}

/* ============ Thông tin dùng cho PXK / BBBG / Báo giá ============ */
const SELLER_INFO = {
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT VNF VIỆT NAM',
  address: 'Tổ dân phố Phú Mỹ 3, phường Bắc Giang, tỉnh Bắc Ninh, Việt Nam',
  office: 'VPĐD tại Hà Nội: 18LK19, KĐT Văn Khê, phường Hà Đông, TP Hà Nội',
  taxCode: '2400883385',
  account: '19135661522015',
  email: 'contact@yokool.vn',
  website: 'https://yokool.vn/b2b',
  phone: '0822 838 665',
}
const SIGNER = { name: 'Vũ Văn Cường', title: 'Giám Đốc' }

/* ============ 2. PHIẾU XUẤT KHO ============ */
export async function exportWarehouseDOCX(data) {
  const dt = dmy(data.date || data.created_at)
  const items = data.items || []
  const useVat = !!data.use_vat
  const vatRate = Number(data.vat_percent) || 0
  const roundTiny = (n) => { const near = Math.round(n / 1000) * 1000; return Math.abs(n - near) <= 3 ? near : Math.round(n) }
  const vatMul = useVat ? (1 + vatRate / 100) : 1
  const unitVat = (it) => roundTiny((Number(it.price) || 0) * vatMul)
  const lineTotal = (it) => Math.round((Number(it.qty) || 0) * (Number(it.price) || 0))
  const sub = items.reduce((s, it) => s + lineTotal(it), 0)
  const total = items.reduce((s, it) => s + unitVat(it) * (Number(it.qty) || 0), 0)
  const vat = total - sub

  const headRow = new TableRow({ tableHeader: true, children: ['STT', 'Mã hàng', 'Tên hàng', 'Đơn vị', 'Số lượng', 'Đơn giá', 'Thành tiền'].map((t) => cell(t, { align: AlignmentType.CENTER, bold: true, size: 20 })) })
  const bodyRows = items.map((it, i) => new TableRow({ children: [
    cell(String(i + 1), { align: AlignmentType.CENTER, size: 20 }),
    cell(it.code || '', { size: 20 }),
    cell(it.name || '', { size: 20 }),
    cell(it.unit || '', { align: AlignmentType.CENTER, size: 20 }),
    cell(fmt(it.qty), { align: AlignmentType.CENTER, size: 20 }),
    cell(fmt(it.price), { align: AlignmentType.RIGHT, size: 20 }),
    cell(fmt(lineTotal(it)), { align: AlignmentType.RIGHT, size: 20 }),
  ] }))
  const sumRow = (label, val, bold = false) => new TableRow({ children: [
    new TableCell({ columnSpan: 6, margins: { top: 40, bottom: 40, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: label, bold, size: 20, font: FONT })] })] }),
    cell(val, { align: AlignmentType.RIGHT, bold, size: 20 }),
  ] })
  const sums = [sumRow('Cộng tiền hàng', fmt(sub))]
  if (useVat) sums.push(sumRow(`Thuế suất thuế GTGT: ${vatRate}% — Tiền thuế GTGT:`, fmt(vat)))
  sums.push(sumRow('Tổng tiền thanh toán', fmt(total), true))
  const table = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorders, rows: [headRow, ...bodyRows, ...sums] })

  const children = [
    P(SELLER_INFO.name, { bold: true, align: AlignmentType.LEFT, spacingAfter: 0, size: 20 }),
    P(SELLER_INFO.address, { align: AlignmentType.LEFT, spacingAfter: 150, size: 18 }),
    H('PHIẾU XUẤT KHO BÁN HÀNG'),
    P(`Ngày ${dt.d} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}`, { align: AlignmentType.CENTER, spacingAfter: 0 }),
    P(`Số: ${data.doc_number || data.contract_number || ''}`, { align: AlignmentType.CENTER, bold: true, spacingAfter: 150 }),
    P(`Tên khách hàng: ${data.company_name || data.buyer?.name || ''}`, { spacingAfter: 0 }),
    P(`Địa chỉ: ${data.address || data.buyer?.address || ''}`, { spacingAfter: 0 }),
    P(`Mã số thuế: ${data.tax_code || data.buyer?.tax_code || ''}`, { spacingAfter: 150 }),
    table,
    P(`Số tiền bằng chữ: ${docSoThanhChu(total)}`, { bold: true, spacingAfter: 300 }),
  ]
  // Chữ ký 3 cột
  const sigCells = [['Người mua hàng', '(Ký, họ tên)'], ['Kế toán trưởng', '(Ký, họ tên)'], ['Giám đốc', '(Ký, họ tên, đóng dấu)']]
  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [
      new TableRow({ children: [new TableCell({ columnSpan: 3, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Ngày ${dt.d} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}`, size: 22, font: FONT })] })] })] }),
      new TableRow({ children: sigCells.map(([a]) => new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: a, bold: true, size: 22, font: FONT })] })] })) }),
      new TableRow({ children: sigCells.map(([, b]) => new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: b, italics: true, size: 18, font: FONT })] })] })) }),
    ],
  })
  children.push(sigTable)

  const doc = new Document({ styles: { default: { document: { run: { font: FONT, size: 24 } } } }, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }] })
  await download(doc, `PhieuXuatKho_${(data.doc_number || data.contract_number || 'PXK').replace(/\//g, '-')}.docx`)
}

/* ============ 3. BIÊN BẢN BÀN GIAO ============ */
export async function exportDeliveryDOCX(data) {
  const dt = dmy(data.date || data.created_at)
  const items = data.items || []
  const children = [
    P('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: AlignmentType.CENTER, bold: true, spacingAfter: 0 }),
    P('Độc lập - Tự do - Hạnh phúc', { align: AlignmentType.CENTER, bold: true, spacingAfter: 200 }),
    H('BIÊN BẢN BÀN GIAO HÀNG HÓA'),
    P(`Hôm nay, ngày ${dt.d} tháng ${String(dt.m).padStart(2, '0')} năm ${dt.y}, chúng tôi gồm:`, { spacingAfter: 150 }),
    P('BÊN GIAO HÀNG (BÊN A):', { bold: true, spacingAfter: 0 }),
    P(SELLER_INFO.name, { spacingAfter: 0 }),
    P(`Địa chỉ: ${SELLER_INFO.address}`, { spacingAfter: 0 }),
    P(`Mã số thuế: ${SELLER_INFO.taxCode}`, { spacingAfter: 0 }),
    P(`Đại diện: Ông ${SIGNER.name}          Chức vụ: ${SIGNER.title}`, { spacingAfter: 150 }),
    P('BÊN NHẬN HÀNG (BÊN B):', { bold: true, spacingAfter: 0 }),
    P(data.company_name || data.buyer?.name || '', { spacingAfter: 0 }),
    P(`Địa chỉ: ${data.address || data.buyer?.address || ''}`, { spacingAfter: 0 }),
    P(`Mã số thuế: ${data.tax_code || data.buyer?.tax_code || ''}`, { spacingAfter: 0 }),
    P(`Đại diện: ${data.rep_name || data.buyer?.rep_name || ''}`, { spacingAfter: 150 }),
    P('Hai bên tiến hành bàn giao hàng hóa với nội dung như sau:', { spacingAfter: 100 }),
  ]
  const headRow = new TableRow({ tableHeader: true, children: ['STT', 'Tên hàng hóa', 'ĐVT', 'Số lượng', 'Ghi chú'].map((t) => cell(t, { align: AlignmentType.CENTER, bold: true, size: 20 })) })
  const bodyRows = items.map((it, i) => new TableRow({ children: [
    cell(String(i + 1), { align: AlignmentType.CENTER, size: 20 }),
    cell(it.name || '', { size: 20 }),
    cell(it.unit || '', { align: AlignmentType.CENTER, size: 20 }),
    cell(fmt(it.qty), { align: AlignmentType.CENTER, size: 20 }),
    cell('', { size: 20 }),
  ] }))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorders, rows: [headRow, ...bodyRows] }))
  children.push(P('Hai bên đã kiểm tra và xác nhận hàng hóa được bàn giao đầy đủ, đúng chủng loại và số lượng nêu trên.', { spacingAfter: 100 }))
  children.push(P('Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.', { spacingAfter: 300 }))
  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐẠI DIỆN BÊN NHẬN', bold: true, size: 24, font: FONT })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐẠI DIỆN BÊN GIAO', bold: true, size: 24, font: FONT })] })] }),
      ] }),
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 20, font: FONT })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 20, font: FONT })] })] }),
      ] }),
      new TableRow({ children: [
        new TableCell({ margins: { top: 700 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: stripTitle(data.rep_name || data.buyer?.rep_name || '').toUpperCase(), bold: true, size: 24, font: FONT })] })] }),
        new TableCell({ margins: { top: 700 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: SIGNER.name.toUpperCase(), bold: true, size: 24, font: FONT })] })] }),
      ] }),
    ],
  })
  children.push(sigTable)
  const doc = new Document({ styles: { default: { document: { run: { font: FONT, size: 24 } } } }, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }] })
  await download(doc, `BienBanBanGiao_${(data.doc_number || data.contract_number || 'BBBG').replace(/\//g, '-')}.docx`)
}

/* ============ 4. BÁO GIÁ ============ */
export async function exportQuoteDOCX(quote) {
  const dt = dmy(quote.created_at)
  const items = quote.items || []
  const rate = Number(quote.vat_percent) || 0
  const sub = items.reduce((s, it) => s + (Number(it.qty) || 0) * Math.round(Number(it.price) || 0), 0)
  const vat = Math.round(sub * rate / 100)
  const total = sub + vat

  const children = [
    P(SELLER_INFO.name, { bold: true, align: AlignmentType.LEFT, spacingAfter: 0, size: 22 }),
    P(`Địa chỉ: ${SELLER_INFO.address}`, { align: AlignmentType.LEFT, spacingAfter: 0, size: 18 }),
    P(`MST: ${SELLER_INFO.taxCode}  •  Email: ${SELLER_INFO.email}  •  ${SELLER_INFO.website}`, { align: AlignmentType.LEFT, spacingAfter: 200, size: 18 }),
    H('BÁO GIÁ SẢN PHẨM'),
    P(`Số: ${quote.quote_number || ''}          Ngày ${dt.d}/${String(dt.m).padStart(2, '0')}/${dt.y}`, { align: AlignmentType.CENTER, spacingAfter: 150 }),
    P(`Kính gửi: ${quote.company_name || ''}`, { bold: true, spacingAfter: 0 }),
    quote.address ? P(`Địa chỉ: ${quote.address}`, { spacingAfter: 0 }) : null,
    quote.tax_code ? P(`MST: ${quote.tax_code}`, { spacingAfter: 100 }) : null,
    P((quote.intro && quote.intro.trim()) ? quote.intro : 'Cảm ơn Quý Công ty đã quan tâm đến sản phẩm của Yokool. Chúng tôi xin gửi báo giá chi tiết như sau:', { spacingAfter: 150 }),
  ].filter(Boolean)

  const headRow = new TableRow({ tableHeader: true, children: ['STT', 'Sản phẩm', 'SL', 'Đơn giá', 'Thành tiền'].map((t) => cell(t, { align: AlignmentType.CENTER, bold: true, size: 20 })) })
  const bodyRows = items.map((it, i) => new TableRow({ children: [
    cell(String(i + 1), { align: AlignmentType.CENTER, size: 20 }),
    cell(it.invoice_name || it.name || '', { size: 20 }),
    cell(`${fmt(it.qty)} ${it.unit || ''}`.trim(), { align: AlignmentType.CENTER, size: 20 }),
    cell(`${fmt(it.price)} đ`, { align: AlignmentType.RIGHT, size: 20 }),
    cell(`${fmt((Number(it.qty) || 0) * Math.round(Number(it.price) || 0))} đ`, { align: AlignmentType.RIGHT, size: 20 }),
  ] }))
  const sumRow = (label, val, bold = false) => new TableRow({ children: [
    new TableCell({ columnSpan: 4, margins: { top: 40, bottom: 40, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: label, bold, size: 20, font: FONT })] })] }),
    cell(`${val} đ`, { align: AlignmentType.RIGHT, bold, size: 20 }),
  ] })
  const sums = [sumRow('Tạm tính', fmt(sub))]
  if (rate) sums.push(sumRow(`Tiền VAT (${rate}%)`, fmt(vat)))
  sums.push(sumRow('TỔNG CỘNG', fmt(total), true))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorders, rows: [headRow, ...bodyRows, ...sums] }))
  children.push(new Paragraph({ spacing: { after: 100 }, children: [] }))

  // Tùy chọn bao bì
  const pkgTier = quote.packaging_tier || 'Tùy chọn'
  const pkgText = (pkgTier !== 'Tùy chọn' && quote.packaging_text && quote.packaging_text.trim()) ? quote.packaging_text.trim() : ''
  if (pkgText) {
    children.push(P(`Tùy chọn bao bì, đóng gói: ${pkgTier}`, { bold: true, spacingAfter: 40 }))
    pkgText.split('\n').map((s) => s.trim()).filter(Boolean).forEach((l) => children.push(P(l, { spacingAfter: 20, size: 22 })))
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }))
  }

  // Lưu ý
  const notes = (quote.notes && quote.notes.trim()) ? quote.notes : '- Đơn giá trên đã bao gồm thuế VAT.\n- Chính sách bảo hành chính hãng 12 tháng.\n- Báo giá có giá trị trong vòng 15 ngày.\n- Thông tin liên hệ: Ms Nhật Lệ (Corporate Sales Manager): Mobile/Zalo: 0974 626 720.'
  children.push(P('Lưu ý:', { bold: true, spacingAfter: 40 }))
  notes.split('\n').map((s) => s.trim()).filter(Boolean).forEach((l) => children.push(P(l, { spacingAfter: 20, size: 22 })))
  children.push(new Paragraph({ spacing: { after: 250 }, children: [] }))
  // Ký
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'ĐẠI DIỆN CÔNG TY', bold: true, size: 24, font: FONT })] }))
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 700 }, children: [new TextRun({ text: SIGNER.title, size: 22, font: FONT })] }))
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: SIGNER.name, bold: true, size: 24, font: FONT })] }))

  const doc = new Document({ styles: { default: { document: { run: { font: FONT, size: 24 } } } }, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }] })
  await download(doc, `BaoGia_${(quote.quote_number || 'BG').replace(/\//g, '-')}.docx`)
}
