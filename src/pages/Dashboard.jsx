import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Store, KanbanSquare, FileText, TrendingUp, Clock, ArrowRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PIPELINE_STAGES, getStatusMeta, formatVND, formatDate } from '../lib/constants'
import { Spinner, PageHeader, Badge } from '../components/ui'

function StatCard({ icon: Icon, label, value, sub, onClick }) {
  return (
    <button onClick={onClick}
      className="card group flex items-center gap-4 p-5 text-left transition hover:shadow-float">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand">
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-700 text-ink">{value}</p>
        <p className="text-sm text-ink-soft">{label}</p>
      </div>
      {sub && <span className="text-xs text-ink-faint">{sub}</span>}
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ customers: [], deals: [], quotes: [], interactions: [] })

  useEffect(() => {
    (async () => {
      const [c, d, q, i] = await Promise.all([
        supabase.from('crm_customers').select('*'),
        supabase.from('crm_deals').select('*'),
        supabase.from('crm_quotes').select('*'),
        supabase.from('crm_interactions').select('*'),
      ])
      setData({ customers: c.data || [], deals: d.data || [], quotes: q.data || [], interactions: i.data || [] })
      setLoading(false)
    })()
  }, [])

  if (loading) return <Spinner />

  const { customers, deals, quotes, interactions } = data
  const b2b = customers.filter((c) => c.segment === 'b2b').length
  const retail = customers.filter((c) => c.segment === 'retail').length
  const openDeals = deals.filter((d) => !['won', 'lost'].includes(d.stage))
  const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const wonValue = deals.filter((d) => d.stage === 'won').reduce((s, d) => s + (Number(d.value) || 0), 0)

  const today = new Date().toISOString().slice(0, 10)
  const followUps = interactions
    .filter((r) => r.follow_up_date && !r.done)
    .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date))
    .slice(0, 6)
  const custName = (id) => customers.find((c) => c.id === id)?.company_name || '—'

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Tổng quan hoạt động kinh doanh" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Khách B2B" value={b2b} onClick={() => navigate('/customers/b2b')} />
        <StatCard icon={Store} label="Khách Retail" value={retail} onClick={() => navigate('/customers/retail')} />
        <StatCard icon={KanbanSquare} label="Cơ hội đang mở" value={openDeals.length} onClick={() => navigate('/pipeline')} />
        <StatCard icon={FileText} label="Báo giá đã tạo" value={quotes.length} onClick={() => navigate('/quotes')} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-brand"><TrendingUp size={18} /><span className="font-display font-600 text-ink">Giá trị Pipeline</span></div>
          <p className="mt-3 text-3xl font-700 text-ink">{formatVND(pipelineValue)}</p>
          <p className="text-sm text-ink-soft">đang theo đuổi · đã chốt {formatVND(wonValue)}</p>
          <div className="mt-4 space-y-2">
            {PIPELINE_STAGES.filter((s) => s.value !== 'lost').map((s) => {
              const items = deals.filter((d) => d.stage === s.value)
              const val = items.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
              const max = Math.max(pipelineValue + wonValue, 1)
              return (
                <div key={s.value}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span className="text-ink-soft">{s.label} ({items.length})</span>
                    <span className="font-medium text-ink">{formatVND(val)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full" style={{ width: `${(val / max) * 100}%`, background: s.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand"><Clock size={18} /><span className="font-display font-600 text-ink">Cần follow-up</span></div>
            <button onClick={() => navigate('/interactions')} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Xem tất cả <ArrowRight size={13} /></button>
          </div>
          {followUps.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-faint">Không có lịch follow-up nào.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {followUps.map((r) => {
                const over = r.follow_up_date < today
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-paper-line px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-ink">{custName(r.customer_id)}</p>
                      {r.summary && <p className="text-xs text-ink-faint line-clamp-1">{r.summary}</p>}
                    </div>
                    <Badge className={over ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-paper text-ink-soft border-paper-line'}>
                      {formatDate(r.follow_up_date)}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Báo giá gần đây */}
      <div className="mt-4 card p-5">
        <div className="flex items-center justify-between">
          <span className="font-display font-600 text-ink">Báo giá gần đây</span>
          <button onClick={() => navigate('/quotes')} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Tạo báo giá <ArrowRight size={13} /></button>
        </div>
        {quotes.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-faint">Chưa có báo giá nào.</p>
        ) : (
          <div className="mt-3 divide-y divide-paper-line">
            {quotes.slice(0, 5).map((q) => {
              const sub = (q.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
              const total = (sub - (Number(q.discount) || 0)) * (1 + (Number(q.vat_percent) || 0) / 100)
              return (
                <div key={q.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{q.company_name}</p>
                    <p className="font-mono text-xs text-ink-faint">{q.quote_number}</p>
                  </div>
                  <span className="text-sm font-semibold text-ink">{formatVND(total)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
