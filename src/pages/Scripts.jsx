import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, PhoneCall, Sparkles, Copy, Check, User, Headphones } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CUSTOMER_TYPES, getTypeMeta } from '../lib/constants'
import { Badge, Modal, EmptyState, Spinner, PageHeader } from '../components/ui'
import { aiGenerate } from '../lib/ai'
import { parseScript } from '../lib/parseScript'

const EMPTY = { title: '', target_type: 'mice', context_prompt: '', content: '' }

function ScriptView({ content }) {
  const blocks = parseScript(content)
  if (blocks.length === 0) return <p className="text-sm text-ink-faint">Chưa có nội dung</p>
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        if (b.kind === 'heading')
          return <p key={i} className="pt-2 text-xs font-bold uppercase tracking-wide text-brand">{b.text}</p>
        if (b.kind === 'nv')
          return (
            <div key={i} className="flex gap-2.5">
              <span className="mt-0.5 inline-flex h-6 flex-shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 text-[11px] font-semibold text-brand"><Headphones size={11} /> NV</span>
              <p className="flex-1 rounded-lg rounded-tl-sm bg-brand-50/60 px-3 py-2 text-sm text-ink">{b.text}</p>
            </div>
          )
        if (b.kind === 'kh')
          return (
            <div key={i} className="flex flex-row-reverse gap-2.5">
              <span className="mt-0.5 inline-flex h-6 flex-shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 text-[11px] font-semibold text-blue-700"><User size={11} /> KH</span>
              <p className="flex-1 rounded-lg rounded-tr-sm bg-blue-50 px-3 py-2 text-sm text-ink">{b.text}</p>
            </div>
          )
        return <p key={i} className="text-sm leading-relaxed text-ink-soft">{b.text}</p>
      })}
    </div>
  )
}

export default function Scripts() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [viewRow, setViewRow] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('crm_scripts').select('*').order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (r) => { setForm({ ...EMPTY, ...r }); setEditId(r.id); setViewRow(null); setOpen(true) }

  const save = async () => {
    if (!form.title.trim()) return
    const payload = {
      user_id: user.id, title: form.title, target_type: form.target_type,
      context_prompt: form.context_prompt, content: form.content,
    }
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
    const prompt = `Viết một kịch bản sales call (gọi điện bán hàng) chi tiết bằng tiếng Việt cho nhân viên kinh doanh của Yokool.
Đối tượng khách hàng: ${typeLabel}.
Ngữ cảnh & yêu cầu cụ thể của người dùng: "${form.context_prompt || form.title || 'gọi điện chào bán quà tặng công nghệ'}".
S��n phẩm: quà tặng công nghệ Yokool gồm ổ điện du lịch, sạc dây rút, sạc dự phòng — dùng làm quà tặng nhân viên, doorgift, quà sự kiện cho doanh nghiệp.

ĐỊNH DẠNG BẮT BUỘC:
- Mỗi phần đặt tiêu đề dạng: ## Tên phần
- Mỗi lời thoại của nhân viên bắt đầu bằng "NV:" 
- Mỗi lời thoại/phản hồi dự kiến của khách hàng bắt đầu bằng "KH:"
Các phần cần có: Mở đầu & chào hỏi, Thăm dò nhu cầu, Giới thiệu giá trị sản phẩm, Xử lý 2-3 từ chối thường gặp, Chốt & bước tiếp theo.
Viết văn nói tự nhiên, thực tế. Chỉ trả về kịch bản đúng định dạng trên.`
    const text = await aiGenerate(prompt)
    setForm((f) => ({ ...f, content: text }))
    setAiLoading(false)
  }

  const copyView = async () => {
    await navigator.clipboard.writeText(viewRow?.content || '')
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const preview = (t) => (t || '').replace(/^#{1,3}\s+/gm, '').replace(/\n/g, ' ').replace(/(NV|KH):/g, '').slice(0, 90) + ((t || '').length > 90 ? '…' : '')

  return (
    <div>
      <PageHeader title="Kịch bản Sales Call" subtitle="Kịch bản riêng cho từng loại khách — tạo bằng AI"
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo kịch bản</button>} />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={PhoneCall} title="Chưa có kịch bản nào"
          hint="Tạo kịch bản gọi điện cho công ty MICE, Corporate, Event... và để AI soạn giúp."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo kịch bản</button>} />
      ) : (
        <div className="overflow-hidden card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Tiêu đề</th>
                <th className="px-5 py-3 font-semibold">Loại khách</th>
                <th className="px-5 py-3 font-semibold">Nội dung sales call</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tm = getTypeMeta(r.target_type)
                return (
                  <tr key={r.id} className="border-b border-paper-line last:border-0 hover:bg-paper/40">
                    <td className="px-5 py-3.5">
                      <button onClick={() => setViewRow(r)} className="text-left font-semibold text-ink hover:text-brand hover:underline">
                        {r.title}
                      </button>
                    </td>
                    <td className="px-5 py-3.5"><Badge className={tm.color}>{tm.label}</Badge></td>
                    <td className="px-5 py-3.5 max-w-[400px]">
                      <button onClick={() => setViewRow(r)} className="text-left text-ink-soft hover:text-brand">
                        {preview(r.content) || 'Chưa có nội dung'}
                      </button>
                    </td>
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

      {/* Modal xem full kịch bản — render đẹp với badge NV/KH */}
      <Modal open={!!viewRow} onClose={() => setViewRow(null)} wide title={viewRow?.title || 'Kịch bản'}>
        {viewRow && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Badge className={getTypeMeta(viewRow.target_type).color}>{getTypeMeta(viewRow.target_type).label}</Badge>
              <span className="flex items-center gap-1 text-xs text-ink-faint"><Headphones size={12} className="text-brand" /> Nhân viên</span>
              <span className="flex items-center gap-1 text-xs text-ink-faint"><User size={12} className="text-blue-600" /> Khách hàng</span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-paper-line bg-white p-4">
              <ScriptView content={viewRow.content} />
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
      <Modal open={open} onClose={() => setOpen(false)} wide title={editId ? 'Sửa kịch bản' : 'Tạo kịch bản sales'}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="label-field">Tên sales call *</label>
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
            <label className="label-field">Ngữ cảnh & AI prompts</label>
            <textarea className="input-field min-h-[70px]" value={form.context_prompt} onChange={set('context_prompt')}
              placeholder="Mô tả ngữ cảnh và yêu cầu — nội dung này cũng là prompt hướng dẫn AI. VD: Khách đã từng mua sạc dự phòng năm ngoái, gọi để chào đơn quà Tết mới, ngân sách lớn hơn." />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Nội dung kịch bản</label>
              <button onClick={generateAI} disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-100 disabled:opacity-50">
                <Sparkles size={13} /> {aiLoading ? 'AI đang soạn...' : 'AI tạo kịch bản'}
              </button>
            </div>
            <textarea className="input-field min-h-[280px] text-[13px]" value={form.content} onChange={set('content')}
              placeholder="Dùng NV: cho lời nhân viên, KH: cho lời khách. ## cho tiêu đề phần." />
            <p className="mt-1 text-xs text-ink-faint">Mẹo: bắt đầu dòng bằng <b>NV:</b> hoặc <b>KH:</b> để hiển thị bong bóng thoại có badge. <b>##</b> để tạo tiêu đề phần.</p>
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
