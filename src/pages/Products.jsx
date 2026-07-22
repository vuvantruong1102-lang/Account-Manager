import { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Package, X, ExternalLink, Upload, Image as ImgIcon, Gift, Boxes } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatVND } from '../lib/constants'
import { Modal, EmptyState, Spinner, PageHeader } from '../components/ui'

const EMPTY = {
  name: '', short_name: '', invoice_name: '', sku: '', unit: 'cái', base_price: '',
  description: '', image_url: '', product_url: '',
  price_t1: '', price_t2: '', price_t3: '',   // giá bậc: 10-100 / 101-300 / >300
}

const EMPTY_SET = {
  name: '', short_name: '', invoice_name: '', sku: '', unit: 'set',
  price: '', auto_price: true, items: [], description: '', image_url: '', gallery: [],
}

// Nén ảnh client-side: resize + JPEG → base64. max/quality tùy chỉnh.
async function compressImage(file, max = 400, quality = 0.75) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl
  })
  let w = img.width, h = img.height
  if (w > max) { h = Math.round(h * (max / w)); w = max }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

// Ảnh set quà (đại diện + minh họa) cần in TO & NÉT → độ phân giải cao hơn
const compressSetImage = (file) => compressImage(file, 1200, 0.85)

export default function Products() {
  const { user } = useAuth()
  const [tab, setTab] = useState('products') // 'products' | 'sets'
  const [rows, setRows] = useState([])
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('crm_products').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_gift_sets').select('*').order('created_at', { ascending: false }),
    ])
    setRows(p || []); setSets(s || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <PageHeader title="Sản phẩm & Bảng giá" subtitle="Quà tặng công nghệ và set quà combo với giá bậc thang" />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-paper-line bg-white p-1 w-fit">
        <button onClick={() => setTab('products')}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'products' ? 'bg-brand text-white' : 'text-ink-soft hover:bg-paper'}`}>
          <Boxes size={15} /> Sản phẩm <span className="text-xs opacity-70">({rows.length})</span>
        </button>
        <button onClick={() => setTab('sets')}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'sets' ? 'bg-brand text-white' : 'text-ink-soft hover:bg-paper'}`}>
          <Gift size={15} /> Set quà <span className="text-xs opacity-70">({sets.length})</span>
        </button>
      </div>

      {tab === 'products'
        ? <ProductsTab rows={rows} loading={loading} reload={load} user={user} />
        : <SetsTab sets={sets} products={rows} loading={loading} reload={load} user={user} />}
    </div>
  )
}

