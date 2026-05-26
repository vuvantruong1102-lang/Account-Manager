import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Package, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'

const EMPTY = { name: '', sku: '', unit: 'cái', base_price: '', description: '', tiers: [] }

export default function Products() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('crm_products').select('*').order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (r) => { setForm({ ...EMPTY, ...r, tiers: r.tiers || [] }); setEditId(r.id); setOpen(true) }

  const save = async () => {
    if (!form.name.trim()) return
    const payload = {
      user_id: user.id, name: form.name, sku: form.sku, unit: form.unit,
      base_price: Number(form.base_price) || 0, description: form.description,
      tiers: form.tiers.filter((t) => t.min_qty && t.price).map((t) => ({ min_qty: Number(t.min_qty), price: Number(t.price) })),
    }
    if (editId) await supabase.from('crm_products').update(payload).eq('id', editId)
    else await supabase.from('crm_products').insert(payload)
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa sản phẩm này?')) return
    await supabase.from('crm_products').delete().eq('id', id); load()
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const addTier = () => setForm({ ...form, tiers: [...form.tiers, { min_qty: '', price: '' }] })
  const updateTier = (i, k, v) => {
    const tiers = [...form.tiers]; tiers[i] = { ...tiers[i], [k]: v }; setForm({ ...form, tiers })
  }
  const removeTier = (i) => setForm({ ...form, tiers: form.tiers.filter((_, j) => j !== i) })

  return (
    <div>
      <PageHeader title="Sản phẩm & Bảng giá" subtitle="Quà tặng công nghệ với giá bậc thang theo số lượng"
        action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm sản phẩm</button>} />

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon={Package} title="Chưa có sản phẩm nào"
          hint="Thêm ổ điện du lịch, sạc dây rút, sạc dự phòng... kèm giá bậc thang."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm sản phẩm</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-display font-600 text-ink">{r.name}</h3>
                  {r.sku && <p className="text-xs text-ink-faint">SKU: {r.sku}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={14} /></button>
                  <button onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-lg font-700 text-brand">{formatVND(r.base_price)} <span className="text-xs font-normal text-ink-faint">/ {r.unit}</span></p>
              {r.description && <p className="mt-1 text-sm text-ink-soft">{r.description}</p>}
              {r.tiers?.length > 0 && (
                <div className="mt-3 border-t border-paper-line pt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Giá bậc thang</p>
                  <div className="space-y-1">
                    {r.tiers.map((t, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-ink-soft">Từ {t.min_qty} {r.unit}</span>
                        <span className="font-medium text-ink">{formatVND(t.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}>
        <div className="space-y-4">
          <div>
            <label className="label-field">Tên sản phẩm *</label>
            <input className="input-field" value={form.name} onChange={set('name')} placeholder="VD: Sạc dự phòng 10000mAh" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-field">SKU</label>
              <input className="input-field" value={form.sku} onChange={set('sku')} />
            </div>
            <div>
              <label className="label-field">Đơn vị</label>
              <input className="input-field" value={form.unit} onChange={set('unit')} />
            </div>
            <div>
              <label className="label-field">Giá lẻ (₫)</label>
              <input className="input-field" type="number" value={form.base_price} onChange={set('base_price')} />
            </div>
          </div>
          <div>
            <label className="label-field">Mô tả</label>
            <input className="input-field" value={form.description} onChange={set('description')} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Giá bậc thang (theo SL)</label>
              <button onClick={addTier} className="text-xs font-semibold text-brand hover:underline">+ Thêm mức</button>
            </div>
            <div className="space-y-2">
              {form.tiers.length === 0 && <p className="text-xs text-ink-faint">Chưa có mức giá sỉ. Bấm “Thêm mức”.</p>}
              {form.tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-ink-soft">Từ</span>
                  <input className="input-field py-1.5" type="number" placeholder="SL" value={t.min_qty}
                    onChange={(e) => updateTier(i, 'min_qty', e.target.value)} />
                  <span className="text-xs text-ink-soft">{form.unit} →</span>
                  <input className="input-field py-1.5" type="number" placeholder="Giá ₫" value={t.price}
                    onChange={(e) => updateTier(i, 'price', e.target.value)} />
                  <button onClick={() => removeTier(i)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><X size={15} /></button>
                </div>
              ))}
            </div>
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
