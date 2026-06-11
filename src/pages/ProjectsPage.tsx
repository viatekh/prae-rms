import { useState, useEffect } from 'react'
import { Plus, Search, ChevronRight, Copy, LogOut, AlertCircle, Package, ChevronDown } from 'lucide-react'
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/shared/Toast'
import { useProjects, useCreateProject, useNextProjectNumber, incrementProjectNumber } from '../hooks/useProjects'
import { useClients, useCreateClient } from '../hooks/useClients'
import type { Project, ProjectStatus } from '../types'
import { Button } from '../components/shared/Button'
import { Input } from '../components/shared/Input'
import { Modal } from '../components/shared/Modal'
import { StatusBadge } from '../components/shared/Badge'
import { useUpdateProject } from '../hooks/useProjects'

const STATUS_ORDER: ProjectStatus[] = ['draft', 'sent', 'confirmed', 'invoiced', 'completed']

function autoRef(name: string, nextNumber: string): string {
  const numPart = nextNumber.split('-').pop() || '00001'
  const abbr = name.trim().split(/\s+/).slice(0, 4).map(w => w[0]?.toUpperCase() || '').join('')
  return abbr ? `${abbr}-${numPart}` : nextNumber
}

function NewProjectModal({ open, onClose, onCreate }: {
  open: boolean
  onClose: () => void
  onCreate: (project: Omit<Project, 'id' | 'created_at' | 'client' | 'line_items'>) => void
}) {
  const { data: nextNumber } = useNextProjectNumber()
  const { data: clients = [], refetch: refetchClients } = useClients()
  const createClient = useCreateClient()
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [ref, setRef] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientCompany, setNewClientCompany] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')

  useEffect(() => {
    if (nextNumber) setRef(autoRef(name, nextNumber))
  }, [name, nextNumber])

  const reset = () => { setName(''); setClientId(''); setRef(''); setShowNewClient(false); setNewClientName(''); setNewClientCompany(''); setNewClientEmail('') }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="New project" size="sm">
      <form onSubmit={e => {
        e.preventDefault()
        onCreate({
          project_number: ref || nextNumber || 'QUOTE-00001',
          name,
          client_id: clientId || null,
          status: 'draft',
          location: null,
          delivery_address: null,
          event_date: null,
          delivery_date: null,
          collection_date: null,
          client_collects: false,
          client_returns: false,
          delivery_mode: null,
          collection_mode: null,
          delivery_notes: null,
          collection_notes: null,
          expiry_date: null,
          po_number: null,
          deposit_amount: null,
          deposit_paid: false,
          overall_discount_pct: 0,
          check_out_at: null,
          check_in_at: null,
          damage_notes: null,
          notes: null,
          client_notes: null,
        })
        reset()
      }} className="space-y-4">
        <Input label="Project name *" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Summer Party at Brixton Academy" />
        <Input label="Reference *" value={ref} onChange={e => setRef(e.target.value)} required placeholder="Auto-generated from name" />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Client</label>
          <div className="flex gap-1.5">
            <select className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">No client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </select>
            <button type="button" onClick={() => setShowNewClient(v => !v)} className="px-2 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0">+ New</button>
          </div>
          {showNewClient && (
            <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <input className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" placeholder="Name *" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
              <input className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" placeholder="Company" value={newClientCompany} onChange={e => setNewClientCompany(e.target.value)} />
              <input className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" placeholder="Email" type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <button type="button" className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setShowNewClient(false)}>Cancel</button>
                <button type="button" className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700"
                  onClick={async () => {
                    if (!newClientName.trim()) return
                    const client = await createClient.mutateAsync({ name: newClientName.trim(), company: newClientCompany || null, email: newClientEmail || null, phone: null, address: null, billing_address: null, credit_terms: null, notes: null })
                    await refetchClients()
                    setClientId(client.id)
                    setShowNewClient(false)
                    setNewClientName(''); setNewClientCompany(''); setNewClientEmail('')
                  }}
                >Save client</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => { onClose(); reset() }}>Cancel</Button>
          <Button type="submit" disabled={!name}>Create project</Button>
        </div>
      </form>
    </Modal>
  )
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft:     'text-gray-600',
  sent:      'text-blue-700',
  confirmed: 'text-green-700',
  invoiced:  'text-yellow-700',
  completed: 'text-purple-700',
}

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.project_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.client?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const toast = useToast()

  const handleCreate = async (data: Omit<Project, 'id' | 'created_at' | 'client' | 'line_items'>) => {
    try {
      const created = await createProject.mutateAsync(data)
      await incrementProjectNumber(qc)
      setShowNew(false)
      navigate(`/projects/${created.id}`)
    } catch (e: any) {
      toast(e?.message || 'Failed to create project', 'error')
    }
  }

  const handleDuplicate = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      // Explicitly pick only DB scalar fields — never spread relation objects
      const newProject = await createProject.mutateAsync({
        project_number: `COPY-${project.project_number}`,
        name: `${project.name} (copy)`,
        client_id: project.client_id,
        status: 'draft',
        location: project.location,
        delivery_address: project.delivery_address,
        event_date: project.event_date,
        delivery_date: project.delivery_date,
        collection_date: project.collection_date,
        client_collects: project.client_collects,
        client_returns: project.client_returns,
        delivery_mode: project.delivery_mode,
        collection_mode: project.collection_mode,
        delivery_notes: project.delivery_notes,
        collection_notes: project.collection_notes,
        expiry_date: null,
        po_number: null,
        deposit_amount: null,
        deposit_paid: false,
        overall_discount_pct: project.overall_discount_pct ?? 0,
        check_out_at: null,
        check_in_at: null,
        damage_notes: null,
        notes: project.notes,
        client_notes: project.client_notes,
      })
      await incrementProjectNumber(qc)
      navigate(`/projects/${newProject.id}`)
    } catch (e: any) {
      toast(e?.message || 'Failed to duplicate project', 'error')
    }
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} projects</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={16} />New project</Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(['all', ...STATUS_ORDER] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.map((project, idx) => {
            const kitCount = (project.line_items || []).filter((l: any) => !l.is_component).length
            const eventDate = project.event_date ? parseISO(project.event_date) : null
            const today = startOfDay(new Date())
            const daysUntil = eventDate ? differenceInDays(startOfDay(eventDate), today) : null
            const isExpired = project.expiry_date && project.status === 'sent' && new Date(project.expiry_date) < new Date()

            let eventLabel = ''
            let eventColor = 'text-gray-400'
            if (daysUntil !== null) {
              if (daysUntil < 0) { eventLabel = `${Math.abs(daysUntil)}d ago`; eventColor = project.status === 'completed' ? 'text-gray-400' : 'text-red-500' }
              else if (daysUntil === 0) { eventLabel = 'Today'; eventColor = 'text-orange-600 font-semibold' }
              else if (daysUntil === 1) { eventLabel = 'Tomorrow'; eventColor = 'text-orange-500 font-medium' }
              else if (daysUntil <= 7) { eventLabel = `in ${daysUntil}d`; eventColor = 'text-amber-600' }
              else { eventLabel = format(eventDate!, 'd MMM yyyy'); eventColor = 'text-gray-400' }
            }

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer ${idx > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{project.name}</span>
                    <StatusBadge status={project.status} />
                    {project.check_out_at && !project.check_in_at && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        <LogOut size={10} />OUT
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
                        <AlertCircle size={10} />Quote expired
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-mono text-gray-400">{project.project_number}</span>
                    {project.client && <span className="text-xs text-gray-500">{project.client.name}</span>}
                    {project.location && <span className="text-xs text-gray-400 truncate max-w-[160px]">{project.location}</span>}
                    {kitCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
                        <Package size={10} />{kitCount} item{kitCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {eventLabel && (
                  <span className={`text-xs shrink-0 ${eventColor}`}>{eventLabel}</span>
                )}
                {/* Quick status change */}
                <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setStatusMenuId(statusMenuId === project.id ? null : project.id)}
                    className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium hover:bg-gray-100 ${STATUS_COLORS[project.status]}`}
                    title="Change status"
                  >
                    {project.status}
                    <ChevronDown size={11} />
                  </button>
                  {statusMenuId === project.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusMenuId(null)} />
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                        {STATUS_ORDER.map(s => (
                          <button key={s} onClick={async () => {
                            await updateProject.mutateAsync({ id: project.id, status: s })
                            setStatusMenuId(null)
                          }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 capitalize ${s === project.status ? 'font-medium text-gray-900 bg-gray-50' : 'text-gray-600'}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => handleDuplicate(project, e)}
                  className="p-1.5 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 shrink-0"
                  title="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">{search || statusFilter !== 'all' ? 'No projects match' : 'No projects yet'}</p>
            </div>
          )}
        </div>
      )}

      <NewProjectModal open={showNew} onClose={() => setShowNew(false)} onCreate={handleCreate} />
    </div>
  )
}
