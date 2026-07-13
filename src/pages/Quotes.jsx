import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, FileDown, X, FileText, Pencil, Gift, Package, Image as ImgIcon, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, formatDate } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { exportQuotePDF } from '../lib/quotePdf'

// Mỗi dòng báo giá: có thể là sản phẩm hoặc set quà.
// kind: 'product' | 'set'
// name       = tên rút gọn hiện trên báo giá
// invoice_name = tên trên hóa đơn (trang Thông tin sản phẩm)
// price      = ĐƠN GIÁ CHƯA VAT
// vat        = % VAT của dòng
const newItem = () => ({
  kind: 'product', ref_id: '', name: '', invoice_name: '', model: '',
  qty: 1, unit: 'cái', price: 0, note: '',
  image_url: '', description: '', product_url: '',
  // Chỉ dùng khi kind === 'set':
  gallery: [],            // ảnh minh họa set
  set_lines: [],          // [{qty, name}] để mô tả thành phần
  set_components: [],     // [{name, short_name, invoice_name, description, image_url}] chi tiết SP thành phần
})

// Lưu ý mặc định — user có thể sửa trong giao diện
const DEFAULT_NOTES = [
  '- Đơn giá chưa bao gồm thuế VAT (VAT được tính riêng).',
  '- Chính sách bảo hành chính hãng 12 tháng.',
  '- Đối với đơn hàng số lượng lớn hơn, vui lòng liên hệ chúng tôi để có giá tốt hơn.',
  '- Báo giá có giá trị trong vòng 15 ngày.',
  '- Liên hệ: Mr. Trường - Sales Manager: 0906 079 936',
].join('\n')

const EMPTY = {
  quote_number: '', company_name: '', address: '', tax_code: '',
  contact_person: '', contact_email: '', valid_until: '',
  vat_percent: 8,
  notes: DEFAULT_NOTES,
  items: [newItem()],
}

