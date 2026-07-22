import { useEffect, useState } from 'react'
import { Plus, Trash2, X, ReceiptText, Pencil, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND, formatDate } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { exportPaymentPDF, DEFAULT_PAYMENT_NOTES } from '../lib/paymentPdf'

const newLine = () => ({ name: '', qty: 1, unit: 'Cái', price: 0 })

const DEFAULT_ORDER_DESC = 'Căn cứ vào Hợp đồng số 2207/2026/DT5.1-VNF ký ngày 22/07/2026 giữa Công ty cổ phần năng lượng DT5.1 và Công ty TNHH Thương mại dịch vụ và sản xuất VNF Việt Nam.'

const DEFAULT_MAIN =
  'Căn cứ Điều 2 về phương thức thanh toán của hợp đồng, Quý công ty cần thanh toán:\n' +
  'Số tiền: **20.000.000đ** (Bằng chữ: *Hai mươi triệu đồng*).\n' +
  'Kính đề nghị Quý Công ty thanh toán số tiền trên cho chúng tôi, chi tiết cụ thể như sau:\n' +
  '     + Tên đơn vị thụ hưởng: **Công ty TNHH thương mại dịch vụ và sản xuất VNF Việt Nam**\n' +
  '     + Số tài khoản: 19135661522015\n' +
  '     + Tại ngân hàng: Thương mại cổ phần Kỹ thương Việt Nam (Techcombank)\n' +
  'Rất mong sớm nhận được sự chấp nhận của Quý Công ty.\n' +
  'Xin chân thành cảm ơn!'

const EMPTY = {
  doc_number: 'DN03',
  company_name: '', address: '', tax_code: '',
  order_desc: DEFAULT_ORDER_DESC,
  show_items: true,
  notes: DEFAULT_MAIN,
  items: [newLine()],
}

