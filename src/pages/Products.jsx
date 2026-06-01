import { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Package, X, ExternalLink, Upload, Image as ImgIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'

const EMPTY = {
  name: '', short_name: '', sku: '', unit: 'cái', base_price: '',
  description: '', image_url: '', product_url: '',
  tiers: [],
}

// Nén ảnh client-side: resize max 400px, JPEG quality 75 → ra base64
async function compressImage(file) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl
  })
  const max = 400
  let w = img.width, h = img.height
  if (w > max) { h = Math.round(h * (max / w)); w = max }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.75)
}

export default function Products() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

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
      user_id: user.id, name: form.name, short_name: form.short_name, sku: form.sku, unit: form.unit,
      base_price: Number(form.base_price) || 0,
      description: form.description, image_url: form.image_url, product_url: form.product_url,
      tiers: form.tiers.filter((t) => t.min_qty && t.price).map((t) => ({ min_qty: Number(t.min_qty), price: Number(t.price) })),
    }
    const { error } = editId
      ? await supabase.from('crm_products').update(payload).eq('id', editId)
      : await supabase.from('crm_products').insert(payload)
    if (error) {
      alert('Lưu thất bại: ' + error.message + '\n\nNếu lỗi nhắc đến cột "image_url" hoặc "product_url", chạy supabase_migration.sql.')
      return
    }
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa sản phẩm này?')) return
    await supabase.from('crm_products').delete().eq('id', id); load()
  }

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      setForm((f) => ({ ...f, image_url: compressed }))
    } catch (err) {
      alert('Không đọc được ảnh: ' + err.message)
    } finally {
      setUploading(false); e.target.value = ''
    }
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="card overflow-hidden">
              {r.image_url ? (
                <div className="aspect-video w-full overflow-hidden bg-paper">
                  <img src={r.image_url} alt={r.name} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-paper/50 text-ink-faint">
                  <ImgIcon size={28} />
                </div>
              )}
              <div className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-600 text-ink truncate">{r.name}</h3>
                    {r.sku && <p className="text-xs text-ink-faint">SKU: {r.sku}</p>}
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={14} /></button>
                    <button onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-lg font-700 text-brand">{formatVND(r.base_price)} <span className="text-xs font-normal text-ink-faint">/ {r.unit}</span></p>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{r.description}</p>}
                {r.product_url && (
                  <a href={r.product_url} target="_blank" rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                    <ExternalLink size={11} /> Xem trang sản phẩm
                  </a>
                )}
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
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} wide title={editId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Cột trái: ảnh */}
          <div>
            <label className="label-field">Ảnh sản phẩm</label>
            <div className="rounded-lg border border-dashed border-paper-line bg-paper/30 p-3">
              {form.image_url ? (
                <div className="space-y-2">
                  <img src={form.image_url} alt="" className="mx-auto max-h-48 rounded" />
                  <div className="flex gap-2">
                    <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-lg bg-white px-2 py-1.5 text-xs font-medium text-ink-soft hover:text-ink border border-paper-line">Đổi ảnh</button>
                    <button onClick={() => setForm({ ...form, image_url: '' })} className="rounded-lg px-2 py-1.5 text-xs text-ink-faint hover:bg-rose-50 hover:text-rose-600"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex w-full flex-col items-center gap-2 py-8 text-ink-faint hover:text-brand">
                  <Upload size={24} />
                  <span className="text-xs">{uploading ? 'Đang xử lý...' : 'Bấm để chọn ảnh'}</span>
                  <span className="text-[10px] text-ink-faint">Tự động nén</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </div>
          </div>

          {/* Cột phải: thông tin */}
          <div className="space-y-3 md:col-span-2">
            <div>
              <label className="label-field">Tên sản phẩm *</label>
              <input className="input-field" value={form.name} onChange={set('name')} placeholder="VD: Sạc dự phòng 10000mAh" />
            </div>
            <div>
              <label className="label-field">Tên rút gọn <span className="text-ink-faint">(hiện trong báo giá)</span></label>
              <input className="input-field" value={form.short_name} onChange={set('short_name')} placeholder="VD: Sạc dự phòng JP395" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label-field">SKU / Model</label>
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
              <label className="label-field">Link sản phẩm</label>
              <input className="input-field" value={form.product_url} onChange={set('product_url')} placeholder="https://yokool.vn/products/..." />
            </div>
            <div>
              <label className="label-field">Thông tin sản phẩm</label>
              <textarea className="input-field min-h-[140px]" value={form.description} onChange={set('description')}
                placeholder="VD: Model: JP395&#10;Chất liệu: Nhựa PC cao cấp&#10;Dung lượng: 10,000mAh&#10;Sạc nhanh PD 22.5W..." />
              <p className="mt-1 text-[11px] text-ink-faint">Mẹo: xuống dòng để xuất hiện gọn trong PDF báo giá đầy đủ.</p>
            </div>
          </div>

          {/* Giá bậc thang - full width */}
          <div className="md:col-span-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Giá bậc thang (theo SL)</label>
              <button onClick={addTier} className="text-xs font-semibold text-brand hover:underline">+ Thêm mức</button>
            </div>
            <div className="space-y-2">
              {form.tiers.length === 0 && <p className="text-xs text-ink-faint">Chưa có mức giá sỉ. Bấm "Thêm mức".</p>}
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
