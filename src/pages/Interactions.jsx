import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, Clock, History, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { INTERACTION_TYPES, formatDate } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader, Badge } from '../components/ui'

const EMPTY = { customer_id: '', type: 'call', summary: '', follow_up_date: '' }

export default function Interactions() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const load = async () => {
    setLoading(true)
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('crm_interactions').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_customers').select('id, company_name'),
    ])
    setRows(r || []); setCustomers(c || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const custName = (id) => customers.find((c) => c.id === id)?.company_name || '—'
  const typeLabel = (v) => INTERACTION_TYPES.find((t) => t.value === v)?.label || v

  const save = async () => {
    if (!form.customer_id) { alert('Hãy chọn khách hàng'); return }
    await supabase.from('crm_interactions').insert({
      user_id: user.id, customer_id: form.customer_id, type: form.type,
      summary: form.summary, follow_up_date: form.follow_up_date || null,
    })
    setForm(EMPTY); setOpen(false); load()
  }

  const toggleDone = async (r) => {
    await supabase.from('crm_interactions').update({ done: !r.done }).eq('id', r.id); load()
  }
  const remove = async (id) => {
    if (!confirm('Xóa ghi chú này?')) return
    await supabase.from('crm_interactions').delete().eq('id', id); load()
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const today = new Date().toISOString().slice(0, 10)
  const pending = rows.filter((r) => r.follow_up_date && !r.done)
  const overdue = pending.filter((r) => r.follow_up_date < today)
  const upcoming = pending.filter((r) => r.follow_up_date >= today)

  return (
    <div>
      <PageHeader title="Lịch sử & Follow-up" subtitle="Ghi lại tương tác và nhắc lịch liên hệ lại"
        action={<button className="btn-primary" onClick={() => { setForm(EMPTY); setOpen(true) }}><Plus size={16} /> Ghi tương tác</button>} />

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Cột nhắc lịch */}
          <div className="space-y-4">
            {overdue.length > 0 && (
              <div className="card p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-600"><AlertCircle size={15} /> Quá hạn ({overdue.length})</p>
                <div className="space-y-2">
                  {overdue.map((r) => (
                    <div key={r.id} className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-ink">{custName(r.customer_id)}</p>
                        <button onClick={() => toggleDone(r)} className="rounded p-1 text-rose-400 hover:text-emerald-600"><Check size={15} /></button>
                      </div>
                      <p className="text-xs text-rose-600">{formatDate(r.follow_up_date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Clock size={15} /> Sắp tới ({upcoming.length})</p>
              {upcoming.length === 0 ? <p className="text-xs text-ink-faint">Không có lịch nào.</p> : (
                <div className="space-y-2">
                  {upcoming.map((r) => (
                    <div key={r.id} className="rounded-lg border border-paper-line bg-paper/40 p-2.5">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-ink">{custName(r.customer_id)}</p>
                        <button onClick={() => toggleDone(r)} className="rounded p-1 text-ink-faint hover:text-emerald-600"><Check size={15} /></button>
                      </div>
                      <p className="text-xs text-ink-soft">{formatDate(r.follow_up_date)} · {typeLabel(r.type)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cột lịch sử đầy đủ */}
          <div className="lg:col-span-2">
            {rows.length === 0 ? (
              <EmptyState icon={History} title="Chưa có tương tác nào"
                hint="Ghi lại mỗi cuộc gọi, email, Zalo với khách kèm ngày cần liên hệ lại." />
            ) : (
              <div className="card divide-y divide-paper-line">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-4">
                    <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${r.done ? 'bg-emerald-100 text-emerald-700' : 'bg-paper text-ink-soft'}`}>
                      {typeLabel(r.type).slice(0, 1)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">{custName(r.customer_id)}</p>
                        <Badge className="bg-paper text-ink-soft border-paper-line">{typeLabel(r.type)}</Badge>
                        {r.done && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Đã xong</Badge>}
                      </div>
                      {r.summary && <p className="mt-1 text-sm text-ink-soft">{r.summary}</p>}
                      <p className="mt-1 text-xs text-ink-faint">
                        {formatDate(r.created_at)}
                        {r.follow_up_date && <span> · Follow-up: {formatDate(r.follow_up_date)}</span>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {r.follow_up_date && <button onClick={() => toggleDone(r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-emerald-600"><Check size={15} /></button>}
                      <button onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Ghi tương tác">
        <div className="space-y-4">
          <div>
            <label className="label-field">Khách hàng *</label>
            <select className="input-field" value={form.customer_id} onChange={set('customer_id')}>
              <option value="">— Chọn khách hàng —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Loại tương tác</label>
            <select className="input-field" value={form.type} onChange={set('type')}>
              {INTERACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Nội dung / Kết quả</label>
            <textarea className="input-field min-h-[80px]" value={form.summary} onChange={set('summary')} placeholder="VD: Đã gửi báo giá, khách hẹn xem mẫu tuần sau" />
          </div>
          <div>
            <label className="label-field">Ngày cần liên hệ lại</label>
            <input className="input-field" type="date" value={form.follow_up_date} onChange={set('follow_up_date')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>Lưu</button>
        </div>
      </Modal>
    </div>
  )
}
