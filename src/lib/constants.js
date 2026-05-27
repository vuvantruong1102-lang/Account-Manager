// Loại khách hàng với badge màu
export const CUSTOMER_TYPES = [
  { value: 'mice', label: 'Công ty MICE', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'corporate', label: 'Corporate', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'event', label: 'Công ty Event', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'agency', label: 'Agency / Quà tặng', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'retail', label: 'Bán lẻ', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'other', label: 'Khác', color: 'bg-gray-100 text-gray-600 border-gray-200' },
]

export const getTypeMeta = (value) =>
  CUSTOMER_TYPES.find((t) => t.value === value) || CUSTOMER_TYPES[CUSTOMER_TYPES.length - 1]

// Phân khúc
export const SEGMENTS = [
  { value: 'b2b', label: 'B2B' },
  { value: 'retail', label: 'Retail' },
]

// Trạng thái khách hàng
export const CONTACT_STATUSES = [
  { value: 'new', label: 'Chưa liên hệ', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'lost', label: 'Không tiềm năng', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'partner', label: 'Đã hợp tác', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'working', label: 'Đang làm việc', color: 'bg-amber-100 text-amber-700 border-amber-200' },
]

export const getStatusMeta = (value) =>
  CONTACT_STATUSES.find((s) => s.value === value) || CONTACT_STATUSES[0]

// Kênh chào hàng
export const CHANNELS = [
  { value: 'email', label: 'Email', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'zalo', label: 'Zalo', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'call', label: 'Call', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'facebook', label: 'Facebook', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'other', label: 'Khác', color: 'bg-gray-100 text-gray-600 border-gray-200' },
]

export const getChannelMeta = (value) =>
  CHANNELS.find((c) => c.value === value) || CHANNELS[0]

// Giai đoạn pipeline (Kanban)
export const PIPELINE_STAGES = [
  { value: 'lead', label: 'Tiềm năng', color: '#9aa0ad' },
  { value: 'contacted', label: 'Đã liên hệ', color: '#3b82f6' },
  { value: 'quoted', label: 'Đã báo giá', color: '#f59e0b' },
  { value: 'negotiating', label: 'Đàm phán', color: '#8b5cf6' },
  { value: 'won', label: 'Chốt đơn', color: '#10b981' },
  { value: 'lost', label: 'Thất bại', color: '#ef4444' },
]

// Loại tương tác
export const INTERACTION_TYPES = [
  { value: 'call', label: 'Gọi điện' },
  { value: 'email', label: 'Email' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'meeting', label: 'Gặp mặt' },
  { value: 'note', label: 'Ghi chú' },
]

export const formatVND = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString('vi-VN') + ' ₫'
}

export const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