export default function Quotes() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [sets, setSets] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [companySuggest, setCompanySuggest] = useState(false)
  const companyBoxRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const [{ data: q }, { data: p }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('crm_quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_products').select('id, name, short_name, invoice_name, sku, base_price, unit, description, image_url, product_url'),
      supabase.from('crm_gift_sets').select('id, name, short_name, invoice_name, sku, price, unit, description, image_url, gallery, items'),
      supabase.from('crm_customers').select('company_name, address, tax_code, contact_person, contact_email'),
    ])
    setRows(q || []); setProducts(p || []); setSets(s || []); setCustomers(c || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const h = (e) => { if (companyBoxRef.current && !companyBoxRef.current.contains(e.target)) setCompanySuggest(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Prefill từ panel Sales
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('prefill') === '1') {
      const raw = sessionStorage.getItem('quote_prefill')
      if (raw) {
        try {
          const pf = JSON.parse(raw)
          setForm({ ...EMPTY, quote_number: genNumber(), ...pf, items: [newItem()] })
          setEditId(null); setOpen(true)
        } catch (e) {}
        sessionStorage.removeItem('quote_prefill')
      }
      window.history.replaceState({}, '', '/quotes')
    }
  }, [])

  const genNumber = () => 'BG-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100)

  const openNew = () => {
    setForm({ ...EMPTY, quote_number: genNumber(), items: [newItem()] })
    setEditId(null); setOpen(true)
  }
  const openEdit = (r) => {
    const items = (r.items?.length ? r.items : [newItem()]).map((it) => ({ ...newItem(), ...it }))
    setForm({ ...EMPTY, ...r, items }); setEditId(r.id); setOpen(true)
  }

  // Thành tiền mỗi dòng CHƯA VAT; VAT tính chung theo vat_percent của báo giá
  const calc = (f) => {
    const sub = (f.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    const rate = Number(f.vat_percent) || 0
    const vat = sub * rate / 100
    return { sub, vat, total: sub + vat, rate }
  }

  const save = async () => {
    if (!form.company_name.trim()) { alert('Nhập tên công ty'); return }
    const cleanItems = form.items.filter((it) => it.name).map((it) => ({
      kind: it.kind || 'product', ref_id: it.ref_id || '',
      name: it.name, invoice_name: it.invoice_name || '', model: it.model || '',
      qty: Number(it.qty) || 0, unit: it.unit, price: Number(it.price) || 0, note: it.note || '',
      image_url: it.image_url || '', description: it.description || '', product_url: it.product_url || '',
      gallery: it.kind === 'set' ? (it.gallery || []) : [],
      set_lines: it.kind === 'set' ? (it.set_lines || []) : [],
      set_components: it.kind === 'set' ? (it.set_components || []) : [],
    }))
    const payload = {
      user_id: user.id, quote_number: form.quote_number, company_name: form.company_name,
      address: form.address, tax_code: form.tax_code, contact_person: form.contact_person,
      contact_email: form.contact_email, items: cleanItems,
      vat_percent: Number(form.vat_percent) || 0, discount: 0,
      notes: form.notes, valid_until: form.valid_until || null,
    }
    let saved
    if (editId) {
      await supabase.from('crm_quotes').update(payload).eq('id', editId)
      saved = { ...payload, id: editId, created_at: form.created_at }
    } else {
      const { data } = await supabase.from('crm_quotes').insert(payload).select().single()
      saved = data || payload
    }
    setOpen(false); load()
    if (saved) setTimeout(() => exportQuotePDF(saved), 100)
  }

  const remove = async (id) => {
    if (!confirm('Xóa báo giá này?')) return
    await supabase.from('crm_quotes').delete().eq('id', id); load()
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const onCompanyChange = (e) => { setForm({ ...form, company_name: e.target.value }); setCompanySuggest(true) }
  const pickCompany = (c) => {
    setForm({ ...form, company_name: c.company_name || '', address: c.address || '', tax_code: c.tax_code || '', contact_person: c.contact_person || '', contact_email: c.contact_email || '' })
    setCompanySuggest(false)
  }
  const companyMatches = form.company_name
    ? customers.filter((c) => c.company_name?.toLowerCase().includes(form.company_name.toLowerCase())).slice(0, 6)
    : []

  const addItem = () => setForm({ ...form, items: [...form.items, newItem()] })
  const updateItem = (i, patch) => { const items = [...form.items]; items[i] = { ...items[i], ...patch }; setForm({ ...form, items }) }
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })

  // Thành tiền hiển thị trong bảng = CHƯA VAT
  const lineTotal = (it) => (Number(it.qty) || 0) * (Number(it.price) || 0)
  const totals = calc(form)

  return (
    <div>
      <PageHeader title="Báo giá nhanh" subtitle="Một nút tạo báo giá — tùy chỉnh mọi thứ trong giao diện"
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo báo giá</button>} />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có báo giá nào"
          hint="Bấm 'Tạo báo giá' để mở giao diện tùy chỉnh và xuất PDF gửi khách."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo báo giá</button>} />
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold whitespace-nowrap">Số báo giá</th>
                <th className="px-5 py-3 font-semibold">Công ty</th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">Tổng tiền</th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">Ngày tạo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = calc(r)
                return (
                  <tr key={r.id} className="border-b border-paper-line last:border-0 hover:bg-paper/40">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-brand whitespace-nowrap">{r.quote_number}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{r.company_name}</p>
                      {r.tax_code && <p className="text-xs text-ink-faint">MST: {r.tax_code}</p>}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink whitespace-nowrap">{formatVND(t.total)}</td>
                    <td className="px-5 py-3.5 text-ink-soft whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => exportQuotePDF(r)} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-100"><FileDown size={14} /> PDF</button>
                        <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={15} /></button>
                        <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} wide title={`${editId ? 'Sửa' : 'Tạo'} báo giá`}>
        <div className="space-y-5">
          {/* Thông tin khách */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Số báo giá</label>
              <input className="input-field" value={form.quote_number} onChange={set('quote_number')} />
            </div>
            <div>
              <label className="label-field">Hiệu lực đến</label>
              <input className="input-field" type="date" value={form.valid_until || ''} onChange={set('valid_until')} />
            </div>
            <div className="relative sm:col-span-2" ref={companyBoxRef}>
              <label className="label-field">Tên công ty *</label>
              <input className="input-field" value={form.company_name} onChange={onCompanyChange}
                onFocus={() => setCompanySuggest(true)} placeholder="Gõ để tìm khách đã có hoặc nhập mới" autoComplete="off" />
              {companySuggest && companyMatches.length > 0 && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-paper-line bg-white shadow-float">
                  {companyMatches.map((c, i) => (
                    <button key={i} type="button" onClick={() => pickCompany(c)} className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-paper">
                      <span className="text-sm font-medium text-ink">{c.company_name}</span>
                      <span className="text-[11px] text-ink-faint">{[c.tax_code && `MST: ${c.tax_code}`, c.contact_person].filter(Boolean).join('  •  ')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2"><label className="label-field">Địa chỉ</label><input className="input-field" value={form.address} onChange={set('address')} /></div>
            <div><label className="label-field">Mã số thuế</label><input className="input-field" value={form.tax_code} onChange={set('tax_code')} /></div>
            <div><label className="label-field">Người liên hệ</label><input className="input-field" value={form.contact_person} onChange={set('contact_person')} /></div>
            <div className="sm:col-span-2"><label className="label-field">Email người nhận</label><input className="input-field" value={form.contact_email} onChange={set('contact_email')} /></div>
          </div>

          {/* ===== PHẦN 1: BẢNG BÁO GIÁ ===== */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label-field mb-0">Phần 1 — Mặt hàng / Set quà</label>
              <button onClick={addItem} className="text-xs font-semibold text-brand hover:underline">+ Thêm dòng</button>
            </div>

            <div className="space-y-3">
              {form.items.map((it, i) => (
                <QuoteItemRow key={i} index={i} item={it} products={products} sets={sets}
                  onChange={(patch) => updateItem(i, patch)} onRemove={() => removeItem(i)}
                  lineTotal={lineTotal(it)} />
              ))}
            </div>
          </div>

          {/* Lưu ý (gộp ghi chú + lưu ý, hiện dưới bảng trên báo giá) */}
          <div>
            <label className="label-field">Lưu ý <span className="text-ink-faint">(hiện dưới bảng trên báo giá — có thể sửa)</span></label>
            <textarea className="input-field min-h-[120px]" value={form.notes} onChange={set('notes')} placeholder="Điều khoản thanh toán, thời gian giao hàng, in logo..." />
          </div>

          {/* Thuế suất VAT chung */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Thuế suất VAT (%)</label>
              <input className="input-field" type="number" value={form.vat_percent} onChange={set('vat_percent')} />
            </div>
          </div>

          {/* Tổng kết */}
          <div className="rounded-lg bg-paper p-4">
            <div className="flex justify-between text-sm text-ink-soft"><span>Thành tiền (Chưa VAT)</span><span>{formatVND(totals.sub)}</span></div>
            <div className="flex justify-between text-sm text-ink-soft"><span>Tiền VAT ({totals.rate}%)</span><span>{formatVND(totals.vat)}</span></div>
            <div className="mt-2 flex justify-between border-t border-paper-line pt-2 text-base font-700 text-ink"><span>Tổng cộng</span><span className="text-brand">{formatVND(totals.total)}</span></div>
          </div>

          <p className="rounded-lg bg-blue-50 px-4 py-2 text-xs text-blue-700">
            <b>Phần 2 — Thông tin sản phẩm</b> là các trang tiếp theo của PDF: mỗi set quà 1 trang riêng (thành phần + ảnh minh họa), rồi các sản phẩm chi tiết trình bày dạng bảng (Tên, Ảnh, Tên hóa đơn, Thông số) — khoảng 3 sản phẩm/trang.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu & Xuất PDF' : 'Tạo & Xuất PDF'}</button>
        </div>
      </Modal>
    </div>
  )
}

/* ---------- Một dòng mặt hàng trong báo giá ---------- */
function QuoteItemRow({ index, item, products, sets, onChange, onRemove, lineTotal }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef(null)

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setPickerOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pickProduct = (p) => {
    onChange({
      kind: 'product', ref_id: p.id,
      name: p.short_name || p.name, invoice_name: p.invoice_name || p.name, model: p.sku || '',
      unit: p.unit || 'cái', price: Number(p.base_price) || 0,
      image_url: p.image_url || '', description: p.description || '', product_url: p.product_url || '',
    })
    setPickerOpen(false); setQ('')
  }
  const pickSet = (s) => {
    // Dòng mô tả thành phần (hiện dưới tên set ở trang thông tin)
    const setLines = (s.items || []).map((c) => ({ qty: Number(c.qty) || 1, name: c.name }))
    const compDesc = setLines.map((c) => `• ${c.qty}× ${c.name}`).join('\n')
    // Chi tiết đầy đủ từng sản phẩm thành phần (lấy từ bảng products theo product_id)
    const components = (s.items || []).map((c) => {
      const p = products.find((pr) => pr.id === c.product_id)
      return {
        qty: Number(c.qty) || 1,
        name: p?.short_name || p?.name || c.name || '',   // tên rút gọn (không lặp tên hóa đơn)
        invoice_name: p?.invoice_name || p?.name || c.name || '',
        description: p?.description || '',
        image_url: p?.image_url || c.image_url || '',
      }
    })
    onChange({
      kind: 'set', ref_id: s.id,
      name: s.short_name || s.name, invoice_name: s.invoice_name || s.name, model: s.sku || '',
      unit: s.unit || 'set', price: Number(s.price) || 0,
      image_url: s.image_url || '', description: compDesc, product_url: '',
      gallery: s.gallery || [],
      set_lines: setLines,
      set_components: components,
    })
    setPickerOpen(false); setQ('')
  }

  const prodMatches = products.filter((p) => (p.name + ' ' + (p.short_name || '') + ' ' + (p.sku || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 5)
  const setMatches = sets.filter((s) => (s.name + ' ' + (s.short_name || '') + ' ' + (s.sku || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 5)

  const set = (k) => (e) => onChange({ [k]: e.target.value })

  return (
    <div className="rounded-xl border border-paper-line bg-white p-3">
      <div className="flex items-start gap-3">
        {/* Ảnh */}
        <div className="flex-shrink-0">
          {item.image_url
            ? <img src={item.image_url} alt="" className="h-16 w-16 rounded-lg object-contain bg-paper" />
            : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-paper text-ink-faint"><ImgIcon size={20} /></div>}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Hàng đầu: số thứ tự + nút chọn từ danh mục + xóa */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-faint">#{index + 1}</span>
              {item.kind === 'set'
                ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand"><Gift size={10} /> SET QUÀ</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold text-ink-soft"><Package size={10} /> SẢN PHẨM</span>}
            </div>
            <div className="relative flex items-center gap-1" ref={boxRef}>
              <button onClick={() => setPickerOpen(!pickerOpen)} className="flex items-center gap-1 rounded-lg border border-paper-line px-2 py-1 text-xs font-medium text-ink-soft hover:bg-paper">
                <Search size={12} /> Chọn từ danh mục
              </button>
              <button onClick={onRemove} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><X size={15} /></button>
              {pickerOpen && (
                <div className="absolute right-0 top-8 z-30 w-72 overflow-hidden rounded-lg border border-paper-line bg-white shadow-float">
                  <div className="border-b border-paper-line p-2">
                    <input autoFocus className="input-field py-1.5 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm sản phẩm hoặc set..." />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {setMatches.length > 0 && <p className="px-3 pt-2 text-[10px] font-semibold uppercase text-ink-faint">Set quà</p>}
                    {setMatches.map((s) => (
                      <button key={'s' + s.id} onClick={() => pickSet(s)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-paper">
                        {s.image_url ? <img src={s.image_url} className="h-8 w-8 rounded object-contain bg-paper" alt="" /> : <div className="flex h-8 w-8 items-center justify-center rounded bg-paper text-ink-faint"><Gift size={13} /></div>}
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{s.short_name || s.name}</p><p className="text-[11px] text-ink-faint">{formatVND(s.price)}</p></div>
                      </button>
                    ))}
                    {prodMatches.length > 0 && <p className="px-3 pt-2 text-[10px] font-semibold uppercase text-ink-faint">Sản phẩm</p>}
                    {prodMatches.map((p) => (
                      <button key={'p' + p.id} onClick={() => pickProduct(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-paper">
                        {p.image_url ? <img src={p.image_url} className="h-8 w-8 rounded object-contain bg-paper" alt="" /> : <div className="flex h-8 w-8 items-center justify-center rounded bg-paper text-ink-faint"><Package size={13} /></div>}
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{p.short_name || p.name}</p><p className="text-[11px] text-ink-faint">{[p.sku, formatVND(p.base_price)].filter(Boolean).join('  •  ')}</p></div>
                      </button>
                    ))}
                    {setMatches.length === 0 && prodMatches.length === 0 && <p className="px-3 py-4 text-center text-xs text-ink-faint">Không tìm thấy</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tên hiển thị + tên hóa đơn */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-ink-faint">Tên trên báo giá</label>
              <input className="input-field py-1.5 text-sm" value={item.name} onChange={set('name')} placeholder="Tên sản phẩm/set quà" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-ink-faint">Tên trên hóa đơn</label>
              <input className="input-field py-1.5 text-sm" value={item.invoice_name} onChange={set('invoice_name')} placeholder="Tên xuất hóa đơn VAT" />
            </div>
          </div>

          {/* SL / ĐV / Đơn giá / Thành tiền */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="text-[11px] font-medium text-ink-faint">Số lượng</label>
              <input className="input-field py-1.5 text-center text-sm" type="number" value={item.qty} onChange={set('qty')} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-ink-faint">Đơn vị</label>
              <input className="input-field py-1.5 text-center text-sm" value={item.unit} onChange={set('unit')} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-ink-faint">Đơn giá (chưa VAT)</label>
              <input className="input-field py-1.5 text-right text-sm" type="number" value={item.price} onChange={set('price')} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-ink-faint">Thành tiền (chưa VAT)</label>
              <div className="rounded-lg bg-paper px-2 py-1.5 text-right text-sm font-semibold text-ink">{formatVND(lineTotal)}</div>
            </div>
          </div>

          {/* Ghi chú của dòng (hiện ở cột Ghi chú trên bảng báo giá) */}
          <div>
            <label className="text-[11px] font-medium text-ink-faint">Ghi chú <span className="text-ink-faint">(hiện ở cột Ghi chú trong bảng báo giá)</span></label>
            <input className="input-field py-1.5 text-sm" value={item.note} onChange={set('note')} placeholder="VD: In logo, màu theo yêu cầu..." />
          </div>

          {/* Thông số kỹ thuật (hiện ở phần 2) */}
          <div>
            <label className="text-[11px] font-medium text-ink-faint">Thông số kỹ thuật <span className="text-ink-faint">(hiện ở Phần 2 — Thông tin sản phẩm)</span></label>
            <textarea className="input-field min-h-[52px] py-1.5 text-sm" value={item.description} onChange={set('description')} placeholder="Model, chất liệu, công suất..." />
          </div>
        </div>
      </div>
    </div>
  )
}
