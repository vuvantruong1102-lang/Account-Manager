import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        {/* Topbar — chỉ hiện trên mobile */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-paper-line bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-ink-soft hover:bg-paper">
            <Menu size={20} />
          </button>
          <img src="/logo-mark.png" alt="Yokool" className="h-6 w-auto" />
          <span className="text-sm font-semibold text-ink">B2B CRM</span>
        </div>
        <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