/* ============================ TAB SẢN PHẨM ============================ */
function ProductsTab({ rows, loading, reload, user }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (r) => { setForm({ ...EMPTY, ...r, price_t1: r.price_t1 ?? '', price_t2: r.price_t2 ?? '', price_t3: r.price_t3 ?? '' }); setEditId(r.id); setOpen(true) }

  const save = async () => {
    if (!form.name.trim()) return
    const payload = {
      user_id: user.id, name: form.name, short_name: form.short_name, invoice_name: form.invoice_name,
      sku: form.sku, unit: form.unit, base_price: Number(form.base_price) || 0,
      description: form.description, image_url: form.image_url, product_url: form.product_url,
      price_t1: form.price_t1 === '' ? null : Number(form.price_t1),
      price_t2: form.price_t2 === '' ? null : Number(form.price_t2),
      price_t3: form.price_t3 === '' ? null : Number(form.price_t3),
    }
    const runSave = async (pl) => editId
      ? await supabase.from('crm_products').update(pl).eq('id', editId)
      : await supabase.from('crm_products').insert(pl)
    let { error } = await runSave(payload)
    // Nếu DB chưa có cột giá bậc thì bỏ đi rồi lưu lại
    let tries = 0
    while (error && tries < 4) {
      const m = (error.message || '').match(/column "?([a-z_0-9]+)"?/i) || (error.message || '').match(/'([a-z_0-9]+)' column/i)
      const col = m && m[1]
      if (!col || !(col in payload)) break
      delete payload[col]; tries++
      ;({ error } = await runSave(payload))
    }
    if (error) {
      alert('Lưu thất bại: ' + error.message + '\n\nNếu lỗi nhắc đến cột "price_t1/price_t2/price_t3", chạy supabase_migration_giftsets.sql.')
      return
    }
    setOpen(false); reload()
  }

  const remove = async (id) => {
    if (!confirm('Xóa sản phẩm này?')) return
    await supabase.from('crm_products').delete().eq('id', id); reload()
  }

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const img = await compressImage(file); setForm((f) => ({ ...f, image_url: img })) }
    catch (err) { alert('Không đọc được ảnh: ' + err.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm sản phẩm</button>
      </div>

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
                <div className="flex aspect-video w-full items-center justify-center bg-paper/50 text-ink-faint"><ImgIcon size={28} /></div>
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
                  <a href={r.product_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                    <ExternalLink size={11} /> Xem trang sản phẩm
                  </a>
                )}
                {(r.price_t1 || r.price_t2 || r.price_t3) && (
                  <div className="mt-3 border-t border-paper-line pt-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Giá theo số lượng</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-ink-soft">10–100 {r.unit}</span><span className="font-medium text-ink">{formatVND(r.price_t1 || r.base_price)}</span></div>
                      <div className="flex justify-between"><span className="text-ink-soft">101–300 {r.unit}</span><span className="font-medium text-ink">{formatVND(r.price_t2 || r.base_price)}</span></div>
                      <div className="flex justify-between"><span className="text-ink-soft">&gt; 300 {r.unit}</span><span className="font-medium text-ink">{formatVND(r.price_t3 || r.base_price)}</span></div>
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
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex w-full flex-col items-center gap-2 py-8 text-ink-faint hover:text-brand">
                  <Upload size={24} />
                  <span className="text-xs">{uploading ? 'Đang xử lý...' : 'Bấm để chọn ảnh'}</span>
                  <span className="text-[10px] text-ink-faint">Tự động nén</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </div>
          </div>

          <div className="space-y-3 md:col-span-2">
            <div>
              <label className="label-field">Tên sản phẩm *</label>
              <input className="input-field" value={form.name} onChange={set('name')} placeholder="VD: Sạc dự phòng 10000mAh" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-field">Tên rút gọn <span className="text-ink-faint">(hiện trong báo giá)</span></label>
                <input className="input-field" value={form.short_name} onChange={set('short_name')} placeholder="VD: Sạc dự phòng JP395" />
              </div>
              <div>
                <label className="label-field">Tên trên hóa đơn <span className="text-ink-faint">(xuất VAT)</span></label>
                <input className="input-field" value={form.invoice_name} onChange={set('invoice_name')} placeholder="VD: Pin sạc dự phòng JP395 10000mAh" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label-field">SKU / Model</label><input className="input-field" value={form.sku} onChange={set('sku')} /></div>
              <div><label className="label-field">Đơn vị</label><input className="input-field" value={form.unit} onChange={set('unit')} /></div>
              <div><label className="label-field">Giá lẻ (₫)</label><input className="input-field" type="number" value={form.base_price} onChange={set('base_price')} /></div>
            </div>
            <div>
              <label className="label-field">Link sản phẩm</label>
              <input className="input-field" value={form.product_url} onChange={set('product_url')} placeholder="https://yokool.vn/products/..." />
            </div>
            <div>
              <label className="label-field">Thông số kỹ thuật / Thông tin sản phẩm</label>
              <textarea className="input-field min-h-[140px]" value={form.description} onChange={set('description')}
                placeholder="VD: Model: JP395&#10;Chất liệu: Nhựa PC cao cấp&#10;Dung lượng: 10,000mAh&#10;Sạc nhanh PD 22.5W..." />
              <p className="mt-1 text-[11px] text-ink-faint">Mẹo: xuống dòng để xuất hiện gọn ở trang "Thông tin sản phẩm" trong báo giá.</p>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="label-field mb-1.5">Giá theo số lượng <span className="text-ink-faint">(để trống = dùng giá lẻ)</span></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <span className="mb-1 block text-xs text-ink-soft">10 – 100 {form.unit}</span>
                <input className="input-field py-1.5" type="number" placeholder="Giá ₫" value={form.price_t1} onChange={set('price_t1')} />
              </div>
              <div>
                <span className="mb-1 block text-xs text-ink-soft">101 – 300 {form.unit}</span>
                <input className="input-field py-1.5" type="number" placeholder="Giá ₫" value={form.price_t2} onChange={set('price_t2')} />
              </div>
              <div>
                <span className="mb-1 block text-xs text-ink-soft">&gt; 300 {form.unit}</span>
                <input className="input-field py-1.5" type="number" placeholder="Giá ₫" value={form.price_t3} onChange={set('price_t3')} />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">Khi tạo báo giá, nhập số lượng sẽ tự nhảy giá theo bậc. SL &lt; 10 dùng giá bậc 10–100. Vẫn sửa tay được.</p>
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

/* ============================ TAB SET QUÀ ============================ */
function SetsTab({ sets, products, loading, reload, user }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_SET)
  const [editId, setEditId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [picker, setPicker] = useState('')
  const fileRef = useRef(null)
  const galleryRef = useRef(null)

  const openNew = () => { setForm(EMPTY_SET); setEditId(null); setPicker(''); setOpen(true) }
  const openEdit = (r) => { setForm({ ...EMPTY_SET, ...r, items: r.items || [], gallery: r.gallery || [] }); setEditId(r.id); setPicker(''); setOpen(true) }

  const componentsTotal = (items) => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const effectivePrice = (f) => f.auto_price ? componentsTotal(f.items) : (Number(f.price) || 0)

  const save = async () => {
    if (!form.name.trim()) { alert('Nhập tên set quà'); return }
    if (form.items.length < 1) { alert('Set quà cần ít nhất 1 sản phẩm'); return }
    if (form.items.length > 3) { alert('Set quà tối đa 3 sản phẩm'); return }
    const payload = {
      user_id: user.id, name: form.name, short_name: form.short_name, invoice_name: form.invoice_name,
      sku: form.sku, unit: form.unit, auto_price: form.auto_price,
      price: effectivePrice(form),
      items: form.items.map((it) => ({
        product_id: it.product_id, name: it.name, sku: it.sku || '',
        qty: Number(it.qty) || 1, price: Number(it.price) || 0, image_url: it.image_url || '',
        base_price: it.base_price ?? (Number(it.price) || 0),
        price_t1: it.price_t1 ?? null, price_t2: it.price_t2 ?? null, price_t3: it.price_t3 ?? null,
      })),
      description: form.description, image_url: form.image_url,
      gallery: (form.gallery || []).filter(Boolean).slice(0, 3),
    }
    const { error } = editId
      ? await supabase.from('crm_gift_sets').update(payload).eq('id', editId)
      : await supabase.from('crm_gift_sets').insert(payload)
    if (error) {
      alert('Lưu thất bại: ' + error.message + '\n\nNếu bảng "crm_gift_sets" chưa tồn tại, chạy supabase_migration_giftsets.sql.')
      return
    }
    setOpen(false); reload()
  }

  const remove = async (id) => {
    if (!confirm('Xóa set quà này?')) return
    await supabase.from('crm_gift_sets').delete().eq('id', id); reload()
  }

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const img = await compressSetImage(file); setForm((f) => ({ ...f, image_url: img })) }
    catch (err) { alert('Không đọc được ảnh: ' + err.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const onPickGallery = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const img = await compressSetImage(file)
      setForm((f) => ({ ...f, gallery: [...(f.gallery || []), img].slice(0, 3) }))
    } catch (err) { alert('Không đọc được ảnh: ' + err.message) }
    finally { setUploading(false); e.target.value = '' }
  }
  const removeGallery = (i) => setForm((f) => ({ ...f, gallery: (f.gallery || []).filter((_, j) => j !== i) }))

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const addComponent = (p) => {
    if (form.items.length >= 3) { alert('Set quà tối đa 3 sản phẩm'); return }
    if (form.items.some((it) => it.product_id === p.id)) return
    setForm({
      ...form,
      items: [...form.items, {
        product_id: p.id, name: p.short_name || p.name, sku: p.sku || '',
        qty: 1, price: Number(p.base_price) || 0, image_url: p.image_url || '',
        base_price: Number(p.base_price) || 0,
        price_t1: p.price_t1 ?? null, price_t2: p.price_t2 ?? null, price_t3: p.price_t3 ?? null,
      }],
    })
    setPicker('')
  }
  const updateComp = (i, k, v) => { const items = [...form.items]; items[i] = { ...items[i], [k]: v }; setForm({ ...form, items }) }
  const removeComp = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })

  const pickMatches = picker
    ? products.filter((p) =>
        (p.name + ' ' + (p.short_name || '') + ' ' + (p.sku || '')).toLowerCase().includes(picker.toLowerCase())
        && !form.items.some((it) => it.product_id === p.id)
      ).slice(0, 6)
    : products.filter((p) => !form.items.some((it) => it.product_id === p.id)).slice(0, 6)

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openNew} disabled={products.length < 1}><Plus size={16} /> Tạo set quà</button>
      </div>
      {products.length < 1 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">Cần ít nhất 1 sản phẩm trong danh mục để tạo set quà.</p>
      )}

      {loading ? <Spinner /> : sets.length === 0 ? (
        <EmptyState icon={Gift} title="Chưa có set quà nào"
          hint="Combo 1–3 sản phẩm, tự đặt tên và tự cộng giá thành phần."
          action={products.length >= 2 ? <button className="btn-primary" onClick={openNew}><Plus size={16} /> Tạo set quà</button> : null} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sets.map((s) => (
            <div key={s.id} className="card overflow-hidden">
              {s.image_url ? (
                <div className="aspect-video w-full overflow-hidden bg-paper"><img src={s.image_url} alt={s.name} className="h-full w-full object-contain" /></div>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-paper/50 text-ink-faint"><Gift size={28} /></div>
              )}
              <div className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand"><Gift size={10} /> SET QUÀ</span>
                    <h3 className="font-display font-600 text-ink truncate">{s.name}</h3>
                    {s.sku && <p className="text-xs text-ink-faint">Mã: {s.sku}</p>}
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink"><Pencil size={14} /></button>
                    <button onClick={() => remove(s.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-lg font-700 text-brand">{formatVND(s.price)} <span className="text-xs font-normal text-ink-faint">/ {s.unit}</span></p>
                <div className="mt-3 border-t border-paper-line pt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Gồm {s.items?.length || 0} sản phẩm</p>
                  <div className="space-y-1">
                    {(s.items || []).map((it, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-ink-soft truncate">{it.qty}× {it.name}</span>
                        <span className="font-medium text-ink whitespace-nowrap">{formatVND((Number(it.qty) || 0) * (Number(it.price) || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} wide title={editId ? 'Sửa set quà' : 'Tạo set quà'}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Ảnh set */}
          <div>
            <label className="label-field">Ảnh set quà</label>
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
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex w-full flex-col items-center gap-2 py-8 text-ink-faint hover:text-brand">
                  <Upload size={24} />
                  <span className="text-xs">{uploading ? 'Đang xử lý...' : 'Bấm để chọn ảnh'}</span>
                  <span className="text-[10px] text-ink-faint">Ảnh đại diện set</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </div>
          </div>

          {/* Thông tin set */}
          <div className="space-y-3 md:col-span-2">
            <div>
              <label className="label-field">Tên set quà *</label>
              <input className="input-field" value={form.name} onChange={set('name')} placeholder="VD: Set quà Tết Doanh nhân" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-field">Tên rút gọn <span className="text-ink-faint">(hiện trong báo giá)</span></label>
                <input className="input-field" value={form.short_name} onChange={set('short_name')} placeholder="VD: Set quà Tết" />
              </div>
              <div>
                <label className="label-field">Tên trên hóa đơn</label>
                <input className="input-field" value={form.invoice_name} onChange={set('invoice_name')} placeholder="VD: Bộ quà tặng công nghệ" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">Mã set (SKU)</label><input className="input-field" value={form.sku} onChange={set('sku')} placeholder="VD: SET-TET-01" /></div>
              <div><label className="label-field">Đơn vị</label><input className="input-field" value={form.unit} onChange={set('unit')} /></div>
            </div>
          </div>

          {/* Chọn sản phẩm thành phần */}
          <div className="md:col-span-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Sản phẩm trong set <span className="text-ink-faint">(1–3 sản phẩm)</span></label>
              <span className="text-xs text-ink-faint">{form.items.length}/3</span>
            </div>

            <div className="space-y-2">
              {form.items.length === 0 && <p className="text-xs text-ink-faint">Chưa chọn sản phẩm nào. Tìm và bấm ở ô dưới.</p>}
              {form.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-paper-line bg-paper/30 px-2 py-1.5">
                  {it.image_url
                    ? <img src={it.image_url} alt="" className="h-9 w-9 rounded object-contain bg-white" />
                    : <div className="flex h-9 w-9 items-center justify-center rounded bg-white text-ink-faint"><ImgIcon size={14} /></div>}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{it.name}</span>
                  <span className="text-xs text-ink-soft">SL</span>
                  <input className="input-field w-16 py-1 text-center text-sm" type="number" min="1" value={it.qty} onChange={(e) => updateComp(i, 'qty', e.target.value)} />
                  <span className="text-xs text-ink-soft">Giá</span>
                  <input className="input-field w-28 py-1 text-right text-sm" type="number" value={it.price} onChange={(e) => updateComp(i, 'price', e.target.value)} />
                  <button onClick={() => removeComp(i)} className="rounded-lg p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"><X size={15} /></button>
                </div>
              ))}
            </div>

            {form.items.length < 3 && (
              <div className="mt-2">
                <input className="input-field" value={picker} onChange={(e) => setPicker(e.target.value)} placeholder="Tìm sản phẩm để thêm vào set..." />
                {pickMatches.length > 0 && (
                  <div className="mt-1 overflow-hidden rounded-lg border border-paper-line">
                    {pickMatches.map((p) => (
                      <button key={p.id} onClick={() => addComponent(p)} className="flex w-full items-center gap-2 border-b border-paper-line px-3 py-2 text-left last:border-0 hover:bg-paper">
                        {p.image_url
                          ? <img src={p.image_url} alt="" className="h-8 w-8 rounded object-contain bg-white" />
                          : <div className="flex h-8 w-8 items-center justify-center rounded bg-paper text-ink-faint"><ImgIcon size={13} /></div>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{p.short_name || p.name}</p>
                          <p className="text-[11px] text-ink-faint">{[p.sku, formatVND(p.base_price)].filter(Boolean).join('  •  ')}</p>
                        </div>
                        <Plus size={15} className="text-brand" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ảnh minh họa thêm cho set (tối đa 3, hiện ở trang Thông tin sản phẩm) */}
          <div className="md:col-span-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-field mb-0">Ảnh minh họa set <span className="text-ink-faint">(tối đa 3 — hiện ở trang Thông tin sản phẩm)</span></label>
              <span className="text-xs text-ink-faint">{(form.gallery || []).length}/3</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {(form.gallery || []).map((g, i) => (
                <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-paper-line bg-paper">
                  <img src={g} alt="" className="h-full w-full object-contain" />
                  <button onClick={() => removeGallery(i)} className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-ink-faint hover:text-rose-600"><X size={13} /></button>
                </div>
              ))}
              {(form.gallery || []).length < 3 && (
                <button onClick={() => galleryRef.current?.click()} disabled={uploading}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-paper-line text-ink-faint hover:text-brand">
                  <Upload size={18} />
                  <span className="text-[10px]">{uploading ? '...' : 'Thêm ảnh'}</span>
                </button>
              )}
              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPickGallery} />
            </div>
          </div>

          {/* Giá set */}
          <div className="md:col-span-3 rounded-lg bg-paper p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={form.auto_price} onChange={(e) => setForm({ ...form, auto_price: e.target.checked })} className="h-4 w-4 accent-brand" />
              Tự động cộng giá thành phần
            </label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-soft">Tổng giá thành phần</span>
              <span className="font-medium text-ink">{formatVND(componentsTotal(form.items))}</span>
            </div>
            {form.auto_price ? (
              <div className="mt-2 flex items-center justify-between border-t border-paper-line pt-2">
                <span className="text-base font-700 text-ink">Đơn giá set (chưa VAT)</span>
                <span className="text-base font-700 text-brand">{formatVND(componentsTotal(form.items))}</span>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between border-t border-paper-line pt-2">
                <span className="text-base font-700 text-ink">Đơn giá set (chưa VAT)</span>
                <input className="input-field w-40 text-right font-700" type="number" value={form.price} onChange={set('price')} placeholder="Nhập giá tay" />
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            <label className="label-field">Thông số / mô tả set (tùy chọn)</label>
            <textarea className="input-field min-h-[80px]" value={form.description} onChange={set('description')}
              placeholder="Mô tả chung của set quà, hiện ở trang Thông tin sản phẩm trong báo giá." />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu' : 'Tạo set'}</button>
        </div>
      </Modal>
    </div>
  )
}
