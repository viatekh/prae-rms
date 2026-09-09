import { useMemo, useState } from 'react'
import { Plus, Search, ChevronRight, Copy, LogOut, AlertCircle, Package, ChevronDown } from 'lucide-react'
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../lib/toast-context'
import { errorMessage } from '../lib/errors'
import {
  useProjects, useCreateProject, useUpdateProject, useNextProjectNumber,
  reserveProjectNumber, copyLineItems, PROJECT_STATUSES, type NewProject,
} from '../hooks/useProjects'
import { useClients, useCreateClient } from '../hooks/useClients'
import type { Project, ProjectStatus } from '../types'
import { Button } from '../components/shared/Button'
import { Input } from '../components/shared/Input'
import { Select } from '../components/shared/Select'
import { Modal } from '../components/shared/Modal'
import { StatusBadge } from '../components/shared/Badge'

function autoRef(name: string, nextNumber: string): string {
  const numPart = nextNumber.split('-').pop() || '00001'
  const abbr = name.trim().split(/\s+/).slice(0, 4).map(w => w[0]?.toUpperCase() || '').join('')
  return abbr ? `${abbr}-${numPart}` : nextNumber
}

/** Every scalar column of a project, at its "new project" default. */
function blankProject(): Omit<NewProject, 'project_number' | 'name' | 'client_id'> {
  return {
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
  }
}

