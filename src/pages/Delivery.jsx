import { useEffect, useState } from 'react'
import { Plus, Trash2, X, PackageCheck, Pencil, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, formatDate } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { exportWarehousePDF, exportDeliveryPDF } from '../lib/warehousePdf'

const newLine = () => ({ code: '', name: '', unit: 'Cái', qty: 1, price: 0 })

const EMPTY = {
  doc_number: '',
  company_name: '', address: '', tax_code: '', phone: '',
  rep_name: '', rep_title: '',
  location: '', note: '', staff: '',
  condition: 'Nguyên đai, nguyên kiện, không hỏng',
  use_vat: true, vat_percent: 8,
  items: [newLine()],
}

export default function Delivery() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const load = async () => {
    setLoading(true)
    const [rr, pr, cr] = await Promise.all([
      supabase.from('crm_delivery_docs').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_products').select('*'),
      supabase.from('crm_customers').select('company_name, address, tax_code, contact_person'),
    ])
    if (rr.error) console.error('Lỗi tải chứng từ:', rr.error.message)
    setRows(rr.data || []); setProducts(pr.data || []); setCustomers(cr.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ ...EMPTY, items: [newLine()] }); setEditId(null); setOpen(true) }
  const openEdit = (r) => {
    const items = (r.items?.length ? r.items : [newLine()]).map((it) => ({ ...newLine(), ...it }))
    setForm({ ...EMPTY, ...r, items }); setEditId(r.id); setOpen(true)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setChk = (k) => (e) => setForm({ ...form, [k]: e.target.checked })
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, newLine()] }))
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))

  const pickCompany = (name) => {
    const c = customers.find((x) => x.company_name === name)
    setForm((f) => ({ ...f, company_name: name, address: c?.address || f.address, tax_code: c?.tax_code || f.tax_code, rep_name: c?.contact_person || f.rep_name }))
  }
  const pickProduct = (i, id) => {
    const p = products.find((x) => String(x.id) === String(id))
    if (!p) return
    setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? {
      ...it, code: p.sku || '', name: p.invoice_name || p.name || '', unit: p.unit || 'Cái', price: Number(p.base_price) || 0,
    } : it) }))
  }

  const total = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)

  const buildData = () => ({
    ...form,
    items: form.items.filter((it) => it.name).map((it) => ({
      code: it.code || '', name: it.name, unit: it.unit || '', qty: Number(it.qty) || 0, price: Number(it.price) || 0,
    })),
  })

  const persist = async () => {
    if (!form.company_name.trim()) { alert('Nhập tên khách hàng'); return null }
    const data = buildData()
    const payload = {
      user_id: user.id,
      doc_number: form.doc_number || '', company_name: form.company_name, address: form.address,
      tax_code: form.tax_code, phone: form.phone, rep_name: form.rep_name, rep_title: form.rep_title,
      location: form.location, note: form.note, staff: form.staff, condition: form.condition,
      use_vat: !!form.use_vat, vat_percent: Number(form.vat_percent) || 0, items: data.items,
    }
    const runSave = async (pl) => {
      if (editId) {
        const { error } = await supabase.from('crm_delivery_docs').update(pl).eq('id', editId)
        return { data: { ...pl, id: editId, created_at: form.created_at }, error }
      }
      const { data, error } = await supabase.from('crm_delivery_docs').insert(pl).select().single()
      return { data, error }
    }
    let res = await runSave(payload)
    let tries = 0
    while (res.error && tries < 5) {
      const m = (res.error.message || '').match(/column "?([a-z_]+)"?/i) || (res.error.message || '').match(/'([a-z_]+)' column/i)
      const col = m && m[1]
      if (!col || !(col in payload)) break
      delete payload[col]; tries++
      res = await runSave(payload)
    }
    if (res.error) { alert('Lưu thất bại: ' + res.error.message); return null }
    return res.data || payload
  }

  // Lưu rồi xuất PDF theo loại
  const saveAndExport = async (kind) => {
    const saved = await persist()
    if (!saved) return
    setOpen(false); load()
    setTimeout(() => {
      if (kind === 'warehouse') exportWarehousePDF(saved)
      else exportDeliveryPDF(saved)
    }, 100)
  }

  const remove = async (id) => {
    if (!confirm('Xóa chứng từ này?')) return
    await supabase.from('crm_delivery_docs').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <PageHeader
        title="BBBGHH & Phiếu xuất kho"
        subtitle="Nhập thông tin một lần, xuất Phiếu xuất kho hoặc Biên bản bàn giao hàng hóa."
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo chứng từ</button>}
      />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Chưa có chứng từ nào"
          hint="Bấm “Tạo chứng từ” để nhập thông tin và xuất phiếu."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo chứng từ</button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-paper-line bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-paper-line bg-paper/60 text-left text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Số</th>
                <th className="px-4 py-3 font-medium">Khách hàng</th>
                <th className="px-4 py-3 text-right font-medium">Tổng tiền</th>
                <th className="px-4 py-3 font-medium">Ngày</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tot = (r.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
                return (
                  <tr key={r.id} className="border-b border-paper-line/60 last:border-0 hover:bg-paper/40">
                    <td className="px-4 py-3 font-medium text-ink">{r.doc_number || '—'}</td>
                    <td className="px-4 py-3 text-ink">{r.company_name}</td>
                    <td className="px-4 py-3 text-right text-ink">{formatVND(tot)}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => exportWarehousePDF(r)} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-faint hover:bg-paper hover:text-brand" title="Xuất Phiếu xuất kho">PXK</button>
                        <button onClick={() => exportDeliveryPDF(r)} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-faint hover:bg-paper hover:text-brand" title="Xuất Biên bản bàn giao">BBBG</button>
                        <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={15} /></button>
                        <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-rose-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Sửa chứng từ' : 'Tạo chứng từ giao hàng'} wide>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Số chứng từ</label>
              <input className="input-field" value={form.doc_number} onChange={set('doc_number')} placeholder="VD: BH06672 / BBBG-001" />
            </div>
            <div>
              <label className="label-field">Khách hàng (Bên B)</label>
              <input className="input-field" list="dl-companies" value={form.company_name} onChange={(e) => pickCompany(e.target.value)} placeholder="Tên công ty / khách hàng" />
              <datalist id="dl-companies">{customers.map((c, i) => <option key={i} value={c.company_name} />)}</datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Địa chỉ</label>
              <input className="input-field" value={form.address} onChange={set('address')} />
            </div>
            <div><label className="label-field">Mã số thuế</label><input className="input-field" value={form.tax_code} onChange={set('tax_code')} /></div>
            <div><label className="label-field">Điện thoại</label><input className="input-field" value={form.phone} onChange={set('phone')} /></div>
            <div><label className="label-field">Đại diện Bên B</label><input className="input-field" value={form.rep_name} onChange={set('rep_name')} placeholder="Họ tên người nhận" /></div>
            <div><label className="label-field">Chức vụ Bên B</label><input className="input-field" value={form.rep_title} onChange={set('rep_title')} /></div>
            <div className="sm:col-span-2"><label className="label-field">Địa điểm giao hàng <span className="text-ink-faint">(BBBG)</span></label><input className="input-field" value={form.location} onChange={set('location')} /></div>
            <div className="sm:col-span-2"><label className="label-field">Diễn giải <span className="text-ink-faint">(Phiếu xuất kho)</span></label><input className="input-field" value={form.note} onChange={set('note')} placeholder="VD: [Shopee] Đơn hàng bán cho..." /></div>
          </div>

          {/* Bảng hàng */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label-field mb-0">Danh sách hàng hóa</label>
              <button onClick={addItem} className="text-xs font-semibold text-brand hover:underline">+ Thêm dòng</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-paper-line p-3">
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-2"><input className="input-field py-1.5 text-sm" value={it.code} onChange={(e) => setItem(i, 'code', e.target.value)} placeholder="Mã hàng" /></div>
                    <div className="sm:col-span-4">
                      <input className="input-field py-1.5 text-sm" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="Tên hàng (mô tả đầy đủ)" />
                      {products.length > 0 && (
                        <select className="input-field mt-1 py-1 text-xs text-ink-soft" value="" onChange={(e) => pickProduct(i, e.target.value)}>
                          <option value="">— Chọn nhanh từ sản phẩm —</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.short_name || p.name}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="sm:col-span-2"><input className="input-field py-1.5 text-sm" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} placeholder="Đơn vị" /></div>
                    <div className="sm:col-span-1"><input type="number" className="input-field py-1.5 text-sm" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} placeholder="SL" /></div>
                    <div className="sm:col-span-2"><input type="number" className="input-field py-1.5 text-sm" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} placeholder="Đơn giá" /></div>
                    <div className="flex items-center justify-end sm:col-span-1"><button onClick={() => removeItem(i)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-rose-600"><X size={15} /></button></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-sm font-semibold text-ink">Tổng tiền hàng: {formatVND(total)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <input id="dl-vat" type="checkbox" checked={form.use_vat} onChange={setChk('use_vat')} className="h-4 w-4" />
              <label htmlFor="dl-vat" className="text-sm text-ink">Tính thuế GTGT (Phiếu xuất kho)</label>
              {form.use_vat && <input type="number" className="input-field w-20 py-1 text-sm" value={form.vat_percent} onChange={set('vat_percent')} />}
              {form.use_vat && <span className="text-sm text-ink-soft">%</span>}
            </div>
            <div><label className="label-field">Tình trạng hàng hóa <span className="text-ink-faint">(BBBG)</span></label><input className="input-field" value={form.condition} onChange={set('condition')} /></div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-50" onClick={() => saveAndExport('delivery')}>
            Xuất Biên bản bàn giao
          </button>
          <button className="btn-primary" onClick={() => saveAndExport('warehouse')}>Xuất Phiếu xuất kho</button>
        </div>
      </Modal>
    </div>
  )
}
