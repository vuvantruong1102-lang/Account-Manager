import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Building2, Store, Phone, Mail, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  CUSTOMER_TYPES, getTypeMeta, CONTACT_STATUSES, getStatusMeta,
} from '../lib/constants'
import { Badge, Modal, EmptyState, Spinner, PageHeader } from '../components/ui'

const EMPTY = {
  company_name: '', address: '', phone: '', tax_code: '',
  contact_person: '', contact_email: '', contact_phone: '',
  customer_type: 'corporate', suitable_products: '', contact_status: 'new', notes: '',
}

export default function Customers({ segment }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)

  const isRetail = segment === 'retail'

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('segment', segment)
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [segment])

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (row) => {
    setForm({ ...EMPTY, ...row }); setEditId(row.id); setOpen(true)
  }

  const save = async () => {
    if (!form.company_name.trim()) return
    const payload = {
      segment, user_id: user.id,
      company_name: form.company_name, address: form.address, phone: form.phone,
      tax_code: form.tax_code, contact_person: form.contact_person,
      contact_email: form.contact_email, contact_phone: form.contact_phone,
      customer_type: form.customer_type, suitable_products: form.suitable_products,
      contact_status: form.contact_status, notes: form.notes,
    }
    if (editId) await supabase.from('crm_customers').update(payload).eq('id', editId)
    else await supabase.from('crm_customers').insert(payload)
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa khách hàng này?')) return
    await supabase.from('crm_customers').delete().eq('id', id)
    load()
  }

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase()
    return !s ||
      r.company_name?.toLowerCase().includes(s) ||
      r.contact_person?.toLowerCase().includes(s) ||
      r.phone?.includes(s) || r.tax_code?.includes(s)
  })

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div>
      <PageHeader
        title={isRetail ? 'Khách hàng Retail' : 'Khách hàng B2B'}
        subtitle={isRetail ? 'Danh mục khách bán lẻ' : 'Danh mục khách doanh nghiệp'}
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm khách hàng</button>}
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input-field pl-9" placeholder="Tìm tên công ty, người liên hệ, SĐT, MST..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-sm text-ink-soft">{filtered.length} khách hàng</span>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={isRetail ? Store : Building2}
          title="Chưa có khách hàng nào"
          hint="Bấm “Thêm khách hàng” để tạo bản ghi đầu tiên."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm khách hàng</button>} />
      ) : (
        <div className="overflow-hidden card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Công ty</th>
                <th className="px-5 py-3 font-semibold">Loại</th>
                <th className="px-5 py-3 font-semibold">Người liên hệ</th>
                <th className="px-5 py-3 font-semibold">Mặt hàng phù hợp</th>
                <th className="px-5 py-3 font-semibold">Tình trạng</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const tm = getTypeMeta(r.customer_type)
                const sm = getStatusMeta(r.contact_status)
                return (
                  <tr key={r.id} className="border-b border-paper-line last:border-0 hover:bg-paper/40">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink">{r.company_name}</p>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-faint">
                        {r.address && <span className="flex items-center gap-1"><MapPin size={11} />{r.address}</span>}
                        {r.tax_code && <span>MST: {r.tax_code}</span>}
                      </p>
                    </td>
                    <td className="px-5 py-3.5"><Badge className={tm.color}>{tm.label}</Badge></td>
                    <td className="px-5 py-3.5">
                      <p className="text-ink">{r.contact_person || '—'}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                        {r.contact_phone && <span className="flex items-center gap-1"><Phone size={11} />{r.contact_phone}</span>}
                        {r.contact_email && <span className="flex items-center gap-1"><Mail size={11} />{r.contact_email}</span>}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px] text-ink-soft">{r.suitable_products || '—'}</td>
                    <td className="px-5 py-3.5"><Badge className={sm.color}>{sm.label}</Badge></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
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
        title={editId ? 'Sửa khách hàng' : 'Thêm khách hàng'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label-field">Tên công ty *</label>
            <input className="input-field" value={form.company_name} onChange={set('company_name')} />
          </div>
          <div className="col-span-2">
            <label className="label-field">Địa chỉ</label>
            <input className="input-field" value={form.address} onChange={set('address')} />
          </div>
          <div>
            <label className="label-field">Số điện thoại</label>
            <input className="input-field" value={form.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="label-field">Mã số thuế</label>
            <input className="input-field" value={form.tax_code} onChange={set('tax_code')} />
          </div>
          <div>
            <label className="label-field">Người liên hệ</label>
            <input className="input-field" value={form.contact_person} onChange={set('contact_person')} />
          </div>
          <div>
            <label className="label-field">SĐT người liên hệ</label>
            <input className="input-field" value={form.contact_phone} onChange={set('contact_phone')} />
          </div>
          <div className="col-span-2">
            <label className="label-field">Email người liên hệ</label>
            <input className="input-field" value={form.contact_email} onChange={set('contact_email')} />
          </div>
          <div>
            <label className="label-field">Loại công ty</label>
            <select className="input-field" value={form.customer_type} onChange={set('customer_type')}>
              {CUSTOMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Tình trạng liên hệ</label>
            <select className="input-field" value={form.contact_status} onChange={set('contact_status')}>
              {CONTACT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label-field">Mặt hàng phù hợp</label>
            <input className="input-field" value={form.suitable_products} onChange={set('suitable_products')}
              placeholder="VD: Sạc dự phòng, ổ điện du lịch, sạc dây rút..." />
          </div>
          <div className="col-span-2">
            <label className="label-field">Ghi chú</label>
            <textarea className="input-field min-h-[70px]" value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu thay đổi' : 'Thêm mới'}</button>
        </div>
      </Modal>
    </div>
  )
}
