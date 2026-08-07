import { useEffect, useState } from 'react'
import { Plus, Trash2, X, FileSignature, Pencil, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, formatDate } from '../lib/constants'
import { docSoThanhChu } from '../lib/numberToWords'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { exportContractPDF, DEFAULT_SELLER } from '../lib/contractPdf'
import { exportWarehousePDF, exportDeliveryPDF } from '../lib/warehousePdf'

const newLine = () => ({ code: '', name: '', unit: 'Cái', color: 'Đen', qty: 1, price: 0 })
const newSection = () => ({ title: '', bullets: [''], text: '', image: '', caption: '' })

// Sinh phần mã KH cuối số HĐ từ tên công ty: "CÔNG TY CỔ PHẦN NĂNG LƯỢNG DT5.1" → "DT51"
function buyerCode(name) {
  if (!name) return 'KH'
  const cleaned = name
    .toUpperCase()
    .replace(/CÔNG TY|CỔ PHẦN|TNHH|TRÁCH NHIỆM HỮU HẠN|MTV|MỘT THÀNH VIÊN|THƯƠNG MẠI|DỊCH VỤ|SẢN XUẤT|VÀ|NĂNG LƯỢNG|TẬP ĐOÀN/g, ' ')
  // Lấy các token có chữ/số nổi bật
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  // Ưu tiên token có số (vd DT5.1) hoặc token viết tắt
  const withNum = tokens.filter((t) => /\d/.test(t))
  const base = (withNum.length ? withNum : tokens.slice(-2)).join('')
  return base.replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'KH'
}

