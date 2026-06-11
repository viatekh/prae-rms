import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Item } from '../types'

export interface BookingConflict {
  item_id: string
  project_id: string
  project_name: string
  project_number: string
  event_date: string | null
}

export function useItemConflicts(itemIds: string[], projectId: string, eventDate: string | null, collectionDate: string | null) {
  return useQuery({
    queryKey: ['conflicts', itemIds, projectId, eventDate, collectionDate],
    enabled: itemIds.length > 0 && !!(eventDate || collectionDate),
    queryFn: async () => {
      // Find any other confirmed/sent projects whose date range overlaps with ours
      // that contain any of the given item_ids
      const start = eventDate || collectionDate
      const end = collectionDate || eventDate

      const { data, error } = await supabase
        .from('project_line_items')
        .select('item_id, project:projects!inner(id, name, project_number, event_date, collection_date, status)')
        .in('item_id', itemIds)
        .neq('project_id', projectId)
        .in('projects.status', ['sent', 'confirmed', 'invoiced'])

      if (error) throw error

      // Client-side date overlap check
      const conflicts: BookingConflict[] = []
      for (const row of (data || [])) {
        const p = (row as any).project
        if (!p) continue
        const pStart = p.event_date || p.collection_date
        const pEnd = p.collection_date || p.event_date
        if (!pStart || !end || !start) continue
        // Overlap: our start <= their end AND our end >= their start
        if (start <= pEnd && end >= pStart) {
          conflicts.push({
            item_id: row.item_id as string,
            project_id: p.id,
            project_name: p.name,
            project_number: p.project_number,
            event_date: p.event_date,
          })
        }
      }
      return conflicts
    },
  })
}

// ─── Per-item-type availability ───────────────────────────────────────────────
// Returns a map from item.id → { total, booked, available }
// "total" = number of physical units of that name in inventory
// "booked" = qty already committed to OTHER sent/confirmed/invoiced projects on overlapping dates

function useBookedQtyMap(
  projectId: string,
  eventDate: string | null,
  collectionDate: string | null
) {
  return useQuery({
    queryKey: ['booked-qty', projectId, eventDate, collectionDate],
    enabled: !!(eventDate || collectionDate),
    staleTime: 30_000,
    queryFn: async () => {
      const start = eventDate || collectionDate
      const end   = collectionDate || eventDate

      const { data, error } = await supabase
        .from('project_line_items')
        .select('item_id, quantity, project:projects!inner(id, event_date, collection_date, status)')
        .neq('project_id', projectId)
        .not('item_id', 'is', null)
        .in('projects.status', ['sent', 'confirmed', 'invoiced'])

      if (error) throw error

      const map = new Map<string, number>() // item_id (uuid) → qty booked
      for (const row of (data || [])) {
        const p = (row as any).project
        if (!p) continue
        const pStart = p.event_date || p.collection_date
        const pEnd   = p.collection_date || p.event_date
        if (!pStart || !start || !end) continue
        if (start <= pEnd && end >= pStart) {
          const prev = map.get(row.item_id as string) || 0
          map.set(row.item_id as string, prev + (row.quantity as number))
        }
      }
      return map
    },
  })
}

export interface ItemAvailability {
  total: number     // physical units of this name in inventory
  booked: number    // committed in other overlapping projects
  available: number // total - booked
  max: number       // max qty user should be allowed to add (same as available)
}

export function useItemTypeAvailability(
  allItems: Item[],
  projectId: string,
  eventDate: string | null,
  collectionDate: string | null
): Map<string, ItemAvailability> {
  const { data: bookedByItemId = new Map() } = useBookedQtyMap(projectId, eventDate, collectionDate)

  return useMemo(() => {
    // Group all hireable items by lowercased name → get total count per type
    // Exclude out-of-service items — they can't be booked
    const activeItems = allItems.filter(i => !i.out_of_service)
    const byName = new Map<string, Item[]>()
    for (const item of activeItems) {
      const key = item.name.trim().toLowerCase()
      if (!byName.has(key)) byName.set(key, [])
      byName.get(key)!.push(item)
    }

    // For each item, compute availability based on its name-group
    const result = new Map<string, ItemAvailability>()
    for (const item of activeItems) {
      const key  = item.name.trim().toLowerCase()
      const peers = byName.get(key) || []
      const total  = peers.length
      const booked = peers.reduce((sum, p) => sum + (bookedByItemId.get(p.id) || 0), 0)
      const available = Math.max(0, total - booked)
      result.set(item.id, { total, booked, available, max: available })
    }
    return result
  }, [allItems, bookedByItemId])
}
