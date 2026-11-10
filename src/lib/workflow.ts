import type { Project, ProjectStatus } from '../types'

/**
 * A project's lifecycle as the user experiences it. Commercial status and the
 * warehouse check-out/check-in timestamps are stored separately; this folds
 * them into the one line of progress people actually think in.
 */
export const WORKFLOW_STAGES = [
  { key: 'draft',     label: 'Draft' },
  { key: 'sent',      label: 'Quoted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'out',       label: 'Out' },
  { key: 'returned',  label: 'Returned' },
  { key: 'invoiced',  label: 'Invoiced' },
  { key: 'completed', label: 'Completed' },
] as const

export type WorkflowStageKey = typeof WORKFLOW_STAGES[number]['key']

type WorkflowFields = Pick<Project, 'status' | 'check_out_at' | 'check_in_at'>

export interface WorkflowAction {
  label: string
  updates: Partial<Pick<Project, 'status' | 'check_out_at' | 'check_in_at'>>
}

export function workflowStageIndex(p: WorkflowFields): number {
  if (p.status === 'completed') return 6
  if (p.status === 'invoiced') return 5
  if (p.check_in_at) return 4
  if (p.check_out_at) return 3
  if (p.status === 'confirmed') return 2
  if (p.status === 'sent') return 1
  return 0
}

/** The single most likely next step, or null once the project is completed. */
export function nextWorkflowAction(p: WorkflowFields, now: Date = new Date()): WorkflowAction | null {
  const status = (s: ProjectStatus) => ({ status: s })
  switch (workflowStageIndex(p)) {
    case 0: return { label: 'Mark quote sent', updates: status('sent') }
    case 1: return { label: 'Confirm booking', updates: status('confirmed') }
    case 2: return { label: 'Check out kit', updates: { check_out_at: now.toISOString() } }
    case 3: return { label: 'Check in kit', updates: { check_in_at: now.toISOString() } }
    case 4: return { label: 'Mark invoiced', updates: status('invoiced') }
    case 5: return { label: 'Mark completed', updates: status('completed') }
    default: return null
  }
}

/** Default hire length for a new line: event → collection, at least one day. */
export function defaultHireDays(eventDate: string | null, collectionDate: string | null): number {
  if (!eventDate || !collectionDate) return 1
  const ms = new Date(collectionDate).getTime() - new Date(eventDate).getTime()
  if (Number.isNaN(ms)) return 1
  return Math.max(1, Math.ceil(ms / 86400000))
}