const EMPTY = {
  contract_number: '',
  seq: null,
  sign_place: 'Hà Nội',
  signed_at: '',
  // Bên A (mua - khách)
  buyer: { name: '', address: '', tax_code: '', rep_name: '', rep_title: '' },
  // Bên B (bán - VNF, mặc định)
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
  // Phụ lục
  has_appendix: false,
  appendix_subtitle: 'V/v: Quy cách in logo và đóng gói sản phẩm',
  appendix_sections: [
    { title: 'Quy cách in logo lên sản phẩm', bullets: ['Logo in tại vị trí chính giữa mặt trước sản phẩm.', 'Tỉ lệ, màu sắc và vị trí in logo thực hiện theo Ảnh 1.'], text: '', image: '', caption: '(Ảnh 1)' },
    { title: 'Quy cách đóng gói', bullets: ['Mỗi sản phẩm được đóng trong hộp bán lẻ riêng.'], text: '', image: '', caption: '(Ảnh 2)' },
    { title: 'Nghiệm thu', bullets: [], text: 'Hình ảnh mẫu được hai bên xác nhận là căn cứ để kiểm tra và nghiệm thu hàng hóa.', image: '', caption: '' },
  ],
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

  const load = async () => {
    setLoading(true)
    const [rr, pr, cr] = await Promise.all([
      supabase.from('crm_contracts').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_products').select('*'),
      supabase.from('crm_customers').select('company_name, address, tax_code, contact_person'),
    ])
    if (rr.error) console.error('Lỗi tải hợp đồng:', rr.error.message)
    setRows(rr.data || []); setProducts(pr.data || []); setCustomers(cr.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Sinh số HĐ tiếp theo trong năm hiện tại
  const genNumber = async (buyerName, existingSeq) => {
    const year = new Date().getFullYear()
    let seq = existingSeq
    if (!seq) {
      try {
        const { data, error } = await supabase
          .from('crm_contracts')
          .select('seq, year')
          .eq('year', year)
          .order('seq', { ascending: false })
          .limit(1)
        if (error) throw error
        seq = (data && data[0]?.seq ? data[0].seq : 0) + 1
      } catch (e) {
        console.warn('Chưa lấy được seq (bảng crm_contracts?):', e.message)
        seq = 1
      }
    }
    const num = String(seq).padStart(3, '0')
    return { number: `${num}/${year}/HĐMB/VNF-${buyerCode(buyerName)}`, seq, year }
  }

  const openNew = async () => {
    const base = JSON.parse(JSON.stringify(EMPTY))
    const { number, seq } = await genNumber('', null)
    base.contract_number = number
    base.seq = seq
    setForm(base); setEditId(null); setOpen(true)
  }
  const openEdit = (r) => {
    const f = JSON.parse(JSON.stringify(EMPTY))
    Object.assign(f, r)
    f.buyer = { ...EMPTY.buyer, ...(r.buyer || {}) }
    f.seller = { ...DEFAULT_SELLER, ...(r.seller || {}) }
    f.items = (r.items?.length ? r.items : [newLine()]).map((it) => ({ ...newLine(), ...it }))
    f.quality_terms_text = (r.quality_terms || EMPTY.quality_terms_text.split('\n')).join('\n')
    f.appendix_sections = (r.appendix_sections?.length ? r.appendix_sections : EMPTY.appendix_sections)
    setForm(f); setEditId(r.id); setOpen(true)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setChk = (k) => (e) => setForm({ ...form, [k]: e.target.checked })
  const setBuyer = (k) => (e) => setForm((f) => ({ ...f, buyer: { ...f.buyer, [k]: e.target.value } }))
  const setSeller = (k) => (e) => setForm((f) => ({ ...f, seller: { ...f.seller, [k]: e.target.value } }))
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, newLine()] }))
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))

  // Chọn khách hàng Bên A → autofill + cập nhật mã trong số HĐ
  const pickBuyer = async (name) => {
    const c = customers.find((x) => x.company_name === name)
    setForm((f) => {
      const buyer = { ...f.buyer, name, address: c?.address || f.buyer.address, tax_code: c?.tax_code || f.buyer.tax_code, rep_name: c?.contact_person || f.buyer.rep_name }
      const year = f.year || new Date().getFullYear()
      const seqStr = f.seq ? String(f.seq).padStart(3, '0') : '001'
      return { ...f, buyer, contract_number: `${seqStr}/${year}/HĐMB/VNF-${buyerCode(name)}` }
    })
  }
  const pickProduct = (i, id) => {
    const p = products.find((x) => String(x.id) === String(id))
    if (!p) return
    setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? {
      ...it, code: p.sku || '', name: p.invoice_name || p.name || '', unit: p.unit || 'Cái', price: Number(p.base_price) || 0,
    } : it) }))
  }

  // Phụ lục
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

  const sub = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
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
    if (!form.buyer.name.trim()) { alert('Nhập tên khách hàng (Bên A)'); return null }
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
    while (res.error && tries < 6) {
      const m = (res.error.message || '').match(/column "?([a-z_]+)"?/i) || (res.error.message || '').match(/'([a-z_]+)' column/i)
      const col = m && m[1]
      if (!col || !(col in payload)) break
      delete payload[col]; tries++
      res = await runSave(payload)
    }
    setSaving(false)
    if (res.error) { alert('Lưu thất bại: ' + res.error.message); return null }
    return res.data || payload
  }

  // Dữ liệu cho PXK / BBBG (warehousePdf mong đợi company_name phẳng)
  const toWarehouseData = (saved) => ({
    doc_number: saved.warehouse_number || saved.delivery_number || saved.contract_number,
    created_at: saved.created_at || new Date().toISOString(),
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

  const saveAndExport = async (kind) => {
    const saved = await persist()
    if (!saved) return
    setOpen(false); load()
    setTimeout(() => {
      if (kind === 'contract') exportContractPDF({ ...saved, quality_terms: saved.quality_terms })
      else if (kind === 'warehouse') exportWarehousePDF(toWarehouseData(saved))
      else if (kind === 'delivery') exportDeliveryPDF(toWarehouseData(saved))
    }, 120)
  }

  const remove = async (id) => {
    if (!confirm('Xóa hợp đồng này?')) return
    await supabase.from('crm_contracts').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Hợp đồng"
        subtitle="Soạn hợp đồng mua bán, phụ lục kèm ảnh; xuất kèm Phiếu xuất kho và Biên bản bàn giao."
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo hợp đồng</button>}
      />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={FileSignature} title="Chưa có hợp đồng nào"
          hint="Bấm “Tạo hợp đồng” để soạn hợp đồng theo mẫu."
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

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Sửa hợp đồng' : 'Tạo hợp đồng'} wide>
        <div className="space-y-6">
          {/* --- Số HĐ & thông tin chung --- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Số hợp đồng</label>
              <input className="input-field" value={form.contract_number} onChange={set('contract_number')} />
              <p className="mt-1 text-[11px] text-ink-faint">Tự sinh theo năm; có thể sửa tay.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">Nơi ký</label><input className="input-field" value={form.sign_place} onChange={set('sign_place')} /></div>
              <div><label className="label-field">Ngày ký</label><input type="date" className="input-field" value={form.signed_at?.slice(0, 10) || ''} onChange={set('signed_at')} /></div>
            </div>
          </div>

          {/* --- Bên A --- */}
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

          {/* --- Bên B --- */}
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

          {/* --- Điều 1: hàng hóa --- */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label-field mb-0">Điều 1 — Hàng hóa & giá cả</label>
              <button onClick={addItem} className="text-xs font-semibold text-brand hover:underline">+ Thêm dòng</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-paper-line p-3">
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <input className="input-field py-1.5 text-sm" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="Mô tả sản phẩm (đầy đủ)" />
                      {products.length > 0 && (
                        <select className="input-field mt-1 py-1 text-xs text-ink-soft" value="" onChange={(e) => pickProduct(i, e.target.value)}>
                          <option value="">— Chọn nhanh từ sản phẩm —</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.short_name || p.name}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="sm:col-span-1"><input className="input-field py-1.5 text-sm" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} placeholder="ĐVT" /></div>
                    <div className="sm:col-span-1"><input className="input-field py-1.5 text-sm" value={it.color} onChange={(e) => setItem(i, 'color', e.target.value)} placeholder="Màu" /></div>
                    <div className="sm:col-span-1"><input type="number" className="input-field py-1.5 text-sm" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} placeholder="SL" /></div>
                    <div className="sm:col-span-2"><input type="number" className="input-field py-1.5 text-sm" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} placeholder="Đơn giá" /></div>
                    <div className="sm:col-span-2 flex items-center justify-between">
                      <span className="text-xs text-ink-soft">{formatVND((Number(it.qty) || 0) * (Number(it.price) || 0))}</span>
                      <button onClick={() => removeItem(i)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-rose-600"><X size={15} /></button>
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

          {/* --- Điều 1.2: chất lượng --- */}
          <div>
            <label className="label-field">Điều 1.2 — Chất lượng, quy cách, bảo hành <span className="text-ink-faint">(mỗi dòng 1 gạch đầu dòng)</span></label>
            <textarea className="input-field h-28 text-sm" value={form.quality_terms_text} onChange={set('quality_terms_text')} />
          </div>

          {/* --- Điều 2 & 3 --- */}
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

          {/* --- Phụ lục --- */}
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
                      <button onClick={() => removeSection(si)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-rose-600"><Trash2 size={14} /></button>
                    </div>
                    {/* bullets */}
                    <div className="space-y-1.5">
                      {(sec.bullets || []).map((b, bi) => (
                        <div key={bi} className="flex items-center gap-2">
                          <span className="text-ink-faint">•</span>
                          <input className="input-field flex-1 py-1 text-sm" value={b} onChange={(e) => setBullet(si, bi, e.target.value)} placeholder="Nội dung gạch đầu dòng" />
                          <button onClick={() => removeBullet(si, bi)} className="rounded-lg p-1 text-ink-faint hover:text-rose-600"><X size={13} /></button>
                        </div>
                      ))}
                      <button onClick={() => addBullet(si)} className="text-xs font-semibold text-brand hover:underline">+ Gạch đầu dòng</button>
                    </div>
                    <textarea className="input-field mt-2 h-16 text-sm" value={sec.text} onChange={(e) => setSection(si, 'text', e.target.value)} placeholder="Đoạn văn (tùy chọn)" />
                    <div className="mt-2 flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-paper-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper">
                        <ImageIcon size={14} /> {sec.image ? 'Đổi ảnh' : 'Thêm ảnh'}
                        <input type="file" accept="image/*" className="hidden" onChange={pickImage(si)} />
                      </label>
                      {sec.image && <><img src={sec.image} alt="" className="h-12 w-12 rounded object-cover" /><button onClick={() => setSection(si, 'image', '')} className="text-xs text-rose-600 hover:underline">Xóa ảnh</button></>}
                      <input className="input-field flex-1 py-1 text-sm" value={sec.caption} onChange={(e) => setSection(si, 'caption', e.target.value)} placeholder="Chú thích ảnh (VD: Ảnh 1)" />
                    </div>
                  </div>
                ))}
                <button onClick={addSection} className="text-xs font-semibold text-brand hover:underline">+ Thêm mục phụ lục</button>
              </div>
            )}
          </fieldset>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="rounded-lg border border-paper-line px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-paper disabled:opacity-50" disabled={saving} onClick={() => saveAndExport('warehouse')}>Phiếu xuất kho</button>
          <button className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-50 disabled:opacity-50" disabled={saving} onClick={() => saveAndExport('delivery')}>Biên bản bàn giao</button>
          <button className="btn-primary disabled:opacity-50" disabled={saving} onClick={() => saveAndExport('contract')}>{saving ? 'Đang lưu…' : 'Xuất Hợp đồng'}</button>
        </div>
      </Modal>
    </div>
  )
}