function NewProjectModal({ open, onClose, onCreate, creating }: {
  open: boolean
  onClose: () => void
  onCreate: (project: Omit<NewProject, 'project_number'>) => void
  creating: boolean
}) {
  const { data: nextNumber } = useNextProjectNumber()
  const { data: clients = [] } = useClients()
  const createClient = useCreateClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [ref, setRef] = useState('')
  const [refEdited, setRefEdited] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientCompany, setNewClientCompany] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')

  // Derived during render rather than mirrored into state by an effect.
  const reference = refEdited ? ref : (nextNumber ? autoRef(name, nextNumber) : '')

  const reset = () => {
    setName(''); setClientId(''); setRef(''); setRefEdited(false)
    setShowNewClient(false); setNewClientName(''); setNewClientCompany(''); setNewClientEmail('')
  }

  const close = () => { onClose(); reset() }

  const handleAddClient = async () => {
    if (!newClientName.trim()) return
    try {
      const client = await createClient.mutateAsync({
        name: newClientName.trim(),
        company: newClientCompany || null,
        email: newClientEmail || null,
        phone: null, address: null, billing_address: null, credit_terms: null, notes: null,
      })
      setClientId(client.id)
      setShowNewClient(false)
      setNewClientName(''); setNewClientCompany(''); setNewClientEmail('')
    } catch (e) {
      toast(errorMessage(e, 'Failed to add client'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={close} title="New project" size="sm" closeOnBackdrop={false}>
      <form
        onSubmit={e => {
          e.preventDefault()
          onCreate({ ...blankProject(), name: name.trim(), client_id: clientId || null })
        }}
        className="space-y-4"
      >
        <Input label="Project name *" value={name} onChange={e => setName(e.target.value)} required
          placeholder="e.g. Summer Party at Brixton Academy" autoFocus />
        <Input label="Reference" value={reference} onChange={e => { setRef(e.target.value); setRefEdited(true) }}
          placeholder="Auto-generated from name"
          hint="A project number is reserved automatically on create; this is your own label." />

        <div className="flex flex-col gap-1">
          <div className="flex gap-1.5 items-end">
            <Select label="Client" className="flex-1" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">No client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
              ))}
            </Select>
            <Button type="button" variant="secondary" size="sm" className="shrink-0 h-[38px]"
              onClick={() => setShowNewClient(v => !v)}>
              <Plus size={14} />New
            </Button>
          </div>
          {showNewClient && (
            <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <Input label="Name *" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
              <Input label="Company" value={newClientCompany} onChange={e => setNewClientCompany(e.target.value)} />
              <Input label="Email" type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewClient(false)}>Cancel</Button>
                <Button type="button" size="sm" disabled={!newClientName.trim() || createClient.isPending}
                  onClick={handleAddClient}>
                  {createClient.isPending ? 'Saving…' : 'Save client'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" disabled={!name.trim() || creating}>
            {creating ? 'Creating…' : 'Create project'}
          </Button>
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

function eventCountdown(project: Project): { label: string; className: string } | null {
  if (!project.event_date) return null
  const eventDate = parseISO(project.event_date)
  const daysUntil = differenceInDays(startOfDay(eventDate), startOfDay(new Date()))
  if (daysUntil < 0) {
    return {
      label: `${Math.abs(daysUntil)}d ago`,
      className: project.status === 'completed' ? 'text-gray-400' : 'text-red-500',
    }
  }
  if (daysUntil === 0) return { label: 'Today', className: 'text-orange-600 font-semibold' }
  if (daysUntil === 1) return { label: 'Tomorrow', className: 'text-orange-500 font-medium' }
  if (daysUntil <= 7) return { label: `in ${daysUntil}d`, className: 'text-amber-600' }
  return { label: format(eventDate, 'd MMM yyyy'), className: 'text-gray-400' }
}

export function ProjectsPage() {
  const { data: projects = [], isLoading, isError, error, refetch } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  // Search and status filter live in the URL so the view is shareable and
  // survives a back-navigation from a project.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const statusFilter = (params.get('status') as ProjectStatus | 'all') ?? 'all'
  const [showNew, setShowNew] = useState(false)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const setParam = (key: string, value: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value && value !== 'all') next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(p => {
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.project_number.toLowerCase().includes(q) ||
        (p.client?.name || '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [projects, search, statusFilter])

  const handleCreate = async (data: Omit<NewProject, 'project_number'>) => {
    try {
      // Reserve the number first so two people creating at once can't collide.
      const projectNumber = await reserveProjectNumber(qc)
      const created = await createProject.mutateAsync({ ...data, project_number: projectNumber })
      setShowNew(false)
      navigate(`/projects/${created.id}`)
    } catch (e) {
      toast(errorMessage(e, 'Failed to create project'), 'error')
    }
  }

  const handleDuplicate = async (project: Project) => {
    setBusyId(project.id)
    try {
      const projectNumber = await reserveProjectNumber(qc)
      // Explicitly pick DB scalars — never spread the joined relation objects.
      const copy = await createProject.mutateAsync({
        project_number: projectNumber,
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
      // The kit list is the bulk of a project — a copy without it was near useless.
      const copied = await copyLineItems(project.id, copy.id)
      toast(copied > 0 ? `Duplicated with ${copied} line${copied === 1 ? '' : 's'}` : 'Project duplicated')
      navigate(`/projects/${copy.id}`)
    } catch (e) {
      toast(errorMessage(e, 'Failed to duplicate project'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleStatusChange = async (project: Project, status: ProjectStatus) => {
    setStatusMenuId(null)
    if (status === project.status) return
    try {
      await updateProject.mutateAsync({ id: project.id, status })
    } catch (e) {
      toast(errorMessage(e, 'Failed to update status'), 'error')
    }
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length === projects.length
              ? `${projects.length} project${projects.length === 1 ? '' : 's'}`
              : `${filtered.length} of ${projects.length} projects`}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={16} />New project</Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            aria-label="Search projects"
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Search projects..."
            value={search}
            onChange={e => setParam('q', e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Filter by status">
          {(['all', ...PROJECT_STATUSES] as const).map(s => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setParam('status', s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
          <p className="text-sm text-red-600 mb-3">{errorMessage(error, 'Could not load projects')}</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-4 animate-pulse flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                <div className="h-2.5 bg-gray-100 rounded w-1/4" />
              </div>
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.map((project, idx) => {
            const kitCount = (project.line_items || []).filter(l => !l.is_component).length
            const countdown = eventCountdown(project)
            const isExpired = project.expiry_date && project.status === 'sent' &&
              new Date(project.expiry_date) < new Date()

            return (
              <div
                key={project.id}
                className={`flex items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-gray-50 focus-within:bg-gray-50 ${
                  idx > 0 ? 'border-t border-gray-100' : ''
                } ${busyId === project.id ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {/* A real link: middle-click, cmd-click and keyboard all work. */}
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded"
                >
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
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">{project.project_number}</span>
                    {project.client && <span className="text-xs text-gray-500">{project.client.name}</span>}
                    {project.location && (
                      <span className="text-xs text-gray-400 truncate max-w-[160px]">{project.location}</span>
                    )}
                    {kitCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
                        <Package size={10} />{kitCount} item{kitCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>

                {countdown && (
                  <span className={`text-xs shrink-0 hidden sm:inline ${countdown.className}`}>{countdown.label}</span>
                )}

                {/* Quick status change */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setStatusMenuId(statusMenuId === project.id ? null : project.id)}
                    aria-haspopup="menu"
                    aria-expanded={statusMenuId === project.id}
                    className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium hover:bg-gray-100 cursor-pointer ${STATUS_COLORS[project.status]}`}
                    title="Change status"
                  >
                    <span className="capitalize">{project.status}</span>
                    <ChevronDown size={11} />
                  </button>
                  {statusMenuId === project.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusMenuId(null)} aria-hidden="true" />
                      <div role="menu"
                        className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                        {PROJECT_STATUSES.map(s => (
                          <button key={s} type="button" role="menuitem"
                            onClick={() => handleStatusChange(project, s)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 capitalize cursor-pointer ${
                              s === project.status ? 'font-medium text-gray-900 bg-gray-50' : 'text-gray-600'
                            }`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDuplicate(project)}
                  disabled={busyId === project.id}
                  className="p-1.5 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 shrink-0 cursor-pointer disabled:opacity-50"
                  title="Duplicate project and its kit list"
                  aria-label={`Duplicate ${project.name}`}
                >
                  <Copy size={14} />
                </button>
                <ChevronRight size={16} className="text-gray-300 shrink-0 hidden sm:block" aria-hidden="true" />
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">
                {search || statusFilter !== 'all' ? 'No projects match' : 'No projects yet'}
              </p>
              {(search || statusFilter !== 'all') && (
                <button type="button" onClick={() => setParams({}, { replace: true })}
                  className="text-xs text-gray-500 underline mt-2 cursor-pointer">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <NewProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={handleCreate}
        creating={createProject.isPending}
      />
    </div>
  )
}
