import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PIPELINE_STAGES, formatVND, formatDate } from '../lib/constants'
import { Modal, Spinner, PageHeader } from '../components/ui'

const EMPTY = { title: '', customer_id: '', stage: 'lead', value: '', expected_close: '', notes: '' }

export default function Pipeline() {
  const { user } = useAuth()
  const [deals, setDeals] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [dragId, setDragId] = useState(null)

  const load = async () => {
    setLoading(true)
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from('crm_deals').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_customers').select('id, company_name'),
    ])
    setDeals(d || []); setCustomers(c || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const custName = (id) => customers.find((c) => c.id === id)?.company_name || '—'

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (d) => { setForm({ ...EMPTY, ...d, value: d.value || '', expected_close: d.expected_close || '', customer_id: d.customer_id || '' }); setEditId(d.id); setOpen(true) }

  const save = async () => {
    if (!form.title.trim()) return
    const payload = {
      user_id: user.id, title: form.title,
      customer_id: form.customer_id || null, stage: form.stage,
      value: Number(form.value) || 0,
      expected_close: form.expected_close || null, notes: form.notes,
    }
    if (editId) await supabase.from('crm_deals').update(payload).eq('id', editId)
    else await supabase.from('crm_deals').insert(payload)
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa cơ hội này?')) return
    await supabase.from('crm_deals').delete().eq('id', id); load()
  }

  const onDrop = async (stage) => {
    if (!dragId) return
    const deal = deals.find((d) => d.id === dragId)
    if (deal && deal.stage !== stage) {
      setDeals((prev) => prev.map((d) => (d.id === dragId ? { ...d, stage } : d)))
      await supabase.from('crm_deals').update({ stage }).eq('id', dragId)
    }
    setDragId(null)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const totalValue = deals.filter((d) => d.stage !== 'lost').reduce((s, d) => s + (Number(d.value) || 0), 0)

  return (
    <div>
      <PageHeader title="Pipeline cơ hội" subtitle={`Tổng giá trị đang theo đuổi: ${formatVND(totalValue)}`}
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm cơ hội</button>} />

      {loading ? <Spinner /> : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const items = deals.filter((d) => d.stage === stage.value)
            const sum = items.reduce((s, d) => s + (Number(d.value) || 0), 0)
            return (
              <div key={stage.value}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(stage.value)}
                className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-white/60 p-2">
                <div className="mb-2 flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                    <span className="text-sm font-semibold text-ink">{stage.label}</span>
                    <span className="text-xs text-ink-faint">{items.length}</span>
                  </div>
                </div>
                <p className="mb-2 px-2 text-xs text-ink-faint">{formatVND(sum)}</p>
                <div className="flex-1 space-y-2">
                  {items.map((d) => (
                    <div key={d.id} draggable
                      onDragStart={() => setDragId(d.id)}
                      className="group cursor-grab rounded-lg border border-paper-line bg-white p-3 shadow-card active:cursor-grabbing">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{d.title}</p>
                        <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => openEdit(d)} className="rounded p-1 text-ink-faint hover:text-ink"><Pencil size={13} /></button>
                          <button onClick={() => remove(d.id)} className="rounded p-1 text-ink-faint hover:text-rose-600"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">{custName(d.customer_id)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-brand">{formatVND(d.value)}</span>
                        {d.expected_close && <span className="text-xs text-ink-faint">{formatDate(d.expected_close)}</span>}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded-lg border border-dashed border-paper-line py-6 text-center text-xs text-ink-faint">Kéo thẻ vào đây</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Sửa cơ hội' : 'Thêm cơ hội bán hàng'}>
        <div className="space-y-4">
          <div>
            <label className="label-field">Tên cơ hội *</label>
            <input className="input-field" value={form.title} onChange={set('title')} placeholder="VD: Đơn doorgift Tết 2026 - 500 bộ sạc dự phòng" />
          </div>
          <div>
            <label className="label-field">Khách hàng</label>
            <select className="input-field" value={form.customer_id} onChange={set('customer_id')}>
              <option value="">— Chọn khách hàng —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Giai đoạn</label>
              <select className="input-field" value={form.stage} onChange={set('stage')}>
                {PIPELINE_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Giá trị (₫)</label>
              <input className="input-field" type="number" value={form.value} onChange={set('value')} />
            </div>
          </div>
          <div>
            <label className="label-field">Dự kiến chốt</label>
            <input className="input-field" type="date" value={form.expected_close} onChange={set('expected_close')} />
          </div>
          <div>
            <label className="label-field">Ghi chú</label>
            <textarea className="input-field min-h-[70px]" value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu' : 'Thêm'}</button>
        </div>
      </Modal>
    </div>
  )
}
