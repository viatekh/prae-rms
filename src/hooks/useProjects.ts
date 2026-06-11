import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Project, ProjectLineItem } from '../types'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(*), line_items:project_line_items(id)')
        .order('event_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as Project[]
    },
  })
}

/** Fetches all projects with their line_items for item availability lookups */
export function useProjectsWithLines() {
  return useQuery({
    queryKey: ['projects-with-lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_number, status, event_date, collection_date, line_items:project_line_items(item_id)')
        .order('event_date', { ascending: true })
      if (error) throw error
      return data as (Pick<Project, 'id' | 'name' | 'project_number' | 'status' | 'event_date' | 'collection_date'> & { line_items: { item_id: string | null }[] })[]
    },
    staleTime: 60_000,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    staleTime: 30_000,
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
        .eq('id', id)
        .single()
      if (error) throw error
      // Sort line items by sort_order
      if (data.line_items) data.line_items.sort((a: ProjectLineItem, b: ProjectLineItem) => a.sort_order - b.sort_order)
      return data as Project
    },
    enabled: !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (project: Omit<Project, 'id' | 'created_at' | 'client' | 'line_items'>) => {
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
      // Strip joined relation objects — only send scalar DB columns
      const { client, line_items, ...scalars } = updates as any
      const { data, error } = await supabase.from('projects').update(scalars).eq('id', id).select().single()
      if (error) throw error
      return data as Project
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['projects', vars.id] })
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useSaveLineItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, lineItems }: { projectId: string; lineItems: Omit<ProjectLineItem, 'id' | 'item' | 'package' | 'children'>[] }) => {
      // Safe pattern: fetch existing IDs → insert new rows → delete old IDs
      // If insert fails we throw before deleting, so old data is preserved
      const { data: existing } = await supabase
        .from('project_line_items')
        .select('id')
        .eq('project_id', projectId)
      const oldIds = (existing || []).map((r: any) => r.id)

      if (lineItems.length > 0) {
        const { error } = await supabase.from('project_line_items').insert(
          lineItems.map(l => ({ ...l, project_id: projectId }))
        )
        if (error) throw error
      }

      // Now safe to delete the old rows
      if (oldIds.length > 0) {
        await supabase.from('project_line_items').delete().in('id', oldIds)
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['booked-qty'] })
    },
  })
}

export function useNextProjectNumber() {
  return useQuery({
    queryKey: ['next-project-number'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'quote_next_number').single()
      const { data: prefix } = await supabase.from('settings').select('value').eq('key', 'quote_prefix').single()
      const num = parseInt(data?.value || '1')
      const p = prefix?.value || 'QUOTE'
      return `${p}-${String(num).padStart(5, '0')}`
    },
  })
}

export async function incrementProjectNumber(qc?: QueryClient) {
  const { data } = await supabase.from('settings').select('value').eq('key', 'quote_next_number').single()
  const next = parseInt(data?.value || '1') + 1
  await supabase.from('settings').update({ value: String(next) }).eq('key', 'quote_next_number')
  qc?.invalidateQueries({ queryKey: ['next-project-number'] })
}
