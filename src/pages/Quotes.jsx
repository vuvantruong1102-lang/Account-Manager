import { useEffect, useState } from 'react'
import { Plus, Trash2, FileDown, X, FileText, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, formatDate } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { exportQuotePDF } from '../lib/quotePdf'

const EMPTY = {
  quote_number: '', company_name: '', address: '', tax_code: '',
  contact_person: '', contact_email: '', vat_percent: 8, discount: 0,
  notes: '', valid_until: '',
  items: [{ name: '', qty: 1, unit: 'cái', price: 0 }],
}

export default function Quotes() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)

  const load = async () => {
    setLoading(true)
    const [{ data: q }, { data: p }] = await Promise.all([
      supabase.from('crm_quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_products').select('name, base_price, unit'),
    ])
    setRows(q || []); setProducts(p || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const genNumber = () => 'BG-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100)

  const openNew = () => { setForm({ ...EMPTY, quote_number: genNumber(), items: [{ name: '', qty: 1, unit: 'cái', price: 0 }] }); setEditId(null); setOpen(true) }
  const openEdit = (r) => {
    setForm({ ...EMPTY, ...r, items: (r.items?.length ? r.items : EMPTY.items) }); setEditId(r.id); setOpen(true)
  }

  const calc = (f) => {
    const sub = (f.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    const afterDisc = sub - (Number(f.discount) || 0)
    const vat = afterDisc * (Number(f.vat_percent) || 0) / 100
    return { sub, vat, total: afterDisc + vat }
  }

  const save = async () => {
    if (!form.company_name.trim()) { alert('Nhập tên công ty'); return }
    const payload = {
      user_id: user.id, quote_number: form.quote_number, company_name: form.company_name,
      address: form.address, tax_code: form.tax_code, contact_person: form.contact_person,
      contact_email: form.contact_email,
      items: form.items.filter((it) => it.name).map((it) => ({ name: it.name, qty: Number(it.qty) || 0, unit: it.unit, price: Number(it.price) || 0 })),
      vat_percent: Number(form.vat_percent) || 0, discount: Number(form.discount) || 0,
      notes: form.notes, valid_until: form.valid_until || null,
    }
    if (editId) await supabase.from('crm_quotes').update(payload).eq('id', editId)
    else await supabase.from('crm_quotes').insert(payload)
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa báo giá này?')) return
    await supabase.from('crm_quotes').delete().eq('id', id); load()
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', qty: 1, unit: 'cái', price: 0 }] })
  const updateItem = (i, k, v) => {
    const items = [...form.items]; items[i] = { ...items[i], [k]: v }
    if (k === 'name') {
      const p = products.find((pr) => pr.name === v)
      if (p) { items[i].price = p.base_price; items[i].unit = p.unit }
    }
    setForm({ ...form, items })
  }
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })

  const totals = calc(form)

  return (
    <div>
      <PageHeader title="Báo giá nhanh" subtitle="Tạo báo giá và xuất PDF gửi khách"
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo báo giá</button>} />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có báo giá nào"
          hint="Tạo báo giá từ thông tin công ty + mặt hàng, rồi xuất PDF gửi khách."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo báo giá</button>} />
      ) : (
        <div className="overflow-hidden card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Số báo giá</th>
                <th className="px-5 py-3 font-semibold">Công ty</th>
                <th className="px-5 py-3 font-semibold">Tổng tiền</th>
                <th className="px-5 py-3 font-semibold">Ngày tạo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = calc(r)
                return (
                  <tr key={r.id} className="border-b border-paper-line last:border-0 hover:bg-paper/40">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-brand">{r.quote_number}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{r.company_name}</p>
                      {r.tax_code && <p className="text-xs text-ink-faint">MST: {r.tax_code}</p>}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink">{formatVND(t.total)}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => exportQuotePDF(r)} className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-100"><FileDown size={14} /> PDF</button>
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

      <Modal open={open} onClose={() => setOpen(false)} wide title={editId ? 'Sửa báo giá' : 'Tạo báo giá'}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Số báo giá</label>
              <input className="input-field" value={form.quote_number} onChange={set('quote_number')} />
            </div>
            <div>
              <label className="label-field">Hiệu lực đến</label>
              <input className="input-field" type="date" value={form.valid_until} onChange={set('valid_until')} />
            </div>
            <div className="col-span-2">
              <label className="label-field">Tên công ty *</label>
              <input className="input-field" value={form.company_name} onChange={set('company_name')} />
            </div>
            <div className="col-span-2">
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
            <div className="col-span-2">
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
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <input className="input-field col-span-5 py-2" list="prod-list" placeholder="Tên mặt hàng"
                    value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                  <input className="input-field col-span-2 py-2" type="number" placeholder="SL"
                    value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} />
                  <input className="input-field col-span-1 py-2" placeholder="ĐV"
                    value={it.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} />
                  <input className="input-field col-span-3 py-2" type="number" placeholder="Đơn giá"
                    value={it.price} onChange={(e) => updateItem(i, 'price', e.target.value)} />
                  <button onClick={() => removeItem(i)} className="col-span-1 flex justify-center rounded-lg p-2 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><X size={15} /></button>
                </div>
              ))}
              <datalist id="prod-list">
                {products.map((p) => <option key={p.name} value={p.name} />)}
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

          {/* Tổng kết */}
          <div className="rounded-lg bg-paper p-4">
            <div className="flex justify-between text-sm text-ink-soft"><span>Tạm tính</span><span>{formatVND(totals.sub)}</span></div>
            {Number(form.discount) > 0 && <div className="flex justify-between text-sm text-ink-soft"><span>Chiết khấu</span><span>− {formatVND(form.discount)}</span></div>}
            <div className="flex justify-between text-sm text-ink-soft"><span>VAT {form.vat_percent}%</span><span>{formatVND(totals.vat)}</span></div>
            <div className="mt-2 flex justify-between border-t border-paper-line pt-2 text-base font-700 text-ink"><span>Tổng cộng</span><span className="text-brand">{formatVND(totals.total)}</span></div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu' : 'Tạo báo giá'}</button>
        </div>
      </Modal>
    </div>
  )
}
