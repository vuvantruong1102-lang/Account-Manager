import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquareText, PhoneCall, Building2, Store,
  KanbanSquare, History, Package, FileText, LogOut, Target,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { section: 'Bán hàng' },
  { to: '/sales', label: 'Sales', icon: Target },
  { to: '/pipeline', label: 'Pipeline cơ hội', icon: KanbanSquare },
  { to: '/quotes', label: 'Báo giá nhanh', icon: FileText },
  { to: '/interactions', label: 'Lịch sử & Follow-up', icon: History },
  { section: 'Khách hàng' },
  { to: '/customers/b2b', label: 'Khách hàng B2B', icon: Building2 },
  { to: '/customers/retail', label: 'Khách hàng Retail', icon: Store },
  { section: 'Kho nội dung' },
  { to: '/templates', label: 'Mẫu chào hàng', icon: MessageSquareText },
  { to: '/scripts', label: 'Kịch bản Sales Call', icon: PhoneCall },
  { to: '/products', label: 'Sản phẩm & Bảng giá', icon: Package },
]

export default function Sidebar() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-paper-line bg-white">
      <div className="px-5 py-5">
        <img src="/logo-mark.png" alt="Yokool" className="h-7 w-auto" />
        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">B2B CRM</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV.map((item, i) =>
          item.section ? (
            <p key={i} className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {item.section}
            </p>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand'
                    : 'text-ink-soft hover:bg-paper hover:text-ink'
                }`
              }
            >
              <item.icon size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          )
        )}
      </nav>

      <div className="border-t border-paper-line p-3">
        <div className="mb-2 px-2 text-xs text-ink-faint truncate">{user?.email}</div>
        <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-paper hover:text-brand">
          <LogOut size={18} />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
