import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, FileDown, X, FileText, Pencil, FileSearch, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, formatDate } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { exportQuotePDF } from '../lib/quotePdf'
import { exportQuotePDFFull } from '../lib/quotePdfFull'

// item.name = TÊN RÚT GỌN hiển thị trong báo giá
const newItem = () => ({ name: '', model: '', qty: 1, unit: 'cái', price: 0 })

const EMPTY = {
  quote_number: '', company_name: '', address: '', tax_code: '',
  contact_person: '', contact_email: '', vat_percent: 8, discount: 0,
  notes: '', valid_until: '',
  items: [newItem()],
}

// Loại PDF cho 3 nút tạo
const PDF_MODES = {
  short:        { label: 'rút gọn' },
  full_total:   { label: 'đầy đủ + tổng' },
  full_nototal: { label: 'đầy đủ (không tổng)' },
}

export default function Quotes() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [pdfMode, setPdfMode] = useState('short')   // loại PDF sẽ xuất sau khi lưu
  const [companySuggest, setCompanySuggest] = useState(false)
  const companyBoxRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const [{ data: q }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('crm_quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_products').select('name, short_name, sku, base_price, unit, description, image_url, product_url'),
      supabase.from('crm_customers').select('company_name, address, tax_code, contact_person, contact_email'),
    ])
    setRows(q || []); setProducts(p || []); setCustomers(c || []); setLoading(false)
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
          setPdfMode('short'); setEditId(null); setOpen(true)
        } catch (e) {}
        sessionStorage.removeItem('quote_prefill')
      }
      window.history.replaceState({}, '', '/quotes')
    }
  }, [])

  const genNumber = () => 'BG-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100)

  // 3 nút tạo: mở form, nhớ loại PDF
  const openNew = (mode) => {
    setForm({ ...EMPTY, quote_number: genNumber(), items: [newItem()] })
    setPdfMode(mode); setEditId(null); setOpen(true)
  }
  const openEdit = (r) => {
    setForm({ ...EMPTY, ...r, items: (r.items?.length ? r.items : [newItem()]) }); setEditId(r.id); setOpen(true)
  }

  const calc = (f) => {
    const sub = (f.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    const afterDisc = sub - (Number(f.discount) || 0)
    const vat = afterDisc * (Number(f.vat_percent) || 0) / 100
    return { sub, vat, total: afterDisc + vat }
  }

  const exportByMode = (quote, mode) => {
    if (mode === 'short') exportQuotePDF(quote)
    else if (mode === 'full_total') exportQuotePDFFull(quote, { showTotal: true })
    else if (mode === 'full_nototal') exportQuotePDFFull(quote, { showTotal: false })
  }

  const save = async () => {
    if (!form.company_name.trim()) { alert('Nhập tên công ty'); return }
    const cleanItems = form.items.filter((it) => it.name).map((it) => ({
      name: it.name, model: it.model || '', qty: Number(it.qty) || 0, unit: it.unit, price: Number(it.price) || 0,
    }))
    const payload = {
      user_id: user.id, quote_number: form.quote_number, company_name: form.company_name,
      address: form.address, tax_code: form.tax_code, contact_person: form.contact_person,
      contact_email: form.contact_email, items: cleanItems,
      vat_percent: Number(form.vat_percent) || 0, discount: Number(form.discount) || 0,
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
    // Xuất PDF theo loại đã chọn ở nút tạo
    if (saved) setTimeout(() => exportByMode(saved, pdfMode), 100)
  }

  const remove = async (id) => {
    if (!confirm('Xóa báo giá này?')) return
    await supabase.from('crm_quotes').delete().eq('id', id); load()
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Autocomplete tên công ty từ khách hàng đã có
  const onCompanyChange = (e) => {
    setForm({ ...form, company_name: e.target.value })
    setCompanySuggest(true)
  }
  const pickCompany = (c) => {
    setForm({
      ...form,
      company_name: c.company_name || '',
      address: c.address || '',
      tax_code: c.tax_code || '',
      contact_person: c.contact_person || '',
      contact_email: c.contact_email || '',
    })
    setCompanySuggest(false)
  }
  const companyMatches = form.company_name
    ? customers.filter((c) => c.company_name?.toLowerCase().includes(form.company_name.toLowerCase())).slice(0, 6)
    : []

  const addItem = () => setForm({ ...form, items: [...form.items, newItem()] })
  const updateItem = (i, k, v) => {
    const items = [...form.items]; items[i] = { ...items[i], [k]: v }
    if (k === 'model') {
      // Gõ mã/SKU → tự điền TÊN RÚT GỌN + giá + đơn vị
      const code = String(v).trim().toLowerCase()
      const p = products.find((pr) => (pr.sku || '').toLowerCase() === code)
      if (p) {
        items[i].name = p.short_name || p.name
        if (p.base_price) items[i].price = p.base_price
        if (p.unit) items[i].unit = p.unit
      }
    }
    setForm({ ...form, items })
  }
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })

  const lineTotal = (it) => (Number(it.qty) || 0) * (Number(it.price) || 0)
  const totals = calc(form)

  return (
    <div>
      <PageHeader title="Báo giá nhanh" subtitle="Tạo báo giá và xuất PDF gửi khách"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => openNew('short')}><Plus size={15} /> Tạo báo giá rút gọn</button>
            <button className="flex items-center gap-1.5 rounded-lg border border-brand bg-white px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-50" onClick={() => openNew('full_total')}>
              <FileSearch size={15} /> Đầy đủ + tổng
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-paper-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper" onClick={() => openNew('full_nototal')}>
              <FileSearch size={15} /> Đầy đủ (không tổng)
            </button>
          </div>
        } />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có báo giá nào"
          hint="Tạo báo giá từ thông tin công ty + mặt hàng, rồi xuất PDF gửi khách."
          action={<button className="btn-primary" onClick={() => openNew('short')}><Plus size={16} /> Tạo báo giá rút gọn</button>} />
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
                        <PdfMenu quote={r} />
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

      <Modal open={open} onClose={() => setOpen(false)} wide
        title={`${editId ? 'Sửa' : 'Tạo'} báo giá ${editId ? '' : '— ' + PDF_MODES[pdfMode].label}`}>
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Số báo giá</label>
              <input className="input-field" value={form.quote_number} onChange={set('quote_number')} />
            </div>
            <div>
              <label className="label-field">Hiệu lực đến</label>
              <input className="input-field" type="date" value={form.valid_until || ''} onChange={set('valid_until')} />
            </div>
            {/* Tên công ty + autocomplete */}
            <div className="relative sm:col-span-2" ref={companyBoxRef}>
              <label className="label-field">Tên công ty *</label>
              <input className="input-field" value={form.company_name} onChange={onCompanyChange}
                onFocus={() => setCompanySuggest(true)} placeholder="Gõ để tìm khách đã có hoặc nhập mới" autoComplete="off" />
              {companySuggest && companyMatches.length > 0 && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-paper-line bg-white shadow-float">
                  {companyMatches.map((c, i) => (
                    <button key={i} type="button" onClick={() => pickCompany(c)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-paper">
                      <span className="text-sm font-medium text-ink">{c.company_name}</span>
                      <span className="text-[11px] text-ink-faint">
                        {[c.tax_code && `MST: ${c.tax_code}`, c.contact_person].filter(Boolean).join('  •  ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Địa chỉ</label>
              <input className="input-field" value={form.address} onChange={set('address')} />
            </div>
            <div>
              <label className="label-field">Mã số thuế</label>
              <input className="input-field" value={form.tax_code} onChange={set('tax_code')} />
            </div>
            <div>
              <label className="label-field">Người liên hệ</label>
              <input className="input-field" value={form.contact_person} onChange={set('contact_person')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Email người nhận</label>
              <input className="input-field" value={form.contact_email} onChange={set('contact_email')} />
            </div>
          </div>

          {/* Bảng mặt hàng */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label-field mb-0">Mặt hàng</label>
              <button onClick={addItem} className="text-xs font-semibold text-brand hover:underline">+ Thêm dòng</button>
            </div>
            <p className="mb-2 text-xs text-ink-faint">Mẹo: gõ <b>mã sản phẩm</b> vào ô "Mã" để tự điền tên rút gọn và đơn giá.</p>

            <div className="overflow-x-auto rounded-lg border border-paper-line">
              <div className="grid min-w-[680px] grid-cols-24 gap-1 border-b border-paper-line bg-paper/60 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4">Mã</div>
                <div className="col-span-8">Tên sản phẩm</div>
                <div className="col-span-2 text-center">SL</div>
                <div className="col-span-2 text-center">ĐV</div>
                <div className="col-span-4 text-right">Đơn giá</div>
                <div className="col-span-2 text-right">Tiền</div>
                <div className="col-span-1"></div>
              </div>
              {form.items.map((it, i) => (
                <div key={i} className="grid min-w-[680px] grid-cols-24 items-center gap-1 border-b border-paper-line px-2 py-1.5 last:border-0">
                  <div className="col-span-1 text-center text-xs text-ink-faint">{i + 1}</div>
                  <input className="input-field col-span-4 py-1.5 text-sm" list="sku-list" placeholder="Mã"
                    value={it.model || ''} onChange={(e) => updateItem(i, 'model', e.target.value)} />
                  <input className="input-field col-span-8 py-1.5 text-sm" list="prod-list" placeholder="Tên sản phẩm (rút gọn)"
                    value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                  <input className="input-field col-span-2 py-1.5 text-center text-sm" type="number" placeholder="SL"
                    value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} />
                  <input className="input-field col-span-2 py-1.5 text-center text-sm" placeholder="ĐV"
                    value={it.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} />
                  <input className="input-field col-span-4 py-1.5 text-right text-sm" type="number" placeholder="Đơn giá"
                    value={it.price} onChange={(e) => updateItem(i, 'price', e.target.value)} />
                  <div className="col-span-2 text-right text-xs font-medium text-ink">{formatVND(lineTotal(it))}</div>
                  <button onClick={() => removeItem(i)} className="col-span-1 flex justify-center rounded p-1 text-ink-faint hover:text-rose-600"><X size={14} /></button>
                </div>
              ))}
              <datalist id="prod-list">
                {products.map((p) => <option key={p.name} value={p.short_name || p.name} />)}
              </datalist>
              <datalist id="sku-list">
                {products.filter((p) => p.sku).map((p) => <option key={p.sku} value={p.sku}>{p.short_name || p.name}</option>)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Chiết khấu (₫)</label>
              <input className="input-field" type="number" value={form.discount} onChange={set('discount')} />
            </div>
            <div>
              <label className="label-field">VAT (%)</label>
              <input className="input-field" type="number" value={form.vat_percent} onChange={set('vat_percent')} />
            </div>
          </div>

          <div>
            <label className="label-field">Ghi chú</label>
            <textarea className="input-field min-h-[60px]" value={form.notes} onChange={set('notes')} placeholder="Điều khoản thanh toán, thời gian giao hàng..." />
          </div>

          <div className="rounded-lg bg-paper p-4">
            <div className="flex justify-between text-sm text-ink-soft"><span>Tạm tính</span><span>{formatVND(totals.sub)}</span></div>
            {Number(form.discount) > 0 && <div className="flex justify-between text-sm text-ink-soft"><span>Chiết khấu</span><span>− {formatVND(form.discount)}</span></div>}
            <div className="flex justify-between text-sm text-ink-soft"><span>VAT {form.vat_percent}%</span><span>{formatVND(totals.vat)}</span></div>
            <div className="mt-2 flex justify-between border-t border-paper-line pt-2 text-base font-700 text-ink"><span>Tổng cộng</span><span className="text-brand">{formatVND(totals.total)}</span></div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>
            {editId ? 'Lưu & Xuất PDF' : `Lưu & Xuất PDF ${PDF_MODES[pdfMode].label}`}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Dropdown PDF cho báo giá đã tạo
function PdfMenu({ quote }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-100">
        <FileDown size={14} /> PDF <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-paper-line bg-white shadow-float">
            <button onClick={() => { exportQuotePDF(quote); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper">
              <FileText size={14} className="text-ink-faint" />
              <div><p className="font-medium text-ink">Báo giá rút gọn</p><p className="text-[10px] text-ink-faint">A4 dọc, đơn giản</p></div>
            </button>
            <button onClick={() => { exportQuotePDFFull(quote, { showTotal: true }); setOpen(false) }}
              className="flex w-full items-center gap-2 border-t border-paper-line px-3 py-2 text-left text-sm hover:bg-paper">
              <FileSearch size={14} className="text-ink-faint" />
              <div><p className="font-medium text-ink">Đầy đủ + Tổng</p><p className="text-[10px] text-ink-faint">Có ảnh, thông tin, link</p></div>
            </button>
            <button onClick={() => { exportQuotePDFFull(quote, { showTotal: false }); setOpen(false) }}
              className="flex w-full items-center gap-2 border-t border-paper-line px-3 py-2 text-left text-sm hover:bg-paper">
              <FileSearch size={14} className="text-ink-faint" />
              <div><p className="font-medium text-ink">Đầy đủ (không tổng)</p><p className="text-[10px] text-ink-faint">Catalog tham khảo</p></div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
