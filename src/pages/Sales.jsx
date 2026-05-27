import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, FileText, Trash2, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CUSTOMER_TYPES, getTypeMeta, CONTACT_STATUSES, getStatusMeta } from '../lib/constants'
import { Badge, Modal, EmptyState, Spinner, PageHeader } from '../components/ui'

// Panel Sales dùng chung trạng thái khách hàng với toàn hệ thống
const SALES_STATUS = CONTACT_STATUSES
const getSalesStatus = getStatusMeta

const EMPTY_CUST = {
  segment: 'b2b', company_name: '', address: '', phone: '', tax_code: '',
  contact_person: '', contact_email: '', contact_phone: '',
  customer_type: 'corporate', suitable_products: '', contact_status: 'working', reject_reason: '', notes: '',
}

export default function Sales() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [viewRow, setViewRow] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_CUST)
  const boxRef = useRef(null)

  const load = async () => {
    setLoading(true)
    // Panel Sales chỉ hiện khách hàng đang làm việc
    const { data } = await supabase.from('crm_customers').select('*')
      .eq('contact_status', 'working')
      .order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setSuggestOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Cập nhật nhanh inline
  const update = async (id, patch) => {
    await supabase.from('crm_customers').update(patch).eq('id', id)
    // Nếu đổi trạng thái sang khác "đang làm việc" thì khách rời khỏi panel Sales
    if (patch.contact_status && patch.contact_status !== 'working') {
      setRows((prev) => prev.filter((r) => r.id !== id))
    } else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    }
  }

  const remove = async (id) => {
    if (!confirm('Xóa khách hàng này khỏi danh sách?')) return
    await supabase.from('crm_customers').delete().eq('id', id); load()
  }

  // Tạo báo giá nhanh: nhồi dữ liệu khách vào sessionStorage rồi sang panel Báo giá
  const createQuote = (r) => {
    const prefill = {
      company_name: r.company_name, address: r.address || '', tax_code: r.tax_code || '',
      contact_person: r.contact_person || '', contact_email: r.contact_email || '',
    }
    sessionStorage.setItem('quote_prefill', JSON.stringify(prefill))
    navigate('/quotes?prefill=1')
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const saveCust = async () => {
    if (!form.company_name.trim()) { alert('Nhập tên khách hàng'); return }
    await supabase.from('crm_customers').insert({ ...form, user_id: user.id })
    setForm(EMPTY_CUST); setAddOpen(false); load()
  }

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase()
    return !s || r.company_name?.toLowerCase().includes(s) || r.contact_person?.toLowerCase().includes(s)
  })
  const suggestions = q ? rows.filter((r) => r.company_name?.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []

  return (
    <div>
      <PageHeader title="Sales" subtitle="Bảng theo dõi tiếp cận và bán hàng"
        action={<button className="btn-primary" onClick={() => { setForm(EMPTY_CUST); setAddOpen(true) }}><Plus size={16} /> Thêm khách hàng</button>} />

      {/* Ô tìm + gợi ý khách hàng có sẵn */}
      <div className="mb-4 flex items-center gap-3" ref={boxRef}>
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input-field pl-9" placeholder="Nhập tên khách hàng để tìm / gợi ý..."
            value={q} onChange={(e) => { setQ(e.target.value); setSuggestOpen(true) }}
            onFocus={() => setSuggestOpen(true)} />
          {suggestOpen && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-paper-line bg-white shadow-float">
              {suggestions.map((s) => (
                <button key={s.id} onClick={() => { setViewRow(s); setSuggestOpen(false) }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-paper">
                  <span className="font-medium text-ink">{s.company_name}</span>
                  <Badge className={getTypeMeta(s.customer_type).color}>{getTypeMeta(s.customer_type).label}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-sm text-ink-soft">{filtered.length} khách hàng</span>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có khách hàng nào"
          hint="Bấm “Thêm khách hàng” để bắt đầu theo dõi việc tiếp cận."
          action={<button className="btn-primary" onClick={() => setAddOpen(true)}><Plus size={16} /> Thêm khách hàng</button>} />
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-semibold">Tên khách hàng</th>
                <th className="px-4 py-3 font-semibold">Loại</th>
                <th className="px-4 py-3 font-semibold">Xem</th>
                <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                <th className="px-4 py-3 font-semibold">Tình trạng</th>
                <th className="px-4 py-3 font-semibold">Lý do từ chối</th>
                <th className="px-4 py-3 font-semibold">Ghi chú</th>
                <th className="px-4 py-3 font-semibold">Báo giá</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const tm = getTypeMeta(r.customer_type)
                return (
                  <tr key={r.id} className="border-b border-paper-line last:border-0 align-top hover:bg-paper/40">
                    <td className="px-4 py-3 font-semibold text-ink">{r.company_name}</td>
                    <td className="px-4 py-3"><Badge className={tm.color}>{tm.label}</Badge></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewRow(r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-brand"><Eye size={16} /></button>
                    </td>
                    <td className="px-4 py-3 max-w-[160px] text-ink-soft">{r.suitable_products || '—'}</td>
                    <td className="px-4 py-3">
                      <select value={r.contact_status || 'new'} onChange={(e) => update(r.id, { contact_status: e.target.value })}
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium focus:outline-none ${getSalesStatus(r.contact_status).color}`}>
                        {SALES_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-32 rounded border border-transparent px-2 py-1 text-xs hover:border-paper-line focus:border-brand focus:outline-none"
                        defaultValue={r.reject_reason || ''} placeholder="—"
                        onBlur={(e) => e.target.value !== (r.reject_reason || '') && update(r.id, { reject_reason: e.target.value })} />
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <input className="w-full rounded border border-transparent px-2 py-1 text-xs hover:border-paper-line focus:border-brand focus:outline-none"
                        defaultValue={r.notes || ''} placeholder="Thêm ghi chú..."
                        onBlur={(e) => e.target.value !== (r.notes || '') && update(r.id, { notes: e.target.value })} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => createQuote(r)} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-100">
                          <FileText size={13} /> Tạo
                        </button>
                        <button onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal xem full thông tin khách */}
      <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={viewRow?.company_name || 'Khách hàng'}>
        {viewRow && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge className={getTypeMeta(viewRow.customer_type).color}>{getTypeMeta(viewRow.customer_type).label}</Badge>
              <Badge className={getSalesStatus(viewRow.contact_status).color}>{getSalesStatus(viewRow.contact_status).label}</Badge>
              <Badge className="bg-paper text-ink-soft border-paper-line">{viewRow.segment === 'retail' ? 'Retail' : 'B2B'}</Badge>
            </div>
            {[
              ['Địa chỉ', viewRow.address], ['Số điện thoại', viewRow.phone], ['Mã số thuế', viewRow.tax_code],
              ['Người liên hệ', viewRow.contact_person], ['SĐT người liên hệ', viewRow.contact_phone],
              ['Email', viewRow.contact_email], ['Mặt hàng phù hợp', viewRow.suitable_products],
              ['Lý do từ chối', viewRow.reject_reason], ['Ghi chú', viewRow.notes],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 border-b border-paper-line pb-2">
                <span className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-faint">{k}</span>
                <span className="text-ink">{v || '—'}</span>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <button className="btn-primary" onClick={() => createQuote(viewRow)}><FileText size={15} /> Tạo báo giá</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal thêm nhanh khách hàng */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} wide title="Thêm khách hàng">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label-field">Tên công ty / khách hàng *</label>
            <input className="input-field" value={form.company_name} onChange={set('company_name')} />
          </div>
          <div>
            <label className="label-field">Phân khúc</label>
            <select className="input-field" value={form.segment} onChange={set('segment')}>
              <option value="b2b">B2B</option><option value="retail">Retail</option>
            </select>
          </div>
          <div>
            <label className="label-field">Loại công ty</label>
            <select className="input-field" value={form.customer_type} onChange={set('customer_type')}>
              {CUSTOMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div><label className="label-field">Số điện thoại</label><input className="input-field" value={form.phone} onChange={set('phone')} /></div>
          <div><label className="label-field">Mã số thuế</label><input className="input-field" value={form.tax_code} onChange={set('tax_code')} /></div>
          <div className="col-span-2"><label className="label-field">Địa chỉ</label><input className="input-field" value={form.address} onChange={set('address')} /></div>
          <div><label className="label-field">Người liên hệ</label><input className="input-field" value={form.contact_person} onChange={set('contact_person')} /></div>
          <div><label className="label-field">SĐT người liên hệ</label><input className="input-field" value={form.contact_phone} onChange={set('contact_phone')} /></div>
          <div className="col-span-2"><label className="label-field">Email người liên hệ</label><input className="input-field" value={form.contact_email} onChange={set('contact_email')} /></div>
          <div className="col-span-2"><label className="label-field">Mặt hàng phù hợp</label><input className="input-field" value={form.suitable_products} onChange={set('suitable_products')} placeholder="VD: Sạc dự phòng, ổ điện du lịch..." /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setAddOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={saveCust}>Thêm</button>
        </div>
      </Modal>
    </div>
  )
}
