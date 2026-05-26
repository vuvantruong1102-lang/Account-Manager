import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, PhoneCall, Sparkles, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CUSTOMER_TYPES, getTypeMeta } from '../lib/constants'
import { Badge, Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { aiGenerate } from '../lib/ai'

const EMPTY = { title: '', target_type: 'mice', content: '' }

export default function Scripts() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('crm_scripts').select('*').order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (r) => { setForm({ ...EMPTY, ...r }); setEditId(r.id); setOpen(true) }

  const save = async () => {
    if (!form.title.trim()) return
    const payload = { user_id: user.id, title: form.title, target_type: form.target_type, content: form.content }
    if (editId) await supabase.from('crm_scripts').update(payload).eq('id', editId)
    else await supabase.from('crm_scripts').insert(payload)
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa kịch bản này?')) return
    await supabase.from('crm_scripts').delete().eq('id', id); load()
  }

  const generateAI = async () => {
    setAiLoading(true)
    const typeLabel = getTypeMeta(form.target_type).label
    const prompt = `Viết một kịch bản sales call (gọi điện bán hàng) chi tiết bằng tiếng Việt cho nhân viên kinh doanh.
Đối tượng khách hàng: ${typeLabel}.
Ngữ cảnh cụ thể: "${form.title || 'gọi điện chào bán quà tặng công nghệ'}".
Sản phẩm bán: quà tặng công nghệ gồm ổ điện du lịch, sạc dây rút, sạc dự phòng — dùng làm quà tặng nhân viên, doorgift, quà sự kiện cho doanh nghiệp.
Kịch bản cần có các phần rõ ràng: (1) Mở đầu & chào hỏi, (2) Câu hỏi thăm dò nhu cầu, (3) Giới thiệu giá trị sản phẩm phù hợp với loại khách này, (4) Xử lý 2-3 từ chối thường gặp, (5) Chốt & bước tiếp theo.
Viết theo văn nói tự nhiên, ngắn gọn, thực tế. Chỉ trả về kịch bản.`
    const text = await aiGenerate(prompt)
    setForm((f) => ({ ...f, content: text }))
    setAiLoading(false)
  }

  const copy = async (r) => {
    await navigator.clipboard.writeText(r.content || '')
    setCopiedId(r.id); setTimeout(() => setCopiedId(null), 1500)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div>
      <PageHeader title="Kịch bản Sales Call" subtitle="Kịch bản riêng cho từng loại khách — tạo bằng AI"
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo kịch bản</button>} />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={PhoneCall} title="Chưa có kịch bản nào"
          hint="Tạo kịch bản gọi điện cho công ty MICE, Corporate, Event... và để AI soạn giúp."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo kịch bản</button>} />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const tm = getTypeMeta(r.target_type)
            return (
              <div key={r.id} className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-600 text-ink">{r.title}</h3>
                    <Badge className={tm.color}>{tm.label}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => copy(r)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper hover:text-ink">
                      {copiedId === r.id ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Sao chép</>}
                    </button>
                    <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={15} /></button>
                    <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">{r.content || 'Chưa có nội dung'}</pre>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} wide title={editId ? 'Sửa kịch bản' : 'Tạo kịch bản sales call'}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="label-field">Tiêu đề / Ngữ cảnh</label>
              <input className="input-field" value={form.title} onChange={set('title')} placeholder="VD: Gọi chào doorgift sự kiện cuối năm" />
            </div>
            <div>
              <label className="label-field">Loại khách</label>
              <select className="input-field" value={form.target_type} onChange={set('target_type')}>
                {CUSTOMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Nội dung kịch bản</label>
              <button onClick={generateAI} disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-100 disabled:opacity-50">
                <Sparkles size={13} /> {aiLoading ? 'AI đang soạn...' : 'AI tạo kịch bản'}
              </button>
            </div>
            <textarea className="input-field min-h-[320px] text-[13px]" value={form.content} onChange={set('content')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu' : 'Tạo kịch bản'}</button>
        </div>
      </Modal>
    </div>
  )
}
