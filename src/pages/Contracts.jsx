import { useEffect, useState } from 'react'
import { Plus, Trash2, X, FileSignature, Pencil, Image as ImageIcon, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, formatDate } from '../lib/constants'
import { docSoThanhChu } from '../lib/numberToWords'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { exportContractPDF, DEFAULT_SELLER } from '../lib/contractPdf'
import { exportWarehousePDF, exportDeliveryPDF } from '../lib/warehousePdf'
import { exportPaymentPDF, DEFAULT_PAYMENT_NOTES, DEFAULT_PAYMENT_ORDER_DESC } from '../lib/paymentPdf'

const newLine = () => ({ code: '', name: '', unit: 'Cái', color: 'Đen', qty: 1, price: 0 })
const newSection = () => ({ title: '', bullets: [''], text: '', image: '', caption: '' })

function buyerCode(name) {
  if (!name) return 'KH'
  const cleaned = name
    .toUpperCase()
    .replace(/CÔNG TY|CỔ PHẦN|TNHH|TRÁCH NHIỆM HỮU HẠN|MTV|MỘT THÀNH VIÊN|THƯƠNG MẠI|DỊCH VỤ|SẢN XUẤT|VÀ|NĂNG LƯỢNG|TẬP ĐOÀN/g, ' ')
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const withNum = tokens.filter((t) => /\d/.test(t))
  const base = (withNum.length ? withNum : tokens.slice(-2)).join('')
  return base.replace(/[^A-Z0-9.]/g, '').slice(0, 10) || 'KH'
}

const EMPTY = {
  contract_number: '',
  seq: null,
  sign_place: 'Hà Nội',
  signed_at: '',
  buyer: { name: '', address: '', tax_code: '', rep_name: '', rep_title: '' },
  seller: { ...DEFAULT_SELLER },
  items: [newLine()],
  use_vat: true, vat_percent: 8,
  quality_terms_text: [
    'Màu sắc: Đen, có in logo theo yêu cầu của bên A.',
    'Hàng mới 100%, đảm bảo chất lượng.',
    'Đủ số lượng, đúng màu sắc.',
    'Thời gian bảo hành: 12 tháng.',
    'Quy cách in logo và đóng gói theo bản Phụ lục của hợp đồng này.',
  ].join('\n'),
  advance_percent: 70,
  delivery_time: 'không muộn hơn ngày ……/……/……',
  delivery_address: '',
  shipping_by: 'Do Bên B chịu',
  has_appendix: false,
  appendix_subtitle: 'V/v: Quy cách in logo và đóng gói sản phẩm',
  appendix_sections: [
    { title: 'Quy cách in logo lên sản phẩm', bullets: ['Logo in tại vị trí chính giữa mặt trước sản phẩm.', 'Tỉ lệ, màu sắc và vị trí in logo thực hiện theo Ảnh 1.'], text: '', image: '', caption: '(Ảnh 1)' },
    { title: 'Quy cách đóng gói', bullets: ['Mỗi sản phẩm được đóng trong hộp bán lẻ riêng.'], text: '', image: '', caption: '(Ảnh 2)' },
    { title: 'Nghiệm thu', bullets: [], text: 'Hình ảnh mẫu được hai bên xác nhận là căn cứ để kiểm tra và nghiệm thu hàng hóa.', image: '', caption: '' },
  ],
  warehouse_number: '',
  warehouse_date: '',
  payment_number: '',
  payment_seq: null,
  payment_date: '',
  payment_order_desc: DEFAULT_PAYMENT_ORDER_DESC,
  payment_notes: DEFAULT_PAYMENT_NOTES,
  payment_amount: '',
  payment_show_items: true,
}