export default function PaymentRequest() {
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
      supabase.from('crm_payment_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_products').select('*'),
      supabase.from('crm_customers').select('company_name, address, tax_code'),
    ])
    if (rr.error) console.error('Lỗi tải đề nghị thanh toán:', rr.error.message)
    setRows(rr.data || []); setProducts(pr.data || []); setCustomers(cr.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ ...EMPTY, items: [newLine()] }); setEditId(null); setOpen(true) }
  const openEdit = (r) => {
    const items = (r.items?.length ? r.items : [newLine()]).map((it) => ({ ...newLine(), ...it }))
    setForm({ ...EMPTY, ...r, notes: r.notes || DEFAULT_MAIN, show_items: r.show_items !== false, items })
    setEditId(r.id); setOpen(true)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setChk = (k) => (e) => setForm({ ...form, [k]: e.target.checked })
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, newLine()] }))
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))

  // Chọn công ty từ danh sách khách hàng → tự điền địa chỉ + MST
  const pickCompany = (name) => {
    const c = customers.find((x) => x.company_name === name)
    setForm((f) => ({ ...f, company_name: name, address: c?.address || f.address, tax_code: c?.tax_code || f.tax_code }))
  }
  // Chọn nhanh mặt hàng từ sản phẩm
  const pickProduct = (i, id) => {
    const p = products.find((x) => String(x.id) === String(id))
    if (!p) return
    setForm((f) => ({ ...f, items: f.items.map((it, j) => j === i ? {
      ...it, name: p.invoice_name || p.name || '', unit: p.unit || 'Cái', price: Number(p.base_price) || 0,
    } : it) }))
  }

  const total = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)

  const save = async () => {
    if (!form.company_name.trim()) { alert('Nhập tên công ty (Kính gửi)'); return }
    const items = form.items.filter((it) => it.name).map((it) => ({
      name: it.name, qty: Number(it.qty) || 0, unit: it.unit || '', price: Number(it.price) || 0,
    }))
    const payload = {
      user_id: user.id,
      doc_number: form.doc_number || 'DN03',
      company_name: form.company_name, address: form.address, tax_code: form.tax_code,
      order_desc: form.order_desc, notes: form.notes, show_items: !!form.show_items, items,
    }
    const runSave = async (pl) => {
      if (editId) {
        const { error } = await supabase.from('crm_payment_requests').update(pl).eq('id', editId)
        return { data: { ...pl, id: editId, created_at: form.created_at }, error }
      }
      const { data, error } = await supabase.from('crm_payment_requests').insert(pl).select().single()
      return { data, error }
    }
    let res = await runSave(payload)
    let tries = 0
    while (res.error && tries < 4) {
      const m = (res.error.message || '').match(/column "?([a-z_]+)"?/i) || (res.error.message || '').match(/'([a-z_]+)' column/i)
      const col = m && m[1]
      if (!col || !(col in payload)) break
      delete payload[col]; tries++
      res = await runSave(payload)
    }
    if (res.error) { alert('Lưu thất bại: ' + res.error.message); return }
    const saved = res.data || payload
    setOpen(false); load()
    setTimeout(() => exportPaymentPDF(saved), 100)
  }

  const remove = async (id) => {
    if (!confirm('Xóa đề nghị thanh toán này?')) return
    await supabase.from('crm_payment_requests').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Đề nghị thanh toán"
        subtitle="Tạo giấy đề nghị thanh toán (mẫu DN03) và xuất PDF."
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo đề nghị</button>}
      />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Chưa có đề nghị thanh toán nào"
          hint="Bấm “Tạo đề nghị” để lập giấy đề nghị thanh toán theo mẫu DN03."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo đề nghị</button>} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-paper-line bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-paper-line bg-paper/60 text-left text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Số</th>
                <th className="px-4 py-3 font-medium">Kính gửi</th>
                <th className="px-4 py-3 font-medium">Đơn hàng</th>
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
                    <td className="px-4 py-3 font-medium text-ink">{r.doc_number || 'DN03'}</td>
                    <td className="px-4 py-3 text-ink">{r.company_name}</td>
                    <td className="px-4 py-3 text-ink-soft">{r.order_desc}</td>
                    <td className="px-4 py-3 text-right text-ink">{formatVND(tot)}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => exportPaymentPDF(r)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-brand" title="Xuất PDF"><ReceiptText size={15} /></button>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Sửa đề nghị thanh toán' : 'Tạo đề nghị thanh toán'} wide>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Số chứng từ</label>
              <input className="input-field" value={form.doc_number} onChange={set('doc_number')} placeholder="DN03" />
            </div>
            <div>
              <label className="label-field">Kính gửi (Công ty)</label>
              <input className="input-field" list="pr-companies" value={form.company_name} onChange={(e) => pickCompany(e.target.value)} placeholder="Tên công ty khách hàng" />
              <datalist id="pr-companies">
                {customers.map((c, i) => <option key={i} value={c.company_name} />)}
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Địa chỉ</label>
              <input className="input-field" value={form.address} onChange={set('address')} />
            </div>
            <div>
              <label className="label-field">MST khách hàng</label>
              <input className="input-field" value={form.tax_code} onChange={set('tax_code')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Nội dung (hiện ngay dưới tiêu đề) <span className="text-ink-faint">(có thể sửa)</span></label>
              <textarea className="input-field min-h-[70px]" value={form.order_desc} onChange={set('order_desc')} placeholder="Căn cứ vào Hợp đồng số... giữa... và... ký ngày..." />
            </div>
          </div>

          {/* Bảng mặt hàng */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input id="pr-show-items" type="checkbox" checked={form.show_items} onChange={setChk('show_items')} className="h-4 w-4" />
                <label htmlFor="pr-show-items" className="label-field mb-0">Hiển thị bảng mặt hàng trong đề nghị</label>
              </div>
              {form.show_items && <button onClick={addItem} className="text-xs font-semibold text-brand hover:underline">+ Thêm dòng</button>}
            </div>
            {form.show_items && (<>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-paper-line p-3">
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <input className="input-field py-1.5 text-sm" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="Tên mặt hàng (mô tả đầy đủ)" />
                      {products.length > 0 && (
                        <select className="input-field mt-1 py-1 text-xs text-ink-soft" value="" onChange={(e) => pickProduct(i, e.target.value)}>
                          <option value="">— Chọn nhanh từ sản phẩm —</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.short_name || p.name}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <input type="number" className="input-field py-1.5 text-sm" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} placeholder="SL" />
                    </div>
                    <div className="sm:col-span-2">
                      <input className="input-field py-1.5 text-sm" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} placeholder="Đơn vị" />
                    </div>
                    <div className="sm:col-span-2">
                      <input type="number" className="input-field py-1.5 text-sm" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} placeholder="Đơn giá (đã VAT)" />
                    </div>
                    <div className="flex items-center justify-end sm:col-span-1">
                      <button onClick={() => removeItem(i)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-rose-600"><X size={15} /></button>
                    </div>
                  </div>
                  <p className="mt-1 text-right text-xs text-ink-faint">Thành tiền: {formatVND((Number(it.qty) || 0) * (Number(it.price) || 0))}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-sm font-semibold text-ink">Tổng cộng: {formatVND(total)}</p>
            </>)}
          </div>

          {/* Nội dung chính */}
          <div>
            <label className="label-field">Nội dung chính <span className="text-ink-faint">(có thể sửa · **đậm** · *nghiêng*)</span></label>
            <textarea className="input-field min-h-[200px] text-sm" value={form.notes} onChange={set('notes')} />
            <p className="mt-1 text-[11px] text-ink-faint">Mẹo: bọc chữ trong <b>**hai dấu sao**</b> để in đậm, <i>*một dấu sao*</i> để in nghiêng.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu & Xuất PDF' : 'Tạo & Xuất PDF'}</button>
        </div>
      </Modal>
    </div>
  )
}
