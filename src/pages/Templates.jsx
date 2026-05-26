import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, MessageSquareText, Sparkles, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CHANNELS, getChannelMeta } from '../lib/constants'
import { Badge, Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { aiGenerate } from '../lib/ai'

const EMPTY = { title: '', channel: 'email', content: '' }

export default function Templates() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [aiLoading, setAiLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('crm_templates').select('*').order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (r) => { setForm({ ...EMPTY, ...r }); setEditId(r.id); setOpen(true) }

  const save = async () => {
    if (!form.title.trim()) return
    const payload = { user_id: user.id, title: form.title, channel: form.channel, content: form.content }
    if (editId) await supabase.from('crm_templates').update(payload).eq('id', editId)
    else await supabase.from('crm_templates').insert(payload)
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa mẫu này?')) return
    await supabase.from('crm_templates').delete().eq('id', id); load()
  }

  const generateAI = async () => {
    setAiLoading(true)
    const channelLabel = getChannelMeta(form.channel).label
    const prompt = `Viết một mẫu ${channelLabel} chào hàng chuyên nghiệp bằng tiếng Việt để bán quà tặng công nghệ (ổ điện du lịch, sạc dây rút, sạc dự phòng) cho doanh nghiệp dùng làm quà tặng nhân viên, doorgift, sự kiện. Chủ đề/ngữ cảnh: "${form.title || 'chào hàng chung'}".
${form.channel === 'call' ? 'Viết dạng kịch bản nói ngắn gọn, tự nhiên.' : form.channel === 'zalo' ? 'Viết ngắn gọn, thân thiện, phù hợp tin nhắn Zalo.' : 'Viết email có lời chào, nội dung, lời kêu gọi hành động và chữ ký.'}
Chỉ trả về nội dung mẫu, không giải thích thêm.`
    const text = await aiGenerate(prompt)
    setForm((f) => ({ ...f, content: text }))
    setAiLoading(false)
  }

  const copy = async (r) => {
    await navigator.clipboard.writeText(r.content || '')
    setCopiedId(r.id); setTimeout(() => setCopiedId(null), 1500)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const filtered = filter === 'all' ? rows : rows.filter((r) => r.channel === filter)

  return (
    <div>
      <PageHeader title="Mẫu chào hàng" subtitle="Nội dung custom theo từng kênh"
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo mẫu</button>} />

      <div className="mb-5 flex gap-2">
        <button onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === 'all' ? 'bg-ink text-white' : 'btn-ghost'}`}>
          Tất cả
        </button>
        {CHANNELS.map((c) => (
          <button key={c.value} onClick={() => setFilter(c.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === c.value ? 'bg-ink text-white' : 'btn-ghost'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="Chưa có mẫu nào"
          hint="Tạo mẫu chào hàng theo kênh Email / Zalo / Call, có thể nhờ AI viết giúp."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo mẫu</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const cm = getChannelMeta(r.channel)
            return (
              <div key={r.id} className="card flex flex-col p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-display font-600 text-ink">{r.title}</h3>
                  <Badge className={cm.color}>{cm.label}</Badge>
                </div>
                <p className="mb-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft line-clamp-6">
                  {r.content || 'Chưa có nội dung'}
                </p>
                <div className="flex gap-1 border-t border-paper-line pt-3">
                  <button onClick={() => copy(r)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper hover:text-ink">
                    {copiedId === r.id ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Sao chép</>}
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={14} /></button>
                  <button onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} wide title={editId ? 'Sửa mẫu' : 'Tạo mẫu chào hàng'}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="label-field">Tiêu đề / Ngữ cảnh</label>
              <input className="input-field" value={form.title} onChange={set('title')} placeholder="VD: Chào hàng doorgift Tết" />
            </div>
            <div>
              <label className="label-field">Kênh</label>
              <select className="input-field" value={form.channel} onChange={set('channel')}>
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Nội dung</label>
              <button onClick={generateAI} disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-100 disabled:opacity-50">
                <Sparkles size={13} /> {aiLoading ? 'Đang viết...' : 'AI viết giúp'}
              </button>
            </div>
            <textarea className="input-field min-h-[260px] font-mono text-[13px]" value={form.content} onChange={set('content')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu' : 'Tạo mẫu'}</button>
        </div>
      </Modal>
    </div>
  )
}
