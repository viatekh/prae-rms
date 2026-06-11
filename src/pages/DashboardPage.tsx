import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, isToday, isTomorrow, startOfMonth, endOfMonth } from 'date-fns'
import { Truck, TruckIcon, AlertCircle, TrendingUp, Package, ChevronRight } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { StatusBadge } from '../components/shared/Badge'
import { formatCurrency } from '../lib/utils'
import { calcProjectTotals } from '../lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

function useProjectsWithLines() {
  return useQuery({
    queryKey: ['projects-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(name), line_items:project_line_items(*)')
        .in('status', ['confirmed', 'sent', 'invoiced', 'completed'])
        .order('event_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as any[]
    },
    staleTime: 30_000,
  })
}

export function DashboardPage() {
  const { data: allProjects = [] } = useProjects()
  const { data: richProjects = [] } = useProjectsWithLines()

  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const departuresToday = useMemo(() =>
    allProjects.filter(p => p.delivery_date && isToday(parseISO(p.delivery_date)) && ['confirmed', 'sent', 'invoiced'].includes(p.status)),
    [allProjects])

  const returnsToday = useMemo(() =>
    allProjects.filter(p => p.collection_date && isToday(parseISO(p.collection_date)) && ['confirmed', 'sent', 'invoiced'].includes(p.status)),
    [allProjects])

  const departuresTomorrow = useMemo(() =>
    allProjects.filter(p => p.delivery_date && isTomorrow(parseISO(p.delivery_date)) && ['confirmed', 'sent', 'invoiced'].includes(p.status)),
    [allProjects])

  const inFlight = useMemo(() =>
    allProjects.filter(p => p.check_out_at && !p.check_in_at),
    [allProjects])

  const overdueCollections = useMemo(() =>
    allProjects.filter(p => {
      if (!p.collection_date || p.check_in_at || p.status === 'completed') return false
      return new Date(p.collection_date) < today && ['confirmed', 'sent', 'invoiced'].includes(p.status)
    }),
    [allProjects])

  const revenueThisMonth = useMemo(() => {
    return richProjects
      .filter(p => {
        const d = p.event_date || p.created_at
        if (!d) return false
        const date = parseISO(d)
        return date >= monthStart && date <= monthEnd && ['confirmed', 'invoiced', 'completed'].includes(p.status)
      })
      .reduce((sum, p) => {
        const lines = p.line_items || []
        const { subtotal } = calcProjectTotals(lines, p.overall_discount_pct ?? 0)
        return sum + subtotal
      }, 0)
  }, [richProjects, monthStart, monthEnd])

  const pendingQuotes = useMemo(() =>
    allProjects.filter(p => p.status === 'sent'),
    [allProjects])

  return (
    <div className="p-3 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(today, 'EEEE d MMMM yyyy')}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Departures today"
          value={departuresToday.length}
          icon={<Truck size={18} className="text-blue-600" />}
          color="blue"
          urgent={departuresToday.length > 0}
        />
        <StatCard
          label="Returns today"
          value={returnsToday.length}
          icon={<TruckIcon size={18} className="text-green-600" />}
          color="green"
        />
        <StatCard
          label="Kits out"
          value={inFlight.length}
          icon={<Package size={18} className="text-orange-600" />}
          color="orange"
        />
        <StatCard
          label={`Revenue ${format(today, 'MMM')}`}
          value={formatCurrency(revenueThisMonth)}
          icon={<TrendingUp size={18} className="text-purple-600" />}
          color="purple"
          isText
        />
      </div>

      {/* Overdue collections */}
      {overdueCollections.length > 0 && (
        <Section title="Overdue collections" icon={<AlertCircle size={15} className="text-red-500" />} titleClass="text-red-700">
          {overdueCollections.map(p => (
            <ProjectRow key={p.id} project={p} detail={p.collection_date ? `Due ${format(parseISO(p.collection_date), 'd MMM')}` : ''} detailClass="text-red-500 font-medium" />
          ))}
        </Section>
      )}

      {/* Departures today */}
      {departuresToday.length > 0 && (
        <Section title="Departing today" icon={<Truck size={15} className="text-blue-500" />}>
          {departuresToday.map(p => (
            <ProjectRow key={p.id} project={p} detail={p.delivery_date ? format(parseISO(p.delivery_date), 'HH:mm') : ''} />
          ))}
        </Section>
      )}

      {/* Returns today */}
      {returnsToday.length > 0 && (
        <Section title="Returning today" icon={<TruckIcon size={15} className="text-green-500" />}>
          {returnsToday.map(p => (
            <ProjectRow key={p.id} project={p} detail={p.collection_date ? format(parseISO(p.collection_date), 'HH:mm') : ''} />
          ))}
        </Section>
      )}

      {/* Departures tomorrow */}
      {departuresTomorrow.length > 0 && (
        <Section title="Departing tomorrow">
          {departuresTomorrow.map(p => (
            <ProjectRow key={p.id} project={p} detail={p.delivery_date ? format(parseISO(p.delivery_date), 'HH:mm') : ''} />
          ))}
        </Section>
      )}

      {/* Kits out */}
      {inFlight.length > 0 && (
        <Section title="Currently out">
          {inFlight.map(p => (
            <ProjectRow key={p.id} project={p} detail={p.check_out_at ? `Out since ${format(parseISO(p.check_out_at), 'd MMM')}` : ''} />
          ))}
        </Section>
      )}

      {/* Pending quotes */}
      {pendingQuotes.length > 0 && (
        <Section title="Pending quotes">
          {pendingQuotes.map(p => (
            <ProjectRow key={p.id} project={p} detail={p.expiry_date ? `Expires ${format(parseISO(p.expiry_date), 'd MMM')}` : ''} />
          ))}
        </Section>
      )}

      {departuresToday.length === 0 && returnsToday.length === 0 && inFlight.length === 0 && overdueCollections.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Nothing on today — enjoy the quiet.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color, urgent, isText }: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  urgent?: boolean
  isText?: boolean
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50', green: 'bg-green-50', orange: 'bg-orange-50', purple: 'bg-purple-50',
  }
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${urgent ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        <div className={`p-1.5 rounded-lg ${bg[color]}`}>{icon}</div>
      </div>
      <p className={`mt-2 font-bold text-gray-900 ${isText ? 'text-lg' : 'text-3xl'}`}>
        {value}
      </p>
    </div>
  )
}

function Section({ title, icon, children, titleClass }: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  titleClass?: string
}) {
  return (
    <div>
      <h2 className={`flex items-center gap-1.5 text-sm font-semibold mb-2 ${titleClass || 'text-gray-700'}`}>
        {icon}{title}
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function ProjectRow({ project, detail, detailClass }: { project: any; detail?: string; detailClass?: string }) {
  return (
    <Link to={`/projects/${project.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-gray-400">{project.project_number}</span>
          {project.client?.name && <span className="text-xs text-gray-500">{project.client.name}</span>}
          {project.location && <span className="text-xs text-gray-400 hidden sm:inline truncate max-w-[120px]">{project.location}</span>}
        </div>
      </div>
      {detail && <span className={`text-xs shrink-0 ${detailClass || 'text-gray-400'}`}>{detail}</span>}
      <StatusBadge status={project.status} />
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </Link>
  )
}