export default function Contracts() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('contract')

  const load = async () => {
    setLoading(true)
    const [rr, pr, cr] = await Promise.all([
      supabase.from('crm_contracts').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_products').select('*'),
      supabase.from('crm_customers').select('*'),
    ])
    setRows(rr.data || [])
    setProducts(pr.data || [])
    setCustomers(cr.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const genSeq = async (seqCol) => {
    const year = new Date().getFullYear()
    try {
      const { data, error } = await supabase
        .from('crm_contracts')
        .select(seqCol)
        .eq('year', year)
        .order(seqCol, { ascending: false })
        .limit(1)
      if (error) throw error
      const seq = (data && data[0]?.[seqCol] ? data[0][seqCol] : 0) + 1
      return { seq, year }
    } catch (e) {
      console.warn('genSeq ' + seqCol + ':', e.message)
      return { seq: 1, year }
    }
  }

  const openNew = async () => {
    const base = JSON.parse(JSON.stringify(EMPTY))
    base.payment_notes = DEFAULT_PAYMENT_NOTES
    base.payment_order_desc = DEFAULT_PAYMENT_ORDER_DESC
    const year = new Date().getFullYear()
    const { seq } = await genSeq('seq')
    base.seq = seq
    base.contract_number = `${String(seq).padStart(3, '0')}/${year}/KH-VNF`
    const pay = await genSeq('payment_seq')
    base.payment_seq = pay.seq
    base.payment_number = `${String(pay.seq).padStart(3, '0')}/${year}/HĐMB/VNF-KH`
    setForm(base); setEditId(null); setTab('contract'); setOpen(true)
  }

  const openEdit = (r) => {
    const f = JSON.parse(JSON.stringify(EMPTY))
    Object.assign(f, r)
    f.buyer = { ...EMPTY.buyer, ...(r.buyer || {}) }
    f.seller = { ...DEFAULT_SELLER, ...(r.seller || {}) }
    f.items = (r.items?.length ? r.items : [newLine()]).map((it) => ({ ...newLine(), ...it }))
    f.quality_terms_text = Array.isArray(r.quality_terms) ? r.quality_terms.join('\n') : (r.quality_terms_text || EMPTY.quality_terms_text)
    f.appendix_sections = (r.appendix_sections?.length ? r.appendix_sections : EMPTY.appendix_sections)
    f.payment_notes = r.payment_notes || DEFAULT_PAYMENT_NOTES
    f.payment_order_desc = r.payment_order_desc || DEFAULT_PAYMENT_ORDER_DESC
    f.payment_amount = r.payment_amount != null ? r.payment_amount : ''
    setForm(f); setEditId(r.id); setTab('contract'); setOpen(true)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setChk = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }))
  const setBuyer = (k) => (e) => setForm((f) => ({ ...f, buyer: { ...f.buyer, [k]: e.target.value } }))
  const setSeller = (k) => (e) => setForm((f) => ({ ...f, seller: { ...f.seller, [k]: e.target.value } }))
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, newLine()] }))
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))

  const pickBuyer = (name) => {
    const c = customers.find((x) => x.company_name === name)
    setForm((f) => {
      const buyer = { ...f.buyer, name, address: c?.address || f.buyer.address, tax_code: c?.tax_code || f.buyer.tax_code, rep_name: c?.contact_person || f.buyer.rep_name }
      const year = f.year || new Date().getFullYear()
      const code = buyerCode(name)
      const seqStr = f.seq ? String(f.seq).padStart(3, '0') : '001'
      const payStr = f.payment_seq ? String(f.payment_seq).padStart(3, '0') : '001'
      return {
        ...f, buyer,
        contract_number: `${seqStr}/${year}/${code}-VNF`,
        payment_number: `${payStr}/${year}/HĐMB/VNF-${code}`,
      }
    })
  }

  const pickProduct = (i, id) => {
    const p = products.find((x) => String(x.id) === String(id))
    if (!p) return
    setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? {
      ...it, code: p.sku || '', name: p.invoice_name || p.name || '', unit: p.unit || 'Cái', price: Number(p.base_price) || 0,
    } : it) }))
  }

  const setSection = (i, k, v) => setForm((f) => ({ ...f, appendix_sections: f.appendix_sections.map((s, j) => j === i ? { ...s, [k]: v } : s) }))
  const addSection = () => setForm((f) => ({ ...f, appendix_sections: [...f.appendix_sections, newSection()] }))
  const removeSection = (i) => setForm((f) => ({ ...f, appendix_sections: f.appendix_sections.filter((_, j) => j !== i) }))
  const setBullet = (si, bi, v) => setForm((f) => ({ ...f, appendix_sections: f.appendix_sections.map((s, j) => j === si ? { ...s, bullets: s.bullets.map((b, k) => k === bi ? v : b) } : s) }))
  const addBullet = (si) => setForm((f) => ({ ...f, appendix_sections: f.appendix_sections.map((s, j) => j === si ? { ...s, bullets: [...(s.bullets || []), ''] } : s) }))
  const removeBullet = (si, bi) => setForm((f) => ({ ...f, appendix_sections: f.appendix_sections.map((s, j) => j === si ? { ...s, bullets: s.bullets.filter((_, k) => k !== bi) } : s) }))
  const pickImage = (si) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2.5 * 1024 * 1024) { alert('Ảnh nên nhỏ hơn 2.5MB để nhúng vào PDF.'); return }
    const reader = new FileReader()
    reader.onload = () => setSection(si, 'image', reader.result)
    reader.readAsDataURL(file)
  }

  const lineTotal = (it) => Math.round((Number(it.qty) || 0) * (Number(it.price) || 0))
  const sub = form.items.reduce((s, it) => s + lineTotal(it), 0)
  const vat = form.use_vat ? Math.round(sub * (Number(form.vat_percent) || 0) / 100) : 0
  const grand = sub + vat

  const buildData = () => ({
    ...form,
    quality_terms: form.quality_terms_text.split('\n').map((s) => s.trim()).filter(Boolean),
    items: form.items.filter((it) => it.name).map((it) => ({
      code: it.code || '', name: it.name, unit: it.unit || 'Cái', color: it.color || '',
      qty: Number(it.qty) || 0, price: Number(it.price) || 0,
    })),
    appendix_sections: form.has_appendix ? form.appendix_sections : [],
  })

  const persist = async () => {
    if (!form.buyer.name.trim()) { alert('Nhập tên khách hàng (Bên A)'); setTab('contract'); return null }
    setSaving(true)
    const data = buildData()
    const year = form.year || new Date().getFullYear()
    const payload = {
      user_id: user.id,
      contract_number: form.contract_number,
      seq: form.seq || null,
      year,
      sign_place: form.sign_place,
      signed_at: form.signed_at || null,
      buyer: data.buyer,
      seller: data.seller,
      items: data.items,
      use_vat: !!form.use_vat,
      vat_percent: Number(form.vat_percent) || 0,
      quality_terms: data.quality_terms,
      advance_percent: Number(form.advance_percent) || 0,
      delivery_time: form.delivery_time,
      delivery_address: form.delivery_address,
      shipping_by: form.shipping_by,
      has_appendix: !!form.has_appendix,
      appendix_subtitle: form.appendix_subtitle,
      appendix_sections: data.appendix_sections,
      total: grand,
      warehouse_number: form.warehouse_number || null,
      warehouse_date: form.warehouse_date || null,
      payment_number: form.payment_number || null,
      payment_seq: form.payment_seq || null,
      payment_date: form.payment_date || null,
      payment_order_desc: form.payment_order_desc || null,
      payment_notes: form.payment_notes || null,
      payment_amount: (form.payment_amount != null && form.payment_amount !== '') ? Number(form.payment_amount) : null,
    }
    const runSave = async (pl) => {
      if (editId) {
        const { error } = await supabase.from('crm_contracts').update(pl).eq('id', editId)
        return { data: { ...pl, id: editId, created_at: form.created_at }, error }
      }
      const { data, error } = await supabase.from('crm_contracts').insert(pl).select().single()
      return { data, error }
    }
    let res = await runSave(payload)
    let tries = 0
    while (res.error && tries < 10) {
      const m = (res.error.message || '').match(/column "?([a-z_]+)"?/i) || (res.error.message || '').match(/'([a-z_]+)' column/i)
      const col = m && m[1]
      if (!col || !(col in payload)) break
      delete payload[col]; tries++
      res = await runSave(payload)
    }
    setSaving(false)
    if (res.error) { alert('Lưu thất bại: ' + res.error.message); return null }
    return { ...form, ...(res.data || payload), id: (res.data?.id || editId), quality_terms: data.quality_terms, items: data.items }
  }

  const toWarehouseData = (saved) => ({
    doc_number: saved.warehouse_number || saved.contract_number,
    created_at: saved.warehouse_date || saved.created_at || new Date().toISOString(),
    company_name: saved.buyer?.name || '',
    address: saved.buyer?.address || '',
    tax_code: saved.buyer?.tax_code || '',
    phone: saved.buyer?.phone || '',
    rep_name: saved.buyer?.rep_name || '',
    rep_title: saved.buyer?.rep_title || '',
    location: saved.delivery_address || '',
    condition: 'Nguyên đai, nguyên kiện, không hỏng',
    note: saved.note || '',
    staff: '',
    use_vat: !!saved.use_vat,
    vat_percent: Number(saved.vat_percent) || 0,
    items: saved.items || [],
  })

  const toPaymentData = (saved) => {
    const hd = saved.contract_number || ''
    const buyerName = saved.buyer?.name || ''
    const orderDesc = (saved.payment_order_desc || DEFAULT_PAYMENT_ORDER_DESC)
      .replace(/\{hd\}/g, hd)
      .replace(/\{buyer\}/g, buyerName)
    return {
      doc_number: saved.payment_number || saved.contract_number,
      created_at: saved.payment_date || saved.created_at || new Date().toISOString(),
      company_name: buyerName,
      address: saved.buyer?.address || '',
      tax_code: saved.buyer?.tax_code || '',
      items: saved.items || [],
      amount: (saved.payment_amount != null && saved.payment_amount !== '') ? Number(saved.payment_amount) : null,
      order_desc: orderDesc,
      notes: saved.payment_notes || DEFAULT_PAYMENT_NOTES,
      show_items: saved.payment_show_items !== false,
    }
  }

  const saveAndExport = async (kind) => {
    const saved = await persist()
    if (!saved) return
    setOpen(false); load()
    setTimeout(() => {
      if (kind === 'contract') exportContractPDF({ ...saved, quality_terms: saved.quality_terms })
      else if (kind === 'warehouse') exportWarehousePDF(toWarehouseData(saved))
      else if (kind === 'delivery') exportDeliveryPDF(toWarehouseData(saved))
      else if (kind === 'payment') exportPaymentPDF(toPaymentData(saved))
    }, 120)
  }

  const remove = async (id) => {
    if (!confirm('Xóa hợp đồng này?')) return
    await supabase.from('crm_contracts').delete().eq('id', id)
    load()
  }

  const TabBtn = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === id ? 'bg-brand text-white shadow-sm' : 'text-ink-soft hover:bg-paper'}`}
    >{label}</button>
  )

  return (
    <div>
      <PageHeader
        title="Hợp đồng"
        subtitle="Soạn hợp đồng mua bán, phụ lục kèm ảnh; xuất kèm Phiếu xuất kho, Biên bản bàn giao và Đề nghị thanh toán."
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo hợp đồng</button>}
      />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={FileSignature} title="Chưa có hợp đồng nào"
          hint="Bấm nút Tạo hợp đồng để soạn hợp đồng theo mẫu."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo hợp đồng</button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-paper-line bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-paper-line bg-paper/60 text-left text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Số hợp đồng</th>
                <th className="px-4 py-3 font-medium">Bên A</th>
                <th className="px-4 py-3 text-right font-medium">Giá trị</th>
                <th className="px-4 py-3 font-medium">Ngày</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-paper-line/60 last:border-0 hover:bg-paper/40">
                  <td className="px-4 py-3 font-medium text-ink">{r.contract_number || '—'}</td>
                  <td className="px-4 py-3 text-ink">{r.buyer?.name || '—'}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatVND(r.total || 0)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => exportContractPDF(r)} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-faint hover:bg-paper hover:text-brand" title="Xuất Hợp đồng">HĐ</button>
                      <button onClick={() => exportWarehousePDF(toWarehouseData(r))} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-faint hover:bg-paper hover:text-brand" title="Phiếu xuất kho">PXK</button>
                      <button onClick={() => exportDeliveryPDF(toWarehouseData(r))} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-faint hover:bg-paper hover:text-brand" title="Biên bản bàn giao">BBBG</button>
                      <button onClick={() => exportPaymentPDF(toPaymentData(r))} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-faint hover:bg-paper hover:text-brand" title="Đề nghị thanh toán">DNTT</button>
                      <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={15} /></button>
                      <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Sửa hợp đồng' : 'Tạo hợp đồng'} size="xl">
        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl bg-paper/60 p-1.5">
          <TabBtn id="contract" label="1 · Hợp đồng" />
          <TabBtn id="warehouse" label="2 · Phiếu xuất kho" />
          <TabBtn id="payment" label="3 · Đề nghị thanh toán" />
        </div>

        {/* ===== TAB 1: HỢP ĐỒNG ===== */}
        {tab === 'contract' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">Số hợp đồng</label>
                <input className="input-field" value={form.contract_number} onChange={set('contract_number')} placeholder="001/2026/DT5.1-VNF" />
                <p className="mt-1 text-[11px] text-ink-faint">Cú pháp: 001/2026/[mã KH]-VNF — tự sinh, có thể sửa tay.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">Nơi ký</label><input className="input-field" value={form.sign_place} onChange={set('sign_place')} /></div>
                <div><label className="label-field">Ngày ký</label><input type="date" className="input-field" value={form.signed_at?.slice(0, 10) || ''} onChange={set('signed_at')} /></div>
              </div>
            </div>

            <fieldset className="rounded-xl border border-paper-line p-4">
              <legend className="px-2 text-sm font-semibold text-ink">Bên A — Bên MUA (khách hàng)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label-field">Tên công ty</label>
                  <input className="input-field" list="dl-buyers" value={form.buyer.name} onChange={(e) => pickBuyer(e.target.value)} placeholder="Gõ tên công ty để tự điền thông tin" />
                  <datalist id="dl-buyers">{customers.map((c, i) => <option key={i} value={c.company_name} />)}</datalist>
                </div>
                <div className="sm:col-span-2"><label className="label-field">Địa chỉ</label><input className="input-field" value={form.buyer.address} onChange={setBuyer('address')} /></div>
                <div><label className="label-field">Mã số thuế</label><input className="input-field" value={form.buyer.tax_code} onChange={setBuyer('tax_code')} /></div>
                <div><label className="label-field">Người đại diện</label><input className="input-field" value={form.buyer.rep_name} onChange={setBuyer('rep_name')} placeholder="VD: Ông Nguyễn Đức Minh" /></div>
                <div><label className="label-field">Chức vụ</label><input className="input-field" value={form.buyer.rep_title} onChange={setBuyer('rep_title')} placeholder="VD: Phó Tổng Giám Đốc" /></div>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-paper-line p-4">
              <legend className="px-2 text-sm font-semibold text-ink">Bên B — Bên BÁN (mặc định VNF)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="label-field">Tên công ty</label><input className="input-field" value={form.seller.name} onChange={setSeller('name')} /></div>
                <div className="sm:col-span-2"><label className="label-field">Địa chỉ</label><input className="input-field" value={form.seller.address} onChange={setSeller('address')} /></div>
                <div><label className="label-field">Mã số thuế</label><input className="input-field" value={form.seller.tax_code} onChange={setSeller('tax_code')} /></div>
                <div><label className="label-field">Số tài khoản</label><input className="input-field" value={form.seller.account} onChange={setSeller('account')} /></div>
                <div className="sm:col-span-2"><label className="label-field">Ngân hàng</label><input className="input-field" value={form.seller.bank} onChange={setSeller('bank')} /></div>
                <div><label className="label-field">Người đại diện</label><input className="input-field" value={form.seller.rep_name} onChange={setSeller('rep_name')} /></div>
                <div><label className="label-field">Chức vụ</label><input className="input-field" value={form.seller.rep_title} onChange={setSeller('rep_title')} /></div>
              </div>
            </fieldset>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label-field mb-0">Điều 1 — Hàng hóa & giá cả</label>
                <button type="button" onClick={addItem} className="text-xs font-semibold text-brand hover:underline">+ Thêm dòng</button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={i} className="rounded-lg border border-paper-line p-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-4">
                        <input className="input-field py-1.5 text-sm" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="Tên sản phẩm" />
                        {products.length > 0 && (
                          <select className="input-field mt-1 py-1 text-xs text-ink-soft" value="" onChange={(e) => pickProduct(i, e.target.value)}>
                            <option value="">↧ Chọn từ danh mục…</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.short_name || p.name}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="sm:col-span-1"><input className="input-field py-1.5 text-sm" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} placeholder="ĐVT" /></div>
                      <div className="sm:col-span-1"><input className="input-field py-1.5 text-sm" value={it.color} onChange={(e) => setItem(i, 'color', e.target.value)} placeholder="Màu" /></div>
                      <div className="sm:col-span-1"><input type="number" className="input-field py-1.5 text-sm" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} placeholder="SL" /></div>
                      <div className="sm:col-span-2"><input type="number" className="input-field py-1.5 text-sm" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} placeholder="Đơn giá" /></div>
                      <div className="sm:col-span-3 flex items-center justify-between">
                        <span className="text-xs text-ink-soft">{formatVND(lineTotal(it))}</span>
                        <button type="button" onClick={() => removeItem(i)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-rose-600"><X size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <input id="ct-vat" type="checkbox" checked={form.use_vat} onChange={setChk('use_vat')} className="h-4 w-4" />
                  <label htmlFor="ct-vat" className="text-ink">VAT</label>
                  {form.use_vat && <><input type="number" className="input-field w-16 py-1 text-sm" value={form.vat_percent} onChange={set('vat_percent')} /><span className="text-ink-soft">%</span></>}
                </div>
                <div className="text-ink-soft">Tiền hàng: <b className="text-ink">{formatVND(sub)}</b></div>
                {form.use_vat && <div className="text-ink-soft">Thuế: <b className="text-ink">{formatVND(vat)}</b></div>}
                <div className="text-ink">Tổng: <b>{formatVND(grand)}</b></div>
              </div>
              <p className="mt-1 text-right text-xs italic text-ink-faint">Bằng chữ: {docSoThanhChu(grand).replace(/\.$/, '')} Việt Nam Đồng</p>
            </div>

            <div>
              <label className="label-field">Điều 1.2 — Chất lượng, quy cách, bảo hành <span className="text-ink-faint">(mỗi dòng 1 gạch đầu dòng)</span></label>
              <textarea className="input-field h-28 text-sm" value={form.quality_terms_text} onChange={set('quality_terms_text')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">Điều 2.2 — Tạm ứng lần 1 (%)</label>
                <input type="number" className="input-field" value={form.advance_percent} onChange={set('advance_percent')} />
                <p className="mt-1 text-[11px] text-ink-faint">Lần 1 {form.advance_percent || 0}% = {formatVND(Math.round(grand * (Number(form.advance_percent) || 0) / 100))}; Lần 2 còn lại.</p>
              </div>
              <div><label className="label-field">Điều 3.1 — Thời gian giao hàng</label><input className="input-field" value={form.delivery_time} onChange={set('delivery_time')} /></div>
              <div className="sm:col-span-2"><label className="label-field">Điều 3.2 — Địa chỉ giao hàng</label><input className="input-field" value={form.delivery_address} onChange={set('delivery_address')} /></div>
              <div className="sm:col-span-2"><label className="label-field">Điều 3.3 — Chi phí vận chuyển</label><input className="input-field" value={form.shipping_by} onChange={set('shipping_by')} /></div>
            </div>

            <fieldset className="rounded-xl border border-paper-line p-4">
              <legend className="flex items-center gap-2 px-2 text-sm font-semibold text-ink">
                <input id="ct-appendix" type="checkbox" checked={form.has_appendix} onChange={setChk('has_appendix')} className="h-4 w-4" />
                <label htmlFor="ct-appendix">Kèm Phụ lục hợp đồng</label>
              </legend>
              {form.has_appendix && (
                <div className="space-y-4">
                  <div><label className="label-field">Tiêu đề phụ lục</label><input className="input-field" value={form.appendix_subtitle} onChange={set('appendix_subtitle')} /></div>
                  {form.appendix_sections.map((sec, si) => (
                    <div key={si} className="rounded-lg border border-paper-line p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink-faint">Mục {si + 1}</span>
                        <input className="input-field flex-1 py-1.5 text-sm" value={sec.title} onChange={(e) => setSection(si, 'title', e.target.value)} placeholder="Tiêu đề mục" />
                        <button type="button" onClick={() => removeSection(si)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-rose-600"><Trash2 size={14} /></button>
                      </div>
                      <div className="space-y-1.5">
                        {(sec.bullets || []).map((b, bi) => (
                          <div key={bi} className="flex items-center gap-2">
                            <span className="text-ink-faint">•</span>
                            <input className="input-field flex-1 py-1 text-sm" value={b} onChange={(e) => setBullet(si, bi, e.target.value)} placeholder="Nội dung gạch đầu dòng" />
                            <button type="button" onClick={() => removeBullet(si, bi)} className="rounded-lg p-1 text-ink-faint hover:text-rose-600"><X size={13} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addBullet(si)} className="text-xs font-semibold text-brand hover:underline">+ Gạch đầu dòng</button>
                      </div>
                      <textarea className="input-field mt-2 h-16 text-sm" value={sec.text} onChange={(e) => setSection(si, 'text', e.target.value)} placeholder="Đoạn văn (tùy chọn)" />
                      <div className="mt-2 flex items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-paper-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper">
                          <ImageIcon size={14} /> {sec.image ? 'Đổi ảnh' : 'Thêm ảnh'}
                          <input type="file" accept="image/*" className="hidden" onChange={pickImage(si)} />
                        </label>
                        {sec.image && <><img src={sec.image} alt="" className="h-12 w-12 rounded object-cover" /><button type="button" onClick={() => setSection(si, 'image', '')} className="text-xs text-rose-600 hover:underline">Xóa ảnh</button></>}
                        <input className="input-field flex-1 py-1 text-sm" value={sec.caption} onChange={(e) => setSection(si, 'caption', e.target.value)} placeholder="Chú thích ảnh (VD: Ảnh 1)" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addSection} className="text-xs font-semibold text-brand hover:underline">+ Thêm mục phụ lục</button>
                </div>
              )}
            </fieldset>
          </div>
        )}

        {/* ===== TAB 2: PHIẾU XUẤT KHO ===== */}
        {tab === 'warehouse' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-paper-line bg-paper/40 p-4 text-sm text-ink-soft">
              Phiếu xuất kho & Biên bản bàn giao dùng chung thông tin Bên A và danh mục hàng hóa từ tab <b className="text-ink">Hợp đồng</b>.
              Điền số phiếu và ngày xuất kho riêng bên dưới nếu khác với hợp đồng.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">Số phiếu xuất kho</label>
                <input className="input-field" value={form.warehouse_number} onChange={set('warehouse_number')} placeholder="Để trống = dùng số hợp đồng" />
              </div>
              <div>
                <label className="label-field">Ngày xuất kho</label>
                <input type="date" className="input-field" value={form.warehouse_date?.slice(0, 10) || ''} onChange={set('warehouse_date')} />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Địa điểm giao / nhận hàng</label>
                <input className="input-field" value={form.delivery_address} onChange={set('delivery_address')} placeholder="Địa chỉ giao hàng (dùng chung với Điều 3.2)" />
              </div>
            </div>
            <div className="rounded-xl border border-paper-line p-4">
              <p className="mb-3 text-sm font-semibold text-ink">Hàng hóa xuất kho ({form.items.filter((it) => it.name).length} mặt hàng)</p>
              <ul className="space-y-1 text-sm">
                {form.items.filter((it) => it.name).map((it, i) => (
                  <li key={i} className="flex justify-between border-b border-paper-line/60 py-1.5 last:border-0">
                    <span className="text-ink">{it.name} <span className="text-ink-faint">({it.color || '—'})</span></span>
                    <span className="font-medium text-ink">{it.qty} {it.unit}</span>
                  </li>
                ))}
                {form.items.filter((it) => it.name).length === 0 && (
                  <li className="text-ink-faint">Chưa có hàng hóa — thêm ở tab Hợp đồng.</li>
                )}
              </ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-lg border border-paper-line px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-paper disabled:opacity-50" disabled={saving} onClick={() => saveAndExport('warehouse')}>
                <FileText size={15} className="mr-1.5 inline" />Lưu & Xuất Phiếu xuất kho
              </button>
              <button type="button" className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-50 disabled:opacity-50" disabled={saving} onClick={() => saveAndExport('delivery')}>
                <FileText size={15} className="mr-1.5 inline" />Lưu & Xuất Biên bản bàn giao
              </button>
            </div>
          </div>
        )}

        {/* ===== TAB 3: ĐỀ NGHỊ THANH TOÁN ===== */}
        {tab === 'payment' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">Số đề nghị thanh toán</label>
                <input className="input-field" value={form.payment_number} onChange={set('payment_number')} placeholder="001/2026/HĐMB/VNF-DT51" />
                <p className="mt-1 text-[11px] text-ink-faint">Cú pháp: 001/2026/HĐMB/VNF-[mã KH] — tự sinh, có thể sửa.</p>
              </div>
              <div>
                <label className="label-field">Ngày đề nghị thanh toán</label>
                <input type="date" className="input-field" value={form.payment_date?.slice(0, 10) || ''} onChange={set('payment_date')} />
              </div>
            </div>

            <div>
              <label className="label-field">Số tiền đề nghị thanh toán (VNĐ)</label>
              <input type="number" className="input-field" value={form.payment_amount} onChange={set('payment_amount')} placeholder={`Để trống = dùng tổng đơn (${formatVND(grand)})`} />
              <p className="mt-1 text-[11px] text-ink-faint">
                Số tiền này thay vào {'{bằng_số}'} và {'{bằng_chữ}'} trong nội dung.
                {form.payment_amount !== '' && form.payment_amount != null
                  ? ` Bằng chữ: ${docSoThanhChu(Number(form.payment_amount) || 0).replace(/\.$/, '')} Việt Nam Đồng.`
                  : ''}
              </p>
            </div>

            <div>
              <label className="label-field">Nội dung / lý do đề nghị thanh toán</label>
              <textarea className="input-field h-20 text-sm" value={form.payment_order_desc} onChange={set('payment_order_desc')} placeholder="Căn cứ hợp đồng số {hd} giữa..." />
              <p className="mt-1 text-[11px] text-ink-faint">Dùng {'{hd}'} = số hợp đồng, {'{buyer}'} = tên khách hàng — sẽ tự thay khi xuất.</p>
            </div>

            <div className="flex items-center gap-2">
              <input id="pm-items" type="checkbox" checked={form.payment_show_items !== false} onChange={setChk('payment_show_items')} className="h-4 w-4" />
              <label htmlFor="pm-items" className="text-sm text-ink">Hiển thị bảng chi tiết hàng hóa (STT, tên hàng, đơn vị, đơn giá có VAT, thành tiền có VAT)</label>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label-field mb-0">Nội dung chính <span className="text-ink-faint">(có thể sửa tự do)</span></label>
                <button type="button" onClick={() => setForm((f) => ({ ...f, payment_notes: DEFAULT_PAYMENT_NOTES }))} className="text-xs font-semibold text-brand hover:underline">↺ Khôi phục mẫu mặc định</button>
              </div>
              <textarea className="input-field h-52 font-mono text-xs leading-relaxed" value={form.payment_notes} onChange={set('payment_notes')} />
              <p className="mt-1 text-[11px] text-ink-faint">{'{bằng_số}'} và {'{bằng_chữ}'} sẽ tự thay bằng số tiền đề nghị ở trên.</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-paper-line bg-paper/40 p-4">
              <div>
                <p className="text-sm text-ink-soft">Số tiền sẽ in trên phiếu</p>
                <p className="text-xl font-bold text-ink">{formatVND((form.payment_amount !== '' && form.payment_amount != null) ? Number(form.payment_amount) : grand)}</p>
                <p className="text-xs italic text-ink-faint">{docSoThanhChu((form.payment_amount !== '' && form.payment_amount != null) ? Number(form.payment_amount) : grand).replace(/\.$/, '')} Việt Nam Đồng</p>
              </div>
              <button type="button" className="btn-primary disabled:opacity-50" disabled={saving} onClick={() => saveAndExport('payment')}>
                <FileText size={16} className="mr-1.5 inline" />{saving ? 'Đang lưu…' : 'Tạo Đề nghị thanh toán'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-paper-line pt-4">
          <p className="text-xs text-ink-faint">Mọi thao tác xuất đều tự động lưu trước khi tạo PDF.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
            <button type="button" className="btn-primary disabled:opacity-50" disabled={saving} onClick={() => saveAndExport('contract')}>{saving ? 'Đang lưu…' : 'Lưu & Xuất Hợp đồng'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
