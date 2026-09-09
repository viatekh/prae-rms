import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Project, ProjectLineItem, ProjectStatus } from '../types'

export type NewProject = Omit<Project, 'id' | 'created_at' | 'client' | 'line_items'>
export type LineItemDraft = Omit<ProjectLineItem, 'id' | 'item' | 'package' | 'children'>

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(*), line_items:project_line_items(id, is_component)')
        .order('event_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as Project[]
    },
  })
}

type ProjectWithItemIds = Pick<Project, 'id' | 'name' | 'project_number' | 'status' | 'event_date' | 'collection_date'>
  & { line_items: { item_id: string | null }[] }

/** Projects plus the item ids they book — used for inventory availability lookups. */
export function useProjectsWithLines() {
  return useQuery({
    queryKey: ['projects-with-lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_number, status, event_date, collection_date, line_items:project_line_items(item_id)')
        .order('event_date', { ascending: true })
      if (error) throw error
      return data as ProjectWithItemIds[]
    },
    staleTime: 60_000,
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    staleTime: 30_000,
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(*),
          line_items:project_line_items(
            *,
            item:items(*, components:item_components(*)),
            package:packages(*)
          )
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      if (data.line_items) {
        data.line_items.sort((a: ProjectLineItem, b: ProjectLineItem) => a.sort_order - b.sort_order)
      }
      return data as Project
    },
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (project: NewProject) => {
      const { data, error } = await supabase.from('projects').insert(project).select().single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      // Strip joined relation objects — only scalar DB columns may be sent.
      const { client: _client, line_items: _lineItems, ...scalars } = updates
      const { data, error } = await supabase.from('projects').update(scalars).eq('id', id).select().single()
      if (error) throw error
      return data as Project
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['projects', vars.id] })
      // A status change moves stock in or out of the committed pool.
      qc.invalidateQueries({ queryKey: ['booked-qty'] })
      qc.invalidateQueries({ queryKey: ['conflicts'] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['booked-qty'] })
    },
  })
}

/** Copies every line of `sourceProjectId` onto `targetProjectId`. */
export async function copyLineItems(sourceProjectId: string, targetProjectId: string) {
  const { data, error } = await supabase
    .from('project_line_items')
    .select('*')
    .eq('project_id', sourceProjectId)
    .order('sort_order')
  if (error) throw error
  const rows = (data ?? []) as ProjectLineItem[]
  if (rows.length === 0) return 0

  const copies = rows.map(({ id: _id, project_id: _projectId, ...line }) => ({
    ...line,
    project_id: targetProjectId,
    // parent links point at rows of the source project; components are matched
    // by item_id/package_id for display, so drop the stale reference.
    parent_line_id: null,
  }))
  const { error: insertError } = await supabase.from('project_line_items').insert(copies)
  if (insertError) throw insertError
  return copies.length
}

export function useSaveLineItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, lineItems }: { projectId: string; lineItems: LineItemDraft[] }) => {
      // Fetch existing ids → insert the new set → delete the old rows.
      // Insert first so a failure leaves the previous kit list intact.
      const { data: existing, error: readError } = await supabase
        .from('project_line_items')
        .select('id')
        .eq('project_id', projectId)
      if (readError) throw readError
      const oldIds = (existing ?? []).map(r => r.id as string)

      if (lineItems.length > 0) {
        const { error } = await supabase.from('project_line_items').insert(
          lineItems.map(l => ({ ...l, project_id: projectId }))
        )
        if (error) throw error
      }

      if (oldIds.length > 0) {
        const { error } = await supabase.from('project_line_items').delete().in('id', oldIds)
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['booked-qty'] })
      qc.invalidateQueries({ queryKey: ['conflicts'] })
    },
  })
}

function formatProjectNumber(prefix: string, num: number) {
  return `${prefix}-${String(num).padStart(5, '0')}`
}

async function readNumberSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['quote_next_number', 'quote_prefix'])
  if (error) throw error
  const map = Object.fromEntries((data ?? []).map(r => [r.key as string, r.value as string]))
  return {
    next: Number.parseInt(map.quote_next_number || '1', 10) || 1,
    prefix: map.quote_prefix || 'QUOTE',
  }
}

/** The number the next project would be given. Preview only — reserve it with `reserveProjectNumber`. */
export function useNextProjectNumber() {
  return useQuery({
    queryKey: ['next-project-number'],
    queryFn: async () => {
      const { next, prefix } = await readNumberSettings()
      return formatProjectNumber(prefix, next)
    },
  })
}

/**
 * Claims the next project number and advances the counter.
 * Returns the reserved number so the caller can't hand out one already taken.
 */
export async function reserveProjectNumber(qc?: QueryClient): Promise<string> {
  const { next, prefix } = await readNumberSettings()
  const { error } = await supabase
    .from('settings')
    .update({ value: String(next + 1) })
    .eq('key', 'quote_next_number')
  if (error) throw error
  qc?.invalidateQueries({ queryKey: ['next-project-number'] })
  return formatProjectNumber(prefix, next)
}

export const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'sent', 'confirmed', 'invoiced', 'completed']
