import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, MessageSquareText, Sparkles, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CHANNELS, getChannelMeta, CUSTOMER_TYPES, getTypeMeta } from '../lib/constants'
import { Badge, Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { aiGenerate } from '../lib/ai'

const EMPTY = { title: '', channel: 'email', target_type: 'corporate', context_prompt: '', content: '' }

export default function Templates() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [viewRow, setViewRow] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [aiLoading, setAiLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('crm_templates').select('*').order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (r) => { setForm({ ...EMPTY, ...r }); setEditId(r.id); setViewRow(null); setOpen(true) }

  const save = async () => {
    if (!form.title.trim()) return
    const payload = {
      user_id: user.id, title: form.title, channel: form.channel,
      target_type: form.target_type, context_prompt: form.context_prompt, content: form.content,
    }
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
    const typeLabel = getTypeMeta(form.target_type).label
    const prompt = `Viết một mẫu ${channelLabel} chào hàng chuyên nghiệp bằng tiếng Việt để bán quà tặng công nghệ Yokool (ổ điện du lịch, sạc dây rút, sạc dự phòng) cho doanh nghiệp dùng làm quà tặng nhân viên, doorgift, sự kiện.
Đối tượng khách hàng: ${typeLabel}.
Ngữ cảnh & yêu cầu cụ thể của người dùng: "${form.context_prompt || form.title || 'chào hàng chung'}".
${form.channel === 'call' ? 'Viết dạng kịch bản nói ngắn gọn, tự nhiên.' : form.channel === 'zalo' || form.channel === 'facebook' ? 'Viết ngắn gọn, thân thiện, phù hợp tin nhắn.' : 'Viết email có lời chào, nội dung, lời kêu gọi hành động và chữ ký.'}
Chỉ trả về nội dung mẫu, không giải thích thêm.`
    const text = await aiGenerate(prompt)
    setForm((f) => ({ ...f, content: text }))
    setAiLoading(false)
  }

  const copyView = async () => {
    await navigator.clipboard.writeText(viewRow?.content || '')
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const filtered = filter === 'all' ? rows : rows.filter((r) => r.channel === filter)
  const preview = (t) => (t || '').replace(/\n/g, ' ').slice(0, 90) + ((t || '').length > 90 ? '…' : '')

  return (
    <div>
      <PageHeader title="Mẫu chào hàng" subtitle="Nội dung custom theo từng kênh và loại khách"
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo mẫu</button>} />

      <div className="mb-5 flex flex-wrap gap-2">
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
          hint="Tạo mẫu chào hàng theo kênh và loại khách, có thể nhờ AI viết giúp."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo mẫu</button>} />
      ) : (
        <div className="overflow-hidden card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Tiêu đề</th>
                <th className="px-5 py-3 font-semibold">Loại khách</th>
                <th className="px-5 py-3 font-semibold">Nội dung mẫu</th>
                <th className="px-5 py-3 font-semibold">Kênh</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const cm = getChannelMeta(r.channel)
                const tm = getTypeMeta(r.target_type)
                return (
                  <tr key={r.id} className="border-b border-paper-line last:border-0 hover:bg-paper/40">
                    <td className="px-5 py-3.5">
                      <button onClick={() => setViewRow(r)} className="text-left font-semibold text-ink hover:text-brand hover:underline">
                        {r.title}
                      </button>
                    </td>
                    <td className="px-5 py-3.5"><Badge className={tm.color}>{tm.label}</Badge></td>
                    <td className="px-5 py-3.5 max-w-[340px]">
                      <button onClick={() => setViewRow(r)} className="text-left text-ink-soft hover:text-brand">
                        {preview(r.content) || 'Chưa có nội dung'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5"><Badge className={cm.color}>{cm.label}</Badge></td>
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

      {/* Modal xem full nội dung */}
      <Modal open={!!viewRow} onClose={() => setViewRow(null)} wide title={viewRow?.title || 'Mẫu chào hàng'}>
        {viewRow && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Badge className={getChannelMeta(viewRow.channel).color}>{getChannelMeta(viewRow.channel).label}</Badge>
              <Badge className={getTypeMeta(viewRow.target_type).color}>{getTypeMeta(viewRow.target_type).label}</Badge>
            </div>
            <div className="rounded-lg border border-paper-line bg-paper/40 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{viewRow.content || 'Chưa có nội dung'}</pre>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={copyView}>
                {copied ? <><Check size={15} /> Đã chép</> : <><Copy size={15} /> Sao chép</>}
              </button>
              <button className="btn-primary" onClick={() => openEdit(viewRow)}><Pencil size={15} /> Chỉnh sửa</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal tạo/sửa */}
      <Modal open={open} onClose={() => setOpen(false)} wide title={editId ? 'Sửa mẫu' : 'Tạo mẫu chào hàng'}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="label-field">Tên mẫu chào hàng *</label>
              <input className="input-field" value={form.title} onChange={set('title')} placeholder="VD: Chào hàng doorgift Tết" />
            </div>
            <div>
              <label className="label-field">Loại khách</label>
              <select className="input-field" value={form.target_type} onChange={set('target_type')}>
                {CUSTOMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Kênh</label>
              <select className="input-field" value={form.channel} onChange={set('channel')}>
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-field">Ngữ cảnh & AI prompts</label>
            <textarea className="input-field min-h-[70px]" value={form.context_prompt} onChange={set('context_prompt')}
              placeholder="Mô tả ngữ cảnh và yêu cầu — nội dung này cũng là prompt hướng dẫn AI viết. VD: Khách là công ty MICE 300 nhân viên, cần quà Tết tầm 300k/phần, nhấn mạnh tính tiện dụng khi đi công tác." />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Nội dung</label>
              <button onClick={generateAI} disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-100 disabled:opacity-50">
                <Sparkles size={13} /> {aiLoading ? 'Đang viết...' : 'AI viết giúp'}
              </button>
            </div>
            <textarea className="input-field min-h-[240px] text-[13px]" value={form.content} onChange={set('content')} />
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
