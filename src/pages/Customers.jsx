import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Building2, Store, Phone, Mail, MapPin, X, Download, Filter } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  CUSTOMER_TYPES, getTypeMeta, CONTACT_STATUSES, getStatusMeta, SALES_STATUSES, getSalesStatusMeta,
} from '../lib/constants'
import { Badge, Modal, EmptyState, Spinner, PageHeader } from '../components/ui'

const todayISO = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  company_name: '', address: '', phone: '', tax_code: '', website: '',
  contact_person: '', contact_email: '', contact_phone: '',
  customer_type: 'corporate', suitable_products: '',
  contact_status: 'not_partner', sales_status: 'new', notes: '',
  sales_history: [],
}

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d) ? iso : d.toLocaleDateString('vi-VN')
}

export default function Customers({ segment }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  // Lọc theo cột
  const [filterType, setFilterType] = useState('')      // Loại công ty
  const [filterContact, setFilterContact] = useState('') // Tình trạng hợp tác
  const [filterSales, setFilterSales] = useState('')    // Trạng thái sales
  const [showFilters, setShowFilters] = useState(false)

  const isRetail = segment === 'retail'

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('segment', segment)
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [segment])

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (row) => {
    setForm({ ...EMPTY, ...row, sales_history: Array.isArray(row.sales_history) ? row.sales_history : [] })
    setEditId(row.id); setOpen(true)
  }

  const save = async () => {
    if (!form.company_name.trim()) return
    const payload = {
      segment, user_id: user.id,
      company_name: form.company_name, address: form.address, phone: form.phone,
      tax_code: form.tax_code, website: form.website, contact_person: form.contact_person,
      contact_email: form.contact_email, contact_phone: form.contact_phone,
      customer_type: form.customer_type, suitable_products: form.suitable_products,
      contact_status: form.contact_status, sales_status: form.sales_status,
      notes: form.notes,
      sales_history: (form.sales_history || []).filter((s) => s.product || s.qty || s.date),
    }
    const { error } = editId
      ? await supabase.from('crm_customers').update(payload).eq('id', editId)
      : await supabase.from('crm_customers').insert(payload)
    if (error) {
      alert('Lưu thất bại: ' + error.message + '\n\nNếu lỗi nhắc đến cột "sales_history" hoặc "sales_status", bạn cần chạy file supabase_migration.sql trong Supabase SQL Editor.')
      return
    }
    setOpen(false); load()
  }

  const remove = async (id) => {
    if (!confirm('Xóa khách hàng này?')) return
    await supabase.from('crm_customers').delete().eq('id', id)
    load()
  }

  // Lịch sử sales — thao tác trong form
  const addHistory = () => setForm({ ...form, sales_history: [...(form.sales_history || []), { date: todayISO(), product: '', qty: '' }] })
  const updateHistory = (i, k, v) => {
    const arr = [...(form.sales_history || [])]; arr[i] = { ...arr[i], [k]: v }
    setForm({ ...form, sales_history: arr })
  }
  const removeHistory = (i) => setForm({ ...form, sales_history: (form.sales_history || []).filter((_, j) => j !== i) })

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase()
    const matchSearch = !s ||
      r.company_name?.toLowerCase().includes(s) ||
      r.contact_person?.toLowerCase().includes(s) ||
      r.phone?.includes(s) || r.tax_code?.includes(s)
    const matchType = !filterType || r.customer_type === filterType
    const matchContact = !filterContact || (r.contact_status || 'not_partner') === filterContact
    const matchSales = !filterSales || (r.sales_status || 'new') === filterSales
    return matchSearch && matchType && matchContact && matchSales
  })

  const clearFilters = () => { setFilterType(''); setFilterContact(''); setFilterSales('') }
  const hasActiveFilters = filterType || filterContact || filterSales

  // ===== Tải dữ liệu xuống =====
  const buildExportRows = () => filtered.map((r) => {
    const history = Array.isArray(r.sales_history) ? r.sales_history : []
    const historyText = history.map((h) => `${fmtDate(h.date)}: ${h.qty || ''} ${h.product || ''}`.trim()).join(' | ')
    return {
      'Tên công ty': r.company_name || '',
      'Loại công ty': getTypeMeta(r.customer_type).label,
      'Địa chỉ': r.address || '',
      'Mã số thuế': r.tax_code || '',
      'Website': r.website || '',
      'Số điện thoại': r.phone || '',
      'Người liên hệ': r.contact_person || '',
      'SĐT người liên hệ': r.contact_phone || '',
      'Email người liên hệ': r.contact_email || '',
      'Tình trạng hợp tác': getStatusMeta(r.contact_status).label,
      'Trạng thái sales': getSalesStatusMeta(r.sales_status).label,
      'Mặt hàng phù hợp': r.suitable_products || '',
      'Lịch sử sales': historyText,
      'Ghi chú': r.notes || '',
      'Ngày tạo': r.created_at ? fmtDate(r.created_at) : '',
    }
  })

  const downloadFile = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const exportExcel = () => {
    const data = buildExportRows()
    const ws = XLSX.utils.json_to_sheet(data)
    // Tự co rộng cột theo dữ liệu (giới hạn max 60)
    const cols = Object.keys(data[0] || {}).map((k) => ({
      wch: Math.min(Math.max(k.length, ...data.map((r) => String(r[k] || '').length)) + 2, 60),
    }))
    ws['!cols'] = cols
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, isRetail ? 'Retail' : 'B2B')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `khach-hang-${isRetail ? 'retail' : 'b2b'}-${stamp}.xlsx`)
  }

  const exportJSON = () => {
    // JSON giữ nguyên dữ liệu thô (cả sales_history dạng mảng) để dễ import lại
    const payload = filtered.map((r) => ({
      company_name: r.company_name, customer_type: r.customer_type,
      address: r.address, tax_code: r.tax_code, website: r.website, phone: r.phone,
      contact_person: r.contact_person, contact_phone: r.contact_phone, contact_email: r.contact_email,
      contact_status: r.contact_status, sales_status: r.sales_status,
      suitable_products: r.suitable_products, notes: r.notes,
      sales_history: Array.isArray(r.sales_history) ? r.sales_history : [],
      created_at: r.created_at,
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(blob, `khach-hang-${isRetail ? 'retail' : 'b2b'}-${stamp}.json`)
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div>
      <PageHeader
        title={isRetail ? 'Khách hàng Retail' : 'Khách hàng B2B'}
        subtitle={isRetail ? 'Danh mục khách bán lẻ' : 'Danh mục khách doanh nghiệp'}
        action={
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={exportExcel} title="Tải Excel">
              <Download size={15} /> Excel
            </button>
            <button className="btn-ghost" onClick={exportJSON} title="Tải JSON">
              <Download size={15} /> JSON
            </button>
            <button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm khách hàng</button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input-field pl-9" placeholder="Tìm tên công ty, người liên hệ, SĐT, MST..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            hasActiveFilters || showFilters
              ? 'border-brand bg-brand-50 text-brand'
              : 'border-paper-line text-ink-soft hover:bg-paper'
          }`}>
          <Filter size={15} /> Lọc
          {hasActiveFilters && <span className="ml-1 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{[filterType, filterContact, filterSales].filter(Boolean).length}</span>}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-sm text-ink-faint hover:text-rose-600">Xóa lọc</button>
        )}
        <span className="text-sm text-ink-soft">{filtered.length} / {rows.length} khách hàng</span>
      </div>

      {/* Panel bộ lọc */}
      {showFilters && (
        <div className="mb-4 rounded-lg border border-paper-line bg-paper/40 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="label-field">Loại công ty</label>
              <select className="input-field" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">Tất cả</option>
                {CUSTOMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Tình trạng hợp tác</label>
              <select className="input-field" value={filterContact} onChange={(e) => setFilterContact(e.target.value)}>
                <option value="">Tất cả</option>
                {CONTACT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Trạng thái sales</label>
              <select className="input-field" value={filterSales} onChange={(e) => setFilterSales(e.target.value)}>
                <option value="">Tất cả</option>
                {SALES_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={isRetail ? Store : Building2}
          title="Chưa có khách hàng nào"
          hint="Bấm “Thêm khách hàng” để tạo bản ghi đầu tiên."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Thêm khách hàng</button>} />
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper/60 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Công ty</th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">Loại</th>
                <th className="px-5 py-3 font-semibold">Người liên hệ</th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">Hợp tác</th>
                <th className="px-5 py-3 font-semibold">Lịch sử sales</th>
                <th className="px-5 py-3 font-semibold">Ghi chú</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const tm = getTypeMeta(r.customer_type)
                const sm = getStatusMeta(r.contact_status)
                const history = Array.isArray(r.sales_history) ? r.sales_history : []
                return (
                  <tr key={r.id} className="border-b border-paper-line last:border-0 align-top hover:bg-paper/40">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink">{r.company_name}</p>
                      {r.address && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-ink-faint">
                          <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                          <span>{r.address}</span>
                        </p>
                      )}
                      {r.tax_code && (
                        <p className="mt-0.5 text-xs text-ink-faint">MST: {r.tax_code}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><Badge className={`${tm.color} whitespace-nowrap`}>{tm.label}</Badge></td>
                    <td className="px-5 py-3.5">
                      <p className="text-ink">{r.contact_person || '—'}</p>
                      {r.contact_phone && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                          <Phone size={11} className="flex-shrink-0" />
                          <span>{r.contact_phone}</span>
                        </p>
                      )}
                      {r.contact_email && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                          <Mail size={11} className="flex-shrink-0" />
                          <span>{r.contact_email}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><Badge className={sm.color}>{sm.label}</Badge></td>
                    <td className="px-5 py-3.5 min-w-[220px] max-w-[300px]">
                      {history.length === 0 ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        <ul className="space-y-0.5 text-xs leading-relaxed">
                          {history.slice(0, 4).map((h, i) => (
                            <li key={i} className="text-ink-soft">
                              <span className="text-ink-faint">{fmtDate(h.date)}:</span> {h.qty} {h.product}
                            </li>
                          ))}
                          {history.length > 4 && <li className="text-ink-faint italic">+ {history.length - 4} lần khác</li>}
                        </ul>
                      )}
                    </td>
                    <td className="px-5 py-3.5 min-w-[180px] max-w-[260px] text-xs leading-relaxed text-ink-soft whitespace-pre-wrap">
                      {r.notes || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
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

      <Modal open={open} onClose={() => setOpen(false)} wide
        title={editId ? 'Sửa khách hàng' : 'Thêm khách hàng'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label-field">Tên công ty *</label>
            <input className="input-field" value={form.company_name} onChange={set('company_name')} />
          </div>
          <div className="col-span-2">
            <label className="label-field">Địa chỉ</label>
            <input className="input-field" value={form.address} onChange={set('address')} />
          </div>
          <div>
            <label className="label-field">Số điện thoại</label>
            <input className="input-field" value={form.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="label-field">Mã số thuế</label>
            <input className="input-field" value={form.tax_code} onChange={set('tax_code')} />
          </div>
          <div className="col-span-2">
            <label className="label-field">Website công ty</label>
            <input className="input-field" value={form.website} onChange={set('website')} placeholder="VD: https://congty.com" />
          </div>
          <div>
            <label className="label-field">Người liên hệ</label>
            <input className="input-field" value={form.contact_person} onChange={set('contact_person')} />
          </div>
          <div>
            <label className="label-field">SĐT người liên hệ</label>
            <input className="input-field" value={form.contact_phone} onChange={set('contact_phone')} />
          </div>
          <div className="col-span-2">
            <label className="label-field">Email người liên hệ</label>
            <input className="input-field" value={form.contact_email} onChange={set('contact_email')} />
          </div>
          <div>
            <label className="label-field">Loại công ty</label>
            <select className="input-field" value={form.customer_type} onChange={set('customer_type')}>
              {CUSTOMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Tình trạng hợp tác</label>
            <select className="input-field" value={form.contact_status} onChange={set('contact_status')}>
              {CONTACT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Trạng thái sales</label>
            <select className="input-field" value={form.sales_status} onChange={set('sales_status')}>
              {SALES_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Lịch sử sales */}
          <div className="col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="label-field mb-0">Lịch sử sales</label>
              <button type="button" onClick={addHistory} className="text-xs font-semibold text-brand hover:underline">+ Thêm lần sale</button>
            </div>
            {(form.sales_history || []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-paper-line px-3 py-3 text-xs text-ink-faint">
                Chưa có lần sale nào. Bấm "+ Thêm lần sale" để ghi nhận.
              </p>
            ) : (
              <div className="space-y-2">
                {form.sales_history.map((h, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2">
                    <input type="date" className="input-field col-span-3 py-2 text-sm"
                      value={h.date || ''} onChange={(e) => updateHistory(i, 'date', e.target.value)} />
                    <input className="input-field col-span-2 py-2 text-sm" placeholder="Số lượng"
                      value={h.qty || ''} onChange={(e) => updateHistory(i, 'qty', e.target.value)} />
                    <input className="input-field col-span-6 py-2 text-sm" placeholder="Mặt hàng (VD: 500 ổ điện OL212)"
                      value={h.product || ''} onChange={(e) => updateHistory(i, 'product', e.target.value)} />
                    <button type="button" onClick={() => removeHistory(i)}
                      className="col-span-1 flex justify-center rounded-lg p-2 text-ink-faint hover:bg-rose-50 hover:text-rose-600">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="label-field">Mặt hàng phù hợp <span className="text-ink-faint">(tham khảo)</span></label>
            <input className="input-field" value={form.suitable_products} onChange={set('suitable_products')}
              placeholder="VD: Sạc dự phòng, ổ điện du lịch, sạc dây rút..." />
          </div>
          <div className="col-span-2">
            <label className="label-field">Ghi chú</label>
            <textarea className="input-field min-h-[70px]" value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Hủy</button>
          <button className="btn-primary" onClick={save}>{editId ? 'Lưu thay đổi' : 'Thêm mới'}</button>
        </div>
      </Modal>
    </div>
  )
}
